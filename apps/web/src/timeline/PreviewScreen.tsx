import { useEffect, useMemo, useRef, useState } from "react";
import { loadMapCountries, type MapCountry } from "../map/countries";
import type { VisitRecord } from "../records/visitRecords";
import { drawFrame, FRAME_HEIGHT, FRAME_WIDTH } from "./drawFrame";
import { createMapLayers } from "./mapLayers";
import { buildTimeline, type Timeline } from "./timeline";
import { frameAt, frameStartTimes, totalDuration } from "./timing";
import { usePlayback } from "./usePlayback";

type Props = {
  readonly records: readonly VisitRecord[];
  /** PC 幅ではコマの一覧を右のパネルに出す。 */
  readonly wide: boolean;
};

function formatTime(seconds: number): string {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** 記録から作ったタイムラインを 9:16 で再生するプレビュー画面。 */
export function PreviewScreen({ records, wide }: Props) {
  const timeline = useMemo(() => buildTimeline(records), [records]);
  if (!timeline) {
    return (
      <div className="preview-empty">
        <p>まだ記録がありません。</p>
        <p>「記録」で訪れた国を追加すると、ここで再生できます。</p>
      </div>
    );
  }
  return <TimelinePlayer timeline={timeline} wide={wide} />;
}

function TimelinePlayer({
  timeline,
  wide,
}: {
  readonly timeline: Timeline;
  readonly wide: boolean;
}) {
  const duration = totalDuration(timeline);
  const playback = usePlayback(duration);
  const frame = frameAt(timeline, playback.time);
  const currentIndex = frame.kind === "year" ? frame.index : timeline.years.length;
  const starts = frameStartTimes(timeline);

  return (
    <div className={wide ? "preview-wide" : "preview-narrow"}>
      <div className="preview-main">
        <FrameCanvas timeline={timeline} time={playback.time} />
        <div className="preview-controls">
          <button type="button" className="button button--secondary" onClick={playback.restart}>
            最初から再生
          </button>
          <button
            type="button"
            className="button button--primary preview-toggle"
            onClick={playback.playing ? playback.pause : playback.play}
          >
            {playback.playing ? "停止" : "再生"}
          </button>
          <input
            className="preview-seek"
            type="range"
            min={0}
            max={duration}
            step={0.01}
            value={playback.time}
            aria-label="再生位置"
            aria-valuetext={`${formatTime(playback.time)} / ${formatTime(duration)}`}
            onChange={(event) => playback.seek(Number(event.target.value))}
          />
          <span className="preview-time">
            {formatTime(playback.time)} / {formatTime(duration)}
          </span>
        </div>
      </div>
      {wide && (
        <aside className="preview-panel" aria-label="コマの一覧">
          <h2 className="panel-heading">コマ</h2>
          <ol className="frame-list">
            {[...timeline.years.map((entry) => `${entry.year}`), "まとめ"].map((label, index) => (
              <li key={label}>
                <button
                  type="button"
                  className="frame-item"
                  aria-current={index === currentIndex ? "step" : undefined}
                  onClick={() => playback.seek(starts[index] ?? 0)}
                >
                  <span>{label}</span>
                  <span className="frame-item-count">
                    {index < timeline.years.length
                      ? `+${timeline.years[index]?.newCountries.length ?? 0}`
                      : `${timeline.summary.countries.length} か国`}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </aside>
      )}
    </div>
  );
}

/** 9:16 を保って領域に収まる最大の大きさで、時刻 time のコマを描く。 */
function FrameCanvas({ timeline, time }: { readonly timeline: Timeline; readonly time: number }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [countries, setCountries] = useState<readonly MapCountry[]>();
  const [cssWidth, setCssWidth] = useState(0);
  const layers = useMemo(() => (countries ? createMapLayers(countries) : undefined), [countries]);

  useEffect(() => {
    let cancelled = false;
    void loadMapCountries().then((loaded) => {
      if (!cancelled) {
        setCountries(loaded);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return undefined;
    }
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        const { width, height } = entry.contentRect;
        setCssWidth(Math.floor(Math.min(width, (height * FRAME_WIDTH) / FRAME_HEIGHT)));
      }
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !layers || cssWidth === 0) {
      return;
    }
    // 高 DPI 画面でぼやけないよう、内部解像度は devicePixelRatio 倍にする
    const width = Math.round(cssWidth * (window.devicePixelRatio || 1));
    const height = Math.round((width * FRAME_HEIGHT) / FRAME_WIDTH);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    drawFrame(ctx, width, timeline, frameAt(timeline, time), layers);
  }, [timeline, time, layers, cssWidth]);

  return (
    <div ref={stageRef} className="preview-stage">
      <canvas
        ref={canvasRef}
        className="preview-canvas"
        style={{ width: cssWidth, height: (cssWidth * FRAME_HEIGHT) / FRAME_WIDTH }}
      >
        訪問した国を年ごとに積み上げていくアニメーション
      </canvas>
    </div>
  );
}
