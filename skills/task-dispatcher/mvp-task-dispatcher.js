/**
 * OpenClaw 任务分发器 - MVP 版本
 *
 * 核心功能：
 * 1. 任务复杂度评估
 * 2. 简单任务立即执行 / 复杂任务后台执行
 * 3. 子进程任务池管理
 * 4. 完成通知
 *
 * 无沙盒，纯代码层保护
 */

const { EventEmitter } = require('events');
const { fork } = require('child_process');
const path = require('path');

/**
 * 任务复杂度评估器
 */
class TaskEstimator {
  static estimate(message) {
    let score = 0;
    const indicators = {
      // 耗时信号 (+)
      heavy: [
        { pattern: /(分析|解析|诊断|评估|计算)/, weight: 3 },
        { pattern: /(批量|所有|全部|100|列表|多个)/, weight: 4 },
        { pattern: /(抓取|下载|同步|备份|导入|导出)/, weight: 5 },
        { pattern: /(生成|创建|编写|写).{0,10}(代码|程序|脚本|文档)/, weight: 3 },
        { pattern: /(搜索|查询).{0,10}(大量|所有|全网)/, weight: 3 },
        { pattern: /(MB|GB|TB|\d+\s*(张|个|条|页))/, weight: 2 },
      ],
      // 快速信号 (-)
      light: [
        { pattern: /^(你好|hi|hello|hey|在吗|测试)/i, weight: -2 },
        { pattern: /^(查询|查看|获取).{0,5}(状态|时间|天气)/, weight: -1 },
        { pattern: /^(简单|快速| brief)/, weight: -1 },
      ]
    };

    for (const { pattern, weight } of indicators.heavy) {
      if (pattern.test(message)) score += weight;
    }
    for (const { pattern, weight } of indicators.light) {
      if (pattern.test(message)) score += weight;
    }

    // 长度因素
    if (message.length > 500) score += 2;
    if (message.length > 1000) score += 3;

    // 多步骤
    const steps = message.split(/[，,；;然后接着并]/).length;
    if (steps > 2) score += Math.min(steps - 2, 3);

    // 预估时间
    let estimatedTime;
    if (score <= 2) estimatedTime = 1;       // < 1秒
    else if (score <= 5) estimatedTime = 5;  // < 5秒
    else if (score <= 8) estimatedTime = 30; // < 30秒
    else estimatedTime = 120;                // > 2分钟

    return {
      score,
      estimatedTime,
      shouldBackground: score >= 3,  // >= 3 就后台执行
      confidence: Math.min(Math.abs(score) / 10, 1)
    };
  }
}

/**
 * 工作进程池
 */
