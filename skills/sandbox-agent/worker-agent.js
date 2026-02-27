#!/usr/bin/env node
/**
 * Worker Agent - OpenClaw 集成版
 * 运行在沙盒中的子进程，通过 IPC 调用外部 LLM
 * 
 * 修复:
 * 1. 支持真实 LLM 调用（通过 IPC 回调父进程）
 * 2. 支持多种任务类型
 * 3. 强化错误处理
 */

const path = require('path');
const fs = require('fs').promises;

const AGENT_ID = process.argv[2] || 'unknown';
const SANDBOX_MODE = process.env.SANDBOX_MODE || 'macos';

let currentTask = null;
let shutdownRequested = false;
let llmRequestId = 0;
const pendingLLMRequests = new Map();

// 向父进程报告就绪
process.send({ type: 'ready', agentId: AGENT_ID });

// 处理父进程消息
process.on('message', async (msg) => {
  switch (msg.type) {
    case 'task':
      if (currentTask) {
        process.send({
          type: 'error',
          error: 'Already processing a task'
        });
        return;
      }
      await handleTask(msg.task);
      break;

    case 'shutdown':
      shutdownRequested = true;
      if (!currentTask) {
        process.exit(0);
      }
      break;

    case 'llm-response':
      // 接收 LLM 调用结果
      const pending = pendingLLMRequests.get(msg.id);
      if (pending) {
        pendingLLMRequests.delete(msg.id);
        if (msg.error) {
          pending.reject(new Error(msg.error));
        } else {
          pending.resolve(msg.result);
        }
      }
      break;
  }
});

/**
 * 调用 LLM（通过 IPC 请求父进程）
 */
async function callLLM(messages, options = {}) {
  return new Promise((resolve, reject) => {
    const id = ++llmRequestId;
    const timeout = setTimeout(() => {
      pendingLLMRequests.delete(id);
      reject(new Error('LLM request timeout'));
    }, options.timeout || 60000);

    pendingLLMRequests.set(id, {
      resolve: (result) => {
        clearTimeout(timeout);
        resolve(result);
      },
      reject: (err) => {
        clearTimeout(timeout);
        reject(err);
      }
    });

    process.send({
      type: 'llm-request',
      data: {
        id,
        messages,
        model: options.model,
        temperature: options.temperature,
        maxTokens: options.maxTokens || 4000
      }
    });
  });
}

// 处理任务
async function handleTask(task) {
  currentTask = task;
  const startTime = Date.now();

  try {
    sendProgress(10, '开始处理任务');

    let result;

    switch (task.type) {
      case 'query':
        result = await handleQuery(task);
        break;

      case 'analysis':
        result = await handleAnalysis(task);
        break;

      case 'generation':
        result = await handleGeneration(task);
        break;

      case 'code-generation':
        result = await handleCodeGeneration(task);
        break;

      case 'file-read':
        result = await handleFileRead(task);
        break;

      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }

    const duration = Date.now() - startTime;

    process.send({
      type: 'complete',
      result: {
        data: result,
        duration,
        agentId: AGENT_ID,
        sandboxMode: SANDBOX_MODE
      }
    });

  } catch (error) {
    process.send({
      type: 'error',
      error: {
        message: error.message,
        stack: error.stack
      }
    });
  } finally {
    currentTask = null;
    if (shutdownRequested) {
      process.exit(0);
    }
  }
}

// 查询任务 - 调用 LLM
async function handleQuery(task) {
  sendProgress(30, '调用 LLM');

  const response = await callLLM([
    { role: 'system', content: '你是一个 helpful 的助手，简洁回答用户问题。' },
    { role: 'user', content: task.message }
  ], {
    model: task.model,
    temperature: 0.7,
    maxTokens: 2000
  });

  sendProgress(90, '整理结果');

  return {
    type: 'query',
    query: task.message,
    response,
    timestamp: new Date().toISOString()
  };
}

