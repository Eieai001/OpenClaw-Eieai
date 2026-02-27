# 多Agent分层响应架构 Skill

## 概述

实现主Agent快速响应 + 子Agent池处理耗时任务的分层架构，保证对话流畅性。

---

## 架构设计

```
用户消息 → 主Agent判断响应时间
    │
    ├── ≤2秒 → 立即回复
    │
    └── >2秒 → 创建子Agent → 执行 → 汇总回复
```

---

## 核心规则

### 1. 主Agent职责
- **响应速度检测**：判断能否在2秒内给出回复
- **快速响应**：能则立即回复，保持对话流畅
- **任务分发**：不能则分配给子Agent池
- **结果汇总**：子Agent完成后，主Agent整理回复

### 2. 子Agent池管理
- **动态创建**：按需创建子Agent，不超资源上限
- **自动终止**：任务完成后自动终止，释放资源
- **资源限制**：每个主Agent最多4个并发子Agent
- **超时控制**：子Agent执行设超时（默认5分钟）

### 3. 任务分配策略
```
用户消息 → 主Agent分析
    │
    ├── 简单查询/问候 → 立即回复 (≤2秒)
    │
    ├── 文件处理/数据分析 → 创建子Agent
    │
    ├── 网络搜索/多步骤任务 → 创建子Agent
    │
    └── 复杂编码/长时间运行 → 创建子Agent
```

---

## 实现代码

```javascript
// 主Agent决策逻辑
async function handleMessage(message) {
  const estimation = estimateResponseTime(message);
  
  if (estimation.canReplyIn2s) {
    return await generateReply(message);
  } else {
    const subAgent = await spawnSubAgent({
      task: message,
      timeout: 300000
    });
    const result = await subAgent.waitForCompletion();
    return summarizeResult(result);
  }
}

// 子Agent池管理
class SubAgentPool {
  constructor(maxConcurrent = 4) {
    this.maxConcurrent = maxConcurrent;
    this.activeAgents = new Map();
  }
  
  async spawn(task, options) {
    if (this.activeAgents.size >= this.maxConcurrent) {
      await this.waitForSlot();
    }
    const agent = await sessions_spawn({
      task, timeoutSeconds: options.timeout || 300, mode: 'run'
    });
    this.activeAgents.set(agent.id, agent);
    return agent;
  }
}
```

---

## EvoMap 元数据

```json
{
  "asset_type": "Gene",
  "trigger": ["multi_agent", "subagent_pool", "response_time", "agent_orchestration"],
  "category": "innovate",
  "confidence": 0.95,
  "summary": "多Agent分层响应架构：主Agent快速响应+子Agent池处理耗时任务",
  "strategy": [
    "Estimate response time before replying",
    "Reply immediately if ≤2s",
    "Spawn subagent for tasks >2s",
    "Summarize subagent results"
  ],
  "constraints": {
    "max_subagents": 4,
    "response_threshold": "2s",
    "cleanup_mode": "auto"
  }
}
```