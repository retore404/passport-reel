# Tasks

## 1. 保存処理

- [x] 1.1 `src/export/saveVideo.ts` を、共有に対応しているかの判定（`canShareFile`）、共有（`shareVideo`）、ダウンロード（`downloadVideo`）に分ける。「共有できなければダウンロード」の切り替えはやめる。単体テストを書き換え、判定が `canShare` の結果に従うこと、共有シートを閉じた `AbortError` を失敗にしないこと、それ以外の失敗を伝えることを確認する

## 2. 書き出しの UI

- [x] 2.1 `ExportPanel.tsx` の完了表示を「ダウンロード」と「共有」の 2 つのボタンにする。「共有」は共有に対応した環境でだけ出す。主な操作（`button--primary`）は PC 幅で「ダウンロード」、スマートフォン幅で「共有」にする。画面幅は `PreviewScreen.tsx` から渡す。型検査と lint が通ることを確認する
- [x] 2.2 `docs/design-guidelines.md` の「書き出し・共有（#5、#8）」の完了時の表示を、2 つのボタンと画面幅による主な操作の違いに改める。実装と一致していることを確認する

## 3. 統合確認

- [x] 3.1 ブランチを push し、プレビュー URL で確認してもらう。Windows + Chrome では、「ダウンロード」で動画を保存して再生できること。iPhone Safari では、「共有」から写真アプリに保存できること
- [x] 3.2 `pnpm check` がすべて通ることを確認する
- [x] 3.3 `openspec validate fix-video-save-options --strict` が通ることを確認する

## Workflow follow-up

- issue #20 に紐づくブランチで PR を作成し、レビュー後にマージする。
- マージ後に `openspec-archive-change` で本変更をアーカイブする。
