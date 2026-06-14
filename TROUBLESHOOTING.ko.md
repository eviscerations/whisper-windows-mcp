# whisper-windows-mcp — 문제 해결

---

## 빠른 체크리스트

더 자세히 살펴보기 전에 다음을 모두 확인하세요:

- `claude_desktop_config.json`의 경로에 **백슬래시 두 개** 사용 (`C:\\whisper\\...`)
- `WHISPER_CLI_PATH`에 지정된 경로에 `whisper-cli.exe`가 존재
- `WHISPER_MODEL`에 지정된 경로에 모델 `.bin` 파일이 존재
- FFmpeg가 설치되어 접근 가능 (명령 프롬프트에서 `ffmpeg -version` 작동)
- 설정 편집 후 Claude Desktop을 **완전히 재시작** (창만 닫지 말고 시스템 트레이에서 종료)
- 설정 → 개발자에서 whisper 서버가 **실행 중** (초록색 배지)으로 표시

---

## "whisper에 연결되지 않음" 또는 도구를 사용할 수 없음

**가장 흔한 원인:** 설정 편집 후 Claude Desktop을 완전히 재시작하지 않은 경우.

1. 시스템 트레이의 Claude 아이콘 우클릭 → 종료
2. Claude Desktop 재실행
3. 설정 → 개발자로 이동하여 whisper 옆의 초록색 **실행 중** 배지 확인

여전히 표시되지 않는 경우:

1. `claude_desktop_config.json`에서 JSON 구문 오류 확인 (쉼표 누락, 중괄호 불일치 등)
2. 모든 경로에 백슬래시가 두 개 사용되었는지 확인
3. Claude Desktop에서 `check_config`를 실행하여 진단 정보 확인

---

## 큰 모델에서 download_model 타임아웃

Claude Desktop은 MCP 도구 호출에 4분의 타임아웃을 설정합니다. 느린 연결에서 대형 모델 다운로드가 이를 초과할 수 있습니다.

**파일 크기:**
- `large-v3` — 2.9 GB
- `large-v3-turbo` — 1.6 GB
- `large-v3-q5_0` — 1.1 GB
- `large-v3-turbo-q5_0` — 547 MB
- `medium.en` — 1.5 GB
- `medium.en-q5_0` — 514 MB

빠른 연결(100 Mbps 이상)에서는 large-v3도 4분 이내에 다운로드됩니다. 느린 연결에서는 브라우저나 PowerShell을 사용하여 직접 다운로드하고 파일을 모델 디렉터리에 수동으로 배치하세요:

```powershell
# 예시 — large-v3-turbo 직접 다운로드
Invoke-WebRequest -Uri "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin" `
  -OutFile "C:\whisper\models\ggml-large-v3-turbo.bin"
