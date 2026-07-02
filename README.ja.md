# whisper-windows-mcp

[![CI](https://github.com/eviscerations/whisper-windows-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/eviscerations/whisper-windows-mcp/actions/workflows/ci.yml)

[![whisper-windows-mcp MCP server](https://glama.ai/mcp/servers/eviscerations/whisper-windows-mcp/badges/card.svg)](https://glama.ai/mcp/servers/eviscerations/whisper-windows-mcp)

Windows向けのネイティブMCP（Model Context Protocol）サーバーです。[whisper.cpp](https://github.com/ggml-org/whisper.cpp)を使用して、Claude Desktopで音声・動画ファイルをローカルに文字起こしできます。GPU加速、多言語対応、バッチ処理に対応しています。すべての文字起こし処理はローカルで実行 — 音声・動画ファイルやファイルパスが外部に送信されることは一切ありません。

> **なぜこのパッケージが存在するのか？**
> 人気の`whisper-mcp`パッケージはmacOS向けに構築されており、Unix環境を前提としています。Windowsでは動作しません。このパッケージは、Claude DesktopでローカルなAI文字起こしを求めるWindowsユーザーのために作られました。

---

## できること

インストール後、Claude Desktopで以下のように話しかけるだけで使えます：

- *「C:\\Users\\Me\\Downloads\\meeting.mp3を文字起こしして」*
- *「このフォルダの録音ファイルをすべて文字起こしして、それぞれテキストファイルに保存して」*
- *「このビデオの日本語と英語の字幕を生成して」*
- *「このフォルダのバッチ文字起こしを開始して」*
- *「これらのファイルの文字起こしにかかる時間はどれくらい？」*
- *「GPU加速が有効か確認して」*
- *「このファイルをプライバシーモードで文字起こしして」*

---

## 必要条件

1. **Node.js 18以降** — [nodejs.org](https://nodejs.org)
2. **Vulkan GPU対応のwhisper.cppバイナリ** — ステップ1参照
3. **Whisperモデルファイル** — ステップ2参照
4. **FFmpeg** — 動画ファイルと非WAV/MP3音声に必要

---

## ステップ1 — whisper.cppバイナリのインストール

### オプションA — ビルド済みVulkanリリース（推奨）

[リリースページ](https://github.com/eviscerations/whisper-windows-mcp/releases/tag/v1.4.0)から`whisper-vulkan-win-x64.zip`をダウンロードしてください。

これは**Vulkan GPU加速**が有効なカスタムビルドです。AMD、NVIDIA、Intel GPUで動作します — ベンダー固有のSDKは不要です。

`C:\whisper\Release\`に展開してください。以下のファイルが揃っているか確認してください：

```
C:\whisper\Release\whisper-cli.exe
C:\whisper\Release\ggml-vulkan.dll
C:\whisper\Release\ggml.dll
C:\whisper\Release\ggml-base.dll
C:\whisper\Release\ggml-cpu.dll
C:\whisper\Release\whisper.dll
```

GPU加速は自動で有効になります — 追加設定は不要です。

### オプションB — ソースからビルド

必要なもの：Git、CMake、Visual Studio Build Tools 2022+（「C++によるデスクトップ開発」）、[lunarg.com](https://vulkan.lunarg.com/sdk/home#windows)のVulkan SDK。

```
git clone https://github.com/ggml-org/whisper.cpp
cd whisper.cpp
cmake -B build -DGGML_VULKAN=ON -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release --target whisper-cli
```

`build\bin\Release\`からバイナリを`C:\whisper\Release\`にコピーしてください。

> **注意：** GitHubの公式whisper.cpp WindowsリリースにはVulkanビルドが含まれていません。上記のビルド済みリリースを使用するか、`-DGGML_VULKAN=ON`でソースからコンパイルする必要があります。

---

## ステップ2 — Whisperモデルのダウンロード

| モデル | サイズ | 速度 | 精度 | 用途 |
|---|---|---|---|---|
| `ggml-tiny.en.bin` | 75 MB | 非常に高速 | 基本 | 動作確認 |
| `ggml-base.en.bin` | 142 MB | 高速 | 良好 | 日常的な英語 |
| `ggml-small.en.bin` | 466 MB | 中程度 | より良好 | 重要な録音 |
| `ggml-medium.en.bin` | 1.5 GB | GPUで高速 | 非常に良好 | 最高品質の英語 |
| `ggml-large-v3-turbo.bin` | 1.6 GB | GPUで高速 | 優秀 | **英語GPUバッチ処理の推奨 — large-v3の約6倍高速で精度損失は最小限** |
| `ggml-large-v3.bin` | 2.9 GB | GPUで高速 | 優秀 | 多言語、最高精度 |
| `ggml-medium.en-q5_0.bin` | 514 MB | 高速 | 非常に良好 | **CPU専用英語の最良選択 — 低メモリで高精度** |
| `ggml-large-v3-turbo-q5_0.bin` | 547 MB | 高速 | 優秀 | **CPU専用多言語の最良選択** |
| `ggml-large-v3-q5_0.bin` | 1.1 GB | CPUで中程度 | 優秀 | 多言語、CPU対応 |

Claude Desktopで`download_model`を使用して直接インストールできます。**英語専用**の場合：`large-v3-turbo`（GPU）または`medium.en-q5_0`（CPU）がおすすめです。**多言語**の場合：`large-v3-turbo`または`large-v3-turbo-q5_0`（CPU）が必要です。英語専用モデル（`*.en.bin`）は英語以外の音声に`[FOREIGN]`を出力し、他の言語には使用できません。

---

## ステップ3 — FFmpegのインストール

FFmpegは動画ファイルと非ネイティブ音声フォーマットに必要です。

wingetでインストール：
```
winget install ffmpeg
```

または[ffmpeg.org](https://ffmpeg.org/download.html)からダウンロードしてPATHに追加してください。

確認：
```
ffmpeg -version
```

---

## ステップ4 — MCPサーバーのインストール

```
npm install -g whisper-windows-mcp
```

---

## ステップ5 — Claude Desktopの設定

Claude Desktop → 設定 → 開発者 → 設定を編集。

`whisper`エントリを追加してください：

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

設定ファイルの場所：`C:\Users\ユーザー名\AppData\Roaming\Claude\claude_desktop_config.json`

> すべてのパスに**バックスラッシュを2つ**使用してください。

保存後、Claude Desktopを**完全に再起動**してください。設定 → 開発者で**whisper**が緑色の実行中バッジで表示されるはずです。

---

## ステップ6 — セットアップの確認

Claude Desktopで以下を確認してください：

> *「whisperの設定を確認して」*

次に：

> *「システムハードウェアを確認して」*

GPUが検出されVulkan加速が有効になっていることを確認します。

---

## 利用可能なツール

### `transcribe_audio`
単一ファイルを文字起こしします。長いファイルにはブロッキング（デフォルト）またはバックグラウンドモードに対応しています。

| パラメータ | 説明 |
|---|---|
| `file_path` | ファイルへの絶対パス（必須） |
| `language` | 言語コード（`en`、`ja`、`es`など）または`auto`で自動検出。デフォルト：`en` |
| `output_format` | `timestamps`（デフォルト）、`text`、`json`、`srt`、`vtt`、`lrc`、`csv` |
| `save_to_file` | ソースファイルの隣に.txtとして保存 |
| `background` | バックグラウンドジョブとして実行 — ジョブIDを即座に返します。`check_progress`で監視。10分以上のファイルに推奨。 |
| `privacy_mode` | この呼び出しのプライバシーモードを上書き。`true` = メタデータのみ、トランスクリプトテキストを送信しない。`false` = `WHISPER_PRIVACY_MODE=true`のグローバル設定でもテキストを返す。省略するとグローバル設定を使用。 |
| `threads` | CPUスレッド数の上書き |
| `temperature` | サンプリング温度0.0〜1.0。デフォルト0.0（決定論的）。 |
| `prompt` | 事前コンテキスト文字列 — ドメイン固有の語彙や話者名の精度を向上させます。例：`"名前：Keemstar、DramaAlert"` |
| `condition_on_prev_text` | セグメント間のコンテキスト条件付けを再有効化。デフォルトfalse。 |
| `beam_size` | ビームサーチの幅。高いほど精度向上、処理速度低下。デフォルト5。 |
| `best_of` | 評価する候補シーケンス数。デフォルト5。 |
| `gpu_device` | マルチGPUシステムのGPUデバイスインデックス。デフォルト0。 |
| `processors` | 並列プロセッサ数。デフォルト1。 |
| `word_timestamps` | タイムスタンプ付き1単語ごとのセグメント出力。クリップ位置合わせに有用。 |
| `max_segment_length` | セグメントの最大文字数。 |
| `diarize` | ステレオ話者識別 — 別々のチャンネルに話者が録音されたステレオ音声が必要。 |
| `tinydiarize` | モノラルの話者交代検出 — 単一チャンネル音声で話者が変わる箇所に`[SPEAKER_TURN]`を付与します。tdrzモデルが必要：`download_model small.en-tdrz`を実行後、`switch_model ggml-small.en-tdrz.bin`。 |
| `vad_model` | Silero VADモデル.binへのパス。文字起こし前に無音を除去 — ノイズの多いファイルでのハルシネーションを軽減。 |
| `offset_t` | 開始オフセット（ミリ秒）。 |
| `duration` | オフセットからの処理時間（ミリ秒）。 |

**出力フォーマット：**
- `timestamps` — タイムスタンプ付きセグメント（例：`[00:00:01.230 --> 00:00:04.560]  テキスト`）（デフォルト）
- `text` — プレーンテキスト、タイムコードなし
- `json` — 構造化JSON（ブロッキングモードのみ）
- `srt` — ソースの隣に保存されるSubRip字幕ファイル
- `vtt` — ソースの隣に保存されるWebVTT字幕ファイル
- `lrc` — ソースの隣に保存されるLRC歌詞/カラオケフォーマット
- `csv` — ソースの隣に保存されるタイムスタンプ付きCSV

---

### `check_progress`
`transcribe_audio`（background=true）で開始したバックグラウンド文字起こしジョブを監視します。

経過時間、最後に処理されたタイムスタンプ、完了時のトランスクリプト全文を返します。

| パラメータ | 説明 |
|---|---|
| `job_id` | `transcribe_audio`が返したジョブID |
| `privacy_mode` | この確認のプライバシーモードを上書き。`true` = ジョブの開始方法に関わらずメタデータのみ。 |

---

### `start_batch`
フォルダ内の未文字起こしファイルをすべて自動順次バッチ文字起こしします。時間順（短いものから）にソートし、バックグラウンドジョブとして1つずつ処理し、各出力を検証します。各ファイルが完了するとバッチは自動的に次に進みます — ポーリング不要。

| パラメータ | 説明 |
|---|---|
| `folder_path` | フォルダへのパス（必須） |
| `language` | 言語コード。デフォルト：`en` |
| `threads` | CPUスレッド数の上書き |
| `output_format` | `timestamps`（デフォルト）または`text` |
| `privacy_mode` | プライバシーモードを上書き。バッチ開始前に1回確認が必要。全ファイルが無人で処理。トランスクリプトテキストは返されない。 |

---

### `check_batch_progress`
実行中のバッチを監視します。現在のファイルが完了すると自動的に次のファイルに進みます。全体の進捗、タイムスタンプ付きの現在ファイル、失敗したファイルを返します。

| パラメータ | 説明 |
|---|---|
| `batch_id` | `start_batch`が返したバッチID |

---

### `transcribe_batch`（インタラクティブ）
プレビューと確認を行いながら1ファイルずつ処理します。進めながらレビューしたい場合に便利です。

| パラメータ | 説明 |
|---|---|
| `folder_path` | フォルダへのパス（必須） |
| `file_index` | 処理するファイル（1始まり）。省略するとファイル一覧を表示。 |
| `language` | 言語コード。デフォルト：`en` |
| `recursive` | サブフォルダを含める |
| `output_format` | `timestamps`（デフォルト）または`text` |
| `privacy_mode` | プライバシーモードを上書き。確認が各ファイルの前に必要。メタデータのみ返される。 |

---

### `generate_subtitles`
字幕ファイルを生成します。言語自動検出と英語翻訳出力に対応。SRT（最も広い互換性）またはWebVTT（ウェブとHTML5動画）を出力します。

| パラメータ | 説明 |
|---|---|
| `file_path` | ファイルへのパス（必須） |
| `language` | 言語コードまたは`auto`で自動検出。デフォルト：`en` |
| `output_format` | `srt`（デフォルト）または`vtt` |
| `translate_to_english` | 英語翻訳字幕ファイルも生成。ソースが英語以外の場合のみ適用。 |
| `background` | バックグラウンドジョブとして実行。`check_progress`でジョブIDを使用。 |
| `threads` | CPUスレッド数の上書き |

ネイティブと翻訳の両方をリクエストした場合、ソースの隣に2つのファイルが保存されます：
- `ファイル名.ja.srt` — 原語
- `ファイル名.en.srt` — 英語翻訳

> Whisperの組み込み翻訳は**英語へのみ**対応しています。他の言語への翻訳は、字幕ファイルの内容を別途翻訳してください。

---

### `analyze_media`
文字起こし前にファイルを分析します。時間、サイズ、コーデック、推定文字起こし時間（CPUとGPU）を返します。フォルダの場合、文字起こし状態付きのソート可能な全ファイル一覧を表示します。

| パラメータ | 説明 |
|---|---|
| `path` | 単一ファイルまたはフォルダへのパス（必須） |
| `sort_by` | フォルダの場合：`duration`（デフォルト）、`name`、`size` |

---

### `check_config`
whisper-cli.exe、モデルファイル、FFmpegがすべてアクセス可能か確認します。問題が発生した場合はまずこれを実行してください。

---

### `list_models`
モデルディレクトリにインストール済みのWhisperモデルファイルを一覧表示します。ファイル名、サイズ、現在アクティブかどうか、量子化状態、推奨用途を表示します。ネットワーク接続不要 — ローカルファイルシステムのみを読み取ります。

---

### `download_model`
Hugging Faceからモデルファイルを直接モデルディレクトリにダウンロードします。信頼されたHugging Faceネームスペースからのみダウンロードします。ダウンロード後、`switch_model`でアクティベートしてください。

| パラメータ | 説明 |
|---|---|
| `model_name` | ダウンロードするモデル名（例：`large-v3-turbo`、`large-v3-turbo-q5_0`、`medium.en-q5_0`） |

---

### `switch_model`
Claude Desktopを再起動せずに現在のセッションのアクティブモデルを切り替えます。変更はセッションスコープです — 再起動後には保存されません。永続的にするには、設定の`WHISPER_MODEL`を更新してください。

| パラメータ | 説明 |
|---|---|
| `model_name` | モデルファイル名（例：`ggml-large-v3-turbo.bin`）または完全パス。設定済みモデルディレクトリ内の`.bin`ファイルである必要があります。 |

---

### `check_system`
GPUハードウェアを検出しVulkan加速が利用可能か確認します。GPU名、VRAM、`ggml-vulkan.dll`の有無を報告し、ハードウェアに最適なモデルサイズを推奨します。

---

### `whisper_server`
**永続モデルサーバー**（whisper.cppの`whisper-server`）を起動、停止、または状態確認します。実行中はアクティブモデルがVRAMに常駐し、すべての`transcribe_audio` / `transcribe_batch`呼び出しがlocalhost経由で処理され、**ファイルごとのモデル再読み込みが発生しません** — 多数の短いファイルを文字起こしする際に大きな高速化となります。この場合、一度きりのモデル読み込みコストが支配的だからです。

| パラメータ | 説明 |
|---|---|
| `action` | `start` — アクティブモデルを常駐させて起動；`stop` — 停止してVRAMを解放；`status` — 実行状態、常駐モデル、ポート、稼働時間を報告。 |

- ⚠️ **常駐モデルはサーバーの生存期間中ずっとGPU VRAMを占有します。** 意図的に起動し、作業を行い、その後`stop`してカードを共有する他のアプリケーションにGPUを返してください。停止時は完全なkillを実行するため、VRAMが実際に解放されます。
- サーバー実行中に`switch_model`を行うと、常駐モデルをその場でホットスワップします（再起動なし）。
- `127.0.0.1`のみにバインドされます — ネットワークに公開されることは一切ありません。
- サーバー起動中は、ワンショットCLIを必要とする操作 — バックグラウンドジョブ、`start_batch`、`generate_subtitles`、`lrc`/`csv`出力、およびHTTP APIが受け付けない高度なper-call オプション（`beam_size`、`best_of`、`word_timestamps`、`diarize`、`tinydiarize`、`vad_model`、`offset_t`、`duration`）— は、サイレントに無視されるのではなく「まずサーバーを停止してください」というメッセージとともに**拒否**されます。これにより2つ目のエンジンがGPUを奪い合うことは決してありません。
- `whisper-server.exe`が必要です（`whisper-cli.exe`と一緒に同梱されています）。必要に応じて`WHISPER_SERVER_PATH` / `WHISPER_SERVER_PORT`で設定してください。

---

## 対応フォーマット

| 種類 | フォーマット |
|---|---|
| ネイティブ（変換不要） | `mp3`、`wav` |
| 動画（FFmpegで自動変換） | `mp4`、`mkv`、`avi`、`mov`、`webm`、`flv`、`wmv`、`m4v`、`ts`、`3gp` |
| 音声（FFmpegで自動変換） | `m4a`、`ogg`、`flac` |

---

## GPU加速

ビルド済みVulkanリリースはGPU加速を自動で有効にします。AMD Radeon RX Vega 56（GCN第5世代）でテスト済み。Vulkan 1.0+をサポートするすべてのGPU（NVIDIAおよびIntel Arcを含む）で動作するはずです。

**パフォーマンス比較（large-v3モデル、約14分の音声ファイル）：**

| ハードウェア | 処理時間 |
|---|---|
| CPUのみ（Ryzen 7 2700x、8スレッド） | 約22分（推定） |
| GPU（Vega 56 via Vulkan） | 約3分22秒 |

文字起こし中のGPU使用率は通常15〜20%で、ファイル間はアイドル状態に戻ります。

Windows 10およびWindows 11をサポートします。Windows 11固有の設定は不要 — このツールはWin32 API呼び出しを行わず、どちらのOSでも動作します。

---

## 多言語対応

Whisperは話されている言語を自動検出し、その言語で文字起こしできます。組み込みの翻訳モデルは**英語へのみ**翻訳します。

最高の多言語精度には`large-v3`モデルを使用してください。英語専用モデル（`*.en.bin`）は他の言語を検出・文字起こしできません。

**例 — 字幕付き外国語動画：**
1. `language=auto`と`translate_to_english=true`で字幕生成を依頼
2. Whisperが言語を検出し、原語SRTまたはVTTを生成
3. 2回目のパスで英語翻訳SRTを生成
4. VLCで「字幕」→「字幕ファイルを追加」でSRTを読み込み、またはウェブプレーヤーでVTTを使用

---

## プライバシーとコンプライアンス

whisper-windows-mcpには機密および規制対象コンテンツ向けの組み込みプライバシーアーキテクチャが含まれています。

**音声・動画はマシンの外に出ません。** この保証は無条件です。

**トランスクリプトテキスト**は異なります — ツールレスポンスにインラインで返される場合、ClaudeのAPIで処理されます。ほとんどのユーザーにとってこれは想定内の動作です。規制対象コンテンツ（医療、法律、財務、企業）には、プライバシーモードがこれを防ぎます。

**プライバシーモード**はすべてのツールレスポンスをメタデータのみ（ファイル名、単語数、保存パス）に制限します。いかなる状況でもトランスクリプトテキストはClaudeのAPIに送信されません。任意の文字起こしツールで`privacy_mode=true`を使用してper-callで有効化するか、設定の`WHISPER_PRIVACY_MODE=true`でグローバルに有効化します。

**同意ゲート** — セッションの最初の使用時（標準モード）、トランスクリプトテキストが返される前に完全なプライバシー開示が表示されます。続行前に明示的に確認する必要があります。機密性のないコンテンツにはこれをスキップするために設定に`WHISPER_CONSENT_ACKNOWLEDGED=true`を設定してください。

コンプライアンスガイダンス（HIPAA、GDPR、弁護士・依頼者特権、FERPA、SOX、PCI-DSS）については[PRIVACY.md](PRIVACY.md)を参照してください。

---

## フリープランユーザー向け設計

このツールはClaude APIとのやり取りを最小限に抑えるよう設計されています。文字起こしワークフロー全体（スキャン、分析、キュー管理、実行、検証）は、できるだけ少ないClaude操作で完了できるよう設計されています。重い処理はすべてローカルマシンで実行されます。

---

## オプションの環境変数

| 変数 | 説明 |
|---|---|
| `WHISPER_CLI_PATH` | whisper-cli.exeへのパス（必須） |
| `WHISPER_MODEL` | モデル.binファイルへのパス（必須） |
| `WHISPER_THREADS` | CPUスレッド数の上書き |
| `WHISPER_GPU_DEVICE` | マルチGPUシステムで文字起こしを固定するVulkanデバイスのインデックス（VulkanのenumerationインデックスでありWindowsのGPU順序ではありません — whisper-cliの起動ログを確認してください）。per-callで`gpu_device`により上書き可能。[TROUBLESHOOTING.md](TROUBLESHOOTING.md)を参照。 |
| `WHISPER_FOREGROUND_MAX_SEC` | フォアグラウンド文字起こしの上限秒数（デフォルト210）。これより長く実行されると推定されるファイルは、Claude Desktopの約4分のツールタイムアウトのリスクを冒す代わりにバックグラウンドモードにルーティングされます。 |
| `FFMPEG_PATH` | ffmpegがシステムPATHにない場合のパス |
| `WHISPER_SERVER_PATH` | 永続モデルサーバー用の`whisper-server.exe`へのパス（デフォルト：`whisper-cli.exe`と同じ場所）。`whisper_server`ツールを参照。 |
| `WHISPER_SERVER_PORT` | 永続モデルサーバーのlocalhostポート（デフォルト8571）。常に`127.0.0.1`にバインドされます。 |
| `WHISPER_PRIVACY_MODE` | `true`の場合、すべてのツールレスポンスはメタデータのみを返し、トランスクリプトテキストはClaudeのAPIに送信されません。規制対象または機密性の高いコンテンツに使用します。per-callで`privacy_mode`パラメータを使用して上書き可能。[PRIVACY.md](PRIVACY.md)を参照。 |
| `WHISPER_CONSENT_ACKNOWLEDGED` | `true`の場合、トランスクリプトテキストが返される前の一回限りのセッション同意開示をスキップします。プライバシーの境界を理解し、リマインダーが不要になったら設定してください。プライバシーモードが有効な場合には効果がありません。 |

---

## セキュリティ

**バイナリ検証。** ビルド済みリリースのwhisper-cli.exeバイナリの整合性を確認するには、PowerShellでSHA256ハッシュを確認してください：

```powershell
Get-FileHash "C:\whisper\Release\whisper-cli.exe" -Algorithm SHA256
```

v1.4.0リリースバイナリの期待されるハッシュは[リリースページ](https://github.com/eviscerations/whisper-windows-mcp/releases/tag/v1.4.0)に記載されています。

**入力検証。** すべてのファイルパスとフォルダパスは、それらを受け取るすべてのツールで使用前に検証されます — UNCパス（`\\server\share`）とディレクトリトラバーサル（`..`）は拒否されます。10GBを超えるファイルはリソース枯渇を防ぐために拒否されます。`job_id`と`batch_id`は、いかなるファイルパスの構築に使用される前にも、サーバーが生成する正確な形式と照合されるため、細工されたIDでjobsディレクトリの外へトラバースすることはできません。

**トランスクリプトインジェクション対応。** 音声ファイルには、文字起こし時に指示のように見える内容が含まれる場合があります。Claudeの組み込み防御がこれを処理しますが、MCPサーバー自体はトランスクリプトの内容をデータとして扱い、指示として解釈しないことを知っておく価値があります。文字起こしされた内容がClaudeが次にどのツールを呼び出すかに影響を与える可能性があるため、シングルユーザーの前提のみに頼るのではなく、パス/ID検証を防御的に適用しています。

**モデルダウンロードの制限。** `download_model`ツールは信頼された2つのHugging Faceネームスペース（`ggerganov/whisper.cpp`と`ggml-org`）からのみダウンロードします。任意のURLは拒否されます。リダイレクトはフォロー前にアローリストで検証されます。（ダウンロードはまだモデルごとのSHA256ダイジェストで検証されていません — SECURITY.mdを参照。）

**モデル選択のサンドボックス化。** `switch_model`と`transcribe_audio`の`model`上書きの両方は、設定済みモデルディレクトリ内の`.bin`ファイルのみを受け付けます。そのディレクトリ外のパスは、正規化されたパス封じ込めによって拒否されます。

**PATHシャドウイングなし。** サーバーがユーザーに代わって呼び出すシステムバイナリ（`tasklist`、`wmic`）は、絶対`System32`パスで呼び出されるため、`PATH`上でより早い位置にある同名の実行ファイルによってシャドウイングされることはありません。

完全なセキュリティポリシーについては[SECURITY.md](SECURITY.md)を参照してください。

---

## トラブルシューティング

詳細な解決策については[TROUBLESHOOTING.md](TROUBLESHOOTING.md)を参照してください。規制対象コンテンツを扱う場合はコンプライアンスガイダンスとして[PRIVACY.md](PRIVACY.md)も参照してください。

クイックチェックリスト：
- 設定のパスに**バックスラッシュを2つ**使用している（`C:\\whisper\\...`）
- `whisper-cli.exe`が設定されたパスに存在する
- モデル`.bin`ファイルが設定されたパスに存在する
- FFmpegがインストールされPATHに含まれている（`ffmpeg -version`が動作する）
- 設定編集後にClaude Desktopを完全に再起動した
- 設定 → 開発者でwhisperが**実行中**（緑色バッジ）で表示されている

---

## ライセンス

**非商用利用：** MIT — 個人・教育・非商用目的での利用は無償で自由に使用できます。[LICENSE](LICENSE)をご参照ください。

**商用利用：** ビジネス・業務・収益を生む用途での利用には、別途商用ライセンス契約が必要です。条件と連絡先については[COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md)をご参照ください。

## コントリビュート

プルリクエスト歓迎です。[ROADMAP.md](ROADMAP.md)で計画中の機能を確認してください。

上記以外のハードウェアでGPU加速をテストした方は、GPU型番、VRAM、モデルサイズ、確認したスループットをIssueで報告してください。
