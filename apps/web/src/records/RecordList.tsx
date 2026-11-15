import {
  type Announcements,
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  type Modifier,
  PointerSensor,
  type ScreenReaderInstructions,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { countryName, displayCountryCode } from "./countryNames";
import { groupByYear, isRevisit, type VisitRecord, type YearGroup } from "./visitRecords";

type Props = {
  readonly records: readonly VisitRecord[];
  readonly onRemove: (record: VisitRecord) => void;
  /** 記録 from を、同じ年の記録 to の位置へ移す（訪問順の並べ替え）。 */
  readonly onMove: (from: VisitRecord, to: VisitRecord) => void;
  /** 記録がないときに示す、追加の方法。画面の構成によって追加の入口が異なるため呼び出し側が渡す。 */
  readonly emptyHint: string;
};

/** 年ごとにまとめた訪問記録の一覧。新しい年が上、年の中は訪問順。同じ年の中はつまみから並べ替えられる。 */
export function RecordList({ records, onRemove, onMove, emptyHint }: Props) {
  if (records.length === 0) {
    return (
      <div className="record-list-empty">
        <p>まだ記録がありません。</p>
        <p>{emptyHint}</p>
      </div>
    );
  }
  return (
    <div className="record-list">
      {groupByYear(records).map((group) => (
        <YearSection
          key={group.year}
          group={group}
          records={records}
          onRemove={onRemove}
          onMove={onMove}
        />
      ))}
    </div>
  );
}

function recordId(record: VisitRecord): string {
  return `${record.year}-${record.country}`;
}

/** 並べ替えは縦方向だけなので、ドラッグ中の行が横にずれないようにする。 */
const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

const SCREEN_READER_INSTRUCTIONS: ScreenReaderInstructions = {
  draggable:
    "並べ替えるには、Space キーで持ち上げ、上下の矢印キーで動かし、もう一度 Space キーで置きます。Esc キーで取り消します。",
};

/** 読み上げの文言。既定は英語で、記録の ID（例：2019-FR）をそのまま読むため、国名の日本語の文にする。 */
function announcements(byId: ReadonlyMap<UniqueIdentifier, VisitRecord>): Announcements {
  const name = (id: UniqueIdentifier | undefined) => {
    const record = id === undefined ? undefined : byId.get(id);
    return record ? countryName(record.country) : "";
  };
  return {
    onDragStart: ({ active }) => `${name(active.id)}を持ち上げました。`,
    onDragOver: ({ active, over }) =>
      over ? `${name(active.id)}を${name(over.id)}の位置へ動かしています。` : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `${name(active.id)}を${name(over.id)}の位置に置きました。`
        : `${name(active.id)}を元の位置に戻しました。`,
    onDragCancel: ({ active }) =>
      `並べ替えを取り消しました。${name(active.id)}は元の位置に戻りました。`,
  };
}

/**
 * 1 年分の記録。年ごとに DndContext を分けて、ドラッグ先の候補をその年の記録だけにし、記録を別の年へ移せないようにする。
 */
function YearSection({
  group,
  records,
  onRemove,
  onMove,
}: {
  readonly group: YearGroup;
  readonly records: readonly VisitRecord[];
  readonly onRemove: (record: VisitRecord) => void;
  readonly onMove: (from: VisitRecord, to: VisitRecord) => void;
}) {
  // ポインタ（マウス・タッチ）はわずかに動かしてから持ち上げ、つまみのタップやフォーカスと区別する
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const byId = new Map<UniqueIdentifier, VisitRecord>(group.records.map((r) => [recordId(r), r]));

  function handleDragEnd({ active, over }: DragEndEvent) {
    const from = byId.get(active.id);
    const to = over ? byId.get(over.id) : undefined;
    if (from && to) {
      onMove(from, to);
    }
  }

  return (
    <section aria-labelledby={`year-${group.year}`}>
      <h2 id={`year-${group.year}`} className="record-year">
        {group.year}
      </h2>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[verticalOnly]}
        accessibility={{
          announcements: announcements(byId),
          screenReaderInstructions: SCREEN_READER_INSTRUCTIONS,
        }}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={group.records.map(recordId)} strategy={verticalListSortingStrategy}>
          <ul>
            {group.records.map((record) => (
              <RecordRow
                key={record.country}
                record={record}
                revisit={isRevisit(records, record)}
                onRemove={onRemove}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </section>
  );
}

function RecordRow({
  record,
  revisit,
  onRemove,
}: {
  readonly record: VisitRecord;
  readonly revisit: boolean;
  readonly onRemove: (record: VisitRecord) => void;
}) {
  const name = countryName(record.country);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: recordId(record) });
  return (
    <li
      ref={setNodeRef}
      className={isDragging ? "record-row record-row--dragging" : "record-row"}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      {/* 行全体ではなくつまみからだけドラッグを始め、一覧のスクロールや削除ボタンの操作とぶつからないようにする */}
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="drag-handle"
        aria-label={`${record.year}年 ${name} の訪問順を並べ替え`}
        {...attributes}
        {...listeners}
      >
        <svg viewBox="0 0 10 16" width="10" height="16" aria-hidden="true">
          {[3, 8, 13].map((y) => (
            <g key={y}>
              <circle cx="2.5" cy={y} r="1.4" />
              <circle cx="7.5" cy={y} r="1.4" />
            </g>
          ))}
        </svg>
      </button>
      <span className="country-code">{displayCountryCode(record.country)}</span>
      <span className="record-name">{name}</span>
      {revisit && <span className="tag">再訪</span>}
      <button
        type="button"
        className="icon-button"
        aria-label={`${record.year}年 ${name} を削除`}
        onClick={() => onRemove(record)}
      >
        ×
      </button>
    </li>
  );
}
