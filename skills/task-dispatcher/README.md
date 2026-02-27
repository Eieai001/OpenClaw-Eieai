# OpenClaw 任务分发器 (MVP)

无沙盒的简化版，专注于任务分发和后台执行。

## 核心功能

1. **任务复杂度评估** - 自动判断是否需要后台执行
2. **后台任务池** - 2-6 个工作进程，自动扩缩容
3. **超时保护** - 默认 5 分钟超时
4. **完成通知** - 任务完成后通知主进程

## 文件

```
task-dispatcher/
├── mvp-task-dispatcher.js  # 主模块（路由+池）
├── mvp-worker.js           # 工作进程
├── example.js              # 使用示例
└── README.md               # 本文档
```

## 快速开始

```javascript
const { TaskDispatcher } = require('./mvp-task-dispatcher');

// 创建分发器
const dispatcher = new TaskDispatcher({
  pool: {
    minWorkers: 2,
    maxWorkers: 6,
    taskTimeout: 300000  // 5分钟
  },
  llmProvider: async ({ message }) => {
    // 接入你的 LLM
    return await callYourLLM(message);
  }
});

// 初始化
await dispatcher.initialize();

// 处理消息
const result = await dispatcher.dispatch("分析这个项目的性能问题");

if (result.mode === 'immediate') {
  // 立即响应
  console.log('立即响应:', result.result);
} else {
  // 后台执行
  console.log(result.message); // "任务已后台执行（预估30秒）"

  // 监听完成
  dispatcher.on('notification', (notif) => {
    if (notif.type === 'task_complete') {
      console.log('任务完成:', notif.result);
    }
  });
}
```

## 集成到 OpenClaw

```javascript
// 在 OpenClaw 的消息处理处
const { TaskDispatcher } = require('./skills/task-dispatcher/mvp-task-dispatcher');

class OpenClawCore {
  constructor() {
    this.dispatcher = new TaskDispatcher({
      llmProvider: this.callLLM.bind(this)
    });

    // 转发通知给用户
    this.dispatcher.on('notification', (notif) => {
      this.sendToUser(notif.message);
    });
  }

  async handleUserMessage(message) {
    const result = await this.dispatcher.dispatch(message);

    if (result.mode === 'immediate') {
      return result.result;  // 直接返回
    } else {
      return {  // 返回后台确认
        reply: result.message,
        taskPromise: result.promise  // 可选：跟踪任务
      };
    }
  }
}
```

## 复杂度评估规则

| 信号 | 示例 | 影响 |
|------|------|------|
| 分析/计算 | "分析日志" | +3秒 |
| 批量操作 | "下载100张图片" | +4秒 |
| 抓取/下载 | "抓取数据" | +5秒 |
| 代码生成 | "写个程序" | +3秒 |
| 简单问候 | "你好" | -2秒 |

**阈值**: 分数 > 3 → 后台执行

## 配置

```javascript
{
  pool: {
    minWorkers: 2,        // 最少工作进程
    maxWorkers: 6,        // 最多工作进程
    taskTimeout: 300000,  // 任务超时（毫秒）
    maxRetries: 2         // 失败重试次数
  }
}
```

## 测试

```bash
cd ~/.openclaw/workspace/skills/task-dispatcher
node example.js
```

## 后续增强

- [ ] 持久化任务队列（重启不丢失）
- [ ] 任务优先级
- [ ] 取消任务
- [ ] 进度显示
- [ ] 任务历史记录
