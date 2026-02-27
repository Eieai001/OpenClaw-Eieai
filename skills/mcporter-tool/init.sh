#!/bin/bash
# MCP Auto-Loader for OpenClaw

echo "Checking MCP servers..."

# 检查并启动 mcporter daemon
mcporter daemon status >/dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "Starting MCP daemon..."
    mcporter daemon start 2>/dev/null || true
fi

# 列出可用服务器
mcporter list
