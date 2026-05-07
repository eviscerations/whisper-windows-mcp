# whisper-windows-mcp — 로드맵

현재 버전: **v2.2.0**

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

**백그라운드 모드 SRT:** `spawnDetached`가 요청된 포맷에 관계없이 `-otxt`를 하드코딩했으며, `generate_subtitles`가 긴 파일에서 MCP 타임아웃에 걸리도록 동기적으로 블로킹하던 문제 수정. `spawnDetached`에 `outputFormat` 파라미터를 추가하여 백그라운드 모드에서 `text` 및 `srt` 출력 지원.

### ✅ v2.0.1 — 버그 수정 (v2.2.0에 포함)
- `buildArgs`와 `spawnDetached` 모두에 `--max-context 0` 하드코딩 — 장시간 음성에서 환각 루프 방지. 현재 바이너리(v1.8.3 세대)에서 `--condition-on-previous-text`와 `--no-context`는 유효한 플래그가 아님 — `--max-context N`이 올바른 플래그.
- 양 함수에 `--no-speech-thold 0.6` 하드코딩 — 신뢰도 임계값 미만의 세그먼트를 환각된 콘텐츠 대신 무음으로 처리.
- 경로 검증(`validateInputPath`) — UNC 경로 및 `..` 탐색 거부.
- `MAX_FILE_SIZE_MB = 10240` 파일 크기 가드.
- `transcribeSingle`에 전사 인젝션 보안 주석 추가.
- TROUBLESHOOTING.md에서 손상된 CLI 배치 명령 수정 — 올바른 FFmpeg 사전 변환 방식과 `Start-Process -RedirectStandardOutput` 방법 문서화.

### ✅ v2.1.0 — 모델 관리 스위트 (v2.2.0에 포함)
- `WHISPER_MODEL`을 `const`에서 `let`으로 변경 (세션 변경 가능).
- `MODEL_REGISTRY` — 16개 모델, 전체 정밀도 및 양자화 변형, Hugging Face 다운로드 URL.
- `ALLOWED_HF_PREFIXES` — 다운로드를 `ggerganov/whisper.cpp` 및 `ggml-org` 네임스페이스로 제한하는 URL 허용 목록.
- `list_models` 도구 — 모델 디렉터리 스캔, 활성 모델, 크기, 사용 사례, 사용 가능한 다운로드 표시.
- `download_model` 도구 — Node.js 내장 `https`를 통해 Hugging Face에서 다운로드, 원자적 이름 변경 (Windows 파일 핸들 해제 경쟁 조건 수정).
- `switch_model` 도구 — `.bin` 확장자 검증, 디렉터리 제약, 프로세스 잠금 확인.
- `recommendedModel()` 업데이트 — 6GB 이상 VRAM에서 `large-v3-turbo` 권장.

### ✅ v2.2.0 — 품질, 파라미터, 하드웨어 확장 (현재)
- `buildArgs`의 위치 인수를 대체하는 `WhisperOptions` 인터페이스.
- `transcribe_audio`의 새 파라미터: `temperature`, `prompt`, `condition_on_prev_text`, `no_speech_thold`, `beam_size`, `best_of`, `gpu_device`, `processors`, `word_timestamps`, `max_segment_length`, `split_on_word`, `diarize`, `vad_model`, `offset_t`, `duration`.
- `generate_subtitles`의 새 파라미터: `temperature`, `prompt`, `beam_size`, `best_of`, `diarize`, `vad_model`.
- `spawnDetached` 리팩토링 — 백그라운드/배치 모드에서 모든 품질 플래그가 적용됨.
- `runSrtPass` 업데이트로 `extraOpts` 허용.
- 배치 출력 수정 — `readBatchProgress`가 검증 전에 임시 출력을 최종 목적지로 이동하도록 수정 (모든 배치 "실패" 결과의 근본 원인).

**플래그 호환성 참고:** `gpu_device` / `-g`는 whisper.cpp v1.8.4에서 추가되었습니다. 릴리스의 사전 빌드된 Vulkan 바이너리는 v1.8.3 세대 — 이 파라미터는 도구에서 허용되지만 사용자가 v1.8.4 이상 바이너리로 업데이트할 때까지 효과가 없습니다.

