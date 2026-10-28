FROM mcr.microsoft.com/devcontainers/base:noble

# 開発CLIはイメージに含め、コンテナ再作成時にも利用できるようにする。
USER root
RUN apt-get update \
    && apt-get install --no-install-recommends -y ripgrep jq ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*
USER vscode
