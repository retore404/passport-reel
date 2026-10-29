import { useEffect, useRef, useState } from "react";
import { loadMapCountries, type MapCountry } from "../map/countries";
import {
  EXPORT_CASES,
  type Environment,
  type ExportCase,
  type ExportResult,
  inspectEnvironment,
  type ManualCheck,
  runExport,
  toMarkdown,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
} from "./videoExportSpike";
import "./spike.css";

// issue #4 の動画書き出しスパイクの検証ページ。本番アプリには含めない（spike ブランチのみ）。

const MANUAL_OPTIONS = ["未確認", "OK", "NG", "対象外"] as const;

export function VideoExportSpike() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [countries, setCountries] = useState<readonly MapCountry[]>();
  const [env, setEnv] = useState<Environment>();
  const [results, setResults] = useState<ReadonlyMap<string, ExportResult>>(new Map());
  const [manual, setManual] = useState<ReadonlyMap<string, ManualCheck>>(new Map());
  const [running, setRunning] = useState<string>();
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void loadMapCountries().then(setCountries);
    void inspectEnvironment().then(setEnv);
  }, []);

  async function exportOne(exportCase: ExportCase) {
    const canvas = canvasRef.current;
    if (!canvas || !countries) {
      return;
    }
    setRunning(exportCase.id);
    setProgress(0);
    const result = await runExport(exportCase, canvas, countries, setProgress);
    setResults((prev) => new Map(prev).set(exportCase.id, result));
    setRunning(undefined);
  }

  async function exportAll() {
    for (const exportCase of EXPORT_CASES) {
      await exportOne(exportCase);
    }
  }

  function updateManual(id: string, patch: Partial<ManualCheck>) {
    setManual((prev) => {
      const current = prev.get(id) ?? { save: "未確認", play: "未確認", note: "" };
      return new Map(prev).set(id, { ...current, ...patch });
    });
  }

  async function copyMarkdown() {
    if (!env) {
      return;
    }
    await navigator.clipboard.writeText(toMarkdown(env, results, manual));
    setCopied(true);
  }

  return (
    <div className="spike">
      <h1>動画書き出しスパイク（#4）</h1>
      <p className="spike-muted">
        1080x1920・30fps・5秒の地図アニメーションを各形式で書き出す。端末ごとに「すべて書き出す」→
        各ファイルの保存と再生を確認 →「結果をコピー」して共有する。
      </p>

      <div className="spike-actions">
        <button
          type="button"
          disabled={!countries || running !== undefined}
          onClick={() => void exportAll()}
        >
          {countries ? "すべて書き出す" : "地図を読み込み中…"}
        </button>
        <button type="button" disabled={!env} onClick={() => void copyMarkdown()}>
          {copied ? "コピーしました" : "結果をコピー"}
        </button>
      </div>

      <canvas ref={canvasRef} className="spike-canvas" width={VIDEO_WIDTH} height={VIDEO_HEIGHT} />

      {EXPORT_CASES.map((exportCase) => {
        const result = results.get(exportCase.id);
        const check = manual.get(exportCase.id);
        return (
          <section key={exportCase.id} className="spike-card">
            <h2>{exportCase.label}</h2>
            {running === exportCase.id && <p>書き出し中… {progress} フレーム</p>}
            {result && !result.ok && <p className="spike-error">失敗: {result.error}</p>}
            {result?.ok && (
              <>
                <p>
                  {(result.elapsedMs / 1000).toFixed(1)}s ・{" "}
                  {(result.file.size / 1024 / 1024).toFixed(2)}MB ・ video 再生: {result.playback}
                </p>
                <div className="spike-actions">
                  <ShareButton file={result.file} />
                  <DownloadButton file={result.file} />
                </div>
                <div className="spike-manual">
                  <label>
                    保存
                    <select
                      value={check?.save ?? "未確認"}
                      onChange={(event) =>
                        updateManual(exportCase.id, { save: event.target.value })
                      }
                    >
                      {MANUAL_OPTIONS.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    保存後の再生
                    <select
                      value={check?.play ?? "未確認"}
                      onChange={(event) =>
                        updateManual(exportCase.id, { play: event.target.value })
                      }
                    >
                      {MANUAL_OPTIONS.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    メモ
                    <input
                      value={check?.note ?? ""}
                      placeholder="例: 写真アプリに保存できた"
                      onChange={(event) =>
                        updateManual(exportCase.id, { note: event.target.value })
                      }
                    />
                  </label>
                </div>
              </>
            )}
            {!result && running !== exportCase.id && (
              <button
                type="button"
                disabled={!countries || running !== undefined}
                onClick={() => void exportOne(exportCase)}
              >
                この形式だけ書き出す
              </button>
            )}
          </section>
        );
      })}

      {env && <pre className="spike-env">{toMarkdown(env, results, manual)}</pre>}
    </div>
  );
}

function ShareButton({ file }: { readonly file: File }) {
  const [status, setStatus] = useState<string>();
  const canShare =
    typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
  if (!canShare) {
    return <span className="spike-muted">共有: この端末では不可</span>;
  }
  return (
    <button
      type="button"
      onClick={() => {
        navigator.share({ files: [file] }).then(
          () => setStatus("共有完了"),
          (error: unknown) => setStatus(`共有失敗: ${String(error)}`),
        );
      }}
    >
      共有{status ? `（${status}）` : ""}
    </button>
  );
}

function DownloadButton({ file }: { readonly file: File }) {
  return (
    <button
      type="button"
      onClick={() => {
        const url = URL.createObjectURL(file);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = file.name;
        anchor.click();
        // ダウンロード開始前に解放すると失敗する端末があるため、少し待ってから解放する
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }}
    >
      ダウンロード
    </button>
  );
}