**현재 바이너리(v1.8.3 세대)에서 확인된 유효한 플래그:**
`--max-context`, `--no-speech-thold`, `--processors`, `--offset-t`, `--duration`, `--best-of`, `--beam-size`, `--diarize`, `--tinydiarize`, `--temperature`, `--prompt`, VAD 플래그.

**현재 바이너리에 없는 플래그:** `--no-context` (`--max-context 0` 사용), `--condition-on-previous-text` (Python API 이름만), `--gpu-device` / `-g` (v1.8.4 이상).

---

## 중요 버그 — 배치 자동 진행 (확인됨, 수정 대기 중)

### 활성 폴링 없이 배치가 자동 진행되지 않음

`start_batch`는 파일 간에 큐를 자율적으로 진행하지 않습니다. 배치는 `check_batch_progress`가 호출될 때만 진행됩니다. 폴링 없이는 각 파일 완료 후 배치가 무한정 멈춥니다 — whisper-cli.exe가 종료되어도 새 프로세스가 생성되지 않으며 큐가 진행되지 않습니다.

이것은 도구의 핵심 설계 목표인 무인 야간 배치 처리를 파괴하며 Claude API 호출 최소화 설계 원칙에 직접 위반됩니다. 95개 파일 배치를 완료하는 데 100분에 걸쳐 약 200번의 폴링 호출이 필요했습니다.

**근본 원인:** `readBatchProgress`에 모든 큐 진행 로직이 포함되어 있습니다. `check_batch_progress`가 명시적으로 호출될 때만 실행됩니다. 백그라운드 타이머, 파일 감시자, 자율 루프가 없습니다.

**계획된 수정 — 옵션 B (exit 콜백, 강력히 권장):** 생성된 whisper-cli 자식 프로세스에 `on('exit')` 핸들러를 연결. 프로세스가 종료되면 즉시 진행 로직을 실행하여 출력을 검증하고 다음 작업을 생성합니다. 이벤트 기반으로 파일 완료당 정확히 한 번 발생하며 폴링 오버헤드와 API 호출 비용이 없습니다.

**옵션 A (대안만):** 배치 상태 JSON에 이미 있는 FFprobe 재생 시간 데이터에서 도출한 재생 시간 기반 폴링 간격을 사용하는 `setInterval`. 파일 크기는 재생 시간의 신뢰할 수 있는 대리 지표가 아닙니다.

**추가 제약:** 수정은 이미 실행 중인 whisper-cli.exe가 있을 때 두 번째를 생성해서는 안 됩니다 — 자동 진행 경로에서도 프로세스 잠금이 존중되어야 합니다.

**현재 해결 방법:** 배치가 완료될 때까지 `check_batch_progress`를 반복적으로 호출하세요. 파일당 약 한 번의 폴링이 필요합니다.

---

## 계획됨 — 개인 정보 아키텍처 (Bun 마이그레이션 이전)

이러한 변경 사항은 Bun 마이그레이션 이전, 그리고 상업적 또는 기업 채택을 촉진하는 라이선스 변경 이전에 출시되어야 합니다. 해결된 컴플라이언스 보호 없이 엔터프라이즈급 도구를 출시하면 규제 산업의 사용자에게 책임을 생성합니다.

### `WHISPER_PRIVACY_MODE` 환경 변수
이 도구는 현재 **음성**이 머신을 떠나지 않음을 보장합니다. 이 보장은 **전사 텍스트**에는 적용되지 않습니다 — 도구 응답에 전사 콘텐츠가 인라인으로 반환될 때 해당 텍스트는 Claude의 API에서 처리되고 로컬 환경을 떠납니다.

이 격차는 "데이터가 머신을 떠나지 않는다"는 메시지를 음성에서 파생된 모든 콘텐츠가 로컬에 남아 있다는 의미로 합리적으로 해석하는 사용자에게 보이지 않습니다.

`WHISPER_PRIVACY_MODE`를 `claude_desktop_config.json`의 환경 변수로 추가합니다. 활성화 시:
- 모든 도구 응답은 메타데이터만 반환: 파일명, 재생 시간, 단어 수, 완료 상태
- 어떤 도구 응답에도 전사 텍스트가 포함되지 않음
- Claude는 어떤 형태로도 전사 콘텐츠를 읽거나 분석하거나 중계할 수 없음
- 전사본은 로컬 `.txt` 파일로만 존재

