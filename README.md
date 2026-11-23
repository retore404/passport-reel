# passport-reel
訪れたことのある国を時系列で可視化して動画にする

# 開発環境

- 開発環境は DevContainer を使うことを前提としている。
- Node.js / Claude Code / Codex / OpenSpec / T3Code は mise（`mise.toml`）、pnpm は `package.json#packageManager` で版数を固定する。
- 依存パッケージは公開から7日以上経ったものだけを入れる（`minimumReleaseAge`）。npm/npx は使わず pnpm を使う。

## T3Code（ブラウザからコーディングエージェントを操作する）

T3Code は Dev Container 内でサーバーとして起動し、ホストのブラウザから操作する。エージェントは Dev Container 内の Claude Code・Codex とその認証情報をそのまま使う。

```bash
t3 serve
```

- 起動時に待ち受けポートとペアリング URL が表示される。VS Code の「ポート」パネルでそのポートを転送し（自動転送はしない設定にしている）、ペアリング URL のホストとポートを転送先に読み替えてホストのブラウザで開く。
- 起動中のサーバーに別のブラウザを追加するときは、別のターミナルで `t3 pair` を実行し、表示された URL を開く。
- ペアリング URL はパスワードと同等に扱う。
- ペアリング状態とスレッドは名前付きボリューム（`passport-reel-t3`）の `~/.t3` に保存され、Dev Container を作り直しても残る。

## Chrome DevTools MCP

- Claude Code（`.mcp.json`）と Codex（`.codex/config.toml`）に chrome-devtools MCP サーバーを設定している。エージェントはコンテナ内のヘッドレス Chrome（chrome-headless-shell）でページを開き、スナップショットやスクリーンショットで描画を確認できる。
- chrome-headless-shell は Dev Container の作成時に入り、`~/.local/bin/chrome-headless-shell` から参照する。日本語フォント（Noto CJK）も入る。
- Dev Container は Docker 既定の seccomp で動き、Chrome のサンドボックスに必要な名前空間を作れない。そのため Chrome は `--no-sandbox` で起動し、隔離は Dev Container 自体に委ねている。
- 開発サーバーはユーザーが起動する。エージェントはコンテナ内の `http://localhost:5173` を開く。

## 依存の更新（Renovate）

- 依存の更新 PR は [Renovate](https://docs.renovatebot.com/) が作成する。設定は `renovate.json` にある。利用には Renovate GitHub App をリポジトリへインストールする必要がある。
- 対象は pnpm の依存と `package.json#packageManager`、`mise.toml` のツール、devcontainer の feature と Dockerfile のベースイメージ（digest で固定する）。
- 公開から7日未満のバージョンへの更新 PR は作らない。ただし公開日時を取得できない docker 系（devcontainer の feature とベースイメージ）は待機の対象外とする。
- major 以外の更新（minor・patch・digest など）は 1 本の PR にまとめ、CI を含むすべてのチェックが成功したら Renovate が自動でマージする。
- major 更新は更新ごとに個別の PR とし、手動でレビューしてマージする。

## CI

- すべての PR で GitHub Actions（`.github/workflows/ci.yml`）が `pnpm check` と `apps/web` のビルドを実行する。
- CI の成功は `main` へのマージの必須条件にはしていない。Renovate の集約 PR の自動マージ判定に使う。

## 構成

| パス | 内容 |
| --- | --- |
| `apps/web` | Web アプリ本体（Vite + React + TypeScript、フロントエンドのみ）。`pnpm --filter ./apps/web build` で `apps/web/dist` に静的ファイルを出力し、Cloudflare Workers で配信する |
| `openspec/` | 仕様と変更提案（OpenSpec） |
| `docs/design-guidelines.md` | 見た目の方針（配色、書体、レイアウト、地図の配色、将来の画面の指針） |
| `docs/spikes/` | スパイク（技術検証）の結果と、それに基づく判断 |
| `.agents/skills/` | コーディングエージェント用 skills（`.claude/skills` から symlink） |

## コマンド

```
pnpm install
pnpm check   # lint + format:check + typecheck + knip + test
pnpm fix     # lint:fix + format
```

## デプロイ

`apps/web` のビルド結果を Cloudflare Workers の静的アセットとして配信する。設定は `apps/web/wrangler.jsonc` にある。

デプロイは Workers Builds（Cloudflare の Git 連携）で行う。`main` への push は本番に、それ以外のブランチはプレビュー URL にデプロイされる。ダッシュボードの Build 設定は次のとおり。

| 項目 | 値 |
| --- | --- |
| Root directory | `apps/web` |
| Build command | `pnpm build` |
| Deploy command | `pnpm run deploy` |
| Non-production branch deploy command | `pnpm run deploy:preview` |

同梱した依存パッケージのライセンス一覧は、ビルド時に Vite が `dist/third-party-licenses.json` として書き出し（`apps/web/vite.config.ts` の `build.license`）、画面の上部バーの「ライセンス」から開くシートに表示する。開発サーバーでは生成されないため、表示を確かめるときは `pnpm build` してから `pnpm preview` で開く。

公開リポジトリのため、秘密情報は `wrangler.jsonc` に書かず、`wrangler secret` かダッシュボードの Secrets で設定する。
