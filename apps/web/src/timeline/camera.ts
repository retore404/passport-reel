import { type PlaneBounds, WORLD_PLANE } from "../map/worldPlane";
import { SUMMARY_PULL_SECONDS, type FrameState, visitPhases } from "./timing";
import type { Visit } from "./visits";

/**
 * 1 か国ずつの表示の地図のカメラ。
 * 世界座標（map/worldPlane.ts）の注視点 (x, y) を、拡大率 k で、コマ（1080×1920）の上の位置 (sx, sy) に置く。
 * 世界座標の点 p はコマの上の (sx, sy) + (p − (x, y)) × k に描かれる。
 * x は横方向の繰り返しをほどいた連続した値で、世界の幅の範囲 [0, width) に収まるとは限らない。
 */
export type Camera = {
  readonly x: number;
  readonly y: number;
  readonly k: number;
  readonly sx: number;
  readonly sy: number;
};

/** 寄せた国を置くコマの上の位置。国名と国数の上に国が来るよう、中央より少し上にする。 */
const FOCUS_ANCHOR = { sx: 540, sy: 820 } as const;
/** 寄せた国の外接矩形を収める枠（コマの上の大きさ）と、その枠に対して国が占める割合。 */
const FOCUS_BOX = { width: 900, height: 600, fill: 0.6 } as const;
/** 拡大率の範囲。小さな国でも寄りすぎて周りが分からなくならず、大きな国でも寄った感じが出るようにする。 */
export const MIN_FOCUS_ZOOM = 1.8;
export const MAX_FOCUS_ZOOM = 16;
/** 移動の途中で引く量の、移動距離（世界座標）に対する比と上限（拡大率の自然対数で）。 */
const PULL_PER_DISTANCE = 1 / 260;
const MAX_PULL = 1.8;
/** 引いても世界より小さくなりすぎないようにする拡大率の下限。 */
const MIN_ZOOM = 0.9;

/**
 * 世界全体を見せるカメラ。年ごとの表示と同じく、地図の上端がコマの mapTop に来るように置く。
 * 最初の訪問の移動元と、まとめのコマの移動先に使う。
 */
export function worldCamera(mapTop: number): Camera {
  return {
    x: WORLD_PLANE.width / 2,
    y: WORLD_PLANE.height / 2,
    k: 1,
    sx: WORLD_PLANE.width / 2,
    sy: mapTop + WORLD_PLANE.height / 2,
  };
}

/** 国の範囲（世界座標）を枠に収めるように寄せるカメラ。拡大率は範囲内に丸める。 */
export function targetCamera([[x0, y0], [x1, y1]]: PlaneBounds): Camera {
  const fit = Math.min(
    FOCUS_BOX.width / Math.max(x1 - x0, 1e-6),
    FOCUS_BOX.height / Math.max(y1 - y0, 1e-6),
  );
  return {
    x: (x0 + x1) / 2,
    y: (y0 + y1) / 2,
    k: Math.min(Math.max(fit * FOCUS_BOX.fill, MIN_FOCUS_ZOOM), MAX_FOCUS_ZOOM),
    ...FOCUS_ANCHOR,
  };
}

/** x を、世界の幅ずつずらした候補のうち reference に最も近いものにする（日付変更線をまたいで短い方向へ動くため）。 */
function nearestCopy(x: number, reference: number): number {
  return x + Math.round((reference - x) / WORLD_PLANE.width) * WORLD_PLANE.width;
}

/**
 * 訪問ごとの寄せる先のカメラを求める。各訪問の x は前の訪問の x に最も近い繰り返しを選び、連続した値にする。
 * 地図に形状のない国（boundsOf が undefined）は、前の訪問の位置（最初なら世界全体）のまま動かない。
 * 時刻に依存しない計算なので、どの時刻のコマから描いても同じカメラの並びになる。
 */
export function planFocusTargets(
  visits: readonly Visit[],
  boundsOf: (country: string) => PlaneBounds | undefined,
  world: Camera,
): readonly Camera[] {
  const targets: Camera[] = [];
  let previous = world;
  for (const visit of visits) {
    const bounds = boundsOf(visit.country);
    const target = bounds ? targetCamera(bounds) : previous;
    const placed = { ...target, x: nearestCopy(target.x, previous.x) };
    targets.push(placed);
    previous = placed;
  }
  return targets;
}

function easeInOut(x: number): number {
  return x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2;
}

/**
 * カメラ a から b への移動の途中（p は 0〜1）。注視点とコマの上の位置は滑らかに補間し、拡大率は対数で補間する。
 * 遠い移動では、移動距離に比例する量だけ途中で引き、どこからどこへ移ったかが見えるようにする。
 */
export function interpolateCamera(a: Camera, b: Camera, p: number): Camera {
  const e = easeInOut(Math.min(Math.max(p, 0), 1));
  // 端は計算の丸め誤差なしに a・b そのものにする（まとめで k = 1 になったことを判定して描き方を切り替えるため）
  if (e === 0) {
    return a;
  }
  if (e === 1) {
    return b;
  }
  const lerp = (from: number, to: number) => from + (to - from) * e;
  const distance = Math.hypot(b.x - a.x, b.y - a.y);
  const pull = Math.min(distance * PULL_PER_DISTANCE, MAX_PULL) * Math.sin(Math.PI * e);
  const logK = lerp(Math.log(a.k), Math.log(b.k)) - pull;
  return {
    x: lerp(a.x, b.x),
    y: lerp(a.y, b.y),
    // 途中で引きすぎて、世界全体より極端に小さくならないようにする
    k: Math.max(Math.exp(logK), MIN_ZOOM),
    sx: lerp(a.sx, b.sx),
    sy: lerp(a.sy, b.sy),
  };
}

/**
 * 1 か国ずつの表示で、コマ frame のカメラ。
 * 訪問のコマでは前の訪問（最初は世界全体）からこの訪問へ移動し、まとめのコマでは最後の訪問から世界全体へ引く。
 * 世界全体の x も最後の訪問に最も近い繰り返しを選び、引くときに遠回りしないようにする。
 */
export function focusCameraAt(
  targets: readonly Camera[],
  world: Camera,
  frame: FrameState,
): Camera {
  const last = targets.at(-1) ?? world;
  if (frame.kind === "summary") {
    const home = { ...world, x: nearestCopy(world.x, last.x) };
    return interpolateCamera(last, home, frame.elapsed / SUMMARY_PULL_SECONDS);
  }
  const target = targets[frame.index] ?? last;
  const from = targets[frame.index - 1] ?? world;
  return interpolateCamera(from, target, visitPhases(frame.elapsed).move);
}
