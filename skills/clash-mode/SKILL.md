---
name: clash-mode
description: 控制 ClashX/Clash.Meta 代理模式切换，包括全局/规则/直连模式。用于需要开启/关闭代理的场景。
metadata:
  openclaw:
    emoji: 🌐
    requires:
      bins: [curl]
      os: [darwin, linux]
    capabilities:
      - proxy_control
      - mode_switch
---

# Clash Mode Switcher

控制 ClashX/Clash.Meta 代理模式切换。

## 功能概述

- 切换代理模式（全局/规则/直连）
- 获取当前代理状态
- 通过 API 或配置文件控制

## 代理模式

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| `global` | 所有流量走代理 | 需要全部翻墙 |
| `rule` | 按规则分流（默认） | 智能分流 |
| `direct` | 直连，不走代理 | 国内网站 |

## 控制方法

### 方法 1: API（推荐）

```bash
# 切换到全局模式
curl -X PUT "http://127.0.0.1:7890/configs" \
  -H "Content-Type: application/json" \
  -d '{"mode":"global"}'

# 切换到规则模式
curl -X PUT "http://127.0.0.1:7890/configs" \
  -H "Content-Type: application/json" \
  -d '{"mode":"rule"}'

# 切换到直连模式
curl -X PUT "http://127.0.0.1:7890/configs" \
  -H "Content-Type: application/json" \
  -d '{"mode":"direct"}'

# 获取当前配置
curl -s "http://127.0.0.1:7890/configs" | jq .mode
```

### 方法 2: 配置文件

```bash
# 编辑配置文件
vim ~/.config/clash.meta/config.yaml

# 修改 mode 字段
mode: global  # 或 rule, direct

# 重新加载配置（方法一：点击菜单）
# 菜单: 配置 → 重载配置文件

# 重新加载配置（方法二：重启应用）
osascript -e 'quit app "ClashX Meta"'
open -a "ClashX Meta"
```

## 常用端口

| 软件 | HTTP 端口 | SOCKS5 端口 |
|------|-----------|-------------|
| ClashX Meta | 7890 | 7891 |
| Clash for Windows | 7890 | 7891 |
| Surge | 6174 | 6175 |

## 使用示例

### 示例 1: 开启全局代理
用户: "开启代理"
助手: 执行 API 切换到 global 模式

### 示例 2: 关闭代理
用户: "关闭代理"
助手: 执行 API 切换到 direct 模式

### 示例 3: 查看当前状态
用户: "现在是什么模式"
助手: curl API 获取当前模式

## 规则说明

### 规则类型
- `DOMAIN-SUFFIX` - 域名后缀
- `DOMAIN-KEYWORD` - 域名关键词
- `DOMAIN` - 完整域名
- `GEOIP` - IP 地理位置
- `MATCH` - 匹配所有（兜底）

### 规则动作
- `DIRECT` - 直连
- `REJECT` - 拒绝
- `PROXY` - 走代理

### 示例规则
```yaml
rules:
  # 百度直连
  - DOMAIN-SUFFIX,baidu.com,DIRECT
  # Google 关键词走代理
  - DOMAIN-KEYWORD,google,PROXY
  # 国内 IP 直连
  - GEOIP,CN,DIRECT
  # 其他走代理
  - MATCH,PROXY
```

## 错误处理

- API 连接失败：检查 ClashX 是否运行，端口是否正确
- 模式切换无效：尝试重启 ClashX
- 配置文件语法错误：检查 YAML 格式

## 相关文件位置

- macOS: `~/.config/clash.meta/config.yaml`
- Linux: `~/.config/clash.meta/config.yaml`
- 日志: `~/.clash.log`