```

그 다음 `switch_model ggml-large-v3-turbo.bin`으로 활성화하세요.

---

## `check_config`에서 whisper-cli.exe를 찾지 못함

설정의 경로가 파일이 실제로 있는 위치와 일치하지 않습니다.

파일 존재 확인:
```
dir C:\whisper\Release\whisper-cli.exe
```

다른 위치에 있다면 설정의 `WHISPER_CLI_PATH`를 실제 경로로 업데이트하세요.

---

## `check_config`에서 FFmpeg를 찾지 못함

FFmpeg가 설치되지 않았거나 시스템 PATH에 없습니다.

winget으로 설치:
```
winget install ffmpeg
```

또는 [ffmpeg.org](https://ffmpeg.org/download.html)에서 다운로드하여 압축을 풀고 `bin` 폴더를 시스템 PATH에 추가하세요.

설치 후 새 명령 프롬프트에서 확인:
```
ffmpeg -version
```

FFmpeg를 비표준 위치에 설치한 경우 Claude Desktop 설정에서 `FFMPEG_PATH` 환경 변수를 설정하세요:
```json
"env": {
  "FFMPEG_PATH": "C:\\ffmpeg\\bin\\ffmpeg.exe"
}
```

---

## 전사 출력이 `[FOREIGN]` 태그로 가득 찬 경우

**원인:** 영어 전용 모델(예: `ggml-medium.en.bin`)을 비영어 음성에 사용하고 있습니다. 영어 전용 모델은 다른 언어를 처리할 수 없으며 처리할 수 없는 모든 세그먼트에 `[FOREIGN]`을 출력합니다.

**해결 방법:** `ggml-large-v3.bin` — 다국어 모델을 다운로드하여 사용하세요. 비영어 전사, 자동 언어 감지, 번역에는 이 모델이 필요합니다.

```
https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin
```

`C:\whisper\models\`에 저장하고 설정 업데이트:
```json
"WHISPER_MODEL": "C:\\whisper\\models\\ggml-large-v3.bin"
```

또는 `transcribe_audio`나 `generate_subtitles`의 `model` 파라미터를 사용하여 전사별로 재정의하세요.

> **참고:** 영어 전용 모델(`*.en.bin`)은 영어 콘텐츠에 더 빠르고 정확하지만 다른 언어는 전혀 처리할 수 없습니다. 다국어 콘텐츠를 작업하는 경우 하드웨어에 관계없이 `large-v3`이 올바른 모델입니다.

---

## 전사 결과가 없거나 빈 파일인 경우

**가능한 원인:**

1. **언어에 맞지 않는 모델** — 영어 전용 모델(`*.en.bin`)은 다른 언어를 전사할 수 없습니다. 다국어 콘텐츠에는 `ggml-large-v3.bin`을 사용하세요.

2. **음질이 너무 낮음** — 매우 낮은 비트레이트 파일(예: AMR-NB 코덱을 사용하는 오래된 `.3gp` 휴대폰 녹음, 약 12kbps)은 whisper가 처리하기 어려울 수 있습니다. 잡음이 많은 환경(배경 소음, 울림, 먼 거리 화자)도 어렵습니다. 작은 모델보다 열화된 음성을 더 잘 처리하는 `large-v3`를 시도해 보세요.

3. **파일이 무음이거나 손상된 경우** — 파일에서 `analyze_media`를 실행하여 FFprobe가 유효한 오디오 스트림을 감지하는지 확인하세요.

4. **변환 실패** — 파일이 WAV로 올바르게 변환되지 않을 수 있습니다. 먼저 수동으로 변환해 보세요:
```
ffmpeg -i yourfile.3gp -ar 16000 -ac 1 output.wav
```
그런 다음 WAV를 직접 전사하세요.

---

## "이 파일은 약 X 길이입니다 — 백그라운드에서 실행하세요" / 포그라운드 전사가 타임아웃됨

Claude Desktop은 단일 MCP 도구 호출에 약 4분의 타임아웃을 적용합니다. **포그라운드**(차단) 모드에서 전사되는 긴 파일은 이를 초과할 수 있습니다 — 전사는 여전히 완료되어 디스크에 기록되지만, 도구 호출 자체는 오류가 납니다. 이 조용한 실패를 방지하기 위해 `transcribe_audio`와 `generate_subtitles`는 실행 시간을 미리 추정하고, 한도를 넘을 가능성이 높으면 `background=true`로 다시 실행하라는 메시지를 반환합니다. 백그라운드 모드는 즉시 작업 ID를 반환하며 그러한 제한이 없습니다 — `check_progress`로 모니터링하세요.

전사의 실제 소요 시간 대부분은 전사가 아니라 **모델 로딩**입니다: whisper-cli는 호출할 때마다 모델을 다시 로드하며, 메모리가 제한된 GPU의 대형 모델(예: `large-v3`, 2.9 GB)은 전사가 시작되기 전에 로드하는 데 약 2분이 걸릴 수 있습니다(더 작거나 양자화된 모델은 더 빨리 로드됨). 가드의 임계값은 `WHISPER_FOREGROUND_MAX_SEC`(초, 기본값 210)로 구성 가능합니다.

## 파일명에 특수 문자나 Unicode가 있을 때 백그라운드 작업 실패

**원인:** 경로에 Unicode 문자(한국어, 일본어, 중국어, 이모지, 괄호 등) 또는 특정 특수 문자가 포함되어 있으면 whisper-cli.exe가 출력 파일을 쓸 수 없습니다.

**v2.0.0에서 수정됨.** 현재 버전을 실행 중이라면 이 문제가 발생하지 않아야 합니다. 여전히 발생한다면 `npm install -g whisper-windows-mcp`로 업데이트하고 Claude Desktop을 재시작하세요.

이전 버전을 사용 중인 경우 임시 해결 방법: 전사 전에 파일 이름을 ASCII 문자만 사용하도록 바꾸세요. 필요하다면 이후에 다시 바꾸면 됩니다.

```
ren "한국어_파일명.mp4" "temp_transcribe.mp4"
```

---

## 백그라운드 작업이 "실패"로 표시되고 출력이 없는 경우

**가능한 원인:**

1. **모델 경로 잘못됨** — 분리된 프로세스는 수정된 경로를 상속하지 않습니다. `check_config`를 실행하여 경로를 확인하세요.

2. **프로세스가 종료된 경우** — whisper-cli.exe가 작업 중 수동으로 종료되면 출력 파일이 존재하지 않습니다. 다시 시도하세요.

3. **VRAM 부족** — VRAM이 적은 GPU에서 대형 모델이 조용히 실패할 수 있습니다. 더 작은 모델을 사용해 보세요.

4. **파일 변환 실패** — WAV 파일을 직접 전사하여 문제가 변환에 있는지 전사에 있는지 확인해 보세요.

---

## GPU가 사용되지 않음 (CPU가 50% 이상으로 높게 사용됨)

**원인:** 표준 whisper.cpp 릴리스에 포함된 CPU 전용 바이너리를 사용하고 있습니다.

**해결 방법:** [릴리스 페이지](https://github.com/eviscerations/whisper-windows-mcp/releases/tag/v1.4.0)에서 Vulkan 활성화된 빌드를 다운로드하여 `C:\whisper\Release\`에 압축을 해제하세요.

GPU 가속이 활성화되었는지 확인:
- Claude에게 `check_system` 요청
- 출력에서 `✅ Vulkan binary: ggml-vulkan.dll found` 확인
- 전사 중 작업 관리자 → 성능 → GPU에서 GPU 사용률이 15–30%로 올라가는지 확인

---

## 전사가 잘못된 GPU에서 실행됨 (다중 GPU 시스템)

기본적으로 whisper-cli는 Vulkan 장치 0을 사용합니다. 다중 GPU 머신에서는 원하는 카드가 아닐 수 있습니다. `WHISPER_GPU_DEVICE` 환경 변수(또는 이제 `generate_subtitles`에서도 작동하는 호출별 `gpu_device` 파라미터)로 특정 장치를 고정하세요:

```json
"env": { "WHISPER_GPU_DEVICE": "1" }
```

⚠️ **이 인덱스는 Vulkan 열거 순서이며 Windows의 "GPU 0 / GPU 1" 순서가 아닙니다** — 둘은 종종 다릅니다. 올바른 번호를 찾으려면 아무 파일에서나 `whisper-cli.exe`를 한 번 실행하고 시작 로그를 읽으세요: `ggml_vulkan: 0 = <이름>`, `ggml_vulkan: 1 = <이름>`을 출력합니다. 대상 카드가 표시된 인덱스를 사용하세요. `check_config`는 활성 장치를 표시하므로 고정이 적용되었는지 확인할 수 있습니다.

## `check_system`에서 VRAM 양이 잘못 표시됨

알려진 Windows 제한 사항입니다. `wmic` 명령은 레지스트리에서 VRAM을 읽는데, 많은 AMD 카드에서 실제 VRAM의 절반 값이 표시됩니다. 8GB HBM2를 가진 Vega 56은 일반적으로 4GB로 표시됩니다. 이것은 표시 문제일 뿐입니다 — whisper는 추론 중 실제 물리적 VRAM을 완전히 사용합니다.

---

## "전사가 이미 진행 중" 오류

이전 작업의 `whisper-cli.exe` 프로세스가 실행 중입니다. 완료를 기다리거나:

1. 작업 관리자 → 세부 정보 탭 열기
2. `whisper-cli.exe` 찾기
3. 우클릭 → 작업 끝내기

그 다음 다시 시도하세요.

---

## 자동 언어 감지가 틀린 경우

Whisper의 자동 감지는 음성의 처음 30초에서 실행됩니다. 파일 시작 부분이 대부분의 내용과 다른 언어로 되어 있으면 감지가 틀릴 수 있습니다.

**해결 방법:** 자동 감지에 의존하지 말고 언어를 명시적으로 지정하세요 (예: `language=ko`).

---

## 자막 생성이 전체적으로 "(외국어로 말하는 중)"이 되는 경우

Whisper가 음성을 감지했지만 전사할 수 없습니다. 가장 흔한 원인:

1. **잘못된 모델** — 비영어 음성에 영어 전용 모델 사용 중. `large-v3`를 사용하세요.

2. **음질** — 잡음이 많은 환경(주방, 군중, 울림)은 medium 모델에서 어려울 수 있습니다. `large-v3`를 시도해 보세요.

3. **혼합 언어** — 두 언어가 교대로 사용되는 파일은 단일 언어 설정에서 소수 언어가 자리 표시자로 표시됩니다.

---

## 자막 번역이 영어로만 출력되는 경우

이것은 의도된 동작입니다. Whisper의 내장 `--translate` 플래그는 **영어로만** 번역합니다. 다른 대상 언어로의 번역은 `.srt` 파일 내용을 별도로 처리하세요.

---

## 배치 전사가 진행을 멈춘 경우

`check_batch_progress`를 다시 호출하세요. 여전히 멈춰 있다면:

1. 작업 관리자에서 실행 중인 `whisper-cli.exe` 프로세스 확인
2. `%TEMP%\whisper-mcp-jobs\`에서 작업 로그 확인
3. 실패한 파일은 배치 보고서에 표시됩니다 — `transcribe_audio`로 개별적으로 다시 실행하세요

---

## 임시 작업 디렉터리 정리

whisper-windows-mcp는 전사 중 `%TEMP%\whisper-mcp-jobs\`에 작업 상태 및 로그 파일을 작성합니다. 서버는 시작 시 7일이 지난 파일을 자동으로 정리합니다. 수동으로 정리하려면 배치나 작업이 완료되고 출력 전사본을 확인한 후 이 디렉터리의 모든 것을 안전하게 삭제할 수 있습니다:

```powershell
Remove-Item "$env:TEMP\whisper-mcp-jobs\*" -Recurse -Force
```

다음 전사 시 디렉터리가 자동으로 다시 생성됩니다. 전사 출력 파일은 여기에 영구적으로 저장되지 않습니다 — 완료 시 소스 디렉터리로 이동됩니다. 작업 메타데이터와 로그만 남습니다.

**참고:** 전사가 진행 중인 동안 이 디렉터리를 삭제하지 마세요 — `check_batch_progress`가 작동하려면 배치 상태 파일이 필요합니다.

---

## 명령줄에서 대규모 무인 배치 처리

Claude 없이 밤새 실행하려는 매우 큰 배치의 경우 PowerShell을 사용하세요.

**중요:** whisper-cli.exe는 MP4, MKV 또는 대부분의 동영상 포맷을 직접 읽을 수 없습니다. FFmpeg가 각 파일을 먼저 WAV로 변환해야 합니다. whisper는 또한 전사본을 stdout에, 진단 출력을 stderr에 씁니다 — 전사본을 올바르게 캡처하려면 `Start-Process -RedirectStandardOutput`을 사용하세요. `|`로 파이핑하거나 `2>$null`로 stderr를 억제하면 아무것도 캡처되지 않습니다.

```powershell
$whisper = "C:\whisper\Release\whisper-cli.exe"
$model   = "C:\whisper\models\ggml-medium.en.bin"
$dir     = "C:\path\to\your\folder"
$ffmpeg  = "ffmpeg"
$tmp     = "$env:TEMP\whisper_convert.wav"

