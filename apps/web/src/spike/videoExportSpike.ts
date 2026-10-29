import {
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  Quality,
  WebMOutputFormat,
} from "mediabunny";
import type { MapCountry } from "../map/countries";
import { drawWorldMap } from "../map/drawWorldMap";

// issue #4 の動画書き出しスパイク用。本番アプリには含めない（spike ブランチのみ）。

export const VIDEO_WIDTH = 1080;
export const VIDEO_HEIGHT = 1920;
const FPS = 30;
const DURATION_SECONDS = 5;
const FRAME_COUNT = FPS * DURATION_SECONDS;

/** 書き出しを試す形式。iOS の写真アプリは WebM を扱えない可能性があるため、VP9 は MP4 と WebM の両方で試す。 */
export const EXPORT_CASES = [
  { id: "h264-mp4", label: "H.264 / MP4", codec: "avc", container: "mp4" },
  { id: "vp9-mp4", label: "VP9 / MP4", codec: "vp9", container: "mp4" },
  { id: "vp9-webm", label: "VP9 / WebM", codec: "vp9", container: "webm" },
] as const;

export type ExportCase = (typeof EXPORT_CASES)[number];

/** WebCodecs に直接問い合わせるコーデック文字列。1080x1920 を扱えるレベルを指定する。 */
const PROBE_CODECS = [
  { label: "H.264 High L4.0", codec: "avc1.640028" },
  { label: "H.264 Baseline L4.0", codec: "avc1.42E028" },
  { label: "VP9 Profile0 L4.0", codec: "vp09.00.40.08" },
] as const;

const RECORDER_TYPES = [
  "video/mp4;codecs=avc1.640028",
  "video/mp4",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
] as const;

export type Environment = {
  readonly userAgent: string;
  readonly secureContext: boolean;
  readonly webCodecs: boolean;
  readonly share: boolean;
  readonly probes: readonly { readonly label: string; readonly result: string }[];
  readonly recorderTypes: readonly { readonly type: string; readonly supported: boolean }[];
};

export async function inspectEnvironment(): Promise<Environment> {
  const webCodecs = typeof VideoEncoder !== "undefined";
  const probes = await Promise.all(
    PROBE_CODECS.flatMap(({ label, codec }) =>
      (["no-preference", "prefer-hardware"] as const).map(async (hardwareAcceleration) => ({
        label: `${label} (${hardwareAcceleration})`,
        result: webCodecs
          ? await VideoEncoder.isConfigSupported({
              codec,
              width: VIDEO_WIDTH,
              height: VIDEO_HEIGHT,
              bitrate: 8_000_000,
              framerate: FPS,
              hardwareAcceleration,
            }).then(
              (support) => (support.supported === true ? "OK" : "NG"),
              (error: unknown) => `例外: ${String(error)}`,
            )
          : "WebCodecs なし",
      })),
    ),
  );
  const recorderAvailable = typeof MediaRecorder !== "undefined";
  return {
    userAgent: navigator.userAgent,
    secureContext: window.isSecureContext,
    webCodecs,
    share: typeof navigator.canShare === "function",
    probes,
    recorderTypes: RECORDER_TYPES.map((type) => ({
      type,
      supported: recorderAvailable && MediaRecorder.isTypeSupported(type),
    })),
  };
}

/** 本番と同程度の描画負荷にするため、訪問国が少しずつ増えていく地図を毎フレーム描き直す。 */
function drawFrame(
  ctx: CanvasRenderingContext2D,
  countries: readonly MapCountry[],
  frame: number,
): void {
  const codes = countries.flatMap(({ alpha2 }) => (alpha2 === undefined ? [] : [alpha2]));
  const visibleCount = Math.floor((codes.length * (frame + 1)) / FRAME_COUNT);
  drawWorldMap(
    ctx,
    { width: VIDEO_WIDTH, height: VIDEO_HEIGHT },
    countries,
    new Set(codes.slice(0, visibleCount)),
  );
  ctx.fillStyle = "#e7eaf0";
  ctx.font = "bold 96px sans-serif";
  ctx.fillText(`${2000 + Math.floor(frame / FPS)}`, 80, 220);
  ctx.font = "48px sans-serif";
  ctx.fillText(`frame ${frame + 1} / ${FRAME_COUNT}`, 80, 300);
}

