param([string]$BaseUrl = "http://localhost:3000")

$ErrorActionPreference = "Stop"
$stamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$email = "exam-e2e-$stamp@polaris.test"
$password = "ExamTest-$stamp!"
$web = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$sessions = New-Object System.Collections.Generic.List[string]

function Assert-Value([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw "ASSERTION FAILED: $Message" }
}

function Invoke-ExamJson {
  param([string]$Method, [string]$Path, $Body = $null)
  $arguments = @{
    Method = $Method
    Uri = "$BaseUrl$Path"
    WebSession = $web
  }
  if ($null -ne $Body) {
    $arguments.ContentType = "application/json"
    $arguments.Body = ($Body | ConvertTo-Json -Depth 8 -Compress)
  }
  return Invoke-RestMethod @arguments
}

Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/auth/register" -ContentType "application/json" -Body (@{
  name = "Exam E2E"
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

$catalog = Invoke-ExamJson GET "/api/exams/catalog"
Assert-Value ($catalog.available.Count -eq 6) "catalog should expose all six modes"
Assert-Value ($catalog.available[0].coverage.PSObject.Properties.Name -contains "estimatedFreshForms") "catalog should expose question-bank coverage"

$math = Invoke-ExamJson POST "/api/exams/sessions" @{ mode = "sat-math-module" }
$sessions.Add($math.id)
$mathState = Invoke-ExamJson GET "/api/exams/sessions/$($math.id)"
Assert-Value ($mathState.items.Count -eq 22) "SAT Math should contain 22 questions"
Assert-Value (-not ($mathState.items[0].PSObject.Properties.Name -contains "correctAnswer")) "public items must not expose answer keys"
$duplicateFreshBlocked = $false
try {
  Invoke-ExamJson POST "/api/exams/sessions" @{ mode = "sat-math-module"; policy = "fresh" } | Out-Null
} catch {
  $duplicateFreshBlocked = $_.Exception.Response.StatusCode -eq 409
}
Assert-Value $duplicateFreshBlocked "fresh must not silently resume an active attempt"
$abandoned = Invoke-ExamJson PATCH "/api/exams/sessions/$($math.id)" @{ action = "abandon" }
Assert-Value ($abandoned.status -eq "abandoned") "an active attempt should be explicitly abandonable"
$mathRestart = Invoke-ExamJson POST "/api/exams/sessions" @{ mode = "sat-math-module"; policy = "same-form"; sourceSessionId = $math.id }
$sessions.Add($mathRestart.id)
$mathRestartState = Invoke-ExamJson GET "/api/exams/sessions/$($mathRestart.id)"
Assert-Value ($mathRestartState.items[0].id -eq $mathState.items[0].id -and $mathRestartState.revision -eq 0) "restart should reuse the immutable form with clean response state"

$sat = Invoke-ExamJson POST "/api/exams/sessions" @{ mode = "sat-full" }
$sessions.Add($sat.id)
$satState = Invoke-ExamJson GET "/api/exams/sessions/$($sat.id)"
Assert-Value ($satState.items.Count -eq 27) "SAT RW Module 1 should contain 27 questions"
$rwModuleOneFingerprint = "$($satState.items[0].prompt)|$($satState.items[0].stimulus.content)"
$revision = $satState.revision
for ($index = 0; $index -lt 17; $index += 1) {
  $answer = @("A", "B", "B", "B")[$index % 4]
  $saved = Invoke-ExamJson PATCH "/api/exams/sessions/$($sat.id)/responses" @{
    itemId = $satState.items[$index].id
    answer = $answer
    flagged = $false
    revision = $revision
  }
  $revision = $saved.revision
}
$next = Invoke-ExamJson POST "/api/exams/sessions/$($sat.id)/submit"
Assert-Value (-not $next.completed) "SAT should advance after RW Module 1"
$satState = Invoke-ExamJson GET "/api/exams/sessions/$($sat.id)"
Assert-Value ($satState.items[0].id.StartsWith("sat-rw-advanced")) "60%+ RW accuracy should select the advanced route"
Assert-Value ("$($satState.items[0].prompt)|$($satState.items[0].stimulus.content)" -ne $rwModuleOneFingerprint) "adaptive RW Module 2 must not repeat Module 1 content"
Invoke-ExamJson POST "/api/exams/sessions/$($sat.id)/submit" | Out-Null
$breakState = Invoke-ExamJson GET "/api/exams/sessions/$($sat.id)"
Assert-Value ($breakState.stageKind -eq "break") "SAT should insert the scheduled break"
Invoke-ExamJson POST "/api/exams/sessions/$($sat.id)/submit" | Out-Null
$mathOne = Invoke-ExamJson GET "/api/exams/sessions/$($sat.id)"
Assert-Value ($mathOne.items.Count -eq 22) "SAT Math Module 1 should contain 22 questions"
$mathModuleOneFingerprint = $mathOne.items[0].prompt
$revision = $mathOne.revision
for ($index = 0; $index -lt 16; $index += 1) {
  $saved = Invoke-ExamJson PATCH "/api/exams/sessions/$($sat.id)/responses" @{
    itemId = $mathOne.items[$index].id
    answer = "C"
    flagged = $false
    revision = $revision
  }
  $revision = $saved.revision
}
Invoke-ExamJson POST "/api/exams/sessions/$($sat.id)/submit" | Out-Null
$mathTwo = Invoke-ExamJson GET "/api/exams/sessions/$($sat.id)"
Assert-Value ($mathTwo.items[0].id.StartsWith("sat-math-advanced")) "60%+ Math accuracy should select the advanced route"
Assert-Value ($mathTwo.items[0].prompt -ne $mathModuleOneFingerprint) "adaptive Math Module 2 must not repeat Module 1 content"
$satDone = Invoke-ExamJson POST "/api/exams/sessions/$($sat.id)/submit"
Assert-Value $satDone.completed "SAT should complete after Math Module 2"
$satResult = Invoke-ExamJson GET "/api/exams/sessions/$($sat.id)/results"
Assert-Value ($satResult.total -eq 98) "full SAT result should score 98 questions"
Assert-Value ($satResult.routes.Count -eq 2) "full SAT result should report both adaptive routes"

