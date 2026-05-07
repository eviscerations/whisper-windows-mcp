# whisper-windows-mcp — Peta Jalan

Versi saat ini: **v2.2.0**

---

## Prinsip Desain

Prinsip-prinsip ini mengatur setiap keputusan dalam proyek ini dan lebih diprioritaskan dari kecepatan penambahan fitur.

**Minimalkan penggunaan Claude API.** Seluruh alur kerja transkripsi — pemindaian, analisis, antrian, menjalankan, validasi, penggantian model — harus dapat dieksekusi dengan sesedikit mungkin interaksi Claude. Alat ini harus sepenuhnya berfungsi untuk pengguna Claude paket gratis yang tidak membayar langganan Pro atau Max. Setiap panggilan alat menghabiskan anggaran penggunaan. Rancang sesuai.

**Satu instance whisper setiap saat.** Jangan pernah menelurkan proses whisper-cli.exe kedua saat satu sedang berjalan. Kunci proses bersifat wajib dan tidak dapat dinegosiasikan.

**Utamakan lokal, privat secara default.** Tidak ada audio yang pernah meninggalkan mesin. Tidak diperlukan API cloud untuk fungsionalitas inti. Integrasi opsional (misalnya unduhan model Hugging Face) harus didokumentasikan dengan jelas sebagai opsional.

**Kontrol pengguna yang eksplisit.** Tidak ada operasi massal yang diam. Tindakan yang merusak atau tidak dapat dibalik memerlukan konfirmasi. Pengguna harus selalu tahu apa yang akan terjadi sebelum itu terjadi.

**Jalur aman Unicode.** Semua I/O file harus menangani nama file non-ASCII dengan benar, termasuk bahasa Indonesia, Jepang, Cina, emoji, tanda kurung, dan karakter khusus lainnya.

**Modular dan dapat dikombinasikan.** Alat bersifat independen. Pengguna menggunakan apa yang mereka butuhkan. Tidak ada fitur yang harus memerlukan fitur lain kecuali tidak dapat dihindari.

**Optimasi sebelum fitur.** Saat ragu antara menambahkan fitur dan mengurangi beban sistem atau jumlah panggilan API, kurangi beban. Sesi optimasi besar itu mahal. Rancang arsitektur dengan benar sejak awal.

---

## Selesai

### ✅ v1.3.1 — Kunci Proses
Menambahkan pemeriksaan `isWhisperRunning()` menggunakan `tasklist /FI` sebelum menelurkan transkripsi apa pun. Mengembalikan kesalahan yang jelas dengan instruksi Task Manager daripada menelurkan proses yang bersaing.

### ✅ v1.4.0 — Akselerasi GPU Vulkan
Mengkompilasi whisper.cpp dari sumber dengan `-DGGML_VULKAN=ON` menggunakan VS Build Tools 2022 dan Vulkan SDK. Binary Vulkan yang sudah dikompilasi didistribusikan sebagai `whisper-vulkan-win-x64.zip`.

**Hasil pada AMD Radeon RX Vega 56:** Utilisasi GPU rata-rata ~16%. File 58 menit selesai dalam ~4.5 menit di GPU vs ~88 menit hanya CPU.

### ✅ v1.5.0 — Diagnostik Sistem
Alat `check_system`: Deteksi GPU via `wmic`, verifikasi Vulkan DLL, pelaporan VRAM, rekomendasi ukuran model.

### ✅ v1.6.0 — Pra-Analisis File
Alat `analyze_media` via FFprobe: durasi, ukuran, codec, status transkripsi, perkiraan waktu CPU dan GPU. Pemindaian file tunggal atau folder dengan opsi pengurutan.

### ✅ v1.7.0 — Transkripsi Latar Belakang + Visibilitas Kemajuan
Arsitektur proses terpisah: `transcribe_audio` dengan `background=true` menelurkan whisper sebagai proses terpisah dan segera mengembalikan ID tugas. `check_progress` mengurai timestamp segmen stderr whisper untuk persentase dan ETA real-time.

### ✅ v1.8.0 — Batch Berurutan dengan Validasi
`start_batch` dan `check_batch_progress`: pemrosesan berurutan otomatis, validasi transkripsi (deteksi output kosong/pendek), kemajuan antrian otomatis, timestamp kemajuan per file.

