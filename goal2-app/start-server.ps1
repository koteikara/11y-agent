$ErrorActionPreference = 'Stop'

Set-Location $PSScriptRoot

if (-not $env:PORT) {
  $env:PORT = '8080'
}

$logPath = Join-Path $PSScriptRoot 'server.log'

try {
  "Starting Goal2 server on PORT=$($env:PORT) at $(Get-Date -Format o)" | Out-File -FilePath $logPath -Encoding utf8
  & 'C:\Program Files\nodejs\node.exe' (Join-Path $PSScriptRoot 'server.js') *>> $logPath
  "Node process exited with code $LASTEXITCODE at $(Get-Date -Format o)" | Out-File -FilePath $logPath -Encoding utf8 -Append
  exit $LASTEXITCODE
} catch {
  $_ | Out-File -FilePath $logPath -Encoding utf8 -Append
  exit 1
}
