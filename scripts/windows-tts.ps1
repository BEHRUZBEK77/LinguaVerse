param([Parameter(Mandatory=$true)][string]$TextFile, [Parameter(Mandatory=$true)][string]$OutputFile, [string]$Locale = 'en-GB')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $languageCode = $Locale.Split('-')[0]
  $voice = $speaker.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.TwoLetterISOLanguageName -eq $languageCode } | Select-Object -First 1
  if (-not $voice) { throw "No installed voice for $Locale. Use configured server speech for this language." }
  $speaker.SelectVoice($voice.VoiceInfo.Name)
  $speaker.Rate = -1
  $speaker.SetOutputToWaveFile($OutputFile)
  $speaker.Speak([System.IO.File]::ReadAllText($TextFile, [System.Text.Encoding]::UTF8))
} finally { $speaker.Dispose() }
