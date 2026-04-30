#!/usr/bin/env bash
# macOS 启动器：双击运行
# Finder 双击不会自动加载 shell 配置，这里手动注入 PATH。

# 切换到项目根目录（脚本所在目录的上一级）
cd "$(dirname "$0")/.." || exit 1
PROJECT_DIR="$(pwd)"

echo "================================"
echo "  构网卫士 · 开发服务器"
echo "================================"
echo "项目目录: $PROJECT_DIR"
echo ""

# ---- 注入常见 Node 安装路径 ----
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

# 加载 nvm（如已安装）
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1090
  . "$NVM_DIR/nvm.sh"
fi

# 加载 zshrc/bash_profile 中可能的 PATH 配置（容错）
if [ -f "$HOME/.zshrc" ]; then
  # 仅以非交互方式 source，忽略报错
  # shellcheck disable=SC1090
  source "$HOME/.zshrc" >/dev/null 2>&1 || true
fi

# ---- 检查 Node ----
if ! command -v node >/dev/null 2>&1; then
  echo "❌ 未检测到 Node.js"
  echo ""
  echo "请安装 Node.js 18+："
  echo "  方式 1（推荐）: brew install node"
  echo "  方式 2: https://nodejs.org/"
  echo ""
  echo "当前 PATH: $PATH"
  echo ""
  read -n 1 -s -r -p "按任意键退出..."
  exit 1
fi

echo "✅ Node 版本: $(node -v)"
echo "✅ npm 版本: $(npm -v)"
echo ""

# ---- 安装依赖（首次运行 或 package.json 比 node_modules 新时）----
NEED_INSTALL=0
if [ ! -d "node_modules" ]; then
  NEED_INSTALL=1
elif [ "package.json" -nt "node_modules" ]; then
  NEED_INSTALL=1
  echo "📦 检测到 package.json 已更新，重新安装依赖..."
fi
if [ "$NEED_INSTALL" = "1" ]; then
  [ ! -d "node_modules" ] && echo "📦 首次运行，正在安装依赖（使用淘宝镜像）..."
  if ! npm install --registry=https://registry.npmmirror.com; then
    echo ""
    echo "❌ 依赖安装失败"
    read -n 1 -s -r -p "按任意键退出..."
    exit 1
  fi
fi

# ---- 启动 ----
echo ""
echo "🚀 启动开发服务器..."
echo "   关闭终端窗口可停止服务"
echo ""
npm run dev

# 出错时也保留窗口
echo ""
read -n 1 -s -r -p "服务已结束，按任意键关闭..."
