#!/usr/bin/env node
/**
 * OpenClaw 工作进程 - MVP 版本
 *
 * 实际执行后台任务
 */

const WORKER_ID = process.env.WORKER_ID || 'unknown';
let currentTask = null;
let shutdownRequested = false;

// 通知父进程就绪
process.send({ type: 'ready', workerId: WORKER_ID });

// 处理任务
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
  }
});

async function handleTask(task) {
  currentTask = task;
  const startTime = Date.now();

  try {
    sendProgress(10, '开始处理');

    // 模拟处理逻辑
    // 实际使用时，这里调用 LLM 或其他处理
    const result = await processMessage(task.message, task.context);

    const duration = Date.now() - startTime;

    process.send({
      type: 'complete',
      result: {
        type: 'background_task',
        originalMessage: task.message,
        result,
        duration,
        workerId: WORKER_ID
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

async function processMessage(message, context) {
  // 进度模拟
  sendProgress(30, '分析需求');
  await sleep(500);

  sendProgress(50, '执行任务');
  await sleep(1000);

  sendProgress(80, '整理结果');
  await sleep(300);

  sendProgress(100, '完成');

  // 返回结果
  return {
    summary: `已完成: ${message.slice(0, 50)}...`,
    details: '这里是任务的详细结果',
    timestamp: new Date().toISOString()
  };
}

function sendProgress(progress, message) {
  process.send({
    type: 'progress',
    progress,
    message
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 错误处理
process.on('uncaughtException', (err) => {
  console.error('Uncaught:', err);
  process.send({ type: 'error', error: { message: err.message } });
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled:', err);
  process.send({ type: 'error', error: { message: err?.message || 'Unknown' } });
});