이것은 의료, 법률, 재정, 기업 배포에 적합한 설정입니다. API 호출 없음, 데이터 전송 없음, 컴플라이언스 위험 없음.

### 전사 콘텐츠에 대한 동의 게이트
`WHISPER_PRIVACY_MODE`가 활성화되지 않은 경우(기본값), 전사 텍스트를 포함하는 도구 응답은 세션당 첫 번째 사용 시 공개 알림이 앞에 와야 합니다. 이 알림은 전사 텍스트가 Anthropic의 API에 전송된다는 것, 이것이 "데이터가 머신을 떠나지 않는다"는 보장의 범위 밖임을, 규제 대상 콘텐츠를 처리하는 사용자는 진행하기 전에 컴플라이언스 의무를 확인해야 한다는 것을 명확히 전달해야 합니다.

구현: 기본값이 `false`인 `WHISPER_CONSENT_ACKNOWLEDGED` 환경 변수. 세션당 첫 번째 전사본 반환 시 승인되지 않은 경우 Claude가 공개 알림을 제시하고 명시적 확인을 요청합니다. 세션 동안 한 번 승인되면 이후 전사본은 재프롬프트 없이 반환됩니다.

### `PRIVACY.md` 문서
리포지토리 루트에 `PRIVACY.md` 생성:
- 항상 로컬에 남는 데이터: 음성, 동영상, 모델 파일
- 기본값으로 로컬을 떠날 수 있는 데이터: 도구 응답의 전사 텍스트
- 개인 정보 모드로 절대 로컬을 떠나지 않는 데이터: 모든 것
- 산업별 컴플라이언스 프레임워크 안내 (HIPAA, GDPR, 변호사-의뢰인 특권, FERPA, SOX, PCI-DSS, NDA/영업 비밀)
- 개인 정보 모드 설정 방법
- 도구 작성자가 법률 고문이 아니라는 면책 조항

### 도구 스키마 개인 정보 경고
전사 텍스트를 반환하는 도구에 개인 정보 참고 사항을 포함하도록 `ListToolsRequestSchema` 도구 설명을 업데이트합니다. Claude Desktop의 도구 설명에 표시되어 사용 시점에서 인식을 높입니다.

