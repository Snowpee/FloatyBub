#!/bin/bash

# 快速 Git 提交脚本
# 使用方法: ./quick-commit.sh "提交信息"

set -e

# 检查参数
if [ -z "$1" ]; then
    echo "❌ 请提供提交信息"
    echo "使用方法: ./quick-commit.sh \"你的提交信息\""
    exit 1
fi

commit_message="$1"

# 检查是否在 git 仓库中
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ 当前目录不是 Git 仓库！"
    exit 1
fi

echo "🚀 快速提交模式"
echo "📝 提交信息: $commit_message"
echo

# 添加所有变更
echo "📦 添加文件..."
git add .

# 提交
echo "💾 提交更改..."
git commit --no-verify -m "$commit_message"

# 推送
echo "🌐 推送到 GitHub..."
current_branch=$(git branch --show-current)
git push --no-verify origin "$current_branch"

echo
echo "✅ 完成！代码已推送到 GitHub"
echo "📋 最新提交: $(git log --oneline -1)"