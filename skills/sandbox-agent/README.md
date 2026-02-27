# OpenClaw 安全沙盒 Agent 池

基于原 sandbox 代码的改进版，集成到 OpenClaw 的 subagents 系统。

## 主要改进

### 1. 真实 LLM 调用支持
- 通过 IPC 回调父进程调用 LLM
- 支持自定义 LLM provider
- 输出大小限制（默认 100KB）

### 2. 跨平台支持
| 平台 | 沙盒机制 |
|------|----------|
| macOS | `sandbox-exec` |
| Linux | `nice` + 资源限制 |
| 其他 | 无沙盒模式（仅开发） |

### 3. 强化安全验证
- 任务类型白名单
- 危险命令黑名单
- 正则模式匹配（防止代码注入）
- 路径遍历防护
- 消息长度限制（50KB）

### 4. 更多任务类型
- `query` - 简单查询
- `analysis` - 文件分析
- `generation` - 内容生成
- `code-generation` - 代码生成
- `file-read` - 文件读取

## 文件结构

```
skills/sandbox-agent/
├── openclaw-agent.sb      # macOS 沙盒配置文件
├── safe-agent-pool.js     # 主 Agent 池实现
├── worker-agent.js        # 沙盒工作进程
└── example-usage.js       # 使用示例
```

## 快速开始

### 1. 基础使用

```javascript
const SafeAgentPool = require('./skills/sandbox-agent/safe-agent-pool');

const pool = new SafeAgentPool({
  // 接入你的 LLM
  llmProvider: async (request) => {
    const { messages, model, maxTokens } = request;
    // 调用你的模型 API
    return await yourLLMAPI({ messages, model, max_tokens: maxTokens });
  }
});

await pool.initialize();

// 执行任务
const result = await pool.execute({
  type: 'query',
  message: 'Hello!'
});

await pool.destroy();
```

### 2. 集成到现有 subagents

```javascript
// 替换原有的 sessions_spawn
async function safeSpawn(task, options) {
  return pool.execute({
    type: task.type || 'query',
    message: task.message || JSON.stringify(task),
    ...task
  }, options);
}

// 使用
const result = await safeSpawn({
  type: 'analysis',
  message: '分析性能问题'
});
```

### 3. 在 multi-agent-controller 中使用

```javascript
// skills/multi-agent-controller/controller.js

const SafeAgentPool = require('../sandbox-agent/safe-agent-pool');

class MultiAgentController {
  constructor() {
    this.pool = new SafeAgentPool({
      concurrency: { min: 2, max: 4 },
      llmProvider: this.callLLM.bind(this)
    });
  }

  async callLLM(request) {
    // 调用 OpenClaw 的模型
    // 使用工具或 API
  }

  async handleMessage(message) {
    const estimation = ResponseTimeEstimator.estimate(message);
    
    if (estimation.canReplyImmediately) {
      return { type: 'immediate', reply: generateReply(message) };
    } else {
      // 使用安全沙盒 Agent
      const result = await this.pool.execute({
        type: 'query',
        message: message
      });
      return { type: 'delegate', result };
    }
  }
}
```

## 配置选项

```javascript
{
  concurrency: {
    min: 2,              // 最小 Agent 数
    max: 6,              // 最大 Agent 数
    targetUtilization: 0.7
  },
  security: {
    enableSandbox: true,              // 启用沙盒
    sandboxProfile: './openclaw-agent.sb',
    maxExecutionTime: 300000,         // 5分钟超时
    maxMemoryMB: 512,                 // 内存限制
    maxOutputSize: 100000,            // 最大输出 100KB
    allowedTaskTypes: ['query', 'analysis', 'code-generation'],
    blockedCommands: ['rm', 'sudo', 'chmod', 'ssh', 'eval']
  },
  llmProvider: async (request) => {  // LLM 调用函数
    // request: { messages, model, temperature, maxTokens }
    // return: string
  }
}
```

## 安全特性

| 层级 | 保护机制 |
|------|----------|
| 系统层 | macOS sandbox / Linux nice 限制 |
| 进程层 | 内存限制、超时终止 |
| 代码层 | 任务验证、命令过滤、路径检查 |
| 数据层 | 输入截断、输出限制 |

## 事件

```javascript
pool.on('initialized', ({ agentCount, sandbox }) => {});
pool.on('taskComplete', ({ taskId, data, duration }) => {});
pool.on('taskFailed', ({ taskId, error }) => {});
pool.on('sandboxViolation', ({ agentId, output }) => {});
pool.on('scaledUp', ({ newSize }) => {});
```

## 测试

```bash
cd ~/.openclaw/workspace/skills/sandbox-agent
node example-usage.js
```

## 注意事项

1. **沙盒不是万能的** - 配合代码层验证使用
2. **LLM 输出仍需检查** - 防止生成危险代码
3. **生产环境务必启用沙盒** - `enableSandbox: true`
4. **定期审查任务类型** - 只允许必要的任务

## 与原版对比

| 特性 | 原版 | 改进版 |
|------|------|--------|
| LLM 调用 | ❌ 模拟 | ✅ 真实调用 |
| 跨平台 | ❌ 仅 macOS | ✅ macOS/Linux |
| 输入验证 | 基础字符串匹配 | 正则模式 + 长度限制 |
| 输出限制 | ❌ | ✅ 100KB 限制 |
| 路径硬编码 | ✅ | ❌ 动态配置 |
| 任务类型 | 4种 | 5种（+code-generation）|

## 后续优化

- [ ] 支持 Docker 沙盒（服务器环境）
- [ ] GPU 资源隔离
- [ ] 更细粒度的网络控制
- [ ] LLM 响应缓存
