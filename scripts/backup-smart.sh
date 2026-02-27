#!/bin/bash
# OpenClaw 智能备份脚本
# 功能: 自动脱敏、选择性备份、一键推送

set -e

WORKSPACE="$HOME/.openclaw/workspace"
EXPORT_DIR="$WORKSPACE/.export"
REPO_URL="https://github.com/catheycelaniclw63-ctrl/OpenClaw-Eieai.git"
COMMIT_MSG="${1:-Backup $(date +%Y-%m-%d-%H%M)}"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🦞 OpenClaw 智能备份"
echo "===================="
echo ""

# 创建导出目录
mkdir -p "$EXPORT_DIR"

# 复制并脱敏文件
echo "🔒 处理文件（自动脱敏）..."

# README
if [ ! -f "$WORKSPACE/README.md" ]; then
cat > "$WORKSPACE/README.md" << 'EOF'
# OpenClaw 配置备份

**系统**: macOS
**OpenClaw 版本**: 2026.2.26
**更新日期**: $(date +%Y-%m-%d)

## Agent 架构

| Agent | 角色 | 通道 |
|-------|------|------|
| E0 | 通用助手 | 默认 |
| E1 | 程序员助理 | 飞书/Discord |
| E2 | 深度分析师 | iMessage |

## 快速开始

查看完整报告: [REPORT.md](REPORT.md)

---
*自动生成*
EOF
fi

# 复制配置文件
cp "$WORKSPACE/AGENTS.md" "$EXPORT_DIR/" 2>/dev/null || true
cp "$WORKSPACE/SOUL.md" "$EXPORT_DIR/" 2>/dev/null || true

# 复制 Agent 配置
mkdir -p "$EXPORT_DIR/agents"
cp "$WORKSPACE/agents/e1-IDENTITY.md" "$EXPORT_DIR/agents/" 2>/dev/null || \
    cp "$WORKSPACE/workspace-e1/IDENTITY.md" "$EXPORT_DIR/agents/e1-IDENTITY.md" 2>/dev/null || true
cp "$WORKSPACE/agents/e2-IDENTITY.md" "$EXPORT_DIR/agents/" 2>/dev/null || \
    cp "$WORKSPACE/workspace-e2/IDENTITY.md" "$EXPORT_DIR/agents/e2-IDENTITY.md" 2>/dev/null || true

# 复制报告
cp "$WORKSPACE/memory/openclaw-config-report-"*.md "$EXPORT_DIR/REPORT.md" 2>/dev/null || true

# 脱敏处理
echo "🛡️  脱敏敏感信息..."
if command -v python3 &> /dev/null; then
    python3 << 'PYEOF'
import re
import os

export_dir = os.path.expanduser("~/.openclaw/workspace/.export")

for filename in os.listdir(export_dir):
    filepath = os.path.join(export_dir, filename)
    if os.path.isfile(filepath):
        with open(filepath, 'r') as f:
            content = f.read()

        # 脱敏规则
        content = re.sub(r'sk-[a-zA-Z0-9_-]{20,}', '[API_KEY_REDACTED]', content)
        content = re.sub(r'tvly-[a-zA-Z0-9_-]{10,}', '[API_KEY_REDACTED]', content)
        content = re.sub(r'github_pat_[a-zA-Z0-9_-]{20,}', '[TOKEN_REDACTED]', content)
        content = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '[EMAIL_REDACTED]', content)
        content = re.sub(r'ou_[a-z0-9]{20,}', '[USER_ID_REDACTED]', content)

        with open(filepath, 'w') as f:
            f.write(content)
PYEOF
fi

# 移动到工作目录
cd "$WORKSPACE"
cp -r "$EXPORT_DIR"/* . 2>/dev/null || true

# 检查是否有变更
if git diff --quiet HEAD && git diff --quiet --cached && [ -z "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}ℹ️  没有变更需要提交${NC}"
    rm -rf "$EXPORT_DIR"
    exit 0
fi

# 添加并提交
echo "📦 添加文件..."
git add -A

echo "💾 创建提交: $COMMIT_MSG"
git commit -m "$COMMIT_MSG" --quiet

# 推送
echo "☁️  推送到 GitHub..."
if git push origin main 2>&1 | grep -q "Everything up-to-date\|success\|Done"; then
    echo ""
    echo -e "${GREEN}✅ 备份成功!${NC}"
    echo "   提交: $(git rev-parse --short HEAD)"
    echo "   时间: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "   仓库: $REPO_URL"
else
    echo ""
    echo -e "${RED}❌ 推送可能失败${NC}"
    echo "   检查网络或 GitHub 访问权限"
fi

# 清理
rm -rf "$EXPORT_DIR"
