# LinguaVerse — tungi avtomatik dars yozish (OpenCode orqali)
#
# Har bir til uchun darslarni BITTADAN yozdiradi: har dars = alohida `opencode run`.
# Model limitga tushsa yoki 2 marta natija bermasa — keyingi eng yaxshi bepul modelga o'tadi.
# Hamma modellar limitda bo'lsa — 15 daqiqa kutib, qaytadan urinadi. Belgilangan vaqtgacha ishlaydi.
#
#   powershell -ExecutionPolicy Bypass -File scripts\tun.ps1 -Test            # tekshirish, hech narsa yozmaydi
#   powershell -ExecutionPolicy Bypass -File scripts\tun.ps1 -Lang russian    # bitta til
#   powershell -ExecutionPolicy Bypass -File scripts\tun.ps1                  # 7 til, har biri alohida oynada
param(
  [string]$Lang = '',
  [string]$Until = '08:00',
  [switch]$Test
)

$ErrorActionPreference = 'Continue'
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}
$AllLangs = @('russian', 'turkish', 'german', 'spanish', 'arabic', 'chinese', 'korean')
# Sifat bo'yicha tartib (nomida shu so'z bor model birinchi tanlanadi)
$Preferred = @('deepseek', 'glm', 'big-pickle', 'pickle', 'mimo', 'kimi', 'qwen', 'super', 'crouton', 'beam', 'iceman', 'nemotron', 'inkling', 'flint')
$LimitRx = 'free messages|rate.?limit|429|quota|usage limit|limit (reached|exceeded)|insufficient|credit|expired|too many requests|overloaded|unauthorized|401|402|403'
$RunMinutes = 45
$Dir = Join-Path $Root '.overnight'
New-Item -ItemType Directory -Force -Path $Dir | Out-Null

function Log($lang, $msg) {
  $line = "$(Get-Date -Format 'HH:mm:ss') [$lang] $msg"
  Write-Host $line
  Add-Content -Path (Join-Path $Dir "log-$lang.txt") -Value $line -Encoding UTF8
}

function Get-FreeModels {
  $all = @(& opencode models 2>$null | ForEach-Object { "$_".Trim() } | Where-Object { $_ -match '^[\w.-]+/[\w.:-]+$' })
  $free = @($all | Where-Object { $_ -match 'free|pickle' })
  $ordered = New-Object System.Collections.ArrayList
  foreach ($p in $Preferred) { foreach ($m in $free) { if ($m -match [regex]::Escape($p) -and -not $ordered.Contains($m)) { [void]$ordered.Add($m) } } }
  foreach ($m in $free) { if (-not $ordered.Contains($m)) { [void]$ordered.Add($m) } }
  return @($ordered)
}

function Get-NextId($lang) {
  # Birinchi GitHub'ga yuklanmagan dars (diskda chala fayl bo'lsa ham — uni tuzatish kerak)
  $tracked = @{}
  & git ls-files "content/uz/$lang" | ForEach-Object { $tracked[[IO.Path]::GetFileNameWithoutExtension($_)] = 1 }
  foreach ($lv in 'A1', 'A2', 'B1', 'B2', 'C1', 'C2') { foreach ($n in 1..25) {
    $id = '{0}-{1:D2}' -f $lv, $n
    if (-not $tracked.ContainsKey($id)) { return $id }
  } }
  return $null
}

function Get-ModelFlag {
  $h = (& opencode run --help 2>&1 | Out-String)
  if ($h -match '--model') { return '--model' }
  if ($h -match '(^|\s)-m[\s,]') { return '-m' }
  return $null
}

function Task-Text($lang, $id) {
@"
You are writing ONE LinguaVerse lesson fully autonomously: LANG=$lang, ID=$id.
Nobody is watching: never ask questions, never wait for confirmation.

1. git pull --rebase   (if git reports index.lock or a conflict, wait 10 s and retry)
2. git config core.hooksPath .githooks
3. Read AGENTS.md and content/YOZUVCHI-YORIQNOMA.md fully.
4. node scripts/lesson-brief.mjs $lang $id
   Read the previous $lang lesson and one english lesson of the same level for depth and style.
5. If content/uz/$lang/$id.json already exists, it is an unfinished earlier attempt:
   run lesson-check on it and fix it (rewrite it fully if the encoding is broken).
   Otherwise write content/uz/$lang/$id.json in ONE go with your file-write tool, as UTF-8.
   NEVER write JSON with PowerShell Out-File, Set-Content, echo or >.
6. Self-review, fix anything wrong:
   - every $lang example, translation, ending, tone and grammar claim is correct
   - say_native is natural spoken Uzbek in Latin script; o‘ and g‘ use the ‘ character
   - it teaches what the brief says and continues the previous lesson
   - 10 quiz questions (15 in exam lessons), each with exactly one correct answer
7. node scripts/lesson-check.mjs content/uz/$lang/$id.json
   Fix until it prints ✅. ⚠️ is NOT acceptable (add or trim scenes).
8. git add content/uz/$lang/$id.json
   git commit -m "${lang}: $id"
   If the commit is BLOCKED, fix exactly what it says, git add, commit again.
   git push   (if rejected: git pull --rebase, then git push again)
9. Stop. Do not start another lesson; do not touch any other file. Never use --no-verify.
"@
}

