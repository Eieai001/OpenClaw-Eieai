#!/bin/bash
# Agent Memory Sync Check Script
# 验证所有 Agents 是否已同步共享记忆

echo "=== OpenClaw Agent Memory Sync Check ==="
echo ""

# 检查共享 AGENTS.md
SHARED_AGENTS="$HOME/.openclaw/workspace/AGENTS.md"
if grep -q "Sync Shared Memory" "$SHARED_AGENTS" 2>/dev/null; then
    echo "✅ 共享 AGENTS.md 已包含记忆同步规则"
else
    echo "❌ 共享 AGENTS.md 缺少记忆同步规则"
fi

# 检查各 Agent 的 AGENTS.md
for agent in workspace-e1 workspace-e2; do
    AGENTS_FILE="$HOME/.openclaw/$agent/AGENTS.md"
    if [ -f "$AGENTS_FILE" ]; then
        if grep -q "Sync Shared Memory" "$AGENTS_FILE" 2>/dev/null; then
            echo "✅ $agent/AGENTS.md 已包含记忆同步规则"
        else
            echo "❌ $agent/AGENTS.md 缺少记忆同步规则"
        fi
    else
        echo "⚠️ $agent/AGENTS.md 不存在"
    fi
done

echo ""
echo "=== Shared MEMORY.md 关键规则 ==="
grep "^##" "$HOME/.openclaw/workspace/MEMORY.md" | head -10

echo ""
echo "=== 多 Agent 分层响应架构技能 ==="
if [ -f "$HOME/.openclaw/workspace/skills/multi-agent-architecture/SKILL.md" ]; then
    echo "✅ 技能文件存在"
    head -20 "$HOME/.openclaw/workspace/skills/multi-agent-architecture/SKILL.md"
else
    echo "⚠️ 技能文件不存在"
fi
