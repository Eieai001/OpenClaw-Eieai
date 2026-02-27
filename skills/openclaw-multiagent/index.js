/**
 * OpenClaw 任务分发器 - 集成沙盒安全版
 * 
 * 方案 A：TaskDispatcher 分流 + Sandbox-Agent 执行
 * 
 * 流程：
 * 消息 → TaskDispatcher.estimate() 判断
 *        │
 *   ┌────┴────┐
 *   ▼         ▼
 * 简单任务   复杂任务 → Sandbox-Agent 执行（安全隔离）
 */

const { EventEmitter } = require('events');
const { fork, spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs').promises;

/**
 * 任务复杂度评估器（来自 TaskDispatcher）
 */
class TaskEstimator {
  static estimate(message) {
    let score = 0;
    const indicators = {
      heavy: [
        { pattern: /(分析|解析|诊断|评估|计算)/, weight: 3 },
        { pattern: /(批量|所有|全部|100|列表|多个)/, weight: 4 },
        { pattern: /(抓取|下载|同步|备份|导入|导出)/, weight: 5 },
        { pattern: /(生成|创建|编写|写).{0,10}(代码|程序|脚本|文档)/, weight: 3 },
        { pattern: /(搜索|查询).{0,10}(大量|所有|全网)/, weight: 3 },
        { pattern: /(MB|GB|TB|\d+\s*(张|个|条|页))/, weight: 2 },
      ],
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

    if (message.length > 500) score += 2;
    if (message.length > 1000) score += 3;

    const steps = message.split(/[，,；;然后接着并]/).length;
    if (steps > 2) score += Math.min(steps - 2, 3);

    let estimatedTime;
    if (score <= 2) estimatedTime = 1;
    else if (score <= 5) estimatedTime = 5;
    else if (score <= 8) estimatedTime = 30;
    else estimatedTime = 120;

    return {
      score,
      estimatedTime,
      shouldBackground: score >= 3,
      confidence: Math.min(Math.abs(score) / 10, 1)
    };
  }
}

/**
 * 沙盒工作进程池（来自 Sandbox-Agent）
 */
class SandboxPool extends EventEmitter {
  constructor(config = {}) {
    super();
    this.platform = os.platform();
    this.isMacOS = this.platform === 'darwin';

    const defaultSecurity = {
      enableSandbox: this.isMacOS,
      sandboxProfile: path.join(__dirname, '../sandbox-agent/openclaw-agent.sb'),
      workDirBase: '/tmp/openclaw-agents',
      maxExecutionTime: 300000,
      maxMemoryMB: 512,
      maxOutputSize: 100000,
      allowedTaskTypes: ['query', 'analysis', 'generation', 'code-generation', 'file-read'],
      blockedCommands: ['rm', 'sudo', 'chmod', 'chown', 'curl', 'wget', 'ssh', 'eval', 'exec', 'spawn'],
      blockedPatterns: [
        /process\.exit/i,
        /child_process/i,
        /require\s*\(\s*['"]fs['"]\s*\).*writeFile/i,
        /fs\.unlink/i,
        /fs\.rmdir/i
      ]
    };

    this.config = {
      concurrency: { min: 2, max: 6 },
      security: defaultSecurity,
      llmProvider: null,
      ...config
    };

    // 深度合并 security 配置
    this.config.security = { ...defaultSecurity, ...config.security };

    this.workers = new Map();
    this.queue = [];
    this.running = new Map();
    this.workerId = 0;
    this.stats = {
      blockedTasks: 0,
      sandboxViolations: 0,
      timeoutKills: 0
    };
  }

  async initialize() {
    await fs.mkdir(this.config.security.workDirBase, { recursive: true });

    for (let i = 0; i < this.config.concurrency.min; i++) {
      await this.spawnWorker();
    }

    this.emit('ready', { workers: this.workers.size });
  }

  async spawnWorker() {
    const workerId = `sandbox-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const { enableSandbox, sandboxProfile, maxMemoryMB } = this.config.security;
    const workerScript = path.join(__dirname, '../sandbox-agent/worker-agent.js');

    let child;
    const env = {
      ...process.env,
      AGENT_ID: workerId,
      NODE_ENV: 'production',
      HOME: '/tmp'
    };

    // 使用 process.execPath 确保能找到 node
    const nodePath = process.execPath;

    if (enableSandbox && this.isMacOS) {
      child = spawn('sandbox-exec', [
        '-f', sandboxProfile,
        '-D', `WORK_DIR=/tmp/openclaw-agents/${workerId}`,
        nodePath, `--max-old-space-size=${maxMemoryMB}`, workerScript, workerId
      ], { stdio: ['pipe', 'pipe', 'pipe', 'ipc'], env });
    } else {
      child = spawn(nodePath, [`--max-old-space-size=${maxMemoryMB}`, workerScript, workerId], {
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'], env
      });
    }

    const worker = {
      id: workerId,
      process: child,
      status: 'idle',
      currentTask: null,
      spawnTime: Date.now()
    };

    child.on('message', (msg) => this.handleMessage(workerId, msg));
    child.on('error', (err) => this.handleError(workerId, err));
    child.on('exit', (code) => this.handleExit(workerId, code));

    child.stderr.on('data', (data) => {
      const str = data.toString();
      if (str.includes('sandbox')) {
        this.stats.sandboxViolations++;
        this.emit('sandboxViolation', { workerId, output: str });
      }
    });

    // 先添加到 workers，以便 handleMessage 可以处理消息
    this.workers.set(workerId, worker);

    return new Promise((resolve, reject) => {
      const readyHandler = (msg) => {
        if (msg.type === 'ready') {
          child.off('message', readyHandler);
          this.emit('workerSpawned', { workerId });
          resolve(workerId);
        }
      };
      child.on('message', readyHandler);
      setTimeout(() => {
        child.off('message', readyHandler);
        if (worker.status === 'idle' && !worker.currentTask) {
          child.kill();
          this.workers.delete(workerId);
          reject(new Error('Worker spawn timeout'));
        }
      }, 10000);
    });
  }

  async execute(task) {
    const taskId = `task-${Date.now()}-${++this.workerId}`;

    // 安全验证
    if (!this.validateTask(task)) {
      this.stats.blockedTasks++;
      throw new Error('Task validation failed');
    }

    const workDir = await this.createWorkDir(taskId);

    const wrappedTask = {
      id: taskId,
      type: task.type || 'query',
      message: task.message,
      model: task.model,
      workDir,
      timeout: Math.min(task.timeout || this.config.security.maxExecutionTime, this.config.security.maxExecutionTime),
      createTime: Date.now()
    };

    this.queue.push(wrappedTask);
    this.emit('taskQueued', { taskId, queueSize: this.queue.length });

    this.processQueue();

    return new Promise((resolve, reject) => {
      const handler = (result) => {
        if (result.taskId === taskId) {
          this.cleanupWorkDir(workDir);
          this.off('taskComplete', handler);
          this.off('taskFailed', handler);
          if (result.status === 'completed') resolve(result.data || result);
          else reject(new Error(String(result?.error || result?.message || 'Task failed')));
        }
      };
      this.on('taskComplete', handler);
      this.on('taskFailed', handler);
    });
  }

  validateTask(task) {
    const { allowedTaskTypes, blockedCommands, blockedPatterns } = this.config.security;
    if (!allowedTaskTypes.includes(task.type)) return false;
    if (!task.message || task.message.length > 50000) return false;

    const taskStr = task.message.toLowerCase();
    for (const cmd of blockedCommands) {
      if (taskStr.includes(cmd.toLowerCase())) return false;
    }
    for (const pattern of blockedPatterns) {
      if (pattern.test(task.message)) return false;
    }
    return true;
  }

  async createWorkDir(taskId) {
    const workDir = path.join(this.config.security.workDirBase, taskId);
    await fs.mkdir(workDir, { recursive: true });
    await fs.mkdir(path.join(workDir, 'input'), { recursive: true });
    await fs.mkdir(path.join(workDir, 'output'), { recursive: true });
    return workDir;
  }

  async cleanupWorkDir(workDir) {
    try { await fs.rm(workDir, { recursive: true, force: true }); } catch {}
  }

  handleMessage(workerId, msg) {
    const worker = this.workers.get(workerId);
    if (!worker) return;

    switch (msg.type) {
      case 'progress':
        this.emit('taskProgress', { taskId: worker.currentTask?.id, progress: msg.progress, message: msg.message });
        break;
      case 'complete':
        this.completeTask(worker, msg.result);
        break;
      case 'error':
        this.failTask(worker, msg.error);
        break;
      case 'llm-request':
        this.handleLLMRequest(worker, msg.data);
        break;
    }
  }

  async handleLLMRequest(worker, request) {
    if (!this.config.llmProvider) {
      worker.process.send({ type: 'llm-response', id: request.id, error: 'LLM not configured' });
      return;
    }
    try {
      const result = await this.config.llmProvider(request);
      const truncated = result?.length > this.config.security.maxOutputSize
        ? result.slice(0, this.config.security.maxOutputSize) + '\n... [truncated]'
        : result;
      worker.process.send({ type: 'llm-response', id: request.id, result: truncated });
    } catch (err) {
      worker.process.send({ type: 'llm-response', id: request.id, error: err.message });
    }
  }

  completeTask(worker, result) {
    const task = worker.currentTask;
    if (!task) return;
    clearTimeout(task.timeoutId);
    worker.status = 'idle';
    worker.currentTask = null;
    this.running.delete(task.id);
    this.emit('taskComplete', { taskId: task.id, status: 'completed', data: result, duration: Date.now() - task.startTime });
    this.processQueue();
  }

  failTask(worker, error) {
    const task = worker.currentTask;
    if (!task) return;
    clearTimeout(task.timeoutId);
    worker.status = 'idle';
    worker.currentTask = null;
    this.running.delete(task.id);
    const errorMsg = error?.message || (typeof error === 'string' ? error : 'Unknown error');
    this.emit('taskFailed', { taskId: task.id, status: 'failed', error: errorMsg });
    this.processQueue();
  }

  processQueue() {
    const idleWorkers = Array.from(this.workers.values()).filter(w => w.status === 'idle');
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
      task.timeoutId = setTimeout(() => this.terminateTask(task.id, 'timeout'), task.timeout);
    }
    if (this.queue.length > 2 && this.workers.size < this.config.concurrency.max) {
      this.spawnWorker().catch(() => {});
    }
  }

  terminateTask(taskId, reason) {
    const running = this.running.get(taskId);
    if (!running) return;
    this.stats.timeoutKills++;
    running.worker.process.send({ type: 'shutdown' });
    this.emit('taskTimeout', { taskId, reason });
  }

  handleExit(workerId, code) {
    const worker = this.workers.get(workerId);
    if (!worker) return;
    if (worker.currentTask) this.failTask(worker, new Error(`Worker exited: ${code}`));
    this.workers.delete(workerId);
    if (this.workers.size < this.config.concurrency.min) {
      setTimeout(() => this.spawnWorker().catch(() => {}), 1000);
    }
  }

  handleError(workerId, err) {
    const worker = this.workers.get(workerId);
    if (worker && worker.currentTask) this.failTask(worker, err);
    this.workers.delete(workerId);
    this.spawnWorker().catch(() => {});
  }

  async destroy() {
    this.queue = [];
    for (const [taskId] of this.running) this.terminateTask(taskId, 'shutdown');
    await new Promise(r => setTimeout(r, 3000));
    for (const worker of this.workers.values()) worker.process.kill('SIGKILL');
  }

  getStats() {
    return { ...this.stats, workers: this.workers.size, queue: this.queue.length, running: this.running.size };
  }
}

/**
 * 主分发器 - 集成版
 * 方案 A：TaskDispatcher 分流 + Sandbox-Agent 执行
 */
class IntegratedDispatcher extends EventEmitter {
  constructor(config = {}) {
    super();
    this.sandboxPool = new SandboxPool(config);
    this.llmProvider = config.llmProvider || null;
  }

  async initialize() {
    await this.sandboxPool.initialize();

    this.sandboxPool.on('taskComplete', (data) => {
      this.emit('notification', {
        type: 'task_complete',
        taskId: data.taskId,
        result: data.data,
        message: `任务已完成 (${data.duration}ms)`
      });
    });

    this.sandboxPool.on('taskFailed', (data) => {
      this.emit('notification', {
        type: 'task_failed',
        taskId: data.taskId,
        error: data.error,
        message: `任务失败: ${data.error}`
      });
    });

    this.emit('ready', { workers: this.sandboxPool.workers.size });
  }

  /**
   * 评估任务复杂度
   */
  estimate(message) {
    return TaskEstimator.estimate(message);
  }

  /**
   * 分发任务
   * 1. 评估复杂度
   * 2. 简单任务立即执行
   * 3. 复杂任务交给沙盒执行
   */
  async dispatch(message, options = {}) {
    const estimation = TaskEstimator.estimate(message);

    if (!estimation.shouldBackground) {
      // 简单任务 - 立即执行
      this.emit('log', { type: 'immediate', message, estimation });

      const result = await this.executeImmediate(message, options);

      return {
        mode: 'immediate',
        estimatedTime: estimation.estimatedTime,
        result
      };
    } else {
      // 复杂任务 - 沙盒执行
      this.emit('log', { type: 'background', message, estimation });

      const taskPromise = this.sandboxPool.execute({
        type: options.type || 'query',
        message,
        model: options.model
      });

      return {
        mode: 'background',
        estimatedTime: estimation.estimatedTime,
        message: `任务已后台执行（预估${estimation.estimatedTime}秒）`,
        promise: taskPromise
      };
    }
  }

  async executeImmediate(message, options = {}) {
    if (this.llmProvider) {
      // 统一 LLM 调用格式，与 Worker 中的 callLLM 一致
      return await this.llmProvider({
        messages: [
          { role: 'system', content: '你是一个 helpful 的助手。' },
          { role: 'user', content: message }
        ],
        model: options.model,
        temperature: 0.7,
        maxTokens: 2000
      });
    }
    return { type: 'immediate', message };
  }

  getStats() {
    return {
      estimation: TaskEstimator,
      sandbox: this.sandboxPool.getStats()
    };
  }

  async destroy() {
    await this.sandboxPool.destroy();
  }
}

module.exports = { IntegratedDispatcher, TaskEstimator, SandboxPool };
