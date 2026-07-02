# whisper-windows-mcp

[![CI](https://github.com/eviscerations/whisper-windows-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/eviscerations/whisper-windows-mcp/actions/workflows/ci.yml)

[![whisper-windows-mcp MCP server](https://glama.ai/mcp/servers/eviscerations/whisper-windows-mcp/badges/card.svg)](https://glama.ai/mcp/servers/eviscerations/whisper-windows-mcp)

Windows 전용 네이티브 MCP(Model Context Protocol) 서버입니다. [whisper.cpp](https://github.com/ggml-org/whisper.cpp)를 사용하여 Claude Desktop에서 음성 및 동영상 파일을 로컬로 전사합니다. GPU 가속, 다국어 지원, 배치 처리를 지원합니다. 모든 전사 처리는 로컬에서 실행 — 음성, 동영상 파일이나 파일 경로가 외부로 전송되는 일은 없습니다.

> **왜 이 패키지가 존재하는가?**
> 인기 있는 `whisper-mcp` 패키지는 macOS용으로 개발되었으며 Unix 환경을 전제로 합니다. Windows에서는 작동하지 않습니다. 이 패키지는 Claude Desktop에서 로컬 AI 전사를 원하는 Windows 사용자를 위해 만들어졌습니다.

---

## 사용 가능한 기능

설치 후 Claude Desktop에서 다음과 같이 말하면 됩니다:

- *"C:\Users\Me\Downloads\meeting.mp3 전사해줘"*
- *"이 폴더의 녹음 파일을 모두 전사해서 각각 텍스트 파일로 저장해줘"*
- *"이 동영상의 한국어와 영어 자막을 생성해줘"*
- *"이 폴더의 배치 전사를 시작해줘"*
- *"이 파일들을 전사하는 데 얼마나 걸려?"*
- *"GPU 가속이 작동 중인지 확인해줘"*
- *"이 파일을 개인 정보 모드로 전사해줘"*

---

## 요구 사항

1. **Node.js 18 이상** — [nodejs.org](https://nodejs.org)
2. **Vulkan GPU 지원 whisper.cpp 바이너리** — 1단계 참고
3. **Whisper 모델 파일** — 2단계 참고
4. **FFmpeg** — 동영상 파일 및 WAV/MP3 이외의 음성 포맷에 필요

---

## 1단계 — whisper.cpp 바이너리 설치

### 옵션 A — 사전 빌드된 Vulkan 릴리스 (권장)

[릴리스 페이지](https://github.com/eviscerations/whisper-windows-mcp/releases/tag/v1.4.0)에서 `whisper-vulkan-win-x64.zip`을 다운로드하세요.

이것은 **Vulkan GPU 가속**이 활성화된 커스텀 빌드입니다. AMD, NVIDIA, Intel GPU에서 작동합니다 — 벤더별 SDK가 필요하지 않습니다.

`C:\whisper\Release\`에 압축을 해제하세요. 다음 파일들이 있어야 합니다:

```
C:\whisper\Release\whisper-cli.exe
C:\whisper\Release\ggml-vulkan.dll
C:\whisper\Release\ggml.dll
C:\whisper\Release\ggml-base.dll
C:\whisper\Release\ggml-cpu.dll
C:\whisper\Release\whisper.dll
```

GPU 가속은 자동으로 활성화됩니다 — 추가 설정이 필요하지 않습니다.

### 옵션 B — 소스에서 빌드

필요 사항: Git, CMake, Visual Studio Build Tools 2022+("C++를 사용한 데스크톱 개발"), [lunarg.com](https://vulkan.lunarg.com/sdk/home#windows)의 Vulkan SDK.

```
git clone https://github.com/ggml-org/whisper.cpp
cd whisper.cpp
cmake -B build -DGGML_VULKAN=ON -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release --target whisper-cli
```

`build\bin\Release\`의 바이너리를 `C:\whisper\Release\`에 복사하세요.

> **참고:** GitHub의 공식 whisper.cpp Windows 릴리스에는 Vulkan 빌드가 포함되어 있지 않습니다. 위의 사전 빌드된 릴리스를 사용하거나 `-DGGML_VULKAN=ON`으로 소스에서 직접 컴파일해야 합니다.

---

## 2단계 — Whisper 모델 다운로드

| 모델 | 크기 | 속도 | 정확도 | 최적 용도 |
|---|---|---|---|---|
| `ggml-tiny.en.bin` | 75 MB | 매우 빠름 | 기본 | 빠른 테스트 |
| `ggml-base.en.bin` | 142 MB | 빠름 | 양호 | 일상적인 영어 |
| `ggml-small.en.bin` | 466 MB | 보통 | 더 좋음 | 중요한 녹음 |
| `ggml-medium.en.bin` | 1.5 GB | GPU에서 빠름 | 매우 좋음 | 최고 품질 영어 |
| `ggml-large-v3-turbo.bin` | 1.6 GB | GPU에서 빠름 | 우수 | **영어 GPU 배치 작업 권장 — large-v3보다 약 6배 빠르며 정확도 손실 최소** |
| `ggml-large-v3.bin` | 2.9 GB | GPU에서 빠름 | 우수 | 다국어, 최고 정확도 |
| `ggml-medium.en-q5_0.bin` | 514 MB | 빠름 | 매우 좋음 | **CPU 전용 영어 최선 선택 — 낮은 메모리로 높은 정확도** |
| `ggml-large-v3-turbo-q5_0.bin` | 547 MB | 빠름 | 우수 | **CPU 전용 다국어 최선 선택** |
| `ggml-large-v3-q5_0.bin` | 1.1 GB | CPU에서 보통 | 우수 | 다국어, CPU 친화적 |

Claude Desktop에서 `download_model`을 사용하여 직접 설치할 수 있습니다. **영어 전용** 사용: `large-v3-turbo`(GPU) 또는 `medium.en-q5_0`(CPU)을 권장합니다. **다국어** 사용: `large-v3-turbo` 또는 `large-v3-turbo-q5_0`(CPU)이 필요합니다. 영어 전용 모델(`*.en.bin`)은 비영어 음성에 `[FOREIGN]`을 출력하며 다른 언어에는 사용할 수 없습니다.

---

## 3단계 — FFmpeg 설치

FFmpeg는 동영상 파일 및 네이티브가 아닌 음성 포맷에 필요합니다.

winget으로 설치:
```
winget install ffmpeg
```

또는 [ffmpeg.org](https://ffmpeg.org/download.html)에서 다운로드하여 PATH에 추가하세요.

확인:
```
ffmpeg -version
```

---

## 4단계 — MCP 서버 설치

```
npm install -g whisper-windows-mcp
```

---

## 5단계 — Claude Desktop 설정

Claude Desktop → 설정 → 개발자 → 설정 편집.

`whisper` 항목을 추가하세요:

```json
{
  "mcpServers": {
    "whisper": {
      "command": "npx",
      "args": ["-y", "whisper-windows-mcp"],
      "env": {
        "WHISPER_CLI_PATH": "C:\\whisper\\Release\\whisper-cli.exe",
        "WHISPER_MODEL": "C:\\whisper\\models\\ggml-medium.en.bin"
      }
    }
  }
}
```

설정 파일 위치: `C:\Users\사용자명\AppData\Roaming\Claude\claude_desktop_config.json`

> 모든 경로에 **백슬래시를 두 개** 사용하세요.

저장 후 Claude Desktop을 **완전히 재시작**하세요. 설정 → 개발자에서 **whisper**가 초록색 실행 중 배지로 표시되어야 합니다.

---

## 6단계 — 설정 확인

Claude Desktop에서 다음을 물어보세요:

> *"whisper 설정 확인해줘"*

그 다음:

> *"시스템 하드웨어 확인해줘"*

GPU가 감지되고 Vulkan 가속이 활성화되었는지 확인합니다.

---

## 사용 가능한 도구

### `transcribe_audio`
단일 파일을 전사합니다. 긴 파일에는 블로킹(기본값) 또는 백그라운드 모드를 지원합니다.

| 파라미터 | 설명 |
|---|---|
| `file_path` | 파일의 절대 경로 (필수) |
| `language` | 언어 코드(`en`, `ko`, `ja` 등) 또는 자동 감지를 위한 `auto`. 기본값: `en` |
| `output_format` | `timestamps`(기본값), `text`, `json`, `srt`, `vtt`, `lrc`, `csv` |
| `save_to_file` | 소스 파일 옆에 .txt로 저장 |
| `background` | 분리된 작업으로 실행 — 즉시 작업 ID 반환. `check_progress`로 모니터링. 10분 이상의 파일에 권장. |
| `privacy_mode` | 이 호출에 대해 개인 정보 모드를 재정의합니다. `true` = 메타데이터만, 전사 텍스트 미전송. `false` = `WHISPER_PRIVACY_MODE=true`가 전역으로 설정되어도 텍스트 반환. 전역 설정을 사용하려면 생략. |
| `threads` | CPU 스레드 수 재정의 |
| `temperature` | 샘플링 온도 0.0–1.0. 기본값 0.0(결정적). |
| `prompt` | 사전 컨텍스트 문자열 — 도메인별 어휘나 화자 이름의 정확도를 향상시킵니다. 예: `"이름: Keemstar, DramaAlert."` |
| `condition_on_prev_text` | 세그먼트 간 컨텍스트 조건화 재활성화. 기본값 false. |
| `beam_size` | 빔 탐색 너비. 높을수록 정확도 향상, 속도 저하. 기본값 5. |
| `best_of` | 평가할 후보 시퀀스 수. 기본값 5. |
| `gpu_device` | 멀티 GPU 시스템의 GPU 장치 인덱스. 기본값 0. |
| `processors` | 병렬 프로세서 수. 기본값 1. |
| `word_timestamps` | 타임스탬프가 있는 단어별 세그먼트. 클립 정렬에 유용. |
| `max_segment_length` | 세그먼트 최대 문자 수. |
| `diarize` | 스테레오 화자 분리 — 별도 채널에 화자가 녹음된 스테레오 음성 필요. |
| `tinydiarize` | 모노 화자 전환 감지 — 단일 채널 음성에서 화자가 바뀌는 지점에 `[SPEAKER_TURN]`을 표시합니다. tdrz 모델이 필요합니다: `download_model small.en-tdrz`를 실행한 뒤 `switch_model ggml-small.en-tdrz.bin`. |
| `vad_model` | Silero VAD 모델 .bin 경로. 전사 전 무음 제거 — 잡음이 많은 파일의 환각 감소. |
| `offset_t` | 시작 오프셋(밀리초). |
| `duration` | 오프셋부터 처리할 시간(밀리초). |

---

### `check_progress`
`transcribe_audio`(background=true)로 시작한 백그라운드 전사 작업을 모니터링합니다.

경과 시간, 마지막으로 처리된 타임스탬프, 완료 시 전체 전사본을 반환합니다.

| 파라미터 | 설명 |
|---|---|
| `job_id` | `transcribe_audio`가 반환한 작업 ID |
| `privacy_mode` | 이 호출에 대해 개인 정보 모드를 재정의합니다. |

---

### `start_batch`
폴더 내 미전사 파일을 모두 자동으로 순차 배치 전사합니다. 시간순(짧은 것부터)으로 정렬하고 백그라운드 작업으로 하나씩 처리하며 각 출력을 검증합니다.

| 파라미터 | 설명 |
|---|---|
| `folder_path` | 폴더 경로 (필수) |
| `language` | 언어 코드. 기본값: `en` |
| `output_format` | `timestamps`(기본값), `text`, `srt`, `vtt`, `lrc`, `csv` |
| `privacy_mode` | 이 배치에 대해 개인 정보 모드를 재정의합니다. |
| `threads` | CPU 스레드 수 재정의 |

---

### `check_batch_progress`
실행 중인 배치를 모니터링합니다. 현재 파일이 완료되면 자동으로 다음 파일로 진행합니다. 전체 진행 상황, 타임스탬프가 있는 현재 파일, ETA, 실패한 파일을 반환합니다.

| 파라미터 | 설명 |
|---|---|
| `batch_id` | `start_batch`가 반환한 배치 ID |

---

### `transcribe_batch` (대화형)
미리보기와 확인을 하면서 파일을 하나씩 처리합니다. 진행하면서 검토하고 싶을 때 유용합니다.

| 파라미터 | 설명 |
|---|---|
| `folder_path` | 폴더 경로 (필수) |
| `file_index` | 처리할 파일 (1부터 시작). 생략하면 파일 목록 표시. |
| `language` | 언어 코드. 기본값: `en` |
| `recursive` | 하위 폴더 포함 |

---

### `generate_subtitles`
자막 파일을 생성합니다. 자동 언어 감지 및 영어 번역 출력을 지원합니다.

| 파라미터 | 설명 |
|---|---|
| `file_path` | 파일 경로 (필수) |
| `language` | 언어 코드 또는 자동 감지를 위한 `auto`. 기본값: `en` |
| `output_format` | `srt`(기본값) 또는 `vtt` |
| `translate_to_english` | 영어 번역 자막 파일도 생성. 소스가 영어가 아닌 경우에만 적용. |
| `background` | 분리된 백그라운드 작업으로 실행. `check_progress`용 작업 ID를 반환. |
| `threads` | CPU 스레드 수 재정의 |

두 가지를 모두 요청하면 소스 파일 옆에 두 개의 파일이 저장됩니다:
- `파일명.ko.srt` — 원본 언어
- `파일명.en.srt` — 영어 번역

> Whisper의 내장 번역은 **영어로만** 번역합니다. 다른 대상 언어로의 번역은 자막 파일 내용을 별도로 처리하세요.

---

### `analyze_media`
전사 전에 파일을 분석합니다. 재생 시간, 크기, 코덱, CPU 및 GPU 예상 전사 시간을 반환합니다. 폴더의 경우 전사 상태가 포함된 정렬 가능한 파일 목록을 표시합니다.

| 파라미터 | 설명 |
|---|---|
| `path` | 단일 파일 또는 폴더 경로 (필수) |
| `sort_by` | 폴더의 경우: `duration`(기본값), `name`, `size` |

---

### `check_config`
whisper-cli.exe, 모델 파일, FFmpeg가 모두 접근 가능한지 확인합니다. 문제가 생기면 먼저 이것을 실행하세요.

---

### `list_models`
모델 디렉터리에 설치된 Whisper 모델 파일을 나열합니다. 파일명, 크기, 현재 활성 여부, 양자화 상태, 권장 용도를 표시합니다. 네트워크 요청 없음 — 로컬 파일시스템만 읽습니다.

---

### `download_model`
Hugging Face에서 모델 파일을 모델 디렉터리로 직접 다운로드합니다. 신뢰할 수 있는 Hugging Face 네임스페이스에서만 다운로드합니다. 다운로드 후 `switch_model`을 사용하여 활성화하세요.

| 파라미터 | 설명 |
|---|---|
| `model_name` | 다운로드할 모델 이름, 예: `large-v3-turbo`, `large-v3-turbo-q5_0`, `medium.en-q5_0` |

---

### `switch_model`
Claude Desktop을 재시작하지 않고 현재 세션의 활성 Whisper 모델을 전환합니다. 변경은 세션 범위 — 재시작 후에는 유지되지 않습니다. 영구적으로 변경하려면 설정의 `WHISPER_MODEL`을 업데이트하세요.

| 파라미터 | 설명 |
|---|---|
| `model_name` | 모델 파일명(예: `ggml-large-v3-turbo.bin`) 또는 전체 경로. 설정된 모델 디렉터리 내의 `.bin` 파일이어야 합니다. |

---

### `check_system`
GPU 하드웨어를 감지하고 Vulkan 가속 사용 가능 여부를 확인합니다. GPU 이름, VRAM, `ggml-vulkan.dll` 존재 여부를 보고하고 하드웨어에 맞는 최선의 모델 크기를 권장합니다.

---

### `whisper_server`
**영구 모델 서버**(whisper.cpp의 `whisper-server`)를 시작, 중지 또는 확인합니다. 실행 중에는 활성 모델이 VRAM에 상주하며 모든 `transcribe_audio` / `transcribe_batch` 호출이 localhost를 통해 처리됩니다 — **파일별 모델 재로드 없이** — 일회성 모델 로드 비용이 지배적인 짧은 파일을 많이 전사할 때 큰 속도 향상을 제공합니다.

| 파라미터 | 설명 |
|---|---|
| `action` | `start` — 활성 모델을 상주시켜 실행; `stop` — 종료하고 VRAM 해제; `status` — 실행 상태, 상주 모델, 포트, 가동 시간 보고. |

- ⚠️ **상주 모델은 서버의 전체 수명 동안 GPU VRAM을 점유합니다.** 의도적으로 시작하고, 작업을 수행한 뒤, `stop`으로 카드를 공유하는 다른 애플리케이션에 GPU를 반환하세요. 중지는 완전한 종료를 수행하므로 VRAM이 실제로 해제됩니다.
- 서버가 실행 중일 때 `switch_model`은 상주 모델을 그 자리에서 핫스왑합니다(재시작 없음).
- `127.0.0.1`에만 바인딩됩니다 — 네트워크에 노출되지 않습니다.
- 서버가 실행 중인 동안, 일회성 CLI가 필요한 작업 — 백그라운드 작업, `start_batch`, `generate_subtitles`, `lrc`/`csv` 출력, 그리고 HTTP API가 준수하지 않는 고급 호출별 옵션(`beam_size`, `best_of`, `word_timestamps`, `diarize`, `tinydiarize`, `vad_model`, `offset_t`, `duration`) — 은 조용히 무시되는 대신 "먼저 서버를 중지하세요" 메시지와 함께 **거부**되므로, 두 번째 엔진이 GPU를 두고 경합하는 일이 절대 없습니다.
- `whisper-server.exe`가 필요합니다(`whisper-cli.exe`와 함께 제공됨). 필요한 경우 `WHISPER_SERVER_PATH` / `WHISPER_SERVER_PORT`로 설정하세요.

---

## 지원 포맷

| 유형 | 포맷 |
|---|---|
| 네이티브 (변환 불필요) | `mp3`, `wav` |
| 동영상 (FFmpeg로 자동 변환) | `mp4`, `mkv`, `avi`, `mov`, `webm`, `flv`, `wmv`, `m4v`, `ts`, `3gp` |
| 음성 (FFmpeg로 자동 변환) | `m4a`, `ogg`, `flac` |

---

## GPU 가속

사전 빌드된 Vulkan 릴리스는 GPU 가속을 자동으로 활성화합니다. AMD Radeon RX Vega 56(GCN 5세대)에서 테스트되었습니다. Vulkan 1.0+ 지원 GPU라면 NVIDIA 및 Intel Arc를 포함하여 모두 작동해야 합니다.

**성능 비교 (large-v3 모델, 약 14분 음성 파일):**

| 하드웨어 | 시간 |
|---|---|
| CPU만 사용 (Ryzen 7 2700x, 8 스레드) | ~22분 (추정) |
| GPU (Vega 56 via Vulkan) | ~3분 22초 |

전사 중 GPU 사용률은 일반적으로 15–20%이며, 파일 사이에는 유휴 상태로 돌아갑니다.

Windows 10 및 Windows 11을 지원합니다. Windows 11 전용 설정은 필요하지 않습니다 — 이 도구는 Win32 API를 직접 호출하지 않으며 두 운영 체제 모두에서 실행됩니다.

---

## 다국어 지원

Whisper는 음성 언어를 자동으로 감지하고 해당 언어로 전사할 수 있습니다. 내장 번역 모델은 **영어로만** 번역합니다.

최상의 다국어 정확도를 위해 `large-v3` 모델을 사용하세요. 영어 전용 모델(`*.en.bin`)은 다른 언어를 감지하거나 전사할 수 없습니다.

**예시 — 자막이 있는 외국어 동영상:**
1. `language=auto`와 `translate_to_english=true`로 자막 생성 요청
2. Whisper가 언어를 감지하고 원본 언어 SRT 또는 VTT 생성
3. 두 번째 패스에서 영어 번역 생성
4. VLC에서 자막 → 자막 파일 추가로 SRT 파일을 로드하거나 웹 플레이어에서 VTT를 사용

---

## 개인 정보 및 컴플라이언스

whisper-windows-mcp에는 민감하고 규제 대상인 콘텐츠를 위한 내장 개인 정보 아키텍처가 포함되어 있습니다.

**음성 및 동영상은 절대 머신을 떠나지 않습니다.** 이 보장은 무조건적입니다.

**전사 텍스트**는 다릅니다 — 도구 응답에 인라인으로 반환될 때 Claude의 API에서 처리됩니다. 대부분의 사용자에게는 예상된 동작입니다. 규제 대상 콘텐츠(의료, 법률, 재정, 기업)의 경우 개인 정보 모드가 이를 방지합니다.

**개인 정보 모드**는 모든 도구 응답을 메타데이터만(파일명, 단어 수, 저장 경로)으로 제한합니다. 어떤 상황에서도 전사 텍스트가 Claude의 API에 전송되지 않습니다. 전사 도구에서 `privacy_mode=true`로 호출별로 활성화하거나 설정에서 `WHISPER_PRIVACY_MODE=true`로 전역으로 활성화하세요.

**동의 게이트** — 기본 모드에서 세션당 첫 사용 시 전사 텍스트가 반환되기 전에 전체 개인 정보 공개가 표시됩니다. 진행하기 전에 명시적으로 확인해야 합니다. 민감하지 않은 콘텐츠에 대해 이를 건너뛰려면 설정에서 `WHISPER_CONSENT_ACKNOWLEDGED=true`를 설정하세요.

전체 컴플라이언스 안내(HIPAA, GDPR, 변호사-의뢰인 특권, FERPA, SOX, PCI-DSS)는 [PRIVACY.md](PRIVACY.md)를 참고하세요.

---

## 무료 플랜 사용자를 위한 설계

이 도구는 Claude API 상호작용을 최소화하도록 설계되었습니다. 스캔, 분석, 큐 관리, 실행, 검증 등 전체 전사 워크플로우가 가능한 적은 수의 Claude 상호작용으로 완료되도록 설계되었습니다. 모든 무거운 처리는 로컬 머신에서 실행됩니다.

---

## 선택적 환경 변수

| 변수 | 설명 |
|---|---|
| `WHISPER_CLI_PATH` | whisper-cli.exe 경로 (필수) |
| `WHISPER_MODEL` | 모델 .bin 파일 경로 (필수) |
| `WHISPER_THREADS` | CPU 스레드 수 재정의 |
| `WHISPER_GPU_DEVICE` | 다중 GPU 시스템에서 전사를 고정할 Vulkan 장치 인덱스(Windows GPU 순서가 아닌 Vulkan 열거 인덱스 — whisper-cli 시작 로그를 확인하세요). 호출별 `gpu_device`로 재정의 가능합니다. [TROUBLESHOOTING.md](TROUBLESHOOTING.md) 참고. |
| `WHISPER_FOREGROUND_MAX_SEC` | 포그라운드 전사 한도(초, 기본값 210). 더 오래 실행될 것으로 추정되는 파일은 Claude Desktop의 약 4분 도구 타임아웃 위험을 감수하는 대신 백그라운드 모드로 라우팅됩니다. |
| `FFMPEG_PATH` | ffmpeg가 시스템 PATH에 없을 경우 경로 |
| `WHISPER_SERVER_PATH` | 영구 모델 서버용 `whisper-server.exe` 경로 (기본값: `whisper-cli.exe`와 동일 위치). `whisper_server` 도구 참고. |
| `WHISPER_SERVER_PORT` | 영구 모델 서버의 localhost 포트 (기본값 8571). 항상 `127.0.0.1`에 바인딩됩니다. |
| `WHISPER_PRIVACY_MODE` | `true`로 설정하면 모든 도구 응답에서 전사 텍스트 없이 메타데이터만 반환됩니다. 규제 대상 또는 기밀 콘텐츠에 사용합니다. 호출별 `privacy_mode` 파라미터로 재정의 가능합니다. [PRIVACY.md](PRIVACY.md) 참고. |
| `WHISPER_CONSENT_ACKNOWLEDGED` | `true`로 설정하면 전사 텍스트 반환 전 표시되는 일회성 세션 동의 공개를 건너뜁니다. 개인 정보 경계를 이해하고 더 이상 알림이 필요하지 않을 때 설정하세요. 개인 정보 모드가 활성화된 경우 효과 없음. |

---

## 보안

**바이너리 검증.** 사전 빌드된 릴리스의 whisper-cli.exe 바이너리 무결성을 확인하려면 PowerShell에서 SHA256 해시를 확인하세요:

```powershell
Get-FileHash "C:\whisper\Release\whisper-cli.exe" -Algorithm SHA256
```

예상 해시는 [릴리스 페이지](https://github.com/eviscerations/whisper-windows-mcp/releases/tag/v1.4.0)에 문서화되어 있습니다.

**입력 검증.** 모든 파일 및 폴더 경로는 경로를 받는 모든 도구에서 사용 전에 검증됩니다 — UNC 경로(`\\server\share`) 및 디렉터리 탐색 시퀀스(`..`)는 거부됩니다. 10 GB를 초과하는 파일은 리소스 고갈을 방지하기 위해 거부됩니다. `job_id`와 `batch_id`는 파일 경로를 구성하는 데 사용되기 전에 서버가 발급한 정확한 형식과 대조되어, 조작된 ID가 작업 디렉터리 밖으로 탈출할 수 없습니다.

**전사 인젝션 인식.** 음성 파일에는 전사 시 지시처럼 보이는 발화 내용이 포함될 수 있습니다. Claude의 내장 방어 기능이 이를 처리하지만, MCP 서버 자체도 전사 내용을 데이터로만 처리하며 지시로 해석하지 않는다는 점을 알아두는 것이 좋습니다. 전사된 내용이 Claude가 다음에 호출할 도구에 여전히 영향을 줄 수 있으므로, 경로/ID 검증은 단일 사용자 가정에만 의존하지 않고 방어적으로 적용됩니다.

**모델 다운로드는 제한됩니다.** `download_model` 도구는 두 개의 신뢰할 수 있는 Hugging Face 네임스페이스(`ggerganov/whisper.cpp` 및 `ggml-org`)에서만 다운로드합니다. 임의의 URL은 거부됩니다. 리다이렉트는 따르기 전에 허용 목록에 대해 검증됩니다. (다운로드는 아직 모델별 SHA256 다이제스트로 검증되지 않습니다 — SECURITY.md 참고.)

**모델 선택은 샌드박스화됩니다.** `switch_model`과 `transcribe_audio`의 `model` 재정의는 모두 설정된 모델 디렉터리 내의 `.bin` 파일만 허용합니다. 해당 디렉터리 외부의 경로는 정규화된 경로 격리를 통해 거부됩니다.

**PATH 섀도잉 없음.** 서버가 사용자를 대신하여 호출하는 시스템 바이너리(`tasklist`, `wmic`)는 절대 `System32` 경로로 호출되므로 `PATH`상 앞에 위치한 동일 이름의 실행 파일로 섀도잉될 수 없습니다.

전체 보안 정책은 [SECURITY.md](SECURITY.md)를 참고하세요.

---

## 문제 해결

자세한 해결 방법은 [TROUBLESHOOTING.md](TROUBLESHOOTING.md)를 참고하세요. 규제 대상 콘텐츠를 처리하는 경우 [PRIVACY.md](PRIVACY.md)도 참고하세요.

빠른 체크리스트:
- 설정의 경로에 **백슬래시 두 개** 사용 (`C:\\whisper\\...`)
- `whisper-cli.exe`가 설정된 경로에 존재
- 모델 `.bin` 파일이 설정된 경로에 존재
- FFmpeg가 설치되어 PATH에 있음 (`ffmpeg -version` 작동)
- 설정 편집 후 Claude Desktop 완전히 재시작
- 설정 → 개발자에서 whisper가 **실행 중** (초록색 배지)으로 표시

---

## 라이선스

**비상업적 사용:** MIT — 개인, 교육, 비상업적 목적의 사용은 무료입니다. [LICENSE](LICENSE)를 참조하세요.

**상업적 사용:** 비즈니스, 전문적 또는 수익 창출 목적의 사용에는 별도의 상업용 라이선스가 필요합니다. 조건 및 연락처는 [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md)를 참조하세요.

## 기여

풀 리퀘스트 환영합니다. 계획된 기능은 [ROADMAP.md](ROADMAP.md)를 확인하세요.

위에 나열되지 않은 하드웨어에서 GPU 가속을 테스트한 경우, GPU 모델, VRAM, 모델 크기, 관찰된 처리량을 이슈로 보고해 주세요.
