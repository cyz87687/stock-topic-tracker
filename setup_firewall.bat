@echo off
chcp 65001 >nul 2>&1
title 防火墙端口配置

echo ============================================
echo   配置Windows防火墙 - 放行系统端口
echo ============================================
echo.
echo 需要管理员权限运行此脚本！
echo.

net session >nul 2>&1
if errorlevel 1 (
    echo [错误] 请右键此脚本，选择"以管理员身份运行"
    pause
    exit /b 1
)

echo [1/3] 放行后端端口 8000 (TCP)...
netsh advfirewall firewall delete rule name="A股题材追踪-后端-8000" >nul 2>&1
netsh advfirewall firewall add rule name="A股题材追踪-后端-8000" dir=in action=allow protocol=TCP localport=8000
echo 后端端口 8000 已放行

echo.
echo [2/3] 放行前端开发端口 5173 (TCP)...
netsh advfirewall firewall delete rule name="A股题材追踪-前端-5173" >nul 2>&1
netsh advfirewall firewall add rule name="A股题材追踪-前端-5173" dir=in action=allow protocol=TCP localport=5173
echo 前端端口 5173 已放行

echo.
echo [3/3] 放行Nginx端口 80 (TCP)...
netsh advfirewall firewall delete rule name="A股题材追踪-Nginx-80" >nul 2>&1
netsh advfirewall firewall add rule name="A股题材追踪-Nginx-80" dir=in action=allow protocol=TCP localport=80
echo Nginx端口 80 已放行

echo.
echo ============================================
echo   防火墙配置完成！
echo   已放行端口: 8000, 5173, 80
echo ============================================
echo.

echo 当前防火墙入站规则:
netsh advfirewall firewall show rule name="A股题材追踪-后端-8000" | findstr /c:"规则名" /c:"本地端口" /c:"方向" /c:"操作"
echo.
netsh advfirewall firewall show rule name="A股题材追踪-前端-5173" | findstr /c:"规则名" /c:"本地端口" /c:"方向" /c:"操作"
echo.
netsh advfirewall firewall show rule name="A股题材追踪-Nginx-80" | findstr /c:"规则名" /c:"本地端口" /c:"方向" /c:"操作"

echo.
pause
