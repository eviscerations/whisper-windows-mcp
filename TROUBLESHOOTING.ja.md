# whisper-windows-mcp — トラブルシューティング

---

## 簡易チェックリスト

詳しい調査の前に、以下をすべて確認してください：

- `claude_desktop_config.json`のパスに**バックスラッシュを2つ**使用している（`C:\\whisper\\...`）
- `WHISPER_CLI_PATH`に指定したパスに`whisper-cli.exe`が存在する
- `WHISPER_MODEL`に指定したパスにモデル`.bin`ファイルが存在する
- FFmpegがインストールされPATHが通っている（コマンドプロンプトで`ffmpeg -version`が動作する）
- 設定ファイル編集後にClaude Desktopを**完全に再起動**した（システムトレイから終了）
- 設定 → 開発者でwhisperが緑色の**実行中**バッジで表示されている

---

## 「whisperに接続できない」またはツールが表示されない

**最も多い原因：** 設定ファイル編集後にClaude Desktopを完全に再起動していない。

1. システムトレイのClaudeアイコンを右クリック → 終了
2. Claude Desktopを再起動
3. 設定 → 開発者でwhisperの緑色の**実行中**バッジを確認

それでも表示されない場合：

1. `claude_desktop_config.json`のJSON構文エラーを確認（カンマの漏れ、括弧の不一致など）
2. すべてのパスでバックスラッシュを2つ使用していることを確認
3. Claude Desktopで`check_config`（設定確認）を実行して診断情報を取得

---

## `check_config`がwhisper-cli.exeを見つけられない

設定のパスが実際のファイルの場所と一致していません。

ファイルの存在を確認：
```
dir C:\whisper\Release\whisper-cli.exe
```

別の場所にある場合は、設定の`WHISPER_CLI_PATH`を実際のパスに更新してください。

---

## `check_config`がFFmpegを見つけられない

FFmpegがインストールされていないか、システムPATHに含まれていません。

wingetでインストール：
```
winget install ffmpeg
```

