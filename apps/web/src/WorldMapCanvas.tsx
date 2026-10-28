import { useEffect, useRef, useState } from "react";
import { loadMapCountries, type MapCountry } from "./map/countries";
import { drawWorldMap, MAP_ASPECT_RATIO } from "./map/drawWorldMap";

type Props = { readonly visited: ReadonlySet<string> };

export function WorldMapCanvas({ visited }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [countries, setCountries] = useState<readonly MapCountry[]>();
  const [cssWidth, setCssWidth] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void loadMapCountries().then((loaded) => {
      if (!cancelled) {
        setCountries(loaded);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setCssWidth(entry.contentRect.width);
      }
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !countries || cssWidth === 0) {
      return;
    }
    // 高 DPI 画面でぼやけないよう、内部解像度は devicePixelRatio 倍にして座標系だけ CSS ピクセルに合わせる
    const dpr = window.devicePixelRatio || 1;
    const size = { width: cssWidth, height: cssWidth / MAP_ASPECT_RATIO };
    canvas.width = Math.round(size.width * dpr);
    canvas.height = Math.round(size.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawWorldMap(ctx, size, countries, visited);
  }, [countries, cssWidth, visited]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: "block", width: "100%", aspectRatio: MAP_ASPECT_RATIO }}
    >
      訪問した国をハイライトした世界地図
    </canvas>
  );
}
