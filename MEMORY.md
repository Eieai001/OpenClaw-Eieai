# MEMORY.md - 关于 Eieai

_长期重要记忆，持续更新_

---

## 核心信息

- **时区**: GMT+8
- **主要沟通渠道**: 飞书

## 重要偏好

- **当问题莫名其妙时**：首先查找记忆库（memory/）+ 当前任务 + 上下文，不要直接反问用户
- **查询类任务**：查到时可以先报告，但不要停止，继续查完所有相关内容
- **联网搜索规则（代号：搜索/ss）**：
  - **被动触发条件**：当我尝试查询本地原因未解决问题时（如工具执行失败、配置错误、信息缺失）
  - **触发方式**：用户明确说"搜索"或"ss"
  - **执行方式**：后台开启三个任务（Tavily 直接API、MiniMax MCP、fetch MCP），逐一返回结果后总结对比
- **记忆管理原则（代号系统）**：
  - **规则 = gz** → 日常需要即时执行的规则
  - **加库 = ➕ = jk** → 需要判断何时执行，侧重长期记忆
  - **记忆 = jy** → 重要而不紧急的长期记忆
  - **发布 = fb** → 执行发布到 EvoMap，整理需要发布的内容，适配 Agent 方便读取的语言
  - 用户标记的重要内容 → 永久记住
  - 自动判断重要 → 保留并持续更新
  - 不确定时 → 先问用户
  - 临时/一次性内容 → 自动清理
- **gz - 多Agent分层响应架构（子Agent池模式）**：
  - **架构**：3个主Agent（E0/E1/E2）负责对话，各自管理n个子Agent池
  - **响应策略**：主Agent判断能否2秒内回复，能则立即回复；不能则分配给子Agent
  - **子Agent管理**：按需创建/终止，资源受限，执行完成后主Agent汇总回复
  - **目标**：保证对话流畅性，耗时任务后台处理
- **gz - Agent记忆同步规则**：
  - **范围**：E0、E1、E2 三个Agent共用 MEMORY.md、规则文件、配置
  - **触发条件**：任一Agent检测到记忆/规则/配置更新
  - **同步动作**：立即通知其他两个Agent重新加载记忆
  - **方式**：通过消息广播或文件监听机制实现
- **不喜欢**: 不重要的一次性信息堆积（如更新日志）
- **喜欢**: 简洁、重点突出的回复

## 已安装 Skills

- **mcporter**: CLI 0.7.3，已安装并配置完成
- **Tavily MCP**: 网络搜索工具
  - API Key: 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
  - URL: https://mcp.tavily.com/mcp/
- **clash-mode**: 切换 ClashX 代理模式
  - API: curl -X PUT http://127.0.0.1:7890/configs -d mode=global
- **macos-control**: macOS 截图、鼠标、键盘控制
- **file-manager**: 文件搜索、批量重命名
- **app-automation**: 应用启动/退出、窗口管理
- **code-assistant**: 代码生成、重构、审查
- **system-monitor**: CPU/内存/磁盘监控

## 常用命令

- 截图: `screencapture -x ~/screenshot.png`
- 鼠标控制: `cliclick c:500,400` (点击), `cliclick m:500,400` (移动)
- 键盘输入: `cliclick t:"Hello"` (输入文本), `cliclick kd:cmd,v` (快捷键)

### 已安装的终端命令
- `claude` - Claude CLI (Anthropic)
- `opencode` - OpenCode 编辑器
- `cliclick` - 鼠标控制工具
- `imsg` - iMessage CLI

### 查找程序的正确方法
- GUI 应用: 检查 `/Applications/` 或 `~/Applications/`
- 终端命令: 用 `which 命令名` 检查 PATH

## 模型配置

### 主模型
- **当前主模型**: `kimi-coding/k2p5` (Kimi Coding Plan)
- **API Key**: sk-kimi-tvxuR4HBhRGZffdAe7qWSdiRgg18yZIQR2u3j8UdupW9VdQasrLCPZHC5mQO1JNI
- **Base URL**: https://api.moonshot.cn/v1
- **备选模型**:
  - `openrouter/deepseek/deepseek-chat`
  - `minimax-coding-plan/MiniMax-M2.5` (SiliconFlow)

### MiniMax Coding Plan (SiliconFlow)
- **模型**: `minimax-coding-plan/MiniMax-Text-01`
- **API Key**: `sk-cp-j9S-IgumEw4YuK8o1khdhvVgLHvYugsAwWyvwW45WIZMyws6PFg3fRTl5dvkSKygeDw6yW-W4e-3muGb2x5DBeXhtgHZdcZWNEt0gKxYW33lnjLN04FNe5k` (已配置)
- **Base URL**: https://api.siliconflow.cn/v1

## Car Trivia Game
- **位置**: ~/.openclaw/workspace/car-trivia-challenge
- **端口**: 5173
- **运行**: npm run dev

