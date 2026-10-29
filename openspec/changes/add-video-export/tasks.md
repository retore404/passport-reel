# Tasks

## 1. 依存と形式の判定

- [x] 1.1 `apps/web` に `mediabunny` を追加する（`minimumReleaseAge` に従い版は固定）。`pnpm install` と `pnpm --filter ./apps/web build` が成功することを確認する
- [x] 1.2 `src/export/videoFormat.ts` に `chooseVideoFormat` を実装する。H.264 を使えれば H.264、使えず VP9 を使えれば VP9、どちらも使えなければ `undefined` になることを、判定関数のフェイクを使った単体テストで確認する

## 2. 書き出しの処理

- [x] 2.1 `src/export/frames.ts` にフレーム数・フレームの時刻・進捗の表示文字列・ファイル名を実装する。10 秒で 300 フレームになること、フレーム 135 が 4.5 秒（3 つ目の年のコマ）になること、「150 / 300」と「50%」、ファイル名 `passport-reel-2016-2024.mp4` を単体テストで確認する
- [x] 2.2 `src/export/exportVideo.ts` に、オフスクリーン Canvas への描画と Mediabunny でのエンコードを実装する。進捗の通知、数フレームごとの処理の譲渡、`AbortSignal` によるキャンセル（`output.cancel()` を呼んで中断する）を入れる。型検査と lint が通ることを確認する（WebCodecs を使うため、動作の確認は 4.1 で行う）
- [x] 2.3 `src/export/saveVideo.ts` に共有とダウンロードの切り替えを実装する。共有できれば `share` が呼ばれること、共有できなければダウンロードすること、共有シートを閉じた `AbortError` を失敗にしないことを、navigator のフェイクを使った単体テストで確認する

## 3. 書き出しの UI

- [x] 3.1 `src/export/useVideoExport.ts` に、形式の判定・書き出し・キャンセル・完了・失敗の状態を持つフックを実装する。状態の遷移は純粋な関数に分け、単体テストで確認する
- [x] 3.2 `src/export/ExportPanel.tsx` を実装する。表示するのは、書き出しボタン、進捗（「150 / 300（50%）」と進捗バー）とキャンセル、完了時のファイル名・長さ・解像度・形式と「共有・保存」、非対応・失敗時の案内である。型検査と lint（jsx-a11y を含む）が通ることを確認する
- [x] 3.3 `PreviewScreen.tsx` に組み込む。PC は右パネルの下端、スマートフォンは操作の並びに「書き出す」ボタンを置いてシートを開く。書き出し開始時にプレビューの再生を止め、書き出し中にシートを閉じたらキャンセルする。`pnpm --filter ./apps/web build` が成功することを確認する
- [x] 3.4 `docs/design-guidelines.md` の「書き出し・共有（#5、#8）」と「レイアウト」に、書き出しの入口の位置、シートを閉じたときのキャンセル、完了時に表示する項目、非対応時の文言を追記する。実装と一致していることを確認する

## 4. 統合確認

- [ ] 4.1 ブランチを push し、プレビュー URL で PC Chrome・iPhone Safari・Android Chrome の書き出しを確認してもらう。確認する内容は次のとおり。
  - 書き出した動画の形式（H.264）と、長さ・内容がプレビューと一致すること
  - 進捗の表示とキャンセル
  - 共有シートから写真アプリまたは Google フォトに保存して再生できること
  - PC ではダウンロードされること
  - DevTools の Network で、書き出し中に通信が発生しないこと
- [ ] 4.2 4.1 で確認できた環境の結果（ほかの環境を試した場合はその結果も）を `docs/spikes/video-export.md` に追記する
- [x] 4.3 `pnpm check` がすべて通ることを確認する
- [x] 4.4 `openspec validate add-video-export --strict` が通ることを確認する

## Workflow follow-up

- issue #5 に紐づくブランチで PR を作成し、レビュー後にマージする。
- マージ後に `openspec-archive-change` で本変更をアーカイブする。
