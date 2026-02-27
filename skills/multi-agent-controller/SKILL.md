---
name: multi-agent-controller
description: 多Agent分层响应架构控制器 - 自动判断2秒阈值，管理子Agent池，分配耗时任务
metadata:
  openclaw:
    emoji: 🎛️
    triggers:
      - auto_route
      - subagent_pool
      - response_time
---

# 多Agent分层响应架构控制器

## 概述

自动实现主Agent快速响应 + 子Agent池处理耗时任务的分层架构。

## 核心功能

### 1. 2秒阈值自动判断
```javascript
// 复杂度分析
- 消息长度
- 关键词检测（快速/耗时）
- 任务类型识别

// 自动决策
复杂度 <= 2  → 立即回复（<500ms）
复杂度 <= 5  → 快速回复（<2s）
复杂度 > 5   → 子Agent处理
```

### 2. 子Agent池管理
- 最大并发：4个
- 自动排队等待
- 任务完成后自动清理
- 状态监控

### 3. 自动任务分配
```
用户消息
    ↓
估算响应时间
    ↓
├── <= 2秒 → 主Agent立即回复
│
└── > 2秒 → 创建子Agent
              ↓
         后台执行
              ↓
         完成后汇总回复
```

## 使用方法

### 自动模式（推荐）
```javascript
const { MultiAgentController } = require('./controller');
const controller = new MultiAgentController();

// 处理每条消息
const result = await controller.handleMessage(userMessage);

if (result.type === 'immediate') {
  // 立即生成回复
} else {
  // 启动子Agent后台处理
  await spawnSubAgent(userMessage);
}
```

### 手动触发子Agent
对于明确知道是耗时任务的场景：
```
用户: "后台执行猜车游戏图片抓取"
→ 直接创建子Agent，不经过2秒判断
```

## 配置参数

```javascript
{
  RESPONSE_THRESHOLD_MS: 2000,  // 2秒阈值
  MAX_SUBAGENTS: 4,             // 最大并发
  SUBAGENT_TIMEOUT_SECONDS: 300 // 超时时间
}
```

## 测试

```bash
node controller.js "你好"              # 应该立即回复
node controller.js "抓取100张图片"      # 应该分配给子Agent
node controller.js "分析日志文件"       # 应该分配给子Agent
```

## 状态监控

```javascript
const status = controller.pool.getStatus();
console.log(status);
// { active: 2, max: 4, queue: 1 }
```