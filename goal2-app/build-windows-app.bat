@echo off
setlocal

echo === goal2-app Windows single executable (.exe) build ===
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Error: Node.js was not found. Please install Node.js 20 or later first.
  exit /b 1
)

echo [1/4] Generating the SEA blob from sea-config.json...
node --experimental-sea-config sea-config.json
if errorlevel 1 exit /b 1

echo [2/4] Copying node.exe as goal2-app.exe...
node -e "require('fs').copyFileSync(process.execPath, 'goal2-app.exe')"
if errorlevel 1 exit /b 1

echo [3/4] Removing the existing signature if present (skipped if signtool is not installed)...
where signtool >nul 2>nul
if not errorlevel 1 (
  signtool remove /s goal2-app.exe
)

echo [4/4] Injecting the blob into goal2-app.exe with postject...
npx postject goal2-app.exe NODE_SEA_BLOB sea-prep.blob ^
  --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 ^
  --overwrite
if errorlevel 1 exit /b 1

echo.
echo Done. Double-click goal2-app.exe to start the app.
echo A browser tab will open automatically.
endlocal
