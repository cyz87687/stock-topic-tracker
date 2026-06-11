@echo off
chcp 65001 >nul 2>&1
title A股题材轮动追踪 - 局域网部署

echo ============================================
echo   A股题材轮动追踪系统 - 局域网一键部署
echo ============================================
echo.

for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    for /f "tokens=1" %%b in ("%%a") do (
        set LOCAL_IP=%%b
        goto :found_ip
    )
)
:found_ip

echo [1/4] 检测本机局域网IP: %LOCAL_IP%
echo.

echo [2/4] 构建前端生产版本...
cd /d "%~dp0frontend"
call npm run build
if errorlevel 1 (
    echo 前端构建失败！请检查错误信息。
    pause
    exit /b 1
)
echo 前端构建完成！
echo.

echo [3/4] 启动后端服务（生产模式）...
cd /d "%~dp0backend"
set PRODUCTION=1
start "后端服务" cmd /k "python main.py"
echo 后端服务已启动，监听 0.0.0.0:8000
echo.

echo [4/4] 等待服务就绪...
timeout /t 5 /nobreak >nul
echo.

echo ============================================
echo   部署完成！局域网访问地址：
echo ============================================
echo.
echo   http://%LOCAL_IP%:8000
echo.
echo   本机访问: http://localhost:8000
echo.
echo ============================================
echo   注意事项：
echo   1. 确保防火墙放行 8000 端口
echo   2. 局域网内其他设备使用上述IP访问
echo   3. 关闭此窗口不会停止后端服务
echo   4. 停止服务请关闭"后端服务"窗口
echo ============================================
echo.
pause
