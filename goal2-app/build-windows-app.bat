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
call npx esbuild server.js --bundle --platform=node --outfile=server.bundled.js
if errorlevel 1 exit /b 1

echo [2/5] Generating the SEA blob from sea-config.json...
node --experimental-sea-config sea-config.json
if errorlevel 1 exit /b 1

echo [3/5] Copying node.exe as goal2-app.exe...
node -e "require('fs').copyFileSync(process.execPath, 'goal2-app.exe')"
if errorlevel 1 exit /b 1

echo [4/5] Removing the existing signature from the copied node.exe...
where signtool >nul 2>nul
if errorlevel 1 (
  echo Error: signtool was not found. node.exe is a digitally signed binary, and
  echo the signature MUST be removed before injecting the SEA blob into it, or
  echo the resulting goal2-app.exe will be corrupted and will not run correctly
  echo ^(it will just start a plain Node.js REPL instead of the app^).
  echo Install "Windows SDK Signing Tools for Desktop Apps" and try again.
  echo See LOCAL_WINDOWS_APP.md for installation steps.
  exit /b 1
)
signtool remove /s goal2-app.exe
if errorlevel 1 exit /b 1

echo [5/5] Injecting the blob into goal2-app.exe with postject...
call npx postject goal2-app.exe NODE_SEA_BLOB sea-prep.blob ^
  --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 ^
  --overwrite
if errorlevel 1 exit /b 1

echo.
echo Done. Double-click goal2-app.exe (together with the public and data folders
echo next to it) to start the app. A browser tab will open automatically.
endlocal