### ✅ v1.9.0 — Dukungan Multibahasa dan Terjemahan
`generate_subtitles` dengan deteksi `language=auto` dan output SRT ganda `translate_to_english=true`. Menambahkan dukungan format `.3gp` dan `.ts`. `language=auto` juga tersedia di `transcribe_audio`.

**Keterbatasan yang diketahui:** Terjemahan bawaan Whisper hanya menargetkan bahasa Inggris. Memerlukan model `large-v3` untuk bahasa non-Inggris — model khusus bahasa Inggris (`*.en.bin`) menghasilkan `[FOREIGN]` pada audio non-Inggris.

### ✅ v2.0.0 — Jalur Aman Unicode + SRT Latar Belakang
**Nama file Unicode:** File dengan karakter non-ASCII dalam nama file menyebabkan transkripsi latar belakang gagal secara diam-diam. Diperbaiki dengan merutekan semua output melalui jalur temp yang disanitasi berbasis ID tugas, kemudian memindahkan hasilnya ke tujuan yang benar setelah selesai.

**SRT dalam mode latar belakang:** `spawnDetached` sebelumnya mengkodekan keras `-otxt` terlepas dari format yang diminta, dan `generate_subtitles` memblokir secara sinkron dan mencapai timeout MCP 4 menit pada file yang lebih panjang. Diperbaiki dengan menambahkan parameter `outputFormat` ke `spawnDetached`, mendukung output `text` dan `srt` dalam mode latar belakang.

### ✅ v2.0.1 — Perbaikan Bug (dikirimkan dalam v2.2.0)
- `--max-context 0` dikodekan keras di `buildArgs` dan `spawnDetached` — mencegah loop halusinasi pada audio panjang. `--condition-on-previous-text` dan `--no-context` bukan flag valid dalam binary saat ini (era v1.8.3) — `--max-context N` adalah flag yang benar.
- `--no-speech-thold 0.6` dikodekan keras di kedua fungsi — segmen di bawah ambang kepercayaan diperlakukan sebagai keheningan daripada konten yang dihalusinasi.
- Validasi jalur (`validateInputPath`) — menolak jalur UNC dan traversal `..`.
- Penjaga ukuran file `MAX_FILE_SIZE_MB = 10240`.
- Komentar keamanan injeksi transkrip di `transcribeSingle`.
- Perintah CLI batch yang rusak diperbaiki di TROUBLESHOOTING.md — mendokumentasikan pendekatan konversi FFmpeg yang benar dan metode `Start-Process -RedirectStandardOutput`.

### ✅ v2.1.0 — Suite Manajemen Model (dikirimkan dalam v2.2.0)
- `WHISPER_MODEL` diubah dari `const` ke `let` (dapat diubah dalam sesi).
- `MODEL_REGISTRY` — 16 model, varian presisi penuh dan terkuantisasi, URL unduhan Hugging Face.
- `ALLOWED_HF_PREFIXES` — daftar putih URL yang membatasi unduhan ke namespace `ggerganov/whisper.cpp` dan `ggml-org`.
- Alat `list_models` — memindai direktori model, menampilkan model aktif, ukuran, kasus penggunaan, unduhan yang tersedia.
- Alat `download_model` — mengunduh dari Hugging Face via `https` bawaan Node.js, penggantian nama atomik (perbaikan race condition pelepasan file handle Windows).
- Alat `switch_model` — memvalidasi ekstensi `.bin`, batasan direktori, pemeriksaan kunci proses.
- `recommendedModel()` diperbarui untuk merekomendasikan `large-v3-turbo` untuk VRAM 6GB+.

### ✅ v2.2.0 — Perluasan Kualitas, Parameter, dan Hardware (saat ini)
- Interface `WhisperOptions` menggantikan argumen posisional di `buildArgs`.
- Parameter baru di `transcribe_audio`: `temperature`, `prompt`, `condition_on_prev_text`, `no_speech_thold`, `beam_size`, `best_of`, `gpu_device`, `processors`, `word_timestamps`, `max_segment_length`, `split_on_word`, `diarize`, `vad_model`, `offset_t`, `duration`.
- Parameter baru di `generate_subtitles`: `temperature`, `prompt`, `beam_size`, `best_of`, `diarize`, `vad_model`.
- `spawnDetached` direfaktor — semua flag kualitas sekarang diterapkan dalam mode latar belakang/batch.
- `runSrtPass` diperbarui untuk menerima `extraOpts`.
- Perbaikan output batch — `readBatchProgress` sekarang memindahkan output temp ke tujuan akhir sebelum memvalidasi (ini adalah akar penyebab semua hasil batch "gagal").

