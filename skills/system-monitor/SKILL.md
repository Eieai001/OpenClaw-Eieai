---
name: system-monitor
description: 实时监控系统状态和资源使用，包括 CPU、内存、磁盘、进程监控和日志分析。
metadata:
  openclaw:
    emoji: 📊
    requires:
      bins: [top, ps, df, du, vm_stat, iostat]
      os: [darwin]
    capabilities:
      - resource_monitor
      - process_monitor
      - log_analysis
      - alert_system
---

# 系统监控 Skill

## 功能概述

提供全面的 macOS 系统监控能力：
- CPU、内存、磁盘实时监控
- 进程监控和管理
- 系统日志分析
- 性能趋势分析
- 智能告警系统

## 使用场景

- 系统性能优化
- 资源使用分析
- 故障排查
- 长期趋势监控
- 自动化告警

## 工具声明

tools: Bash, Read

## 工作流程

### 1. CPU 监控

**功能**: 监控 CPU 使用情况

**示例**:
```bash
# 实时 CPU 使用率
top -l 1 -n 0 | grep "CPU usage"

# 详细 CPU 信息
sysctl -n machdep.cpu.brand_string
sysctl -n hw.ncpu

# 进程 CPU 使用
ps -eo pid,ppid,%cpu,%mem,comm | head -20
```

### 2. 内存监控

**功能**: 监控内存使用情况

**示例**:
```bash
# 内存使用概览
vm_stat

# 详细内存信息
system_profiler SPHardwareDataType | grep Memory

# 内存压力
memory_pressure
```

### 3. 磁盘监控

**功能**: 监控磁盘使用情况

**示例**:
```bash
# 磁盘空间
df -h

# 目录大小
du -sh ~/* 2>/dev/null | sort -hr | head -10

# 磁盘 I/O
iostat -d 1 5
```

### 4. 进程监控

**功能**: 监控和管理进程

**示例**:
```bash
# 所有进程
ps aux

# 特定用户进程
ps -u $(whoami)

# 按 CPU 排序
ps -eo pid,ppid,%cpu,%mem,comm --sort=-%cpu | head -20

# 按内存排序
ps -eo pid,ppid,%cpu,%mem,comm --sort=-%mem | head -20
```

### 5. 网络监控

**功能**: 监控网络状态

**示例**:
```bash
# 网络接口
ifconfig

# 网络连接
netstat -an

# 网络活动
nettop -P

# 带宽使用
bandwhich
```

### 6. 日志分析

**功能**: 分析系统日志

**示例**:
```bash
# 系统日志
log show --last 1h

# 错误日志
log show --predicate 'eventMessage contains "error"' --last 1h

# 应用日志
log show --predicate 'process == "Safari"' --last 1h
```

## 输出格式

```json
{
  "success": true,
  "operation": "system_monitor",
  "timestamp": "2026-02-24T10:30:00Z",
  "metrics": {
    "cpu": {
      "usage_percent": 25.5,
      "cores": 8,
      "load_average": [1.2, 1.5, 1.3]
    },
    "memory": {
      "total_gb": 16,
      "used_gb": 8.5,
      "free_gb": 7.5,
      "usage_percent": 53.1
    },
    "disk": {
      "total_gb": 1000,
      "used_gb": 450,
      "free_gb": 550,
      "usage_percent": 45.0
    },
    "top_processes": [
      {
        "pid": 1234,
        "name": "Code",
        "cpu_percent": 15.2,
        "memory_mb": 512
      }
    ]
  }
}
```

## 告警规则

### CPU 告警
```yaml
alerts:
  cpu_high:
    condition: cpu_usage > 80%
    duration: 5 minutes
    action: notify
    message: "CPU 使用率过高"
  
  cpu_critical:
    condition: cpu_usage > 95%
    duration: 2 minutes
    action: notify + log
    message: "CPU 使用率临界"
```

### 内存告警
```yaml
  memory_high:
    condition: memory_usage > 85%
    duration: 5 minutes
    action: notify
    message: "内存使用率过高"
  
  memory_critical:
    condition: memory_usage > 95%
    duration: 2 minutes
    action: notify + suggest_restart
    message: "内存使用率临界"
```

### 磁盘告警
```yaml
  disk_full:
    condition: disk_usage > 90%
    duration: immediate
    action: notify + cleanup_suggestion
    message: "磁盘空间不足"
  
  disk_critical:
    condition: disk_usage > 95%
    duration: immediate
    action: notify + urgent_cleanup
    message: "磁盘空间严重不足"
```

## 性能基准

### 正常范围
- CPU: < 50%
- 内存: < 70%
- 磁盘: < 80%

### 警告范围
- CPU: 50-80%
- 内存: 70-85%
- 磁盘: 80-90%

### 危险范围
- CPU: > 80%
- 内存: > 85%
- 磁盘: > 90%

## 使用示例

### 示例 1: 系统健康检查
用户: "检查系统健康状况"
助手:
1. 收集 CPU、内存、磁盘数据
2. 检查进程状态
3. 分析最近日志
4. 生成健康报告

### 示例 2: 找出资源占用高的进程
用户: "什么占用了这么多内存？"
助手:
1. 获取进程内存使用列表
2. 按内存使用排序
3. 识别异常进程
4. 提供处理建议

### 示例 3: 磁盘空间分析
用户: "分析磁盘使用情况"
助手:
1. 扫描所有目录
2. 计算各目录大小
3. 识别大文件
4. 提供清理建议

## 长期监控

### 数据收集
```bash
# 每分钟收集一次数据
*/1 * * * * /path/to/collect_metrics.sh

# 每小时生成报告
0 * * * * /path/to/generate_report.sh
```

### 趋势分析
- 日/周/月趋势图表
- 异常检测
- 预测分析
- 容量规划

## 故障排查

### 系统变慢
1. 检查 CPU 使用率
2. 检查内存压力
3. 检查磁盘 I/O
4. 检查网络连接

### 应用崩溃
1. 查看崩溃日志
2. 检查资源限制
3. 分析依赖问题
4. 检查权限设置
