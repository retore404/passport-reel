# Tasks

## 1. 海外領土の切り出し

- [x] 1.1 `src/map/countries.ts` の `toMapCountries` で、FR・NO・NL の形状を島ごとに分け、海外領土の範囲にある島を GF・GP・MQ・YT・RE・SJ・BQ の形状として切り出す。単体テストで、各コードに形状があり、親国の形状に海外領土が残らないことを確認する
- [x] 1.2 `src/map/drawWorldMap.test.ts` に、親国と海外領土がそれぞれ登録したものだけ塗られること、小さな海外領土にマーカーが出ることのテストを追加する

## 2. 統合確認

- [x] 2.1 `pnpm check` がすべて通ることを確認する
- [x] 2.2 `openspec validate fix-overseas-territories --strict` が通ることを確認する

## Workflow follow-up

- issue #27 に紐づくブランチで PR を作成する。
- 同じ PR の中で `openspec-archive-change` で本変更をアーカイブしてから、レビュー後にマージする。
