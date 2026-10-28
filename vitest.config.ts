import { defineConfig } from "vitest/config";

// ワークスペースパッケージを追加したら test.projects に列挙し、ルートの `pnpm test` からまとめて実行する。
export default defineConfig({
  test: {
    passWithNoTests: true,
  },
});
