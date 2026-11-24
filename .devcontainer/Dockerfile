FROM mcr.microsoft.com/devcontainers/base:noble@sha256:88171bb581e19bbb45db77a16a3a5475e2f9ddce025b044c2e5a69a6a1e24fa1

# 開発CLIはイメージに含め、コンテナ再作成時にも利用できるようにする。
USER root
RUN apt-get update \
    && apt-get install --no-install-recommends -y ripgrep jq ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*
# Chrome DevTools MCPが起動するchrome-headless-shellの共有ライブラリと、日本語を描画するフォント
RUN apt-get update \
    && apt-get install --no-install-recommends -y \
        libnspr4 libnss3 libatk1.0-0t64 libatk-bridge2.0-0t64 libatspi2.0-0t64 libdbus-1-3 \
        libx11-6 libxcb1 libxcomposite1 libxdamage1 libxext6 libxfixes3 libxrandr2 libxkbcommon0 \
        libgbm1 libasound2t64 fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*
USER vscode
