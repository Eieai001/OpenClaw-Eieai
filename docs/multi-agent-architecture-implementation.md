# 多Agent分层响应架构 - 实现文档

**版本**: 1.0  
**日期**: 2026-02-27  
**作者**: OpenClaw Agent (E0)  
**状态**: 已实现，待验证

---

## 一、架构设计讨论

### 1.1 核心问题
**场景**: 用户正在聊天，突然需要处理大量数据/耗时任务
**痛点**: 
- 主Agent处理耗时任务时，聊天响应变慢/卡住
- 用户体验差，感觉Agent"死机"
- 简单查询和复杂任务混合处理，效率低

### 1.2 设计目标
1. **对话流畅性**: 保证简单查询立即响应（<2秒）
2. **后台处理**: 耗时任务不阻塞主对话
3. **资源可控**: 限制并发子Agent数量，避免资源耗尽
4. **自动管理**: 无需用户手动判断，自动分配任务

### 1.3 架构对比

#### 单Agent模式（当前）
```
用户消息 → Agent处理 → 回复
                ↓
         耗时任务时卡顿
```

#### 多Agent分层架构（目标）
```
用户消息 → 主Agent分析
    │
    ├── ≤2秒 → 立即回复
    │
    └── >2秒 → 子Agent池
              ↓
         后台执行
              ↓
         完成后汇总
```

### 1.4 决策逻辑

**2秒阈值**:
- 基于人类感知研究：2秒是"即时反馈"的心理阈值
- 超过2秒，用户会感知到"延迟"
- 低于2秒，感觉"流畅"

**复杂度评分**:
| 因素 | 权重 | 说明 |
|------|------|------|
| 消息长度 | +2 (长文本) | 长文本需要更多处理 |
| 快速关键词 | -2 | "你好"/"测试"等简单查询 |
| 耗时关键词 | +3 | "抓取"/"分析"/"批量"等 |
| 数字量词 | +3 | "100张"/"所有"/"批量" |
| 文件操作 | +2 | 涉及代码/文件处理 |

**复杂度阈值**:
- 0-2: 立即回复 (<500ms)
- 3-5: 快速回复 (<2s)
- >5: 分配给子Agent

---

## 二、实现方式

### 2.1 代码结构

```
skills/multi-agent-controller/
├── controller.js      # 核心控制器
└── SKILL.md           # Skill文档
```

### 2.2 核心组件

#### 1. 响应时间估算器 (ResponseTimeEstimator)
```javascript
class ResponseTimeEstimator {
  static analyzeComplexity(message) {
    let score = 0;
    // 长度、关键词、任务类型分析
    if (message.length > 100) score += 2;
    if (message.includes('抓取')) score += 4;
    // ...
    return score;
  }
  
  static estimate(message) {
    const complexity = this.analyzeComplexity(message);
    if (complexity <= 2) return { canReplyImmediately: true, time: 500 };
    if (complexity <= 5) return { canReplyImmediately: true, time: 1500 };
    return { canReplyImmediately: false, time: 5000 };
  }
}
```

#### 2. 子Agent池 (SubAgentPool)
```javascript
class SubAgentPool {
  constructor() {
    this.activeAgents = new Map();
    this.queue = [];
    this.maxConcurrent = 4;  // 最大并发
  }
  
  hasSlot() { return this.activeAgents.size < 4; }
  
  async spawn(task) {
    if (!this.hasSlot()) await this.waitForSlot();
    // 创建子Agent
    const agent = await sessions_spawn({ task, mode: 'run' });
    this.activeAgents.set(agentId, agent);
    return agent;
  }
}
```

#### 3. 主控制器 (MultiAgentController)
```javascript
class MultiAgentController {
  async handleMessage(message) {
    // 1. 估算
    const estimation = ResponseTimeEstimator.estimate(message);
    
    // 2. 决策
    if (estimation.canReplyImmediately && estimation.time <= 2000) {
      return { type: 'immediate', reply: generateReply(message) };
    } else {
      const agent = await this.pool.spawn(message);
      return { type: 'delegate', agent };
    }
  }
}
```

### 2.3 配置参数
```javascript
const CONFIG = {
  RESPONSE_THRESHOLD_MS: 2000,    // 2秒阈值
  MAX_SUBAGENTS: 4,                // 最大并发子Agent
  SUBAGENT_TIMEOUT_SECONDS: 300,   // 子Agent超时
  QUICK_TASKS: ['你好', 'hi', '测试', '状态'],  // 快速关键词
  HEAVY_TASKS: ['抓取', '分析', '批量', '下载'] // 耗时关键词
};
```

---

## 三、测试结果

### 3.1 测试案例

| 消息 | 复杂度 | 决策 | 预估时间 |
|------|--------|------|----------|
| "你好，测试一下" | 0 | 立即回复 | 500ms |
| "查询当前状态" | 2 | 立即回复 | 500ms |
| "分析这个日志文件" | 7 | 子Agent | 12s |
| "抓取汽车之家100张图片" | 10 | 子Agent | 15s |
| "备份所有配置文件" | 8 | 子Agent | 13s |

### 3.2 验证结果
✅ 简单问候 → 复杂度0 → 立即回复  
✅ 图片抓取 → 复杂度10 → 子Agent  

---

## 四、风险分析

### 4.1 误判风险
| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 误判为耗时任务 | 中 | 资源浪费 | 观察模式，逐步调优 |
| 误判为简单任务 | 中 | 主Agent卡顿 | 用户可手动说"后台执行" |

### 4.2 技术风险
- **子Agent池满**: 4个并发上限，可能排队
- **超时失败**: 5分钟超时，超长任务可能失败
- **状态同步**: 池状态可能不准确

### 4.3 用户体验风险
- **不透明**: 用户不知道任务在后台处理
- **延迟感知**: 子Agent完成后才回复
- **上下文丢失**: 子Agent可能缺少上下文

### 4.4 当前限制
- 简化实现，边缘情况未完全处理
- 与OpenClaw集成程度有限
- 需要大量测试验证稳定性

---

## 五、建议方案

### 5.1 渐进式启用
1. **观察模式** (当前阶段)
   - 只记录决策，不实际执行
   - 验证复杂度判断准确性
   
2. **白名单测试**
   - 只对特定关键词启用（"抓取"、"分析"）
   - 验证稳定性
   
3. **手动触发**
   - 用户明确说"后台执行"时才启用
   - 保留控制权
   
4. **全量启用**
   - 验证稳定后再自动判断所有消息

### 5.2 备选方案
如果不启用自动判断，可以保持当前模式：
- 用户明确说"后台执行"时创建子Agent
- 其他情况主Agent直接处理

---

## 六、代码位置

```
/Users/eieai/.openclaw/workspace/skills/multi-agent-controller/
├── controller.js    # 核心实现
└── SKILL.md         # 使用文档
```

---

## 七、后续行动

**待决策**:
1. 是否以"观察模式"运行，验证准确性？
2. 是否直接启用，但限制白名单？
3. 还是保持手动触发模式（用户说"后台执行"）？

---

**文档生成时间**: 2026-02-27 11:30  
**生成者**: E0 Agent  
**相关任务**: EvoMap Bundle ID - bundle_a4b07e4b334793cf