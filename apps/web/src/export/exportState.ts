import type { VideoFormat } from "./videoFormat";

export type ExportState =
  | { readonly status: "checking" }
  | { readonly status: "unsupported" }
  | { readonly status: "ready"; readonly format: VideoFormat }
  | {
      readonly status: "exporting";
      readonly format: VideoFormat;
      readonly done: number;
      readonly total: number;
    }
  | { readonly status: "done"; readonly format: VideoFormat; readonly file: File }
  | { readonly status: "error"; readonly format: VideoFormat; readonly message: string };

export type ExportEvent =
  | { readonly type: "formatChosen"; readonly format: VideoFormat | undefined }
  | { readonly type: "started"; readonly total: number }
  | { readonly type: "progressed"; readonly done: number; readonly total: number }
  | { readonly type: "finished"; readonly file: File }
  | { readonly type: "failed"; readonly message: string }
  | { readonly type: "canceled" }
  | { readonly type: "reset" };

export const INITIAL_EXPORT_STATE: ExportState = { status: "checking" };

/**
 * 書き出しの状態遷移。
 * 書き出し中にだけ進捗・完了・失敗・キャンセルを受け付け、キャンセル後に遅れて届いた通知で状態が戻らないようにする。
 */
export function exportReducer(state: ExportState, event: ExportEvent): ExportState {
  switch (event.type) {
    case "formatChosen":
      if (state.status !== "checking") {
        return state;
      }
      return event.format ? { status: "ready", format: event.format } : { status: "unsupported" };
    case "started":
      if (state.status === "ready" || state.status === "done" || state.status === "error") {
        return { status: "exporting", format: state.format, done: 0, total: event.total };
      }
      return state;
    case "progressed":
      return state.status === "exporting"
        ? { ...state, done: event.done, total: event.total }
        : state;
    case "finished":
      return state.status === "exporting"
        ? { status: "done", format: state.format, file: event.file }
        : state;
    case "failed":
      return state.status === "exporting"
        ? { status: "error", format: state.format, message: event.message }
        : state;
    case "canceled":
      return state.status === "exporting" ? { status: "ready", format: state.format } : state;
    case "reset":
      return state.status === "done" || state.status === "error"
        ? { status: "ready", format: state.format }
        : state;
    default: {
      // イベントの種類を足したときに、ここで型エラーになって処理の漏れに気づけるようにする
      const unhandled: never = event;
      return unhandled;
    }
  }
}
