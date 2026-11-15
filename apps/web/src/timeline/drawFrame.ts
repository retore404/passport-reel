import { MAP_ASPECT_RATIO } from "../map/drawWorldMap";
import { countryName } from "../records/countryNames";
import { type Camera, focusCameraAt, planFocusTargets, worldCamera } from "./camera";
import type { MapLayers } from "./mapLayers";
import type { FocusReel, Reel } from "./reel";
import {
  layoutPageTags,
  layoutYearTags,
  type Measure,
  type MovingTag,
  NAME_TAGS,
  type Tag,
  transitionTags,
} from "./textLayout";
import {
  EMPHASIS_SECONDS,
  flipSeconds,
  type FrameState,
  frameStartTimes,
  LIST_FADE_SECONDS,
  PAGE_TRANSITION_SECONDS,
  SUMMARY_PULL_SECONDS,
  summaryPageAt,
  TEXT_FADE_SECONDS,
  totalDuration,
  visitPhases,
} from "./timing";

/** コマの基準の大きさ。すべての配置と文字の大きさはこの座標系で決め、表示する幅に合わせて拡大・縮小する。 */
export const FRAME_WIDTH = 1080;
export const FRAME_HEIGHT = 1920;

/**
 * コマの配色。Canvas からは CSS 変数を読めないため値を直接持つ。
 * docs/design-guidelines.md のデザイントークン（--bg、--surface-2、--text、--muted、--line、--accent、--accent-strong、--on-accent）と一致させる。
 */
const COLORS = {
  bg: "#0b1019",
  surface2: "#1a2233",
  text: "#e7eaf0",
  muted: "#8d96aa",
  line: "#243047",
  accent: "#f2a93b",
  accentStrong: "#ffd27a",
  onAccent: "#1d1305",
} as const;

/** CSS の --font-sans と同じ指定。端末のサンセリフ体で描く。 */
const FONT_FAMILY =
  'system-ui, -apple-system, "Segoe UI", "Hiragino Sans", "Noto Sans JP", "Yu Gothic UI", sans-serif';

const PADDING_X = 80;
const TEXT_WIDTH = FRAME_WIDTH - PADDING_X * 2;
const MAP_HEIGHT = FRAME_WIDTH / MAP_ASPECT_RATIO;

/**
 * 年のコマとまとめのコマで共通の配置。コマが切り替わっても地図・国数・国名の位置がずれないよう、同じ値を使う。
 * 年は 1 桁ずつ固定幅のセルの中央に描き、数字の幅の違いで桁の位置が揺れないようにする。
 */
const LAYOUT = {
  digitTop: 196,
  digitHeight: 236,
  digitWidth: 132,
  digitFontSize: 210,
  mapY: 480,
  statsY: 1330,
  /** 国数の行の区切り線と、右側（+N）の左端 */
  statsDividerX: 500,
  statsRightX: 560,
  namesY: 1540,
  progressY: 1790,
} as const;

/**
 * ページを切り替えるときに縦へ動かす量。
 * アニメーションの長さは、コマの一覧の移動先の計算にも使うため timing.ts に置く。
 */
const PAGE_SHIFT = 60;

export type FrameContext = Parameters<MapLayers["draw"]>[0] &
  Pick<
    CanvasRenderingContext2D,
    | "font"
    | "textAlign"
    | "textBaseline"
    | "globalAlpha"
    | "letterSpacing"
    | "fillText"
    | "scale"
    | "rect"
    | "clip"
    | "roundRect"
    | "createLinearGradient"
  > & {
    /** 文字の配置に使う。使うのは幅だけなので、テストのフェイクでも用意しやすいよう幅だけを求める。 */
    measureText: (text: string) => { readonly width: number };
  };

function progressOf(elapsed: number, seconds: number): number {
  return Math.min(Math.max(elapsed / seconds, 0), 1);
}

function easeOut(x: number): number {
  return 1 - (1 - x) ** 3;
}

function easeInOut(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;
}

function font(weight: number, px: number): string {
  return `${weight} ${px}px ${FONT_FAMILY}`;
}

