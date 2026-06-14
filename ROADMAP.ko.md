# whisper-windows-mcp — 로드맵

현재 버전: **v2.4.0**

---

## 설계 원칙

이 원칙들은 이 프로젝트의 모든 결정을 지배하며 기능 추가 속도보다 우선합니다.

**Claude API 사용 최소화.** 스캔, 분석, 큐 관리, 실행, 검증, 모델 전환을 포함한 전체 전사 워크플로우가 가능한 적은 수의 Claude 상호작용으로 실행되어야 합니다. 이 도구는 Pro 또는 Max 구독을 사용하지 않는 무료 플랜 Claude 사용자에게도 완전히 기능해야 합니다. 모든 도구 호출은 사용 예산을 소모합니다. 이 원칙을 염두에 두고 설계하세요.

**항상 하나의 whisper 인스턴스.** 하나가 실행 중일 때 두 번째 whisper-cli.exe 프로세스를 절대 생성하지 마세요. 프로세스 잠금은 필수이며 예외가 없습니다.

**로컬 우선, 기본값으로 개인 정보 보호.** 음성은 절대 머신을 떠나지 않습니다. 핵심 기능에 클라우드 API가 필요하지 않습니다. 선택적 통합(예: Hugging Face 모델 다운로드)은 선택 사항임이 명확하게 문서화되어야 합니다.

**명시적 사용자 제어.** 조용한 대량 작업 없음. 파괴적이거나 되돌릴 수 없는 작업은 확인이 필요합니다. 사용자는 항상 일어날 일을 미리 알아야 합니다.

**Unicode 안전 경로.** 모든 파일 I/O는 한국어, 일본어, 중국어, 이모지, 괄호 및 기타 특수 문자를 포함한 비ASCII 파일명을 올바르게 처리해야 합니다.

**모듈식 및 조합 가능.** 도구는 독립적입니다. 사용자는 필요한 것만 사용합니다. 불가피한 경우를 제외하고 어떤 기능도 다른 기능을 필요로 해서는 안 됩니다.

**기능 추가보다 최적화 우선.** 기능 추가와 시스템 부하 또는 API 호출 수 감소 사이에서 망설일 때는 부하를 줄이세요. 대규모 최적화 작업은 비용이 많이 듭니다. 처음부터 올바른 아키텍처를 설계하세요.

---

## 완료됨

### ✅ v1.3.1 — 프로세스 잠금
전사 생성 전 `tasklist /FI`를 사용한 `isWhisperRunning()` 확인 추가. 경쟁 프로세스를 생성하는 대신 작업 관리자 지침과 함께 명확한 오류를 반환합니다.

### ✅ v1.4.0 — Vulkan GPU 가속
VS Build Tools 2022와 Vulkan SDK를 사용하여 `-DGGML_VULKAN=ON`으로 whisper.cpp를 소스에서 컴파일. 사전 빌드된 Vulkan 바이너리를 `whisper-vulkan-win-x64.zip`으로 배포.

**AMD Radeon RX Vega 56의 결과:** 평균 GPU 사용률 약 16%. 58분짜리 파일이 GPU에서 약 4.5분 완료 (CPU 전용 약 88분 대비).

### ✅ v1.5.0 — 시스템 진단
`check_system` 도구: `wmic`을 통한 GPU 감지, Vulkan DLL 확인, VRAM 보고, 모델 크기 권장.

### ✅ v1.6.0 — 파일 사전 분석
FFprobe를 사용한 `analyze_media` 도구: 재생 시간, 크기, 코덱, 전사 상태, CPU 및 GPU 시간 추정. 정렬 옵션이 있는 단일 파일 또는 폴더 스캔.

### ✅ v1.7.0 — 백그라운드 전사 + 진행 상황 가시성
분리된 프로세스 아키텍처: `background=true`인 `transcribe_audio`가 whisper를 분리된 프로세스로 생성하고 즉시 작업 ID를 반환. `check_progress`가 whisper의 stderr 세그먼트 타임스탬프를 실시간 비율과 ETA로 파싱.

### ✅ v1.8.0 — 검증이 있는 순차 배치
`start_batch` 및 `check_batch_progress`: 자동 순차 처리, 전사 검증(빈/짧은 출력 감지), 자동 큐 진행, 파일별 진행 타임스탬프.

