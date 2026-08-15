# whisper-windows-mcp — Peta Jalan

Versi saat ini: **v2.5.0**

---

## Prinsip Desain

Prinsip-prinsip ini mengatur setiap keputusan dalam proyek ini dan lebih diprioritaskan daripada kecepatan penambahan fitur.

**Minimalkan penggunaan Claude API.** Seluruh alur kerja transkripsi — pemindaian, analisis, antrian, menjalankan, validasi, penggantian model — harus dapat dieksekusi dengan sesedikit mungkin interaksi Claude. Alat ini harus sepenuhnya berfungsi untuk pengguna Claude paket gratis yang tidak membayar langganan Pro atau Max. Setiap panggilan alat menghabiskan anggaran penggunaan. Rancang sesuai dengan itu.

**Satu instance whisper setiap saat.** Jangan pernah menelurkan proses whisper-cli.exe kedua saat satu proses sedang berjalan. Kunci proses bersifat wajib dan tidak dapat dinegosiasikan.

**Utamakan lokal, privat secara default.** Tidak ada audio yang pernah meninggalkan mesin. Tidak diperlukan API cloud untuk fungsionalitas inti. Integrasi opsional (misalnya unduhan model Hugging Face) harus didokumentasikan dengan jelas sebagai opsional.

**Kontrol pengguna yang eksplisit.** Tidak ada operasi massal yang diam-diam. Tindakan yang merusak atau tidak dapat dibalik memerlukan konfirmasi. Pengguna harus selalu tahu apa yang akan terjadi sebelum itu terjadi.

**Jalur aman Unicode.** Semua I/O file harus menangani nama file non-ASCII dengan benar, termasuk bahasa Jepang, Cina, emoji, tanda kurung, dan karakter khusus lainnya.

**Modular dan dapat dikombinasikan.** Alat bersifat independen. Pengguna menggunakan apa yang mereka butuhkan. Tidak ada fitur yang harus bergantung pada fitur lain untuk berfungsi kecuali tidak dapat dihindari.

**Optimasi sebelum fitur.** Saat ragu antara menambahkan fitur dan mengurangi beban sistem atau jumlah panggilan API, kurangi beban. Sesi optimasi besar itu mahal. Rancang arsitektur dengan benar sejak awal.

---

## Selesai

### ✅ v1.3.1 — Kunci Proses
Menambahkan pemeriksaan `isWhisperRunning()` menggunakan `tasklist /FI` sebelum menelurkan transkripsi apa pun. Mengembalikan kesalahan yang jelas dengan instruksi Task Manager alih-alih menelurkan proses yang bersaing.

### ✅ v1.4.0 — Akselerasi GPU Vulkan
Mengkompilasi whisper.cpp dari sumber dengan `-DGGML_VULKAN=ON` menggunakan VS Build Tools 2022 dan Vulkan SDK. Binary Vulkan yang sudah dikompilasi didistribusikan sebagai `whisper-vulkan-win-x64.zip`.

**Hasil pada AMD Radeon RX Vega 56:** utilisasi GPU rata-rata ~16%. File 58 menit selesai dalam ~4,5 menit di GPU vs ~88 menit hanya CPU.

### ✅ v1.5.0 — Diagnostik Sistem
Alat `check_system`: deteksi GPU via `wmic`, verifikasi DLL Vulkan, pelaporan VRAM, rekomendasi ukuran model.

### ✅ v1.6.0 — Pra-Analisis File
Alat `analyze_media` via FFprobe: durasi, ukuran, codec, status transkripsi, perkiraan waktu CPU dan GPU. Pemindaian file tunggal atau folder dengan opsi pengurutan.

### ✅ v1.7.0 — Transkripsi Latar Belakang + Visibilitas Kemajuan
Arsitektur proses terpisah: `transcribe_audio` dengan `background=true` menelurkan whisper sebagai proses terpisah dan segera mengembalikan ID tugas. `check_progress` mengurai timestamp segmen dari stderr whisper untuk persentase dan ETA real-time.

### ✅ v1.8.0 — Batch Berurutan dengan Validasi
`start_batch` dan `check_batch_progress`: pemrosesan berurutan otomatis, validasi transkripsi (deteksi output kosong/pendek), kemajuan antrian otomatis, timestamp kemajuan per file.

### ✅ v1.9.0 — Dukungan Multibahasa dan Terjemahan
`generate_subtitles` dengan deteksi `language=auto` dan output SRT ganda `translate_to_english=true`. Menambahkan dukungan format `.3gp` dan `.ts`. `language=auto` juga tersedia di `transcribe_audio`.

**Keterbatasan yang diketahui:** terjemahan bawaan Whisper hanya menargetkan bahasa Inggris. Memerlukan model `large-v3` untuk bahasa non-Inggris — model khusus bahasa Inggris (`*.en.bin`) menghasilkan `[FOREIGN]` pada audio non-Inggris.

