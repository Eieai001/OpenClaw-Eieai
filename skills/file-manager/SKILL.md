---
name: file-manager
description: 智能文件管理系统，支持搜索、组织、批量重命名、压缩解压等操作。自动整理文件，提高工作效率。
metadata:
  openclaw:
    emoji: 📁
    requires:
      bins: [find, grep, rsync, tar, zip, unzip]
      os: [darwin, linux]
    capabilities:
      - file_search
      - file_organize
      - batch_rename
      - compression
      - sync_backup
---

# 文件管理 Skill

## 功能概述

提供智能文件管理能力：
- 快速文件搜索和过滤
- 自动文件组织和分类
- 批量重命名
- 压缩和解压
- 目录同步和备份

## 使用场景

- 整理下载文件夹
- 批量处理照片和文档
- 项目文件组织
- 定期备份重要数据
- 清理重复文件

## 工具声明

tools: Bash, Read, Write, Glob, Edit

## 工作流程

### 1. 文件搜索

**功能**: 在指定目录搜索文件

**输入**:
- `path`: 搜索路径
- `pattern`: 文件名模式（支持通配符）
- `type`: 文件类型 (`f`=文件, `d`=目录)
- `size`: 文件大小过滤
- `mtime`: 修改时间过滤

**示例**:
```bash
# 按名称搜索
find ~/Downloads -name "*.pdf" -type f

# 按大小搜索（大于 100MB）
find ~ -size +100M -type f

# 按时间搜索（最近 7 天）
find ~ -mtime -7 -type f

# 高级搜索（名称+大小+类型）
find ~/Projects -name "*.js" -size -1M -type f
```

### 2. 文件组织

**功能**: 按规则自动组织文件

**输入**:
- `source`: 源目录
- `rules`: 组织规则（按类型、日期、大小等）
- `destination`: 目标目录结构

**示例**:
```bash
# 按文件类型组织
for file in ~/Downloads/*; do
  ext="${file##*.}"
  mkdir -p ~/Downloads/by_type/$ext
  mv "$file" ~/Downloads/by_type/$ext/
done

# 按日期组织照片
for file in ~/Photos/*.{jpg,jpeg,png}; do
  date=$(stat -f "%Sm" -t "%Y-%m" "$file")
  mkdir -p ~/Photos/by_date/$date
  mv "$file" ~/Photos/by_date/$date/
done
```

### 3. 批量重命名

**功能**: 批量重命名文件

**输入**:
- `path`: 文件路径
- `pattern`: 重命名模式
- `counter`: 计数器起始值
- `prefix/suffix`: 前缀/后缀

**示例**:
```bash
# 添加前缀
for f in *.txt; do mv "$f" "prefix_$f"; done

# 序号重命名
counter=1
for f in *.jpg; do
  mv "$f" "image_$(printf '%03d' $counter).jpg"
  ((counter++))
done

# 替换文件名中的文本
for f in *oldname*; do
  mv "$f" "${f/oldname/newname}"
done
```

### 4. 压缩解压

**功能**: 压缩和解压文件

**输入**:
- `action`: 操作类型 (`compress`, `extract`)
- `source`: 源文件/目录
- `destination`: 输出路径
- `format`: 格式 (`zip`, `tar.gz`, `7z`)

**示例**:
```bash
# 压缩为 zip
zip -r archive.zip folder/

# 压缩为 tar.gz
tar -czf archive.tar.gz folder/

# 解压 zip
unzip archive.zip -d destination/

# 解压 tar.gz
tar -xzf archive.tar.gz -C destination/
```

### 5. 目录同步

**功能**: 同步两个目录

**输入**:
- `source`: 源目录
- `destination`: 目标目录
- `options`: 同步选项

**示例**:
```bash
# 单向同步（增量）
rsync -av --delete source/ destination/

# 双向同步
rsync -av source/ destination/
rsync -av destination/ source/

# 排除特定文件
rsync -av --exclude='.git' --exclude='node_modules' source/ destination/
```

### 6. 重复文件检测

**功能**: 查找重复文件

**示例**:
```bash
# 使用 md5 检测重复
find . -type f -exec md5 {} \; | sort | uniq -d

# 使用 fdupes（需安装）
fdupes -r directory/
```

### 7. 磁盘使用分析

**功能**: 分析磁盘使用情况

**示例**:
```bash
# 目录大小
du -sh directory/

# 详细分析
du -h --max-depth=1 directory/ | sort -hr

# 大文件查找
find . -type f -size +100M -exec ls -lh {} \;
```

## 输出格式

```json
{
  "success": true,
  "operation": "file_organize",
  "summary": {
    "files_processed": 150,
    "directories_created": 12,
    "space_saved": "2.5GB"
  },
  "details": [
    {
      "action": "moved",
      "source": "/path/to/file",
      "destination": "/new/path/to/file"
    }
  ],
  "timestamp": "2026-02-24T10:30:00Z"
}
```

## 安全护栏

### 文件访问限制
- 只能访问用户目录下的文件
- 禁止访问系统目录
- 禁止访问隐藏配置文件

### 破坏性操作确认
- 删除文件前确认
- 覆盖文件前确认
- 移动系统文件前确认

### 路径验证
- 验证路径存在
- 检查写入权限
- 防止路径遍历攻击

## 预设规则

### 下载文件夹整理规则
```yaml
downloads_organize:
  images:
    extensions: [jpg, jpeg, png, gif, webp, svg]
    destination: ~/Downloads/Images/
  documents:
    extensions: [pdf, doc, docx, txt, md, epub]
    destination: ~/Downloads/Documents/
  archives:
    extensions: [zip, rar, 7z, tar, gz]
    destination: ~/Downloads/Archives/
  videos:
    extensions: [mp4, mov, avi, mkv]
    destination: ~/Downloads/Videos/
  audio:
    extensions: [mp3, wav, flac, aac]
    destination: ~/Downloads/Audio/
  applications:
    extensions: [dmg, pkg, app]
    destination: ~/Downloads/Applications/
```

### 照片整理规则
```yaml
photos_organize:
  by_date:
    format: "YYYY-MM"
    extract_from: exif_date
  by_location:
    enabled: false
    require_gps: true
  duplicates:
    action: move_to_duplicates
    keep: first
```

## 使用示例

### 示例 1: 整理下载文件夹
用户: "帮我整理下载文件夹"
助手:
1. 扫描 ~/Downloads 中的所有文件
2. 按类型分类
3. 创建相应子目录
4. 移动文件到对应目录
5. 报告整理结果

### 示例 2: 批量重命名照片
用户: "把照片重命名为 vacation_001, vacation_002..."
助手:
1. 确认照片目录
2. 按修改时间排序
3. 批量重命名
4. 验证结果

### 示例 3: 查找大文件
用户: "找出占用空间最大的 10 个文件"
助手:
1. 扫描用户目录
2. 按大小排序
3. 返回前 10 个结果

## 性能优化

- 使用 `find` 代替递归遍历
- 批量操作减少 I/O
- 使用 `rsync` 进行高效同步
- 缓存文件列表避免重复扫描

## 故障排查

### 权限错误
- 检查文件权限
- 使用 `chmod` 修改权限
- 确保有写入权限

### 空间不足
- 检查磁盘空间
- 清理临时文件
- 压缩大文件

### 文件名冲突
- 自动添加序号
- 保留原始文件名
- 创建冲突报告
