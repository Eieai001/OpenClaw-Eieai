---
name: macos-control
description: 控制 macOS 界面，包括截图、鼠标移动、点击、键盘输入。用于自动化 macOS 操作和界面交互。
metadata:
  openclaw:
    emoji: 🖥️
    requires:
      bins: [screencapture, cliclick, osascript]
      os: [darwin]
    capabilities:
      - screenshot_capture
      - mouse_control
      - keyboard_input
      - ui_automation
---

# macOS 控制 Skill

## 功能概述

此 Skill 提供对 macOS 界面的完整控制能力，包括：
- 屏幕截图和区域截图
- 鼠标移动和点击
- 键盘输入和快捷键
- 应用程序 UI 自动化

## 使用场景

- 自动化重复性的 UI 操作
- 创建操作教程和文档
- 远程协助和故障排查
- 批量处理任务

## 工具声明

tools: Bash, Read, Write

## 工作流程

### 1. 截图

**功能**: 捕获屏幕或指定区域

**输入**:
- `type`: 截图类型 (`fullscreen`, `window`, `selection`, `clipboard`)
- `output`: 输出文件路径（可选，默认保存到剪贴板）
- `delay`: 延迟秒数（可选，默认 0）

**示例**:
```bash
# 全屏截图
screencapture -x ~/screenshot.png

# 选择区域截图
screencapture -i ~/screenshot.png

# 截图到剪贴板
screencapture -c
```

### 2. 鼠标控制

**功能**: 移动鼠标和执行点击

**输入**:
- `action`: 操作类型 (`move`, `click`, `doubleclick`, `rightclick`, `drag`)
- `x`, `y`: 坐标位置
- `duration`: 移动持续时间（可选）

**示例**:
```bash
# 移动鼠标到指定位置
cliclick m:500,400

# 左键点击
cliclick c:500,400

# 双击
cliclick dc:500,400

# 右键点击
cliclick rc:500,400
```

### 3. 键盘输入

**功能**: 模拟键盘输入

**输入**:
- `text`: 要输入的文本
- `key`: 特殊按键（如 `return`, `escape`, `tab`）
- `modifier`: 修饰键（如 `cmd`, `shift`, `option`, `control`）

**示例**:
```bash
# 输入文本
cliclick t:"Hello World"

# 按下快捷键
cliclick kd:cmd,v  # Cmd+V

# 按下回车键
cliclick kp:return
```

### 4. 获取屏幕信息

**功能**: 获取屏幕分辨率和可用区域

**示例**:
```bash
# 获取主屏幕分辨率
system_profiler SPDisplaysDataType | grep Resolution

# 获取所有屏幕信息
osascript -e 'tell application "System Events" to get bounds of every desktop'
```

## 输出格式

所有操作返回 JSON 格式的结果：

```json
{
  "success": true,
  "operation": "screenshot",
  "details": {
    "file": "/path/to/screenshot.png",
    "dimensions": "1920x1080"
  },
  "timestamp": "2026-02-24T10:30:00Z"
}
```

## 安全护栏

### 禁止的操作
- 直接操作系统设置
- 访问钥匙串或敏感数据
- 执行需要管理员权限的操作
- 修改系统文件

### 需要确认的操作
- 在敏感区域点击（如系统偏好设置）
- 输入密码或敏感信息
- 删除或修改重要文件
- 执行可能影响系统稳定性的操作

### 坐标安全范围
- 确保坐标在屏幕范围内
- 避免点击菜单栏和 Dock 的敏感区域
- 操作前验证目标位置

## 错误处理

- 如果命令失败，返回详细的错误信息
- 截图失败时检查磁盘空间
- 鼠标操作失败时验证坐标有效性
- 键盘输入失败时检查焦点窗口

## 依赖安装

```bash
# 安装 cliclick（鼠标控制工具）
brew install cliclick

# 验证安装
cliclick --version
```

## 使用示例

### 示例 1: 截图并保存
用户: "帮我截图并保存到桌面"
助手: 执行全屏截图并保存到 ~/Desktop/screenshot_$(date +%Y%m%d_%H%M%S).png

### 示例 2: 自动点击
用户: "点击屏幕中央"
助手: 
1. 获取屏幕分辨率
2. 计算中央坐标
3. 执行点击操作

### 示例 3: 输入文本
用户: "在搜索框输入 'OpenClaw'"
助手:
1. 点击搜索框位置
2. 输入文本 "OpenClaw"
3. 按下回车键

## 性能优化

- 批量操作时添加适当延迟
- 使用相对坐标而非绝对坐标
- 优先使用 AppleScript 进行应用内自动化
- 缓存屏幕尺寸信息

## 故障排查

### 截图失败
- 检查磁盘空间
- 验证输出路径权限
- 确保没有阻止截图的安全软件

### 鼠标控制失败
- 验证 cliclick 已安装
- 检查辅助功能权限
- 确认坐标在有效范围内

### 键盘输入失败
- 确保目标应用有焦点
- 检查输入法状态
- 验证特殊按键名称正确
