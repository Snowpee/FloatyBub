#!/bin/bash

# Git 脚本测试工具
# 用于测试 deploy.sh 和 quick-commit.sh 的功能

set -e

echo "🧪 Git 脚本测试工具"
echo "==================="
echo

# 检查脚本文件是否存在
echo "📋 检查脚本文件..."
if [ ! -f "deploy.sh" ]; then
    echo "❌ deploy.sh 不存在"
    exit 1
fi

if [ ! -f "quick-commit.sh" ]; then
    echo "❌ quick-commit.sh 不存在"
    exit 1
fi

echo "✅ 脚本文件存在"

# 检查执行权限
echo "🔐 检查执行权限..."
if [ ! -x "deploy.sh" ]; then
    echo "❌ deploy.sh 没有执行权限"
    chmod +x deploy.sh
    echo "✅ 已添加执行权限"
fi

if [ ! -x "quick-commit.sh" ]; then
    echo "❌ quick-commit.sh 没有执行权限"
    chmod +x quick-commit.sh
    echo "✅ 已添加执行权限"
fi

echo "✅ 执行权限正常"

# 检查 Git 仓库状态
echo "📦 检查 Git 仓库状态..."
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ 当前目录不是 Git 仓库"
    exit 1
fi

echo "✅ Git 仓库正常"

# 检查当前分支
echo "🌿 当前分支信息:"
current_branch=$(git branch --show-current)
echo "   分支: $current_branch"

# 检查远程仓库
echo "🌐 远程仓库信息:"
remote_url=$(git remote get-url origin 2>/dev/null || echo "未配置")
echo "   远程URL: $remote_url"

# 检查工作区状态
echo "📊 工作区状态:"
if git diff-index --quiet HEAD --; then
    echo "   ✅ 工作区干净，无待提交更改"
else
    echo "   📝 有待提交的更改"
    git status --short | head -5
fi

echo
echo "🎯 测试建议:"
echo "1. 如果有待提交更改，可以测试: ./quick-commit.sh \"测试提交\""
echo "2. 如果需要详细确认，可以测试: ./deploy.sh \"详细测试提交\""
echo "3. 确保网络连接正常以便推送到 GitHub"
echo
echo "✨ 测试完成！脚本准备就绪。"