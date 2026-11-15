import { geoGraticule10 } from "d3-geo";
import { isVisited, type MapCountry } from "../map/countries";
import {
  drawEmphasizedCountries,
  drawWorldMap,
  type EmphasisContext,
  MAP_COLORS,
  type MapSize,
  mixColor,
} from "../map/drawWorldMap";
import {
  createPlanePath,
  focusBoundsByCountry,
  type PlaneBounds,
  WORLD_PLANE,
} from "../map/worldPlane";
import type { Camera } from "./camera";

type Rect = { readonly x: number; readonly y: number } & MapSize;

/** 1 か国ずつの表示で、その訪問の国の描き方。 */
export type FocusedCountry = {
  readonly code: string;
  /** 塗りの進み具合（0〜1）。0 は塗る前の色（未訪問、再訪なら訪問済み）、1 で強調色と最大の光彩 */
  readonly strength: number;
  /** 到着時に国の位置を示す輪の進み具合（0〜1）。0 か 1 では描かない */
  readonly ring: number;
};

type FocusContext = EmphasisContext &
  Pick<CanvasRenderingContext2D, "translate" | "scale" | "globalAlpha">;

/** コマの中に地図を描く。コマの描画からはこの型だけを使い、テストでは記録用のフェイクを渡す。 */
export type MapLayers = {
  /**
   * visited をハイライトした地図に、emphasized を強さ strength で強調して描く。
   * key は「同じ visited・emphasized の組」を表し、描画結果のキャッシュに使う。
   */
  readonly draw: (
    ctx: EmphasisContext & Pick<CanvasRenderingContext2D, "drawImage" | "translate">,
    rect: Rect,
    key: string,
    visited: ReadonlySet<string>,
    emphasized: ReadonlySet<string>,
    strength: number,
    pixelScale: number,
  ) => void;
  /**
   * 1 か国ずつの表示の地図を、カメラ camera で寄せてコマ全体（view）に描く。
   * visited はこの訪問より前に訪れた国。current はこの訪問の国で、ほかの国の上に強調して描く。
   */
  readonly drawFocused: (
    ctx: FocusContext,
    view: MapSize,
    camera: Camera,
    visited: ReadonlySet<string>,
    current: FocusedCountry | undefined,
    pixelScale: number,
  ) => void;
  /** 国を寄せるときに収める範囲（世界座標）。地図に形状のない国は undefined */
  readonly focusBounds: (country: string) => PlaneBounds | undefined;
};

/**
 * 地図をオフスクリーンの Canvas にキャッシュしながら描く。
 * 50m 解像度の地図を毎フレーム全部描くとスマートフォンで重いため、年ごとの下地（visited）をキャッシュし、
 * 強調が変化している間だけ強調する国を毎フレーム描き重ねる。強調が最大になった後は下地と強調をまとめた絵を使う。
 * キャッシュは描画結果を変えないので、プレビューと動画の書き出しで同じ絵になる。
 */
export function createMapLayers(countries: readonly MapCountry[]): MapLayers {
  const cache = new Map<string, HTMLCanvasElement>();
  let cachedPixelSize = "";
  const bounds = focusBoundsByCountry(countries);
  let focusShapes: FocusShapes | undefined;

  function layer(
    cacheKey: string,
    rect: Rect,
    pixelScale: number,
    paint: (ctx: CanvasRenderingContext2D) => void,
  ): HTMLCanvasElement | undefined {
    const width = Math.round(rect.width * pixelScale);
    const height = Math.round(rect.height * pixelScale);
    // 表示の大きさが変わったら古い解像度のキャッシュは使えないので捨てる
    if (cachedPixelSize !== `${width}x${height}`) {
      cache.clear();
      cachedPixelSize = `${width}x${height}`;
    }
    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return undefined;
    }
    ctx.scale(width / rect.width, height / rect.height);
    paint(ctx);
    cache.set(cacheKey, canvas);
    return canvas;
  }

  return {
    draw(ctx, rect, key, visited, emphasized, strength, pixelScale) {
      const size = { width: rect.width, height: rect.height };
      if (emphasized.size === 0 || strength >= 1) {
        const full = layer(`${key}:full`, rect, pixelScale, (layerCtx) => {
          drawWorldMap(layerCtx, size, countries, visited);
          drawEmphasizedCountries(layerCtx, size, countries, emphasized, 1, pixelScale);
        });
        if (full) {
          ctx.drawImage(full, rect.x, rect.y, rect.width, rect.height);
        }
        return;
      }
      const base = layer(`${key}:base`, rect, pixelScale, (layerCtx) => {
        drawWorldMap(layerCtx, size, countries, visited);
      });
      if (base) {
        ctx.drawImage(base, rect.x, rect.y, rect.width, rect.height);
      }
      ctx.save();
      ctx.translate(rect.x, rect.y);
      drawEmphasizedCountries(ctx, size, countries, emphasized, strength, pixelScale);
      ctx.restore();
    },
    drawFocused(ctx, view, camera, visited, current, pixelScale) {
      focusShapes ??= createFocusShapes(countries);
      const focus = current ? bounds.get(current.code) : undefined;
      drawFocusedMap(ctx, focusShapes, view, camera, visited, current, focus, pixelScale);
    },
    focusBounds: (country) => bounds.get(country),
  };
}

type FocusShape = {
  readonly country: MapCountry;
  readonly path: Path2D;
  /** 世界座標の外接矩形。画面の外の国を描かずに済ませるのに使う */
  readonly bounds: PlaneBounds;
};

type FocusShapes = { readonly shapes: readonly FocusShape[]; readonly graticule: Path2D };