export type ExportResult =
  | {
      readonly ok: true;
      readonly file: File;
      readonly elapsedMs: number;
      readonly playback: string;
    }
  | { readonly ok: false; readonly error: string; readonly elapsedMs: number };

export async function runExport(
  exportCase: ExportCase,
  canvas: HTMLCanvasElement,
  countries: readonly MapCountry[],
  onProgress: (frame: number) => void,
): Promise<ExportResult> {
  const startedAt = performance.now();
  try {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D コンテキストを取得できない");
    }
    const output = new Output({
      format: exportCase.container === "mp4" ? new Mp4OutputFormat() : new WebMOutputFormat(),
      target: new BufferTarget(),
    });
    const source = new CanvasSource(canvas, {
      codec: exportCase.codec,
      quality: new Quality("high"),
      keyFrameInterval: 2,
    });
    output.addVideoTrack(source, { frameRate: FPS });
    await output.start();
    // 実時間ではなくフレーム番号から時刻を決めるため、描画やエンコードが遅くてもコマ落ちしない
    for (let frame = 0; frame < FRAME_COUNT; frame += 1) {
      drawFrame(ctx, countries, frame);
      await source.add(frame / FPS, 1 / FPS);
      onProgress(frame + 1);
    }
    await output.finalize();
    const { buffer } = output.target;
    if (!buffer) {
      throw new Error("出力バッファが空");
    }
    const file = new File(
      [buffer],
      `passport-reel-spike-${exportCase.id}.${exportCase.container}`,
      {
        type: output.format.mimeType,
      },
    );
    const elapsedMs = performance.now() - startedAt;
    return { ok: true, file, elapsedMs, playback: await checkPlayback(file) };
  } catch (error) {
    return { ok: false, error: String(error), elapsedMs: performance.now() - startedAt };
  }
}

/** 書き出したファイルをブラウザの video 要素で読み込めるかを確かめる。 */
async function checkPlayback(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("読み込みタイムアウト")), 8000);
      video.addEventListener("loadedmetadata", () => {
        clearTimeout(timer);
        resolve();
      });
      video.addEventListener("error", () => {
        clearTimeout(timer);
        reject(new Error(`video error code=${video.error?.code ?? "?"}`));
      });
      video.src = url;
    });
    await video.play();
    video.pause();
    return `OK (${video.videoWidth}x${video.videoHeight}, ${video.duration.toFixed(2)}s)`;
  } catch (error) {
    return `NG: ${String(error)}`;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export type ManualCheck = { save: string; play: string; note: string };

export function toMarkdown(
  env: Environment,
  results: ReadonlyMap<string, ExportResult>,
  manual: ReadonlyMap<string, ManualCheck>,
): string {
  const lines = [
    `### ${env.userAgent}`,
    "",
    `- secure context: ${env.secureContext}, WebCodecs: ${env.webCodecs}, navigator.canShare: ${env.share}`,
    "",
    "| isConfigSupported | 結果 |",
    "| --- | --- |",
    ...env.probes.map(({ label, result }) => `| ${label} | ${result} |`),
    "",
    "| MediaRecorder.isTypeSupported | 結果 |",
    "| --- | --- |",
    ...env.recorderTypes.map(({ type, supported }) => `| ${type} | ${supported ? "OK" : "NG"} |`),
    "",
    "| 形式 | 書き出し | 時間 | サイズ | video 再生 | 保存 | 保存後の再生 | メモ |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const exportCase of EXPORT_CASES) {
    const result = results.get(exportCase.id);
    const check = manual.get(exportCase.id);
    const manualCells = `${check?.save ?? "未確認"} | ${check?.play ?? "未確認"} | ${check?.note ?? ""}`;
    if (!result) {
      lines.push(`| ${exportCase.label} | 未実行 | - | - | - | ${manualCells} |`);
    } else if (result.ok) {
      lines.push(
        `| ${exportCase.label} | OK | ${(result.elapsedMs / 1000).toFixed(1)}s | ${(result.file.size / 1024 / 1024).toFixed(2)}MB | ${result.playback} | ${manualCells} |`,
      );
    } else {
      lines.push(
        `| ${exportCase.label} | NG: ${result.error} | ${(result.elapsedMs / 1000).toFixed(1)}s | - | - | ${manualCells} |`,
      );
    }
  }
  return lines.join("\n");
}
