import {
  BufferTarget,
  canEncodeVideo,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  Quality,
} from "mediabunny";
import type { MapCountry } from "../map/countries";
import { drawFrame, FRAME_HEIGHT, FRAME_WIDTH } from "../timeline/drawFrame";
import { createMapLayers } from "../timeline/mapLayers";
import type { Timeline } from "../timeline/timeline";
import { frameAt, totalDuration } from "../timeline/timing";
import { FPS, frameCount, frameTime, videoFileName } from "./frames";
import type { VideoFormat } from "./videoFormat";

/** 何フレームごとに処理を譲り、進捗表示とキャンセルボタンが反応できるようにするか。 */
const YIELD_EVERY_FRAMES = 5;

const QUALITY = new Quality("high");

/** このブラウザが 1080×1920 の動画をそのコーデックでエンコードできるか。 */
export function canEncodeFrameSize(codec: VideoFormat["codec"]): Promise<boolean> {
  return canEncodeVideo(codec, {
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
    quality: QUALITY,
    frameRate: FPS,
  });
}

type ExportOptions = {
  readonly onProgress: (done: number, total: number) => void;
  readonly signal: AbortSignal;
};

/**
 * タイムラインを 1080×1920・30fps の MP4 に書き出す。
 * プレビューと同じ drawFrame で、フレーム番号から決めた時刻のコマを 1 枚ずつ描いてエンコードする。
 * signal で中断されたら書き出しを破棄し、AbortError を投げる。
 */
export async function exportVideo(
  timeline: Timeline,
  countries: readonly MapCountry[],
  format: VideoFormat,
  { onProgress, signal }: ExportOptions,
): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = FRAME_WIDTH;
  canvas.height = FRAME_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D コンテキストを取得できない");
  }
  // プレビューとは解像度が異なるため、互いのキャッシュを捨て合わないよう地図のキャッシュは別に持つ
  const layers = createMapLayers(countries);

  // 共有先のアプリがすぐ再生を始められるよう、moov を先頭に置く
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: "in-memory" }),
    target: new BufferTarget(),
  });
  const source = new CanvasSource(canvas, {
    codec: format.codec,
    quality: QUALITY,
    keyFrameInterval: 2,
  });
  output.addVideoTrack(source, { frameRate: FPS });

  const total = frameCount(totalDuration(timeline));
  try {
    await output.start();
    for (let index = 0; index < total; index += 1) {
      signal.throwIfAborted();
      drawFrame(ctx, FRAME_WIDTH, timeline, frameAt(timeline, frameTime(index)), layers);
      // エンコーダの処理待ちに従う（待たずに積むとメモリを使い続ける）
      await source.add(frameTime(index), 1 / FPS);
      onProgress(index + 1, total);
      if ((index + 1) % YIELD_EVERY_FRAMES === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    signal.throwIfAborted();
    await output.finalize();
  } catch (error) {
    if (output.state !== "finalized" && output.state !== "canceled") {
      await output.cancel();
    }
    throw error;
  }

  const { buffer } = output.target;
  if (!buffer) {
    throw new Error("動画のデータが空");
  }
  return new File([buffer], videoFileName(timeline), { type: output.format.mimeType });
}
