@echo off
REM Git 提交脚本 (Windows 版本)
REM 使用方法: commit.bat "提交信息"

setlocal enabledelayedexpansion

REM 检查参数
if "%~1"=="" (
    echo ❌ 请提供提交信息
    echo 使用方法: commit.bat "你的提交信息"
    exit /b 1
)

set "commit_message=%~1"

REM 检查是否在 git 仓库中
git rev-parse --git-dir >nul 2>&1
if errorlevel 1 (
    echo ❌ 当前目录不是 Git 仓库！
    exit /b 1
)

echo 🚀 Git 提交流程开始
echo 📝 提交信息: %commit_message%
echo.

REM 添加所有变更
echo 📦 添加文件...
git add .

REM 提交
echo 💾 提交更改...
git commit --no-verify -m "%commit_message%"
if errorlevel 1 (
    echo ❌ 提交失败！
    exit /b 1
)

REM 获取当前分支
for /f "tokens=*" %%i in ('git branch --show-current') do set "current_branch=%%i"

REM 推送
echo 🌐 推送到 GitHub...
git push --no-verify origin "%current_branch%"
if errorlevel 1 (
    echo ❌ 推送失败！
    exit /b 1
)

echo.
echo ✅ 完成！代码已推送到 GitHub
for /f "tokens=*" %%i in ('git log --oneline -1') do echo 📋 最新提交: %%i

endlocal