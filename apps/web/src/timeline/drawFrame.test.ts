import { describe, expect, test } from "vitest";
import { drawFrame, FRAME_WIDTH, type FrameContext } from "./drawFrame";
import type { Camera } from "./camera";
import type { FocusedCountry, MapLayers } from "./mapLayers";
import { buildReel, type Reel } from "./reel";
import { buildTimeline } from "./timeline";
import { frameAt } from "./timing";

/** 年の数字の文字サイズ。年の数字だけを描いた文字から取り出すのに使う。 */
const DIGIT_PX = 210;

/** 描いた文字と地図の呼び出しを記録するフェイク。文字幅は 1 文字 = 文字サイズ px として測る。 */
function createRecording() {
  const drawn: { text: string; x: number; px: number; alpha: number }[] = [];
  const maps: {
    key: string;
    y: number;
    visited: string[];
    emphasized: string[];
    strength: number;
  }[] = [];
  const noop = () => {};
  const fontPx = () => Number(/(\d+)px/.exec(ctx.font)?.[1] ?? 10);
  const ctx: FrameContext = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    shadowBlur: 0,
    shadowColor: "",
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
    globalAlpha: 1,
    letterSpacing: "0px",
    fillRect: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    arc: noop,
    closePath: noop,
    fill: noop,
    stroke: noop,
    save: noop,
    restore: noop,
    scale: noop,
    translate: noop,
    drawImage: noop,
    rect: noop,
    clip: noop,
    roundRect: noop,
    createLinearGradient: () => ({ addColorStop: noop }),
    fillText: (text, x) => {
      drawn.push({ text, x, px: fontPx(), alpha: ctx.globalAlpha });
    },
    measureText: (text) => ({ width: text.length * fontPx() }),
  };
  const focused: {
    camera: Camera;
    visited: string[];
    current: FocusedCountry | undefined;
    alpha: number;
  }[] = [];
  const layers: MapLayers = {
    draw: (_ctx, rect, key, visited, emphasized, strength) => {
      maps.push({ key, y: rect.y, visited: [...visited], emphasized: [...emphasized], strength });
    },
    drawFocused: (_ctx, _view, camera, visited, current) => {
      focused.push({ camera, visited: [...visited], current, alpha: ctx.globalAlpha });
    },
    // どの国も同じ大きさの範囲を持つものとし、国ごとに横へずらして寄せる先を区別する
    focusBounds: (country) => {
      const x = (country.codePointAt(0) ?? 65) * 4;
      return [
        [x, 300],
        [x + 20, 320],
      ];
    },
  };
  return { ctx, layers, drawn, maps, focused };
}

function reelOf(records: Parameters<typeof buildTimeline>[0], pages?: string[][]): Reel {
  const timeline = buildTimeline(records);
  if (!timeline) {
    throw new Error("タイムラインがない");
  }
  return { mode: "year", timeline, summaryPages: pages ?? [["日本", "フランス", "イタリア"]] };
}

function draw(reel: Reel, t: number) {
  const recording = createRecording();
  drawFrame(recording.ctx, FRAME_WIDTH, reel, frameAt(reel, t), recording.layers);
  const { drawn } = recording;
  return {
    ...recording,
    texts: drawn.map((d) => d.text),
    /** 年の数字として描いた文字（めくっている桁は前後の数字が両方入る） */
    digits: drawn.filter((d) => d.px === DIGIT_PX).map((d) => d.text),
  };
}

// 2016 → 2024 は 8 年分なのでめくりは上限の 0.9 秒、2024 → 2025 は 1 年分で 0.3 秒
const reel = reelOf([
  { year: 2016, country: "JP" },
  { year: 2024, country: "FR" },
  { year: 2024, country: "IT" },
  { year: 2024, country: "JP" },
  { year: 2025, country: "JP" },
]);

