import { useEffect, useReducer, useRef } from "react";
import { loadMapCountries } from "../map/countries";
import type { Reel } from "../timeline/reel";
import { totalDuration } from "../timeline/timing";
import { exportReducer, type ExportState, INITIAL_EXPORT_STATE } from "./exportState";
import { frameCount } from "./frames";
import { chooseVideoFormat } from "./videoFormat";

export type VideoExport = {
  readonly state: ExportState;
  readonly start: () => void;
  readonly cancel: () => void;
  readonly reset: () => void;
};

/**
 * タイムラインの動画書き出し。開いたときに使える形式を判定し、書き出し・キャンセル・完了表示を管理する。
 * 画面を離れたら（アンマウント）書き出しを中断する。
 */
export function useVideoExport(reel: Reel): VideoExport {
  const [state, dispatch] = useReducer(exportReducer, INITIAL_EXPORT_STATE);
  const controllerRef = useRef<AbortController>(undefined);

  useEffect(() => {
    let cancelled = false;
    // 書き出しの処理（Mediabunny を含む）は大きいため、初期表示のバンドルから分けて必要になったときに読み込む
    void import("./exportVideo")
      .then(({ canEncodeFrameSize }) => chooseVideoFormat(canEncodeFrameSize))
      // 書き出しの処理を読み込めなければ（オフラインなど）、確認中のまま止まらないよう非対応として扱う
      .catch(() => undefined)
      .then((format) => {
        if (!cancelled) {
          dispatch({ type: "formatChosen", format });
        }
      });
    return () => {
      cancelled = true;
      controllerRef.current?.abort();
    };
  }, []);

  function start() {
    if (state.status !== "ready" && state.status !== "done" && state.status !== "error") {
      return;
    }
    const { format } = state;
    const controller = new AbortController();
    controllerRef.current = controller;
    dispatch({ type: "started", total: frameCount(totalDuration(reel)) });
    void Promise.all([loadMapCountries(), import("./exportVideo")])
      .then(([countries, { exportVideo }]) =>
        exportVideo(reel, countries, format, {
          signal: controller.signal,
          onProgress: (done, total) => dispatch({ type: "progressed", done, total }),
        }),
      )
      .then(
        (file) => dispatch({ type: "finished", file }),
        (error: unknown) => {
          if (controller.signal.aborted) {
            dispatch({ type: "canceled" });
          } else {
            dispatch({ type: "failed", message: String(error) });
          }
        },
      );
  }

  return {
    state,
    start,
    cancel: () => controllerRef.current?.abort(),
    reset: () => dispatch({ type: "reset" }),
  };
}