### ✅ v1.9.0 — 다국어 지원 및 번역
`language=auto` 감지와 `translate_to_english=true` 이중 SRT 출력을 가진 `generate_subtitles`. `.3gp` 및 `.ts` 포맷 지원 추가. `language=auto`는 `transcribe_audio`에서도 사용 가능.

**알려진 제한:** Whisper의 내장 번역은 영어만 대상으로 합니다. 비영어 언어에는 `large-v3` 모델이 필요합니다 — 영어 전용 모델(`*.en.bin`)은 비영어 음성에 `[FOREIGN]`을 출력합니다.

### ✅ v2.0.0 — Unicode 안전 경로 + 백그라운드 SRT
**Unicode 파일명:** 파일명에 비ASCII 문자가 있는 경우 백그라운드 전사가 조용히 실패하던 문제 수정. 모든 출력을 정제된 작업 ID 기반 임시 경로를 통해 라우팅하고 완료 후 올바른 목적지로 이동하도록 변경.

**백그라운드 모드 SRT:** `spawnDetached`가 요청된 포맷에 관계없이 `-otxt`를 하드코딩하던 문제 수정. `spawnDetached`에 `outputFormat` 파라미터를 추가하여 백그라운드 모드에서 `text` 및 `srt` 출력 지원.

### ✅ v2.0.1 — 버그 수정 (v2.2.0에 포함)
- `buildArgs`와 `spawnDetached` 모두에 `--max-context 0` 하드코딩 — 장시간 음성에서 환각 루프 방지.
- 양 함수에 `--no-speech-thold 0.6` 하드코딩 — 신뢰도 임계값 미만의 세그먼트를 환각된 콘텐츠 대신 무음으로 처리.
- 경로 검증(`validateInputPath`) — UNC 경로 및 `..` 탐색 거부.
- `MAX_FILE_SIZE_MB = 10240` 파일 크기 가드.
- `transcribeSingle`에 전사 인젝션 보안 주석 추가.
- TROUBLESHOOTING.md에서 손상된 CLI 배치 명령 수정.

### ✅ v2.1.0 — 모델 관리 스위트 (v2.2.0에 포함)
- `WHISPER_MODEL`을 `const`에서 `let`으로 변경 (세션 변경 가능).
- `MODEL_REGISTRY` — 16개 모델, 전체 정밀도 및 양자화 변형, Hugging Face 다운로드 URL.
- `ALLOWED_HF_PREFIXES` — 다운로드를 `ggerganov/whisper.cpp` 및 `ggml-org` 네임스페이스로 제한하는 URL 허용 목록.
- `list_models` 도구 — 모델 디렉터리 스캔, 활성 모델, 크기, 사용 사례, 사용 가능한 다운로드 표시.
- `download_model` 도구 — Node.js 내장 `https`를 통해 Hugging Face에서 다운로드, 원자적 이름 변경.
- `switch_model` 도구 — `.bin` 확장자 검증, 디렉터리 제약, 프로세스 잠금 확인.
- `recommendedModel()` 업데이트 — 6GB 이상 VRAM에서 `large-v3-turbo` 권장.

### ✅ v2.2.0 — 품질, 파라미터, 하드웨어 확장
- `buildArgs`의 위치 인수를 대체하는 `WhisperOptions` 인터페이스.
- `transcribe_audio`의 새 파라미터: `temperature`, `prompt`, `condition_on_prev_text`, `no_speech_thold`, `beam_size`, `best_of`, `gpu_device`, `processors`, `word_timestamps`, `max_segment_length`, `split_on_word`, `diarize`, `vad_model`, `offset_t`, `duration`.
- `generate_subtitles`의 새 파라미터: `temperature`, `prompt`, `beam_size`, `best_of`, `diarize`, `vad_model`.
- `spawnDetached` 리팩토링 — 백그라운드/배치 모드에서 모든 품질 플래그가 적용됨.
- 배치 출력 수정 — `readBatchProgress`가 검증 전에 임시 출력을 최종 목적지로 이동하도록 수정.

**플래그 호환성 참고:** `gpu_device` / `--device`는 whisper.cpp v1.8.4에서 추가되었습니다. 릴리스의 사전 빌드된 Vulkan 바이너리는 v1.8.3 세대 — 이 파라미터는 도구에서 허용되지만 사용자가 v1.8.4 이상 바이너리로 업데이트할 때까지 효과가 없습니다.

