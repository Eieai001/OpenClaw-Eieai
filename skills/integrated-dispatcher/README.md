# 集成任务分发器 - 方案 A

**TaskDispatcher 分流 + Sandbox-Agent 执行**

## 架构

```
用户消息 → IntegratedDispatcher.dispatch()
              │
              ▼
        TaskEstimator.estimate() 评估复杂度
              │
    ┌─────────┴─────────┐
    ▼                   ▼
 简单任务            复杂任务
    │                   │
    ▼                   ▼
 立即执行          SandboxPool.execute()
 (LLM直接调用)      (沙盒安全执行)
```

## 核心特性

| 特性 | 说明 |
|------|------|
| **智能分流** | TaskDispatcher 复杂度评分 |
| **安全执行** | Sandbox-Agent 沙盒隔离 |
| **真实LLM** | IPC 回调父进程调用 |
| **自动扩缩容** | 2-6 个 Worker |
| **超时保护** | 默认 5 分钟 |

## 文件

```
integrated-dispatcher/
├── index.js      # 主模块
├── example.js    # 使用示例
└── README.md     # 本文档
```

## 快速开始

```javascript
const { IntegratedDispatcher, TaskEstimator } = require('./integrated-dispatcher');

// 创建分发器
const dispatcher = new IntegratedDispatcher({
  concurrency: { min: 2, max: 4 },
  llmProvider: async ({ message }) => {
    // 调用你的 LLM
    return await callYourLLM(message);
  }
});

await dispatcher.initialize();

// 评估复杂度（可选）
const est = TaskEstimator.estimate('分析日志文件');
console.log(est.shouldBackground); // true/false

// 分发任务
const result = await dispatcher.dispatch('分析性能问题');

if (result.mode === 'immediate') {
  console.log('立即结果:', result.result);
} else {
  console.log('后台执行:', result.message);
  const data = await result.promise;
  console.log('完成:', data);
}
```

## 配置

```javascript
{
  concurrency: { min: 2, max: 6 },  // Worker 数量
  llmProvider: async (req) => {     // LLM 调用函数
    // req: { messages, model, temperature, maxTokens }
    return 'response';
  },
  sandboxProfile: './path/to/profile.sb',  // 沙盒配置
  maxExecutionTime: 300000,   // 5分钟超时
  maxMemoryMB: 512            // 内存限制
}
```

## 事件

```javascript
dispatcher.on('ready', ({ workers }) => {});
dispatcher.on('log', ({ type, message, estimation }) => {});
dispatcher.on('notification', ({ type, taskId, message }) => {});
dispatcher.on('taskProgress', ({ taskId, progress, message }) => {});
```

## 与单独模块对比

| 模块 | 职责 |
|------|------|
| TaskEstimator | 复杂度评估 |
| SandboxPool | 沙盒执行 |
| IntegratedDispatcher | 统一入口 + 分流 |

## 测试

```bash
cd ~/.openclaw/workspace/skills/integrated-dispatcher
node example.js
```
