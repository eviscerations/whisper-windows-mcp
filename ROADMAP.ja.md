# whisper-windows-mcp — ロードマップ

現在のバージョン：**v2.3.0**

---

## 設計原則

これらの原則はこのプロジェクトのすべての決定を支配し、機能追加の速度より優先されます。

**Claude APIの使用を最小限に。** スキャン、分析、キュー管理、実行、検証、モデル切り替えを含むワークフロー全体を、できる限り少ないClaude操作で完了できなければなりません。このツールはClaudeのProまたはMaxサブスクリプションを契約していないフリープランユーザーでも完全に機能する必要があります。すべてのツール呼び出しは使用量を消費します。この原則を念頭に設計してください。

**常に1つのwhisperインスタンス。** 実行中に2つ目のwhisper-cli.exeプロセスを生成しない。プロセスロックは必須であり、例外はありません。

**ローカルファースト、デフォルトでプライベート。** 音声はマシンから外に出ない。コア機能にクラウドAPIは不要。オプションの統合機能（例：Hugging Faceからのモデルダウンロード）は明確にオプションとして文書化する必要があります。

**明示的なユーザー制御。** サイレントな一括操作なし。破壊的または不可逆なアクションは確認が必要。実行前にユーザーが何が起こるかを常に把握できるようにする。

**Unicodeセーフなパス処理。** すべてのファイルI/Oで、日本語、中国語、絵文字、括弧などの非ASCII文字を含むファイル名を正しく処理する必要があります。

**モジュール型かつ組み合わせ可能。** ツールは独立しています。ユーザーは必要なものだけを使います。やむを得ない場合を除き、どの機能も他の機能を必要としてはなりません。

**機能追加より最適化を優先。** 機能追加とシステム負荷またはAPI呼び出し回数の削減の間で迷った場合は、負荷を削減してください。大規模な最適化作業はコストがかかります。最初から正しいアーキテクチャを設計してください。

---

## 完了済み

### ✅ v1.3.1 — プロセスロック
`tasklist /FI`を使用した`isWhisperRunning()`チェックを追加。競合するプロセスを生成する代わりに、明確なエラーとTask Managerの手順を返します。

### ✅ v1.4.0 — Vulkan GPU加速
VS Build ToolsとVulkan SDKを使用して`-DGGML_VULKAN=ON`でwhisper.cppをコンパイル。ビルド済みVulkanバイナリを`whisper-vulkan-win-x64.zip`として配布。

**AMD Radeon RX Vega 56での結果：** GPU使用率平均約16%。58分のファイルがGPUで約4.5分（CPU専用では約88分）で完了。

### ✅ v1.5.0 — システム診断
`check_system`ツール：`wmic`によるGPU検出、Vulkan DLL確認、VRAM報告、モデルサイズ推奨。

### ✅ v1.6.0 — メディアファイル事前分析
FFprobeを使用した`analyze_media`ツール：時間、サイズ、コーデック、文字起こし状態、CPUとGPUの推定時間。単一ファイルまたはフォルダスキャン、ソートオプション付き。

### ✅ v1.7.0 — バックグラウンド文字起こし + 進捗表示
デタッチドプロセスアーキテクチャ：`background=true`の`transcribe_audio`がwhisperをデタッチドプロセスとして起動し、即座にジョブIDを返す。`check_progress`がwhisperのstderrセグメントタイムスタンプをリアルタイムで解析。

### ✅ v1.8.0 — 検証付き順次バッチ処理
`start_batch`と`check_batch_progress`：自動順次処理、文字起こし検証（空または短すぎる出力の検出）、自動キュー進行、ファイルごとの進捗タイムスタンプ。

### ✅ v1.9.0 — 多言語対応と翻訳
`language=auto`による言語自動検出と`translate_to_english=true`によるデュアルSRT出力。`.3gp`と`.ts`フォーマットのサポートを追加。`language=auto`は`transcribe_audio`でも利用可能。