### ✅ v2.2.2 — 패치
- 이중 라이선스 수정 — LICENSE 및 LICENSE-COMMERCIAL.md 교정.
- 사소한 문서 수정.

### ✅ v2.3.0 — 배치 자동 진행, 개인 정보 아키텍처, 출력 포맷 확장

**배치 자동 진행 (치명적 버그 수정):** `start_batch`가 큐를 진행하기 위해 이전에 활성 폴링이 필요했습니다. 이제 생성된 각 whisper-cli 자식 프로세스에 `on('exit')` 핸들러가 연결됩니다. 프로세스가 종료되면 배치가 exit 콜백을 통해 즉시 자동 진행됩니다 — 폴링 오버헤드와 API 호출 비용이 없습니다. 동시 exit 핸들러 + `check_batch_progress` 호출 간의 이중 생성을 뮤텍스로 방지합니다.

**개인 정보 아키텍처:**
- `WHISPER_PRIVACY_MODE` 환경 변수 — `true`로 설정 시 모든 도구 응답은 메타데이터만 반환합니다(파일명, 단어 수, 저장 경로). 전사 텍스트가 Claude의 API에 전송되지 않습니다. 전사본은 로컬 파일로만 존재합니다.
- `WHISPER_CONSENT_ACKNOWLEDGED` 환경 변수 — `true`로 설정 시 민감하지 않은 콘텐츠에 대한 일회성 세션 동의 게이트를 억제합니다.
- `transcribe_audio`, `transcribe_batch`, `start_batch`, `check_progress`에 `privacy_mode` 호출별 파라미터. 전역 환경 변수를 양방향으로 재정의. 토글에 재시작 불필요.
- 개인 정보 모드 게이트(`checkPrivacyGate()`) — 유효 개인 정보 모드가 활성화된 경우 모든 작업 전에 실행. 첫 번째 호출 시 활성화(공개 표시), 두 번째 호출 시 해제(허용). 각 작업 후 초기화. 세션 동의 게이트와 완전히 독립적.
- 세션 동의 게이트(`transcriptPolicy()`) — 기본 모드에서 첫 번째 전사본 반환 호출 전에 세션당 한 번 실행. `sessionConsentGiven` 플래그로 소비.
- `PRIVACY.md` — HIPAA, GDPR, 변호사-의뢰인 특권, FERPA, SOX, PCI-DSS, NDA/영업 비밀을 다루는 전체 컴플라이언스 문서.
- 전사 텍스트를 반환하는 모든 도구의 도구 설명 개인 정보 경고.

**출력 포맷 확장:**
- `vtt` — `-ovtt`를 통한 WebVTT 자막 출력. `transcribe_audio`, `generate_subtitles`, `start_batch`, 백그라운드 모드에서 사용 가능.
- `lrc` — `-olrc`를 통한 LRC 가사/카라오케 포맷. `transcribe_audio` 및 백그라운드 모드에서 사용 가능.
- `csv` — `-ocsv`를 통한 타임스탬프가 있는 CSV. `transcribe_audio` 및 백그라운드 모드에서 사용 가능.
- `output_format` 기본값이 모든 도구 및 코드 경로에서 `"text"`에서 `"timestamps"`로 변경됨. 일반 텍스트는 이제 선택 사항.

**버그 수정:**
- 버그 1: `output_format`이 백그라운드 작업에 전달되지 않음 — 요청된 포맷에 관계없이 기본 `"text"`가 사용되었습니다. 기본값을 `"timestamps"`로 변경하고 올바르게 전달하도록 수정.
- 버그 2: 백그라운드 작업 출력 이동 작업의 조용한 `catch {}` 가 실패를 삼켰습니다. 이동 후 명시적 `existsSync` 확인과 상세 실패 메시지를 추가.
- 버그 3: 백그라운드 생성 지점에 비개인 정보 백그라운드 작업에 대해 동의 게이트가 의도적으로 `check_progress`로 연기되는 이유를 설명하는 설계 주석 추가.

