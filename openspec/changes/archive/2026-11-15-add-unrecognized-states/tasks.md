# Tasks

## 1. 対象地域の一覧と国名

- [x] 1.1 `src/records/unrecognizedStates.ts` に対象地域の一覧（`code`・`name`・`displayCode`・`mapName`：XK コソボ XK Kosovo、XN 北キプロス -- N. Cyprus、XS ソマリランド -- Somaliland）を定義する。正が `openspec/specs/visit-records/spec.md` の「国として扱う ISO 3166-1 にない地域」であること、一度割り当てた ID は変更・再利用しないことをコメントで書く。単体テストで、ID が `XA`–`XZ` の一意な2文字であることと、`displayCode` が ID と同じなのは i18n-iso-countries の日本語データに収録されている地域だけで、それ以外は `--` であることを確認する
- [x] 1.2 `src/records/countryNames.ts` の `COUNTRY_NAMES` に、一覧のうち i18n-iso-countries にない地域（XN・XS）を足し、表示用の国コードを返す関数を追加する。北キプロスには読みの別名「キタキプロス」を足す。`countryNames.test.ts` で、「きぷろす」でキプロスと北キプロス、「きたきぷろす」で北キプロス、「ソマリランド」でソマリランドが候補に出ること、XK が重複しないこと、`countryName("XN")` が「北キプロス」になること、表示用の国コードが XK→`XK`・XN→`--`・JP→`JP` になることを確認する
- [x] 1.3 `src/records/RecordList.tsx` と `src/records/RecordForm.tsx` の国コードのバッジを表示用の国コードにし、`pnpm typecheck` が通ることを確認する。`docs/design-guidelines.md` の記録の一覧の記述（国コードのバッジ）に、ISO 3166-1 にない地域では `--` を表示する（国名データにコードがある地域を除く）ことを追記する

## 2. 地図での塗り

- [x] 2.1 `src/map/countries.ts` の `toMapCountries` で、`id` のない形状に一覧の `mapName` と `properties.name` で ID を割り当てる。`MapCountry.alpha2` のコメントを「alpha-2 または ISO 3166-1 にない地域の ID」に直す。`countries.test.ts` で、一覧の各地域にちょうど1つの形状が対応すること、Indian Ocean Ter. と Siachen Glacier は `undefined` のままであることを確認し、「Kosovo は alpha-2 を持たない」前提のテストを書き換える
- [x] 2.2 `src/map/drawWorldMap.test.ts` に、XK・XN・XS を登録するとその地域が塗られること、CY・SO を登録しても XN・XS は塗られないこと、XN・XS を登録しても CY・SO は塗られないことのテストを追加する。地図に対応しないコードの例を `XK` から一覧にないコードに書き換え、`src/timeline/camera.test.ts` の「地図に形状のない国」の例も同様に書き換えて、テストが通ることを確認する

## 3. 統合確認

- [x] 3.1 `pnpm check` がすべて通ることを確認する
- [x] 3.2 `openspec validate add-unrecognized-states --strict` が通ることを確認する
- [x] 3.3 ユーザーに開発サーバーを起動してもらい、コソボ・北キプロス・ソマリランドを日本語名で検索して追加でき、地図で塗られること、一覧と候補のバッジが XK・`--`・`--` になること、訪問国数が親国と別に数えられること、既存の記録が変わらず表示されることを確認する

## Workflow follow-up

- issue #38 に紐づくブランチでコミットし、PR を作成する前に `openspec-archive-change` で本変更をアーカイブする（アーカイブのコミットを同じ PR に含める）。