**Catatan kompatibilitas flag:** `gpu_device` / `-g` ditambahkan dalam whisper.cpp v1.8.4. Binary Vulkan yang sudah dikompilasi dalam rilis adalah era v1.8.3 — parameter ini diterima oleh alat tetapi tidak akan berpengaruh sampai pengguna memperbarui ke binary v1.8.4+.

**Flag valid yang dikonfirmasi dalam binary saat ini (era v1.8.3):**
`--max-context`, `--no-speech-thold`, `--processors`, `--offset-t`, `--duration`, `--best-of`, `--beam-size`, `--diarize`, `--tinydiarize`, `--temperature`, `--prompt`, flag VAD.

**Tidak ada dalam binary saat ini:** `--no-context` (gunakan `--max-context 0`), `--condition-on-previous-text` (hanya nama Python API), `--gpu-device` / `-g` (v1.8.4+).

---

## Bug Kritis — Kemajuan Otomatis Batch (Dikonfirmasi, Perbaikan Tertunda)

### Batch Tidak Maju Tanpa Polling Aktif

`start_batch` tidak secara otonom maju melalui antrian antar file. Batch hanya berlanjut saat `check_batch_progress` dipanggil. Tanpa polling, batch macet tanpa batas setelah setiap file — whisper-cli.exe keluar, tidak ada proses baru yang ditelurkan, dan antrian tidak maju.

Ini merusak pemrosesan batch semalaman tanpa pengawasan, yang merupakan tujuan desain inti alat, dan secara langsung melanggar prinsip desain meminimalkan panggilan Claude API. Batch 95 file klip pendek memerlukan sekitar 200 panggilan polling selama 100 menit untuk selesai.

**Akar penyebab:** `readBatchProgress` berisi semua logika kemajuan antrian. Ini hanya dieksekusi saat `check_batch_progress` dipanggil secara eksplisit. Tidak ada timer latar belakang, pengawas file, atau loop otonom.

**Perbaikan yang direncanakan — Opsi B (exit callback, sangat disukai):** Lampirkan handler `on('exit')` ke proses anak whisper-cli yang ditelurkan. Saat proses keluar, segera panggil logika kemajuan untuk memvalidasi output dan menelurkan tugas berikutnya. Berbasis event, terpicu tepat sekali per penyelesaian file, tanpa overhead polling, tanpa panggilan API yang dikonsumsi.

**Opsi A (hanya cadangan):** `setInterval` latar belakang dengan interval polling berbasis durasi yang diturunkan dari data durasi FFprobe yang sudah ada dalam status batch JSON. Ukuran file bukan proksi yang andal untuk durasi.

**Batasan tambahan:** Perbaikan tidak boleh menelurkan whisper-cli.exe kedua saat satu sudah berjalan — kunci proses harus dihormati dalam jalur kemajuan otomatis.

**Solusi sementara (saat ini):** Panggil `check_batch_progress` berulang kali hingga batch selesai. Sekitar satu polling per file diperlukan.

---

## Direncanakan — Arsitektur Privasi (Sebelum Migrasi Bun)

Perubahan ini harus dikirimkan sebelum migrasi Bun dan sebelum perubahan lisensi apa pun yang memfasilitasi adopsi komersial atau perusahaan. Mengirimkan alat tingkat perusahaan tanpa perlindungan kepatuhan yang telah diselesaikan menciptakan kewajiban bagi pengguna di industri yang diatur.

### Variabel Lingkungan `WHISPER_PRIVACY_MODE`
Alat saat ini menjamin bahwa tidak ada **audio** yang meninggalkan mesin. Ini tidak memperluas jaminan ini ke **teks transkrip** — saat konten transkrip dikembalikan sebaris dalam respons alat, teks tersebut diproses oleh API Claude dan meninggalkan lingkungan lokal.

Celah ini tidak terlihat oleh pengguna yang secara wajar mengartikan "tidak ada data yang meninggalkan mesin" mencakup semua konten yang berasal dari audio mereka.

