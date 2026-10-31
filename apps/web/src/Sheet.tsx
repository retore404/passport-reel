import { type ReactNode, useEffect, useId, useRef } from "react";

type Props = {
  readonly title: string;
  readonly onClose: () => void;
  /** 中身の量によらず画面の高さの 85% で開く。キーボードに隠れないよう入力欄を画面の上寄りに置きたいときに使う。 */
  readonly tall?: boolean;
  /** PC 幅では画面下いっぱいのシートではなく、中央のモーダルとして開く。PC でも開くシートで使う。 */
  readonly centeredOnWide?: boolean;
  readonly children: ReactNode;
};

/**
 * 画面下から出るシート。ネイティブの dialog をモーダルで開き、フォーカスの閉じ込めと Esc での閉じる動作をブラウザに任せる。
 * 背後（::backdrop）のタップと閉じるボタンでも閉じる。開いたときは中の文字入力欄にフォーカスを移す。
 */
export function Sheet({ title, onClose, tall = false, centeredOnWide = false, children }: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return undefined;
    }
    dialog.showModal();
    dialog.querySelector("input")?.focus();
    // 背後のタップは dialog 自身へのクリックとして届く（中身の上のクリックは子要素が target になる）
    function handleClick(event: MouseEvent) {
      if (event.target === dialog) {
        onClose();
      }
    }
    dialog.addEventListener("click", handleClick);
    return () => {
      dialog.removeEventListener("click", handleClick);
      dialog.close();
    };
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      className={["sheet", tall && "sheet--tall", centeredOnWide && "sheet--centered"]
        .filter(Boolean)
        .join(" ")}
      aria-labelledby={titleId}
      onCancel={(event) => {
        // Esc での閉じる動作も親の状態を通して行い、開閉の状態を一か所で持つ
        event.preventDefault();
        onClose();
      }}
    >
      <div className="sheet-body">
        <div className="sheet-header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-button" aria-label="閉じる" onClick={onClose}>
            ×
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
