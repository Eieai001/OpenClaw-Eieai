#!/bin/bash
# OpenClaw 配置一键备份到 GitHub
# 使用: backup-to-github.sh [提交信息]

set -e

REPO_URL="https://github.com/catheycelaniclw63-ctrl/OpenClaw-Eieai.git"
WORKSPACE="$HOME/.openclaw/workspace"
COMMIT_MSG="${1:-Auto backup $(date +%Y-%m-%d-%H%M)}"

echo "🦞 OpenClaw 配置备份"
echo "===================="
echo ""

# 检查是否有变更
cd "$WORKSPACE"
if git diff --quiet HEAD && git diff --quiet --cached; then
    echo "ℹ️  没有变更需要提交"
    exit 0
fi

# 添加所有变更
echo "📦 添加变更文件..."
git add -A

# 创建提交
echo "💾 创建提交: $COMMIT_MSG"
git commit -m "$COMMIT_MSG" --quiet

# 推送到 GitHub
echo "☁️  推送到 GitHub..."
if git push origin main 2>&1; then
    echo ""
    echo "✅ 备份成功!"
    echo "   提交: $(git rev-parse --short HEAD)"
    echo "   时间: $(date '+%Y-%m-%d %H:%M:%S')"
else
    echo ""
    echo "❌ 推送失败"
    echo "   可能需要首次手动输入 GitHub 用户名/密码"
    echo "   运行: cd $WORKSPACE && git push origin main"
    exit 1
fi
