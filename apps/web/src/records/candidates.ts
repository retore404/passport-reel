import type { CountryName } from "./countryNames";

/**
 * 選べる候補（その年に追加済みでない国）がちょうど 1 か国のとき、その国を返す。
 * 追加済みの国は選べないため、候補の件数ではなく選べる件数で判定する。
 */
export function soleSelectableCandidate(
  candidates: readonly CountryName[],
  isAdded: (code: string) => boolean,
): CountryName | undefined {
  const selectable = candidates.filter((country) => !isAdded(country.code));
  return selectable.length === 1 ? selectable[0] : undefined;
}

type EnterKeyEvent = {
  readonly key: string;
  readonly isComposing: boolean;
  readonly keyCode: number;
};

/**
 * 日本語入力の変換を確定するための Enter かどうか。
 * Safari は変換確定の Enter を compositionend の後に isComposing=false で送るため、
 * 変換中のキー入力を表す keyCode 229 もあわせて見る（keyCode は非推奨だが、代わる標準の手段がない）。
 */
export function isImeConfirmingEnter(event: EnterKeyEvent): boolean {
  return event.key === "Enter" && (event.isComposing || event.keyCode === 229);
}
