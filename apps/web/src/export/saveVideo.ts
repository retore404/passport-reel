/** 共有に使う navigator の機能。テストではフェイクを渡す。 */
export type ShareNavigator = {
  readonly canShare?: (data: ShareData) => boolean;
  readonly share?: (data: ShareData) => Promise<void>;
};

/**
 * 動画ファイルを共有シートで共有できるか。
 * PC のブラウザでも真になることがあるが、PC の共有シートには保存の選択肢がないため、
 * 共有はダウンロードの代わりではなく、ダウンロードと並べて出す操作として使う。
 */
export function canShareFile(file: File, nav: ShareNavigator): boolean {
  return nav.share !== undefined && nav.canShare?.({ files: [file] }) === true;
}

/**
 * 共有シートを開く。利用者の操作の中でしか開けないため、ボタンのクリックから呼ぶ。
 * 利用者が共有シートを閉じた場合（AbortError）は失敗ではなく false を返す。
 */
export async function shareVideo(file: File, nav: ShareNavigator): Promise<boolean> {
  try {
    await nav.share?.({ files: [file] });
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return false;
    }
    throw error;
  }
}

/** 動画をファイルとしてダウンロードする。 */
export function downloadVideo(file: File): void {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  anchor.click();
  // ダウンロードが始まる前に解放すると失敗する端末があるため、少し待ってから解放する
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
