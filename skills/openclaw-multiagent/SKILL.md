---
name: openclaw-multiagent
description: OpenClaw 多Agent分层响应架构 - TaskDispatcher 智能分流 + Sandbox-Agent 沙盒安全执行。实现简单任务立即响应，复杂任务后台处理。
metadata:
  openclaw:
    emoji: 🎛️
    triggers:
      - multi_agent
      - dispatcher
      - sandbox
      - 任务分发
      - 后台执行
    version: "1.0.0"
---

# OpenClaw 多Agent分层响应架构

## 概述

实现多Agent分层响应架构，支持智能任务分流和沙盒安全执行。

## 核心功能

### 1. 智能分流 (TaskEstimator)
```javascript
// 复杂度评分
- 简单词 (你好/测试): -2
- 耗时词 (分析/抓取/批量): +3~5
- 长文本 (>500字): +2~3

// 阈值
≥3分 → 后台执行
<3分 → 立即响应
```

### 2. 沙盒安全执行 (SandboxPool)
- macOS sandbox-exec 隔离
- 危险命令黑名单
- 超时保护 (默认5分钟)
- 内存限制 (默认512MB)

### 3. 自动扩缩容
- 2-6 个 Worker
- 队列管理
- 任务超时自动清理

## 使用方法

### 基础使用
```javascript
const { IntegratedDispatcher } = require('./skills/integrated-dispatcher');

const dispatcher = new IntegratedDispatcher({
  concurrency: { min: 2, max: 4 },
  llmProvider: async (req) => {
    return await yourLLM(req);
  }
});

await dispatcher.initialize();

// 自动分流
const result = await dispatcher.dispatch('分析日志');
```

### 评估复杂度
```javascript
const { TaskEstimator } = require('./skills/integrated-dispatcher');

const est = TaskEstimator.estimate('分析日志文件');
console.log(est.shouldBackground); // true/false
```

## 配置选项

```javascript
{
  concurrency: { min: 2, max: 6 },
  security: {
    enableSandbox: true,
    maxExecutionTime: 300000,
    maxMemoryMB: 512,
    maxOutputSize: 100000,
    blockedCommands: ['rm', 'sudo', 'chmod']
  }
}
```

## 模块结构

```
skills/
├── integrated-dispatcher/  # 集成调度器 (主模块)
├── multi-agent-controller/ # Agent 控制器
├── sandbox-agent/         # 沙盒模块
└── task-dispatcher/      # 任务分发基础版
```

## 事件

```javascript
dispatcher.on('ready', ({ workers }) => {});
dispatcher.on('log', ({ type, message, estimation }) => {});
dispatcher.on('notification', ({ type, taskId, message }) => {});
```

## 测试

```bash
cd ~/.openclaw/workspace/skills/integrated-dispatcher
node example.js
```

## 效果

| 消息 | 复杂度 | 模式 |
|------|--------|------|
| 你好 | -2 | 立即 |
| 查询状态 | -1 | 立即 |
| 分析日志 | 3 | 后台 |
| 抓取图片 | 11 | 后台 |

## 依赖

- Node.js 18+
- macOS (沙盒) 或 Linux

## License

MIT