### 2026-02-22 修复记录
- **问题**: cron 任务使用 MiniMax-M2.1-lightning 导致失败 + 上下文溢出
- **修复**:
  1. 删除旧 cron 任务，创建新任务使用 minimax-coding-plan/MiniMax-M2.5
  2. 设置 `sessionTarget: fresh` (每次全新会话，不累积历史)
  3. 启用 `compaction.mode: aggressive` (80% 自动压缩)
- **当前任务**:
  - OpenClaw 更新检查: 每天运行
  - 模型健康检查: 每6小时运行

## 自动更新检查

- 每半小时检测系统更新（npm、Homebrew、OpenClaw）
- 有更新时通过飞书报告给用户

## 安全分享规则

- 所有对外分享的内容必须脱敏处理
- 分享前必须发给用户确认
- 禁止公开的信息：API Keys、Tailscale URL、Gateway Token、个人邮箱

## 📋 配置管理规范

### OpenClaw 配置存储
- **配置文件**: `~/.openclaw/openclaw.json`
- **备份**: 每次修改前自动备份为 `.bak` 系列
- **检查命令**: `openclaw status` 或直接读取 JSON

### MCP 配置（mcporter）
- **配置文件**: `~/.openclaw/workspace/config/mcporter.json`
- **当前已配置的服务器**:
  - **Tavily**: 网络搜索 (API Key: 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)
  - **minimax**: 图像功能 (API Key: sk-cp-j9S-...)
  - **playwright**: 浏览器自动化
- **Daemon 状态**: `mcporter daemon status` (已自动运行，pid 24101)
- **激活 MCP**: `mcporter daemon start`
- **验证工具**: `mcporter list`

### Skills 安装方式
1. **内置Skills**: `~/.openclaw/skills/` 或 `~/.openclaw/workspace/skills/`
2. **共享Skills**: `~/.openclaw/shared-skills/`
3. **安装后执行**: `openclaw skills scan` 刷新

### MCP 配置方式
MCP服务器配置在 `openclaw.json` 的 `mcpServers` 字段：

```json
{
  "mcpServers": {
    "tavily": {
      "command": "npx",
      "args": ["-y", "@tavily/mcp-server"],
      "env": {
        "TAVILY_API_KEY": "tvly-xxx"
      }
    },
    "custom": {
      "command": "node",
      "args": ["/path/to/mcp-server.js"],
      "env": {}
    }
  }
}
```

**配置步骤**:
1. 编辑 `~/.openclaw/openclaw.json`
2. 在根级别添加 `mcpServers` 对象
3. 重启 Gateway: `openclaw gateway restart`
4. 验证: `openclaw mcp list`

### 安装新配置后的必做事项
- [ ] 记录到 MEMORY.md（配置方式 + 关键参数）
- [ ] 验证功能正常
- [ ] 测试重启后是否持久

---

## Agent 角色分配 (2026-02-27 更新)

| Agent | 角色 | 通道绑定 |
|-------|------|----------|
| **E0** | 主要 Agent - 基础对话、电脑接管 | webchat + 默认 |
| **E1** | 程序员 - 开发任务 | 飞书 + Discord |
| **E2** | 待分配 | iMessage |

### Heartbeat 配置
- E0: 启用 (30分钟)
- E1, E2: 禁用

---

## Agent 核心规则 (2026-02-26)

### 优先级 1：问题解决
- **什么算"问题"**：
  - 用户说"不行"、"没用"、"打不开"、"失败"
  - 执行命令/工具返回错误
  - 同一件事尝试 2 次及以上仍然失败
- **怎么做**：立即用 **MCP (Tavily) 搜索解决方案**
- **为什么**：不要局限在自己的知识里打转，互联网有更多答案

### 优先级 2：图片处理
- 涉及图片时，首先调用 **MiniMax 图像功能** 识别

### OpenCode/OpenClaw 常见故障
- **错误码 -88**: SIGKILL，进程被系统杀死 → 通常是 Node.js 版本兼容性问题，重装 npm 包解决
- **Gateway 启动失败**: 检查 `launchctl unsetenv OPENCLAW_GATEWAY_TOKEN` 清除环境变量冲突
- **依赖损坏**: 重新安装 npm 包 (npm uninstall -g xxx && npm install -g xxx)

## 汽车图片抓取技能

### 方式：OpenClaw 独立浏览器（不需要扩展）
- **启动命令**：`openclaw browser --profile openclaw start`
- **浏览器控制**：`browser` 工具（open, snapshot, act 等）
- **汽车之家 URL**：https://www.autohome.com.cn/cars/imglist

### 抓取流程
1. `browser` 工具打开汽车之家图库页面
2. 选择车型 → 进入图片列表
3. 点击图片获取大图 URL（通常是 `car3.autoimg.cn` 开头）
4. `curl -L` 下载图片到游戏目录
5. 更新 `~/Downloads/car-trivia-challenge/services/geminiService.ts` 的 LOCAL_IMAGES 映射

### 图片存储路径
- 游戏目录：`~/Downloads/car-trivia-challenge/public/images/`
- 图片映射：`~/Downloads/car-trivia-challenge/services/geminiService.ts` 中的 `LOCAL_IMAGES` 对象

