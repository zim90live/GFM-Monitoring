@echo off
REM Windows 启动器：双击运行
chcp 65001 >nul
setlocal

REM 切换到项目根目录（脚本所在目录的上一级）
cd /d "%~dp0\.."
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

REM 首次运行 或 package.json 比 node_modules 新 时安装依赖
set NEED_INSTALL=0
if not exist "node_modules" set NEED_INSTALL=1
if exist "node_modules" (
  for %%a in (package.json) do set PJ_TIME=%%~ta
  for %%a in (node_modules) do set NM_TIME=%%~ta
  REM 简易比较：字符串比较时间戳；不严格但够用
  if "%PJ_TIME%" GTR "%NM_TIME%" set NEED_INSTALL=1
)
if "%NEED_INSTALL%"=="1" (
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