### ✅ v2.0.0 — Jalur Aman Unicode + SRT Latar Belakang
**Nama file Unicode:** file dengan karakter non-ASCII dalam nama file menyebabkan transkripsi latar belakang gagal secara diam-diam. Diperbaiki dengan merutekan semua output melalui jalur temp yang disanitasi berbasis ID tugas, lalu memindahkan hasilnya ke tujuan yang benar setelah selesai.

**SRT dalam mode latar belakang:** `spawnDetached` sebelumnya mengkodekan keras `-otxt` terlepas dari format yang diminta. Diperbaiki dengan menambahkan parameter `outputFormat` ke `spawnDetached`, mendukung output `text` dan `srt` dalam mode latar belakang.

### ✅ v2.0.1 — Perbaikan Bug (dikirimkan dalam v2.2.0)
- `--max-context 0` dikodekan keras di `buildArgs` maupun `spawnDetached` — mencegah loop halusinasi pada audio berdurasi panjang.
- `--no-speech-thold 0.6` dikodekan keras di kedua fungsi — segmen di bawah ambang kepercayaan diperlakukan sebagai keheningan alih-alih konten yang dihalusinasi.
- Validasi jalur (`validateInputPath`) — menolak jalur UNC dan traversal `..`.
- Penjaga ukuran file `MAX_FILE_SIZE_MB = 10240`.
- Komentar keamanan injeksi transkrip di `transcribeSingle`.
- Perintah batch CLI yang rusak diperbaiki di TROUBLESHOOTING.md.

### ✅ v2.1.0 — Suite Manajemen Model (dikirimkan dalam v2.2.0)
- `WHISPER_MODEL` diubah dari `const` menjadi `let` (dapat diubah dalam sesi).
- `MODEL_REGISTRY` — 16 model, varian presisi penuh dan terkuantisasi, URL unduhan Hugging Face.
- `ALLOWED_HF_PREFIXES` — daftar izin URL yang membatasi unduhan ke namespace `ggerganov/whisper.cpp` dan `ggml-org`.
- Alat `list_models` — memindai direktori model, menampilkan model aktif, ukuran, kasus penggunaan, unduhan yang tersedia.
- Alat `download_model` — mengunduh dari Hugging Face via `https` bawaan Node.js, penggantian nama atomik.
- Alat `switch_model` — memvalidasi ekstensi `.bin`, batasan direktori, pemeriksaan kunci proses.
- `recommendedModel()` diperbarui untuk merekomendasikan `large-v3-turbo` untuk VRAM 6GB+.

### ✅ v2.2.0 — Perluasan Kualitas, Parameter, dan Hardware
- Interface `WhisperOptions` menggantikan argumen posisional di `buildArgs`.
- Parameter baru di `transcribe_audio`: `temperature`, `prompt`, `condition_on_prev_text`, `no_speech_thold`, `beam_size`, `best_of`, `gpu_device`, `processors`, `word_timestamps`, `max_segment_length`, `split_on_word`, `diarize`, `vad_model`, `offset_t`, `duration`.
- Parameter baru di `generate_subtitles`: `temperature`, `prompt`, `beam_size`, `best_of`, `diarize`, `vad_model`.
- `spawnDetached` direfaktor — semua flag kualitas diterapkan dalam mode latar belakang/batch.
- Perbaikan output batch — `readBatchProgress` kini memindahkan output temp ke tujuan akhir sebelum memvalidasi.

**Catatan kompatibilitas flag:** `gpu_device` / `--device` ditambahkan dalam whisper.cpp v1.8.4. Binary Vulkan yang sudah dikompilasi dalam rilis berasal dari era v1.8.3 — parameter ini diterima oleh alat tetapi tidak akan berpengaruh sampai pengguna memperbarui ke binary v1.8.4+.

### ✅ v2.2.2 — Patch
- Perbaikan lisensi ganda — LICENSE dan LICENSE-COMMERCIAL.md dikoreksi.
- Koreksi dokumentasi minor.

### ✅ v2.3.0 — Kemajuan Otomatis Batch, Arsitektur Privasi, Perluasan Format Output

**Kemajuan otomatis batch (perbaikan bug kritis):** `start_batch` sebelumnya memerlukan polling aktif untuk maju melalui antrian. Handler `on('exit')` kini dilampirkan ke setiap proses anak whisper-cli yang ditelurkan. Saat proses keluar, batch maju sendiri segera melalui exit callback tanpa overhead polling dan tanpa konsumsi panggilan API. Sebuah mutex mencegah double-spawn antara exit handler dan panggilan `check_batch_progress` yang bersamaan.

