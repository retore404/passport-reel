# Design

## Context

- コマの描画は `drawFrame(ctx, width, timeline, frame, layers)` で、時刻からコマを決めるのは `frameAt(timeline, t)`、全体の長さは `totalDuration(timeline)` である。いずれも時刻だけで絵が決まる（`openspec/specs/timeline-animation`）。
- 地図の描画には `createMapLayers(countries)` のキャッシュを使う。キャッシュは描画結果を変えないため、書き出しでも使える。
- 書き出し方式と形式の順位は `docs/spikes/video-export.md` で決まっている。
  - WebCodecs でフレームごとにエンコードし、Mediabunny で MP4 にまとめる。
  - 形式は H.264 / MP4、使えなければ VP9 / MP4 の順に選ぶ。
  - 保存は、ファイルを共有できる端末では共有シート、それ以外ではダウンロードにする。
- スパイクで検証したのは、PC Chrome、iOS Safari、Android Chrome である。PC Edge・Firefox と Mac Safari は検証していない。
- 書き出し中・完了時・非対応時の表示は `docs/design-guidelines.md` の「書き出し・共有（#5、#8）」にある。

## Goals / Non-Goals

**Goals:**

- プレビューと同じ `drawFrame` を使い、見た目とタイミングが必ず一致する動画を書き出す。
- 形式の判定、フレームの時刻、進捗の表示、ファイル名、保存方法の選択を、ブラウザの API から切り離した関数にして単体テストする。

**Non-Goals:**

- 音声（BGM は #10）、Firefox Android（#9）。
- 解像度・フレームレート・画質の選択。1080×1920・30fps・高画質に固定する。
- 書き出しの Web Worker への移動。まずは画面と同じスレッドで行う（「Risks / Trade-offs」を参照）。
- 書き出した動画のアプリ内での保管。完了表示を閉じたら破棄する。

## Decisions

### モジュール構成

`src/export/` に次を置く。

- `videoFormat.ts`：`chooseVideoFormat(canEncode)`。H.264 → VP9 の順に試し、最初に使える形式（`{ codec: "avc" | "vp9", label }`）を返す。どちらも使えなければ `undefined` を返す。判定関数は引数で受け取り、本番では Mediabunny の `canEncodeVideo` を 1080×1920 の条件で呼ぶ。
- `exportVideo.ts`：`exportVideo(timeline, countries, format, { onProgress, signal })`。1080×1920 のオフスクリーン Canvas に各フレームを描き、Mediabunny の `CanvasSource` でエンコードして `File` を返す。
- `frames.ts`：`FPS = 30`、`frameCount(duration)`、`frameTime(index)`（index / 30）、進捗の表示文字列、ファイル名（`passport-reel-<最初の年>-<最後の年>.mp4`）を置く。
- `saveVideo.ts`：`saveVideo(file, nav)`。`nav.canShare({ files })` が真なら `nav.share` を呼び、偽ならダウンロードする。共有シートをユーザーが閉じた場合（`AbortError`）は失敗として扱わない。
- `useVideoExport.ts`：書き出しの状態を持つフック。`exportVideo.ts`（Mediabunny を含む）は動的 import で読み込み、初期表示のバンドルに含めない。状態は `checking`（形式の判定中）→ `unsupported` または `ready` → `exporting { done, total }` → `done { file }`（または `error`）と遷移する。キャンセルは `AbortController` で行う。
- `ExportPanel.tsx`：書き出しボタン、進捗とキャンセル、完了時の情報と「共有・保存」、非対応・失敗時の案内を出すコンポーネント。

### フレームの描画とエンコード

- フレーム数は `totalDuration × 30` とする（コマの長さが整数秒なので割り切れる）。フレーム i の時刻は i / 30 秒とし、`frameAt` でコマを決める。描画が遅くても時刻はフレーム番号で決まるので、コマ落ちしない（spec「コマ落ちのない書き出し」）。
- 各フレームで `await source.add(i / 30, 1 / 30)` を呼び、エンコーダの処理待ちに従う。数フレームごとに `setTimeout(0)` で処理を譲り、進捗表示とキャンセルボタンが反応できるようにする。
- 書き出し用の `MapLayers` は、プレビュー用とは別に作る。解像度が異なり、互いのキャッシュを捨て合わないようにするためである。
- MP4 は `fastStart: "in-memory"` で書き出す。moov を先頭に置き、共有先のアプリがすぐ再生を始められるようにする。
- 画質は Mediabunny の `Quality("high")` とする。キーフレームの間隔は 2 秒にする。
- キャンセルされたら `output.cancel()` を呼び、ファイルを作らずに終える。

### 画面への組み込み

- **PC：** プレビュー画面の右パネルの下端に `ExportPanel` を置く。進捗・完了・非対応の表示もパネルの中に出す。
- **スマートフォン：** プレビューの操作の並びに「書き出す」ボタンを置き、押すとシート（`Sheet`）を開く。シートの中に `ExportPanel` を置く。シートを書き出し中に閉じると、書き出しはキャンセルする。見えないところで重い処理を続けないためである。
- 書き出しを始めたら、プレビューの再生を止める。同時に両方を描くと、書き出しが遅くなるためである。
- 非対応の環境では書き出しボタンを無効にし、`--danger` の案内に対応環境を書く。案内の文言は「この環境では動画を書き出せません。PC・Android の Chrome、iPhone の Safari で書き出せます。」とする。
- 完了時は、ファイル名、長さ（m:ss）、解像度（1080×1920）、形式（H.264 / VP9）を表示し、その下に「共有・保存」ボタンを置く。共有シートは利用者の操作の中で開く必要があるため、完了時に自動では開かない。

## Risks / Trade-offs

- [画面のスレッドでの書き出し] 書き出し中は描画とエンコードで画面の反応が鈍くなる → 数フレームごとに処理を譲り、進捗とキャンセルが反応するようにする。重すぎる場合は Web Worker と OffscreenCanvas への移動を別 issue で検討する。
- [バックグラウンドのタブ] タブを切り替えると `setTimeout` が間引かれ、書き出しが遅くなる → フレームは時刻で決まるので、動画の内容は変わらない。遅くなるだけである。
- [メモリ] 動画全体をメモリ上に持つ → 30 秒・高画質でも数十 MB 程度なので許容する。
- [未検証の環境] PC Edge・Firefox と Mac Safari は検証していない → 形式は実行時に判定し、使えなければ非対応の案内を出すので、壊れた動画は作らない。確認できた環境の結果は `docs/spikes/video-export.md` に追記する。
- [端末のフォント] 動画の文字は、書き出した端末のフォントで固定される → プレビューと同じ端末で書き出す限り、見た目は一致する。
