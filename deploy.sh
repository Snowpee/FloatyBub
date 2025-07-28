#!/bin/bash

# Git 提交脚本
# 使用方法: ./deploy.sh "提交信息"
# 或者: ./deploy.sh (会提示输入提交信息)

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的信息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查是否在 git 仓库中
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    print_error "当前目录不是 Git 仓库！"
    exit 1
fi

# 获取提交信息
if [ -z "$1" ]; then
    echo -n "请输入提交信息: "
    read commit_message
    if [ -z "$commit_message" ]; then
        print_error "提交信息不能为空！"
        exit 1
    fi
else
    commit_message="$1"
fi

print_info "开始 Git 提交流程..."

# 检查工作区状态
print_info "检查工作区状态..."
if git diff-index --quiet HEAD --; then
    print_warning "工作区没有变更，无需提交。"
    exit 0
fi

# 显示当前状态
print_info "当前 Git 状态:"
git status --short

# 添加所有变更
print_info "添加所有变更到暂存区..."
git add .

# 显示将要提交的内容
print_info "将要提交的内容:"
git diff --cached --stat

# 确认提交
echo
echo -e "${YELLOW}提交信息: ${commit_message}${NC}"
echo -n "确认提交? (y/N): "
read -r confirm

if [[ ! $confirm =~ ^[Yy]$ ]]; then
    print_warning "取消提交。"
    exit 0
fi

# 执行提交
print_info "执行提交..."
if git commit --no-verify -m "$commit_message"; then
    print_success "提交成功！"
else
    print_error "提交失败！"
    exit 1
fi

# 获取当前分支
current_branch=$(git branch --show-current)
print_info "当前分支: $current_branch"

# 推送到远程仓库
print_info "推送到远程仓库..."
if git push --no-verify origin "$current_branch"; then
    print_success "推送成功！"
    print_success "✨ Git 提交流程完成！"
else
    print_error "推送失败！请检查网络连接和远程仓库配置。"
    print_info "你可以稍后手动执行: git push origin $current_branch"
    exit 1
fi

# 显示最新提交信息
print_info "最新提交信息:"
git log --oneline -1

echo
print_success "🎉 所有操作完成！代码已成功提交并推送到 GitHub。"