**Arsitektur privasi:**
- Variabel lingkungan `WHISPER_PRIVACY_MODE` — saat `true`, semua respons alat hanya mengembalikan metadata (nama file, jumlah kata, jalur penyimpanan). Tidak ada teks transkrip yang pernah dikirimkan ke API Claude. Transkrip hanya ada sebagai file lokal.
- Variabel lingkungan `WHISPER_CONSENT_ACKNOWLEDGED` — saat `true`, menekan gerbang persetujuan sesi satu kali untuk konten yang tidak sensitif.
- Parameter per-panggilan `privacy_mode` pada `transcribe_audio`, `transcribe_batch`, `start_batch`, dan `check_progress`. Menggantikan variabel lingkungan global dalam kedua arah. Tidak perlu restart untuk mengubahnya per panggilan.
- Gerbang mode privasi (`checkPrivacyGate()`) — aktif sebelum setiap operasi saat mode privasi efektif aktif. Bersiaga pada panggilan pertama (menampilkan pengungkapan), dibersihkan pada panggilan kedua (mengizinkan). Direset setelah setiap operasi. Sepenuhnya independen dari gerbang persetujuan sesi.
- Gerbang persetujuan sesi (`transcriptPolicy()`) — aktif sekali per sesi sebelum panggilan pertama yang mengembalikan transkrip dalam mode standar. Dikonsumsi oleh flag `sessionConsentGiven`.
- `PRIVACY.md` — dokumentasi kepatuhan lengkap mencakup HIPAA, GDPR, hak istimewa pengacara-klien, FERPA, SOX, PCI-DSS, dan NDA/rahasia dagang.
- Peringatan privasi pada deskripsi alat untuk semua alat yang mengembalikan transkrip.

**Perluasan format output:**
- `vtt` — output subtitle WebVTT via `-ovtt`. Tersedia di `transcribe_audio`, `generate_subtitles`, `start_batch`, dan mode latar belakang.
- `lrc` — format lirik/karaoke LRC via `-olrc`. Tersedia di `transcribe_audio` dan mode latar belakang.
- `csv` — CSV dengan timestamp via `-ocsv`. Tersedia di `transcribe_audio` dan mode latar belakang.
- Default `output_format` diubah dari `"text"` menjadi `"timestamps"` di semua alat dan jalur kode. Teks biasa kini bersifat opt-in.

**Perbaikan bug:**
- Bug 1: `output_format` tidak diteruskan ke tugas latar belakang — default `"text"` digunakan terlepas dari format yang diminta. Diperbaiki dengan mengubah default menjadi `"timestamps"` dan meneruskannya dengan benar.
- Bug 2: `catch {}` diam-diam dalam operasi pemindahan output tugas latar belakang menelan kegagalan. Menambahkan pemeriksaan `existsSync` eksplisit dengan pesan kegagalan terperinci setelah pemindahan.
- Bug 3: Komentar desain ditambahkan pada titik spawn latar belakang yang mendokumentasikan mengapa gerbang persetujuan sengaja ditangguhkan ke `check_progress` untuk tugas latar belakang non-privasi.

