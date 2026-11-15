FROM mcr.microsoft.com/devcontainers/base:noble@sha256:48be4adec1c1ecbe030064700aef85382f5205786a8f82937fc44a7473717eae

# 開発CLIはイメージに含め、コンテナ再作成時にも利用できるようにする。
USER root
RUN apt-get update \
    && apt-get install --no-install-recommends -y ripgrep jq ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*
USER vscode