Tambahkan `WHISPER_PRIVACY_MODE` sebagai variabel lingkungan di `claude_desktop_config.json`. Saat diaktifkan:
- Semua respons alat hanya mengembalikan metadata: nama file, durasi, jumlah kata, status penyelesaian
- Tidak ada teks transkrip yang disertakan dalam respons alat mana pun
- Claude tidak dapat membaca, menganalisis, atau meneruskan konten transkrip dalam bentuk apa pun
- Transkrip hanya ada sebagai file `.txt` lokal

Ini adalah solusi yang tepat untuk penerapan medis, hukum, keuangan, dan perusahaan. Nol panggilan API, nol transmisi data, nol risiko kepatuhan.

### Gerbang Persetujuan untuk Konten Transkrip
Saat `WHISPER_PRIVACY_MODE` tidak diaktifkan (default), setiap respons alat yang menyertakan teks transkrip harus didahului oleh pengungkapan pada penggunaan pertama per sesi. Pengungkapan harus mengkomunikasikan dengan jelas bahwa teks transkrip dikirim ke API Anthropic, bahwa ini berada di luar jaminan "tidak ada data yang meninggalkan mesin", dan bahwa pengguna yang menangani konten yang diatur harus memverifikasi kewajiban kepatuhan sebelum melanjutkan.

Implementasi: variabel lingkungan `WHISPER_CONSENT_ACKNOWLEDGED` yang default ke `false`. Pada pengembalian transkrip pertama per sesi, jika belum diakui, Claude menyajikan pengungkapan dan meminta konfirmasi eksplisit. Setelah diakui untuk sesi tersebut, transkrip berikutnya dikembalikan tanpa meminta ulang.

### Dokumentasi `PRIVACY.md`
Buat `PRIVACY.md` di root repo yang mencakup:
- Data apa yang tetap lokal (selalu): file audio, video, model
- Data apa yang mungkin meninggalkan lokal (secara default): teks transkrip dalam respons alat
- Data apa yang tidak pernah meninggalkan lokal (dengan mode privasi): semuanya
- Panduan kerangka kepatuhan berdasarkan industri (HIPAA, GDPR, hak istimewa pengacara-klien, FERPA, SOX, PCI-DSS, NDA/rahasia dagang)
- Cara mengkonfigurasi mode privasi
- Penafian bahwa penulis alat bukan penasihat hukum

### Peringatan Privasi Schema Alat
Perbarui deskripsi alat `ListToolsRequestSchema` untuk menyertakan catatan privasi pada alat apa pun yang mengembalikan teks transkrip. Ini muncul di deskripsi alat Claude Desktop dan menciptakan kesadaran pada titik penggunaan.

