param(
  [string]$OutputDirectory = (Join-Path $PSScriptRoot "..\assets\exams\ielts-listening")
)

$resolvedProject = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
if (-not $resolvedOutput.StartsWith($resolvedProject, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Output directory must stay inside the Polaris project."
}

Add-Type -AssemblyName System.Speech
[System.IO.Directory]::CreateDirectory($resolvedOutput) | Out-Null

$scripts = @(
  "You are calling Northbridge Community Centre. The photography workshop begins on Tuesday the twelfth of March at six thirty in the evening. It is held in Room Fourteen. The fee is thirty-five pounds and includes printed materials. Please bring your own camera. Registration closes on Friday.",
  "Welcome to Lakeside Residence. Breakfast is served from seven until nine in the ground-floor dining hall. The laundry room is beside reception and uses prepaid cards. Quiet hours begin at ten thirty at night. Bicycles must be stored behind Block C, and visitors should sign in at the front desk.",
  "The student research project compared three roof materials during summer. White metal stayed coolest at twenty-eight degrees Celsius. Dark tile reached thirty-seven degrees, while the planted roof averaged thirty-one. The team measured temperature every fifteen minutes and found that moisture loss affected the planted roof after five rainless days.",
  "In today's lecture, we consider coastal archaeology. Wooden structures can survive underwater when oxygen levels are low. Divers first photograph a site and mark a grid before removing objects. Sediment samples reveal pollen and food remains. Conservation begins immediately because waterlogged wood may crack if it dries too quickly."
)

for ($index = 0; $index -lt $scripts.Count; $index += 1) {
  $target = Join-Path $resolvedOutput ("part-{0}.wav" -f ($index + 1))
  $voice = New-Object System.Speech.Synthesis.SpeechSynthesizer
  try {
    $voice.Rate = -1
    $voice.Volume = 100
    $voice.SetOutputToWaveFile($target)
    $voice.Speak($scripts[$index])
  } finally {
    $voice.Dispose()
  }
}

Write-Output "Generated $($scripts.Count) IELTS listening files in $resolvedOutput"
