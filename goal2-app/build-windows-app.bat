@echo off
setlocal

echo === goal2-app Windows single executable (.exe) build ===
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Error: Node.js was not found. Please install Node.js 20 or later first.
  exit /b 1
)

echo [1/5] Bundling server.js and its local dependencies into a single file...
echo (Node's single-executable feature does not resolve require() calls to local
echo  files such as ./lib/rules at runtime, so everything must be bundled first.)
npx esbuild server.js --bundle --platform=node --outfile=server.bundled.js
if errorlevel 1 exit /b 1

echo [2/5] Generating the SEA blob from sea-config.json...
node --experimental-sea-config sea-config.json
if errorlevel 1 exit /b 1

echo [3/5] Copying node.exe as goal2-app.exe...
node -e "require('fs').copyFileSync(process.execPath, 'goal2-app.exe')"
if errorlevel 1 exit /b 1

echo [4/5] Removing the existing signature if present (skipped if signtool is not installed)...
where signtool >nul 2>nul
if not errorlevel 1 (
  signtool remove /s goal2-app.exe
)

echo [5/5] Injecting the blob into goal2-app.exe with postject...
npx postject goal2-app.exe NODE_SEA_BLOB sea-prep.blob ^
  --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 ^
  --overwrite
if errorlevel 1 exit /b 1

echo.
echo Done. Double-click goal2-app.exe (together with the public and data folders
echo next to it) to start the app. A browser tab will open automatically.
endlocal
