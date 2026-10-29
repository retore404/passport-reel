import type { MapCountry } from "../map/countries";
import {
  drawEmphasizedCountries,
  drawWorldMap,
  type EmphasisContext,
  type MapSize,
} from "../map/drawWorldMap";

type Rect = { readonly x: number; readonly y: number } & MapSize;

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
  };
}