function Run-Lang($lang) {
  $deadline = [datetime]::ParseExact($Until, 'HH:mm', $null)
  if ($deadline -le (Get-Date)) { $deadline = $deadline.AddDays(1) }
  $flag = Get-ModelFlag
  if (-not $flag) { Log $lang "XATO: 'opencode run --help' da model tanlash flagi topilmadi. Skript ishlay olmaydi."; return }
  $blocked = @{}   # model -> qachongacha ishlatilmaydi
  $fails = @{}
  Log $lang "boshlandi, $($deadline.ToString('HH:mm')) gacha ishlaydi"
  while ((Get-Date) -lt $deadline) {
    $id = Get-NextId $lang
    if (-not $id) { Log $lang "TIL TUGADI: 150/150"; return }
    $models = @(Get-FreeModels | Where-Object { -not $blocked.ContainsKey($_) -or $blocked[$_] -lt (Get-Date) })
    if ($models.Count -eq 0) { Log $lang "hamma bepul modellar limitda — 15 daqiqa kutaman"; Start-Sleep -Seconds 900; continue }
    $model = $models[0]
    $taskFile = Join-Path $Dir "task-$lang.md"
    Set-Content -Path $taskFile -Value (Task-Text $lang $id) -Encoding UTF8
    $out = Join-Path $Dir "out-$lang.txt"; $err = Join-Path $Dir "err-$lang.txt"
    Log $lang "$id  ←  $model"
    $msg = "Read the file .overnight/task-$lang.md and do exactly what it says."
    $exe = (Get-Command opencode).Source
    $argv = @('run', $flag, $model, "`"$msg`"")
    if ($exe -like '*.ps1') { $argv = @('-ExecutionPolicy', 'Bypass', '-File', "`"$exe`"") + $argv; $exe = 'powershell' }
    $p = Start-Process -FilePath $exe -ArgumentList $argv -NoNewWindow -PassThru `
         -RedirectStandardOutput $out -RedirectStandardError $err -WorkingDirectory $Root
    if (-not $p.WaitForExit($RunMinutes * 60 * 1000)) { try { $p.Kill() } catch {}; Log $lang "${id}: $RunMinutes daqiqadan oshdi, to'xtatildi" }
    $text = ((Get-Content $out -Raw -ErrorAction SilentlyContinue) + "`n" + (Get-Content $err -Raw -ErrorAction SilentlyContinue))
    $done = (& git ls-files "content/uz/$lang/$id.json")
    if ($done) {
      Log $lang "$id ✅ GitHub'ga yuklandi"
      $fails[$model] = 0
    } elseif ($text -match $LimitRx) {
      $blocked[$model] = (Get-Date).AddMinutes(60)
      Log $lang "$model limitda yoki xato ($($Matches[0])) — 1 soatga chetga, keyingi modelga o'taman"
    } else {
      $fails[$model] = 1 + [int]$fails[$model]
      Log $lang "$id hali tayyor emas ($model, urinish $($fails[$model]))"
      if ($fails[$model] -ge 2) { $blocked[$model] = (Get-Date).AddMinutes(90); $fails[$model] = 0; Log $lang "$model 2 marta natija bermadi — keyingi modelga o'taman" }
    }
  }
  Log $lang "vaqt tugadi ($Until)"
}

if ($Test) {
  Write-Host "Papka: $Root"
  Write-Host "opencode: $((Get-Command opencode -ErrorAction SilentlyContinue).Source)"
  Write-Host "git: $((Get-Command git -ErrorAction SilentlyContinue).Source)   node: $((Get-Command node -ErrorAction SilentlyContinue).Source)"
  Write-Host "model flagi: $(Get-ModelFlag)"
  Write-Host "hook: $(& git config core.hooksPath)"
  $m = Get-FreeModels
  Write-Host "bepul modellar (tartib bo'yicha, $($m.Count) ta):"; $m | ForEach-Object { Write-Host "   $_" }
  foreach ($l in $AllLangs) { Write-Host ("{0,-8} keyingi dars: {1}" -f $l, (Get-NextId $l)) }
  if (-not (Get-ModelFlag) -or $m.Count -eq 0) { Write-Host "`n❌ SKRIPT ISHLAMAYDI — bu oynaning rasmini Claude'ga yuboring." -ForegroundColor Red }
  else { Write-Host "`n✅ Hammasi tayyor. TUN-ISHGA-TUSHIR.bat ni ishga tushirsangiz bo'ladi." -ForegroundColor Green }
  return
}

& git config core.hooksPath .githooks
if ($Lang) { Run-Lang $Lang; return }
foreach ($l in $AllLangs) {
  Start-Process powershell -ArgumentList @('-NoExit', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"", '-Lang', $l, '-Until', $Until)
  Start-Sleep -Seconds 20   # git bir vaqtda to'qnashmasin
}
Write-Host "7 ta oyna ochildi. Jurnal: .overnight\log-<til>.txt"
