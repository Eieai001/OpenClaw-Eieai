/**
 * 任务分发器使用示例
 */

const { TaskDispatcher, TaskEstimator } = require('./mvp-task-dispatcher');

async function main() {
  console.log('=== OpenClaw 任务分发器 MVP 测试 ===\n');

  // 测试复杂度评估
  console.log('--- 复杂度评估测试 ---');
  const testMessages = [
    '你好',
    '查询当前时间',
    '分析这个项目的性能瓶颈',
    '抓取汽车之家100张图片',
    '写个Python脚本批量重命名文件',
    '搜索所有关于机器学习的论文并总结'
  ];

  for (const msg of testMessages) {
    const est = TaskEstimator.estimate(msg);
    console.log(`${est.shouldBackground ? '[后台]' : '[立即]'} "${msg.slice(0, 30)}..." ` +
                `(分数:${est.score}, 预估:${est.estimatedTime}秒)`);
  }

  // 创建分发器
  console.log('\n--- 初始化任务分发器 ---');
  const dispatcher = new TaskDispatcher({
    pool: {
      minWorkers: 2,
      maxWorkers: 4,
      taskTimeout: 30000  // 30秒超时（演示用）
    },
    llmProvider: async ({ message }) => {
      // 模拟 LLM 调用
      await new Promise(r => setTimeout(r, 1000));
      return `[LLM响应] 已处理: ${message.slice(0, 20)}...`;
    }
  });

  // 监听事件
  dispatcher.on('log', ({ type, message, estimation }) => {
    console.log(`[日志] ${type}: "${message.slice(0, 30)}..." (预估${estimation.estimatedTime}秒)`);
  });

  dispatcher.on('notification', (notif) => {
    console.log(`[通知] ${notif.type}: ${notif.message}`);
  });

  // 初始化
  await dispatcher.initialize();
  console.log('✓ 分发器就绪\n');

  // 测试 1: 简单任务（立即执行）
  console.log('--- 测试 1: 简单任务 ---');
  const simple = await dispatcher.dispatch('你好，今天天气怎么样？');
  console.log(`模式: ${simple.mode}`);
  console.log(`结果:`, simple.result);

  // 测试 2: 复杂任务（后台执行）
  console.log('\n--- 测试 2: 复杂任务（后台） ---');
  const complex = await dispatcher.dispatch('分析最近一周的日志文件，找出性能瓶颈');
  console.log(`模式: ${complex.mode}`);
  console.log(`消息: ${complex.message}`);
  console.log('等待任务完成...');

  // 等待后台任务完成
  try {
    const result = await complex.promise;
    console.log('任务结果:', result);
  } catch (e) {
    console.log('任务失败:', e.message);
  }

  // 测试 3: 并发任务
  console.log('\n--- 测试 3: 并发任务 ---');
  const tasks = [
    '分析日志',
    '生成报告',
    '批量处理数据'
  ];

  const promises = tasks.map(msg =>
    dispatcher.dispatch(msg).then(r =>
      r.mode === 'background' ? r.promise : r.result
    )
  );

  const results = await Promise.all(promises);
  console.log('所有任务完成:', results.length);

  // 统计
  console.log('\n--- 统计 ---');
  console.log(dispatcher.getStats());

  // 关闭
  console.log('\n--- 关闭 ---');
  await dispatcher.destroy();
  console.log('✓ 已关闭');
}

main().catch(console.error);
