# whisper-windows-mcp

Server MCP (Model Context Protocol) khusus Windows. Menggunakan [whisper.cpp](https://github.com/ggml-org/whisper.cpp) untuk transkripsi file audio dan video secara lokal di Claude Desktop — dengan akselerasi GPU, dukungan multibahasa, dan pemrosesan batch. Semua transkripsi berjalan secara lokal — tidak ada file audio, video, maupun jalur file yang dikirim keluar.

> **Mengapa paket ini ada?**
> Paket `whisper-mcp` yang populer dibangun untuk macOS dan mengasumsikan lingkungan Unix. Paket tersebut tidak berfungsi di Windows. Paket ini ditulis khusus untuk pengguna Windows yang menginginkan transkripsi AI lokal yang terintegrasi dengan Claude Desktop.

---

## Yang Dapat Anda Lakukan

Setelah dipasang, Anda dapat langsung mengatakan di Claude Desktop:

- *"Transkripsi C:\Users\Me\Downloads\meeting.mp3"*
- *"Transkripsi semua rekaman di folder ini dan simpan masing-masing sebagai file teks"*
- *"Buat subtitle bahasa Indonesia dan Inggris untuk video ini"*
- *"Mulai transkripsi batch semua file di folder ini"*
- *"Berapa lama untuk mentranskrip file-file ini?"*
- *"Periksa apakah akselerasi GPU berfungsi"*

---

## Persyaratan

1. **Node.js 18 atau lebih baru** — [nodejs.org](https://nodejs.org)
2. **Binary whisper.cpp dengan dukungan Vulkan GPU** — lihat Langkah 1
3. **File model Whisper** — lihat Langkah 2
4. **FFmpeg** — diperlukan untuk file video dan format audio non-WAV/MP3

---

## Langkah 1 — Pasang Binary whisper.cpp

### Opsi A — Rilis Vulkan yang sudah dikompilasi (direkomendasikan)

Unduh `whisper-vulkan-win-x64.zip` dari [halaman rilis](https://github.com/eviscerations/whisper-windows-mcp/releases/tag/v1.4.0).

Ini adalah build khusus dengan **akselerasi Vulkan GPU** yang diaktifkan. Berfungsi dengan GPU AMD, NVIDIA, dan Intel — tidak memerlukan SDK khusus vendor.

Ekstrak ke `C:\whisper\Release\`. Anda akan mendapatkan:

```
C:\whisper\Release\whisper-cli.exe
C:\whisper\Release\ggml-vulkan.dll
C:\whisper\Release\ggml.dll
C:\whisper\Release\ggml-base.dll
C:\whisper\Release\ggml-cpu.dll
C:\whisper\Release\whisper.dll
```

Akselerasi GPU aktif otomatis — tidak perlu konfigurasi tambahan.

### Opsi B — Build dari source

Diperlukan: Git, CMake, Visual Studio Build Tools 2022+ dengan "Desktop development with C++", Vulkan SDK dari [lunarg.com](https://vulkan.lunarg.com/sdk/home#windows).

```
git clone https://github.com/ggml-org/whisper.cpp
cd whisper.cpp
cmake -B build -DGGML_VULKAN=ON -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release --target whisper-cli
```

Salin binary dari `build\bin\Release\` ke `C:\whisper\Release\`.

> **Catatan:** Rilis Windows resmi whisper.cpp di GitHub tidak menyertakan build Vulkan. Anda harus menggunakan rilis yang sudah dikompilasi di atas atau mengkompilasi dari source dengan `-DGGML_VULKAN=ON`.

---

## Langkah 2 — Unduh Model Whisper

| Model | Ukuran | Kecepatan | Akurasi | Terbaik untuk |
|---|---|---|---|---|
| `ggml-tiny.en.bin` | 75 MB | Sangat cepat | Dasar | Tes cepat |
| `ggml-base.en.bin` | 142 MB | Cepat | Baik | Bahasa Inggris sehari-hari |
| `ggml-small.en.bin` | 466 MB | Sedang | Lebih baik | Rekaman penting |
| `ggml-medium.en.bin` | 1.5 GB | Cepat di GPU | Sangat baik | Kualitas terbaik bahasa Inggris |
| `ggml-large-v3-turbo.bin` | 1.6 GB | Cepat di GPU | Sangat baik | **Direkomendasikan untuk batch GPU bahasa Inggris — ~6x lebih cepat dari large-v3 dengan kehilangan akurasi minimal** |
| `ggml-large-v3.bin` | 2.9 GB | Cepat di GPU | Sangat baik | Multibahasa, akurasi maksimum |
| `ggml-medium.en-q5_0.bin` | 514 MB | Cepat | Sangat baik | **Pilihan terbaik CPU-only bahasa Inggris — akurasi tinggi dengan memori rendah** |
| `ggml-large-v3-turbo-q5_0.bin` | 547 MB | Cepat | Sangat baik | **Pilihan terbaik CPU-only multibahasa** |
| `ggml-large-v3-q5_0.bin` | 1.1 GB | Sedang di CPU | Sangat baik | Multibahasa, ramah CPU |

Gunakan `download_model` di Claude Desktop untuk memasang langsung. Untuk **bahasa Inggris saja**: `large-v3-turbo` (GPU) atau `medium.en-q5_0` (CPU) adalah titik awal terbaik. Untuk **multibahasa**: `large-v3-turbo` atau `large-v3-turbo-q5_0` (CPU). Model khusus bahasa Inggris (`*.en.bin`) menghasilkan `[FOREIGN]` pada audio non-Inggris dan tidak dapat digunakan untuk bahasa lain.

---

## Langkah 3 — Pasang FFmpeg

FFmpeg diperlukan untuk file video dan format audio yang bukan format asli.

Pasang via winget:
```
winget install ffmpeg
```

Atau unduh dari [ffmpeg.org](https://ffmpeg.org/download.html) dan tambahkan ke PATH.

Verifikasi:
```
ffmpeg -version
```

---

## Langkah 4 — Pasang Server MCP

```
npm install -g whisper-windows-mcp
```

---

## Langkah 5 — Konfigurasi Claude Desktop

Buka Claude Desktop → Pengaturan → Pengembang → Edit Konfigurasi.

Tambahkan entri `whisper`:

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

Lokasi file konfigurasi: `C:\Users\NamaPengguna\AppData\Roaming\Claude\claude_desktop_config.json`

> Gunakan **dua backslash** di semua jalur.

Simpan dan **restart penuh** Claude Desktop. Anda akan melihat **whisper** terdaftar dengan lencana berjalan berwarna hijau di Pengaturan → Pengembang.

---

## Langkah 6 — Verifikasi Setup

Di Claude Desktop, tanyakan:

> *"Periksa konfigurasi whisper"*

Kemudian:

> *"Periksa hardware sistem"*

Ini mengkonfirmasi GPU Anda terdeteksi dan akselerasi Vulkan aktif.

---

## Alat yang Tersedia

### `transcribe_audio`
Transkripsi satu file. Mendukung mode pemblokiran (default) atau latar belakang untuk file panjang.

| Parameter | Deskripsi |
|---|---|
| `file_path` | Jalur absolut ke file (wajib) |
| `language` | Kode bahasa (`id`, `en`, `ja`, dll.) atau `auto` untuk deteksi otomatis. Default: `en` |
| `output_format` | `text` (default), `timestamps`, `json`, atau `srt` |
| `save_to_file` | Simpan transkrip sebagai .txt di sebelah file sumber |
| `background` | Jalankan sebagai tugas terpisah — segera mengembalikan ID tugas. Gunakan `check_progress` untuk memantau. Direkomendasikan untuk file lebih dari 10 menit. |
| `threads` | Override jumlah thread CPU |
| `temperature` | Suhu sampling 0.0–1.0. Default 0.0 (deterministik). Nilai lebih tinggi mengurangi halusinasi pada audio yang bising. |
| `prompt` | String konteks sebelumnya — meningkatkan akurasi untuk kosakata khusus domain atau nama pembicara. Contoh: `"Nama: Keemstar, DramaAlert."` |
| `condition_on_prev_text` | Aktifkan kembali pengkondisian konteks antar segmen. Default false. |
| `beam_size` | Lebar pencarian beam. Lebih tinggi = lebih akurat, lebih lambat. Default 5. |
| `best_of` | Jumlah urutan kandidat yang dievaluasi. Default 5. |
| `gpu_device` | Indeks perangkat GPU untuk sistem multi-GPU. Default 0. |
| `processors` | Jumlah prosesor paralel. Default 1. |
| `word_timestamps` | Satu kata per segmen bertimestamp. Berguna untuk penyelarasan klip. |
| `max_segment_length` | Panjang segmen maksimum dalam karakter. |
| `diarize` | Diarisasi pembicara stereo — memerlukan audio stereo dengan pembicara di kanal terpisah. |
| `vad_model` | Jalur ke file .bin model Silero VAD. Menghapus keheningan sebelum transkripsi — mengurangi halusinasi pada file yang bising. |
| `offset_t` | Offset mulai dalam milidetik. |
| `duration` | Durasi pemrosesan dalam milidetik dari offset. |

---

### `check_progress`
Pantau tugas transkripsi latar belakang yang dimulai dengan `transcribe_audio` (background=true).

Mengembalikan waktu yang telah berlalu, timestamp terakhir yang diproses, persentase, dan transkrip lengkap saat selesai.

| Parameter | Deskripsi |
|---|---|
| `job_id` | ID tugas yang dikembalikan oleh `transcribe_audio` |

---

### `start_batch`
Transkripsi berurutan otomatis semua file yang belum ditranskripsi dalam folder. Diurutkan berdasarkan durasi (terpendek dulu), diproses satu per satu sebagai tugas latar belakang, dan memvalidasi setiap output.

| Parameter | Deskripsi |
|---|---|
| `folder_path` | Jalur ke folder (wajib) |
| `language` | Kode bahasa. Default: `en` |
| `threads` | Override jumlah thread CPU |

---

### `check_batch_progress`
Pantau batch yang sedang berjalan. Secara otomatis maju ke file berikutnya saat file saat ini selesai. Mengembalikan kemajuan keseluruhan, file saat ini dengan timestamp, ETA, dan file yang gagal.

| Parameter | Deskripsi |
|---|---|
| `batch_id` | ID batch yang dikembalikan oleh `start_batch` |

---

### `transcribe_batch` (interaktif)
Proses file satu per satu dengan pratinjau dan konfirmasi sebelum masing-masing. Berguna saat Anda ingin meninjau seiring berjalannya proses.

| Parameter | Deskripsi |
|---|---|
| `folder_path` | Jalur ke folder (wajib) |
| `file_index` | File mana yang diproses (berbasis 1). Hilangkan untuk menampilkan daftar file terlebih dahulu. |
| `language` | Kode bahasa. Default: `en` |
| `recursive` | Sertakan subfolder |

---

### `generate_subtitles`
Buat file subtitle SRT. Mendukung deteksi bahasa otomatis dan output terjemahan bahasa Inggris.

| Parameter | Deskripsi |
|---|---|
| `file_path` | Jalur ke file (wajib) |
| `language` | Kode bahasa atau `auto` untuk deteksi otomatis. Default: `en` |
| `translate_to_english` | Juga buat `.en.srt` terjemahan bahasa Inggris. Hanya berlaku saat sumber bukan bahasa Inggris. |
| `threads` | Override jumlah thread CPU |

Saat keduanya diminta, dua file disimpan di sebelah sumber:
- `namafile.id.srt` — bahasa asli
- `namafile.en.srt` — terjemahan bahasa Inggris

> Terjemahan bawaan Whisper hanya menerjemahkan **ke bahasa Inggris**. Untuk bahasa target lain, terjemahkan konten file .srt secara terpisah.

---

### `analyze_media`
Analisis file sebelum melakukan transkripsi. Mengembalikan durasi, ukuran, codec, dan perkiraan waktu transkripsi di CPU dan GPU. Untuk folder, menampilkan semua file dalam tabel yang dapat diurutkan dengan status transkripsi.

| Parameter | Deskripsi |
|---|---|
| `path` | Jalur ke file tunggal atau folder (wajib) |
| `sort_by` | Untuk folder: `duration` (default), `name`, atau `size` |

---

### `check_config`
Verifikasi whisper-cli.exe, file model, dan FFmpeg semuanya dapat diakses. Jalankan ini terlebih dahulu jika ada yang tidak berfungsi.

---

### `list_models`
Daftar semua file model Whisper yang terpasang di direktori model Anda. Menampilkan nama file, ukuran, apakah sedang aktif, status kuantisasi, dan kasus penggunaan yang direkomendasikan. Tidak ada panggilan jaringan — hanya membaca sistem file lokal.

---

### `download_model`
Unduh model Whisper langsung dari Hugging Face ke direktori model Anda. Menerima nama model (misalnya `large-v3-turbo`, `medium.en-q5_0`) dan menangani unduhan secara otomatis. Hanya mengunduh dari namespace Hugging Face yang terpercaya. Setelah mengunduh, gunakan `switch_model` untuk mengaktifkannya.

| Parameter | Deskripsi |
|---|---|
| `model_name` | Nama model yang akan diunduh, misalnya `large-v3-turbo`, `large-v3-turbo-q5_0`, `medium.en-q5_0` |

---

### `switch_model`
Ganti model Whisper aktif untuk sesi saat ini tanpa me-restart Claude Desktop. Perubahan hanya berlaku untuk sesi — tidak tersimpan setelah restart. Untuk membuat permanen, perbarui `WHISPER_MODEL` di konfigurasi Anda.

| Parameter | Deskripsi |
|---|---|
| `model_name` | Nama file model (misalnya `ggml-large-v3-turbo.bin`) atau jalur lengkap. Harus berupa file `.bin` di direktori model yang dikonfigurasi. |

---

### `check_system`
Deteksi hardware GPU dan konfirmasi akselerasi Vulkan tersedia. Melaporkan nama GPU, VRAM, apakah `ggml-vulkan.dll` ada, dan merekomendasikan ukuran model terbaik untuk hardware Anda.

---

## Format yang Didukung

| Tipe | Format |
|---|---|
| Asli (tanpa konversi) | `mp3`, `wav` |
| Video (dikonversi otomatis via FFmpeg) | `mp4`, `mkv`, `avi`, `mov`, `webm`, `flv`, `wmv`, `m4v`, `ts`, `3gp` |
| Audio (dikonversi otomatis via FFmpeg) | `m4a`, `ogg`, `flac` |

---

## Akselerasi GPU

Rilis Vulkan yang sudah dikompilasi mengaktifkan akselerasi GPU secara otomatis. Diuji pada AMD Radeon RX Vega 56 (GCN generasi ke-5). GPU apa pun dengan dukungan Vulkan 1.0+ seharusnya berfungsi, termasuk NVIDIA dan Intel Arc.

**Perbandingan performa (model medium.en, file audio ~5 menit):**

| Hardware | Waktu |
|---|---|
| CPU saja (Ryzen 7 2700x, 8 thread) | 8–12 menit |
| GPU (Vega 56 via Vulkan) | 20–40 detik |

Utilisasi GPU selama transkripsi biasanya 15–20%, turun kembali ke idle di antara file. CPU tetap sekitar 15%.

---

## Dukungan Multibahasa

Whisper dapat mendeteksi bahasa yang diucapkan secara otomatis dan mentranskrip dalam bahasa tersebut. Model terjemahan bawaan hanya menerjemahkan **ke bahasa Inggris**.

Untuk akurasi multibahasa terbaik, gunakan model `large-v3`. Model khusus bahasa Inggris (`*.en.bin`) tidak dapat mendeteksi atau mentranskrip bahasa lain.

**Contoh — video bahasa asing dengan subtitle:**
1. Minta Claude membuat subtitle dengan `language=auto` dan `translate_to_english=true`
2. Whisper mendeteksi bahasa dan menghasilkan SRT bahasa asli
3. Pass kedua menghasilkan SRT terjemahan bahasa Inggris
4. Muat salah satu file di VLC via Subtitle → Tambahkan File Subtitle

---

## Dirancang untuk Pengguna Paket Gratis

Alat ini dibangun untuk meminimalkan interaksi Claude API. Seluruh alur kerja transkripsi — pemindaian, analisis, antrian, menjalankan, validasi — dirancang untuk memerlukan sesedikit mungkin interaksi Claude. Pekerjaan berat dilakukan secara lokal di mesin Anda.

---

## Variabel Lingkungan Opsional

| Variabel | Deskripsi |
|---|---|
| `WHISPER_CLI_PATH` | Jalur ke whisper-cli.exe (wajib) |
| `WHISPER_MODEL` | Jalur ke file model .bin (wajib) |
| `WHISPER_THREADS` | Override jumlah thread CPU |
| `FFMPEG_PATH` | Jalur ke ffmpeg jika tidak ada di PATH sistem |
| `WHISPER_PRIVACY_MODE` | **Direncanakan.** Saat diatur ke `true`, respons alat hanya mengembalikan metadata — tidak ada teks transkrip yang dikembalikan ke Claude. Untuk konten yang diatur atau rahasia. Lihat [PRIVACY.md](PRIVACY.md). |

---

## Pemecahan Masalah

Lihat [TROUBLESHOOTING.md](TROUBLESHOOTING.md) untuk solusi terperinci. Lihat [PRIVACY.md](PRIVACY.md) jika Anda menangani konten yang diatur.

Daftar periksa cepat:
- Jalur di konfigurasi menggunakan **dua backslash** (`C:\\whisper\\...`)
- `whisper-cli.exe` ada di jalur yang dikonfigurasi
- File model `.bin` ada di jalur yang dikonfigurasi
- FFmpeg terpasang dan ada di PATH (`ffmpeg -version` berfungsi)
- Claude Desktop sudah **di-restart penuh** setelah mengedit konfigurasi
- Whisper menampilkan **berjalan** (lencana hijau) di Pengaturan → Pengembang

---

## Keamanan dan Privasi

whisper-windows-mcp dirancang dengan keamanan sebagai prinsip inti.

**Audio tidak pernah meninggalkan mesin Anda.** Tidak ada file audio atau video, jalur file, maupun telemetri yang pernah dikirim ke server mana pun. Tidak diperlukan API cloud untuk fungsionalitas inti.

**Teks transkrip dan batas API.** Saat respons alat menyertakan teks transkrip, teks tersebut diproses oleh API Claude — meninggalkan mesin lokal Anda. Untuk sebagian besar pengguna (konten publik, podcast, rekaman streaming) ini adalah perilaku yang diharapkan. Jika Anda menangani rekaman medis, hukum, keuangan, atau diatur lainnya, lihat [PRIVACY.md](PRIVACY.md) untuk panduan kepatuhan dan opsi konfigurasi.

Variabel lingkungan `WHISPER_PRIVACY_MODE` direncanakan yang akan membatasi semua respons alat hanya ke metadata (nama file, durasi, jumlah kata) — tidak ada teks transkrip yang dikembalikan ke Claude. Ini adalah konfigurasi yang tepat untuk konten yang diatur atau rahasia.

**Validasi input.** Semua jalur file divalidasi sebelum digunakan — jalur UNC (`\\server\share`) dan urutan traversal direktori (`..`) ditolak. File di atas 10 GB ditolak untuk mencegah kelelahan sumber daya.

**Kesadaran injeksi transkrip.** File audio dapat berisi konten yang diucapkan yang, saat ditranskripsi, menyerupai instruksi. Pertahanan bawaan Claude menangani ini, tetapi perlu diketahui bahwa konten transkrip diperlakukan sebagai data — tidak pernah sebagai instruksi — oleh server MCP itu sendiri.

**Unduhan model dibatasi.** Alat `download_model` hanya mengunduh dari dua namespace Hugging Face yang terpercaya (`ggerganov/whisper.cpp` dan `ggml-org`). URL sembarang ditolak. Pengalihan divalidasi terhadap daftar izin sebelum diikuti.

**Penggantian model di-sandbox.** `switch_model` hanya menerima file `.bin` dalam direktori model yang dikonfigurasi. Jalur di luar direktori tersebut ditolak.

**Tidak ada ketergantungan jaringan baru.** Unduhan model menggunakan `https` bawaan Node.js — tidak ada library HTTP eksternal yang ditambahkan ke paket.

---

## Lisensi

MIT

---

## Berkontribusi

Pull request disambut. Lihat [ROADMAP.md](ROADMAP.md) untuk fitur yang direncanakan.

Jika Anda telah menguji akselerasi GPU pada hardware yang tidak tercantum di atas, silakan buka issue dengan hasilnya — model GPU, VRAM, ukuran model, dan throughput yang diamati.
