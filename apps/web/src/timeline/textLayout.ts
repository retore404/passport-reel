/** 国名を並べるときの区切り。 */
const SEPARATOR = "、";

function wrap(tokens: readonly string[], maxWidth: number, measure: (text: string) => number) {
  const lines: string[] = [];
  let line = "";
  for (const token of tokens) {
    // 国名の途中では折り返さず、収まらなければ次の行に送る（1 語で幅を超える場合はそのまま置く）
    if (line !== "" && measure(line + token) > maxWidth) {
      lines.push(line);
      line = token;
    } else {
      line += token;
    }
  }
  if (line !== "") {
    lines.push(line);
  }
  return lines;
}

function tokensOf(names: readonly string[], rest: number): string[] {
  const shown = names.map((name, index) =>
    index < names.length - 1 || rest > 0 ? name + SEPARATOR : name,
  );
  return rest > 0 ? [...shown, `ほか ${rest} か国`] : shown;
}

/**
 * 国名を「、」でつないで指定の幅で折り返す。
 * 最大行数に収まらない場合は、収まるところまで国名を減らし、残りを「ほか N か国」にまとめる。
 * 幅の計測は描画先のフォントに依存するため引数で受け取る。
 */
export function layoutNames(
  names: readonly string[],
  maxWidth: number,
  maxLines: number,
  measure: (text: string) => number,
): string[] {
  for (let shown = names.length; shown >= 0; shown -= 1) {
    const lines = wrap(tokensOf(names.slice(0, shown), names.length - shown), maxWidth, measure);
    if (lines.length <= maxLines) {
      return lines;
    }
  }
  return wrap(tokensOf([], names.length), maxWidth, measure);
}
