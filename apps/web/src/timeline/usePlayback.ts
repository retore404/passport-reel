import { useEffect, useState } from "react";
import {
  advance,
  INITIAL_PLAYBACK,
  pause,
  play,
  type PlaybackState,
  restart,
  seek,
} from "./playback";

export type Playback = PlaybackState & {
  readonly play: () => void;
  readonly pause: () => void;
  readonly restart: () => void;
  readonly seek: (time: number) => void;
};

/**
 * プレビューの再生時刻。再生中は requestAnimationFrame で実時間に合わせて進め、終端で止まる。
 * duration が変わった（タイムラインが変わった）ときは最初に戻す。
 */
export function usePlayback(duration: number): Playback {
  const [state, setState] = useState<PlaybackState>(INITIAL_PLAYBACK);
  const [prevDuration, setPrevDuration] = useState(duration);
  if (prevDuration !== duration) {
    setPrevDuration(duration);
    setState(INITIAL_PLAYBACK);
  }

  useEffect(() => {
    if (!state.playing) {
      return undefined;
    }
    let frameId = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setState((current) => advance(current, dt, duration));
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [state.playing, duration]);

  return {
    ...state,
    play: () => setState((current) => play(current, duration)),
    pause: () => setState(pause),
    restart: () => setState(restart()),
    seek: (time) => setState((current) => seek(current, time, duration)),
  };
}