const NAME_TAG_FONT = font(500, NAME_TAGS.fontSize);

/**
 * 国名のタグと同じフォントで文字幅を測る関数を作る。まとめのコマのページ分け（buildReel）に使う。
 * 描画と同じフォント指定で測るので、ページ分けした国名は描くときにも表示枠に収まる。
 */
export function createNameTagMeasure(): Measure {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D コンテキストを取得できない");
  }
  ctx.font = NAME_TAG_FONT;
  return (text) => ctx.measureText(text).width;
}

function setText(ctx: FrameContext, weight: number, px: number, color: string) {
  ctx.font = font(weight, px);
  ctx.fillStyle = color;
  ctx.letterSpacing = "0px";
}

function drawBrand(ctx: FrameContext) {
  setText(ctx, 700, 30, COLORS.muted);
  ctx.letterSpacing = "8px";
  ctx.fillText("PASSPORT REEL", PADDING_X, 150);
  ctx.letterSpacing = "0px";
}

function digitX(position: number): number {
  return PADDING_X + position * LAYOUT.digitWidth;
}

const DIGIT_MIDDLE = LAYOUT.digitTop + LAYOUT.digitHeight / 2;

function drawDigitText(ctx: FrameContext, digit: number, x: number) {
  setText(ctx, 800, LAYOUT.digitFontSize, COLORS.text);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(digit), x + LAYOUT.digitWidth / 2, DIGIT_MIDDLE);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

/**
 * 数字の上半分か下半分を、中央線を軸に縦へ scaleY 倍して描く。
 * 背景色で塗ってから描くので、下に描いてある数字を隠せる（枠は見えない）。
 * 上半分は 1px 長くして下半分に重ね、縮小表示で境目に隙間（横線）が出ないようにする。
 * shade は文字の明るさ（1 で通常）。めくれて寝ている間は暗くする。
 */
function drawDigitHalf(
  ctx: FrameContext,
  digit: number,
  x: number,
  half: "top" | "bottom",
  scaleY: number,
  shade: number,
) {
  if (scaleY <= 0) {
    return;
  }
  const halfHeight = LAYOUT.digitHeight / 2;
  const y = half === "top" ? LAYOUT.digitTop : DIGIT_MIDDLE;
  const height = half === "top" ? halfHeight + 1 : halfHeight;
  ctx.save();
  ctx.translate(0, DIGIT_MIDDLE);
  ctx.scale(1, scaleY);
  ctx.translate(0, -DIGIT_MIDDLE);
  ctx.beginPath();
  ctx.rect(x, y, LAYOUT.digitWidth, height);
  ctx.clip();
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(x, y, LAYOUT.digitWidth, height);
  ctx.globalAlpha *= shade;
  drawDigitText(ctx, digit, x);
  ctx.restore();
}

/**
 * 1 桁を描く。from から to へ、p（0〜1）だけめくれた状態にする。
 * Canvas には 3D の回転がないため、前半は前の数字の上半分が中央線へ縮み、後半は次の数字の下半分が中央線から伸びることで
 * めくりを表す。止まっている桁は上下に分けずに 1 回で描く（分けると境目に横線が出るため）。
 */
function drawDigit(ctx: FrameContext, position: number, from: number, to: number, p: number) {
  const x = digitX(position);
  if (from === to || p >= 1) {
    drawDigitText(ctx, to, x);
    return;
  }
  drawDigitHalf(ctx, to, x, "top", 1, 1);
  drawDigitHalf(ctx, from, x, "bottom", 1, 1);
  if (p < 0.5) {
    const scaleY = 1 - easeInOut(p * 2);
    drawDigitHalf(ctx, from, x, "top", scaleY, 0.45 + 0.55 * scaleY);
  } else {
    const scaleY = easeInOut((p - 0.5) * 2);
    drawDigitHalf(ctx, to, x, "bottom", scaleY, 0.45 + 0.55 * scaleY);
  }
}

/**
 * 年の数字を描く。めくっている間（elapsed < flip）は、前の年から 1 年ずつ、記録のない年も含めてめくる。
 * めくりの時間は年の差の回数に均等に割り当て、変わる桁だけをめくる。
 */
