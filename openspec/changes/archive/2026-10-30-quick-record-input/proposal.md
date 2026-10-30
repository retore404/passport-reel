# Proposal

## Why

記録の追加では、候補が 1 か国に絞れても「候補を選ぶ → 追加を押す」の操作が要り、手早く登録できない（#22）。また iPhone Safari では、国の欄を選ぶと画面が拡大され、キーボードを出すと追加ボタンと候補がキーボードに隠れて操作しにくい。

## What Changes

- 選べる候補（追加済みを除く）が 1 か国だけになったら、その候補を強調し、国の欄にいたまま Enter を 1 回押すと、その国の記録を追加する。追加ボタンもその国の追加に使える。
- 日本語入力の変換を確定するための Enter では記録を追加しない。
- 入力欄の文字を 16px にし、iPhone Safari で入力欄を選んでも画面が拡大されないようにする。
- スマートフォンの記録の追加シートを、最初から画面の高さの 85% で開く。年・国の欄・追加ボタンを画面の上寄りに置き、国の欄と追加ボタンを横に並べる。候補リストはシートの中でスクロールさせる。キーボードを表示しても入力欄・追加ボタン・候補が見える。

## Capabilities

### New Capabilities

（なし）

### Modified Capabilities

- `visit-records`: 唯一の候補を Enter で追加する要件と、スマートフォンでキーボード表示中も入力できる要件を追加する。

## Impact

- `apps/web/src/records/RecordForm.tsx`、`apps/web/src/records/RecordsScreen.tsx`、`apps/web/src/Sheet.tsx`、`apps/web/src/index.css`
- 候補の判定と変換確定の Enter の判定を行う純粋関数とそのテストを追加する
- `docs/design-guidelines.md`（入力欄の文字の大きさ、唯一の候補の強調、記録の追加シートの形）
- 依存ライブラリの追加はない