または[ffmpeg.org](https://ffmpeg.org/download.html)からダウンロードして、`bin`フォルダをシステムPATHに追加してください。

インストール後、新しいコマンドプロンプトで確認：
```
ffmpeg -version
```

FFmpegを標準以外の場所にインストールした場合は、Claude Desktop設定で`FFMPEG_PATH`環境変数を設定してください：
```json
"env": {
  "FFMPEG_PATH": "C:\\ffmpeg\\bin\\ffmpeg.exe"
}
```

---

## 文字起こし結果が`[FOREIGN]`タグばかりになる

**原因：** 英語専用モデル（例：`ggml-medium.en.bin`）を英語以外の音声に使用しています。英語専用モデルは他の言語を処理できず、認識できないすべてのセグメントに`[FOREIGN]`を出力します。

**修正方法：** `ggml-large-v3.bin`（多言語モデル）をダウンロードして使用してください。英語以外の文字起こし、言語自動検出、翻訳にはこのモデルが必要です。

```
https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin
```

`C:\whisper\models\`に保存して設定を更新：
```json
"WHISPER_MODEL": "C:\\whisper\\models\\ggml-large-v3.bin"
```

> **注意：** 英語専用モデル（`*.en.bin`）は英語コンテンツでは速く精度が高いですが、他の言語は一切処理できません。多言語コンテンツを扱う場合は、ハードウェアに関わらず`large-v3`が正しいモデルです。

---

## ファイル名にUnicodeや特殊文字が含まれる場合のバックグラウンドジョブの失敗

**原因：** パスに日本語・中国語・絵文字・括弧などのUnicode文字や特殊文字が含まれる場合、whisper-cli.exeが出力ファイルを書き込めません。

**現在の回避方法：** 文字起こし前にファイル名をASCII文字のみに変更してください。

```
ren "日本語ファイル名.mp4" "temp_transcribe.mp4"
```

**状況：** 既知のバグです。出力をサニタイズされた一時パスに書き込んでから正しい場所に移動する修正を計画中です。

---

## バックグラウンドジョブが失敗して出力がない

**考えられる原因：**

1. **Unicodeファイル名** — 上記参照。
2. **モデルパスが間違っている** — `check_config`でパスを確認してください。
3. **プロセスが強制終了された** — 処理中にwhisper-cli.exeを強制終了すると出力ファイルが存在しません。再実行してください。
4. **VRAMが不足している** — より小さいモデルを試してください。

---

## バックグラウンドモードでSRT出力が作成されない

**原因：** バックグラウンドモード（`transcribe_audio`の`background=true`）は現在`.txt`出力のみに対応しています。

**回避方法：** 約4分未満のファイルには`generate_subtitles`をブロッキングモードで使用してください。長いファイルの場合は、先にバックグラウンドモードで`.txt`を作成してから、同じファイルで`generate_subtitles`を実行してください（再度文字起こしが行われます）。

**状況：** バックグラウンドモードでのSRT対応は将来のリリースで予定されています。

---

## GPUが使用されていない（CPUが50%以上で高負荷）

**原因：** 標準のwhisper.cppリリースに付属するCPU専用バイナリを使用しています。

**修正方法：** [リリースページ](https://github.com/eviscerations/whisper-windows-mcp/releases/tag/v1.4.0)からVulkan対応ビルドをダウンロードして`C:\whisper\Release\`に展開してください。

GPU加速の確認方法：
- `check_system`（システム確認）を実行
- `✅ Vulkan binary: ggml-vulkan.dll found`が表示されることを確認
- 文字起こし中にタスクマネージャー → パフォーマンス → GPUでGPU使用率が15〜30%に上昇することを確認

---

## `check_system`のVRAM表示が実際と異なる

Windowsの既知の制限です。`wmic`コマンドはレジストリからVRAMを読み取りますが、多くのAMDカードでは物理VRAMの半分の値が表示されます。これは表示の問題のみで、whisperは実際の物理VRAMを完全に使用します。

---

## 「文字起こしが既に進行中」エラー

前のジョブの`whisper-cli.exe`プロセスが実行中です。完了を待つか：

1. タスクマネージャー → 詳細タブ
2. `whisper-cli.exe`を見つける
3. 右クリック → タスクの終了

その後、再試行してください。

---

## 言語自動検出が間違っている

Whisperの自動検出は音声の最初の30秒で行われます。ファイルの最初がコンテンツの大部分と異なる言語の場合、検出が間違う可能性があります。

**修正方法：** 自動検出に頼らず、言語を明示的に指定してください（例：`language=ja`）。

---

## 字幕生成が全編「（外国語で話しています）」になる

Whisperが音声を検出したが文字起こしできていません。最も多い原因：

1. **間違ったモデル** — 英語専用モデルを英語以外の音声に使用。`large-v3`を使用してください。
2. **音声品質** — 雑音のある環境（厨房、群衆、反響）はmediumモデルでは難しい場合があります。`large-v3`を試してください。
3. **混合言語** — 2つの言語が交互に話されるファイルは、単一言語設定では少数派の言語がプレースホルダーになります。

---

## 字幕翻訳が英語にしか対応していない

これは仕様です。Whisperの組み込み`--translate`フラグは**英語へのみ**翻訳します。他の言語への翻訳は、生成された`.srt`ファイルを別途翻訳ツールで処理してください。

---

## 設定ファイルの場所

```
C:\Users\ユーザー名\AppData\Roaming\Claude\claude_desktop_config.json
```

`AppData`が表示されない場合：エクスプローラーで「表示」→「隠しファイル」を有効にしてください。

---

## 完全な設定例

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

`FFMPEG_PATH`のデフォルトは`ffmpeg`（PATHにあることを前提）です。FFmpegが標準以外の場所にインストールされている場合のみ明示的に設定してください。