class WorkerPool extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      minWorkers: 2,
      maxWorkers: 6,
      taskTimeout: 300000, // 5分钟
      maxRetries: 2,
      ...config
    };

    this.workers = new Map();
    this.queue = [];
    this.running = new Map();
    this.workerId = 0;
  }

  async initialize() {
    for (let i = 0; i < this.config.minWorkers; i++) {
      await this.spawnWorker();
    }
    this.emit('ready', { workers: this.workers.size });
  }

  spawnWorker() {
    return new Promise((resolve, reject) => {
      const id = `worker-${++this.workerId}`;
      const scriptPath = path.join(__dirname, 'mvp-worker.js');

      const worker = fork(scriptPath, [id], {
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
        env: {
          ...process.env,
          NODE_ENV: 'production',
          WORKER_ID: id
        }
      });

      const workerInfo = {
        id,
        process: worker,
        status: 'idle',
        currentTask: null,
        spawnTime: Date.now()
      };

      worker.on('message', (msg) => this.handleMessage(id, msg));
      worker.on('exit', (code) => this.handleExit(id, code));
      worker.on('error', (err) => this.handleError(id, err));

      // 等待就绪
      const readyHandler = (msg) => {
        if (msg.type === 'ready') {
          worker.off('message', readyHandler);
          this.workers.set(id, workerInfo);
          this.emit('workerSpawned', { id });
          resolve(id);
        }
      };
      worker.on('message', readyHandler);

      // 超时处理
      setTimeout(() => {
        worker.off('message', readyHandler);
        if (!this.workers.has(id)) {
          worker.kill();
          reject(new Error('Worker spawn timeout'));
        }
      }, 10000);
    });
  }

  async execute(task) {
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 7)}`;

    // 基础验证
    if (!task.message || typeof task.message !== 'string') {
      throw new Error('Invalid task message');
    }
    if (task.message.length > 50000) {
      throw new Error('Task message too long (max 50000 chars)');
    }

    const wrappedTask = {
      id: taskId,
      message: task.message,
      context: task.context || {},
      createTime: Date.now(),
      timeout: task.timeout || this.config.taskTimeout
    };

    this.queue.push(wrappedTask);
    this.emit('taskQueued', { taskId, queueSize: this.queue.length });

    this.processQueue();

    return new Promise((resolve, reject) => {
      const handler = (result) => {
        if (result.taskId === taskId) {
          this.off('taskComplete', handler);
          this.off('taskFailed', handler);

          if (result.status === 'completed') {
            resolve(result.data);
          } else {
            reject(new Error(result.error || 'Task failed'));
          }
        }
      };

      this.on('taskComplete', handler);
      this.on('taskFailed', handler);
    });
  }

  processQueue() {
    const idleWorkers = Array.from(this.workers.values())
      .filter(w => w.status === 'idle');

    while (this.queue.length > 0 && idleWorkers.length > 0) {
      const task = this.queue.shift();
      const worker = idleWorkers.shift();

      if (Date.now() - task.createTime > task.timeout) {
        this.emit('taskTimeout', { taskId: task.id, reason: 'queue_timeout' });
        continue;
      }

      worker.status = 'busy';
      worker.currentTask = task;
      task.startTime = Date.now();

      this.running.set(task.id, { task, worker });

      worker.process.send({ type: 'task', task });

      // 设置超时
      task.timeoutId = setTimeout(() => {
        this.terminateTask(task.id, 'execution_timeout');
      }, task.timeout);
    }

    // 动态扩容
    if (this.queue.length > 2 && this.workers.size < this.config.maxWorkers) {
      this.spawnWorker().catch(() => {});
    }
  }

  handleMessage(workerId, msg) {
    const worker = this.workers.get(workerId);
    if (!worker) return;

    switch (msg.type) {
      case 'progress':
        this.emit('taskProgress', {
          taskId: worker.currentTask?.id,
          progress: msg.progress,
          message: msg.message
        });
        break;

      case 'complete':
        this.completeTask(worker, msg.result);
        break;

      case 'error':
        this.failTask(worker, msg.error);
        break;
    }
  }

  completeTask(worker, result) {
    const task = worker.currentTask;
    if (!task) return;

    clearTimeout(task.timeoutId);
    worker.status = 'idle';
    worker.currentTask = null;

    this.running.delete(task.id);
    this.emit('taskComplete', {
      taskId: task.id,
      status: 'completed',
      data: result,
      duration: Date.now() - task.startTime
    });

    this.processQueue();
  }

  failTask(worker, error) {
    const task = worker.currentTask;
    if (!task) return;

    clearTimeout(task.timeoutId);
    worker.status = 'idle';
    worker.currentTask = null;

    this.running.delete(task.id);
    this.emit('taskFailed', {
      taskId: task.id,
      status: 'failed',
      error: error?.message || 'Unknown error'
    });

    this.processQueue();
  }

  terminateTask(taskId, reason) {
    const running = this.running.get(taskId);
    if (!running) return;

    const { task, worker } = running;

    worker.process.send({ type: 'shutdown' });
    setTimeout(() => {
      if (!worker.process.killed) {
        worker.process.kill('SIGTERM');
      }
    }, 3000);

    this.emit('taskTimeout', { taskId, reason });
  }

  handleExit(workerId, code) {
    const worker = this.workers.get(workerId);
    if (!worker) return;

    if (worker.currentTask) {
      this.failTask(worker, new Error(`Worker exited with code ${code}`));
    }

    this.workers.delete(workerId);

    // 自动补充
    if (this.workers.size < this.config.minWorkers) {
      setTimeout(() => this.spawnWorker().catch(() => {}), 1000);
    }
  }

  handleError(workerId, error) {
    console.error(`Worker ${workerId} error:`, error);
    this.handleExit(workerId, 1);
  }

  async destroy() {
    this.queue = [];

    for (const [taskId] of this.running) {
      this.terminateTask(taskId, 'pool_shutdown');
    }

    await new Promise(r => setTimeout(r, 2000));

    for (const worker of this.workers.values()) {
      worker.process.send({ type: 'shutdown' });
    }

    await new Promise(r => setTimeout(r, 1000));

    for (const worker of this.workers.values()) {
      if (!worker.process.killed) {
        worker.process.kill('SIGKILL');
      }
    }
  }
}

/**
 * 主任务路由器
 */
class TaskDispatcher extends EventEmitter {
  constructor(config = {}) {
    super();
    this.pool = new WorkerPool(config.pool);
    this.llmProvider = config.llmProvider || null;
  }

  async initialize() {
    await this.pool.initialize();

    // 转发事件
    this.pool.on('taskComplete', (data) => {
      this.emit('notification', {
        type: 'task_complete',
        taskId: data.taskId,
        result: data.data,
        message: `任务 ${data.taskId} 已完成`
      });
    });

    this.pool.on('taskFailed', (data) => {
      this.emit('notification', {
        type: 'task_failed',
        taskId: data.taskId,
        error: data.error,
        message: `任务 ${data.taskId} 失败: ${data.error}`
      });
    });
  }

  /**
   * 处理用户消息
   */
  async dispatch(message, context = {}) {
    const estimation = TaskEstimator.estimate(message);

    if (!estimation.shouldBackground) {
      // 立即执行
      this.emit('log', { type: 'immediate', message, estimation });

      const result = await this.executeImmediate(message, context);

      return {
        mode: 'immediate',
        estimatedTime: estimation.estimatedTime,
        result
      };
    } else {
      // 后台执行
      this.emit('log', { type: 'background', message, estimation });

      const taskPromise = this.pool.execute({
        message,
        context,
        llmProvider: this.llmProvider
      });

      // 立即返回，不等待
      return {
        mode: 'background',
        taskId: null, // 实际 ID 在 Promise 里
        estimatedTime: estimation.estimatedTime,
        message: `任务已后台执行（预估${estimation.estimatedTime}秒）`,
        promise: taskPromise // 如需等待可 await
      };
    }
  }

  async executeImmediate(message, context) {
    // 调用 LLM 或其他处理
    if (this.llmProvider) {
      return await this.llmProvider({ message, context });
    }
    return { type: 'immediate', message };
  }

  getStats() {
    return {
      workers: this.pool.workers.size,
      queue: this.pool.queue.length,
      running: this.pool.running.size
    };
  }

  async destroy() {
    await this.pool.destroy();
  }
}

module.exports = { TaskDispatcher, TaskEstimator, WorkerPool };