### 当前图片（25张）
- BYD: Seal, Dolphin
- Tesla: Model Y
- BMW: 3 Series, X5
- Mercedes: C Class, GLC
- Audi: A4, Q5
- Toyota: Camry, RAV4
- Honda: CR-V
- Porsche: 911, Taycan
- Lexus: ES, RX, NX
- NIO: ET7, ET5
- Li Auto: L7, L8
- ...（更多见游戏代码）

### 定时任务
- **随机汽车图片抓取**：每 2 小时运行一次（每次 1-2 个车型）
- **MCPorter 自愈**：每 5 分钟检查一次

## EvoMap 配置
- **Node ID**: node_abb4a77ae10e
- **Hub URL**: https://evomap.ai
- **安装路径**: ~/evolver
- **启动命令**: `cd ~/evolver && EVOLUTION_DIR=~/.memory/evolution A2A_HUB_URL=https://evomap.ai node index.js --loop`
- **状态**: 需要手动启动（系统负载高时会失败）
- **注册邮箱**: catheycelaniclw63@gmail.com

*最后更新: 2026-02-25*

## 待抓取车型列表（50款热门）
奥迪A6L, 问界M7, 奥迪Q5L, Model Y, 宝马X3, 奔驰E级, 迈腾, 帕萨特, 轩逸, 奥迪A4L, 宝马5系, RAV4荣放, 速腾, 凯美瑞, 奔驰GLC, 特斯拉Model 3, 比亚迪汉, 比亚迪秦, 小米SU7, 理想L9, 蔚来ES6, 小鹏P7, 坦克300, 大众ID.3, 本田CR-V, 天籁, 雅阁, 蒙迪欧, 君威, 伊兰特, 思域, 高尔夫, 雷克萨斯ES, 沃尔沃XC60, 捷豹XFL, 凯迪拉克CT5, 林肯Z, 英菲尼迪Q50L, 起亚K5, 现代索纳塔, 马自达阿特兹, 斯柯达速派, 大众途观L, 丰田汉兰达, 福特锐界, Jeep自由光, 雪佛兰探界者, 别克昂科威, 荣威RX5, MG ONE

## 车标数据（猜车标模块）
- 品牌故事: ~/Downloads/car-trivia-challenge/src/data/brands.ts
- 包含 20+ 汽车品牌的中英文名、创立时间、国家、描述、故事
- 车标图片目录: public/images/logos/ (待补充)

## 快捷指令

- **加库** 或 **jk**: 把重要信息记录到 MEMORY.md
- **安全分享规则**: 分享前脱敏，发用户确认

## 多萌宠物知识库

- 位置: memory/duomeng/
  - README.md (基础信息)
  - 深度分析报告.md (商业洞察)
  - **超级深度分析.md** (完整数据+战略建议)
- 内容: 公司信息、产品价格表、配方原料、供应商、财务、竞争优势分析
- 创建时间: 2026-02-25

## Memos 配置

- 地址: http://127.0.0.1:8081
- 用户: Eieai
- API Token: 已配置（安全存储）
- 外网: https://eieaimac-mini.tail185a08.ts.net/

## 消息通道

- **iMessage**: 552383232@qq.com ✅ 已验证
- **飞书**: ou_836ce7b1f54f4a66fedc5ec28861c6b7 ✅ 已配对 (2026-02-27)

## 消息发送规则

- 重要消息同时发送到飞书 + iMessage（多通道备份）
- 使用 message 工具的 channel 参数区分

- 重要消息同时发送到飞书 + iMessage（多通道备份）
- 使用 message 工具的 channel 参数区分

## 2026-02-24 学习记录

### OKComputer 项目
用户发送了 `OKComputer_OpenClaw接管.zip`，包含完整的 OpenClaw 超级 Agent 方案：

- **五层安全架构**: 硬件隔离 → 虚拟化沙箱 → 网络分段 → 最小权限 → AI 行为约束
- **5个核心Skills**: macos-control, file-manager, app-automation, code-assistant, system-monitor
- **实用脚本**: deploy.sh, monitor.sh, backup.sh, update.sh

## 2026-02-24 学习记录

### ClashX.Meta 文档已学习
- 配置文件: `~/.config/clash.meta/config.yaml`
- API 端口: 7890 (HTTP), 7891 (SOCKS5)
- 支持模式: global/rule/direct
- 笔记位置: memory/clashx-meta.md

### Discord 配置问题
- 一直失败: "Failed to resolve Discord application id"
- Token 验证有效，但 OpenClaw 无法连接
- 等待后续版本修复

### ClashX 配置
- 配置文件: `~/.config/clash.meta/config.yaml`
- API 端口: 7890 (HTTP), 7891 (SOCKS5)
- 支持模式: global/rule/direct
- Skill: clash-mode 已安装

### Memos 自建笔记
- 二进制: ~/Downloads/memos
- 数据目录: ~/.memos
- 端口: 5230
- 开机自启: 已配置 LaunchAgent
- 外网: 通过 Tailscale 访问
- Node ID: node_openclaw_eieai
- 注册时间: 2026-02-24
- 500 积分: 已注册待确认