**Tambahan:**
- Pembersihan otomatis direktori temp — `cleanupOldJobFiles()` berjalan saat startup, menghapus file `.json` dan `.log` yang berumur lebih dari 7 hari dari `%TEMP%\whisper-mcp-jobs\`.
- `check_config` kini melaporkan status mode privasi.
- Log startup melaporkan mode privasi aktif/nonaktif.
- Interface `Job` diperluas dengan field `privacyMode: boolean`.
- Interface `BatchState` diperluas dengan field `privacyMode: boolean`.
- Tipe `BackgroundFormat` mengecualikan `json` (json dalam mode latar belakang tetap tidak didukung — kembali ke `text`).

### ✅ v2.4.0 — Penguatan, Pelindung Latar Depan, Suite Pengujian & CI

Sebuah pas keamanan/ketangguhan; migrasi Bun yang direncanakan dipindahkan ke v2.5.0.

**Keamanan & kebenaran:**
- Perbaikan kontainmen jalur `switch_model` — direktori berprefiks saudara (mis. `…\models-evil`) sebelumnya dapat memenuhi pemeriksaan "di dalam direktori model" melalui `startsWith` yang naif; diganti dengan kontainmen ternormalisasi berbasis `relative()`. Menutup celah yang dijelaskan SECURITY.md.
- Gerbang privasi/persetujuan dikunci **per operasi** (alat + argumen) — mengonfirmasi satu transkripsi tidak lagi dapat memenuhi gerbang operasi yang berbeda.
- `download_model` menolak unduhan terpotong (pemeriksaan Content-Length) sebelum mempromosikan file `.part`. (Verifikasi digest SHA256 penuh dilacak untuk pas berikutnya.)
- Koersi input — parameter alat numerik yang bukan angka asli dibuang alih-alih diserahkan ke whisper-cli sebagai `NaN`.

**Ketangguhan:**
- **Pelindung batas waktu latar depan** — file yang cukup panjang untuk melampaui batas waktu alat MCP ~4 menit milik Claude Desktop dalam mode pemblokiran dideteksi di awal dan dirutekan ke latar belakang alih-alih kehabisan waktu secara diam-diam. Ambang batas dapat dikonfigurasi melalui `WHISPER_FOREGROUND_MAX_SEC`. Estimasi waktu diperbaiki (estimasi GPU lama sangat meremehkan; biaya pemuatan ulang model yang dominan kini dimodelkan — diukur, bukan ditebak).
- Penulisan status pekerjaan/batch atomik (file temp + rename) sehingga pembaca konkuren tidak dapat melihat file JSON yang robek.
- ID pekerjaan/batch/temp anti-tabrakan (bersufiks UUID).
- Penghentian SIGINT/SIGTERM yang anggun yang membersihkan file temp mode pemblokiran.

**Pemilihan perangkat GPU:**
- Variabel lingkungan `WHISPER_GPU_DEVICE`, dan `gpu_device` kini disalurkan melalui `generate_subtitles` dan pas deteksi bahasa (sebelumnya hanya `transcribe_audio`). `check_config` melaporkan perangkat aktif. `check_system` tidak lagi salah melaporkan masalah driver ketika `wmic` (usang di Windows 11 24H2+) tidak mengembalikan apa pun.

**Kualitas:**
- Suite pengujian unit `node:test` atas logika murni (kontainmen jalur, penguncian gerbang, penulisan atomik, koersi input, estimasi batas waktu), nol dependensi tambahan, ditambah alur kerja CI GitHub Actions yang menjalankannya pada setiap push/PR.

**Diidentifikasi untuk rilis mendatang:** jalur model persisten (mis. `whisper-server` milik whisper.cpp) untuk menghilangkan biaya pemuatan ulang model yang dibayar pada setiap transkripsi — peningkatan throughput besar untuk pekerjaan batch/arsip.

### ✅ v2.5.0 — Server Model Persisten + TinyDiarize

**Server model persisten (Fase 1).** whisper-cli bersifat sekali-jalan: ia memuat ulang model penuh pada setiap panggilan — v2.4.0 mengukur pemuatan ulang itu di ~110d pada GPU dengan memori terbatas, pajak tetap per file yang mendominasi wall-clock pada pekerjaan batch/arsip. v2.5.0 menambahkan mode model residen opsional yang menahan model tetap di memori antar transkripsi.
- Alat `whisper_server` (`start` / `stop` / `status`). Server residen *menjadi* instance tunggal, mempertahankan aturan satu-instance-whisper: permintaan diserialkan terhadapnya, tanpa memperkenalkan konkurensi.
- `transcribe_audio` dan `transcribe_batch` pemblokiran dirutekan melalui server residen melalui localhost (`127.0.0.1`) via `POST /inference`, melewati biaya pemuatan ulang. Pelindung batas waktu latar depan dilewati dalam mode server (tidak ada pemuatan ulang yang harus dibayar).
- `switch_model` melakukan hot-swap model residen via `POST /load` tanpa restart. `check_config` melaporkan status server; server yang dimiliki dibunuh saat shutdown untuk membebaskan VRAM.
- Aturan satu-engine / VRAM-bersama diberlakukan dengan backstop keras di jalur detached-spawn ditambah penolakan yang ramah: selama server aktif, tugas latar belakang, `start_batch`, `generate_subtitles`, output `lrc`/`csv`, dan opsi per-permintaan yang tidak didukung API HTTP (`beam_size`, `best_of`, `word_timestamps`, `diarize`, `tinydiarize`, `vad_model`, `offset_t`, `duration`, dll.) ditolak dengan pesan "hentikan server terlebih dahulu" alih-alih terdegradasi secara diam-diam.
- Konfigurasi: `WHISPER_SERVER_PATH`, `WHISPER_SERVER_PORT` (default 8571, hanya localhost).

**Batasan desain:**
- Siklus hidup eksplisit: start / stop / status, dengan pemeriksaan kesehatan. Server tidak pernah dimulai secara diam-diam sebagai efek samping dari panggilan yang tidak berkaitan.
- Terikat hanya ke localhost — tidak pernah ke antarmuka yang dapat dirutekan. Tidak ada eksposur jaringan (konsisten dengan prinsip utamakan lokal dan penguatan v2.4.0).
- Fallback yang anggun: jika server tidak berjalan, transkripsi tetap bekerja melalui jalur whisper-cli sekali-jalan yang ada. Server adalah optimasi, bukan dependensi keras.
- `switch_model` memuat ulang model di server residen (masih jauh lebih murah teramortisasi daripada memuat ulang per file).
- Gerbang privasi dan persetujuan tidak berubah — keduanya berada di atas mekanisme transkripsi.
- Pemilihan port dengan penanganan tabrakan; shutdown bersih pada SIGINT/SIGTERM bersama pembersihan file temp yang ada.

**TinyDiarize.** Dukungan `--tinydiarize` dengan model yang mengaktifkan `tdrz`. Berbeda dengan flag `--diarize` stereo (v2.2.0), TinyDiarize menandai pergantian pembicara pada rekaman **mono** dan tidak memerlukan apa pun di luar file model — tanpa Python, tanpa layanan eksternal.
- Parameter `tinydiarize` pada `transcribe_audio` dan `generate_subtitles` (mode pemblokiran dan latar belakang); `--tinydiarize` disalurkan melalui kedua pembangun argumen.
- `small.en-tdrz` ditambahkan ke `MODEL_REGISTRY` sehingga `download_model` dapat mengambilnya dari namespace Hugging Face terpercaya yang ada.

---

## Direncanakan — v2.6.0: Server Model Persisten — Fase 2

Rutekan tugas latar belakang dan `start_batch` melalui server residen. Fase 1 (v2.5.0) hanya mencakup transkripsi pemblokiran; ini adalah kemenangan arsip/throughput yang lebih besar, dan memerlukan lapisan pekerjaan/antrian dikerjakan ulang di sekitar permintaan HTTP alih-alih PID detached — pelacakan kemajuan tanpa PID, dan pembatalan berbasis HTTP.

**Batasan desain** server residen yang ditetapkan di v2.5.0 terus mengatur Fase 2 — pengikatan hanya-localhost, siklus hidup eksplisit, fallback sekali-jalan yang anggun, dan gerbang privasi/persetujuan yang tidak berubah. Fase 2 menambahkan perutean pekerjaan/antrian tanpa melonggarkan satu pun di antaranya.

**Status:** Direncanakan.

---

## Direncanakan — v2.7.0: Pencarian Transkrip di Seluruh Proyek

Alat mandiri untuk mencari frasa atau pola di setiap transkrip dalam direktori proyek dan mengembalikan kecocokan beserta file sumber dan timecode-nya. Diuraikan dari alur kerja proyek video yang lebih besar (lihat "Nanti / Dalam Pertimbangan") — bagian ini berguna secara independen, berisiko rendah, dan hemat API: pencarian berjalan secara lokal, dan Claude hanya terlibat saat pengguna meninjau hasil.

**Status:** Direncanakan.

---

## Direncanakan — v2.8.0: Output yang Dapat Diimpor Editor & Format Integrasi

Ubah transkrip menjadi artefak yang dapat langsung diimpor oleh editor video, sehingga transkripsi mengalir ke proses penyuntingan alih-alih berhenti pada file teks — motivasi inti proyek ini: membuat arsip rekaman mentah yang besar dapat dikerjakan oleh kreator solo.

- **Marker CSV terlebih dahulu** — awal segmen sebagai CSV marker/chapter yang diimpor secara native oleh Premiere, Resolve, dan YouTube. Memberikan sebagian besar nilai "masukkan ke dalam editor saya" dengan biaya dan kerapuhan versi yang jauh lebih kecil daripada format timeline penuh.
- **Data timing tingkat kata** — mengekspos JSON token penuh whisper.cpp (`--output-json-full` / `-ojf`) dan timestamp kata yang disejajarkan dengan DTW (`--dtw <preset>`, dicocokkan otomatis dengan model aktif; preset tersedia untuk setiap keluarga termasuk `large.v3.turbo`, dan berlaku untuk model terkuantisasi). Ini adalah lapisan timing akurat tempat SRT tingkat kata, penempatan marker, dan penyelarasan klip bertumpu; JSON per-token juga membawa nilai kepercayaan bagi siapa pun yang menginginkannya. Catatan: `--dtw` adalah **flag waktu-muat/konteks** (disetel saat inisialisasi model, bukan per permintaan), sehingga ia berada di jalur CLI sekali-jalan — API `/inference` `whisper-server` residen tidak dapat menerapkannya per permintaan, konsisten dengan penolakan tingkat-kata mode server di v2.5.0.
- **Menutup celah JSON-di-latar-belakang** — JSON saat ini kembali ke teks dalam mode latar belakang.
- **FCPXML / EDL — ditangguhkan:** bertele-tele, sensitif terhadap versi, dan menarik ke arah cakupan integrasi editor. Ditinjau ulang hanya jika marker CSV terbukti tidak memadai.

**Batas cakupan:** ini menghasilkan file yang *diimpor* editor — bukan mengotomatisasi UI editor. Interchange standar sesuai etos dan minim dependensi; mengendalikan aplikasi adalah persoalan terpisah.

Berpasangan dengan v2.7.0: cari arsip untuk menemukan momennya, lalu serahkan file marker ke editor untuk langsung melompat ke sana.

---

## Direncanakan — v2.9.0: Kualitas & Penyetelan Transkripsi

Kedalaman pada akurasi dan kontrol transkripsi — semuanya passthrough nol-dependensi dari flag whisper.cpp yang belum diekspos oleh wrapper. Setiap opsi di sini adalah parameter transkripsi sekali-jalan: tanpa overhead panggilan alat tambahan, sepenuhnya berfungsi untuk pengguna paket gratis.

- **Penyetelan VAD** — tombol-tombol voice-activity-detection (`--vad-threshold`, durasi min-speech / min-silence / max-speech, speech-pad, samples-overlap). VAD sudah aktif tetapi belum dapat disetel; parameter ini memperbaiki perilaku over- dan under-segmentation di balik sebagian besar keluhan kualitas dunia nyata.
- **Penekanan token non-ucapan** (`--suppress-nst`) — membuang artefak `[music]` / derau untuk transkrip yang lebih bersih.
- **Deteksi bahasa saja** (`--detect-language`) — probe murah "ini bahasa apa?" yang mengembalikan hasil tanpa pas transkripsi penuh. Berharga bagi audiens multibahasa dan untuk perutean sebelum transkripsi.
- **Ambang ketangguhan / dekode** — `--entropy-thold`, `--logprob-thold`, `--word-thold`, `--no-fallback`, `--temperature-inc`, `--carry-initial-prompt`, `--suppress-regex` untuk audio yang sulit.
- **Tombol performa** — flash attention (kini **aktif secara default** di whisper.cpp saat ini; ekspos jalur penonaktifan `--no-flash-attn` / `-nfa` alih-alih memperlakukannya sebagai opt-in), CPU-saja (`--no-gpu`), ukuran konteks audio (`--audio-ctx`).

**Status:** Direncanakan.

---

## Direncanakan — v3.0.0: Suite Pasca-Pemrosesan Subtitle

Lapisan batch murni-TypeScript di atas SRT / VTT / JSON yang sudah dipancarkan server — tanpa transkripsi ulang, tanpa dependensi baru, satu parser/serializer bersama. Mencerminkan rantai "konversi batch" editor subtitle khusus (Subtitle Edit, Aegisub), yang tidak ditawarkan oleh MCP transkripsi pesaing mana pun. Pas perbaikan timing secara khusus menargetkan cacat yang ditunjukkan output Whisper mentah — cue kosong pada keheningan, segmen yang tumpang tindih atau terlalu pendek, duplikat loop-berulang, baris yang terlalu panjang — sehingga suite membersihkan output *server ini sendiri*, bukan hanya file yang diimpor.

- **Perbaikan & validasi timing** — memberlakukan durasi cue min / max; memperbaiki cue yang tumpang tindih; menerapkan celah antar-cue minimum; menjembatani celah di bawah ambang (perpanjang ke berikutnya); membuang cue kosong; menggabungkan cue duplikat (loop-berulang whisper); membatasi hingga dua baris; mengurutkan + menomori ulang. Ditambah **laporan lint** non-mutasi yang menandai kecepatan baca per cue (CPS), karakter-per-baris, dan pelanggaran jumlah baris terhadap profil yang dapat dipilih (mis. YouTube 42 CPL / 20 CPS, Netflix 42 / 17) — deliverable yang benar-benar diinginkan editor sebelum impor.
- **Penetapan ulang waktu** — offset / geser semua cue; penetapan ulang laju bingkai (mis. 23,976 ↔ 25).
- **Reflow** — menggabungkan cue pendek; membagi baris panjang ke maksimum karakter-per-baris / karakter-per-detik, menyeimbangkan kedua baris alih-alih pembagian rakus.
- **Konversi format** — mengonversi file yang ada antara SRT / VTT / LRC / CSV / Markdown / plain, ditambah output ASS/SSA (bergaya default), tanpa transkripsi ulang. Normalisasi UTF-8 / akhiran-baris saat penulisan (memenuhi persyaratan UTF-8 YouTube, mencegah mojibake saat impor ulang).
- **Pembersihan teks** — find/replace (regex opt-in), penghapusan kata pengisi dari wordlist statis (bukan LLM), normalisasi huruf, menghapus anotasi untuk tunarungu. Sepenuhnya mekanis — apa pun yang membutuhkan penilaian (perbaikan OCR, inferensi tanda baca) tidak termasuk; Claude host menanganinya pada teks yang dikembalikan.
- **Pemformatan label pembicara** — memformat pergantian stereo / TinyDiarize yang ada sebagai blok berprefiks pembicara.
- **Statistik ringkasan** — jumlah kata, durasi, WPM, rata-rata CPS, rasio keheningan.

**Batasan desain:**
- TypeScript murni di atas SRT / VTT / JSON yang sudah dipancarkan server — tanpa transkripsi ulang, tanpa dependensi runtime baru, satu parser/serializer bersama.
- Beroperasi hanya pada file subtitle/transkrip yang ada — tidak pernah memanggil whisper atau ffmpeg, tidak pernah menyentuh audio.
- Deterministik dan berbasis aturan saja — tanpa LLM, tanpa cloud, tanpa perbaikan "pintar". Apa pun yang membutuhkan penilaian (perbaikan OCR, inferensi tanda baca) tidak termasuk; Claude host menanganinya pada teks yang dikembalikan.
- Non-destruktif — menulis file baru; tidak pernah menimpa file sumber di tempat tanpa konfirmasi eksplisit pengguna.
- Pas lint / validasi bersifat non-mutasi — ia melaporkan pelanggaran, tidak pernah menulis ulang secara diam-diam.
- Hanya format interchange standar — tidak pernah mengendalikan UI editor.

**Status:** Direncanakan.

---

## Nanti / Dalam Pertimbangan

Tidak terjadwal, tetapi sesuai etos dan ditinjau kembali seiring kapasitas memungkinkan.

### Migrasi Bun
Migrasikan runtime dari Node.js ke [Bun](https://bun.sh) untuk memangkas waktu cold-start server MCP dan menghilangkan langkah build `tsc` (source berjalan langsung). Diturunkan dari slot v2.5.0 sebelumnya: dengan biaya pemuatan ulang model per-pemanggilan menjadi hambatan sebenarnya (lihat v2.5.0 di atas), memangkas startup Node adalah keuntungan marginal, dan kematangan Bun-di-Windows ditambah perubahan model distribusi membawa risiko. Layak dilakukan pada akhirnya sebagai optimasi opsional, bukan prioritas.

### Alur Kerja Penggantian Nama & Pencocokan Proyek Video
Bagian yang lebih berat dari perkakas proyek, setelah Pencarian Transkrip di Seluruh Proyek (v2.7.0) diluncurkan: cocokkan transkrip klip yang telah diedit dengan transkrip sumber secara fuzzy untuk menemukan titik asal, dan tampilkan nama file deskriptif yang disarankan Claude.

**Batasan desain:**
- File sumber **tidak pernah diganti nama atau dimodifikasi**
- Semua penggantian nama memerlukan **konfirmasi eksplisit pengguna**
- Analisis dan pencocokan terjadi secara lokal — Claude hanya dipanggil saat pengguna meninjau hasil, meminimalkan panggilan API

**Status:** Fase desain.

### Pembersihan Transkrip Berbasis Aturan
Pasca-pemrosesan lokal dan deterministik — penghapusan kata pengisi dan awal yang salah, dikontrol pengguna. Paling berharga bagi pengguna mode privasi, di mana transkrip tidak pernah mencapai Claude untuk pembersihan. Sengaja dipersempit: pemecahan paragraf dan segmentasi topik adalah hal yang sudah dilakukan Claude dengan baik pada teks yang dikembalikan, dan ekspor PDF/DOCX adalah scope creep ke pembuatan dokumen — keduanya di luar cakupan di sini.

**Status:** Dipromosikan — pembersihan deterministik dijadwalkan dalam Suite Pasca-Pemrosesan Subtitle v3.0.0; catatan di-luar-cakupan (pemecahan paragraf, PDF/DOCX) masih berlaku.

### Diarisasi Pembicara (pyannote-audio)
Diarisasi pembicara mono penuh dengan label ID pembicara di seluruh rekaman. Berbeda dari flag `--diarize` stereo bawaan (v2.2.0) dan TinyDiarize (v2.5.0).

**Implementasi:** memerlukan [pyannote-audio](https://github.com/pyannote/pyannote-audio) — library Python dengan persyaratan token akses Hugging Face, stack dependensi yang sepenuhnya terpisah. Diprioritaskan lebih rendah: bertentangan dengan etos utamakan lokal / nol dependensi, dan TinyDiarize sudah mencakup kasus mono nol-dependensi. Jika dikejar, ia dikirim sebagai add-on lanjutan opsional dengan dokumentasi pengaturannya sendiri, tidak pernah dalam paket utama.

**Status:** Diprioritaskan lebih rendah / opsional.

### Terjemahan ke Bahasa Non-Inggris
Flag `--translate` Whisper hanya menargetkan bahasa Inggris. Bahasa target sembarang memerlukan API terjemahan eksternal atau model terjemahan lokal.

**Opsi yang sedang dipertimbangkan:** LibreTranslate (dapat di-host sendiri, utamakan lokal), terjemahan LLM lokal, atau dokumentasi di luar cakupan yang eksplisit.

**Status:** Ditangguhkan menunggu keputusan utamakan lokal vs ketergantungan API.

---

## Di Luar Cakupan / Tidak Direncanakan

Fitur yang sengaja dikecualikan, dicatat di sini agar keputusannya eksplisit dan tidak muncul kembali berulang kali.

### Transkripsi Mikrofon Langsung — tidak direncanakan
Transkripsi real-time dari mikrofon langsung sebelumnya dijadwalkan untuk v2.7.0. Dipangkas karena bertentangan dengan desain inti proyek:
- **Ketidakcocokan arsitektur:** MCP bersifat permintaan/respons, bukan streaming. Penangkapan langsung akan memerlukan polling berkelanjutan (menghabiskan anggaran API) atau panggilan yang memblokir lama yang mengenai pelindung batas waktu latar depan v2.4.0.
- **Prinsip satu-instance / minimalkan-API:** mengembalikan segmen bergulir ke Claude adalah churn panggilan alat konstan — kebalikan dari "berfungsi untuk pengguna paket gratis" — dan proses streaming berumur panjang membebani kunci proses.
- **Dependensi eksternal:** ia akan memerlukan dependensi eksternal tambahan.

Captioning langsung adalah kategori produk yang berbeda (latensi rendah, manajemen perangkat, VAD) dari alat transkripsi file/batch. Pengguna yang membutuhkannya lebih baik dilayani oleh alat real-time khusus.

### Transkripsi URL YouTube (yt-dlp) — tidak direncanakan sebagai alat bawaan
YouTube-ke-transkrip langsung via yt-dlp sebelumnya direncanakan. Dibatalkan sebagai fitur kelas satu karena:
- **Permukaan keamanan:** ia menambahkan pengambilan URL sembarang dan panggilan subproses dengan input yang dikendalikan pengguna, membalik penguatan v2.4.0 yang justru mengurangi permukaan tersebut.
- **Pemeliharaan:** yt-dlp sering rusak saat YouTube berubah — komitmen pemeliharaan yang berkelanjutan.
- **Utamakan lokal & lisensi:** akuisisi konten jaringan berada di luar cakupan utamakan lokal, dan membundel pengunduh ke proyek berlisensi komersial adalah area abu-abu ToS/tanggung jawab.
- **Redundan:** pengguna dapat menjalankan yt-dlp sendiri dan mengarahkan `transcribe_audio` ke file yang dihasilkan.

**Alternatif:** didokumentasikan sebagai resep (jalankan yt-dlp, lalu transkrip file) di README / TROUBLESHOOTING, alih-alih alat yang dipelihara — alur kerja tetap tersedia tanpa memiliki dependensi atau permukaan serangan.

---

## Lisensi

whisper-windows-mcp menggunakan lisensi ganda.

**Penggunaan non-komersial:** MIT — gratis untuk penggunaan pribadi, pendidikan, dan non-komersial. Lihat [LICENSE](LICENSE).

**Penggunaan komersial:** Diperlukan lisensi komersial terpisah untuk penggunaan bisnis, profesional, atau menghasilkan pendapatan apa pun. Lihat [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md) untuk syarat dan informasi kontak.

---

## Distribusi

Tersedia di [npm](https://www.npmjs.com/package/whisper-windows-mcp), [mcpservers.org](https://mcpservers.org), [Glama](https://glama.ai), dan [awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers) (PR diajukan).

---

## Dokumentasi Multibahasa

File-file berikut harus diperbarui agar sesuai dengan dokumen bahasa Inggris setelah setiap rilis:

**Jepang (`*.ja.md`)** — `README.ja.md` / `TROUBLESHOOTING.ja.md` / `ROADMAP.ja.md` / `PRIVACY.ja.md` / `SECURITY.ja.md`

**Korea (`*.ko.md`)** — `README.ko.md` / `TROUBLESHOOTING.ko.md` / `ROADMAP.ko.md` / `PRIVACY.ko.md` / `SECURITY.ko.md`

**Vietnam (`*.vi.md`)** — `README.vi.md` / `TROUBLESHOOTING.vi.md` / `ROADMAP.vi.md` / `PRIVACY.vi.md` / `SECURITY.vi.md`

**Indonesia (`*.id.md`)** — `README.id.md` / `TROUBLESHOOTING.id.md` / `ROADMAP.id.md` / `PRIVACY.id.md` / `SECURITY.id.md`

**Ukraina (`*.uk.md`)** — `README.uk.md` / `TROUBLESHOOTING.uk.md` / `ROADMAP.uk.md` / `PRIVACY.uk.md` / `SECURITY.uk.md`

**Portugis Brasil (`*.pt-BR.md`)** — `README.pt-BR.md` / `TROUBLESHOOTING.pt-BR.md` / `ROADMAP.pt-BR.md` / `PRIVACY.pt-BR.md` / `SECURITY.pt-BR.md`

**Spanyol (`*.es.md`)** — `README.es.md` / `TROUBLESHOOTING.es.md` / `ROADMAP.es.md` / `PRIVACY.es.md` / `SECURITY.es.md`

**Polandia (`*.pl.md`)** — `README.pl.md` / `TROUBLESHOOTING.pl.md` / `ROADMAP.pl.md` / `PRIVACY.pl.md` / `SECURITY.pl.md`

**Rumania (`*.ro.md`)** — `README.ro.md` / `TROUBLESHOOTING.ro.md` / `ROADMAP.ro.md` / `PRIVACY.ro.md` / `SECURITY.ro.md`

Kontribusi komunitas untuk bahasa lain disambut.

---

## Berkontribusi

Pull request disambut. Periksa issue yang ada sebelum memulai pekerjaan.

Jika Anda telah menguji akselerasi GPU pada hardware yang tidak tercantum di atas, silakan buka issue dengan model GPU, VRAM, ukuran model, dan throughput yang diamati. Ini membantu membangun referensi performa yang akurat untuk pengguna lain.