function drawYear(
  ctx: FrameContext,
  previousYear: number | undefined,
  year: number,
  elapsed: number,
  flip: number,
) {
  let from = year;
  let to = year;
  let p = 1;
  if (previousYear !== undefined && elapsed < flip) {
    const steps = (elapsed / flip) * (year - previousYear);
    const step = Math.floor(steps);
    from = previousYear + step;
    to = from + 1;
    p = steps - step;
  }
  const fromDigits = digitsOf(from);
  digitsOf(to).forEach((digit, position) => {
    drawDigit(ctx, position, fromDigits[position] ?? digit, digit, p);
  });
}

/** 年（0 以上の整数）を、上の桁から順に 1 桁ずつの数字に分ける。 */
function digitsOf(year: number): number[] {
  const digits: number[] = [];
  let rest = year;
  do {
    digits.unshift(rest % 10);
    rest = Math.floor(rest / 10);
  } while (rest > 0);
  return digits;
}

function drawStatLabel(ctx: FrameContext, label: string, x: number) {
  setText(ctx, 600, 30, COLORS.muted);
  ctx.fillText(label, x, LAYOUT.statsY + 32);
}

const STAT_BASELINE = LAYOUT.statsY + 150;

/**
 * 国数の行。左に累計の国数、年のコマでは右に「初めて訪れた国 +N」を並べる。
 * まとめのコマでは右側がなくなるだけで、累計の位置は年のコマと変わらない。
 */
function drawStats(
  ctx: FrameContext,
  cumulative: number,
  newCount: number | undefined,
  alpha: number,
) {
  drawStatLabel(ctx, "累計", PADDING_X);
  setText(ctx, 800, 120, COLORS.accent);
  const number = String(cumulative);
  ctx.fillText(number, PADDING_X, STAT_BASELINE);
  const numberWidth = ctx.measureText(number).width;
  setText(ctx, 600, 44, COLORS.muted);
  ctx.fillText("か国", PADDING_X + numberWidth + 14, STAT_BASELINE);

  if (newCount === undefined) {
    return;
  }
  ctx.globalAlpha = alpha;
  ctx.fillStyle = COLORS.line;
  ctx.fillRect(LAYOUT.statsDividerX, LAYOUT.statsY + 12, 2, 150);
  drawStatLabel(ctx, "初めて訪れた国", LAYOUT.statsRightX);
  setText(ctx, 800, 120, COLORS.accentStrong);
  ctx.fillText(`+${newCount}`, LAYOUT.statsRightX, STAT_BASELINE);
  ctx.globalAlpha = 1;
}

const TAG_HEIGHT = NAME_TAGS.fontSize + 30;

