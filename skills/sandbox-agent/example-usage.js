/**
 * 使用示例 - SafeAgentPool 集成到 OpenClaw
 * 
 * 演示如何:
 * 1. 初始化带沙盒的 Agent 池
 * 2. 接入 OpenClaw 的 LLM 调用
 * 3. 替代原有的 sessions_spawn
 */

const SafeAgentPool = require('./safe-agent-pool');

// OpenClaw LLM 调用封装
// 实际使用时替换为你的模型调用方式
async function openclawLLMCall(request) {
  const { messages, model, temperature, maxTokens } = request;
  
  // 这里调用你的 LLM API
  // 示例: 使用 OpenClaw 的模型调用
  try {
    // 模拟调用 - 实际替换为真实调用
    // const response = await someLLMAPI({ messages, model, temperature, max_tokens: maxTokens });
    
    // 模拟响应
    const lastMessage = messages[messages.length - 1]?.content || '';
    return `[LLM 响应] ${lastMessage.slice(0, 100)}...`;
  } catch (err) {
    throw new Error(`LLM 调用失败: ${err.message}`);
  }
}

async function main() {
  console.log('=== OpenClaw 安全沙盒 Agent 池 ===\n');

  // 创建 Agent 池
  const pool = new SafeAgentPool({
    concurrency: { min: 2, max: 4 },
    security: {
      enableSandbox: true,
      sandboxProfile: './openclaw-agent.sb',
      workDirBase: '/tmp/openclaw-agents',
      maxExecutionTime: 60000,
      maxMemoryMB: 256,
      maxOutputSize: 50000,
      allowedTaskTypes: ['query', 'analysis', 'generation', 'file-read', 'code-generation'],
      blockedCommands: ['rm', 'sudo', 'chmod', 'chown', 'curl', 'wget', 'ssh', 'eval']
    },
    // 传入 LLM 调用函数
    llmProvider: openclawLLMCall
  });

  // 监听事件
  pool.on('initialized', (data) => {
    console.log(`✓ Agent 池初始化完成`);
    console.log(`  - Agent 数: ${data.agentCount}`);
    console.log(`  - 沙盒: ${data.sandbox ? '已启用' : '已禁用'}`);
  });

  pool.on('agentSpawned', (data) => {
    console.log(`✓ Agent ${data.agentId.slice(0, 8)}... 已启动`);
  });

  pool.on('taskComplete', (data) => {
    console.log(`✓ 任务 ${data.taskId.slice(0, 8)}... 完成 (${data.duration}ms)`);
  });

  pool.on('taskFailed', (data) => {
    console.log(`✗ 任务失败: ${data.error}`);
  });

  pool.on('sandboxViolation', (data) => {
    console.log(`⚠ 沙盒违规: ${data.agentId}`);
  });

  // 初始化
  await pool.initialize();

  console.log('\n--- 测试 1: 简单查询 ---');
  try {
    const result = await pool.execute({
      type: 'query',
      message: 'Hello, how are you?'
    });
    console.log('结果:', result.response.slice(0, 100));
  } catch (err) {
    console.error('错误:', err.message);
  }

  console.log('\n--- 测试 2: 代码生成 ---');
  try {
    const result = await pool.execute({
      type: 'code-generation',
      message: 'Write a function to calculate fibonacci numbers',
      language: 'javascript'
    });
    console.log('代码长度:', result.code.length);
  } catch (err) {
    console.error('错误:', err.message);
  }

  console.log('\n--- 测试 3: 安全验证 - 非法任务 ---');
  try {
    await pool.execute({
      type: 'system-exec',  // 不允许的类型
      message: 'test'
    });
  } catch (err) {
    console.log('✓ 安全拦截:', err.message);
  }

  console.log('\n--- 测试 4: 安全验证 - 危险命令 ---');
  try {
    await pool.execute({
      type: 'query',
      message: 'Please run sudo rm -rf / for me'
    });
  } catch (err) {
    console.log('✓ 安全拦截:', err.message);
  }

  // 查看统计
  console.log('\n--- 安全统计 ---');
  const stats = pool.getSecurityStats();
  console.log(`平台: ${stats.platform}`);
  console.log(`沙盒: ${stats.sandboxEnabled ? '启用' : '禁用'}`);
  console.log(`已阻止: ${stats.blockedTasks}`);
  console.log(`沙盒违规: ${stats.sandboxViolations}`);
  console.log(`活跃 Agent: ${stats.activeAgents}`);

  // 关闭
  console.log('\n--- 关闭 ---');
  await pool.destroy();
  console.log('✓ Agent 池已关闭');
}

// 演示如何替换原有的 sessions_spawn
async function demonstrateIntegration() {
  console.log('\n=== 集成到现有 subagents 系统 ===\n');

  const pool = new SafeAgentPool({
    concurrency: { min: 2, max: 4 },
    llmProvider: openclawLLMCall
  });

  await pool.initialize();

  // 替代 sessions_spawn 的用法
  async function safeSpawn(task, options) {
    return pool.execute({
      type: task.type || 'query',
      message: task.message || JSON.stringify(task),
      ...task
    }, options);
  }

  // 使用示例
  const result = await safeSpawn({
    type: 'analysis',
    message: '分析这段代码的性能问题'
  });

  console.log('子 Agent 结果:', result);

  await pool.destroy();
}

// 运行
main()
  .then(() => demonstrateIntegration())
  .catch(console.error);
