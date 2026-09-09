# Node.js 없이 실행되는 AtCoder Practice 로컬 서버 겸 API 프록시
$ErrorActionPreference = 'Stop'
$Root = $PSScriptRoot
$Prefix = 'http://localhost:4173/'
$AtCoderBase = 'https://kenkoooo.com/atcoder'
$Mime = @{ '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json; charset=utf-8' }

function Send-Text($Response, [int]$StatusCode, [string]$Text, [string]$ContentType = 'text/plain; charset=utf-8') {
  $Bytes = [Text.Encoding]::UTF8.GetBytes($Text)
  $Response.StatusCode = $StatusCode
  $Response.ContentType = $ContentType
  $Response.ContentLength64 = $Bytes.Length
  $Response.OutputStream.Write($Bytes, 0, $Bytes.Length)
  $Response.Close()
}

$Listener = [System.Net.HttpListener]::new()
$Listener.Prefixes.Add($Prefix)
try { $Listener.Start() }
catch { Write-Host "서버를 시작하지 못했습니다: $($_.Exception.Message)" -ForegroundColor Red; exit 1 }

Write-Host "AtCoder Practice 실행 중: $Prefix" -ForegroundColor Green
Write-Host '이 창을 닫지 말고 브라우저에서 위 주소를 여세요. 종료: Ctrl+C'

try {
  while ($Listener.IsListening) {
    $Context = $Listener.GetContext()
    $Request = $Context.Request
    $Response = $Context.Response
    $RawUrl = $Request.RawUrl

    if ($RawUrl.StartsWith('/api/')) {
      try {
        $Target = $AtCoderBase + $RawUrl.Substring(4)
        $Upstream = Invoke-WebRequest -Uri $Target -UseBasicParsing -Headers @{ 'User-Agent' = 'AtCoder-Practice-Local/1.0' }
        $Bytes = $Upstream.Content
        if ($Bytes -is [string]) { $Bytes = [Text.Encoding]::UTF8.GetBytes($Bytes) }
        $Response.StatusCode = 200
        $Response.ContentType = if ($Upstream.Headers['Content-Type']) { $Upstream.Headers['Content-Type'] } else { 'application/json; charset=utf-8' }
        $Response.ContentLength64 = $Bytes.Length
        $Response.OutputStream.Write($Bytes, 0, $Bytes.Length)
        $Response.Close()
      } catch {
        Send-Text $Response 502 "AtCoder Problems API에 연결할 수 없습니다: $($_.Exception.Message)"
      }
      continue
    }

    $Relative = if ($RawUrl -eq '/') { 'index.html' } else { $RawUrl.TrimStart('/').Split('?')[0] }
    if ($Relative -notmatch '^(index\.html|app\.js|styles\.css|config\.js)$') { Send-Text $Response 404 'Not found'; continue }
    $File = Join-Path $Root $Relative
    if (-not (Test-Path -LiteralPath $File -PathType Leaf)) { Send-Text $Response 404 'Not found'; continue }
    $Bytes = [IO.File]::ReadAllBytes($File)
    $Extension = [IO.Path]::GetExtension($File)
    $Response.StatusCode = 200
    $Response.ContentType = $Mime[$Extension]
    $Response.ContentLength64 = $Bytes.Length
    $Response.OutputStream.Write($Bytes, 0, $Bytes.Length)
    $Response.Close()
  }
} finally { if ($Listener.IsListening) { $Listener.Stop() }; $Listener.Close() }