### 임시 디렉터리 자동 정리
`%TEMP%\whisper-mcp-jobs\`는 시간이 지남에 따라 작업 상태 및 로그 파일을 축적합니다. 설정 가능한 보존 기간(기본값: 7일)이 지난 완료된 작업 파일의 자동 정리를 추가합니다. 현재는 사용자가 수동으로 `Remove-Item`을 실행해야 합니다.

---

## 계획됨 — Bun 마이그레이션

개인 정보 아키텍처가 완성된 후, v2.3.0 기능 추가 이전에 런타임을 Node.js에서 [Bun](https://bun.sh)으로 마이그레이션합니다.

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

**개인 정보 이후, v2.3.0 이전에 마이그레이션하는 이유:** 코드베이스는 지금이 마이그레이션하기 가장 쉬운 상태입니다. 도구 추가 후 마이그레이션하면 작업량만 늘어나고 이점이 없습니다. 개인 정보 아키텍처는 위에서 설명한 대로 먼저 출시되어야 합니다.

---

## 계획됨 — 라이선스 검토 (Bun 마이그레이션 이후)

현재 MIT 라이선스는 제한 없이 상업적 사용을 허용합니다. 도구가 전문적이고 기업 시장에 대규모로 도달하기 전에 라이선스 상황을 평가해야 합니다.

**계획된 접근 방식 — 이중 라이선스:**
- 개인 및 비상업적 사용에 MIT (기존 사용자에게 변경 없음)
- 비즈니스 및 기업 사용에 별도 상업 라이선스
- 전환 시점: Bun 마이그레이션 이후 다음 주요 버전 릴리스

**지금이 아닌 이유:** 개인 정보 아키텍처가 완성되기 전에 라이선스를 변경하면 HIPAA/GDPR 컴플라이언스 격차가 해결되지 않은 도구의 상업 라이선스를 판매하는 것을 의미합니다. 개인 정보가 먼저 출시되고 라이선스 검토가 뒤따릅니다.

상업 라이선스, 도구 스키마 개인 정보 경고, `PRIVACY.md`가 함께 기업 구매자를 위한 최소한의 실용적인 컴플라이언스 스토리를 형성합니다.

---

## 계획됨 — v2.3.0: 출력 포맷 확장

### VTT 자막 포맷
SRT와 함께 WebVTT(`.vtt`) 출력. VTT는 YouTube, HTML5 `<video>`, 대부분의 최신 플레이어가 사용하는 웹 표준입니다. whisper-cli가 네이티브로 지원합니다. `transcribe_audio`, `generate_subtitles`, `spawnDetached`에 `vtt`를 유효한 출력 포맷으로 추가. `buildArgs`와 관련된 모든 도구 스키마, README, 한국어 문서를 업데이트합니다.

### LRC 포맷
`-olrc`를 통한 LRC(`.lrc`) 가사/카라오케 포맷 출력. 미디어 플레이어에서 동기화된 가사 표시에 사용됩니다. 구현 비용이 없습니다 — 네이티브 CLI 플래그.

### CSV 포맷
`-ocsv`를 통한 CSV(`.csv`) 출력. 세그먼트 타이밍이 있는 구조화된 표 형식 데이터 — 다운스트림 분석, 클립 정렬 워크플로우, 스프레드시트 도구 가져오기에 유용합니다. 구현 비용이 없습니다 — 네이티브 CLI 플래그.

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

**구현:** [pyannote-audio](https://github.com/pyannote/pyannote-audio)가 필요 — Hugging Face 모델 접근 토큰이 필요한 Python 기반 라이브러리. whisper.cpp 파이프라인과는 완전히 별개의 의존성 스택.

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

## 배포

[npm](https://www.npmjs.com/package/whisper-windows-mcp), [mcpservers.org](https://mcpservers.org), [Glama](https://glama.ai)에서 사용 가능.

---

## 다국어 문서

일본어, 한국어, 베트남어, 인도네시아어, 우크라이나어, 브라질 포르투갈어 및 스페인어 문서는 영어와 병행하여 관리됩니다. 각 릴리스 후 다음 파일을 영어 문서에 맞게 업데이트해야 합니다:

**일본어 (`*.ja.md`)** — `README.ja.md` / `TROUBLESHOOTING.ja.md` / `ROADMAP.ja.md` / `PRIVACY.ja.md` / `SECURITY.ja.md`

**한국어 (`*.ko.md`)** — `README.ko.md` / `TROUBLESHOOTING.ko.md` / `ROADMAP.ko.md` / `PRIVACY.ko.md` / `SECURITY.ko.md`

**베트남어 (`*.vi.md`)** — `README.vi.md` / `TROUBLESHOOTING.vi.md` / `ROADMAP.vi.md` / `PRIVACY.vi.md` / `SECURITY.vi.md`

**인도네시아어 (`*.id.md`)** — `README.id.md` / `TROUBLESHOOTING.id.md` / `ROADMAP.id.md` / `PRIVACY.id.md` / `SECURITY.id.md`

**우크라이나어 (`*.uk.md`)** — `README.uk.md` / `TROUBLESHOOTING.uk.md` / `ROADMAP.uk.md` / `PRIVACY.uk.md` / `SECURITY.uk.md`

**브라질 포르투갈어 (`*.pt-BR.md`)** — `README.pt-BR.md` / `TROUBLESHOOTING.pt-BR.md` / `ROADMAP.pt-BR.md` / `PRIVACY.pt-BR.md` / `SECURITY.pt-BR.md`

**스페인어 (`*.es.md`)** — `README.es.md` / `TROUBLESHOOTING.es.md` / `ROADMAP.es.md` / `PRIVACY.es.md` / `SECURITY.es.md`

다른 언어로의 커뮤니티 기여를 환영합니다.

---

## 기여

풀 리퀘스트 환영합니다. 작업을 시작하기 전에 기존 이슈를 확인하세요.

위에 나열되지 않은 하드웨어에서 GPU 가속을 테스트한 경우 GPU 모델, VRAM, 모델 크기, 관찰된 처리량을 이슈로 보고해 주세요. 이것은 다른 사용자를 위한 정확한 성능 참고 자료를 구축하는 데 도움이 됩니다.
