# whisper-windows-mcp

Windows向けのMCP（Model Context Protocol）サーバーです。[whisper.cpp](https://github.com/ggml-org/whisper.cpp)を使用して、Claude Desktopで音声・動画ファイルをローカルで文字起こしできます。GPU加速、多言語対応、バッチ処理に対応しています。インターネット接続不要。音声データは一切外部に送信されません。

> **なぜこのツールが存在するか**
> 人気のある`whisper-mcp`パッケージはmacOS向けに作られており、Unix環境を前提としています。Windowsでは動作しません。このパッケージは、Claude DesktopでローカルAI文字起こしを使いたいWindowsユーザーのために作られました。

---

## できること

インストール後、Claude Desktopで以下のように話しかけるだけで使えます：

- *「C:\Users\Me\Downloads\meeting.mp3を文字起こしして」*
- *「このフォルダの録音ファイルをすべて文字起こしして、テキストファイルに保存して」*
- *「この動画の日本語と英語の字幕ファイルを作って」*
- *「このフォルダのファイルをすべてバッチ文字起こしして」*
- *「これらのファイルの文字起こしにどれくらいかかる？」*
- *「GPU加速が有効かどうか確認して」*

---

## 必要なもの

1. **Node.js 18以降** — [nodejs.org](https://nodejs.org)
2. **Vulkan GPU対応のwhisper.cppバイナリ** — ステップ1参照
3. **Whisperモデルファイル** — ステップ2参照
4. **FFmpeg** — 動画ファイルやWAV/MP3以外の音声形式に必要

---

## ステップ1 — whisper.cppバイナリのインストール

### オプションA — ビルド済みVulkanリリース（推奨）

[リリースページ](https://github.com/eviscerations/whisper-windows-mcp/releases/tag/v1.4.0)から`whisper-vulkan-win-x64.zip`をダウンロードしてください。

これは**Vulkan GPU加速**を有効にしてカスタムコンパイルされたビルドです。AMD、NVIDIA、Intel GPUで動作します。ベンダー固有のSDKは不要です。

`C:\whisper\Release\`に展開してください。以下のファイルが揃っていることを確認してください：

```
C:\whisper\Release\whisper-cli.exe
C:\whisper\Release\ggml-vulkan.dll
C:\whisper\Release\ggml.dll
C:\whisper\Release\ggml-base.dll
C:\whisper\Release\ggml-cpu.dll
C:\whisper\Release\whisper.dll
```

GPU加速は自動的に有効になります。追加設定は不要です。

### オプションB — ソースからビルド

必要なもの：Git、CMake、「C++によるデスクトップ開発」ワークロードを含むVisual Studio Build Tools 2022以降、[lunarg.com](https://vulkan.lunarg.com/sdk/home#windows)のVulkan SDK。

```
git clone https://github.com/ggml-org/whisper.cpp
cd whisper.cpp
cmake -B build -DGGML_VULKAN=ON -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release --target whisper-cli
```

`build\bin\Release\`のバイナリを`C:\whisper\Release\`にコピーしてください。

> **注意：** GitHub上の公式whisper.cpp WindowsリリースにはVulkanビルドが含まれていません。上記のビルド済みリリースを使用するか、`-DGGML_VULKAN=ON`でソースからビルドしてください。

---

## ステップ2 — Whisperモデルのダウンロード

| モデル | サイズ | 速度 | 精度 | 用途 |
|---|---|---|---|---|
| `ggml-tiny.en.bin` | 75 MB | 非常に速い | 基本 | 動作確認用 |
| `ggml-base.en.bin` | 142 MB | 速い | 良い | 日常的な英語 |
| `ggml-small.en.bin` | 466 MB | 普通 | より良い | 重要な録音 |
| `ggml-medium.en.bin` | 1.5 GB | GPU使用時は速い | 非常に良い | 高品質な英語 |
| `ggml-large-v3.bin` | 2.9 GB | GPU使用時は速い | 最高 | 多言語・最高精度 |

**英語のみ**の場合：`base.en`または`medium.en`がおすすめです。
**多言語対応**（自動検出、外国語、翻訳）の場合：最良の結果を得るには`large-v3`を使用してください。

Hugging Faceからダウンロード：
```
https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.en.bin
```

`C:\whisper\models\`に保存してください。

---

## ステップ3 — FFmpegのインストール

動画ファイルやネイティブ以外の音声形式に必要です。

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

Claude Desktop → 設定 → 開発者 → 設定ファイルを編集 を開いてください。

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

> パスには必ず**バックスラッシュを2つ**使用してください（`C:\\whisper\\...`）。

保存後、Claude Desktopを**完全に再起動**してください。設定 → 開発者に**whisper**が緑色の実行中バッジで表示されれば成功です。

---

## ステップ6 — 動作確認

Claude Desktopで以下を入力してください：

> *「whisperの設定を確認して」*

次に：

> *「システムのハードウェアを確認して」*

GPUが検出され、Vulkan加速が有効であることを確認できます。

---

## 利用可能なツール

### `transcribe_audio`（音声文字起こし）
単一ファイルを文字起こしします。ブロッキング（デフォルト）またはバックグラウンドモードに対応。

| パラメータ | 説明 |
|---|---|
| `file_path` | ファイルの絶対パス（必須） |
| `language` | 言語コード（`en`、`ja`、`es`など）または`auto`で自動検出。デフォルト：`en` |
| `output_format` | `text`（デフォルト）、`timestamps`、`json`、`srt` |
| `save_to_file` | ソースファイルの隣に.txtとして保存 |
| `background` | バックグラウンドジョブとして実行し、ジョブIDをすぐに返す。10分超のファイルに推奨。`check_progress`で監視。 |
| `threads` | CPUスレッド数の上書き |

---

### `check_progress`（進捗確認）
`transcribe_audio`（background=true）で開始したジョブを監視します。経過時間、最後に処理したタイムスタンプ、完了時の文字起こし全文を返します。

---

### `start_batch`（バッチ開始）
フォルダ内の未文字起こしファイルを自動的に順次文字起こしします。時間順（短い順）にソートし、バックグラウンドジョブとして1つずつ処理し、各出力を検証します。

---

### `check_batch_progress`（バッチ進捗確認）
実行中のバッチを監視します。現在のファイルが完了すると自動的に次のファイルに進みます。全体の進捗、現在のファイルとタイムスタンプ、失敗したファイルを返します。

---

### `transcribe_batch`（インタラクティブバッチ）
1ファイルずつプレビューと確認を挟みながら処理します。進行状況を確認しながら作業したい場合に便利です。

---

### `generate_subtitles`（字幕生成）
SRT字幕ファイルを生成します。言語自動検出と英語翻訳出力に対応。

| パラメータ | 説明 |
|---|---|
| `file_path` | ファイルのパス（必須） |
| `language` | 言語コードまたは`auto`で自動検出。デフォルト：`en` |
| `translate_to_english` | 英語翻訳の`.en.srt`も生成する。ソースが英語でない場合のみ適用。 |
| `threads` | CPUスレッド数の上書き |

ネイティブと翻訳の両方を要求した場合、2つのファイルが保存されます：
- `ファイル名.ja.srt` — 元の言語
- `ファイル名.en.srt` — 英語翻訳

> whisperの組み込み翻訳は**英語へのみ**翻訳できます。他の言語への翻訳には別途翻訳ツールが必要です。

---

### `analyze_media`（メディア分析）
文字起こし前にファイルを分析します。時間、サイズ、コーデック、CPUとGPUでの推定文字起こし時間を返します。フォルダの場合は、すべてのファイルをテーブル形式で表示します。

---

### `check_config`（設定確認）
whisper-cli.exe、モデルファイル、FFmpegがすべてアクセス可能かを確認します。問題が発生した場合はまずこれを実行してください。

---

### `check_system`（システム確認）
GPUハードウェアを検出し、Vulkan加速が利用可能かを確認します。GPU名、VRAM、`ggml-vulkan.dll`の有無、ハードウェアに適したモデルサイズを報告します。

---

## 対応フォーマット

| 種類 | フォーマット |
|---|---|
| ネイティブ（変換不要） | `mp3`、`wav` |
| 動画（FFmpegで自動変換） | `mp4`、`mkv`、`avi`、`mov`、`webm`、`flv`、`wmv`、`m4v`、`ts`、`3gp` |
| 音声（FFmpegで自動変換） | `m4a`、`ogg`、`flac` |

---

## GPU加速

ビルド済みVulkanリリースにより、GPU加速が自動的に有効になります。AMD Radeon RX Vega 56（GCN第5世代）で動作確認済み。Vulkan 1.0以上をサポートするGPU（NVIDIA、Intel Arcを含む）であれば動作するはずです。

**パフォーマンス比較（medium.enモデル、約5分の音声ファイル）：**

| ハードウェア | 処理時間 |
|---|---|
| CPUのみ（Ryzen 7 2700x、8スレッド） | 8〜12分 |
| GPU（Vega 56、Vulkan経由） | 20〜40秒 |

文字起こし中のGPU使用率は約15〜20%。ファイル間はアイドル状態に戻ります。

---

## 多言語対応

Whisperは話されている言語を自動検出し、その言語で文字起こしができます。組み込みの翻訳モデルは**英語へのみ**翻訳します。

最良の多言語精度を得るには`large-v3`モデルを使用してください。英語専用モデル（`*.en.bin`）は他の言語を検出・文字起こしできません。

**外国語動画の字幕作成の例：**
1. `language=auto`と`translate_to_english=true`で字幕生成を依頼
2. Whisperが言語を検出し、元の言語のSRTを生成
3. 2回目のパスで英語翻訳SRTを生成
4. VLCで「字幕」→「字幕ファイルを追加」からどちらのファイルも読み込み可能

---

## フリープランユーザー向け設計

このツールはClaude APIの呼び出し回数を最小限に抑えるように設計されています。スキャン、分析、キュー管理、実行、検証を含む文字起こしワークフロー全体で、60ファイルのバッチ処理に必要なClaude操作は20回以下を目標としています。

---

## 環境変数（オプション）

| 変数 | 説明 |
|---|---|
| `WHISPER_CLI_PATH` | whisper-cli.exeのパス（必須） |
| `WHISPER_MODEL` | モデル.binファイルのパス（必須） |
| `WHISPER_THREADS` | CPUスレッド数の上書き |
| `FFMPEG_PATH` | ffmpegがPATHにない場合のパス |

---

## トラブルシューティング

詳細は[TROUBLESHOOTING.md](TROUBLESHOOTING.md)（英語）をご覧ください。

簡易チェックリスト：
- 設定のパスには**バックスラッシュを2つ**使用（`C:\\whisper\\...`）
- 設定したパスに`whisper-cli.exe`が存在する
- 設定したパスにモデル`.bin`ファイルが存在する
- FFmpegがインストールされPATHが通っている（`ffmpeg -version`が動作する）
- 設定変更後にClaude Desktopを完全に再起動した
- 設定 → 開発者でwhisperが**実行中**と表示されている

---

## ライセンス

MIT

---

## コントリビュート

プルリクエスト歓迎です。計画中の機能については[ROADMAP.md](ROADMAP.md)をご覧ください。

上記以外のハードウェアでGPU加速をテストした方は、GPU型番、VRAM、使用モデル、確認したスループットをIssueで報告してください。
