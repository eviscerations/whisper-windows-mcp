# whisper-windows-mcp — Peta Jalan

Versi saat ini: **v2.3.0**

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

**SRT dalam mode latar belakang:** `spawnDetached` sebelumnya mengkodekan keras `-otxt` terlepas dari format yang diminta. Diperbaiki dengan menambahkan parameter `outputFormat` ke `spawnDetached`, mendukung output `text` dan `srt` dalam mode latar belakang.

### ✅ v2.0.1 — Perbaikan Bug (dikirimkan dalam v2.2.0)
- `--max-context 0` dikodekan keras di `buildArgs` dan `spawnDetached` — mencegah loop halusinasi pada audio panjang.
- `--no-speech-thold 0.6` dikodekan keras di kedua fungsi — segmen di bawah ambang kepercayaan diperlakukan sebagai keheningan daripada konten yang dihalusinasi.
- Validasi jalur (`validateInputPath`) — menolak jalur UNC dan traversal `..`.
- Penjaga ukuran file `MAX_FILE_SIZE_MB = 10240`.
- Komentar keamanan injeksi transkrip di `transcribeSingle`.
- Perintah CLI batch yang rusak diperbaiki di TROUBLESHOOTING.md.

### ✅ v2.1.0 — Suite Manajemen Model (dikirimkan dalam v2.2.0)
- `WHISPER_MODEL` diubah dari `const` ke `let` (dapat diubah dalam sesi).
- `MODEL_REGISTRY` — 16 model, varian presisi penuh dan terkuantisasi, URL unduhan Hugging Face.
- `ALLOWED_HF_PREFIXES` — daftar putih URL yang membatasi unduhan ke namespace `ggerganov/whisper.cpp` dan `ggml-org`.
- Alat `list_models` — memindai direktori model, menampilkan model aktif, ukuran, kasus penggunaan, unduhan yang tersedia.
- Alat `download_model` — mengunduh dari Hugging Face via `https` bawaan Node.js, penggantian nama atomik.
- Alat `switch_model` — memvalidasi ekstensi `.bin`, batasan direktori, pemeriksaan kunci proses.
- `recommendedModel()` diperbarui untuk merekomendasikan `large-v3-turbo` untuk VRAM 6GB+.

### ✅ v2.2.0 — Perluasan Kualitas, Parameter, dan Hardware
- Interface `WhisperOptions` menggantikan argumen posisional di `buildArgs`.
- Parameter baru di `transcribe_audio`: `temperature`, `prompt`, `condition_on_prev_text`, `no_speech_thold`, `beam_size`, `best_of`, `gpu_device`, `processors`, `word_timestamps`, `max_segment_length`, `split_on_word`, `diarize`, `vad_model`, `offset_t`, `duration`.
- Parameter baru di `generate_subtitles`: `temperature`, `prompt`, `beam_size`, `best_of`, `diarize`, `vad_model`.
- `spawnDetached` direfaktor — semua flag kualitas diterapkan dalam mode latar belakang/batch.
- Perbaikan output batch — `readBatchProgress` sekarang memindahkan output temp ke tujuan akhir sebelum memvalidasi.

**Catatan kompatibilitas flag:** `gpu_device` / `--device` ditambahkan dalam whisper.cpp v1.8.4. Binary Vulkan yang sudah dikompilasi dalam rilis adalah era v1.8.3 — parameter ini diterima oleh alat tetapi tidak akan berpengaruh sampai pengguna memperbarui ke binary v1.8.4+.

### ✅ v2.2.2 — Patch
- Perbaikan lisensi ganda — LICENSE dan LICENSE-COMMERCIAL.md dikoreksi.
- Koreksi dokumentasi minor.

### ✅ v2.3.0 — Kemajuan Otomatis Batch, Arsitektur Privasi, Perluasan Format Output

**Kemajuan otomatis batch (perbaikan bug kritis):** `start_batch` sebelumnya memerlukan polling aktif untuk maju melalui antrian. Handler `on('exit')` kini dilampirkan ke setiap proses anak whisper-cli yang ditelurkan. Saat proses keluar, batch maju sendiri segera melalui exit callback tanpa overhead polling dan tanpa panggilan API yang dikonsumsi. Mutex mencegah double-spawn antara exit handler + panggilan `check_batch_progress` yang bersamaan.

