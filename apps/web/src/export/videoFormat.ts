export type VideoFormat = {
  /** Mediabunny のコーデック名 */
  readonly codec: "avc" | "vp9";
  /** 画面に出す形式名 */
  readonly label: string;
};

/** 試す順。docs/spikes/video-export.md の結論（H.264 / MP4 → VP9 / MP4）に従う。 */
const CANDIDATES: readonly VideoFormat[] = [
  { codec: "avc", label: "H.264 / MP4" },
  { codec: "vp9", label: "VP9 / MP4" },
];

/**
 * 書き出しに使う形式を選ぶ。最初に使える形式を返し、どれも使えなければ undefined。
 * 判定はブラウザのエンコーダに依存するため、判定関数を引数で受け取る。
 */
export async function chooseVideoFormat(
  canEncode: (codec: VideoFormat["codec"]) => Promise<boolean>,
): Promise<VideoFormat | undefined> {
  for (const format of CANDIDATES) {
    if (await canEncode(format.codec).catch(() => false)) {
      return format;
    }
  }
  return undefined;
}
