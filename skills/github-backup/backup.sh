#!/bin/bash
# GitHub Backup Skill - 执行脚本

cd "$HOME/.openclaw/workspace"

# 执行备份
exec scripts/backup-smart.sh "${1:-Auto backup via OpenClaw Skill}"