**Arsitektur privasi:**
- Variabel lingkungan `WHISPER_PRIVACY_MODE` — saat `true`, semua respons alat hanya mengembalikan metadata (nama file, jumlah kata, jalur penyimpanan). Tidak ada teks transkrip yang pernah dikirimkan ke API Claude. Transkrip hanya ada sebagai file lokal.
- Variabel lingkungan `WHISPER_CONSENT_ACKNOWLEDGED` — saat `true`, melewati gerbang persetujuan sesi satu kali untuk konten yang tidak sensitif.
- Parameter per-panggilan `privacy_mode` pada `transcribe_audio`, `transcribe_batch`, `start_batch`, dan `check_progress`. Menggantikan variabel lingkungan global dalam kedua arah. Tidak perlu restart untuk toggle per-panggilan.
- Gerbang mode privasi (`checkPrivacyGate()`) — aktif sebelum setiap operasi saat mode privasi efektif aktif. Dipersenjatai pada panggilan pertama (menampilkan pengungkapan), dibersihkan pada panggilan kedua (mengizinkan). Direset setelah setiap operasi. Sepenuhnya independen dari gerbang persetujuan sesi.
- Gerbang persetujuan sesi (`transcriptPolicy()`) — aktif sekali per sesi sebelum panggilan pertama yang mengembalikan transkrip dalam mode standar. Dikonsumsi oleh flag `sessionConsentGiven`.
- `PRIVACY.md` — dokumentasi kepatuhan lengkap mencakup HIPAA, GDPR, hak istimewa pengacara-klien, FERPA, SOX, PCI-DSS, dan NDA/rahasia dagang.
- Peringatan privasi deskripsi alat pada semua alat yang mengembalikan transkrip.

**Perluasan format output:**
- `vtt` — output subtitle WebVTT via `-ovtt`. Tersedia di `transcribe_audio`, `generate_subtitles`, `start_batch`, dan mode latar belakang.
- `lrc` — format lirik/karaoke LRC via `-olrc`. Tersedia di `transcribe_audio` dan mode latar belakang.
- `csv` — CSV dengan timestamp via `-ocsv`. Tersedia di `transcribe_audio` dan mode latar belakang.
- Default `output_format` diubah dari `"text"` ke `"timestamps"` di semua alat dan jalur kode. Teks biasa kini opt-in.

**Perbaikan bug:**
- Bug 1: `output_format` tidak diteruskan ke tugas latar belakang — default `"text"` digunakan terlepas dari format yang diminta. Diperbaiki dengan mengubah default ke `"timestamps"` dan meneruskannya dengan benar.
- Bug 2: `catch {}` diam dalam operasi pemindahan output tugas latar belakang menelan kegagalan. Menambahkan pemeriksaan `existsSync` eksplisit dengan pesan kegagalan terperinci setelah pemindahan.
- Bug 3: Komentar desain ditambahkan di titik spawn latar belakang yang mendokumentasikan mengapa gerbang persetujuan sengaja ditangguhkan ke `check_progress` untuk tugas latar belakang non-privasi.

**Tambahan:**
- Pembersihan otomatis direktori temp — `cleanupOldJobFiles()` berjalan saat startup, menghapus file `.json` dan `.log` yang lebih dari 7 hari dari `%TEMP%\whisper-mcp-jobs\`.
- `check_config` kini melaporkan status mode privasi.
- Log startup melaporkan mode privasi aktif/nonaktif.
- Interface `Job` diperluas dengan field `privacyMode: boolean`.
- Interface `BatchState` diperluas dengan field `privacyMode: boolean`.
- Tipe `BackgroundFormat` mengecualikan `json` (json dalam mode latar belakang tetap tidak didukung — kembali ke `text`).

---

## Direncanakan — v2.4.0: Migrasi Bun

Migrasikan runtime dari Node.js ke [Bun](https://bun.sh).

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

---

## Direncanakan — v2.5.0: Format Output Lanjutan untuk Integrasi Alat Eksternal

Dukungan format output lanjutan yang ditargetkan untuk analisis downstream dan alur kerja integrasi. Cakupan tepat akan ditentukan berdasarkan umpan balik pengguna pasca-v2.3.0.

---

## Direncanakan — v2.6.0: Mode Transkripsi Mikrofon Langsung

Transkripsi real-time dari input mikrofon langsung. Streaming audio dari perangkat rekaman yang dipilih ke whisper dalam potongan, mengembalikan segmen transkrip bergulir saat selesai.

**Batasan desain:**
- Pemilihan perangkat harus eksplisit — tidak ada penangkapan perangkat default yang diam
- Pengguna harus dapat menghentikan stream melalui interaksi Claude Desktop
- Tidak boleh bertentangan dengan batasan satu-instance-whisper-setiap-saat
- Trade-off latensi vs akurasi harus dapat dikonfigurasi pengguna

**Status:** Fase desain. Bergantung pada API streaming yang stabil di whisper.cpp.

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

**Implementasi:** Memerlukan [pyannote-audio](https://github.com/pyannote/pyannote-audio) — library berbasis Python dengan persyaratan token akses model Hugging Face. Stack dependensi yang sepenuhnya terpisah.

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

## Lisensi

whisper-windows-mcp menggunakan lisensi ganda.

**Penggunaan non-komersial:** MIT — gratis untuk penggunaan pribadi, pendidikan, dan non-komersial. Lihat [LICENSE](LICENSE).

**Penggunaan komersial:** Diperlukan perjanjian lisensi komersial terpisah untuk penggunaan bisnis, profesional, atau menghasilkan pendapatan. Lihat [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md) untuk syarat dan informasi kontak.

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