**추가:**
- 임시 디렉터리 자동 정리 — `cleanupOldJobFiles()`가 시작 시 실행되어 `%TEMP%\whisper-mcp-jobs\`에서 7일이 지난 `.json` 및 `.log` 파일을 삭제합니다.
- `check_config`가 이제 개인 정보 모드 상태를 보고합니다.
- 시작 로그에 개인 정보 모드 켜짐/꺼짐이 보고됩니다.
- `Job` 인터페이스에 `privacyMode: boolean` 필드가 추가됩니다.
- `BatchState` 인터페이스에 `privacyMode: boolean` 필드가 추가됩니다.
- `BackgroundFormat` 타입이 `json`을 제외합니다(백그라운드 모드의 json은 지원되지 않음 — `text`로 폴백).

### ✅ v2.4.0 — 강화, 포그라운드 가드, 테스트 스위트 및 CI

보안/견고성 점검 패스. 계획되었던 Bun 마이그레이션은 v2.5.0으로 연기되었습니다.

**보안 및 정확성:**
- `switch_model` 경로 격리 수정 — 형제 접두사 디렉터리(예: `…\models-evil`)가 이전에는 단순한 `startsWith`로 "모델 디렉터리 내부" 검사를 통과할 수 있었으나, 정규화된 `relative()` 기반 격리로 교체했습니다. SECURITY.md가 설명하는 탈출 경로를 막습니다.
- 개인 정보/동의 게이트를 **작업별**(도구 + 인수)로 키 지정 — 한 전사를 확인해도 더 이상 다른 작업의 게이트를 충족할 수 없습니다.
- `download_model`은 `.part` 파일을 승격하기 전에 잘린 다운로드를 거부합니다(Content-Length 검사). (전체 SHA256 다이제스트 검증은 이후 패스에서 추적합니다.)
- 입력 강제 변환 — 실제 숫자가 아닌 숫자형 도구 매개변수는 `NaN`으로 whisper-cli에 전달되는 대신 폐기됩니다.

**견고성:**
- **포그라운드 타임아웃 가드** — 차단 모드에서 Claude Desktop의 약 4분 MCP 도구 타임아웃을 초과할 만큼 긴 파일을 미리 감지하여 조용히 타임아웃되는 대신 백그라운드로 라우팅합니다. 임계값은 `WHISPER_FOREGROUND_MAX_SEC`로 구성 가능합니다. 시간 추정을 수정했습니다(이전 GPU 추정은 크게 과소평가했음. 이제 지배적인 모델 재로드 비용을 모델링 — 추측이 아닌 실측).
- 작업/배치 상태의 원자적 쓰기(임시 파일 + 이름 변경)로 동시 읽기에서 손상된 JSON 파일을 관찰할 수 없도록 했습니다.
- 충돌 방지 작업/배치/임시 ID(UUID 접미사).
- 차단 모드 임시 파일을 정리하는 SIGINT/SIGTERM 우아한 종료.

**GPU 장치 선택:**
- `WHISPER_GPU_DEVICE` 환경 변수, 그리고 `gpu_device`가 이제 `generate_subtitles`와 언어 감지 패스에도 적용됩니다(이전에는 `transcribe_audio`만). `check_config`는 활성 장치를 보고합니다. `check_system`은 `wmic`(Windows 11 24H2+에서 더 이상 사용되지 않음)가 아무것도 반환하지 않을 때 더 이상 드라이버 문제를 잘못 보고하지 않습니다.

**품질:**
- 순수 로직(경로 격리, 게이트 키 지정, 원자적 쓰기, 입력 강제 변환, 타임아웃 추정)에 대한 `node:test` 단위 테스트 스위트, 추가 의존성 제로, 그리고 모든 push/PR에서 실행하는 GitHub Actions CI 워크플로우.

**향후 릴리스를 위해 식별됨:** 모든 전사마다 발생하는 모델 재로드 비용을 제거하기 위한 영구 모델 경로(예: whisper.cpp의 `whisper-server`) — 배치/아카이브 작업에서 큰 처리량 향상.

---

## 계획됨 — v2.5.0: Bun 마이그레이션

런타임을 Node.js에서 [Bun](https://bun.sh)으로 마이그레이션합니다.

Claude Desktop은 모든 세션 시작 시 MCP 서버를 새로 생성하므로 시작 시간이 임계 경로에 있습니다. Bun은 컴파일 단계 없이 TypeScript를 네이티브로 실행하고, Node보다 상당히 빠르게 시작하며, I/O도 빠릅니다.

**변경되는 사항:**
- `tsc` 빌드 단계 및 `dist/` 디렉터리 제거
- 사용자가 TypeScript 소스를 직접 실행
- `tsconfig.json`이 선택적으로 됨
- `package.json` 스크립트 업데이트
- npm 게시 워크플로우 업데이트

**변경되지 않는 사항:**
- `src/index.ts` 소스 코드 — Bun은 기존 TypeScript 및 Node.js 내장 API와 호환됩니다
- 모든 도구 동작 및 출력 포맷
- 최종 사용자의 Claude Desktop 설정

---

## 계획됨 — v2.6.0: 외부 도구 통합을 위한 향상된 출력 포맷

다운스트림 분석 및 통합 워크플로우를 대상으로 하는 확장된 출력 포맷 지원. 정확한 범위는 v2.3.0 이후 사용자 피드백을 기반으로 결정됩니다.

---

## 계획됨 — v2.7.0: 실시간 마이크 전사 모드

라이브 마이크 입력에서의 실시간 전사. 선택된 녹음 장치에서 오디오를 청크 단위로 whisper에 스트리밍하여 완료된 전사 세그먼트를 롤링 방식으로 반환합니다.

**설계 제약:**
- 장치 선택은 명시적이어야 함 — 조용한 기본 장치 캡처 없음
- 사용자가 Claude Desktop 상호작용을 통해 스트림을 중지할 수 있어야 함
- 한 번에 하나의 whisper 인스턴스 제약을 위반해서는 안 됨
- 지연 시간 대 정확도 절충은 사용자가 설정 가능해야 함

**상태:** 설계 단계. whisper.cpp의 안정적인 스트리밍 API에 의존합니다.

---

## 계획됨 — 향후 릴리스

### TinyDiarize
`tdrz` 지원 모델 변형(예: `large-v2-tdrz`)을 사용한 `--tinydiarize` 플래그 지원. 스테레오 전용 `--diarize` 플래그와 달리 TinyDiarize는 모노 녹음에 작동합니다. 특별한 모델 변형 다운로드가 필요합니다. pyannote 기반 화자 분리보다 정확도는 낮지만 모델 파일 외에 추가 의존성이 없습니다.

**상태:** 계획됨. `download_model`이 tdrz 모델 변형을 지원하는 것에 의존합니다.

### YouTube URL 전사
yt-dlp를 통해 YouTube URL에서 직접 전사. 단일 단계에서 음성 다운로드 및 전사. yt-dlp 설치 및 PATH 설정이 필요합니다.

**설계 제약:** yt-dlp는 선택 사항입니다. 도구는 찾을 수 없을 경우 명확한 설치 지침과 함께 적절히 저하되어야 합니다. 이것이 필요 없는 사용자의 핵심 기능 변경 없음.

### 동영상 프로젝트 워크플로우 도구
소스 및 편집된 클립 디렉터리를 관리하는 사용자를 위한:

1. 소스 디렉터리 및 클립 하위 디렉터리 스캔
2. 편집된 클립 전사본을 소스 전사본과 퍼지 매칭하여 원본 위치 찾기
3. 전사 내용을 기반으로 Claude가 제안한 설명적인 파일명 표시 (이름 변경 실행 전에 명시적인 사용자 확인 필요)
4. 타임코드 결과와 함께 프로젝트 디렉터리 전체 전사본 검색

**설계 제약:**
- 소스 파일은 **절대 이름 변경 또는 수정되지 않음**
- 모든 이름 변경에는 **명시적인 사용자 확인**이 필요
- 검색은 독립적으로 사용 가능한 독립형 도구
- 분석 및 매칭은 로컬에서 이루어짐 — Claude는 사용자가 결과를 검토할 때만 호출되어 API 호출 최소화

**상태:** 설계 단계.

### 화자 분리 (pyannote-audio)
화자 ID 레이블이 있는 완전한 모노 화자 분리 — 채널 구성에 관계없이 전체 녹음에서 화자 전환을 표시합니다. 내장 `--diarize` 스테레오 플래그(v2.2.0) 및 TinyDiarize와는 다릅니다.

**구현:** [pyannote-audio](https://github.com/pyannote/pyannote-audio)가 필요 — Hugging Face 모델 접근 토큰이 필요한 Python 기반 라이브러리. 완전히 별개의 의존성 스택.

**상태:** 자체 설정 문서가 있는 선택적 고급 기능으로 계획됨. 메인 패키지에 포함되지 않음.

### 비영어 언어로의 번역
Whisper의 `--translate` 플래그는 영어만 대상으로 합니다. 임의의 대상 언어를 지원하려면 외부 번역 API 또는 로컬 번역 모델이 필요합니다.

**검토 중인 옵션:** LibreTranslate(자체 호스팅 가능, 로컬 우선), 로컬 LLM 번역, 또는 명시적인 범위 외 문서화.

**상태:** 로컬 우선 대 API 의존성에 대한 설계 결정 대기 중 연기됨.

### 전사본 정리 및 포맷팅
후처리 파이프라인:
- 필러 단어 및 말 막힘 제거 (선택 사항, 사용자 제어)
- 자연스러운 주제 경계에서 단락 구분
- 화자 분리 출력과 결합된 화자 인식 포맷팅
- PDF 또는 DOCX로 내보내기

**상태:** 계획됨. 화자 인식 변형은 화자 분리에 의존합니다.

---

## 라이선싱

whisper-windows-mcp는 이중 라이선스를 적용합니다.

**비상업적 사용:** MIT — 개인, 교육, 비상업적 목적의 사용은 무료입니다. [LICENSE](LICENSE)를 참조하세요.

**상업적 사용:** 비즈니스, 전문적 또는 수익 창출 목적의 사용에는 별도의 상업용 라이선스가 필요합니다. [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md)를 참조하세요.

---

## 배포

[npm](https://www.npmjs.com/package/whisper-windows-mcp), [mcpservers.org](https://mcpservers.org), [Glama](https://glama.ai), [awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers)에서 사용 가능 (PR 제출됨).

---

## 다국어 문서

각 릴리스 후 다음 파일을 영어 문서에 맞게 업데이트해야 합니다:

**일본어 (`*.ja.md`)** — `README.ja.md` / `TROUBLESHOOTING.ja.md` / `ROADMAP.ja.md` / `PRIVACY.ja.md` / `SECURITY.ja.md`

**한국어 (`*.ko.md`)** — `README.ko.md` / `TROUBLESHOOTING.ko.md` / `ROADMAP.ko.md` / `PRIVACY.ko.md` / `SECURITY.ko.md`

**베트남어 (`*.vi.md`)** — `README.vi.md` / `TROUBLESHOOTING.vi.md` / `ROADMAP.vi.md` / `PRIVACY.vi.md` / `SECURITY.vi.md`

**인도네시아어 (`*.id.md`)** — `README.id.md` / `TROUBLESHOOTING.id.md` / `ROADMAP.id.md` / `PRIVACY.id.md` / `SECURITY.id.md`

**우크라이나어 (`*.uk.md`)** — `README.uk.md` / `TROUBLESHOOTING.uk.md` / `ROADMAP.uk.md` / `PRIVACY.uk.md` / `SECURITY.uk.md`

**브라질 포르투갈어 (`*.pt-BR.md`)** — `README.pt-BR.md` / `TROUBLESHOOTING.pt-BR.md` / `ROADMAP.pt-BR.md` / `PRIVACY.pt-BR.md` / `SECURITY.pt-BR.md`

**스페인어 (`*.es.md`)** — `README.es.md` / `TROUBLESHOOTING.es.md` / `ROADMAP.es.md` / `PRIVACY.es.md` / `SECURITY.es.md`

**폴란드어 (`*.pl.md`)** — `README.pl.md` / `TROUBLESHOOTING.pl.md` / `ROADMAP.pl.md` / `PRIVACY.pl.md` / `SECURITY.pl.md`

**루마니아어 (`*.ro.md`)** — `README.ro.md` / `TROUBLESHOOTING.ro.md` / `ROADMAP.ro.md` / `PRIVACY.ro.md` / `SECURITY.ro.md`

다른 언어로의 커뮤니티 기여를 환영합니다.

---

## 기여

풀 리퀘스트 환영합니다. 작업을 시작하기 전에 기존 이슈를 확인하세요.

위에 나열되지 않은 하드웨어에서 GPU 가속을 테스트한 경우 GPU 모델, VRAM, 모델 크기, 관찰된 처리량을 이슈로 보고해 주세요. 이것은 다른 사용자를 위한 정확한 성능 참고 자료를 구축하는 데 도움이 됩니다.