$catalogAfterSat = Invoke-ExamJson GET "/api/exams/catalog"
$satCoverage = $catalogAfterSat.available | Where-Object { $_.mode -eq "sat-full" }
Assert-Value ($satCoverage.coverage.estimatedFreshForms -eq 0) "seen core modules should exhaust the current one-form SAT bank"
$freshBlocked = $false
try {
  Invoke-ExamJson POST "/api/exams/sessions" @{ mode = "sat-full"; policy = "fresh" } | Out-Null
} catch {
  $freshBlocked = $_.Exception.Response.StatusCode -eq 409
}
Assert-Value $freshBlocked "an exhausted bank must not label repeated questions as a fresh form"

$satStandard = Invoke-ExamJson POST "/api/exams/sessions" @{ mode = "sat-full"; policy = "same-form"; sourceSessionId = $sat.id }
$sessions.Add($satStandard.id)
$sameFormState = Invoke-ExamJson GET "/api/exams/sessions/$($satStandard.id)"
Assert-Value ($sameFormState.items[0].id -eq $satResult.review[0].itemId) "same-form retakes should reuse the immutable source form"
Invoke-ExamJson POST "/api/exams/sessions/$($satStandard.id)/submit" | Out-Null
$standardState = Invoke-ExamJson GET "/api/exams/sessions/$($satStandard.id)"
Assert-Value ($standardState.items[0].id.StartsWith("sat-rw-standard")) "low RW accuracy should select the standard route"

foreach ($mode in @("ielts-reading", "ielts-listening")) {
  $created = Invoke-ExamJson POST "/api/exams/sessions" @{ mode = $mode }
  $sessions.Add($created.id)
  $state = Invoke-ExamJson GET "/api/exams/sessions/$($created.id)"
  Assert-Value ($state.items.Count -eq 40) "$mode should contain 40 questions"
  if ($mode -eq "ielts-reading") {
    $resumed = Invoke-ExamJson POST "/api/exams/sessions" @{ mode = $mode; policy = "resume" }
    Assert-Value ($resumed.id -eq $created.id -and $resumed.resumed) "resume should return the existing active attempt"
  }
  if ($mode -eq "ielts-listening") {
    Assert-Value ($state.items[0].stimulus.mediaUrl -eq "part-1") "listening items should reference a protected audio part"
    $audio = Invoke-WebRequest -Method Post -Uri "$BaseUrl/api/exams/sessions/$($created.id)/audio" -WebSession $web -ContentType "application/json" -Body '{"part":"part-1"}'
    Assert-Value ($audio.RawContentLength -gt 1000) "protected listening audio should stream after the first claim"
    $replayBlocked = $false
    try {
      Invoke-WebRequest -Method Post -Uri "$BaseUrl/api/exams/sessions/$($created.id)/audio" -WebSession $web -ContentType "application/json" -Body '{"part":"part-1"}' | Out-Null
    } catch {
      $replayBlocked = $_.Exception.Response.StatusCode -eq 409
    }
    Assert-Value $replayBlocked "a listening part must not be claimable twice"
  }
  Invoke-ExamJson POST "/api/exams/sessions/$($created.id)/submit" | Out-Null
  $result = Invoke-ExamJson GET "/api/exams/sessions/$($created.id)/results"
  Assert-Value ($result.total -eq 40) "$mode should score 40 questions"
}