**既知の制限：** Whisperの組み込み翻訳は英語へのみ対応。英語以外の言語には`large-v3`モデルが必要 — 英語専用モデル（`*.en.bin`）は英語以外の音声に`[FOREIGN]`を出力します。

### ✅ v2.0.0 — Unicodeセーフパス + バックグラウンドSRT
**Unicodeファイル名：** 非ASCII文字を含むファイル名でバックグラウンド文字起こしがサイレントに失敗する問題を修正。ジョブIDベースのサニタイズされた一時パスに出力を書き込み、完了後に正しい宛先に移動するよう変更。

**バックグラウンドモードでのSRT：** `spawnDetached`が要求されたフォーマットに関わらず`-otxt`をハードコードしていた問題を修正。`spawnDetached`に`outputFormat`パラメータを追加し、バックグラウンドモードで`text`と`srt`出力をサポート。

### ✅ v2.0.1 — バグ修正（v2.2.0に含む）
- `buildArgs`と`spawnDetached`の両方で`--max-context 0`をハードコード — 長尺音声でのハルシネーションループを防止。
- `--no-speech-thold 0.6`を両関数にハードコード — 信頼度閾値を下回るセグメントを無音として扱う。
- パス検証（`validateInputPath`）— UNCパスと`..`トラバーサルを拒否。
- `MAX_FILE_SIZE_MB = 10240`ファイルサイズガード。
- `transcribeSingle`にトランスクリプトインジェクションのセキュリティコメントを追加。
- TROUBLESHOOTING.mdで壊れていたCLIバッチコマンドを修正。

### ✅ v2.1.0 — モデル管理スイート（v2.2.0に含む）
- `WHISPER_MODEL`を`const`から`let`に変更（セッション中に変更可能）。
- `MODEL_REGISTRY` — 16モデル、フル精度と量子化バリアント、Hugging FaceダウンロードURL。
- `ALLOWED_HF_PREFIXES` — ダウンロードを`ggerganov/whisper.cpp`と`ggml-org`ネームスペースに制限するURLアローリスト。
- `list_models`ツール — モデルディレクトリをスキャン、アクティブモデル、サイズ、ユースケース、利用可能なダウンロードを表示。
- `download_model`ツール — Node.js組み込み`https`でHugging Faceからダウンロード、アトミックリネーム。
- `switch_model`ツール — `.bin`拡張子の検証、ディレクトリ制約、プロセスロックチェック。
- `recommendedModel()`を更新 — 6GB以上のVRAMで`large-v3-turbo`を推奨。

### ✅ v2.2.0 — 品質・パラメータ・ハードウェア拡張
- `WhisperOptions`インターフェース — `buildArgs`の位置引数を置き換え。
- `transcribe_audio`に新パラメータ追加：`temperature`、`prompt`、`condition_on_prev_text`、`no_speech_thold`、`beam_size`、`best_of`、`gpu_device`、`processors`、`word_timestamps`、`max_segment_length`、`split_on_word`、`diarize`、`vad_model`、`offset_t`、`duration`。
- `generate_subtitles`に新パラメータ追加：`temperature`、`prompt`、`beam_size`、`best_of`、`diarize`、`vad_model`。
- `spawnDetached`をリファクタリング — バックグラウンド/バッチモードですべての品質フラグが適用されるよう修正。
- バッチ出力の修正 — `readBatchProgress`が検証前に一時出力を最終宛先に移動するよう修正。

**フラグ互換性の注意：** `gpu_device` / `--device`はwhisper.cpp v1.8.4で追加されました。リリースに含まれるビルド済みVulkanバイナリはv1.8.3世代 — このパラメータはツールで受け付けられますが、ユーザーがv1.8.4以降のバイナリに更新するまで効果はありません。

### ✅ v2.2.2 — パッチ
- デュアルライセンス修正 — LICENSEとLICENSE-COMMERCIAL.mdを修正。
- 軽微なドキュメント修正。

### ✅ v2.3.0 — バッチ自動進行、プライバシーアーキテクチャ、出力フォーマット拡張

