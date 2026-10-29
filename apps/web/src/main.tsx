import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { VideoExportSpike } from "./spike/VideoExportSpike";
import "./index.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("#root が見つからない");
}

// spike ブランチでは検証ページを既定にし、?app で通常のアプリを表示する
const showApp = new URLSearchParams(window.location.search).has("app");

createRoot(rootElement).render(<StrictMode>{showApp ? <App /> : <VideoExportSpike />}</StrictMode>);
