# OpenClaw Integrated Dispatcher

智能任务分发器 - 支持多Agent分层响应 + 沙盒安全执行

## 特性

- 🎯 **智能分流** - 根据复杂度自动判断立即执行或后台处理
- 🛡️ **沙盒隔离** - macOS sandbox-exec 保护系统安全
- ⚡ **高性能** - 2-6 个 Worker 自动扩缩容
- 🔄 **超时保护** - 任务超时自动终止
- 📡 **IPC 回调** - 支持外部 LLM 集成

## 架构

```
消息 → TaskEstimator 评估复杂度
    │
    ├── 简单任务 (< 3分) → 立即返回
    │
    └── 复杂任务 (≥ 3分) → SandboxPool 执行
                              │
                              ├── macOS: sandbox-exec
                              └── Linux: nice 限制
```

## 快速开始

```javascript
const { IntegratedDispatcher } = require('./index.js');

const dispatcher = new IntegratedDispatcher({
  concurrency: { min: 2, max: 4 },
  llmProvider: async (request) => {
    // 调用你的 LLM
    return await yourLLM(request);
  }
});

await dispatcher.initialize();

// 自动分流
const result = await dispatcher.dispatch('分析日志文件');

if (result.mode === 'immediate') {
  console.log('立即结果:', result.result);
} else {
  console.log('后台执行:', result.message);
  const data = await result.promise;
  console.log('完成:', data);
}
```

## 复杂度评分

| 信号 | 权重 |
|------|------|
| 简单词（你好/测试） | -2 |
| 耗时词（分析/抓取/批量） | +3~5 |
| 长文本 | +2~3 |

**阈值**: ≥3 分 → 后台执行

## 配置

```javascript
{
  concurrency: { min: 2, max: 6 },
  security: {
    enableSandbox: true,
    maxExecutionTime: 300000,  // 5分钟
    maxMemoryMB: 512,
    maxOutputSize: 100000     // 100KB
  },
  llmProvider: async (req) => 'response'
}
```

## 事件

```javascript
dispatcher.on('ready', ({ workers }) => {});
dispatcher.on('log', ({ type, message, estimation }) => {});
dispatcher.on('notification', ({ type, taskId, message }) => {});
```

## 模块结构

```
integrated-dispatcher/
├── index.js       # 主模块
├── example.js     # 示例
└── README.md     # 文档
```

## 依赖模块

- `../sandbox-agent/` - 沙盒执行
- `../task-dispatcher/` - 任务分发基础

## 测试

```bash
cd skills/integrated-dispatcher
node example.js
```

## License

MIT
