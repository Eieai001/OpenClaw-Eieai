# GitHub 配置备份 Skill

## 描述

一键将 OpenClaw 配置备份到 GitHub，自动脱敏处理。

## 触发方式

用户说以下任意一种：
- "备份配置到 GitHub"
- "上传配置到 GitHub"
- "备份 OpenClaw"
- "github backup"

## 执行流程

1. **检查凭证**
   - 检查 Git 是否配置了 credential.helper
   - 如果没有，提示用户先运行一次手动推送

2. **自动脱敏**
   - 扫描所有要备份的文件
   - 自动替换 API Keys、Token、邮箱等敏感信息

3. **提交并推送**
   - 添加所有变更
   - 创建提交（带时间戳）
   - 推送到 GitHub

4. **返回结果**
   - 成功：显示提交哈希和时间
   - 失败：显示错误原因

## 使用方法

### 首次使用（必须）

第一次使用时需要手动输入 GitHub 密码：

```bash
cd ~/.openclaw/workspace
git push origin main
# 提示输入用户名/密码时输入
# 密码会被自动保存到钥匙串
```

### 之后使用

直接说：
```
备份配置到 GitHub
```

或者运行：
```bash
~/.openclaw/workspace/scripts/backup-smart.sh
```

## 技术细节

- **存储位置**: macOS 钥匙串 (Keychain)
- **脱敏方式**: Python 正则表达式替换
- **自动提交信息**: `Backup YYYY-MM-DD-HHMM`

## 文件清单

备份包含：
- `README.md` - 项目说明
- `AGENTS.md` - 共享规则
- `agents/` - Agent 身份配置（已脱敏）
- `REPORT.md` - 完整配置报告（已脱敏）

## 安全说明

✅ 安全做法：
- 密码存储在系统钥匙串
- 所有敏感信息自动脱敏
- API Keys 替换为 `[API_KEY_REDACTED]`

❌ 不会上传：
- 原始 API Keys
- 访问令牌
- 个人邮箱地址
- 任何私密配置

---

*Skill Version: 1.0*