Get-ChildItem "$dir\*.mp4" | ForEach-Object {
    $out = ($_.FullName -replace '\.mp4$', '') + ".txt"
    if (Test-Path $out) {
        Write-Host "SKIP (exists): $($_.Name)"
        return
    }
    Write-Host "Converting:    $($_.Name)"
    & $ffmpeg -y -i $_.FullName -ar 16000 -ac 1 -c:a pcm_s16le $tmp 2>$null
    Write-Host "Transcribing:  $($_.Name)"
    $wArgs = "-m `"$model`" -f `"$tmp`" --threads 8 --condition-on-previous-text 0 --no-speech-thold 0.6"
    Start-Process -FilePath $whisper -ArgumentList $wArgs -RedirectStandardOutput $out -Wait -NoNewWindow
    Write-Host "Done:          $($_.BaseName).txt"
}

Remove-Item $tmp -ErrorAction SilentlyContinue
Write-Host "All done."
```

파일 유형에 맞게 `*.mp4`를 `*.mkv`, `*.m4a` 등으로 변경하세요. `Test-Path` 건너뛰기 확인으로 인해 중단 후 스크립트를 재실행해도 이미 완료된 파일은 다시 처리되지 않습니다.

이것은 각 소스 파일 옆에 `.txt` 파일을 씁니다. 나중에 `analyze_media`나 `start_batch`를 실행하면 MCP 도구가 이것들을 이미 전사된 것으로 인식합니다.

---

## 설정 파일 위치

```
C:\Users\사용자명\AppData\Roaming\Claude\claude_desktop_config.json
```

`AppData`가 보이지 않는 경우: 파일 탐색기에서 보기 → 표시 → 숨김 항목을 활성화하세요.

---

## 완전한 작동 설정 예시

```json
{
  "mcpServers": {
    "whisper": {
      "command": "npx",
      "args": ["-y", "whisper-windows-mcp"],
      "env": {
        "WHISPER_CLI_PATH": "C:\\whisper\\Release\\whisper-cli.exe",
        "WHISPER_MODEL": "C:\\whisper\\models\\ggml-medium.en.bin",
        "FFMPEG_PATH": "ffmpeg"
      }
    }
  }
}
```

`FFMPEG_PATH`의 기본값은 `ffmpeg`(PATH에 있다고 가정)입니다. FFmpeg가 비표준 위치에 설치된 경우에만 명시적으로 설정하세요.