/**
 * 世界座標で国ごとの Path2D を 1 回だけ作る。
 * 寄せた地図は固定の絵をキャッシュして貼ると拡大でぼやけるため毎フレーム描くが、投影の計算は繰り返さず、
 * Canvas の座標変換で拡大・移動して塗るだけにして重さを抑える。
 */
function createFocusShapes(countries: readonly MapCountry[]): FocusShapes {
  const path = createPlanePath();
  return {
    shapes: countries.map((country) => {
      const [[x0, y0], [x1, y1]] = path.bounds(country.feature);
      return {
        country,
        path: new Path2D(path(country.feature) ?? ""),
        bounds: [
          [x0, y0],
          [x1, y1],
        ],
      };
    }),
    graticule: new Path2D(path(geoGraticule10()) ?? ""),
  };
}

/** 到着時の輪と、小さな国の位置を示す点の大きさ（コマの上の px）。 */
const RING_WIDTH = 4;
const SMALL_FOCUS_SIZE = 14;
const FOCUS_DOT_RADIUS = 7;

function drawFocusedMap(
  ctx: FocusContext,
  { shapes, graticule }: FocusShapes,
  view: MapSize,
  camera: Camera,
  visited: ReadonlySet<string>,
  current: FocusedCountry | undefined,
  focus: PlaneBounds | undefined,
  pixelScale: number,
) {
  const { k } = camera;
  // コマに見えている世界座標の範囲
  const left = camera.x - camera.sx / k;
  const right = camera.x + (view.width - camera.sx) / k;
  const top = camera.y - camera.sy / k;
  const bottom = camera.y + (view.height - camera.sy) / k;
  const isCurrent = (country: MapCountry) =>
    current !== undefined && country.alpha2 === current.code;

  ctx.save();
  ctx.translate(camera.sx - camera.x * k, camera.sy - camera.y * k);
  ctx.scale(k, k);
  // 世界は横方向に繰り返すとみなし、見えている範囲にかかる分だけ左右にずらして重ねて描く（日付変更線をまたぐ移動のため）
  const width = WORLD_PLANE.width;
  for (let offset = Math.floor(left / width) * width; offset < right; offset += width) {
    const visible = shapes.filter(
      ({ bounds: [[x0, y0], [x1, y1]] }) =>
        x1 + offset >= left && x0 + offset <= right && y1 >= top && y0 <= bottom,
    );
    ctx.save();
    ctx.translate(offset, 0);
    ctx.strokeStyle = MAP_COLORS.graticule;
    ctx.lineWidth = 1 / k;
    ctx.stroke(graticule);
    ctx.strokeStyle = MAP_COLORS.border;
    ctx.lineWidth = 0.8 / k;
    for (const shape of visible) {
      if (!isCurrent(shape.country)) {
        ctx.fillStyle = isVisited(shape.country, visited)
          ? MAP_COLORS.visited
          : MAP_COLORS.unvisited;
        ctx.fill(shape.path);
      }
      ctx.stroke(shape.path);
    }
    if (current) {
      drawCurrent(
        ctx,
        visible.filter((s) => isCurrent(s.country)),
        focus,
        visited,
        current,
        k,
        pixelScale,
      );
    }
    ctx.restore();
  }
  ctx.restore();
}

/** その訪問の国を、塗る前の色から強調色へ変えながら光彩を付けて描き、到着時の輪と小さな国の点を添える。 */
function drawCurrent(
  ctx: FocusContext,
  shapes: readonly FocusShape[],
  focus: PlaneBounds | undefined,
  visited: ReadonlySet<string>,
  current: FocusedCountry,
  k: number,
  pixelScale: number,
) {
  const before = visited.has(current.code) ? MAP_COLORS.visited : MAP_COLORS.unvisited;
  ctx.save();
  ctx.shadowColor = MAP_COLORS.emphasizedGlow;
  // shadowBlur は座標変換の拡大縮小を受けないので、年ごとの表示と同じ大きさ（地図の幅の 1/60）に実ピクセル数を掛ける
  ctx.shadowBlur = current.strength * (WORLD_PLANE.width / 60) * pixelScale;
  ctx.fillStyle = mixColor(before, MAP_COLORS.emphasized, current.strength);
  for (const shape of shapes) {
    ctx.fill(shape.path);
  }
  ctx.restore();

  if (!focus) {
    return;
  }
  // 輪と点は、カメラが寄せる範囲（国の本体）の中心に置く
  const [[x0, y0], [x1, y1]] = focus;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const size = Math.max(x1 - x0, y1 - y0) * k;
  if (size < SMALL_FOCUS_SIZE) {
    // 寄せても形が見えないほど小さな国は、年ごとの表示のマーカーと同じく点で位置を示す
    ctx.beginPath();
    ctx.arc(cx, cy, FOCUS_DOT_RADIUS / k, 0, 2 * Math.PI);
    ctx.fillStyle = mixColor(MAP_COLORS.visited, MAP_COLORS.emphasized, current.strength);
    ctx.fill();
  }
  if (current.ring > 0 && current.ring < 1) {
    ctx.save();
    ctx.globalAlpha = 1 - current.ring;
    ctx.beginPath();
    ctx.arc(
      cx,
      cy,
      ((Math.max(size, SMALL_FOCUS_SIZE) / 2 + 6) / k) * (1 + current.ring * 0.6),
      0,
      2 * Math.PI,
    );
    ctx.strokeStyle = MAP_COLORS.emphasizedGlow;
    ctx.lineWidth = RING_WIDTH / k;
    ctx.stroke();
    ctx.restore();
  }
}