**バッチ自動進行（重大バグ修正）：** `start_batch`はキューを進行させるために積極的なポーリングが必要でした。生成されたwhisper-cli子プロセスに`on('exit')`ハンドラーをアタッチするよう修正。プロセス終了時に終了コールバックを介して即座に自動進行し、ポーリングオーバーヘッドとAPI呼び出しコストはゼロ。同時発生する終了ハンドラーと`check_batch_progress`呼び出しによる二重スポーンを防ぐミューテックスを追加。

**プライバシーアーキテクチャ：**
- `WHISPER_PRIVACY_MODE`環境変数 — `true`の場合、すべてのツールレスポンスはメタデータのみを返す（ファイル名、単語数、保存パス）。トランスクリプトテキストはClaudeのAPIに送信されない。トランスクリプトはローカルファイルとしてのみ存在。
- `WHISPER_CONSENT_ACKNOWLEDGED`環境変数 — `true`の場合、機密性のないコンテンツに対してセッションごとの同意ゲートを抑制。
- `transcribe_audio`、`transcribe_batch`、`start_batch`、`check_progress`へのper-call `privacy_mode`パラメータ。グローバル環境変数をどちらの方向にも上書き。再起動不要でper-callで切り替え可能。
- プライバシーモードゲート（`checkPrivacyGate()`）— 有効なプライバシーモードがアクティブな場合、すべての操作前に表示。最初の呼び出しでアーム（開示を表示）、2回目でクリア（許可）。各操作後にリセット。セッション同意ゲートとは完全に独立。
- セッション同意ゲート（`transcriptPolicy()`）— 標準モードで最初のトランスクリプト返却呼び出しの前にセッションに1回表示。`sessionConsentGiven`フラグで管理。
- `PRIVACY.md` — HIPAA、GDPR、弁護士・依頼者特権、FERPA、SOX、PCI-DSS、NDA/企業秘密を網羅した完全なコンプライアンスドキュメント。
- トランスクリプトを返すすべてのツールのツール説明にプライバシー警告を追加。

**出力フォーマット拡張：**
- `vtt` — `-ovtt`によるWebVTT字幕出力。`transcribe_audio`、`generate_subtitles`、`start_batch`、バックグラウンドモードで利用可能。
- `lrc` — `-olrc`によるLRC歌詞/カラオケフォーマット。`transcribe_audio`とバックグラウンドモードで利用可能。
- `csv` — `-ocsv`によるタイムスタンプ付きCSV。`transcribe_audio`とバックグラウンドモードで利用可能。
- `output_format`のデフォルトをすべてのツールとコードパスで`"text"`から`"timestamps"`に変更。プレーンテキストはオプトイン。

**バグ修正：**
- Bug 1：`output_format`がバックグラウンドジョブに転送されていなかった — 要求されたフォーマットに関わらずデフォルトの`"text"`が使用されていた。修正済み。
- Bug 2：バックグラウンドジョブ出力移動操作でのサイレントな`catch {}`がエラーを握りつぶしていた。移動後に明示的な`existsSync`チェックを追加して詳細な失敗メッセージを表示。
- Bug 3：非プライバシーバックグラウンドジョブで同意ゲートが`check_progress`に意図的に延期される理由を文書化するコメントを追加。

