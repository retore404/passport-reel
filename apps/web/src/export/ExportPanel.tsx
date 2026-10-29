import { useState } from "react";
import { FRAME_HEIGHT, FRAME_WIDTH } from "../timeline/drawFrame";
import type { Timeline } from "../timeline/timeline";
import { formatTime, totalDuration } from "../timeline/timing";
import { progressText } from "./frames";
import { canShareFile, downloadVideo, shareVideo } from "./saveVideo";
import type { VideoExport } from "./useVideoExport";

type Props = {
  readonly timeline: Timeline;
  readonly videoExport: VideoExport;
  /** 書き出しを始めるときに呼ぶ（プレビューの再生を止めるため）。 */
  readonly onStart: () => void;
  /** PC 幅ではダウンロード、スマートフォン幅では共有を主な操作として強調する。 */
  readonly wide: boolean;
};

/** 動画の書き出しボタンと、書き出し中の進捗・完了・非対応・失敗の表示。 */
export function ExportPanel({ timeline, videoExport, onStart, wide }: Props) {
  const { state, start, cancel, reset } = videoExport;
  const [saveMessage, setSaveMessage] = useState<string>();

  function handleStart() {
    setSaveMessage(undefined);
    onStart();
    start();
  }

  if (state.status === "checking" || state.status === "unsupported" || state.status === "ready") {
    return (
      <div className="export-panel">
        <button
          type="button"
          className="button button--primary button--block"
          disabled={state.status !== "ready"}
          onClick={handleStart}
        >
          {state.status === "checking" ? "書き出し方法を確認中…" : "動画を書き出す"}
        </button>
        {state.status === "unsupported" && (
          <p className="export-error">
            この環境では動画を書き出せません。PC・Android の Chrome、iPhone の Safari
            で書き出せます。
          </p>
        )}
      </div>
    );
  }

  if (state.status === "exporting") {
    return (
      <div className="export-panel">
        <p className="export-heading">動画を書き出しています</p>
        <progress className="export-progress" value={state.done} max={state.total}>
          {progressText(state.done, state.total)}
        </progress>
        <p className="export-detail">{progressText(state.done, state.total)}</p>
        <button type="button" className="button button--secondary button--block" onClick={cancel}>
          キャンセル
        </button>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="export-panel">
        <p className="export-error">書き出しに失敗しました（{state.message}）。</p>
        <button
          type="button"
          className="button button--primary button--block"
          onClick={handleStart}
        >
          もう一度書き出す
        </button>
      </div>
    );
  }

  const { file, format } = state;
  return (
    <div className="export-panel">
      <p className="export-heading">書き出しが完了しました</p>
      <dl className="export-info">
        <dt>ファイル名</dt>
        <dd>{file.name}</dd>
        <dt>長さ</dt>
        <dd>{formatTime(totalDuration(timeline))}</dd>
        <dt>解像度</dt>
        <dd>
          {FRAME_WIDTH}×{FRAME_HEIGHT}
        </dd>
        <dt>形式</dt>
        <dd>{format.label}</dd>
      </dl>
      <SaveButtons file={file} wide={wide} onMessage={setSaveMessage} />
      {saveMessage && <output className="export-detail">{saveMessage}</output>}
      <button
        type="button"
        className="button button--secondary button--block"
        onClick={() => {
          setSaveMessage(undefined);
          reset();
        }}
      >
        閉じる
      </button>
    </div>
  );
}

/**
 * 書き出した動画の保存操作。ダウンロードは常に出し、共有は共有シートを開ける環境でだけ出す。
 * PC の共有シートには保存の選択肢がないため、共有をダウンロードの代わりにはしない。
 */
function SaveButtons({
  file,
  wide,
  onMessage,
}: {
  readonly file: File;
  readonly wide: boolean;
  readonly onMessage: (message: string | undefined) => void;
}) {
  const shareable = canShareFile(file, navigator);
  const download = (
    <button
      key="download"
      type="button"
      className={`button button--block ${wide || !shareable ? "button--primary" : "button--secondary"}`}
      onClick={() => {
        downloadVideo(file);
        onMessage("ダウンロードしました。");
      }}
    >
      ダウンロード
    </button>
  );
  if (!shareable) {
    return download;
  }
  const share = (
    <button
      key="share"
      type="button"
      className={`button button--block ${wide ? "button--secondary" : "button--primary"}`}
      onClick={() => {
        shareVideo(file, navigator).then(
          (shared) => onMessage(shared ? "共有しました。" : undefined),
          (error: unknown) => onMessage(`共有できませんでした（${String(error)}）。`),
        );
      }}
    >
      共有
    </button>
  );
  // 主な操作を上に置く
  return wide ? [download, share] : [share, download];
}
