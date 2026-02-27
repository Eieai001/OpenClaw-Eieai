---
name: mac-automation
description: Mac 电脑完整控制技能。包含应用控制、文件操作、系统设置、自动化脚本执行。
---

# Mac 自动化技能

## 可用工具

### 1. 命令行 (exec)
```bash
# 文件操作
ls, cd, mkdir, rm, cp, mv, cat, echo

# 系统信息
df -h, top, ps aux, uname -a

# 应用管理
open -a <AppName>  # 打开应用
killall <AppName>  # 关闭应用
```

### 2. AppleScript (osascript)
```bash
# 打开应用
osascript -e 'tell application "Notes" to activate'

# 获取运行中的应用
osascript -e 'tell application "System Events" to get name of every process whose background only is false'

# 发送按键
osascript -e 'tell application "System Events" to keystroke "hello"'

# 点击菜单
osascript -e 'tell application "System Events" to tell process "Finder" to click menu item "About Finder" of menu 1 of menu bar item "Finder" of menu bar 1'
```

### 3. Shortcuts (shortcuts CLI)
```bash
shortcuts list              # 列出所有快捷指令
shortcuts run <name>       # 运行快捷指令
```

### 4. 系统命令
```bash
# 屏幕截图
screencapture -x screen.png

# 剪贴板
pbpaste, pbcopy

# 音量控制
osascript -e 'set volume 5'
```

## 常用场景

### 打开并操作应用
```bash
open -a Safari
osascript -e 'tell application "Safari" to activate'
```

### 获取系统信息
```bash
# CPU/内存
vm_stat

# 电池
pmset -g batt

# 屏幕分辨率
```

### 自动化工作流
```bash
# 定时任务
crontab -e

# 监听文件变化
fswatch
```

## 测试命令

1. 打开应用：`open -a Notes`
2. 获取运行进程：`osascript -e 'tell application "System Events" to get name of every process'`
3. 系统版本：`sw_vers`
4. 电池状态：`pmset -g batt`
5. 音量控制：`osascript -e 'set volume output volume 50'`

---

## 进阶操作

### 窗口管理
```bash
# 获取窗口位置
osascript -e 'tell application "Finder" to get position of front window'
# 结果: {x, y}

# 获取窗口大小
osascript -e 'tell application "Finder" to get size of front window'

# 移动窗口
osascript -e 'tell application "Finder" to set position of front window to {100, 100}'

# 获取窗口名称
osascript -e 'tell application "Safari" to name of front window'
```

### 应用控制
```bash
# 退出应用
osascript -e 'tell application "Safari" to quit'

# 获取应用窗口列表
osascript -e 'tell application "Safari" to windows'

# 激活应用
osascript -e 'tell application "Safari" to activate'
```

### 键盘快捷键
```bash
# 新建窗口 (Command+N)
osascript -e 'tell application "Finder" to activate'
osascript -e 'tell application "System Events" to tell process "Finder" to keystroke "n" using command down'

# 复制/粘贴
osascript -e 'tell application "System Events" to keystroke "c" using command down'
osascript -e 'tell application "System Events" to keystroke "v" using command down'
```

### Safari/浏览器控制
```bash
# 获取当前 URL
osascript -e 'tell application "Safari" to get URL of front document'

# 打开网页
osascript -e 'tell application "Safari" to open location "https://example.com"'

# 新建标签页
osascript -e 'tell application "Safari" to tell window 1 to create new document with properties {URL:"https://google.com"}'
```

### 通知
```bash
# 发送通知
osascript -e 'display notification "Hello" with title "Test"'

# 显示对话框
osascript -e 'display dialog "Continue?" buttons {"Yes", "No"} default button "Yes"'
```

### 文件操作
```bash
# 打开文件
open ~/Desktop/test.png

# 打开文件夹
open ~/Desktop

# 用 Finder 选择文件
osascript -e 'tell application "Finder" to select POSIX file "/Users/eieai/Desktop"'
```

## 权限要求

部分操作需要开启辅助功能权限：
- 系统设置 → 隐私与安全性 → 辅助功能 → 添加 OpenClaw/Terminal
