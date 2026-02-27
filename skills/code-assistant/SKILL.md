---
name: code-assistant
description: 基于 Minimax M2.1 的智能代码开发助手，支持代码生成、重构、审查、测试生成和文档编写。
metadata:
  openclaw:
    emoji: 💻
    requires:
      bins: [git, node, python]
      os: [darwin, linux]
    capabilities:
      - code_generation
      - code_refactor
      - code_review
      - test_generation
      - documentation
---

# 代码助手 Skill

## 功能概述

基于 Minimax M2.1 模型的专业代码开发助手：
- 智能代码生成
- 代码重构和优化
- 代码审查和建议
- 自动化测试生成
- 文档自动生成

## 使用场景

- 快速原型开发
- 代码维护和重构
- 代码质量提升
- 测试覆盖增强
- 技术文档编写

## 工具声明

tools: Bash, Read, Write, Glob, Edit

## 工作流程

### 1. 代码生成

**功能**: 根据需求生成代码

**输入**:
- `language`: 编程语言
- `requirements`: 功能需求
- `constraints`: 约束条件（可选）
- `style`: 代码风格（可选）

**示例**:
```
生成一个 Python 函数，实现以下功能:
- 接收一个 URL 列表
- 并行下载所有文件
- 显示下载进度
- 处理网络错误
- 返回下载结果统计
```

### 2. 代码重构

**功能**: 重构现有代码

**输入**:
- `code`: 待重构的代码
- `goals`: 重构目标
- `language`: 编程语言

**示例**:
```
重构以下代码，使其:
- 更符合 Python 惯用法
- 提高可读性
- 添加类型提示
- 改进错误处理

[代码内容]
```

### 3. 代码审查

**功能**: 审查代码并提供建议

**输入**:
- `code`: 待审查的代码
- `focus`: 审查重点（性能、安全、可读性等）

**审查维度**:
- 代码风格和一致性
- 潜在错误和漏洞
- 性能优化机会
- 安全最佳实践
- 可维护性建议

### 4. 测试生成

**功能**: 为代码生成测试

**输入**:
- `code`: 待测试的代码
- `framework`: 测试框架
- `coverage`: 覆盖要求

**示例**:
```
为以下函数生成 pytest 测试:
- 正常情况测试
- 边界条件测试
- 错误处理测试
- 参数验证测试

[函数代码]
```

### 5. 文档生成

**功能**: 生成代码文档

**输入**:
- `code`: 待文档化的代码
- `format`: 文档格式（JSDoc, docstring, etc.）
- `detail`: 详细程度

## 输出格式

```json
{
  "success": true,
  "operation": "code_generation",
  "language": "python",
  "output": {
    "code": "# 生成的代码\n...",
    "explanation": "代码说明...",
    "usage": "使用示例..."
  },
  "metadata": {
    "tokens_used": 1500,
    "confidence": "high"
  }
}
```

## 支持的编程语言

- **Python**: 数据科学、后端开发、自动化
- **JavaScript/TypeScript**: 前端、Node.js、全栈
- **Go**: 高性能后端、云原生
- **Rust**: 系统编程、性能关键应用
- **Java**: 企业应用、Android
- **C/C++**: 系统编程、嵌入式
- **Swift**: iOS/macOS 开发
- **SQL**: 数据库查询
- **Shell**: 脚本自动化

## 代码质量标准

### Python
- 遵循 PEP 8 风格指南
- 使用类型提示
- 编写 docstring
- 处理异常
- 使用列表推导式

### JavaScript/TypeScript
- 使用 ESLint 配置
- 类型安全
- 异步/等待模式
- 模块化设计
- JSDoc 注释

### Go
- 遵循 Go 惯用法
- 错误处理
- 接口设计
- 并发安全
- 测试覆盖

## 预设模板

### Python 函数模板
```python
def function_name(param1: type1, param2: type2 = default) -> return_type:
    """
    函数描述
    
    Args:
        param1: 参数1描述
        param2: 参数2描述
        
    Returns:
        返回值描述
        
    Raises:
        ExceptionType: 异常情况
        
    Example:
        >>> function_name(arg1, arg2)
        result
    """
    try:
        # 实现
        pass
    except SpecificException as e:
        # 错误处理
        raise
```

### TypeScript 类模板
```typescript
/**
 * 类描述
 */
export class ClassName {
    private property: type;
    
    constructor(param: type) {
        this.property = param;
    }
    
    /**
     * 方法描述
     */
    public methodName(param: type): returnType {
        // 实现
    }
}
```

## 使用示例

### 示例 1: 生成 API 客户端
用户: "生成一个调用 GitHub API 的 Python 客户端"
助手:
1. 分析需求
2. 生成代码结构
3. 实现核心功能
4. 添加错误处理
5. 提供使用示例

### 示例 2: 重构遗留代码
用户: "帮我重构这个 200 行的函数"
助手:
1. 分析代码结构
2. 识别重构机会
3. 提取子函数
4. 改进命名
5. 添加类型提示

### 示例 3: 生成单元测试
用户: "为我的 utils.py 生成测试"
助手:
1. 读取 utils.py
2. 识别可测试函数
3. 生成测试用例
4. 设置测试夹具
5. 验证测试覆盖

## 性能优化

- 使用缓存避免重复生成
- 批量处理相似请求
- 优化提示词减少 Token 使用
- 异步处理非关键任务

## 集成开发环境

### VS Code 集成
```json
{
  "commands": [
    {
      "command": "code-assistant.generate",
      "title": "生成代码"
    },
    {
      "command": "code-assistant.refactor",
      "title": "重构代码"
    },
    {
      "command": "code-assistant.review",
      "title": "审查代码"
    }
  ]
}
```

### 快捷键
- `Cmd+Shift+G`: 生成代码
- `Cmd+Shift+R`: 重构代码
- `Cmd+Shift+T`: 生成测试
- `Cmd+Shift+D`: 生成文档

## 故障排查

### 生成代码不符合预期
- 提供更详细的需求
- 指定编程语言和版本
- 提供参考代码示例

### 重构引入错误
- 先运行测试验证
- 逐步应用重构
- 保留原始代码备份

### 测试覆盖不足
- 检查边界条件
- 添加异常测试
- 使用覆盖率工具
