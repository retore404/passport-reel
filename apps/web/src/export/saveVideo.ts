/** 保存に使う navigator の機能。テストではフェイクを渡す。 */
export type ShareNavigator = {
  readonly canShare?: (data: ShareData) => boolean;
  readonly share?: (data: ShareData) => Promise<void>;
};

export type SaveResult = "shared" | "downloaded" | "dismissed";

function download(file: File) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  anchor.click();
  // ダウンロードが始まる前に解放すると失敗する端末があるため、少し待ってから解放する
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * 書き出した動画を保存する。ファイルを共有できる端末では共有シートを開き、それ以外ではダウンロードする。
 * 共有シートは利用者の操作の中でしか開けないため、ボタンのクリックから呼ぶ。
 * 共有シートを利用者が閉じた場合（AbortError）は失敗ではなく "dismissed" を返す。
 */
export async function saveVideo(
  file: File,
  nav: ShareNavigator,
  fallback: (file: File) => void = download,
): Promise<SaveResult> {
  const data = { files: [file] };
  if (nav.share && nav.canShare?.(data)) {
    try {
      await nav.share(data);
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return "dismissed";
      }
      throw error;
    }
  }
  fallback(file);
  return "downloaded";
}
