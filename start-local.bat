@echo off
chcp 65001 >nul
title 随地大小签 Web 本地代理服务

echo ====================================================
echo        正在启动 随地大小签 本地极速代理服务...
echo ====================================================

cd /d "%~dp0"

:: 检查 node 是否存在
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js 环境，请先安装 Node.js！
    pause
    exit /b
)

:: 启动本地代理
start /b node local-proxy.js

echo.
echo [✓] 本地代理服务已在 http://127.0.0.1:8787 成功启动！
echo [✓] 正在打开网页版，请在网页中直接输入账号密码登录...
echo.

:: 优先调用 Chrome，否则调用默认浏览器
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" "https://flower-muyi.github.io/ChaoXing/"
) else if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" "https://flower-muyi.github.io/ChaoXing/"
) else (
    start https://flower-muyi.github.io/ChaoXing/
)

echo 本窗口可最小化保持运行。关闭本窗口将停止本地代理。
echo.
pause
