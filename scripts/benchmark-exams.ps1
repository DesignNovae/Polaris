param(
  [string]$BaseUrl = "http://localhost:3000",
  [int]$CreateRuns = 1,
  [int]$SaveRuns = 24,
  [int]$ConcurrentReads = 20
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Net.Http
$stamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$email = "exam-e2e-$stamp@polaris.test"
$password = "ExamBench-$stamp!"
$web = New-Object Microsoft.PowerShell.Commands.WebRequestSession

function Invoke-Json {
  param([string]$Method, [string]$Path, $Body = $null)
  $arguments = @{ Method = $Method; Uri = "$BaseUrl$Path"; WebSession = $web }
  if ($null -ne $Body) {
    $arguments.ContentType = "application/json"
    $arguments.Body = ($Body | ConvertTo-Json -Depth 8 -Compress)
  }
  Invoke-RestMethod @arguments
}

function Measure-Json {
  param([string]$Method, [string]$Path, $Body = $null)
  $timer = [Diagnostics.Stopwatch]::StartNew()
  $value = Invoke-Json $Method $Path $Body
  $timer.Stop()
  [pscustomobject]@{ milliseconds = [math]::Round($timer.Elapsed.TotalMilliseconds, 1); value = $value }
}

function Summarize([double[]]$Values) {
  $sorted = @($Values | Sort-Object)
  $p50Index = [math]::Min($sorted.Count - 1, [math]::Floor(($sorted.Count - 1) * 0.50))
  $p95Index = [math]::Min($sorted.Count - 1, [math]::Ceiling(($sorted.Count - 1) * 0.95))
  [pscustomobject]@{
    count = $sorted.Count
    minMs = [math]::Round($sorted[0], 1)
    p50Ms = [math]::Round($sorted[$p50Index], 1)
    p95Ms = [math]::Round($sorted[$p95Index], 1)
    maxMs = [math]::Round($sorted[-1], 1)
    averageMs = [math]::Round(($sorted | Measure-Object -Average).Average, 1)
  }
}

Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/auth/register" -ContentType "application/json" -Body (@{
  name = "Exam Benchmark"
  email = $email
  password = $password
  role = "student"
} | ConvertTo-Json -Compress) | Out-Null
$csrf = Invoke-RestMethod -Uri "$BaseUrl/api/auth/csrf" -WebSession $web
Invoke-WebRequest -Method Post -Uri "$BaseUrl/api/auth/callback/credentials" -WebSession $web -ContentType "application/x-www-form-urlencoded" -Body @{
  csrfToken = $csrf.csrfToken
  email = $email
  password = $password
  callbackUrl = "$BaseUrl/action-lab"
  json = "true"
} | Out-Null

$catalogTimes = 1..8 | ForEach-Object { (Measure-Json GET "/api/exams/catalog").milliseconds }
$createMeasurements = @{}
$lastSessions = @{}
foreach ($mode in @("sat-math-module", "sat-full", "ielts-reading", "ielts-listening", "ielts-writing", "ielts-speaking")) {
  $times = @()
  for ($run = 0; $run -lt $CreateRuns; $run += 1) {
    $measurement = Measure-Json POST "/api/exams/sessions" @{ mode = $mode }
    $times += $measurement.milliseconds
    $lastSessions[$mode] = $measurement.value.id
  }
  $createMeasurements[$mode] = Summarize $times
}

$satId = $lastSessions["sat-full"]
$satState = Invoke-Json GET "/api/exams/sessions/$satId"
$revision = $satState.revision
$saveTimes = @()
for ($index = 0; $index -lt [math]::Min($SaveRuns, $satState.items.Count); $index += 1) {
  $measurement = Measure-Json PATCH "/api/exams/sessions/$satId/responses" @{
    itemId = $satState.items[$index].id
    answer = @("A", "B", "B", "B")[$index % 4]
    flagged = ($index % 5 -eq 0)
    revision = $revision
  }
  $revision = $measurement.value.revision
  $saveTimes += $measurement.milliseconds
}

$payloads = @{}
foreach ($mode in @("sat-full", "ielts-reading", "ielts-listening", "ielts-writing", "ielts-speaking")) {
  $id = $lastSessions[$mode]
  $response = Invoke-WebRequest -Uri "$BaseUrl/api/exams/sessions/$id" -WebSession $web
  $payloads[$mode] = $response.RawContentLength
}

$cookieHeader = ($web.Cookies.GetCookies($BaseUrl) | ForEach-Object { "$($_.Name)=$($_.Value)" }) -join "; "
$handler = [Net.Http.HttpClientHandler]::new()
$handler.UseCookies = $false
$client = [Net.Http.HttpClient]::new($handler)
$requests = New-Object System.Collections.Generic.List[System.Net.Http.HttpRequestMessage]
$concurrentTimer = [Diagnostics.Stopwatch]::StartNew()
$tasks = 1..$ConcurrentReads | ForEach-Object {
  $message = [Net.Http.HttpRequestMessage]::new([Net.Http.HttpMethod]::Get, "$BaseUrl/api/exams/sessions/$satId")
  $message.Headers.TryAddWithoutValidation("Cookie", $cookieHeader) | Out-Null
  $requests.Add($message)
  $client.SendAsync($message)
}
[Threading.Tasks.Task]::WaitAll([Threading.Tasks.Task[]]$tasks)
$responses = $tasks | ForEach-Object { $_.Result }
$concurrentTimer.Stop()
$concurrentOk = @($responses | Where-Object { [int]$_.StatusCode -eq 200 }).Count
$statusCodes = @($responses | Group-Object { [int]$_.StatusCode } | ForEach-Object { [pscustomobject]@{ status = [int]$_.Name; count = $_.Count } })
$responses | ForEach-Object { $_.Dispose() }
$requests | ForEach-Object { $_.Dispose() }
$client.Dispose()
$handler.Dispose()

[pscustomobject]@{
  ok = $true
  email = $email
  catalog = Summarize ([double[]]$catalogTimes)
  sessionCreation = $createMeasurements
  answerSave = Summarize ([double[]]$saveTimes)
  sessionPayloadBytes = $payloads
  concurrentSessionReads = [pscustomobject]@{
    requests = $ConcurrentReads
    succeeded = $concurrentOk
    statusCodes = $statusCodes
    wallTimeMs = [math]::Round($concurrentTimer.Elapsed.TotalMilliseconds, 1)
    requestsPerSecond = [math]::Round($ConcurrentReads / [math]::Max(0.001, $concurrentTimer.Elapsed.TotalSeconds), 1)
  }
} | ConvertTo-Json -Depth 8
