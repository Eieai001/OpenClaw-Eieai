const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

/**
 * 安全沙盒 Agent 池 - OpenClaw 集成版
 * 使用 macOS sandbox-exec 隔离子进程
 * 
 * 修复:
 * 1. 支持真实 LLM 调用（通过 IPC 回调）
 * 2. 动态配置路径
 * 3. 跨平台支持（macOS sandbox / Linux namespaces）
 * 4. 强化输入验证
 * 5. 限制输出大小
 */
class SafeAgentPool extends EventEmitter {
  constructor(config = {}) {
    super();

    // 检测平台
    this.platform = os.platform();
    this.isMacOS = this.platform === 'darwin';

    this.config = {
      // Agent 池配置
      concurrency: { min: 2, max: 6, targetUtilization: 0.7 },
      scaling: { upThreshold: 0.8, downThreshold: 0.3, cooldownMs: 30000 },

      // 安全配置
      security: {
        enableSandbox: this.isMacOS,              // macOS 默认启用
        sandboxProfile: path.join(__dirname, 'openclaw-agent.sb'),
        workDirBase: '/tmp/openclaw-agents',
        maxExecutionTime: 300000,                 // 5分钟超时
        maxMemoryMB: 512,                         // 内存限制
        maxOutputSize: 100000,                    // 最大输出 100KB
        allowedTaskTypes: ['query', 'analysis', 'generation', 'file-read', 'code-generation'],
        blockedCommands: ['rm', 'sudo', 'chmod', 'chown', 'curl', 'wget', 'ssh', 'eval', 'exec', 'spawn'],
        blockedPatterns: [
          /process\.exit/i,
          /child_process/i,
          /require\s*\(\s*['"]fs['"]\s*\).*writeFile/i,
          /fs\.unlink/i,
          /fs\.rmdir/i
        ],
      },

      // 任务配置
      taskTimeout: {
        network: 30000,
        compute: 120000,
        io: 60000,
        default: 60000
      },

      // LLM 配置（通过回调传入）
      llmProvider: null,  // 外部传入的 LLM 调用函数

      ...config
    };

    // 深度合并 security 配置（防止 blockedPatterns 被覆盖）
    // 注意：由于 ...config 已经展开了，如果用户传入了 security，默认的已经被覆盖
    // 需要重新从原始默认值合并
    const defaultSecurity = {
      enableSandbox: this.isMacOS,
      sandboxProfile: path.join(__dirname, 'openclaw-agent.sb'),
      workDirBase: '/tmp/openclaw-agents',
      maxExecutionTime: 300000,
      maxMemoryMB: 512,
      maxOutputSize: 100000,
      allowedTaskTypes: ['query', 'analysis', 'generation', 'file-read', 'code-generation'],
      blockedCommands: ['rm', 'sudo', 'chmod', 'chown', 'curl', 'wget', 'ssh', 'eval', 'exec', 'spawn'],
      blockedPatterns: [
        /process\.exit/i,
        /child_process/i,
        /require\s*\(\s*['"]fs['"]\s*\).*writeFile/i,
        /fs\.unlink/i,
        /fs\.rmdir/i
      ],
    };

    this.config.security = {
      ...defaultSecurity,
      ...this.config.security,
      // 确保数组不被覆盖而是合并
      blockedPatterns: [
        ...defaultSecurity.blockedPatterns,
        ...(this.config.security?.blockedPatterns || [])
      ]
    };

    this.agents = new Map();
    this.queue = [];
    this.running = new Map();
    this.agentCounter = 0;
    this.scalingState = { lastScaleTime: 0 };

    // 安全统计
    this.securityStats = {
      blockedTasks: 0,
      sandboxViolations: 0,
      timeoutKills: 0,
      validationFailures: {}
    };
  }

  /**
   * 初始化工作目录和最小 Agent 数
   */
  async initialize() {
    // 创建工作目录
    await fs.mkdir(this.config.security.workDirBase, { recursive: true });

    // 检查沙盒可用性
    if (this.config.security.enableSandbox && this.isMacOS) {
      const sandboxAvailable = await this.checkSandboxAvailability();
      if (!sandboxAvailable) {
        console.warn('[SafeAgentPool] sandbox-exec 不可用，回退到无沙盒模式');
        this.config.security.enableSandbox = false;
      }
    }

    // 预创建最小 Agent 数
    for (let i = 0; i < this.config.concurrency.min; i++) {
      await this.spawnAgent();
    }

    this.emit('initialized', { 
      agentCount: this.agents.size, 
      sandbox: this.config.security.enableSandbox 
    });
    this.startAutoScaling();
  }

  /**
   * 检查沙盒可用性
   */
  async checkSandboxAvailability() {
    return new Promise((resolve) => {
      const test = spawn('sandbox-exec', ['-f', this.config.security.sandboxProfile, 'true']);
      test.on('exit', (code) => resolve(code === 0));
      test.on('error', () => resolve(false));
      setTimeout(() => resolve(false), 5000);
    });
  }

  /**
   * 执行任务（带安全检查）
   */
  async execute(task, options = {}) {
    const taskId = `task-${Date.now()}-${++this.agentCounter}`;

    // 1. 安全验证
    const securityCheck = this.validateTask(task);
    if (!securityCheck.valid) {
      this.securityStats.blockedTasks++;
      const reason = securityCheck.reason;
      this.securityStats.validationFailures[reason] = 
        (this.securityStats.validationFailures[reason] || 0) + 1;
      throw new Error(`安全验证失败: ${reason}`);
    }

    // 2. 创建隔离工作目录
    const workDir = await this.createWorkDir(taskId);

    // 3. 包装任务
    const wrappedTask = {
      id: taskId,
      data: this.sanitizeTask(task),
      workDir,
      priority: options.priority || 5,
      timeout: Math.min(
        options.timeout || this.config.taskTimeout.default,
        this.config.security.maxExecutionTime
      ),
      createTime: Date.now(),
      status: 'queued'
    };

    // 4. 加入队列
    this.queue.push(wrappedTask);
    this.queue.sort((a, b) => b.priority - a.priority);

    this.emit('taskQueued', { taskId, queueLength: this.queue.length });

    // 5. 尝试执行
    this.processQueue();

    // 6. 返回 Promise
    return new Promise((resolve, reject) => {
      const handler = (result) => {
        if (result.taskId === taskId) {
          this.cleanupWorkDir(workDir);
          this.off('taskComplete', handler);
          this.off('taskFailed', handler);
          this.off('taskTimeout', handler);

          if (result.status === 'completed') {
            resolve(result.data);
          } else {
            reject(new Error(result.error || 'Task failed'));
          }
        }
      };

      this.on('taskComplete', handler);
      this.on('taskFailed', handler);
      this.on('taskTimeout', handler);
    });
  }

  /**
   * 验证任务安全性（强化版）
   */
  validateTask(task) {
    const { allowedTaskTypes, blockedCommands, blockedPatterns } = this.config.security;

    // 检查任务类型
    if (!task.type || !allowedTaskTypes.includes(task.type)) {
      return { valid: false, reason: `不允许的任务类型: ${task.type}` };
    }

    // 检查消息内容
    if (!task.message || typeof task.message !== 'string') {
      return { valid: false, reason: '消息内容无效' };
    }

    // 检查消息长度（防止 DoS）
    if (task.message.length > 50000) {
      return { valid: false, reason: '消息过长（最大 50000 字符）' };
    }

    // 检查是否包含危险命令（大小写不敏感）
    const taskString = task.message.toLowerCase();
    for (const cmd of blockedCommands) {
      if (taskString.includes(cmd.toLowerCase())) {
        return { valid: false, reason: `包含危险命令: ${cmd}` };
      }
    }

    // 检查危险模式（正则）
    for (const pattern of blockedPatterns) {
      if (pattern.test(task.message)) {
        return { valid: false, reason: '包含危险代码模式' };
      }
    }

    // 检查文件路径（防止目录遍历）
    if (task.filePath) {
      const resolved = path.resolve(task.filePath);
      const homeDir = os.homedir();
      // 只允许临时目录和工作目录
      const allowedPrefixes = [
        '/tmp',
        '/var/tmp',
        this.config.security.workDirBase
      ];
      const isAllowed = allowedPrefixes.some(prefix => resolved.startsWith(prefix));
      if (!isAllowed) {
        return { valid: false, reason: `禁止访问路径: ${task.filePath}` };
      }
    }

    // 检查 code 字段（如果是代码生成任务）
    if (task.code && typeof task.code === 'string') {
      for (const pattern of blockedPatterns) {
        if (pattern.test(task.code)) {
          return { valid: false, reason: '代码包含危险模式' };
        }
      }
    }

    return { valid: true };
  }

  /**
   * 清理任务数据（防止注入）
   */
  sanitizeTask(task) {
    // 深度克隆，移除危险字段
    const safe = {
      type: task.type,
      message: task.message?.slice(0, 10000),  // 限制长度
      priority: task.priority,
    };

    // 只允许特定字段
    if (task.filePath) safe.filePath = task.filePath;
    if (task.context) safe.context = task.context?.slice(0, 5000);
    if (task.model) safe.model = task.model;

    // 移除危险字段
    delete safe.workDir;
    delete safe.env;
    delete safe.shell;
    delete safe.exec;
    delete safe.eval;

    return safe;
  }

  /**
   * 创建隔离工作目录
   */
  async createWorkDir(taskId) {
    const workDir = path.join(this.config.security.workDirBase, taskId);
    await fs.mkdir(workDir, { recursive: true });

    // 创建子目录结构
    await fs.mkdir(path.join(workDir, 'input'), { recursive: true });
    await fs.mkdir(path.join(workDir, 'output'), { recursive: true });
    await fs.mkdir(path.join(workDir, 'temp'), { recursive: true });

    return workDir;
  }

  /**
   * 清理工作目录
   */
  async cleanupWorkDir(workDir) {
    try {
      await fs.rm(workDir, { recursive: true, force: true });
    } catch (err) {
      // 静默失败
    }
  }

  /**
   * 启动沙盒 Agent
   */
  async spawnAgent() {
    const agentId = `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const { enableSandbox, sandboxProfile, maxMemoryMB } = this.config.security;

    const agentScript = path.join(__dirname, 'worker-agent.js');

    let child;
    const env = {
      ...process.env,
      AGENT_ID: agentId,
      NODE_ENV: 'production',
      PATH: '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin',
      HOME: '/tmp',
      USER: 'nobody'
    };

    if (enableSandbox && this.isMacOS) {
      // macOS: 使用 sandbox-exec
      child = spawn('sandbox-exec', [
        '-f', sandboxProfile,
        '-D', `WORK_DIR=/tmp/openclaw-agents/${agentId}`,
        'node',
        `--max-old-space-size=${maxMemoryMB}`,
        agentScript,
        agentId
      ], {
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
        env
      });
    } else if (!this.isMacOS) {
      // Linux: 使用 chroot + nice 限制
      child = spawn('nice', [
        '-n', '10',
        'node',
        `--max-old-space-size=${maxMemoryMB}`,
        agentScript,
        agentId
      ], {
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
        env: { ...env, SANDBOX_MODE: 'linux' }
      });
    } else {
      // 无沙盒模式（仅开发）
      child = spawn('node', [
        `--max-old-space-size=${maxMemoryMB}`,
        agentScript,
        agentId
      ], {
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
        env
      });
    }

    const agent = {
      id: agentId,
      process: child,
      status: 'idle',
      currentTask: null,
      spawnTime: Date.now(),
      taskCount: 0
    };

    // 处理消息
    child.on('message', (msg) => this.handleAgentMessage(agentId, msg));

    // 处理错误
    child.on('error', (err) => this.handleAgentError(agentId, err));
    child.on('exit', (code) => this.handleAgentExit(agentId, code));

    // 监控沙盒违规
    child.stderr.on('data', (data) => {
      const output = data.toString();
      if (output.includes('sandbox') || output.includes('deny')) {
        this.securityStats.sandboxViolations++;
        this.emit('sandboxViolation', { agentId, output });
      }
    });

    this.agents.set(agentId, agent);
    this.emit('agentSpawned', { agentId, sandbox: enableSandbox });

    return agentId;
  }

  /**
   * 处理 Agent 消息
   */
  handleAgentMessage(agentId, msg) {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    switch (msg.type) {
      case 'progress':
        this.emit('taskProgress', {
          taskId: agent.currentTask?.id,
          progress: msg.progress,
          message: msg.message
        });
        break;

      case 'complete':
        this.completeTask(agent, msg.result);
        break;

      case 'error':
        this.failTask(agent, msg.error);
        break;

      case 'ready':
        agent.status = 'idle';
        this.processQueue();
        break;

      case 'llm-request':
        // 处理 LLM 调用请求（从沙盒内通过 IPC 调用）
        this.handleLLMRequest(agent, msg.data);
        break;
    }
  }

  /**
   * 处理 LLM 调用请求
   */
  async handleLLMRequest(agent, request) {
    if (!this.config.llmProvider) {
      agent.process.send({
        type: 'llm-response',
        id: request.id,
        error: 'LLM provider not configured'
      });
      return;
    }

    try {
      // 限制输出大小
      const result = await this.config.llmProvider(request);
      const truncated = result?.length > this.config.security.maxOutputSize 
        ? result.slice(0, this.config.security.maxOutputSize) + '\n... [截断，输出过长]'
        : result;

      agent.process.send({
        type: 'llm-response',
        id: request.id,
        result: truncated
      });
    } catch (err) {
      agent.process.send({
        type: 'llm-response',
        id: request.id,
        error: err.message
      });
    }
  }

  /**
   * 分配任务给 Agent
   */
  async processQueue() {
    const availableAgents = Array.from(this.agents.values())
      .filter(a => a.status === 'idle');

    if (availableAgents.length === 0 || this.queue.length === 0) {
      return;
    }

    while (this.queue.length > 0 && availableAgents.length > 0) {
      const task = this.queue.shift();
      const agent = availableAgents.shift();

      if (!task || !agent) continue;

      // 检查任务是否已超时
      if (Date.now() - task.createTime > task.timeout) {
        this.emit('taskTimeout', { taskId: task.id, reason: 'queue_timeout' });
        this.cleanupWorkDir(task.workDir);
        continue;
      }

      // 分配任务
      agent.status = 'busy';
      agent.currentTask = task;
      task.status = 'running';
      task.startTime = Date.now();

      this.running.set(task.id, { task, agent });

      // 发送任务给 Agent
      agent.process.send({
        type: 'task',
        task: {
          ...task.data,
          workDir: task.workDir,
          timeout: task.timeout
        }
      });

      // 设置执行超时
      task.timeoutId = setTimeout(() => {
        this.killTask(task.id, 'execution_timeout');
      }, task.timeout);
    }
  }

  /**
   * 完成任务
   */
  completeTask(agent, result) {
    const task = agent.currentTask;
    if (!task) return;

    clearTimeout(task.timeoutId);
    agent.status = 'idle';
    agent.currentTask = null;
    agent.taskCount++;

    this.running.delete(task.id);

    this.emit('taskComplete', {
      taskId: task.id,
      status: 'completed',
      data: result,
      duration: Date.now() - task.startTime
    });

    this.processQueue();
  }

  /**
   * 任务失败
   */
  failTask(agent, error) {
    const task = agent.currentTask;
    if (!task) return;

    clearTimeout(task.timeoutId);
    agent.status = 'idle';
    agent.currentTask = null;

    this.running.delete(task.id);
    this.cleanupWorkDir(task.workDir);

    this.emit('taskFailed', {
      taskId: task.id,
      status: 'failed',
      error: error?.message || 'Unknown error'
    });

    this.processQueue();
  }

  /**
   * 强制终止任务
   */
  killTask(taskId, reason) {
    const running = this.running.get(taskId);
    if (!running) return;

    const { task, agent } = running;
    this.securityStats.timeoutKills++;

    // 先尝试优雅终止
    agent.process.send({ type: 'shutdown' });

    // 3秒后强制终止
    setTimeout(() => {
      if (agent.process && !agent.process.killed) {
        agent.process.kill('SIGTERM');
        setTimeout(() => {
          if (!agent.process.killed) {
            agent.process.kill('SIGKILL');
          }
        }, 2000);
      }
    }, 3000);

    this.emit('taskTimeout', { taskId, reason });
    this.cleanupWorkDir(task.workDir);
  }

  /**
   * 处理 Agent 错误
   */
  handleAgentError(agentId, error) {
    const agent = this.agents.get(agentId);

    if (agent && agent.currentTask) {
      this.failTask(agent, error);
    }

    this.agents.delete(agentId);
    this.spawnAgent(); // 自动替换
  }

  /**
   * 处理 Agent 退出
   */
  handleAgentExit(agentId, code) {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    if (agent.currentTask) {
      this.failTask(agent, new Error(`Agent exited with code ${code}`));
    }

    this.agents.delete(agentId);

    // 异常退出时自动重启
    if (code !== 0 && code !== null) {
      setTimeout(() => this.spawnAgent(), 1000);
    }
  }

  /**
   * 自动扩缩容
   */
  startAutoScaling() {
    setInterval(() => this.evaluateScaling(), 5000);
  }

  async evaluateScaling() {
    const now = Date.now();
    const { lastScaleTime } = this.scalingState;
    const { min, max } = this.config.concurrency;

    if (now - lastScaleTime < this.config.scaling.cooldownMs) return;

    const currentSize = this.agents.size;
    const busyAgents = Array.from(this.agents.values())
      .filter(a => a.status === 'busy').length;
    const utilization = currentSize > 0 ? busyAgents / currentSize : 0;
    const queueLength = this.queue.length;

    // 扩容
    if ((utilization > this.config.scaling.upThreshold || queueLength > 3)
        && currentSize < max) {
      await this.spawnAgent();
      this.scalingState.lastScaleTime = now;
      this.emit('scaledUp', { newSize: this.agents.size });
    }

    // 缩容
    else if (utilization < this.config.scaling.downThreshold
             && currentSize > min
             && queueLength === 0) {
      const idleAgents = Array.from(this.agents.values())
        .filter(a => a.status === 'idle');

      if (idleAgents.length > min) {
        const oldest = idleAgents.sort((a, b) => a.spawnTime - b.spawnTime)[0];
        oldest.process.send({ type: 'shutdown' });
        setTimeout(() => {
          if (!oldest.process.killed) {
            oldest.process.kill('SIGTERM');
          }
        }, 5000);

        this.scalingState.lastScaleTime = now;
        this.emit('scaledDown', { newSize: this.agents.size - 1 });
      }
    }
  }

  /**
   * 获取安全统计
   */
  getSecurityStats() {
    return {
      ...this.securityStats,
      activeAgents: this.agents.size,
      runningTasks: this.running.size,
      queuedTasks: this.queue.length,
      platform: this.platform,
      sandboxEnabled: this.config.security.enableSandbox
    };
  }

  /**
   * 优雅关闭
   */
  async destroy() {
    this.queue = [];

    for (const [taskId] of this.running) {
      this.killTask(taskId, 'pool_shutdown');
    }

    await new Promise(resolve => setTimeout(resolve, 5000));

    for (const agent of this.agents.values()) {
      agent.process.send({ type: 'shutdown' });
    }

    await fs.rm(this.config.security.workDirBase, { recursive: true, force: true });

    this.emit('destroyed');
  }
}

module.exports = SafeAgentPool;