// 分析任务 - 调用 LLM 分析文件
async function handleAnalysis(task) {
  sendProgress(20, '读取数据');

  let inputData = '';
  if (task.filePath || task.inputFile) {
    const inputPath = task.filePath 
      ? path.resolve(task.filePath)
      : path.join(task.workDir, 'input', path.basename(task.inputFile));
    
    inputData = await fs.readFile(inputPath, 'utf-8');
    // 限制输入大小
    if (inputData.length > 50000) {
      inputData = inputData.slice(0, 50000) + '\n... [内容截断]';
    }
  }

  sendProgress(50, 'LLM 分析中...');

  const response = await callLLM([
    { role: 'system', content: '你是一个数据分析助手。分析提供的内容并给出结构化报告。' },
    { role: 'user', content: `请分析以下内容:\n\n${inputData}\n\n分析要求: ${task.message}` }
  ], {
    model: task.model,
    temperature: 0.3,
    maxTokens: 4000
  });

  sendProgress(90, '生成报告');

  // 写入输出文件
  const outputPath = path.join(task.workDir, 'output', 'analysis-result.txt');
  await fs.writeFile(outputPath, response, 'utf-8');

  return {
    type: 'analysis',
    summary: response.slice(0, 500),
    fullResult: response,
    outputFile: outputPath,
    inputSize: inputData.length
  };
}

// 生成任务 - 调用 LLM 生成内容
async function handleGeneration(task) {
  sendProgress(30, 'LLM 生成中');

  const response = await callLLM([
    { role: 'system', content: '你是一个内容生成助手。根据要求生成高质量内容。' },
    { role: 'user', content: task.message }
  ], {
    model: task.model,
    temperature: 0.8,
    maxTokens: 4000
  });

  sendProgress(80, '保存结果');

  // 写入文件
  const outputPath = path.join(task.workDir, 'output', 'generated.txt');
  await fs.writeFile(outputPath, response, 'utf-8');

  sendProgress(100, '完成');

  return {
    type: 'generation',
    content: response,
    outputFile: outputPath,
    length: response.length
  };
}

// 代码生成任务
async function handleCodeGeneration(task) {
  sendProgress(30, 'LLM 生成代码');

  const response = await callLLM([
 { role: 'system', content: '你是一个编程助手。只输出代码，不输出解释。' },
    { role: 'user', content: `请生成以下代码:\n${task.message}` }
  ], {
    model: task.model,
    temperature: 0.2,
    maxTokens: 4000
  });

  sendProgress(80, '保存代码');

  // 提取代码块
  const codeMatch = response.match(/```(?:\w+)?\n([\s\S]*?)```/);
  const code = codeMatch ? codeMatch[1].trim() : response;

  // 写入文件
  const extension = task.language === 'python' ? 'py' : 
                    task.language === 'javascript' ? 'js' : 'txt';
  const outputPath = path.join(task.workDir, 'output', `generated.${extension}`);
  await fs.writeFile(outputPath, code, 'utf-8');

  sendProgress(100, '完成');

  return {
    type: 'code-generation',
    code,
    language: task.language || 'auto',
    outputFile: outputPath
  };
}

// 文件读取任务
async function handleFileRead(task) {
  if (!task.filePath) {
    throw new Error('No file path provided');
  }

  // 安全检查
  const allowedDirs = [
    task.workDir,
    '/tmp',
    '/var/tmp'
  ];

  const resolvedPath = path.resolve(task.filePath);
  const isAllowed = allowedDirs.some(dir => resolvedPath.startsWith(dir));

  if (!isAllowed) {
    throw new Error('Access denied: file outside allowed directories');
  }

  sendProgress(50, '读取文件');

  const content = await fs.readFile(resolvedPath, 'utf-8');

  // 限制输出大小
  const preview = content.length > 10000 
    ? content.slice(0, 10000) + '\n... [文件过大，已截断]'
    : content;

  sendProgress(100, '完成');

  return {
    type: 'file-read',
    path: resolvedPath,
    size: content.length,
    preview
  };
}

// 发送进度
function sendProgress(progress, message) {
  process.send({
    type: 'progress',
    progress,
    message
  });
}

// 错误处理
process.on('uncaughtException', (err) => {
  console.error('[Worker] Uncaught exception:', err);
  process.send({
    type: 'error',
    error: { message: err.message, stack: err.stack }
  });
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('[Worker] Unhandled rejection:', err);
  process.send({
    type: 'error',
    error: { message: err?.message || 'Unknown error', stack: err?.stack }
  });
});

// 定期心跳
setInterval(() => {
  process.send({
    type: 'heartbeat',
    agentId: AGENT_ID,
    status: currentTask ? 'busy' : 'idle',
    pendingLLM: pendingLLMRequests.size
  });
}, 30000);
