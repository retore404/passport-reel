export type PlaybackState = { readonly time: number; readonly playing: boolean };

export const INITIAL_PLAYBACK: PlaybackState = { time: 0, playing: false };

/** 経過時間 dt（秒）だけ進める。終端に達したらその位置で止める。 */
export function advance(state: PlaybackState, dt: number, duration: number): PlaybackState {
  if (!state.playing) {
    return state;
  }
  const time = state.time + dt;
  return time >= duration ? { time: duration, playing: false } : { time, playing: true };
}

/** 再生を始める。終端で止まっている場合は最初から再生する。 */
export function play(state: PlaybackState, duration: number): PlaybackState {
  return { time: state.time >= duration ? 0 : state.time, playing: true };
}

export function pause(state: PlaybackState): PlaybackState {
  return { ...state, playing: false };
}

export function restart(): PlaybackState {
  return { time: 0, playing: true };
}

/** 再生位置を移動する。再生中かどうかは保つ。 */
export function seek(state: PlaybackState, time: number, duration: number): PlaybackState {
  return { ...state, time: Math.min(Math.max(time, 0), duration) };
}
