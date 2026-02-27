/**
 * 集成任务分发器 - 使用示例
 * 
 * 方案 A：TaskDispatcher 分流 + Sandbox-Agent 执行
 */

const { IntegratedDispatcher, TaskEstimator } = require('./index');

async function main() {
  console.log('=== 集成任务分发器测试 ===\n');

  // 1. 测试复杂度评估
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
    console.log(`${est.shouldBackground ? '[后台]' : '[立即]'} "${msg.slice(0, 25)}..." (分:${est.score}, 预:${est.estimatedTime}秒)`);
  }

  // 2. 创建分发器
  console.log('\n--- 初始化分发器 ---');
  const dispatcher = new IntegratedDispatcher({
    concurrency: { min: 2, max: 4 },
    llmProvider: async ({ messages, model, maxTokens }) => {
      // 模拟 LLM 调用
      const userMessage = messages.find(m => m.role === 'user')?.content || '';
      console.log(`  [LLM] 调用模型处理: ${userMessage.slice(0, 30)}...`);
      await new Promise(r => setTimeout(r, 500));
      return `[LLM响应] 已处理: ${userMessage.slice(0, 20)}...`;
    }
  });

  dispatcher.on('ready', ({ workers }) => console.log(`✓ 就绪，${workers} 个沙盒Worker`));
  dispatcher.on('log', ({ type, message, estimation }) => {
    console.log(`[${type}] "${message.slice(0, 25)}..." (预估${estimation.estimatedTime}秒)`);
  });
  dispatcher.on('notification', (n) => console.log(`[通知] ${n.type}: ${n.message}`));

  await dispatcher.initialize();

  // 3. 测试简单任务（立即执行）
  console.log('\n--- 测试 1: 简单任务 ---');
  const simple = await dispatcher.dispatch('你好，今天天气怎么样？');
  console.log(`模式: ${simple.mode}`);
  console.log(`结果:`, simple.result);

  // 4. 测试复杂任务（后台执行）
  console.log('\n--- 测试 2: 复杂任务（后台） ---');
  const complex = await dispatcher.dispatch('分析最近一周的日志文件，找出性能瓶颈');
  console.log(`模式: ${complex.mode}`);
  console.log(`消息: ${complex.message}`);
  console.log('等待任务完成...');

  try {
    const result = await complex.promise;
    console.log('任务结果:', result);
  } catch (e) {
    console.log('任务失败:', e.message);
  }

  // 5. 测试代码生成任务
  console.log('\n--- 测试 3: 代码生成 ---');
  const codeTask = await dispatcher.dispatch('写一个Python函数计算斐波那契数列', { type: 'code-generation' });
  console.log(`模式: ${codeTask.mode}`);
  if (codeTask.mode === 'background') {
    const result = await codeTask.promise;
    console.log('代码:', result?.content || result?.code || 'N/A');
  }

  // 6. 测试并发
  console.log('\n--- 测试 4: 并发任务 ---');
  const tasks = [
    '分析日志',
    '生成报告',
    '批量处理数据'
  ];
  const promises = tasks.map(msg => dispatcher.dispatch(msg).then(r => r.mode === 'background' ? r.promise : r.result));
  const results = await Promise.all(promises);
  console.log(`完成 ${results.length} 个任务`);

  // 7. 统计
  console.log('\n--- 统计 ---');
  const stats = dispatcher.getStats();
  console.log('Sandbox:', stats.sandbox);

  // 8. 关闭
  console.log('\n--- 关闭 ---');
  await dispatcher.destroy();
  console.log('✓ 已关闭');
}

main().catch(console.error);
