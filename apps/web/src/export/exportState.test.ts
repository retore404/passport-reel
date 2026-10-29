import { describe, expect, test } from "vitest";
import {
  type ExportEvent,
  exportReducer,
  type ExportState,
  INITIAL_EXPORT_STATE,
} from "./exportState";
import type { VideoFormat } from "./videoFormat";

const h264: VideoFormat = { codec: "avc", label: "H.264 / MP4" };
const file = new File(["video"], "passport-reel-2016-2024.mp4", { type: "video/mp4" });

function run(...events: ExportEvent[]): ExportState {
  return events.reduce(exportReducer, INITIAL_EXPORT_STATE);
}

const ready: ExportEvent = { type: "formatChosen", format: h264 };
const started: ExportEvent = { type: "started", total: 300 };

describe("exportReducer", () => {
  test("形式が決まれば書き出せる状態、決まらなければ非対応", () => {
    expect(run(ready)).toEqual({ status: "ready", format: h264 });
    expect(run({ type: "formatChosen", format: undefined })).toEqual({ status: "unsupported" });
  });

  test("書き出し中は進捗を持つ", () => {
    expect(run(ready, started, { type: "progressed", done: 150, total: 300 })).toEqual({
      status: "exporting",
      format: h264,
      done: 150,
      total: 300,
    });
  });

  test("完了したらファイルを持つ", () => {
    expect(run(ready, started, { type: "finished", file })).toEqual({
      status: "done",
      format: h264,
      file,
    });
  });

  test("キャンセルしたら書き出す前の状態に戻り、遅れて届いた完了は無視する", () => {
    const canceled = run(ready, started, { type: "canceled" });
    expect(canceled).toEqual({ status: "ready", format: h264 });
    expect(exportReducer(canceled, { type: "finished", file })).toBe(canceled);
    expect(exportReducer(canceled, { type: "progressed", done: 10, total: 300 })).toBe(canceled);
  });

  test("失敗したら理由を持ち、もう一度書き出せる", () => {
    const failed = run(ready, started, { type: "failed", message: "エンコードに失敗" });
    expect(failed).toEqual({ status: "error", format: h264, message: "エンコードに失敗" });
    expect(exportReducer(failed, started).status).toBe("exporting");
  });

  test("非対応の環境では書き出しを始めない", () => {
    const unsupported = run({ type: "formatChosen", format: undefined });
    expect(exportReducer(unsupported, started)).toBe(unsupported);
  });

  test("完了表示を閉じたら書き出せる状態に戻る", () => {
    expect(run(ready, started, { type: "finished", file }, { type: "reset" })).toEqual({
      status: "ready",
      format: h264,
    });
  });
});