**その他：**
- 一時ディレクトリの自動クリーンアップ — `cleanupOldJobFiles()`が起動時に実行し、`%TEMP%\whisper-mcp-jobs\`から7日以上経過した`.json`と`.log`ファイルを削除。
- `check_config`がプライバシーモードの状態を報告するよう更新。
- 起動ログがプライバシーモードのオン/オフを報告。
- `Job`インターフェースに`privacyMode: boolean`フィールドを追加。
- `BatchState`インターフェースに`privacyMode: boolean`フィールドを追加。
- `BackgroundFormat`型が`json`を除外（バックグラウンドモードでのjsonはサポートされず`text`にフォールバック）。

---

## 予定 — v2.4.0：Bunへの移行

ランタイムをNode.jsから[Bun](https://bun.sh)に移行します。

Claude Desktopはセッション起動のたびにMCPサーバーを新しく生成するため、起動時間はクリティカルパスにあります。BunはTypeScriptをネイティブにコンパイルステップなしで実行し、Node.jsより大幅に高速に起動し、I/Oも高速です。

**変更点：**
- `tsc`のビルドステップと`dist/`ディレクトリを削除
- ユーザーがTypeScriptソースを直接実行
- `tsconfig.json`がオプション化
- `package.json`スクリプトを更新
- npm公開ワークフローを更新

**変更しない点：**
- `src/index.ts`のソースコード — Bunは既存のTypeScriptとNode.js組み込みAPIと互換性があります
- すべてのツールの動作と出力形式
- エンドユーザーのClaude Desktop設定

---

## 予定 — v2.5.0：外部ツール連携向け拡張出力フォーマット

下流の分析と連携ワークフローを対象とした拡張出力フォーマットサポート。正確なスコープはv2.3.0後のユーザーフィードバックに基づいて定義予定。

---

## 予定 — v2.6.0：ライブマイク文字起こしモード

ライブマイク入力からのリアルタイム文字起こし。選択した録音デバイスからの音声をチャンクでwhisperにストリーミングし、完了したセグメントをローリングトランスクリプトとして返す。

**設計制約：**
- デバイス選択は明示的であること — サイレントなデフォルトデバイスのキャプチャは不可
- Claude Desktopの操作でストリームを停止できること
- 1つのwhisperインスタンスという制約と競合しないこと
- レイテンシと精度のトレードオフはユーザーが設定可能であること

**状況：** 設計フェーズ。whisper.cppの安定したストリーミングAPIに依存。

---

## 予定 — 将来のリリース

### TinyDiarize
`tdrz`対応モデルバリアント（例：`large-v2-tdrz`）での`--tinydiarize`フラグサポート。ステレオ専用の`--diarize`フラグとは異なり、TinyDiarizeはモノラル録音に対応します。特別なモデルバリアントのダウンロードが必要です。pyannoteベースのダイアライゼーションより精度は低いですが、モデルファイル以外の追加依存関係はゼロです。

**状況：** 計画中。`download_model`がtdrzモデルバリアントをサポートすることに依存します。

### YouTube URL文字起こし
yt-dlp経由でYouTube URLから直接文字起こし。音声のダウンロードと文字起こしを1ステップで実行。yt-dlpのインストールとPATH設定が必要。

**設計制約：** yt-dlpはオプション。見つからない場合は明確なインストール手順とともに適切にエラー処理する必要があります。このツールを必要としないユーザーのコア機能への変更なし。

### 動画プロジェクトワークフローツール
ソースクリップと編集済みクリップのディレクトリを管理するユーザー向け：

1. ソースディレクトリとクリップサブディレクトリをスキャン
2. 編集済みクリップのトランスクリプトをソーストランスクリプトにファジーマッチして、ソース内の位置を特定
3. トランスクリプトコンテンツに基づいてClaudeが提案する説明的なファイル名を表示（リネーム実行前に明示的なユーザー確認が必要）
4. タイムコード結果付きでプロジェクトディレクトリ全体のトランスクリプトを検索

**設計制約：**
- ソースファイルは**絶対にリネームまたは変更しない**
- すべてのリネームには**明示的なユーザー確認**が必要
- 検索はスタンドアロンツールとして独立して使用可能
- 分析とマッチングはローカルで実行 — Claudeはユーザーが結果をレビューするときのみ呼び出され、API呼び出しを最小化

**状況：** 設計フェーズ。

### 話者識別（pyannote-audio）
話者IDラベル付きの完全なモノラル話者識別 — チャンネル構成に関わらず、録音全体の話者の切り替えをマークします。組み込みの`--diarize`ステレオフラグ（v2.2.0）およびTinyDiarizeとは異なります。

**実装：** [pyannote-audio](https://github.com/pyannote/pyannote-audio)が必要 — Hugging Faceモデルアクセストークンが必要なPythonベースのライブラリ。完全に別の依存関係スタック。

**状況：** 独自のセットアップドキュメントを持つオプションの高度機能として計画中。メインパッケージには含めません。

### 英語以外の言語への翻訳
Whisperの`--translate`フラグは英語のみを対象としています。任意のターゲット言語をサポートするには、外部翻訳APIまたはローカル翻訳モデルが必要です。

**検討中のオプション：** LibreTranslate（セルフホスト可能、ローカルファースト）、ローカルLLM翻訳、または明示的なスコープ外ドキュメント。

**状況：** ローカルファーストかAPIへの依存かの設計判断待ちで保留中。

### 文字起こしのクリーンアップと整形
後処理パイプライン：
- フィラーワードと言い直しの削除（オプション、ユーザー制御）
- 自然なトピック境界での段落区切り
- ダイアライゼーションと組み合わせた話者を考慮した整形
- PDFまたはDOCXへのエクスポート

**状況：** 計画中。話者を考慮したバリアントはダイアライゼーションに依存します。

---

## ライセンス

whisper-windows-mcpはデュアルライセンスを採用しています。

**非商用利用：** MIT — 個人・教育・非商用目的での利用は無償です。[LICENSE](LICENSE)をご参照ください。

**商用利用：** ビジネス・業務・収益を生む用途には別途商用ライセンス契約が必要です。条件と連絡先は[COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md)をご参照ください。

---

## 配信

[npm](https://www.npmjs.com/package/whisper-windows-mcp)、[mcpservers.org](https://mcpservers.org)、[Glama](https://glama.ai)、および[awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers)（PRサブミット済み）で公開中。

---

## 多言語ドキュメント

各リリース後に英語ドキュメントに合わせて以下のファイルを更新する必要があります：

**日本語 (`*.ja.md`)** — `README.ja.md` / `TROUBLESHOOTING.ja.md` / `ROADMAP.ja.md` / `PRIVACY.ja.md` / `SECURITY.ja.md`

**韓国語 (`*.ko.md`)** — `README.ko.md` / `TROUBLESHOOTING.ko.md` / `ROADMAP.ko.md` / `PRIVACY.ko.md` / `SECURITY.ko.md`

**ベトナム語 (`*.vi.md`)** — `README.vi.md` / `TROUBLESHOOTING.vi.md` / `ROADMAP.vi.md` / `PRIVACY.vi.md` / `SECURITY.vi.md`

**インドネシア語 (`*.id.md`)** — `README.id.md` / `TROUBLESHOOTING.id.md` / `ROADMAP.id.md` / `PRIVACY.id.md` / `SECURITY.id.md`

**ウクライナ語 (`*.uk.md`)** — `README.uk.md` / `TROUBLESHOOTING.uk.md` / `ROADMAP.uk.md` / `PRIVACY.uk.md` / `SECURITY.uk.md`

**ブラジルポルトガル語 (`*.pt-BR.md`)** — `README.pt-BR.md` / `TROUBLESHOOTING.pt-BR.md` / `ROADMAP.pt-BR.md` / `PRIVACY.pt-BR.md` / `SECURITY.pt-BR.md`

**スペイン語 (`*.es.md`)** — `README.es.md` / `TROUBLESHOOTING.es.md` / `ROADMAP.es.md` / `PRIVACY.es.md` / `SECURITY.es.md`

**ポーランド語 (`*.pl.md`)** — `README.pl.md` / `TROUBLESHOOTING.pl.md` / `ROADMAP.pl.md` / `PRIVACY.pl.md` / `SECURITY.pl.md`

**ルーマニア語 (`*.ro.md`)** — `README.ro.md` / `TROUBLESHOOTING.ro.md` / `ROADMAP.ro.md` / `PRIVACY.ro.md` / `SECURITY.ro.md`

他の言語へのコミュニティ貢献を歓迎します。

---

## コントリビュート

プルリクエスト歓迎です。作業を開始する前に既存のIssueを確認してください。

上記以外のハードウェアでGPU加速をテストした方は、GPU型番、VRAM、使用モデル、確認したスループットをIssueで報告してください。他のユーザーへの正確なパフォーマンス参考情報の構築に役立ちます。
