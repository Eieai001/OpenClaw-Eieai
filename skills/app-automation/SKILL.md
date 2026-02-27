---
name: app-automation
description: macOS 应用程序自动化控制，支持启动、操作、窗口管理。自动化日常应用操作，提高工作效率。
metadata:
  openclaw:
    emoji: 🚀
    requires:
      bins: [osascript]
      os: [darwin]
    capabilities:
      - app_launch
      - app_control
      - window_management
      - menu_automation
---

# 应用自动化 Skill

## 功能概述

提供 macOS 应用程序的自动化控制能力：
- 启动和退出应用程序
- 控制应用窗口（大小、位置、焦点）
- 执行菜单命令
- 自动化应用内操作
- 多应用工作流编排

## 使用场景

- 自动启动工作应用
- 窗口布局管理
- 批量处理文件
- 自动化测试
- 定时任务执行

## 工具声明

tools: Bash, Read

## 工作流程

### 1. 应用启动

**功能**: 启动应用程序

**输入**:
- `app_name`: 应用名称或 Bundle ID
- `args`: 启动参数（可选）
- `wait`: 等待应用完全启动（可选）

**示例**:
```applescript
-- 启动应用
tell application "Safari" to activate

-- 启动并等待
tell application "Visual Studio Code"
    activate
    delay 2
end tell

-- 使用 open 命令
open -a "Safari" "https://example.com"
```

### 2. 应用退出

**功能**: 退出应用程序

**输入**:
- `app_name`: 应用名称
- `force`: 强制退出（可选）
- `save`: 保存未保存的更改（可选）

**示例**:
```applescript
-- 正常退出
tell application "Safari" to quit

-- 强制退出
do shell script "pkill -9 Safari"

-- 退出前保存
tell application "TextEdit"
    save front document
    quit
end tell
```

### 3. 窗口管理

**功能**: 管理应用窗口

**输入**:
- `action`: 操作类型 (`resize`, `move`, `minimize`, `maximize`, `close`)
- `window`: 窗口索引或名称
- `bounds`: 窗口位置和大小

**示例**:
```applescript
-- 设置窗口大小和位置
tell application "System Events"
    tell process "Safari"
        set position of window 1 to {100, 100}
        set size of window 1 to {1200, 800}
    end tell
end tell

-- 最小化窗口
tell application "System Events"
    tell process "Safari"
        click button 2 of window 1
    end tell
end tell

-- 最大化窗口
tell application "System Events"
    tell process "Safari"
        click button 3 of window 1
    end tell
end tell
```

### 4. 菜单操作

**功能**: 执行应用菜单命令

**输入**:
- `menu`: 菜单名称
- `item`: 菜单项名称
- `shortcut`: 快捷键（可选）

**示例**:
```applescript
-- 点击菜单项
tell application "System Events"
    tell process "Safari"
        click menu item "New Window" of menu "File" of menu bar 1
    end tell
end tell

-- 使用快捷键
tell application "System Events"
    keystroke "n" using command down
end tell
```

### 5. 获取应用信息

**功能**: 获取运行中的应用信息

**示例**:
```applescript
-- 获取所有运行中的应用
tell application "System Events"
    set appList to name of every application process
end tell

-- 获取特定应用的窗口列表
tell application "System Events"
    tell process "Safari"
        set windowList to name of every window
    end tell
end tell

-- 检查应用是否运行
on isAppRunning(appName)
    tell application "System Events"
        return (name of processes) contains appName
    end tell
end isAppRunning
```

### 6. 多应用工作流

**功能**: 编排多个应用的自动化流程

**示例**:
```applescript
-- 开发工作流
on startDevWorkflow()
    -- 启动 VS Code
    tell application "Visual Studio Code" to activate
    delay 2
    
    -- 启动终端
    tell application "Terminal"
        activate
        do script "cd ~/Projects/myapp && npm start"
    end tell
    
    -- 启动浏览器
    tell application "Safari"
        activate
        set URL of front document to "http://localhost:3000"
    end tell
    
    -- 排列窗口
    tell application "System Events"
        tell process "Code"
            set position of window 1 to {0, 25}
            set size of window 1 to {960, 1100}
        end tell
        tell process "Terminal"
            set position of window 1 to {960, 25}
            set size of window 1 to {960, 550}
        end tell
        tell process "Safari"
            set position of window 1 to {960, 575}
            set size of window 1 to {960, 550}
        end tell
    end tell
end startDevWorkflow
```

## 输出格式

```json
{
  "success": true,
  "operation": "app_automation",
  "app": "Safari",
  "action": "launch",
  "details": {
    "pid": 12345,
    "window_count": 2,
    "frontmost": true
  },
  "timestamp": "2026-02-24T10:30:00Z"
}
```

## 安全护栏

### 应用白名单
- 只允许操作常见应用
- 禁止操作系统应用
- 禁止操作安全软件

### 敏感操作确认
- 退出应用前确认未保存更改
- 执行破坏性操作前确认
- 访问敏感数据前确认

### 权限检查
- 检查应用是否有辅助功能权限
- 验证用户有权限操作目标应用
- 防止未授权的系统修改

## 预设工作流

### 开发工作流
```yaml
workflow_dev:
  apps:
    - name: "Visual Studio Code"
      position: { x: 0, y: 25, width: 1200, height: 1100 }
    - name: "Terminal"
      position: { x: 1200, y: 25, width: 720, height: 550 }
      script: "cd ~/Projects && clear"
    - name: "Safari"
      position: { x: 1200, y: 575, width: 720, height: 550 }
      url: "http://localhost:3000"
```

### 写作工作流
```yaml
workflow_writing:
  apps:
    - name: "Notion"
      position: { x: 0, y: 25, width: 960, height: 1100 }
    - name: "Safari"
      position: { x: 960, y: 25, width: 960, height: 550 }
      url: "https://www.notion.so"
    - name: "Music"
      position: { x: 960, y: 575, width: 480, height: 550 }
```

### 会议工作流
```yaml
workflow_meeting:
  apps:
    - name: "zoom.us"
      position: { x: 0, y: 25, width: 1200, height: 800 }
    - name: "Notes"
      position: { x: 1200, y: 25, width: 720, height: 550 }
    - name: "Safari"
      position: { x: 1200, y: 575, width: 720, height: 550 }
```

## 使用示例

### 示例 1: 启动开发环境
用户: "启动我的开发环境"
助手:
1. 启动 VS Code
2. 启动终端并运行项目
3. 启动浏览器
4. 排列窗口布局

### 示例 2: 关闭所有应用
用户: "关闭所有非必要应用"
助手:
1. 获取所有运行中的应用
2. 过滤系统应用和白名单应用
3. 逐个关闭其他应用
4. 确认保存未保存的更改

### 示例 3: 窗口布局
用户: "把 Safari 窗口放到左边，VS Code 放到右边"
助手:
1. 获取屏幕尺寸
2. 计算左右分屏位置
3. 移动 Safari 窗口
4. 移动 VS Code 窗口

## 性能优化

- 使用延迟确保应用响应
- 批量操作减少 AppleScript 调用
- 缓存应用状态信息
- 异步执行非关键操作

## 故障排查

### 应用无法启动
- 检查应用是否安装
- 验证应用名称正确
- 检查系统权限

### 窗口操作失败
- 确保应用有辅助功能权限
- 检查窗口是否存在
- 验证坐标在有效范围

### 菜单操作失败
- 检查菜单项名称正确
- 确保菜单可用
- 使用英文菜单名称
