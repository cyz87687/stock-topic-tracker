@echo off
chcp 65001 >nul 2>&1
title A股题材轮动追踪 - 开发模式（局域网）

echo ============================================
echo   A股题材轮动追踪 - 开发模式局域网部署
echo ============================================
echo.

for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    for /f "tokens=1" %%b in ("%%a") do (
        set LOCAL_IP=%%b
        goto :found_ip
    )
)
:found_ip

echo [1/3] 检测本机局域网IP: %LOCAL_IP%
echo.

echo [2/3] 启动后端服务...
cd /d "%~dp0backend"
start "后端服务-8000" cmd /k "python main.py"
echo 后端服务已启动: http://%LOCAL_IP%:8000
echo.

echo [3/3] 启动前端开发服务器...
cd /d "%~dp0frontend"
start "前端服务-5173" cmd /k "npm run dev:lan"
echo 前端服务已启动: http://%LOCAL_IP%:5173
echo.

timeout /t 3 /nobreak >nul

echo ============================================
echo   开发模式部署完成！
echo ============================================
echo.
echo   前端: http://%LOCAL_IP%:5173
echo   后端: http://%LOCAL_IP%:8000
echo   API文档: http://%LOCAL_IP%:8000/docs
echo.
echo   本机访问:
echo   前端: http://localhost:5173
echo   后端: http://localhost:8000
echo.
echo ============================================
echo   注意事项：
echo   1. 确保防火墙放行 5173 和 8000 端口
echo   2. 关闭此窗口不会停止服务
echo   3. 停止服务请关闭对应窗口
echo ============================================
echo.
pause
