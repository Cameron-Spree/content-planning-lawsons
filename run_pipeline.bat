@echo off
echo ========================================================
echo   Lawsons Automated Keyword-to-Content Calendar Pipeline
echo ========================================================
echo.

SET NODE_PATH="C:\Program Files\Adobe\Adobe Creative Cloud Experience\libs\node.exe"

IF EXIST %NODE_PATH% (
    %NODE_PATH% scripts\process_data.js
) ELSE (
    node scripts\process_data.js
)

echo.
echo Pipeline run finished!
pause
