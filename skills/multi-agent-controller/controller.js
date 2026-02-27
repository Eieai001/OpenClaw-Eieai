#!/usr/bin/env node
/**
 * 多Agent分层响应架构 - 核心控制器 (集成沙盒版)
 * 
 * 集成内容：
 * - TaskEstimator 复杂度评估（来自 integrated-dispatcher）
 * - SandboxPool 沙盒安全执行
 * - 2秒阈值自动判断
 */

const path = require('path');

// 加载集成调度器
let IntegratedDispatcher, TaskEstimator, SandboxPool;
try {
  const dispatcher = require('../integrated-dispatcher/index.js');
  IntegratedDispatcher = dispatcher.IntegratedDispatcher;
  TaskEstimator = dispatcher.TaskEstimator;
  SandboxPool = dispatcher.SandboxPool;
} catch (err) {
  console.error('[Controller] 无法加载集成调度器:', err.message);
  // 回退到基础实现
}

// 配置
const CONFIG = {
  RESPONSE_THRESHOLD_MS: 2000,
  MAX_SUBAGENTS: 4,
  SUBAGENT_TIMEOUT_SECONDS: 300,
  LLM_PROVIDER: null  // 由外部传入
};

// 响应时间估算（回退实现）
class ResponseTimeEstimator {
  static analyzeComplexity(message) {
    let score = 0;
    const lowerMsg = message.toLowerCase();

    if (message.length > 100) score += 2;
    if (message.length > 500) score += 3;

    const quickTasks = ['你好', 'hi', 'hello', '在吗', '测试', '状态', '简单', '查询', '检查'];
    const heavyTasks = ['抓取', '下载', '分析', '搜索', '批量', '导入', '导出', '备份', '同步'];

    for (const keyword of quickTasks) {
      if (lowerMsg.includes(keyword)) score -= 2;
    }

    for (const keyword of heavyTasks) {
      if (lowerMsg.includes(keyword)) score += 3;
    }

    if (/\d+个|批量|所有|全部/.test(message)) score += 3;
    if (message.includes('下载') || message.includes('抓取')) score += 4;

    return Math.max(0, score);
  }

  static estimate(message) {
    const complexity = this.analyzeComplexity(message);
    
    if (complexity <= 2) {
      return { canReplyImmediately: true, estimatedTimeMs: 500, complexity, reason: '简单查询' };
    }
    if (complexity <= 5) {
      return { canReplyImmediately: true, estimatedTimeMs: 1500, complexity, reason: '中等复杂度' };
    }
    return { canReplyImmediately: false, estimatedTimeMs: 5000 + (complexity * 1000), complexity, reason: '耗时任务' };
  }
}

// 主控制器 - 集成版
class MultiAgentController {
  constructor(config = {}) {
    this.config = { ...CONFIG, ...config };
    this.dispatcher = null;
    this.pool = null;
    this.stats = { total: 0, quick: 0, delegated: 0 };
    this.initialized = false;
  }

  /**
   * 初始化控制器
   */
  async initialize(llmProvider = null) {
    if (IntegratedDispatcher) {
      // 使用集成调度器
      this.dispatcher = new IntegratedDispatcher({
        concurrency: { min: 2, max: this.config.MAX_SUBAGENTS },
        llmProvider: llmProvider || this.config.LLM_PROVIDER
      });
      
      await this.dispatcher.initialize();
      
      // 转发通知
      this.dispatcher.on('notification', (notif) => {
        console.log(`[Controller] 通知: ${notif.type} - ${notif.message}`);
      });
      
      this.initialized = true;
      console.log('[Controller] ✓ 集成调度器已初始化');
    } else {
      // 回退到基础池
      this.pool = new SubAgentPool();
      console.log('[Controller] ⚠ 使用基础池（无沙盒）');
    }
  }

  /**
   * 评估消息复杂度
   */
  estimate(message) {
    if (TaskEstimator) {
      return TaskEstimator.estimate(message);
    }
    return ResponseTimeEstimator.estimate(message);
  }

  /**
   * 处理消息（核心方法）
   */
  async handleMessage(message, context = {}) {
    this.stats.total++;
    
    // 使用集成调度器的评估
    const estimation = this.estimate(message);

    console.log(`[Controller] 消息: "${message.substring(0, 40)}..."`);
    console.log(`[Controller] 复杂度: ${estimation.score || estimation.complexity}, 预估: ${estimation.estimatedTime}ms`);
    console.log(`[Controller] 决策: ${estimation.shouldBackground ? '后台 → 沙盒执行' : '立即 → 主Agent处理'}`);

    if (!estimation.shouldBackground) {
      // 简单任务 - 主Agent立即处理
      this.stats.quick++;
      return { 
        type: 'immediate', 
        estimation,
        result: '由主Agent处理'
      };
    }

    // 复杂任务 - 交给调度器执行
    if (this.dispatcher) {
      this.stats.delegated++;
      
      const result = await this.dispatcher.dispatch(message, {
        type: 'query',
        ...context
      });

      return {
        type: 'delegate',
        estimation,
        mode: result.mode,
        message: result.message,
        promise: result.promise
      };
    }

    // 无调度器时的回退
    this.stats.delegated++;
    return {
      type: 'delegate',
      estimation,
      message: '任务已分配给子Agent（基础模式）'
    };
  }

  /**
   * 获取状态
   */
  getStatus() {
    if (this.dispatcher) {
      return this.dispatcher.getStats();
    }
    return {
      active: this.pool?.activeAgents?.size || 0,
      max: this.config.MAX_SUBAGENTS,
      queue: this.pool?.queue?.length || 0
    };
  }

  /**
   * 关闭
   */
  async destroy() {
    if (this.dispatcher) {
      await this.dispatcher.destroy();
    }
  }
}

// 基础子Agent池（回退用）
class SubAgentPool {
  constructor() {
    this.activeAgents = new Map();
    this.queue = [];
    this.maxConcurrent = CONFIG.MAX_SUBAGENTS;
  }

  hasSlot() {
    return this.activeAgents.size < this.maxConcurrent;
  }

  getStatus() {
    return {
      active: this.activeAgents.size,
      max: this.maxConcurrent,
      queue: this.queue.length
    };
  }
}

// 导出
module.exports = { 
  MultiAgentController, 
  ResponseTimeEstimator, 
  SubAgentPool, 
  CONFIG 
};

// CLI 测试
if (require.main === module) {
  (async () => {
    const controller = new MultiAgentController();
    
    // 初始化（带模拟 LLM）
    // 注意：llmProvider 接收的 request 格式是 { messages, model, temperature, maxTokens }
    await controller.initialize(async (request) => {
      const message = request.messages?.[0]?.content || request.message || JSON.stringify(request);
      console.log(`[LLM] 处理: ${message.slice(0, 30)}...`);
      return `模拟响应: ${message.slice(0, 20)}...`;
    });

    // 测试消息
    const testMessages = [
      '你好',
      '查询当前状态',
      '分析这个项目的性能瓶颈',
      '抓取汽车之家100张图片'
    ];

    for (const msg of testMessages) {
      console.log('\n---');
      const result = await controller.handleMessage(msg);
      console.log('结果:', JSON.stringify(result, null, 2));
    }

    await controller.destroy();
    process.exit(0);
  })();
}
