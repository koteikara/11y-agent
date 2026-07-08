@echo off
setlocal

echo === goal2-app Windows single executable (.exe) build ===
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Error: Node.js was not found. Please install Node.js 20 or later first.
  exit /b 1
)

echo [1/6] Bundling server.js and its local dependencies into a single file...
echo (Node's single-executable feature does not resolve require() calls to local
echo  files such as ./lib/rules at runtime, so everything must be bundled first.)
call npx esbuild server.js --bundle --platform=node --outfile=server.bundled.js
if errorlevel 1 exit /b 1

echo [2/6] Generating the SEA blob from sea-config.json...
node --experimental-sea-config sea-config.json
if errorlevel 1 exit /b 1

echo [3/6] Copying node.exe as goal2-app.exe...
node -e "require('fs').copyFileSync(process.execPath, 'goal2-app.exe')"
if errorlevel 1 exit /b 1

echo [4/6] Removing the existing signature from the copied node.exe...
set "SIGNTOOL="
where signtool >nul 2>nul
if not errorlevel 1 (
  set "SIGNTOOL=signtool"
) else (
  rem signtool is commonly installed under the Windows SDK folder without
  rem being added to PATH. Search the usual install location as a fallback.
  for /f "delims=" %%F in ('dir /s /b "C:\Program Files (x86)\Windows Kits\10\bin\signtool.exe" 2^>nul') do set "SIGNTOOL=%%F"
)
if not defined SIGNTOOL (
  echo Error: signtool was not found. node.exe is a digitally signed binary, and
  echo the signature MUST be removed before injecting the SEA blob into it, or
  echo the resulting goal2-app.exe will be corrupted and will not run correctly
  echo ^(it will just start a plain Node.js REPL instead of the app^).
  echo If you just installed "Windows SDK Signing Tools for Desktop Apps",
  echo close this window and open a new one so the updated PATH takes effect.
  echo See LOCAL_WINDOWS_APP.md for installation steps.
  exit /b 1
)
"%SIGNTOOL%" remove /s goal2-app.exe
if errorlevel 1 exit /b 1

echo [5/6] Injecting the blob into goal2-app.exe with postject...
call npx postject goal2-app.exe NODE_SEA_BLOB sea-prep.blob ^
  --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 ^
  --overwrite
if errorlevel 1 exit /b 1

echo [6/6] Packaging goal2-app.exe together with public/data into a single ZIP...
echo (goal2-app.exe needs the public and data folders next to it to run, so
echo  everything a recipient needs is bundled into one file to hand over.)
powershell -NoProfile -Command "Compress-Archive -Path 'goal2-app.exe','public','data' -DestinationPath 'goal2-app-windows.zip' -Force"
if errorlevel 1 exit /b 1

echo.
echo Done. goal2-app-windows.zip is ready to share - send that single file to
echo whoever needs to use the app. They just extract it anywhere and
echo double-click goal2-app.exe inside; a browser tab will open automatically.
endlocal
