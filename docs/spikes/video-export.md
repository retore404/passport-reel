# 動画書き出しの実機検証（スパイク）

issue #4 の結果。動画の書き出し機能（#5）で採用する形式とフォールバック順の根拠とする。

## 検証方法

- 1080x1920（9:16）・30fps・5秒の地図アニメーションを Canvas に描き、WebCodecs（`VideoEncoder`）で1フレームずつエンコードして Mediabunny でファイルにまとめた。
- 試した形式は H.264 / MP4、VP9 / MP4、VP9 / WebM の3つ。
- 各端末で、書き出し、ブラウザの `<video>` での再生、共有シートまたはダウンロードによる保存、保存先アプリでの再生を確認した。
- 検証用のコードは `spike/video-export` ブランチにだけあり、本番アプリには含めていない。

## 結果

| 環境 | 形式 | 書き出し | ブラウザ内の再生 | 保存 | 保存後の再生 |
| --- | --- | --- | --- | --- | --- |
| PC Chrome | H.264 / MP4 | OK | OK | OK | OK |
| PC Chrome | VP9 / MP4 | OK | OK | OK | OK |
| PC Chrome | VP9 / WebM | OK | OK | OK | OK |
| iOS Safari | H.264 / MP4 | OK | OK | OK（共有シートから写真アプリ） | OK |
| iOS Safari | VP9 / MP4 | OK | NG（`MediaError` code 4） | NG（写真に保存しても写真アプリに現れない） | NG |
| iOS Safari | VP9 / WebM | OK | OK | NG（共有できない） | - |
| Android Chrome | H.264 / MP4 | OK | OK | OK（共有シートから Google フォト） | OK |
| Android Chrome | VP9 / MP4 | OK | OK | OK（共有シートから Google フォト） | OK |
| Android Chrome | VP9 / WebM | OK | OK | OK（共有シートから Google フォト） | NG（Google フォトで「動画を処理しています」のまま止まる） |

未検証の環境は次のとおり。

- **PC Edge:** Chrome と同じ Chromium ベースのため、同じ結果になる見込み（推測）。
- **PC Firefox / Mac Safari:** 未検証。
- **Firefox Android:** #9 で扱う。

## 結論

### 採用する形式とフォールバック順

1. **H.264 / MP4**：検証したすべての環境で、書き出しから保存先アプリでの再生までできた。iOS で写真アプリに保存できたのはこの形式だけ。
2. **VP9 / MP4**：H.264 のエンコーダを使えない環境で使う。Android の Google フォトでは再生できたが、iOS では再生できない。iOS は H.264 を使えるため、このフォールバックに回ることはない。
3. **どちらも使えない場合**：書き出しに対応していない旨を表示する。

VP9 / WebM は採用しない。iOS では共有できず、Google フォトでは処理が終わらなかった。

### 書き出し方式

- WebCodecs でフレームごとにエンコードし、各フレームの時刻はフレーム番号から決める。描画やエンコードが実時間より遅くても、コマ落ちしない。
- 形式を選ぶときは、エンコードを始める前に `VideoEncoder.isConfigSupported`（Mediabunny では `canEncodeVideo`）で H.264 → VP9 の順に判定する。
- 保存は、`navigator.canShare({ files })` が真なら共有シートを使い、それ以外ならダウンロードする。

### #5 に持ち越す確認事項

- PC Edge / Firefox と Mac Safari での動作。

## #5 の実装での確認

- 上の結論のとおりに実装した動画書き出し（`apps/web/src/export/`）を、プレビュー URL で実機確認した。書き出し・共有・保存・再生に問題は見つからなかった。
- その後、PC（Windows + Chrome）では保存できないことが分かった（#20）。PC のブラウザもファイルの共有に対応しているため、「共有できれば共有シート」という判定では PC でも共有シートが開くが、PC の共有シートには保存の選択肢がない。そのため「ダウンロード」を常に出し、「共有」は共有できる環境でだけ追加で出す形に改めた。
- 書き出しにかかる時間は計測していない。スマートフォンでも実用上問題のない時間で終わった（確認者の所感）。
- PC Edge / Firefox と Mac Safari は引き続き未検証。形式は実行時に判定し、使えなければ非対応の案内を出すため、壊れた動画は作られない。
