#!/bin/bash
# Agent 记忆同步检测脚本
# 检测 MEMORY.md、规则文件变化，通知其他 Agent

set -e

# 配置
WORKSPACE="$HOME/.openclaw/workspace"
MEMORY_FILE="$WORKSPACE/MEMORY.md"
STATE_FILE="$WORKSPACE/.sync_state"
NOTIFICATION_FILE="$WORKSPACE/.sync_notification"
AGENTS=("main" "e1" "e2")

# 初始化状态文件
if [ ! -f "$STATE_FILE" ]; then
    echo '{}' > "$STATE_FILE"
fi

# 计算文件哈希
calculate_hash() {
    if [ -f "$1" ]; then
        openssl dgst -md5 "$1" 2>/dev/null | awk '{print $NF}'
    else
        echo "none"
    fi
}

# 获取当前 Agent（从环境变量或默认值）
CURRENT_AGENT="${OPENCLAW_AGENT:-main}"

# 创建通知
create_notification() {
    local changed_files="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    cat > "$NOTIFICATION_FILE" << EOF
{
  "timestamp": "$timestamp",
  "agent": "$CURRENT_AGENT",
  "changed_files": [$changed_files],
  "action_required": "reload_memory"
}
EOF
    
    echo "[$timestamp] 已创建同步通知: $changed_files"
}

# 检查文件变化
check_and_notify() {
    local file="$1"
    local filename=$(basename "$file")
    local current_hash=$(calculate_hash "$file")
    local stored_hash=$(jq -r ".[\"$filename\"] // \"none\"" "$STATE_FILE" 2>/dev/null || echo "none")
    
    if [ "$current_hash" != "$stored_hash" ]; then
        echo "检测到变化: $filename"
        
        # 更新状态
        jq ".[\"$filename\"] = \"$current_hash\"" "$STATE_FILE" > "${STATE_FILE}.tmp" 2>/dev/null || echo "{\"$filename\": \"$current_hash\"}" > "${STATE_FILE}.tmp"
        mv "${STATE_FILE}.tmp" "$STATE_FILE"
        
        return 0  # 有变化
    fi
    
    return 1  # 无变化
}

# 主逻辑
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Agent 记忆同步检查开始 (当前: $CURRENT_AGENT)"

CHANGED_FILES=""

# 检查关键文件
if check_and_notify "$MEMORY_FILE"; then
    CHANGED_FILES="\"MEMORY.md\""
fi

if check_and_notify "$WORKSPACE/SOUL.md"; then
    CHANGED_FILES="${CHANGED_FILES:+$CHANGED_FILES, }\"SOUL.md\""
fi

if check_and_notify "$WORKSPACE/USER.md"; then
    CHANGED_FILES="${CHANGED_FILES:+$CHANGED_FILES, }\"USER.md\""
fi

# 检查 memory 目录下的所有 md 文件
for file in "$WORKSPACE/memory"/*.md; do
    [ -e "$file" ] || continue
    filename=$(basename "$file")
    if check_and_notify "$file"; then
        CHANGED_FILES="${CHANGED_FILES:+$CHANGED_FILES, }\"$filename\""
    fi
done

# 更新最后检查时间
jq ".last_check = \"$(date -Iseconds)\"" "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"

# 如果有变化，创建通知
if [ -n "$CHANGED_FILES" ]; then
    create_notification "$CHANGED_FILES"
    echo "[$CURRENT_AGENT] 记忆/规则已更新，其他 Agent 请注意重新加载"
else
    echo "无变化"
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 检查完成"
