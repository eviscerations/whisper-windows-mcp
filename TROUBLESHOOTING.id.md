# Pemecahan Masalah — whisper-windows-mcp

---

## Daftar Periksa Cepat

Sebelum menyelidiki masalah tertentu, verifikasi hal-hal dasar berikut:

- Jalur di `claude_desktop_config.json` menggunakan **dua backslash** (`C:\\whisper\\Release\\whisper-cli.exe`)
- `whisper-cli.exe` ada di jalur yang dikonfigurasi dalam `WHISPER_CLI_PATH`
- File model `.bin` ada di jalur yang dikonfigurasi dalam `WHISPER_MODEL`
- FFmpeg terpasang dan ada di PATH — jalankan `ffmpeg -version` di terminal untuk mengkonfirmasi
- Claude Desktop sudah **di-restart penuh** setelah mengedit konfigurasi (keluar dari system tray, bukan sekadar menutup jendela)
- Whisper menampilkan **lencana berjalan berwarna hijau** di Claude Desktop → Pengaturan → Pengembang

---

## Instalasi dan Startup

### Whisper tidak muncul di Claude Desktop → Pengaturan → Pengembang

1. Buka Claude Desktop → Pengaturan → Pengembang → Edit Konfigurasi
2. Konfirmasi JSON valid — tempelkan ke [jsonlint.com](https://jsonlint.com) jika tidak yakin
3. Konfirmasi `WHISPER_CLI_PATH` dan `WHISPER_MODEL` menunjuk ke file yang benar-benar ada
4. Keluar dari Claude Desktop dari system tray (klik kanan ikon tray → Keluar)
5. Luncurkan kembali Claude Desktop dan periksa lagi

Jika whisper muncul tetapi menampilkan lencana error bukan hijau:
- Tanya Claude: *"Periksa konfigurasi whisper"* — alat `check_config` mengembalikan pesan error yang spesifik
- Buka Claude Desktop → Pengaturan → Pengembang → klik nama server untuk melihat log error

### Error "whisper-cli.exe tidak ditemukan"

Jalur di `WHISPER_CLI_PATH` tidak sesuai dengan lokasi binary yang diekstrak.

Jalur default yang diharapkan: `C:\whisper\Release\whisper-cli.exe`

Konfirmasi file ada:
```powershell
Test-Path "C:\whisper\Release\whisper-cli.exe"
```

Seharusnya mengembalikan `True`. Jika mengembalikan `False`, ekstrak zip rilis ke `C:\whisper\Release\` atau perbarui `WHISPER_CLI_PATH` di konfigurasi Anda agar sesuai dengan lokasi sebenarnya.

### Error "Model tidak ditemukan"

Jalur di `WHISPER_MODEL` tidak sesuai dengan lokasi atau nama file model yang sebenarnya.

Periksa direktori model:
```powershell
Get-ChildItem "C:\whisper\models\"
```

Nama file harus menyertakan nama lengkap termasuk sufiks kuantisasi, misalnya `ggml-large-v3-turbo-q5_0.bin` bukan `ggml-large-v3-turbo.bin`. Jika tidak ada model yang terpasang, gunakan `download_model` di Claude Desktop.

---

## Akselerasi GPU

### Transkripsi lambat — hanya CPU, tidak ada GPU

Tanya Claude: *"Periksa hardware sistem"*

Alat `check_system` mengkonfirmasi apakah `ggml-vulkan.dll` ada di direktori binary whisper. Jika DLL tidak ada, Anda menjalankan CPU-only terlepas dari GPU Anda.

**Perbaikan:** Unduh `whisper-vulkan-win-x64.zip` dari [halaman rilis](https://github.com/eviscerations/whisper-windows-mcp/releases/tag/v1.4.0) dan ekstrak ke `C:\whisper\Release\`. Zip menyertakan DLL — harus berada di direktori yang sama dengan `whisper-cli.exe`.

### GPU terdeteksi tetapi utilisasi 0% selama transkripsi

Binary berjalan tetapi tidak mendispatch ke GPU. Ini biasanya berarti:
- Vulkan SDK tidak terpasang atau driver GPU tidak mengekspos antarmuka Vulkan
- GPU lebih tua dari Vulkan 1.0 (jarang — sebagian besar GPU sejak 2016 mendukungnya)

Periksa dukungan Vulkan:
```powershell
# Pasang vulkaninfo via Vulkan SDK jika diperlukan, kemudian:
vulkaninfo
```

Output apa pun mengkonfirmasi Vulkan tersedia. Jika `vulkaninfo` gagal, pasang driver GPU terbaru dari situs vendor GPU Anda.

### Transkripsi berjalan di GPU yang salah (sistem multi-GPU)

Secara default whisper-cli menggunakan perangkat Vulkan 0. Pada mesin multi-GPU, itu mungkin bukan kartu yang Anda inginkan. Sematkan perangkat tertentu dengan variabel lingkungan `WHISPER_GPU_DEVICE` (atau parameter `gpu_device` per-panggilan, yang kini juga berfungsi pada `generate_subtitles`):

```json
"env": { "WHISPER_GPU_DEVICE": "1" }
```

⚠️ **Indeks adalah urutan enumerasi Vulkan, BUKAN urutan "GPU 0 / GPU 1" Windows** — keduanya sering berbeda. Untuk menemukan angka yang tepat, jalankan `whisper-cli.exe` pada file apa pun sekali dan baca log startup-nya: ia mencetak `ggml_vulkan: 0 = <nama>`, `ggml_vulkan: 1 = <nama>`. Gunakan indeks yang mencantumkan kartu target Anda. `check_config` menggemakan perangkat aktif sehingga Anda dapat memastikan penyematan berhasil.

### VRAM dilaporkan setengah ukuran sebenarnya (AMD)

Ini adalah keanehan pelaporan Windows yang diketahui untuk GPU AMD dengan memori terpadu/berbagi. VRAM yang sebenarnya tersedia untuk pemrosesan biasanya dua kali lipat dari yang dilaporkan `wmic`. Rekomendasi model mungkin terlalu konservatif akibatnya — Anda bisa mencoba model yang lebih besar dari yang direkomendasikan dan mengamati apakah transkripsi berhasil diselesaikan.

---

## Kualitas Transkripsi

### Output mengandung teks halusinasi atau frasa berulang

Whisper terkadang berhalusinasi pada segmen audio yang senyap atau berkualitas rendah. Alat menerapkan `--max-context 0` dan `--no-speech-thold 0.6` secara default untuk meminimalkan hal ini.

Pendekatan tambahan:
- Gunakan `temperature=0.2` — sedikit keacakan membantu memutus loop halusinasi pada audio yang bising
- Gunakan model VAD (Voice Activity Detection): unduh file `.bin` model Silero VAD dan teruskan jalurnya sebagai `vad_model`. Ini menghapus keheningan sebelum transkripsi, yang merupakan perbaikan paling efektif untuk halusinasi pada rekaman dengan jeda.
- Gunakan model yang lebih besar (`large-v3` atau `large-v3-turbo`) — model yang lebih kecil lebih sering berhalusinasi pada audio yang sulit
- Gunakan `prompt` untuk mengatur konteks: *"Ini adalah wawancara podcast tentang rekayasa perangkat lunak."*

### Output transkripsi kosong atau sangat pendek

Tanya Claude: *"Analisis file ini"* (`analyze_media`) untuk mengkonfirmasi file memiliki konten audio dan merupakan format yang dikenali.

Jika FFprobe melaporkan audio tetapi transkripsi tidak menghasilkan apa-apa:
- File mungkin dalam bahasa yang tidak sesuai dengan parameter `language` yang dikonfigurasi
- Coba `language=auto` untuk membiarkan Whisper mendeteksi bahasa
- Audio mungkin terlalu pelan atau telah diproses secara berlebihan — transkripsi memerlukan ucapan yang dapat dipahami

### Output mode timestamps berbeda dari SRT

Dalam mode `timestamps`, output dicetak ke stdout whisper sebagai baris `[HH:MM:SS.mmm --> HH:MM:SS.mmm]  teks` biasa. Dalam mode `srt`, whisper memformat output dalam blok SRT bernomor. Batas segmen mungkin sedikit berbeda karena kedua jalur menggunakan flag output yang berbeda. Keduanya valid — gunakan `srt` atau `vtt` saat Anda membutuhkan format file subtitle, dan `timestamps` saat Anda menginginkan teks bertimestamp mentah.

---

## Mode Privasi dan Gerbang Persetujuan

### Saya tidak melihat prompt persetujuan sebelum transkripsi

Gerbang persetujuan aktif **sekali per sesi** dalam mode standar. Jika Anda sudah mengkonfirmasi transkripsi dalam sesi ini (sejak restart Claude Desktop terakhir), gerbang tidak akan aktif lagi.

Alasan lain gerbang mungkin tidak muncul:
- `WHISPER_CONSENT_ACKNOWLEDGED=true` diatur di konfigurasi Anda — ini melewati gerbang sepenuhnya
- `WHISPER_PRIVACY_MODE=true` diatur — mode privasi menggunakan gerbang per-operasi terpisahnya sendiri, bukan gerbang persetujuan
- Anda memeriksa kemajuan transkripsi pemblokiran yang sudah selesai — gerbang dikonsumsi di awal tugas

**Untuk mereset dan melihat gerbang lagi:** restart penuh Claude Desktop (keluar dari system tray, luncurkan kembali).

### Claude memproses file saya tanpa bertanya terlebih dahulu

Jika `WHISPER_CONSENT_ACKNOWLEDGED=true` ada di konfigurasi Anda, gerbang dilewati berdasarkan desain. Ini adalah perilaku yang dimaksudkan untuk pengguna yang telah meninjau implikasi privasi dan tidak lagi membutuhkan pengingat.

Jika tidak diatur dan Claude melanjutkan tanpa bertanya, gerbang sesi sudah dikonsumsi oleh transkripsi sebelumnya dalam sesi yang sama. Gerbang aktif sekali per sesi.

Untuk konfirmasi per-operasi pada setiap transkripsi terlepas dari status sesi, aktifkan mode privasi: teruskan `privacy_mode=true` atau atur `WHISPER_PRIVACY_MODE=true` di konfigurasi Anda.

### Mode privasi aktif tetapi saya ingin membaca satu transkrip

Teruskan `privacy_mode=false` langsung ke alat transkripsi untuk panggilan spesifik tersebut. Ini menggantikan pengaturan global `WHISPER_PRIVACY_MODE=true` hanya untuk satu panggilan itu:

- *"Transkripsi file ini, privacy_mode=false"*

Tidak perlu restart. Override hanya berlaku untuk panggilan alat tunggal tersebut.

### Mode privasi meminta konfirmasi sebelum setiap file

Ini adalah perilaku yang benar dan disengaja. Mode privasi memerlukan persetujuan per-operasi — gerbang aktif sebelum setiap transkripsi dan tidak dapat dilewati saat mode privasi aktif.

Jika Anda perlu mentranskrip banyak file tanpa konfirmasi per-file dan kontennya tidak sensitif, nonaktifkan mode privasi:
- Hapus `WHISPER_PRIVACY_MODE=true` dari konfigurasi Anda dan restart Claude Desktop
- Atau teruskan `privacy_mode=false` per-panggilan untuk file yang tidak sensitif

### Mengapa mode privasi bertanya setiap saat, tetapi gerbang persetujuan hanya bertanya sekali?

Kedua gerbang melayani pengguna yang berbeda dengan kebutuhan yang berbeda.

**Gerbang persetujuan** (mode standar) adalah pengungkapan informasi satu kali. Setelah Anda memahami bahwa teks transkrip dikirimkan ke API Claude, Anda tidak perlu diberitahu lagi dalam sesi ini.

**Gerbang mode privasi** aktif setiap saat karena orang yang membutuhkannya — penyedia layanan kesehatan, pengacara, profesional keuangan — memerlukan konfirmasi per-operasi yang afirmatif sebagai bagian dari alur kerja kepatuhan mereka. Melewatinya akan mengalahkan tujuannya.

### Tugas latar belakang dan gerbang persetujuan

Untuk transkripsi latar belakang (`background=true`) dalam mode standar, gerbang persetujuan aktif di `check_progress` saat transkrip dikembalikan — **bukan** di `transcribe_audio` saat tugas dimulai. Pada saat tugas dimulai, belum ada transkrip yang ada. Membatasi sebelum tugas dimulai akan memblokir pemrosesan audio secara tidak perlu. Gerbang aktif begitu teks transkrip pertama kali akan dikembalikan ke API.

Untuk tugas latar belakang mode privasi, gerbang aktif **sebelum spawning** — sebelum pemrosesan audio apa pun dimulai.

### Bagaimana cara melewati gerbang persetujuan secara permanen?

Atur `WHISPER_CONSENT_ACKNOWLEDGED=true` di bagian env `claude_desktop_config.json` Anda. Ini melewati pengungkapan sesi satu kali dalam mode standar.

Catatan: ini tidak berpengaruh saat mode privasi aktif.

---

## Transkripsi Latar Belakang dan Batch

### "File ini berdurasi ~X — jalankan di latar belakang" / transkripsi latar depan kehabisan waktu

Claude Desktop memberlakukan batas waktu ~4 menit pada setiap panggilan alat MCP tunggal. File panjang yang ditranskrip dalam mode **latar depan** (pemblokiran) dapat melampauinya — transkrip tetap selesai dan ditulis ke disk, tetapi panggilan alatnya sendiri mengalami error. Untuk mencegah kegagalan diam-diam itu, `transcribe_audio` dan `generate_subtitles` memperkirakan waktu jalan di awal dan, jika kemungkinan akan melewati batas, mengembalikan pesan yang memberi tahu Anda untuk menjalankan ulang dengan `background=true`. Mode latar belakang mengembalikan ID tugas segera dan tidak memiliki batas seperti itu — pantau dengan `check_progress`.

Sebagian besar waktu nyata transkripsi adalah **pemuatan model**, bukan transkripsi: whisper-cli memuat ulang model pada setiap pemanggilan, dan model besar (mis. `large-v3`, 2,9 GB) pada GPU dengan memori terbatas dapat memakan waktu ~2 menit untuk dimuat sebelum transkripsi bahkan dimulai (model yang lebih kecil atau terkuantisasi memuat lebih cepat). Ambang batas pelindung dapat dikonfigurasi dengan `WHISPER_FOREGROUND_MAX_SEC` (detik; default 210).

### Tugas latar belakang tidak pernah menampilkan selesai

Status tugas dilacak oleh exit proses whisper-cli.exe. Periksa:

1. Tanya Claude: *"Periksa kemajuan job_id"* — jika proses masih berjalan, alat mengembalikan "Sedang berlangsung" dengan waktu yang telah berlalu dan timestamp segmen terakhir
2. Jika file sangat panjang (2+ jam), tunggu lebih lama — transkripsi GPU file 2 jam membutuhkan sekitar 15–20 menit pada GPU kelas menengah
3. Jika waktu yang telah berlalu tampak salah, buka Task Manager → Detail dan periksa apakah `whisper-cli.exe` ada dalam daftar

Jika `whisper-cli.exe` tidak berjalan tetapi `check_progress` masih menampilkan "Sedang berlangsung":
- Proses keluar dengan error dan tidak meninggalkan file output
- Tanya Claude: *"Periksa kemajuan job_id"* — alat akan mendeteksi tidak ada PID dan tidak ada file output dan melaporkan error dengan baris log terakhir

### Tugas latar belakang selesai tetapi file output hilang atau di lokasi yang salah

Tugas latar belakang menulis output ke jalur temp di `%TEMP%\whisper-mcp-jobs\` selama pemrosesan, kemudian memindahkan file ke direktori sumber saat selesai. Jika pemindahan gagal (disk penuh, masalah izin, atau panjang jalur), `check_progress` mengembalikan error spesifik:

> "Penulisan file output gagal. Transkripsi selesai tetapi tidak dapat ditulis ke: [jalur]"

Periksa:
- Direktori sumber ada dan dapat ditulis
- Ada cukup ruang disk
- Jalur target tidak terlalu panjang (Windows memiliki batas jalur 260 karakter secara default)

Output mentah mungkin masih ada di `%TEMP%\whisper-mcp-jobs\` dengan nama file berbasis ID tugas.

### Batch macet atau tidak maju ke file berikutnya

`start_batch` menggunakan exit callback untuk maju sendiri tanpa polling. Jika batch tampak macet:

1. Panggil `check_batch_progress` — ini memaksa pemeriksaan kemajuan dan mengevaluasi ulang status saat ini
2. Jika file saat ini masih berjalan, tunggu hingga selesai — periksa Task Manager untuk `whisper-cli.exe`
3. Jika `check_batch_progress` menampilkan file saat ini sebagai gagal, ia akan mencoba maju ke file berikutnya

Catatan: di v2.3.0 dan lebih baru, batch maju sendiri melalui exit callback saat setiap file selesai. Anda tidak perlu melakukan polling berulang kali — memanggil `check_batch_progress` sekali setelah beberapa waktu berlalu sudah cukup untuk mendapatkan pembaruan status.

### Batch melaporkan file sebagai "gagal" meskipun terlihat lengkap

Validator memeriksa bahwa file output tidak kosong dan memiliki setidaknya satu baris per 30 detik audio. File pendek atau rekaman dengan bagian senyap yang panjang mungkin menghasilkan output yang dianggap validator terlalu pendek.

Jika transkrip terlihat benar saat Anda membukanya:
- Validasi terlalu konservatif untuk file ini
- Jalankan ulang dengan `transcribe_audio` secara individual dan periksa hasilnya secara manual

Jika output memang salah:
- Coba `language=auto` jika bahasa mungkin tidak sesuai dengan pengaturan yang dikonfigurasi
- Coba model yang lebih besar untuk akurasi yang lebih baik

### Banyak file gagal segera di awal batch

Ini biasanya berarti whisper-cli.exe sama sekali tidak berfungsi. Jalankan `check_config` untuk memverifikasi semua jalur, kemudian coba satu file dengan `transcribe_audio` untuk melihat error yang spesifik.

---

## Pembuatan Subtitle

### File SRT disimpan tetapi memiliki nama yang salah atau di lokasi yang salah

File SRT dan VTT disimpan di sebelah file sumber dengan kode bahasa yang ditambahkan saat bahasa sumber bukan bahasa Inggris:
- Sumber bahasa Inggris: `namafile.srt`
- Sumber bahasa Indonesia: `namafile.id.srt`
- Dengan terjemahan bahasa Inggris: `namafile.id.srt` + `namafile.en.srt`

Jika file muncul di sebelah WAV temp bukan sumber asli, periksa apakah file sumber memerlukan konversi format (format apa pun selain mp3/wav melalui FFmpeg). Logika tujuan output menggunakan `file_path` asli, bukan jalur file temp.

### Output VTT untuk penggunaan web — bagaimana cara memuatnya di pemutar desktop?

VLC mendukung VTT melalui Subtitle → Tambahkan File Subtitle → pilih file `.vtt`. Sebagian besar pemutar desktop lainnya mendukung SRT lebih baik dari VTT. Gunakan `output_format=srt` untuk kompatibilitas pemutar desktop maksimum.

VTT paling cocok untuk elemen `<video>` HTML5 dan pemutar video berbasis web.

### File LRC tidak ditampilkan di pemutar media saya

File LRC (`.lrc`) diperuntukkan bagi pemutar dengan fitur tampilan lirik/karaoke: foobar2000, Winamp, AIMP, dan berbagai pemutar mobile. Pemutar video standar tidak menampilkan LRC. Jika Anda membutuhkan subtitle tersinkronisasi untuk video, gunakan `srt` atau `vtt`.

### Output CSV — apa formatnya?

Output CSV menyertakan waktu mulai segmen, waktu selesai, dan teks per baris. Dirancang untuk diimpor ke alat spreadsheet atau skrip analisis downstream. Format kolom yang tepat sesuai dengan output `-ocsv` whisper.cpp. Gunakan `srt` atau `vtt` untuk tampilan subtitle yang sebenarnya.

### Pembuatan subtitle timeout dengan error 4 menit

`generate_subtitles` berjalan secara sinkron secara default dan dapat mencapai timeout MCP 4 menit Claude Desktop pada file yang panjang. Gunakan `background=true` untuk file di atas 10 menit:

- *"Buat subtitle untuk file ini, background=true"*

Kemudian periksa kemajuan dengan `check_progress`. Catatan: `translate_to_english=true` tidak tersedia dalam mode latar belakang. Jalankan pass kedua setelah tugas latar belakang selesai untuk menghasilkan terjemahan.

---

## Manajemen Model

### `download_model` gagal dengan error jaringan

Alat mengunduh dari Hugging Face. Konfirmasi mesin Anda memiliki akses internet dan `huggingface.co` tidak diblokir oleh firewall atau proxy.

Jika unduhan dimulai tetapi gagal di tengah jalan, file `.part` dihapus secara otomatis. Jalankan ulang `download_model` untuk mencoba lagi.

### `switch_model` mengatakan model tidak ada di direktori model

Alat `switch_model` hanya menerima file dalam direktori yang dikonfigurasi dalam `WHISPER_MODEL` (khususnya, direktori yang berisi file tersebut).

Jika model Anda berada di lokasi yang berbeda, pindahkan ke direktori model atau perbarui `WHISPER_MODEL` di konfigurasi Anda agar menunjuk ke file di direktori yang sama dengan model Anda.

### Model aktif kembali ke model konfigurasi setelah restart Claude Desktop

`switch_model` bersifat session-scoped berdasarkan desain. Untuk membuat pergantian model permanen, perbarui `WHISPER_MODEL` di `claude_desktop_config.json` dan restart Claude Desktop.

---

## Jalur File dan Format

### Nama file Unicode menyebabkan transkripsi gagal secara diam-diam

Transkripsi latar belakang merutekan semua output melalui jalur temp berbasis ID tugas ASCII yang disanitasi, yang menangani nama file Unicode dengan benar. Jika Anda melihat kegagalan dengan nama file Unicode dalam mode pemblokiran, periksa bahwa file itu sendiri dapat diakses:

```powershell
Test-Path "C:\Users\NamaPengguna\Documents\Rekaman_Rapat.mp4"
```

Seharusnya mengembalikan `True`. Jika jalur tidak dapat diakses oleh PowerShell, jalur tersebut juga tidak dapat diakses oleh server MCP.

### File video tidak menghasilkan output atau error segera

FFmpeg diperlukan untuk semua format video. Konfirmasi FFmpeg terpasang:
```
ffmpeg -version
```

Jika FFmpeg tidak ada di PATH, atur `FFMPEG_PATH` di konfigurasi Anda ke jalur lengkap `ffmpeg.exe`.

Jika FFmpeg terpasang tetapi video tertentu gagal, mungkin file rusak atau varian codec yang tidak biasa. Coba konversi secara manual:
```
ffmpeg -i input.mp4 -ar 16000 -ac 1 output.wav
```
Kemudian transkripsi file WAV secara langsung.

### Error "File terlalu besar"

Alat menolak file di atas 10 GB. Ini adalah batas keamanan untuk mencegah penggunaan memori yang berlebihan. File yang mendekati ukuran ini harus dipecah sebelum transkripsi.

### Penolakan jalur UNC

Jalur yang dimulai dengan `\\server\share` (jalur UNC ke berbagi jaringan) ditolak oleh validator input. Pasang berbagi jaringan sebagai huruf drive (misalnya `Z:\`) dan gunakan jalur tersebut.

---

## Pembersihan File Sementara

File status tugas (`.json` dan `.log`) di `%TEMP%\whisper-mcp-jobs\` dibersihkan secara otomatis saat startup untuk file yang lebih dari 7 hari. Pembersihan manual tetap dimungkinkan jika diperlukan:

```powershell
Remove-Item "$env:TEMP\whisper-mcp-jobs\*" -Force
```

File WAV konversi sementara (`whisper_tmp_*.wav` di `%TEMP%`) dihapus segera setelah setiap transkripsi selesai. Jika transkripsi crash di tengah jalan, file-file ini mungkin tertinggal. Hapus secara manual:

```powershell
Remove-Item "$env:TEMP\whisper_tmp_*.wav" -Force
```
