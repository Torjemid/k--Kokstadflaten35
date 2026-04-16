param(
  [int]$Port = 8080
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$Port/")

$contentTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "application/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".svg"  = "image/svg+xml"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".ico"  = "image/x-icon"
}

try {
  try {
    $listener.Start()
  }
  catch {
    Write-Host "Could not start dashboard server on http://localhost:$Port" -ForegroundColor Red
    Write-Host "The port is already in use, or another listener is registered on that address." -ForegroundColor Yellow
    Write-Host "Try another port, for example:" -ForegroundColor Yellow
    Write-Host "powershell -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Port 8090"
    return
  }

  Write-Host "Dashboard server running at http://localhost:$Port"
  Write-Host "Press Ctrl+C to stop."

  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $requestPath = [System.Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart("/"))

    if ([string]::IsNullOrWhiteSpace($requestPath)) {
      $requestPath = "index.html"
    }

    $filePath = Join-Path $root $requestPath

    if ((Test-Path -LiteralPath $filePath -PathType Container)) {
      $filePath = Join-Path $filePath "index.html"
    }

    if (-not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
      $context.Response.StatusCode = 404
      $buffer = [System.Text.Encoding]::UTF8.GetBytes("Not found")
      $context.Response.OutputStream.Write($buffer, 0, $buffer.Length)
      $context.Response.Close()
      continue
    }

    $extension = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()
    $context.Response.ContentType = $contentTypes[$extension]
    if (-not $context.Response.ContentType) {
      $context.Response.ContentType = "application/octet-stream"
    }

    $bytes = [System.IO.File]::ReadAllBytes($filePath)
    $context.Response.ContentLength64 = $bytes.Length
    $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $context.Response.Close()
  }
}
finally {
  if ($listener) {
    if ($listener.IsListening) {
      $listener.Stop()
    }
    $listener.Close()
  }
}
