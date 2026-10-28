# passport-reel
訪れたことのある国を時系列で可視化して動画にする

# 開発環境

- 開発環境は DevContainer を使うことを前提としている。
- Node.js / Claude Code / Codex / OpenSpec は mise（`mise.toml`）、pnpm は `package.json#packageManager` で版数を固定する。
- 依存パッケージは公開から7日以上経ったものだけを入れる（`minimumReleaseAge`）。npm/npx は使わず pnpm を使う。

## 構成

| パス | 内容 |
| --- | --- |
| `openspec/` | 仕様と変更提案（OpenSpec） |
| `.agents/skills/` | コーディングエージェント用 skills（`.claude/skills` から symlink） |

## コマンド

```
pnpm install
pnpm check   # lint + format:check + typecheck + knip + test
pnpm fix     # lint:fix + format
```