$writing = Invoke-ExamJson POST "/api/exams/sessions" @{ mode = "ielts-writing" }
$sessions.Add($writing.id)
$writingState = Invoke-ExamJson GET "/api/exams/sessions/$($writing.id)"
Assert-Value ($writingState.items.Count -eq 2) "writing should contain both tasks"
$revision = $writingState.revision
$taskOne = (1..160 | ForEach-Object { "word$_" }) -join " "
$taskTwo = (1..260 | ForEach-Object { "word$_" }) -join " "
foreach ($pair in @(@($writingState.items[0].id, $taskOne), @($writingState.items[1].id, $taskTwo))) {
  $saved = Invoke-ExamJson PATCH "/api/exams/sessions/$($writing.id)/responses" @{
    itemId = $pair[0]
    answer = $pair[1]
    flagged = $false
    revision = $revision
  }
  $revision = $saved.revision
}
Invoke-ExamJson POST "/api/exams/sessions/$($writing.id)/submit" | Out-Null
$writingResult = Invoke-ExamJson GET "/api/exams/sessions/$($writing.id)/results"
Assert-Value ($writingResult.writtenMetrics.Count -eq 2) "writing should report both word-count metrics"
Assert-Value ($writingResult.writtenMetrics[0].metMinimum -and $writingResult.writtenMetrics[1].metMinimum) "writing minimums should be calculated"
$coach = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/exams/sessions/$($writing.id)/coach" -WebSession $web -Headers @{ "x-polaris-gemma-key" = "invalid-e2e-key" }
Assert-Value ($coach.summary.Length -gt 10) "post-exam coaching should survive an unavailable AI provider"
Assert-Value ($coach.source -eq "deterministic-fallback") "invalid provider credentials should use deterministic coaching"

$speaking = Invoke-ExamJson POST "/api/exams/sessions" @{ mode = "ielts-speaking" }
$sessions.Add($speaking.id)
$speakingState = Invoke-ExamJson GET "/api/exams/sessions/$($speaking.id)"
Assert-Value ($speakingState.items.Count -eq 3) "speaking should contain three parts"
$recordingPath = Join-Path $PSScriptRoot "..\assets\exams\ielts-listening\part-1.wav"
$cookieHeader = ($web.Cookies.GetCookies($BaseUrl) | ForEach-Object { "$($_.Name)=$($_.Value)" }) -join "; "
$uploadRaw = & curl.exe --silent --show-error --fail-with-body -X POST -H "Cookie: $cookieHeader" -F "itemId=$($speakingState.items[0].id)" -F "transcript=This is a private speaking test transcript." -F "revision=$($speakingState.revision)" -F "audio=@$recordingPath;type=audio/wav" "$BaseUrl/api/exams/sessions/$($speaking.id)/recording"
if ($LASTEXITCODE -ne 0) { throw "Speaking upload failed: $uploadRaw" }
$upload = $uploadRaw | ConvertFrom-Json
Assert-Value ($upload.revision -eq 1) "speaking recording should increment the session revision"
$download = Invoke-WebRequest -Uri "$BaseUrl/api/exams/sessions/$($speaking.id)/recording?itemId=$($speakingState.items[0].id)" -WebSession $web
Assert-Value ($download.RawContentLength -gt 1000) "the authenticated recording should be downloadable"
Invoke-ExamJson POST "/api/exams/sessions/$($speaking.id)/submit" | Out-Null
$speakingResult = Invoke-ExamJson GET "/api/exams/sessions/$($speaking.id)/results"
Assert-Value ($speakingResult.review[0].hasRecording -and -not $speakingResult.review[1].hasRecording) "speaking review should expose audio controls only for recorded parts"
$locked = $false
try {
  Invoke-ExamJson PATCH "/api/exams/sessions/$($speaking.id)/responses" @{
    itemId = $speakingState.items[0].id
    answer = "changed"
    flagged = $false
    revision = $upload.revision
  } | Out-Null
} catch {
  $locked = $_.Exception.Response.StatusCode -eq 409
}
Assert-Value $locked "completed speaking responses must be locked"

[pscustomobject]@{
  ok = $true
  email = $email
  sessions = $sessions
  checks = @(
    "six-mode catalog",
    "bank coverage and explicit exhaustion",
    "resume and same-form policies",
    "explicit abandon and restart lifecycle",
    "SAT Math compatibility",
    "SAT advanced and standard routing",
    "adaptive module content separation",
    "98-question SAT result",
    "IELTS Reading and Listening counts",
    "Writing persistence and metrics",
    "Post-exam coaching fallback",
    "Speaking upload, private download, and lock"
  )
} | ConvertTo-Json -Depth 5
