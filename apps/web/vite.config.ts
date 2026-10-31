import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    // 同梱した依存パッケージ（MIT / ISC / MPL-2.0 など）は著作権表示と許諾文を配布物に含めることを求めるが、
    // ミニファイでソース中のライセンスコメントが消えるため、Vite にライセンス一覧を書き出させて一緒に配信する。
    // アプリのライセンスのシート（src/licenses/LicenseSheet.tsx）がこの JSON を読み込んで表示する。
    // 既定の .vite/license.md はドットで始まるディレクトリに置かれるため、配信ルート直下に置く。
    license: { fileName: "third-party-licenses.json" },
  },
});
