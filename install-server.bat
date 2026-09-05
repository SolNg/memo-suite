@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
echo.
echo  ================================================================
echo   Cai plugin may chu cho 0-32 . San Khau Khong Bao Gio Ha Man
echo  ================================================================
echo.
echo   LUU Y: hay DONG SillyTavern (dong cua so Start.bat) truoc khi
echo   chay tep nay, neu khong Windows se khoa tep va bao loi EBUSY.
echo.
pause
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-server.ps1" %*
echo.
pause
