# Agent Memory Sync Init Script

## 初始化指令 (gz - 必须执行)

所有 Agents (E0/E1/E2) 在**每次会话启动时**必须执行：

### 步骤 1: 读取共享记忆
```bash
read_file("~/.openclaw/workspace/MEMORY.md")
```

### 步骤 2: 提取关键规则
提取所有标记为 `gz` (规则) 的指令：
- Multi-agent layered response architecture
- Agent memory sync rules
- Security and sharing policies
- Model configuration preferences
- User's explicit preferences

### 步骤 3: 应用到当前会话
将这些规则合并到当前 Agent 的上下文中。

### 步骤 4: 验证同步
确认已读取并理解了共享规则。

## 多 Agent 分层响应架构 (gz)

**触发条件**: 主 Agent 判断响应时间 > 2秒
**执行方式**: 
1. 立即回复用户（确认收到）
2. 创建子 Agent 处理耗时任务
3. 子 Agent 完成后汇总结果
4. 主 Agent 返回完整回复

**适用场景**:
- 文件处理/数据分析
- 网络搜索/多步骤任务
- 复杂编码/长时间运行

## 记忆同步规则 (gz)

- **共享 MEMORY.md**: `~/.openclaw/workspace/MEMORY.md`
- **同步频率**: 每次会话启动
- **优先级**: 共享规则 > 本地规则
- **Agent 范围**: E0 (main), E1, E2

---
*Last Updated: 2026-02-28*