/** 国名のタグを描く。再訪と「ほか N か国」は枠線だけの控えめなタグ、「再訪」の見出しは枠なしの文字にする。 */
function drawTags(ctx: FrameContext, tags: readonly Tag[]) {
  for (const tag of tags) {
    const x = PADDING_X + tag.x;
    const y = LAYOUT.namesY + tag.row * (TAG_HEIGHT + NAME_TAGS.gap);
    const quiet = tag.kind !== "fresh";
    if (tag.kind !== "label") {
      ctx.beginPath();
      ctx.roundRect(x + 1, y + 1, tag.width - 2, TAG_HEIGHT - 2, TAG_HEIGHT / 2);
      if (quiet) {
        ctx.strokeStyle = COLORS.line;
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.fillStyle = COLORS.surface2;
        ctx.fill();
      }
    }
    ctx.font = tag.kind === "label" ? font(700, NAME_TAGS.fontSize) : NAME_TAG_FONT;
    ctx.fillStyle = quiet ? COLORS.muted : COLORS.text;
    ctx.textAlign = tag.kind === "label" ? "left" : "center";
    ctx.textBaseline = "middle";
    ctx.fillText(tag.text, tag.kind === "label" ? x : x + tag.width / 2, y + TAG_HEIGHT / 2);
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

function measureTag(ctx: FrameContext): Measure {
  ctx.font = NAME_TAG_FONT;
  return (text) => ctx.measureText(text).width;
}

/** 全コマ中の再生位置を示す進捗バー。 */
function drawProgress(ctx: FrameContext, position: number) {
  ctx.fillStyle = COLORS.line;
  ctx.fillRect(PADDING_X, LAYOUT.progressY, TEXT_WIDTH, 8);
  ctx.fillStyle = COLORS.accent;
  ctx.fillRect(PADDING_X, LAYOUT.progressY, TEXT_WIDTH * position, 8);
}

function mapRect() {
  return { x: 0, y: LAYOUT.mapY, width: FRAME_WIDTH, height: MAP_HEIGHT };
}

function drawYearFrame(
  ctx: FrameContext,
  reel: Reel,
  index: number,
  elapsed: number,
  layers: MapLayers,
  pixelScale: number,
) {
  const { timeline } = reel;
  const entry = timeline.years[index];
  if (!entry) {
    return;
  }
  const previous = timeline.years[index - 1];
  const before = previous?.cumulative ?? new Set<string>();
  const flip = flipSeconds(timeline, index);
  // 強調・数え上げ・文字のフェードインは、年をめくり終わってから始める
  const afterFlip = elapsed - flip;
  const fade = easeOut(progressOf(afterFlip, TEXT_FADE_SECONDS));
  const growth = easeOut(progressOf(afterFlip, EMPHASIS_SECONDS));

  // 強調は強さ 0 でもハイライト色で塗るため、めくっている間はその年の国を渡さず、前の年までの地図にしておく。
  // 描く絵が違うので、地図のキャッシュもめくっている間とその後で分ける
  const flipping = afterFlip < 0;
  layers.draw(
    ctx,
    mapRect(),
    flipping ? `year-${index}:flipping` : `year-${index}`,
    before,
    flipping ? new Set<string>() : new Set(entry.newCountries),
    growth,
    pixelScale,
  );

  drawBrand(ctx);
  // 最初の年はめくらずにフェードインする
  ctx.globalAlpha = previous ? 1 : fade;
  drawYear(ctx, previous?.year, entry.year, elapsed, flip);
  ctx.globalAlpha = 1;

  const count = Math.round(before.size + (entry.cumulative.size - before.size) * growth);
  drawStats(ctx, count, entry.newCountries.length, fade);

  ctx.globalAlpha = fade;
  drawTags(
    ctx,
    layoutYearTags(
      entry.newCountries.map(countryName),
      entry.revisitedCountries.map(countryName),
      measureTag(ctx),
    ),
  );
  ctx.globalAlpha = 1;

  drawProgress(ctx, positionOf(reel, index, elapsed));
}

/** まとめのコマの国名の 1 ページを、透明度 alpha・縦のずれ dy で描く。 */
function drawPage(ctx: FrameContext, names: readonly string[], alpha: number, dy: number) {
  ctx.save();
  ctx.translate(0, dy);
  ctx.globalAlpha = alpha;
  drawTags(ctx, layoutPageTags(names, measureTag(ctx)));
  ctx.restore();
}

/**
 * まとめのコマの国名。1 ページ目はフェードインし、2 ページ目以降は前のページが上へ抜けながら消え、
 * 次のページが下から入る。ページが複数あれば、国数の行の右端にページの位置を示す。
 */
function drawSummaryNames(ctx: FrameContext, reel: Reel, elapsed: number, listDelay = 0) {
  const { summaryPages } = reel;
  const { page, elapsed: inPage } = summaryPageAt(reel, elapsed);
  const current = summaryPages[page] ?? [];
  const previous = summaryPages[page - 1];
  if (previous === undefined) {
    drawPage(ctx, current, easeOut(progressOf(inPage - listDelay, LIST_FADE_SECONDS)), 0);
  } else {
    const p = easeInOut(progressOf(inPage, PAGE_TRANSITION_SECONDS));
    if (p < 1) {
      drawPage(ctx, previous, 1 - p, -PAGE_SHIFT * p);
    }
    drawPage(ctx, current, p, PAGE_SHIFT * (1 - p));
  }

  if (summaryPages.length > 1) {
    setText(ctx, 600, 28, COLORS.muted);
    ctx.textAlign = "right";
    ctx.fillText(`${page + 1} / ${summaryPages.length}`, PADDING_X + TEXT_WIDTH, STAT_BASELINE);
    ctx.textAlign = "left";
  }
}

/** 期間のダッシュの左右の余白。太字の大きな数字ではフォントのままだとダッシュが数字に詰まって見えるため空ける。 */
const PERIOD_DASH_GAP = 24;

/** 期間（例：2016 – 2024）を、年の数字と同じ領域の縦の中央に描く。年が 1 つなら年だけを描く。 */
function drawPeriod(ctx: FrameContext, firstYear: number, lastYear: number) {
  setText(ctx, 800, 130, COLORS.text);
  ctx.textBaseline = "middle";
  const parts = firstYear === lastYear ? [`${firstYear}`] : [`${firstYear}`, "–", `${lastYear}`];
  let x = PADDING_X - 4;
  for (const part of parts) {
    ctx.fillText(part, x, DIGIT_MIDDLE);
    x += ctx.measureText(part).width + PERIOD_DASH_GAP;
  }
  ctx.textBaseline = "alphabetic";
}

function drawSummaryFrame(
  ctx: FrameContext,
  reel: Reel,
  elapsed: number,
  layers: MapLayers,
  pixelScale: number,
) {
  const { firstYear, lastYear, countries } = reel.timeline.summary;
  drawBrand(ctx);
  drawPeriod(ctx, firstYear, lastYear);

  layers.draw(ctx, mapRect(), "summary", new Set(countries), new Set(), 1, pixelScale);
  drawStats(ctx, countries.length, undefined, 1);
  drawSummaryNames(ctx, reel, elapsed);
  drawProgress(ctx, positionOf(reel, reel.timeline.years.length, elapsed));
}

// ---- 1 か国ずつの表示 ----

const FOCUS_VIEW = { width: FRAME_WIDTH, height: FRAME_HEIGHT };

/**
 * 1 か国ずつの表示の配置（基準 1080×1920）。地図は画面全体に描き、文字はその上に重ねる。
 * 累計・国名のタグ・進捗バーは年ごとの表示と同じ位置（LAYOUT）を使い、まとめのコマへ切り替わっても位置がずれないようにする。
 */
const FOCUS_LAYOUT = {
  /** 年は年ごとの表示の年の数字と同じ縦の中央に、左寄せで描く */
  yearFontSize: 150,
  /** 年を切り替えるときに縦へ動かす量 */
  yearShift: 180,
  ordinalY: 1062,
  nameY: 1190,
  nameFontSize: 120,
  /** 国名と「再訪」のタグの間 */
  tagGap: 28,
  revisitFontSize: 40,
  /** 文字を読みやすくする上下のぼかしの範囲と、最も濃いところの不透明度 */
  topShade: { to: 470, alpha: 0.8 },
  bottomShade: { from: 1250, alpha: 0.55 },
} as const;

/** 地図の上に重ねる文字に付ける影の色と、ぼかしの大きさ（基準の px）。 */
const TEXT_SHADOW = { color: "rgba(11, 16, 25, 0.9)", blur: 24 } as const;
/** 地図の上に重ねる国名のタグの地。--surface-2 を半透明にする */
const TAG_OVER_MAP = "rgba(26, 34, 51, 0.88)";

/** 上下に背景色のグラデーションを重ね、地図の上の文字を読みやすくする。alpha でまとめのコマへ向けて薄くする。 */
function drawFocusShades(ctx: FrameContext, alpha: number) {
  if (alpha <= 0) {
    return;
  }
  const { topShade, bottomShade } = FOCUS_LAYOUT;
  ctx.save();
  ctx.globalAlpha = alpha;
  const top = ctx.createLinearGradient(0, 0, 0, topShade.to);
  top.addColorStop(0, `rgba(11, 16, 25, ${topShade.alpha})`);
  top.addColorStop(1, "rgba(11, 16, 25, 0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, FRAME_WIDTH, topShade.to);
  const bottom = ctx.createLinearGradient(0, bottomShade.from, 0, FRAME_HEIGHT);
  bottom.addColorStop(0, "rgba(11, 16, 25, 0)");
  bottom.addColorStop(1, `rgba(11, 16, 25, ${bottomShade.alpha})`);
  ctx.fillStyle = bottom;
  ctx.fillRect(0, bottomShade.from, FRAME_WIDTH, FRAME_HEIGHT - bottomShade.from);
  ctx.restore();
}

function withTextShadow(ctx: FrameContext, pixelScale: number, draw: () => void) {
  ctx.save();
  ctx.shadowColor = TEXT_SHADOW.color;
  // shadowBlur は座標変換の拡大縮小を受けないので、実ピクセル数を掛ける
  ctx.shadowBlur = TEXT_SHADOW.blur * pixelScale;
  draw();
  ctx.restore();
}

/**
 * 1 か国ずつの表示の年。年が変わる訪問では、前の年が上へ抜けながら消え、次の年が下から入る（p は 0〜1）。
 * alpha でまとめのコマへ向けて消す。
 */
function drawFocusYear(
  ctx: FrameContext,
  previousYear: number | undefined,
  year: number,
  p: number,
  alpha: number,
) {
  if (alpha <= 0) {
    return;
  }
  const { yearFontSize, yearShift } = FOCUS_LAYOUT;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, DIGIT_MIDDLE - yearShift / 2 - 20, FRAME_WIDTH, yearShift + 40);
  ctx.clip();
  setText(ctx, 800, yearFontSize, COLORS.text);
  ctx.textBaseline = "middle";
  const e = easeOut(p);
  if (previousYear !== undefined && previousYear !== year && p < 1) {
    ctx.globalAlpha = alpha * (1 - e);
    ctx.fillText(String(previousYear), PADDING_X - 4, DIGIT_MIDDLE - yearShift * e);
    ctx.globalAlpha = alpha * e;
    ctx.fillText(String(year), PADDING_X - 4, DIGIT_MIDDLE + yearShift * (1 - e));
  } else {
    ctx.globalAlpha = alpha;
    ctx.fillText(String(year), PADDING_X - 4, DIGIT_MIDDLE);
  }
  ctx.restore();
}

/**
 * 訪問の国名。初めて訪れた国には上に「#連番」を、再訪には国名の右に「再訪」のタグを添える（再訪に番号は付けない）。
 * p（0〜1）でフェードインしながら左から入る。国名が長ければ、タグと合わせて文字の幅に収まるよう縮める。
 */
function drawVisitName(
  ctx: FrameContext,
  name: string,
  ordinal: number | undefined,
  p: number,
  pixelScale: number,
) {
  if (p <= 0) {
    return;
  }
  const { ordinalY, nameY, nameFontSize, tagGap, revisitFontSize } = FOCUS_LAYOUT;
  const revisit = ordinal === undefined;
  ctx.save();
  ctx.globalAlpha = p;
  ctx.translate((1 - p) * -60, 0);
  withTextShadow(ctx, pixelScale, () => {
    if (!revisit) {
      setText(ctx, 600, 36, COLORS.muted);
      ctx.fillText(`#${ordinal}`, PADDING_X, ordinalY);
    }
    ctx.font = font(600, revisitFontSize);
    const tagWidth = revisit ? ctx.measureText("再訪").width + 48 : 0;
    const maxWidth = TEXT_WIDTH - (revisit ? tagWidth + tagGap : 0);
    ctx.font = font(800, nameFontSize);
    const natural = ctx.measureText(name).width;
    const px = natural > maxWidth ? Math.floor((nameFontSize * maxWidth) / natural) : nameFontSize;
    setText(ctx, 800, px, COLORS.text);
    ctx.fillText(name, PADDING_X, nameY);
    if (revisit) {
      drawRevisitTag(
        ctx,
        PADDING_X + ctx.measureText(name).width + tagGap,
        nameY - px * 0.36,
        tagWidth,
      );
    }
  });
  ctx.restore();
}

/** 国名に添える「再訪」のタグ。年ごとの表示の再訪のタグと同じく枠線だけにし、地図の上でも読めるよう地を暗くする。 */
function drawRevisitTag(ctx: FrameContext, x: number, middleY: number, width: number) {
  const height = FOCUS_LAYOUT.revisitFontSize + 30;
  const y = middleY - height / 2;
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.roundRect(x + 1, y + 1, width - 2, height - 2, height / 2);
  ctx.fillStyle = "rgba(11, 16, 25, 0.6)";
  ctx.fill();
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 2;
  ctx.stroke();
  setText(ctx, 600, FOCUS_LAYOUT.revisitFontSize, COLORS.muted);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("再訪", x + width / 2, middleY);
  ctx.restore();
}

/** 地図の上に重ねる国名のタグ。新しく加わるタグは強調色で入る。 */
function drawMovingTags(ctx: FrameContext, tags: readonly MovingTag[], alpha: number) {
  if (alpha <= 0) {
    return;
  }
  ctx.save();
  for (const tag of tags) {
    if (tag.alpha <= 0) {
      continue;
    }
    const x = PADDING_X + tag.x;
    const y = LAYOUT.namesY + tag.row * (TAG_HEIGHT + NAME_TAGS.gap);
    ctx.globalAlpha = alpha * tag.alpha;
    ctx.beginPath();
    ctx.roundRect(x + 1, y + 1, tag.width - 2, TAG_HEIGHT - 2, TAG_HEIGHT / 2);
    ctx.fillStyle = tag.entering ? COLORS.accentStrong : TAG_OVER_MAP;
    ctx.fill();
    ctx.font = NAME_TAG_FONT;
    ctx.fillStyle = tag.entering ? COLORS.onAccent : COLORS.text;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(tag.text, x + tag.width / 2, y + TAG_HEIGHT / 2);
  }
  ctx.restore();
}

/** 静止したタグを、動きのない MovingTag として扱う。 */
function restingTags(tags: readonly Tag[]): MovingTag[] {
  return transitionTags(tags, tags, 1);
}

function focusCamera(reel: FocusReel, layers: MapLayers, frame: FrameState): Camera {
  const world = worldCamera(LAYOUT.mapY);
  const targets = planFocusTargets(reel.timeline.visits, layers.focusBounds, world);
  return focusCameraAt(targets, world, frame);
}

function drawVisitFrame(
  ctx: FrameContext,
  reel: FocusReel,
  index: number,
  elapsed: number,
  layers: MapLayers,
  pixelScale: number,
) {
  const { visits } = reel.timeline;
  const visit = visits[index];
  if (!visit) {
    return;
  }
  const phases = visitPhases(elapsed);
  const paint = easeOut(phases.paint);
  const visitedBefore = new Set(visits.slice(0, index).map((v) => v.country));
  layers.drawFocused(
    ctx,
    FOCUS_VIEW,
    focusCamera(reel, layers, { kind: "visit", index, elapsed }),
    visitedBefore,
    { code: visit.country, strength: paint, ring: phases.ring },
    pixelScale,
  );
  drawFocusShades(ctx, 1);
  drawBrand(ctx);
  drawFocusYear(ctx, visits[index - 1]?.year, visit.year, phases.yearSwitch, 1);
  drawVisitName(ctx, countryName(visit.country), visit.ordinal, easeOut(phases.name), pixelScale);
  withTextShadow(ctx, pixelScale, () => {
    drawStats(ctx, Math.round(visit.before + (visit.after - visit.before) * paint), undefined, 1);
  });
  // 初めて訪れた国では、塗りに合わせてタグが末尾に加わる（収まらなければ古いタグが押し出される）。再訪では変わらない
  const before = reel.visitTags[index - 1] ?? [];
  const after = reel.visitTags[index] ?? [];
  drawMovingTags(
    ctx,
    visit.ordinal === undefined ? restingTags(after) : transitionTags(before, after, paint),
    1,
  );
  drawProgress(ctx, positionOf(reel, index, elapsed));
}

/** 1 か国ずつの表示のまとめで、世界全体まで引いた後に年ごとの表示の地図（小さな国のマーカー付き）へ切り替える長さ。 */
const MARKER_FADE_SECONDS = 0.3;

/**
 * 1 か国ずつの表示のまとめのコマ。最後の国から世界全体まで引き、引き終わったら年ごとの表示のまとめと同じ地図・期間・
 * 累計・国名のページに切り替える。地図は、マーカーのある年ごとの表示の地図を重ねてフェードインし、マーカーを浮かび上がらせる。
 */
function drawFocusSummaryFrame(
  ctx: FrameContext,
  reel: FocusReel,
  elapsed: number,
  layers: MapLayers,
  pixelScale: number,
) {
  const { visits, summary } = reel.timeline;
  const visited = new Set(summary.countries);
  const pull = easeOut(progressOf(elapsed, SUMMARY_PULL_SECONDS));
  const markers = easeOut(progressOf(elapsed - SUMMARY_PULL_SECONDS, MARKER_FADE_SECONDS));
  if (markers < 1) {
    layers.drawFocused(
      ctx,
      FOCUS_VIEW,
      focusCamera(reel, layers, { kind: "summary", elapsed }),
      visited,
      undefined,
      pixelScale,
    );
  }
  if (markers > 0) {
    ctx.globalAlpha = markers;
    layers.draw(ctx, mapRect(), "summary", visited, new Set(), 1, pixelScale);
    ctx.globalAlpha = 1;
  }
  drawFocusShades(ctx, 1 - pull);
  drawBrand(ctx);
  drawFocusYear(ctx, undefined, visits.at(-1)?.year ?? summary.lastYear, 1, 1 - pull);
  const listFade = easeOut(progressOf(elapsed - SUMMARY_PULL_SECONDS, LIST_FADE_SECONDS));
  ctx.globalAlpha = listFade;
  drawPeriod(ctx, summary.firstYear, summary.lastYear);
  ctx.globalAlpha = 1;
  withTextShadow(ctx, pixelScale * (1 - pull), () => {
    drawStats(ctx, summary.countries.length, undefined, 1);
  });
  // 引いている間は最後の訪問のタグを消していき、引き終わってからまとめの国名のページを出す
  drawMovingTags(ctx, restingTags(reel.visitTags.at(-1) ?? []), 1 - pull);
  drawSummaryNames(ctx, reel, elapsed, SUMMARY_PULL_SECONDS);
  drawProgress(ctx, positionOf(reel, visits.length, elapsed));
}

/** 全体の長さに対する再生位置（0〜1）。 */
function positionOf(reel: Reel, frameIndex: number, elapsed: number): number {
  const start = frameStartTimes(reel)[frameIndex] ?? 0;
  return Math.min((start + elapsed) / totalDuration(reel), 1);
}

/**
 * 1 コマを描く。プレビューと動画の書き出しで共通に使う。
 * 描く内容は引数だけで決まり、同じ frame なら必ず同じ絵になる。
 * width は描画先の幅（実ピクセル）で、基準の 1080×1920 の座標系をその幅に合わせて縮小・拡大する。
 */
export function drawFrame(
  ctx: FrameContext,
  width: number,
  reel: Reel,
  frame: FrameState,
  layers: MapLayers,
): void {
  const scale = width / FRAME_WIDTH;
  ctx.save();
  ctx.scale(scale, scale);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.globalAlpha = 1;
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT);
  if (reel.mode === "focus") {
    if (frame.kind === "summary") {
      drawFocusSummaryFrame(ctx, reel, frame.elapsed, layers, scale);
    } else {
      drawVisitFrame(ctx, reel, frame.index, frame.elapsed, layers, scale);
    }
  } else if (frame.kind === "summary") {
    drawSummaryFrame(ctx, reel, frame.elapsed, layers, scale);
  } else {
    drawYearFrame(ctx, reel, frame.index, frame.elapsed, layers, scale);
  }
  ctx.restore();
}