describe("drawFrame（年のコマ）", () => {
  test("年、累計、初めて訪れた国の数、国名と再訪した国を描く", () => {
    const { texts, digits } = draw(reel, 2 + 1.9);
    expect(digits).toEqual(["2", "0", "2", "4"]);
    expect(texts).toEqual(
      expect.arrayContaining(["累計", "3", "初めて訪れた国", "+2", "イタリア", "フランス"]),
    );
    expect(texts).toEqual(expect.arrayContaining(["再訪", "日本"]));
  });

  test("地図は前の年までの累計を下地にし、その年の国を強調する", () => {
    const { maps } = draw(reel, 2 + 1.9);
    expect(maps).toEqual([
      { key: "year-1", y: 480, visited: ["JP"], emphasized: ["FR", "IT"], strength: 1 },
    ]);
  });

  test("めくりの途中では前の年と次の年の数字を描き、変わらない桁は 1 つだけ描く", () => {
    // 2024 のコマの頭から 0.15 秒（0.3 秒のめくりの半ば）。1 の位だけが 4 → 5 へめくれている
    const { digits } = draw(reel, 4 + 0.15);
    expect(digits.slice(0, 3)).toEqual(["2", "0", "2"]);
    expect(new Set(digits.slice(3))).toEqual(new Set(["4", "5"]));
  });

  test("記録のない年もめくりの途中に現れる", () => {
    // 2016 → 2024 の 8 年分を 0.9 秒でめくる。1 年分は 0.1125 秒なので、0.12 秒では 2017 → 2018 をめくっている
    const { digits } = draw(reel, 2 + 0.12);
    expect(digits).toContain("7");
    expect(digits).toContain("8");
    expect(digits).not.toContain("4");
  });

  test("最初の年はめくらずにフェードインする", () => {
    const { drawn } = draw(reel, 0.1);
    const digits = drawn.filter((d) => d.px === DIGIT_PX);
    expect(digits.map((d) => d.text)).toEqual(["2", "0", "1", "6"]);
    expect(digits[0]?.alpha).toBeLessThan(1);
  });

  test("めくりの途中では地図も累計も前の年のまま（その年の国はまだ塗らない）", () => {
    const { maps, texts } = draw(reel, 2 + 0.5);
    expect(maps).toEqual([
      { key: "year-1:flipping", y: 480, visited: ["JP"], emphasized: [], strength: 0 },
    ]);
    expect(texts).toContain("1");
  });

  test("めくり終わったらその年の国を塗り、強調を始める", () => {
    // めくり（0.9 秒）の直後
    const { maps } = draw(reel, 2 + 0.95);
    expect(maps).toMatchObject([{ key: "year-1", emphasized: ["FR", "IT"] }]);
    expect(maps[0]?.strength).toBeGreaterThan(0);
    expect(maps[0]?.strength).toBeLessThan(1);
  });

  test("めくり終わってから強調と数え上げが進む", () => {
    const { maps, texts } = draw(reel, 2 + 0.9 + 0.6);
    expect(maps[0]?.strength).toBe(1);
    expect(texts).toContain("3");
  });

  test("再訪だけの年は +0 と「再訪」の見出しと再訪した国名を描く", () => {
    const { texts } = draw(reel, 4 + 1.9);
    expect(texts).toEqual(expect.arrayContaining(["+0", "再訪", "日本"]));
  });

  test("同じ時刻なら同じ描画になる", () => {
    const first = draw(reel, 2.3);
    const second = draw(reel, 2.3);
    expect(second.drawn).toEqual(first.drawn);
    expect(second.maps).toEqual(first.maps);
  });
});

