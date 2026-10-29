import { describe, expect, test } from "vitest";
import { advance, INITIAL_PLAYBACK, pause, play, restart, seek } from "./playback";

describe("advance", () => {
  test("再生中は経過時間だけ進む", () => {
    expect(advance({ time: 1, playing: true }, 0.5, 10)).toEqual({ time: 1.5, playing: true });
  });

  test("停止中は進まない", () => {
    expect(advance({ time: 1, playing: false }, 0.5, 10)).toEqual({ time: 1, playing: false });
  });

  test("終端に達したらまとめのコマ（終端）で止まる", () => {
    expect(advance({ time: 9.9, playing: true }, 0.5, 10)).toEqual({ time: 10, playing: false });
  });
});

describe("play / pause", () => {
  test("止めた位置から再生が続く", () => {
    const paused = pause({ time: 3, playing: true });
    expect(paused).toEqual({ time: 3, playing: false });
    expect(play(paused, 10)).toEqual({ time: 3, playing: true });
  });

  test("終端で止まっているときに再生すると最初から再生する", () => {
    expect(play({ time: 10, playing: false }, 10)).toEqual({ time: 0, playing: true });
  });
});

describe("restart", () => {
  test("最初から再生する", () => {
    expect(restart()).toEqual({ time: 0, playing: true });
  });
});

describe("seek", () => {
  test("指定した時刻へ移動し、再生中かどうかは保つ", () => {
    expect(seek({ time: 1, playing: true }, 5, 10)).toEqual({ time: 5, playing: true });
    expect(seek(INITIAL_PLAYBACK, 5, 10)).toEqual({ time: 5, playing: false });
  });

  test("範囲外は丸める", () => {
    expect(seek(INITIAL_PLAYBACK, 12, 10).time).toBe(10);
    expect(seek(INITIAL_PLAYBACK, -1, 10).time).toBe(0);
  });
});
