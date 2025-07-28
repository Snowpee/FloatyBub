# Git 提交脚本使用指南

本项目提供了两个便于 Git 提交的脚本，帮助你快速将代码提交并推送到 GitHub。

## 📋 脚本说明

### 1. `deploy.sh` - 完整提交脚本

**功能特点：**
- 🔍 检查工作区状态
- 📊 显示变更内容
- ✅ 提交前确认
- 🎨 彩色输出提示
- 🛡️ 错误处理和安全检查
- 📝 支持交互式输入提交信息

**使用方法：**
```bash
# 方式1：直接提供提交信息
./deploy.sh "feat: 添加用户头像功能"

# 方式2：交互式输入
./deploy.sh
# 然后根据提示输入提交信息
```

### 2. `quick-commit.sh` - 快速提交脚本

**功能特点：**
- ⚡ 快速提交，无需确认
- 🎯 简洁输出
- 📦 自动添加所有变更
- 🚀 一键推送到 GitHub

**使用方法：**
```bash
./quick-commit.sh "fix: 修复头像显示问题"
```

## 🚀 快速开始

1. **确保脚本有执行权限**（已自动设置）：
   ```bash
   chmod +x deploy.sh quick-commit.sh
   ```

2. **选择合适的脚本**：
   - 重要更新或需要仔细检查：使用 `deploy.sh`
   - 日常小修改或快速迭代：使用 `quick-commit.sh`

## 📝 提交信息规范建议

推荐使用以下格式：

```
type(scope): description

[optional body]

[optional footer]
```

**类型 (type)：**
- `feat`: 新功能
- `fix`: 修复bug
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 重构代码
- `test`: 测试相关
- `chore`: 构建过程或辅助工具的变动

**示例：**
```bash
./deploy.sh "feat(chat): 添加用户头像显示功能"
./quick-commit.sh "fix: 修复头像生成算法"
./deploy.sh "docs: 更新README文档"
```

## ⚠️ 注意事项

1. **确保在 Git 仓库中运行**：脚本会自动检查
2. **网络连接**：推送需要网络连接到 GitHub
3. **远程仓库配置**：确保已正确配置远程仓库
4. **分支权限**：确保有推送到当前分支的权限
5. **Git Hooks**：脚本使用 `--no-verify` 选项跳过 Git hooks，避免因缺失模块或配置问题导致的提交失败

## 🔧 故障排除

**推送失败？**
- 检查网络连接
- 确认 GitHub 认证信息
- 检查分支推送权限

**脚本无法执行？**
```bash
chmod +x deploy.sh quick-commit.sh
```

**提交被拒绝？**
- 先拉取最新代码：`git pull`
- 解决冲突后重新运行脚本

---

💡 **小贴士**：建议将这些脚本添加到你的 shell 别名中，例如：
```bash
# 在 ~/.zshrc 或 ~/.bashrc 中添加
alias deploy='./deploy.sh'
alias qc='./quick-commit.sh'
```

这样你就可以直接使用 `deploy "提交信息"` 或 `qc "提交信息"` 了！