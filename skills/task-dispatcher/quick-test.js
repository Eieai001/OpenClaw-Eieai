const { TaskDispatcher, TaskEstimator } = require('./mvp-task-dispatcher');

async function quickTest() {
  console.log('=== 快速测试 ===\n');

  // 测试评估器
  console.log('1. 复杂度评估:');
  console.log('  "你好":', TaskEstimator.estimate('你好'));
  console.log('  "分析日志":', TaskEstimator.estimate('分析日志'));

  // 测试分发器
  console.log('\n2. 初始化分发器...');
  const d = new TaskDispatcher({
    pool: { minWorkers: 1, maxWorkers: 2, taskTimeout: 10000 }
  });

  d.on('ready', ({ workers }) => console.log(`  ✓ 就绪，${workers} 个工作进程`));
  d.on('notification', (n) => console.log(`  [通知] ${n.type}: ${n.message}`));

  await d.initialize();

  console.log('\n3. 测试简单任务:');
  const r1 = await d.dispatch('你好');
  console.log(`  模式: ${r1.mode}, 结果: ${r1.result?.type}`);

  console.log('\n4. 测试后台任务:');
  const r2 = await d.dispatch('分析日志文件');
  console.log(`  模式: ${r2.mode}, 消息: ${r2.message}`);

  if (r2.mode === 'background') {
    console.log('  等待完成...');
    const result = await r2.promise;
    console.log('  ✓ 完成:', result.summary);
  }

  console.log('\n5. 关闭:');
  await d.destroy();
  console.log('  ✓ 已关闭');
}

quickTest().catch(e => console.error('错误:', e.message));
