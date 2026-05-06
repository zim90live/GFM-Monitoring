@echo off
REM Windows 启动器：双击运行
chcp 65001 >nul
setlocal enabledelayedexpansion

REM 切换到项目根目录（脚本所在目录的上一级）
cd /d "%~dp0.."
echo 项目目录: %CD%

REM 检查 Node
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [错误] 未检测到 Node.js
  echo 请先安装 Node.js 18+: https://nodejs.org/
  echo.
  pause
  exit /b 1
)

for /f "delims=" %%v in ('node -v') do echo Node 版本: %%v

REM 判断是否需要安装依赖：node_modules 不存在 → 装；
REM 或 package-lock.json 比 node_modules\.package-lock.json 新 → 重装
set NEED_INSTALL=0
if not exist "node_modules" (
  set NEED_INSTALL=1
) else (
  if exist "package-lock.json" if exist "node_modules\.package-lock.json" (
    REM xcopy /D /L /Y 用作"是否更新过"的探测：源比目标新会列出文件
    for /f %%n in ('xcopy /D /L /Y "package-lock.json" "node_modules\.package-lock.json" 2^>nul ^| find /c /v ""') do set DIFF=%%n
    REM xcopy 输出最后一行是 "X 个文件"，所以"有更新"时计数 >= 2
    if !DIFF! GEQ 2 set NEED_INSTALL=1
  )
  if not exist "node_modules\.package-lock.json" set NEED_INSTALL=1
)

if "!NEED_INSTALL!"=="1" (
  echo.
  echo [提示] 安装/更新依赖中...
  call npm install --registry=https://registry.npmmirror.com
  if errorlevel 1 (
    echo.
    echo [错误] 依赖安装失败
    pause
    exit /b 1
  )
)

echo.
echo 启动开发服务器...
echo （关闭此窗口即可停止服务）
echo.
call npm run dev

endlocal
pause
