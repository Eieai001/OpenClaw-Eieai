# OpenClaw 多Agent架构配置指南

## 背景

本文记录如何配置 OpenClaw 实现多Agent分层响应架构。

## 核心架构

```
OpenClaw Agent
    │
    ├── E0 (main) - 默认对话，快速响应
    ├── E1 - 程序员/开发任务
    └── E2 - 待分配
```

## 分层响应原理

### 2秒阈值
- 基于人类感知研究：2秒是"即时反馈"的心理阈值
- ≤2秒 → 立即回复
- >2秒 → 后台执行

### 复杂度评分
| 信号 | 权重 |
|------|------|
| 简单词（你好/测试） | -2 |
| 耗时词（分析/抓取/批量） | +3~5 |
| 长文本（>500字） | +2~3 |

### 分流逻辑
```
消息 → 复杂度评分
    ├── ≤2分 → 立即回复（主Agent）
    └── >2分 → 沙盒执行（后台Agent）
```

## 集成模块

### Integrated Dispatcher
- **TaskEstimator**: 复杂度评估
- **SandboxPool**: 沙盒安全执行

### 沙盒安全机制
- macOS sandbox-exec 隔离
- 任务类型白名单
- 危险命令黑名单
- 超时保护

## 配置步骤

### 1. 创建 Agent 角色
在 `openclaw.json` 中配置：

```json
"agents": {
  "defaults": { ... },
  "list": [
    { "id": "main", "default": true },
    { "id": "e1", "model": { "primary": "minimax-coding-plan/MiniMax-M2.5" }},
    { "id": "e2" }
  ]
}
```

### 2. 配置通道绑定

```json
"bindings": [
  { "agentId": "e2", "match": { "channel": "imessage" }},
  { "agentId": "e1", "match": { "channel": "feishu" }}
]
```

### 3. 集成调度器

```javascript
const { IntegratedDispatcher } = require('./skills/integrated-dispatcher');

const dispatcher = new IntegratedDispatcher({
  llmProvider: async (request) => {
    // 接入你的 LLM
    return await yourLLM(request);
  }
});

await dispatcher.initialize();

// 自动分流
const result = await dispatcher.dispatch('分析日志');
```

## 模块位置

```
~/.openclaw/workspace/skills/
├── integrated-dispatcher/  # 集成调度器
├── multi-agent-controller/  # Agent 控制器
├── sandbox-agent/           # 沙盒模块
└── task-dispatcher/        # 任务分发（基础版）
```

## 效果

| 消息 | 复杂度 | 模式 |
|------|--------|------|
| 你好 | -2 | 立即 |
| 查询状态 | -1 | 立即 |
| 分析日志 | 3 | 后台 |
| 抓取100张图 | 11 | 后台 |

## 注意事项

1. **安全优先** - 沙盒不是万能的，需配合代码层验证
2. **资源控制** - 限制并发数，避免资源耗尽
3. **监控** - 关注任务完成通知

## 总结

通过多Agent分层架构，实现：
- ✅ 简单任务即时响应
- ✅ 复杂任务安全后台执行
- ✅ 资源可控
- ✅ 自动分流

---

*配置时间: 2026-02-27*
