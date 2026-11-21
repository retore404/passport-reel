FROM mcr.microsoft.com/devcontainers/base:noble@sha256:88171bb581e19bbb45db77a16a3a5475e2f9ddce025b044c2e5a69a6a1e24fa1

# 開発CLIはイメージに含め、コンテナ再作成時にも利用できるようにする。
USER root
RUN apt-get update \
    && apt-get install --no-install-recommends -y ripgrep jq ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*
USER vscode
