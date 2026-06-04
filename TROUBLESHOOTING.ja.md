# トラブルシューティング — whisper-windows-mcp

---

## 簡易チェックリスト

詳しい調査の前に、以下をすべて確認してください：

- `claude_desktop_config.json`のパスに**バックスラッシュを2つ**使用している（`C:\\whisper\\Release\\whisper-cli.exe`）
- `WHISPER_CLI_PATH`に指定したパスに`whisper-cli.exe`が存在する
- `WHISPER_MODEL`に指定したパスにモデル`.bin`ファイルが存在する
- FFmpegがインストールされPATHが通っている（ターミナルで`ffmpeg -version`が動作する）
- 設定ファイル編集後にClaude Desktopを**完全に再起動**した（システムトレイから終了、ウィンドウを閉じるだけではない）
- 設定 → 開発者でwhisperが**緑色の実行中バッジ**で表示されている

---

## インストールと起動

### Claude Desktop → 設定 → 開発者にWhisperが表示されない

1. Claude Desktop → 設定 → 開発者 → 設定を編集を開く
2. JSONが有効であることを確認 — 不明な場合は[jsonlint.com](https://jsonlint.com)に貼り付けて確認
3. `WHISPER_CLI_PATH`と`WHISPER_MODEL`が実際に存在するファイルを指していることを確認
4. システムトレイからClaude Desktopを終了（トレイアイコンを右クリック → 終了）
5. Claude Desktopを再起動して再確認

Whisperは表示されているがエラーバッジが表示されている場合：
- Claudeに*「whisperの設定を確認して」*と聞く — `check_config`ツールが具体的なエラーメッセージを返す
- Claude Desktop → 設定 → 開発者 → サーバー名をクリックしてエラーログを確認

### 「whisper-cli.exeが見つからない」エラー

`WHISPER_CLI_PATH`のパスがバイナリの実際の場所と一致していません。

デフォルトの期待パス：`C:\whisper\Release\whisper-cli.exe`

ファイルの存在を確認：
```powershell
Test-Path "C:\whisper\Release\whisper-cli.exe"
```

`True`が返されるべきです。`False`が返された場合は、リリースzipを`C:\whisper\Release\`に展開するか、設定の`WHISPER_CLI_PATH`を実際の場所に合わせて更新してください。

### 「モデルが見つからない」エラー

`WHISPER_MODEL`のパスが実際のモデルファイルの場所または名前と一致していません。

モデルディレクトリを確認：
```powershell
Get-ChildItem "C:\whisper\models\"
```

量子化サフィックスを含む完全なファイル名が必要です（例：`ggml-large-v3-turbo-q5_0.bin`、`ggml-large-v3-turbo.bin`ではない）。モデルがインストールされていない場合は、Claude Desktopで`download_model`を使用してください。

---

## GPU加速

### 文字起こしが遅い — CPUのみ、GPUを使用していない

Claudeに*「システムハードウェアを確認して」*と聞く

`check_system`ツールがwhisperバイナリディレクトリに`ggml-vulkan.dll`が存在するかどうかを確認します。DLLが見つからない場合は、GPUに関わらずCPUのみで動作しています。

**修正方法：** [リリースページ](https://github.com/eviscerations/whisper-windows-mcp/releases/tag/v1.4.0)から`whisper-vulkan-win-x64.zip`をダウンロードして`C:\whisper\Release\`に展開してください。zipにはDLLが含まれています — `whisper-cli.exe`と同じディレクトリに置く必要があります。

### GPUが検出されているが文字起こし中の使用率が0%

バイナリは動作しているがGPUにディスパッチされていません。通常の原因：
- Vulkan SDKがインストールされていないか、GPUドライバーがVulkanインターフェースを公開していない
- GPUがVulkan 1.0より古い（まれ — 2016年以降のほとんどのGPUはサポート）

Vulkanサポートを確認：
```powershell
vulkaninfo
```

出力があればVulkanが利用可能です。`vulkaninfo`が失敗する場合は、GPUベンダーのサイトから最新のGPUドライバーをインストールしてください。

### VRAMが実際のサイズの半分として報告される（AMD）

AMDのGPUでの既知のWindowsの報告上の問題です。実際の処理に使用可能なVRAMは`wmic`が報告する値の通常2倍です。モデルの推奨が過度に保守的になる場合があります — 推奨より大きなモデルを試して文字起こしが正常に完了するか確認できます。

---

## 文字起こし品質

### 出力に幻覚テキストや繰り返しフレーズが含まれる

Whisperは無音または低品質の音声セグメントで幻覚を起こすことがあります。ツールはデフォルトで`--max-context 0`と`--no-speech-thold 0.6`を適用してこれを最小化しています。

追加のアプローチ：
- `temperature=0.2`を使用 — わずかなランダム性がノイズの多い音声での幻覚ループを解消するのに役立つ
- VAD（音声活動検出）モデルを使用：Silero VADモデルの`.bin`ファイルをダウンロードして`vad_model`としてパスを渡す。これが無音区間のある録音での幻覚に対して最も効果的な修正
- より大きなモデル（`large-v3`または`large-v3-turbo`）を使用 — 小さいモデルは難しい音声でより多く幻覚する
- `prompt`でコンテキストを設定：*「これはソフトウェアエンジニアリングについてのポッドキャストインタビューです。」*

### 文字起こし出力が空またはとても短い

Claudeに*「このファイルを分析して」*（`analyze_media`）と聞き、ファイルに音声コンテンツがあり認識されたフォーマットであることを確認してください。

FFprobeが音声を報告しているが文字起こしが何も生成しない場合：
- ファイルが設定された`language`パラメーターと一致しない言語である可能性がある
- `language=auto`を試してWhisperに言語を検出させる
- 音声が小さすぎるか過度に処理されている可能性がある — 文字起こしには聞き取れる音声が必要

### タイムスタンプモードの出力がSRTと異なる

`timestamps`モードでは、出力はwhisperのstdoutにプレーンな`[HH:MM:SS.mmm --> HH:MM:SS.mmm]  テキスト`の行として出力されます。`srt`モードでは、whisperは番号付きSRTブロックとしてフォーマットします。2つのパスが異なる出力フラグを使用するため、セグメントの境界が若干異なる場合があります。どちらも有効です — 字幕ファイル形式が必要な場合は`srt`または`vtt`を、生のタイムスタンプ付きテキストが必要な場合は`timestamps`を使用してください。

---

## プライバシーモードと同意ゲート

### 文字起こし前に同意プロンプトが表示されない

同意ゲートは標準モードで**セッションに1回**表示されます。このセッション（最後のClaude Desktop再起動以降）で既に文字起こしを確認した場合は、再度表示されません。

ゲートが表示されない他の理由：
- 設定に`WHISPER_CONSENT_ACKNOWLEDGED=true`が設定されている — これはゲートを完全に抑制する
- `WHISPER_PRIVACY_MODE=true`が設定されている — プライバシーモードは同意ゲートではなく独自の操作ごとのゲートを使用する
- 既に完了したブロッキング文字起こしの進捗を確認している — ゲートはジョブ開始時に消費された

**ゲートを再度表示するには：** Claude Desktopを完全に再起動してください（システムトレイから終了して再起動）。

### Claudeが確認なしにファイルを処理している

設定に`WHISPER_CONSENT_ACKNOWLEDGED=true`がある場合、ゲートは意図的に抑制されています。プライバシーへの影響を確認済みでリマインダーが不要なユーザーへの意図した動作です。

設定されていないのにClaudeが確認なしに進んだ場合、セッションゲートは同じセッション内の以前の文字起こしで消費されています。ゲートはセッションに1回表示されます。

セッション状態に関わらずすべての文字起こしで操作ごとの確認が必要な場合は、プライバシーモードを有効にしてください：`privacy_mode=true`を渡すか、設定に`WHISPER_PRIVACY_MODE=true`を設定してください。

### プライバシーモードが有効だが1つのトランスクリプトを読みたい

その特定の呼び出しに対して`privacy_mode=false`を文字起こしツールに直接渡してください。これはその1回の呼び出しに対してのみグローバルの`WHISPER_PRIVACY_MODE=true`設定を上書きします：

- *「このファイルを文字起こしして、privacy_mode=false」*

再起動は不要です。上書きはその単一のツール呼び出しにのみ適用されます。

### プライバシーモードがすべてのファイルの前に確認を求める

これは正しい意図された動作です。プライバシーモードは操作ごとの同意が必要です — ゲートはすべての文字起こし前に表示され、プライバシーモードが有効な間はバイパスできません。

多くのファイルをper-fileの確認なしに文字起こしする必要があり、コンテンツが機密でない場合は、プライバシーモードを無効にしてください：
- 設定から`WHISPER_PRIVACY_MODE=true`を削除してClaude Desktopを再起動
- または特定の機密でないファイルに対してper-callで`privacy_mode=false`を渡す

### プライバシーモードは毎回確認するのに同意ゲートは1回だけなのはなぜ？

2つのゲートは異なる要件を持つ異なるユーザーに対応しています。

**同意ゲート**（標準モード）は一回限りの情報開示です。トランスクリプトテキストがClaudeのAPIに送信されることを理解したら、このセッション中に再度知らされる必要はありません。

**プライバシーモードゲート**は毎回表示されます。これを必要とする人々 — 医療提供者、弁護士、金融の専門家 — はコンプライアンスワークフローの一環として操作ごとの肯定的な確認が必要だからです。抑制することは目的を損ないます。

### バックグラウンドジョブと同意ゲート

標準モードでのバックグラウンド文字起こし（`background=true`）では、同意ゲートはジョブ開始時の`transcribe_audio`ではなく、トランスクリプトが返される`check_progress`完了時に表示されます。ジョブ開始時点では、トランスクリプトはまだ存在しません。ジョブ開始前にゲートを表示すると、音声処理を不必要にブロックすることになります。ゲートはトランスクリプトテキストが初めてAPIに返される瞬間に表示されます。

プライバシーモードのバックグラウンドジョブでは、ゲートはスポーン**前**に表示されます — 音声処理が始まる前です。

### 同意ゲートを永続的にスキップするには？

`claude_desktop_config.json`のenv セクションに`WHISPER_CONSENT_ACKNOWLEDGED=true`を設定してください。これは標準モードでの一回限りのセッション開示を抑制します。

注意：プライバシーモードが有効な場合には効果がありません。

---

## バックグラウンド文字起こしとバッチ

### バックグラウンドジョブが完了として表示されない

ジョブ状態はwhisper-cli.exeプロセスの終了によって追跡されます。確認：

1. Claudeに*「job_idの進捗を確認して」*と聞く — プロセスがまだ実行中の場合、ツールは経過時間と最後のセグメントタイムスタンプとともに「処理中」を返す
2. ファイルが非常に長い場合（2時間以上）、より多くの時間を確保してください — ミッドレンジGPUでの2時間ファイルのGPU文字起こしには約15〜20分かかる
3. 経過時間がおかしいと思われる場合は、タスクマネージャー → 詳細を開いて`whisper-cli.exe`がリストにあるか確認

`whisper-cli.exe`が実行中でないのに`check_progress`が「処理中」を表示している場合：
- プロセスがエラーで終了し、出力ファイルが存在しない
- Claudeに*「job_idの進捗を確認して」*と聞く — ツールがPIDなし・出力ファイルなしを検出して最後のログ行とともにエラーを報告する

### バックグラウンドジョブが完了したが出力ファイルが見つからないまたは間違った場所にある

バックグラウンドジョブは処理中に`%TEMP%\whisper-mcp-jobs\`の一時パスに出力を書き込み、完了時にソースディレクトリにファイルを移動します。移動が失敗した場合（ディスク容量不足、権限の問題、またはパスの長さ）、`check_progress`は具体的なエラーを返します：

> 「出力ファイルの書き込みに失敗しました。文字起こしは完了しましたが、次のパスに書き込めませんでした：[パス]」

確認：
- ソースディレクトリが存在し書き込み可能であること
- 十分なディスクスペースがあること
- ターゲットパスが長すぎないこと（Windowsのデフォルトのパス長制限は260文字）

生の出力がジョブIDベースのファイル名で`%TEMP%\whisper-mcp-jobs\`にまだ残っている可能性があります。

### バッチが停止または次のファイルに進まない

`start_batch`は終了コールバックを使用してポーリングなしで自動的に進みます。バッチが停止しているように見える場合：

1. `check_batch_progress`を呼び出す — これにより進捗チェックが強制され現在の状態が再評価される
2. 現在のファイルがまだ実行中の場合は完了を待つ — タスクマネージャーで`whisper-cli.exe`を確認
3. `check_batch_progress`が現在のファイルを失敗として表示した場合、次のファイルへの進行を試みる

注意：v2.3.0以降、バッチは各ファイルが完了すると終了コールバックで自動的に進みます。繰り返しポーリングする必要はありません — しばらく時間が経過した後に`check_batch_progress`を1回呼び出すだけで状態の更新が得られます。

### バッチが完了しているように見えるファイルを「失敗」として報告する

バリデーターは出力ファイルが空でなく、音声30秒あたり少なくとも1行あることを確認します。短いファイルや長い無音区間のある録音は、バリデーターが疑わしいほど短いと判断する出力を生成することがあります。

トランスクリプトを開いて正しいように見える場合：
- このファイルに対してバリデーションが過度に保守的
- `transcribe_audio`で個別に再実行して結果を手動で確認

出力が本当に間違っている場合：
- 言語が設定された言語と一致しない可能性がある場合は`language=auto`を試す
- より良い精度のためにより大きなモデルを試す

### バッチの開始時に複数のファイルが即座に失敗する

これは通常whisper-cli.exeがまったく機能していないことを意味します。`check_config`を実行してすべてのパスを確認し、`transcribe_audio`で単一ファイルを試して具体的なエラーを確認してください。

---

## 字幕生成

### SRTファイルは保存されているが名前が間違っているまたは間違った場所にある

SRTおよびVTTファイルはソースファイルと同じ場所に保存され、ソース言語が英語でない場合は言語コードが付加されます：
- 英語ソース：`filename.srt`
- 日本語ソース：`filename.ja.srt`
- 英語翻訳付き：`filename.ja.srt` + `filename.en.srt`

一時WAVの隣にファイルが表示される場合は、ソースファイルがフォーマット変換を必要としたか確認してください（mp3/wav以外のフォーマットはFFmpegを通過します）。出力先ロジックは一時ファイルパスではなく元の`file_path`を使用します。

### VTT出力はウェブ用 — デスクトッププレーヤーで読み込むには？

VLCはSubtitle → Add Subtitle File → `.vtt`ファイルを選択することでVTTをサポートします。ほとんどの他のデスクトッププレーヤーはVTTよりSRTをより良くサポートします。デスクトッププレーヤーとの最大互換性には`output_format=srt`を使用してください。

VTTはHTML5の`<video>`要素やウェブベースのビデオプレーヤーに最適です。

### LRCファイルがメディアプレーヤーで表示されない

LRC（`.lrc`）ファイルは歌詞/カラオケ表示機能を持つプレーヤー用です：foobar2000、Winamp、AIMP、および各種モバイルプレーヤー。標準的なビデオプレーヤーはLRCを表示しません。ビデオの同期字幕が必要な場合は`srt`または`vtt`を使用してください。

### CSV出力 — フォーマットは？

CSV出力には行ごとにセグメントの開始時間、終了時間、テキストが含まれます。スプレッドシートツールや下流の分析スクリプトへのインポート用に設計されています。正確な列フォーマットはwhisper.cppの`-ocsv`出力に一致します。実際の字幕表示には`srt`または`vtt`を使用してください。

### 字幕生成が4分エラーでタイムアウトする

`generate_subtitles`はデフォルトで同期的に実行され、長いファイルではClaude Desktopの4分MCPタイムアウトに達する可能性があります。10分以上のファイルには`background=true`を使用してください：

- *「このファイルの字幕を生成して、background=true」*

次に`check_progress`で進捗を確認してください。注意：`translate_to_english=true`はバックグラウンドモードでは使用できません。英語翻訳を生成するにはバックグラウンドジョブが完了した後に2回目のパスを実行してください。

---

## モデル管理

### `download_model`がネットワークエラーで失敗する

ツールはHugging Faceからダウンロードします。マシンがインターネットにアクセスできること、`huggingface.co`がファイアウォールやプロキシでブロックされていないことを確認してください。

ダウンロードが開始したが途中で失敗した場合、`.part`ファイルは自動的に削除されます。`download_model`を再実行して再試行してください。

### `switch_model`がモデルがモデルディレクトリにないと言う

`switch_model`ツールは`WHISPER_MODEL`で設定されたディレクトリ内のファイルのみを受け付けます。

モデルが別の場所にある場合は、モデルディレクトリに移動するか、設定の`WHISPER_MODEL`をモデルと同じディレクトリのファイルを指すように更新してください。

### Claude Desktop再起動後にアクティブモデルが設定のモデルに戻る

`switch_model`は設計上セッションスコープです。モデルの切り替えを永続的にするには、`claude_desktop_config.json`の`WHISPER_MODEL`を更新してClaude Desktopを再起動してください。

---

## ファイルパスとフォーマット

### Unicodeファイル名で文字起こしが無音で失敗する

バックグラウンド文字起こしはすべての出力をサニタイズされたASCIIジョブIDベースの一時パスを通してルーティングし、Unicodeファイル名を正しく処理します。ブロッキングモードでUnicodeファイル名の失敗が見られる場合は、ファイル自体がアクセス可能か確認してください：

```powershell
Test-Path "C:\Users\YourName\Documents\会議録音.mp4"
```

`True`が返されるべきです。PowerShellでパスにアクセスできない場合、MCPサーバーもアクセスできません。

### 動画ファイルが出力なしまたは即座にエラーになる

FFmpegはすべての動画フォーマットに必要です。FFmpegがインストールされていることを確認：
```
ffmpeg -version
```

FFmpegがPATHにない場合は、設定の`FFMPEG_PATH`を`ffmpeg.exe`のフルパスに設定してください。

FFmpegがインストールされているが特定の動画が失敗する場合は、破損したファイルか珍しいコーデックのバリアントである可能性があります。手動で変換を試みてください：
```
ffmpeg -i input.mp4 -ar 16000 -ac 1 output.wav
```
その後WAVファイルを直接文字起こしてください。

### 「ファイルが大きすぎる」エラー

ツールは10GBを超えるファイルを拒否します。これはメモリの暴走を防ぐための安全制限です。このサイズに近いファイルは文字起こし前に分割してください。

### UNCパスの拒否

`\\server\share`で始まるパス（ネットワーク共有へのUNCパス）は入力バリデーターによって拒否されます。ネットワーク共有をドライブレター（例：`Z:\`）としてマウントしてそのパスを使用してください。

---

## 一時ファイルのクリーンアップ

`%TEMP%\whisper-mcp-jobs\`のジョブ状態ファイル（`.json`と`.log`）はサーバー起動時に7日以上経過したファイルが自動的にクリーンアップされます。必要な場合は手動クリーンアップも可能です：

```powershell
Remove-Item "$env:TEMP\whisper-mcp-jobs\*" -Force
```

一時WAV変換ファイル（`%TEMP%`の`whisper_tmp_*.wav`）は各文字起こし完了後に即座に削除されます。文字起こし中にクラッシュした場合、これらが残ることがあります。手動で削除してください：

```powershell
Remove-Item "$env:TEMP\whisper_tmp_*.wav" -Force
```

---

## コマンドラインからの大規模バッチ処理

Claudeなしで一晩中実行したい大規模バッチには、PowerShellを使用してください。

**重要：** whisper-cli.exeはMP4、MKVなどのほとんどの動画フォーマットを直接読み込めません。FFmpegで事前にWAVに変換する必要があります。またwhisperはトランスクリプトをstdoutに、診断情報をstderrに出力します。`Start-Process -RedirectStandardOutput`を使用してトランスクリプトを正しくキャプチャしてください。

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

`*.mp4`をファイルタイプに合わせて`*.mkv`や`*.m4a`などに変更してください。`Test-Path`のスキップチェックにより、中断後にスクリプトを再実行しても完了済みファイルは再処理されません。

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
