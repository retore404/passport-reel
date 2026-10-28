#!/bin/bash
set -euo pipefail

append_once() {
  local line="$1"
  local file="$2"

  touch "$file"
  grep -Fqx "$line" "$file" || echo "$line" >> "$file"
}

# Safe Chain導入
echo "BEGIN: Safe Chain Install"
curl -fsSL https://github.com/AikidoSec/safe-chain/releases/latest/download/install-safe-chain.sh | sh
echo "END: Safe Chain Install"

# mise導入
echo "BEGIN: mise setup"
curl -fsSL https://mise.run | sh
export PATH="$HOME/.local/bin:$PATH"
mise settings set auto_update true
append_once 'export PATH="$HOME/.local/bin:$PATH"' "$HOME/.bashrc"
append_once 'eval "$(mise activate bash)"' "$HOME/.bashrc"
eval "$(mise activate bash)"
mise install node
# postCreateCommandの非対話シェル内で、直後のnode/npmがmise管理のNode.jsを解決できるようにする
eval "$(mise hook-env)"
echo "END: mise setup"

# pnpm導入
echo "BEGIN: pnpm setup"
PNPM_VERSION="$(node -p "require('./package.json').packageManager.split('@')[1].split('+')[0]")"
export PNPM_HOME="$HOME/.local/share/pnpm"
export PATH="$PNPM_HOME/bin:$PATH"
curl -fsSL https://get.pnpm.io/install.sh | env PNPM_VERSION="$PNPM_VERSION" PNPM_HOME="$PNPM_HOME" SHELL=/bin/bash sh -
test "$(command -v pnpm)" = "$PNPM_HOME/bin/pnpm"
test "$(pnpm --version)" = "$PNPM_VERSION"
echo "END: pnpm setup"

# Claude Code / Codex 導入
echo "BEGIN: mise project tools setup"
mise install
echo "END: mise project tools setup"

# グローバルでmin-release-age/minimumReleaseAgeを設定する
echo "BEGIN: pnpm and npm global config setup"
pnpm config set --location=global minimumReleaseAge 10080
npm config set --location=global min-release-age 7
echo "END: pnpm and npm global config setup"

# npm/npxの使用を封印する
echo "BEGIN: npm/npx guard setup"
append_once "alias npm='echo \"このワークスペースではパッケージマネージャにpnpmを使用しています．npm/npxの使用は禁止です．\" && false'" "$HOME/.bashrc"
append_once "alias npx='echo \"このワークスペースではパッケージマネージャにpnpmを使用しています．npm/npxの使用は禁止です．\" && false'" "$HOME/.bashrc"
echo "END: npm/npx guard setup"

# Git設定
echo "BEGIN: Git setup"
git config --local --bool push.autoSetupRemote true
git config --local rerere.enabled true
git config --local remote.pushDefault origin
gh extension install github/gh-stack --force
echo "END: Git setup"

# Codex設定・セッション情報
echo "BEGIN: Codex config setup"
# ホストと同期したCodexディレクトリをvscodeで読み書きできるようにする
if [ -d /home/vscode/.codex ]; then
  sudo chown -R vscode:vscode /home/vscode/.codex
fi
echo "END: Codex config setup"

echo "Setup completed successfully!"
