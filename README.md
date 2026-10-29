# passport-reel
訪れたことのある国を時系列で可視化して動画にする

# 開発環境

- 開発環境は DevContainer を使うことを前提としている。
- Node.js / Claude Code / Codex / OpenSpec は mise（`mise.toml`）、pnpm は `package.json#packageManager` で版数を固定する。
- 依存パッケージは公開から7日以上経ったものだけを入れる（`minimumReleaseAge`）。npm/npx は使わず pnpm を使う。

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

公開リポジトリのため、秘密情報は `wrangler.jsonc` に書かず、`wrangler secret` かダッシュボードの Secrets で設定する。