### Pembersihan Otomatis Direktori Temp
`%TEMP%\whisper-mcp-jobs\` mengakumulasi file status tugas dan log dari waktu ke waktu. Tambahkan pembersihan otomatis file tugas yang selesai setelah jendela retensi yang dapat dikonfigurasi (default: 7 hari). Saat ini memerlukan `Remove-Item` manual oleh pengguna.

---

## Direncanakan — Migrasi Bun

Migrasikan runtime dari Node.js ke [Bun](https://bun.sh) setelah arsitektur privasi selesai dan sebelum penambahan fitur v2.3.0.

Karena Claude Desktop menelurkan server MCP baru setiap kali sesi dimulai, waktu startup berada di jalur kritis. Bun menjalankan TypeScript secara asli tanpa langkah kompilasi, memulai jauh lebih cepat dari Node, dan memiliki I/O yang lebih cepat.

**Yang berubah:**
- Menghilangkan langkah build `tsc` dan direktori `dist/`
- Pengguna menjalankan source TypeScript secara langsung
- `tsconfig.json` menjadi opsional
- Skrip `package.json` diperbarui
- Alur kerja publish npm diperbarui

**Yang tidak berubah:**
- Source code `src/index.ts` — Bun kompatibel dengan TypeScript yang ada dan API bawaan Node.js
- Semua perilaku alat dan format output
- Konfigurasi Claude Desktop untuk pengguna akhir

**Mengapa setelah privasi, sebelum v2.3.0:** Codebase paling mudah untuk dimigrasikan sekarang. Bermigrasi setelah menambahkan lebih banyak alat hanya menambah permukaan area tanpa manfaat. Arsitektur privasi harus ada terlebih dahulu seperti yang dicatat di atas.

---

## Direncanakan — Tinjauan Lisensi (Setelah Migrasi Bun)

Lisensi MIT saat ini mengizinkan penggunaan komersial tanpa batas. Sebelum alat ini mencapai pasar profesional dan perusahaan dalam skala besar, situasi lisensi harus dievaluasi.

**Pendekatan yang direncanakan — Lisensi ganda:**
- MIT untuk penggunaan pribadi dan non-komersial (tidak ada perubahan untuk pengguna yang ada)
- Lisensi komersial terpisah untuk penggunaan bisnis dan perusahaan
- Titik transisi: rilis versi utama berikutnya setelah migrasi Bun

**Mengapa tidak sekarang:** Perubahan lisensi sebelum arsitektur privasi selesai berarti menjual lisensi komersial untuk alat dengan celah kepatuhan HIPAA/GDPR yang belum terselesaikan. Privasi dikirimkan lebih dulu. Tinjauan lisensi mengikuti.

Lisensi komersial, peringatan privasi schema alat, dan `PRIVACY.md` bersama-sama membentuk cerita kepatuhan minimum yang layak untuk pembeli perusahaan.

---

## Direncanakan — v2.3.0: Perluasan Format Output

### Format Subtitle VTT
Output WebVTT (`.vtt`) bersama SRT. VTT adalah standar web yang digunakan oleh YouTube, HTML5 `<video>`, dan sebagian besar pemutar modern. whisper-cli mendukungnya secara asli. Tambahkan `vtt` sebagai format output yang valid di `transcribe_audio`, `generate_subtitles`, dan `spawnDetached`. Perbarui `buildArgs` dan semua schema alat yang relevan, README, dan dokumentasi multibahasa.

### Format LRC
Output format LRC (`.lrc`) lirik/karaoke via `-olrc`. Digunakan oleh pemutar media untuk tampilan lirik yang tersinkronisasi. Nol biaya implementasi — flag CLI asli.

### Format CSV
Output CSV (`.csv`) via `-ocsv`. Data tabular terstruktur dengan timing segmen — berguna untuk analisis downstream, alur kerja penyelarasan klip, dan impor ke alat spreadsheet. Nol biaya implementasi — flag CLI asli.

---

## Direncanakan — Rilis Mendatang

### TinyDiarize
Dukungan flag `--tinydiarize` dengan varian model yang mendukung `tdrz` (misalnya `large-v2-tdrz`). Berbeda dengan flag `--diarize` stereo, TinyDiarize bekerja pada rekaman mono. Memerlukan unduhan varian model khusus. Akurasi lebih rendah dari diarisasi berbasis pyannote tetapi nol dependensi tambahan di luar file model.

**Status:** Direncanakan. Bergantung pada `download_model` yang mendukung varian model tdrz.

### Transkripsi URL YouTube
Transkripsi langsung dari URL YouTube via yt-dlp. Mengunduh audio dan mentranskrip dalam satu langkah. Memerlukan yt-dlp yang terpasang dan ada di PATH.

**Batasan desain:** yt-dlp bersifat opsional. Alat harus terdegradasi dengan anggun dengan instruksi instalasi yang jelas jika tidak ditemukan. Tidak ada perubahan pada fungsionalitas inti untuk pengguna yang tidak membutuhkannya.

### Alat Alur Kerja Proyek Video
Untuk pengguna yang mengelola proyek pengeditan video besar dengan direktori klip sumber dan yang telah diedit:

1. Pindai direktori sumber dan subdirektori klip
2. Cocokkan transkrip klip yang telah diedit dengan transkrip sumber secara fuzzy untuk menemukan titik asal
3. Tampilkan nama file deskriptif yang disarankan Claude berdasarkan konten transkrip, memerlukan konfirmasi eksplisit pengguna sebelum penggantian nama dieksekusi
4. Pencarian transkrip di seluruh direktori proyek dengan hasil timecode

**Batasan desain:**
- File sumber **tidak pernah diganti nama atau dimodifikasi**
- Semua penggantian nama memerlukan **konfirmasi eksplisit pengguna**
- Pencarian adalah alat mandiri yang dapat digunakan secara independen
- Analisis dan pencocokan terjadi secara lokal — Claude hanya dipanggil saat pengguna meninjau hasil, meminimalkan panggilan API

**Status:** Fase desain.

### Diarisasi Pembicara (pyannote-audio)
Diarisasi pembicara mono penuh dengan label ID pembicara — menandai transisi pembicara di seluruh rekaman terlepas dari konfigurasi saluran. Berbeda dari flag `--diarize` stereo bawaan (v2.2.0) dan TinyDiarize.

**Implementasi:** Memerlukan [pyannote-audio](https://github.com/pyannote/pyannote-audio) — library berbasis Python dengan persyaratan token akses model Hugging Face. Stack dependensi yang sepenuhnya terpisah dari pipeline whisper.cpp.

**Status:** Fitur lanjutan opsional dengan dokumentasi pengaturannya sendiri. Tidak termasuk dalam paket utama.

### Terjemahan ke Bahasa Non-Inggris
Flag `--translate` Whisper hanya menargetkan bahasa Inggris. Mendukung bahasa target sembarang memerlukan API terjemahan eksternal atau model terjemahan lokal.

**Opsi yang sedang dipertimbangkan:** LibreTranslate (dapat di-host sendiri, utamakan lokal), terjemahan LLM lokal, atau dokumentasi di luar cakupan yang eksplisit.

**Status:** Ditangguhkan menunggu keputusan desain tentang utamakan lokal vs ketergantungan API.

### Pembersihan dan Pemformatan Transkrip
Pipeline pasca-pemrosesan:
- Penghapusan kata pengisi dan awal yang salah (opsional, dikontrol pengguna)
- Jeda paragraf pada batas topik yang alami
- Pemformatan sadar pembicara saat dikombinasikan dengan output diarisasi
- Ekspor ke PDF atau DOCX

**Status:** Direncanakan. Varian sadar pembicara bergantung pada diarisasi.

---

## Distribusi

Tersedia di [npm](https://www.npmjs.com/package/whisper-windows-mcp), [mcpservers.org](https://mcpservers.org), dan [Glama](https://glama.ai).

---

## Dokumentasi Multibahasa

Dokumentasi bahasa Jepang, Korea, Vietnam, dan Indonesia dipertahankan secara paralel dengan bahasa Inggris. File-file berikut harus diperbarui agar sesuai dengan dokumen bahasa Inggris setelah setiap rilis:

**Jepang (`*.ja.md`)**
- `README.ja.md` / `TROUBLESHOOTING.ja.md` / `ROADMAP.ja.md` / `PRIVACY.ja.md` / `SECURITY.ja.md`

**Korea (`*.ko.md`)**
- `README.ko.md` / `TROUBLESHOOTING.ko.md` / `ROADMAP.ko.md` / `PRIVACY.ko.md` / `SECURITY.ko.md`

**Vietnam (`*.vi.md`)**
- `README.vi.md` / `TROUBLESHOOTING.vi.md` / `ROADMAP.vi.md` / `PRIVACY.vi.md` / `SECURITY.vi.md`

**Indonesia (`*.id.md`)** — `README.id.md` / `TROUBLESHOOTING.id.md` / `ROADMAP.id.md` / `PRIVACY.id.md` / `SECURITY.id.md`

**Ukraina (`*.uk.md`)** — `README.uk.md` / `TROUBLESHOOTING.uk.md` / `ROADMAP.uk.md` / `PRIVACY.uk.md` / `SECURITY.uk.md`

**Portugis Brasil (`*.pt-BR.md`)** — `README.pt-BR.md` / `TROUBLESHOOTING.pt-BR.md` / `ROADMAP.pt-BR.md` / `PRIVACY.pt-BR.md` / `SECURITY.pt-BR.md`

**Spanyol (`*.es.md`)** — `README.es.md` / `TROUBLESHOOTING.es.md` / `ROADMAP.es.md` / `PRIVACY.es.md` / `SECURITY.es.md`

Kontribusi komunitas untuk bahasa lain disambut.

---

## Berkontribusi

Pull request disambut. Periksa issue yang ada sebelum memulai pekerjaan.

Jika Anda telah menguji akselerasi GPU pada hardware yang tidak tercantum di atas, silakan buka issue dengan model GPU, VRAM, ukuran model, dan throughput yang diamati. Ini membantu membangun referensi performa yang akurat untuk pengguna lain.