describe("drawFrame（まとめのコマ）", () => {
  test("期間、すべての訪問国の地図と国名、累計を描き、+N は描かない", () => {
    const { texts, maps } = draw(reel, 6 + 4);
    expect(texts).toEqual(
      expect.arrayContaining(["2016", "–", "2025", "累計", "3", "イタリア", "フランス", "日本"]),
    );
    expect(texts).not.toContain("初めて訪れた国");
    expect(maps).toEqual([
      { key: "summary", y: 480, visited: ["JP", "FR", "IT"], emphasized: [], strength: 1 },
    ]);
  });

  test("期間のダッシュの左右に余白を空ける", () => {
    const { drawn } = draw(reel, 6 + 4);
    const [first, dash, last] = ["2016", "–", "2025"].map((text) =>
      drawn.find((d) => d.text === text),
    );
    // フェイクの文字幅は 1 文字 = 130px。年（4 文字 = 520）の後に 24 空けてダッシュ、ダッシュ（130）の後に 24 空けて年
    expect((dash?.x ?? 0) - (first?.x ?? 0)).toBe(520 + 24);
    expect((last?.x ?? 0) - (dash?.x ?? 0)).toBe(130 + 24);
  });

  test("地図の位置は年のコマと同じ", () => {
    expect(draw(reel, 6 + 1).maps[0]?.y).toBe(draw(reel, 5).maps[0]?.y);
  });

  test("記録が 1 年だけなら期間は 1 つの年で示す", () => {
    const { texts } = draw(reelOf([{ year: 2024, country: "FR" }], [["フランス"]]), 2 + 1);
    expect(texts).toContain("2024");
    expect(texts.some((t) => t.includes("–"))).toBe(false);
  });

  describe("国名が複数ページのとき", () => {
    // 3 年分（6 秒）の後に、2.5 秒 × 2 ページ = 5 秒のまとめ
    const paged = reelOf(
      [
        { year: 2016, country: "JP" },
        { year: 2024, country: "FR" },
        { year: 2024, country: "IT" },
        { year: 2025, country: "JP" },
      ],
      [["イタリア", "フランス"], ["日本"]],
    );

    test("1 ページ目の国名とページの位置を描く", () => {
      const { texts } = draw(paged, 6 + 1);
      expect(texts).toEqual(expect.arrayContaining(["イタリア", "フランス", "1 / 2"]));
      expect(texts).not.toContain("日本");
    });

    test("切り替えの途中は両方のページを描く", () => {
      const { texts } = draw(paged, 6 + 2.5 + 0.2);
      expect(texts).toEqual(expect.arrayContaining(["イタリア", "日本", "2 / 2"]));
    });

    test("最後のページはコマの終わりまで残る", () => {
      const { texts } = draw(paged, 6 + 5);
      expect(texts).toEqual(expect.arrayContaining(["日本", "2 / 2"]));
      expect(texts).not.toContain("イタリア");
    });
  });

  test("1 ページならページの位置は描かない", () => {
    expect(draw(reel, 6 + 4).texts.some((t) => t.includes(" / "))).toBe(false);
  });
});

/** 1 か国ずつの表示の Reel。タグの配置は国名 1 文字 = 38px で測る（コマの国名のタグと同じ文字サイズ）。 */
function focusReelOf(
  records: Parameters<typeof buildTimeline>[0],
  measure = (text: string) => text.length * 38,
): Reel {
  const timeline = buildTimeline(records);
  if (!timeline) {
    throw new Error("タイムラインがない");
  }
  return buildReel(timeline, measure, "focus");
}

// 2016 年に韓国・台湾、2019 年にフランスと韓国（再訪）。訪問 4 件 × 1.6 秒の後にまとめ
const focusReel = focusReelOf([
  { year: 2016, country: "KR" },
  { year: 2016, country: "TW" },
  { year: 2019, country: "FR" },
  { year: 2019, country: "KR" },
]);

/** i 番目の訪問のコマの、頭から elapsed 秒の時刻。 */
const visitAt = (index: number, elapsed: number) => index * 1.6 + elapsed;

describe("drawFrame（1 か国ずつの表示の訪問のコマ）", () => {
  test("初めて訪れた国は「#連番」と国名を描き、再訪のタグは描かない", () => {
    const { texts } = draw(focusReel, visitAt(2, 1.5));
    expect(texts).toEqual(expect.arrayContaining(["#3", "フランス"]));
    expect(texts).not.toContain("再訪");
  });

  test("再訪は番号を描かず、国名に「再訪」のタグを添える", () => {
    const { texts } = draw(focusReel, visitAt(3, 1.5));
    expect(texts).toEqual(expect.arrayContaining(["大韓民国", "再訪"]));
    expect(texts.some((text) => text.startsWith("#"))).toBe(false);
  });

  test("移動の途中では国名を描かず、地図のその国はまだ塗らない", () => {
    const { texts, focused } = draw(focusReel, visitAt(2, 0.3));
    expect(texts).not.toContain("フランス");
    expect(texts).not.toContain("#3");
    expect(focused[0]?.current).toMatchObject({ code: "FR", strength: 0 });
    // 累計は前の訪問までの 2 か国のまま
    expect(texts).toContain("2");
  });

  test("地図はこの訪問より前の国を訪問済みにし、この国を強調して寄せる", () => {
    const { focused } = draw(focusReel, visitAt(2, 1.5));
    expect(focused).toHaveLength(1);
    expect(focused[0]?.visited).toEqual(["KR", "TW"]);
    expect(focused[0]?.current).toMatchObject({ code: "FR", strength: 1 });
    // フェイクの範囲は FR を x = 70 × 4 = 280〜300 に置いている。移動が終わればその中心に寄っている
    expect(focused[0]?.camera.x).toBeCloseTo(290);
  });

  test("年が変わる訪問では、切り替えの途中に前後の年を描く", () => {
    const switching = draw(focusReel, visitAt(2, 0.2)).texts;
    expect(switching).toEqual(expect.arrayContaining(["2016", "2019"]));
    const settled = draw(focusReel, visitAt(2, 1.5)).texts;
    expect(settled).toContain("2019");
    expect(settled).not.toContain("2016");
  });

  test("同じ年の訪問では年は切り替わらない", () => {
    expect(draw(focusReel, visitAt(1, 0.2)).texts.filter((text) => /^\d{4}$/.test(text))).toEqual([
      "2016",
    ]);
  });

  test("国名のタグは初めて訪れた国だけを初めて訪れた順に並べ、再訪では増えない", () => {
    const fresh = draw(focusReel, visitAt(2, 1.5)).texts;
    expect(fresh.filter((text) => ["大韓民国", "台湾", "フランス"].includes(text))).toEqual([
      // 国名（大きな文字）の後にタグが並ぶ
      "フランス",
      "大韓民国",
      "台湾",
      "フランス",
    ]);
    const revisit = draw(focusReel, visitAt(3, 1.5)).texts;
    expect(revisit.filter((text) => text === "大韓民国")).toHaveLength(2);
    expect(revisit).toContain("3");
  });

  test("タグが入りきらないときは古い国から押し出し、累計はすべての国を数える", () => {
    // 1 つのタグが行の幅を占めるほど広く測ると、表示枠には 3 か国（3 行）までしか入らない
    const crowded = focusReelOf(
      ["KR", "TW", "FR", "IT"].map((country) => ({ year: 2024, country })),
      () => 900,
    );
    const { texts } = draw(crowded, visitAt(3, 1.5));
    expect(texts).not.toContain("大韓民国");
    expect(texts).toEqual(expect.arrayContaining(["台湾", "フランス", "イタリア", "4"]));
  });
});

describe("drawFrame（1 か国ずつの表示のまとめのコマ）", () => {
  const summaryStart = 4 * 1.6;

  test("引いている間は寄せた地図を描き、最後の訪問の年を消していく", () => {
    const { focused, maps } = draw(focusReel, summaryStart + 0.5);
    expect(focused).toHaveLength(1);
    expect(focused[0]?.current).toBeUndefined();
    expect(focused[0]?.visited).toEqual(["KR", "TW", "FR"]);
    expect(maps).toEqual([]);
  });

  test("引き終わったら、年ごとの表示のまとめと同じ地図・期間・累計・国名を同じ位置に描く", () => {
    const yearReel = buildReel(focusReel.timeline, (text) => text.length * 38);
    const focus = draw(focusReel, summaryStart + 3.5);
    const year = draw(yearReel, 2 * 2 + 3.5);
    expect(focus.focused).toEqual([]);
    expect(focus.maps).toEqual([
      { key: "summary", y: 480, visited: ["KR", "TW", "FR"], emphasized: [], strength: 1 },
    ]);
    expect(focus.maps).toEqual(year.maps);
    const placed = (drawn: { text: string; x: number }[]) =>
      drawn
        .filter((d) =>
          ["2016", "–", "2019", "累計", "3", "大韓民国", "台湾", "フランス"].includes(d.text),
        )
        .map(({ text, x }) => ({ text, x }));
    expect(placed(focus.drawn)).toEqual(placed(year.drawn));
  });

  test("引き終わる前は、まとめの国名のページはまだ出ない", () => {
    const { drawn } = draw(focusReel, summaryStart + 0.5);
    const pageNames = drawn.filter((d) => d.text === "台湾" && d.alpha > 0 && d.alpha < 1);
    // 最後の訪問のタグは引くにつれて消えていく
    expect(pageNames.length).toBeGreaterThan(0);
    expect(drawn.some((d) => d.text === "2016" && d.alpha > 0)).toBe(false);
  });
});
