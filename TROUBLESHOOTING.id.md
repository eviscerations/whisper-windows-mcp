# whisper-windows-mcp — Pemecahan Masalah

---

## Daftar Periksa Cepat

Sebelum menyelidiki lebih dalam, verifikasi semua hal berikut:

- Jalur di `claude_desktop_config.json` menggunakan **dua backslash** (`C:\\whisper\\...`)
- `whisper-cli.exe` ada di jalur yang ditentukan dalam `WHISPER_CLI_PATH`
- File model `.bin` ada di jalur yang ditentukan dalam `WHISPER_MODEL`
- FFmpeg terpasang dan dapat diakses (`ffmpeg -version` berfungsi di command prompt)
- Claude Desktop sudah **di-restart penuh** setelah mengedit konfigurasi (keluar dari system tray, bukan sekadar menutup jendela)
- Server whisper menampilkan **berjalan** (lencana hijau) di Pengaturan → Pengembang

---

## "whisper tidak terhubung" atau tidak ada alat yang tersedia

**Penyebab paling umum:** Claude Desktop tidak di-restart penuh setelah mengedit konfigurasi.

1. Klik kanan ikon Claude di system tray → Keluar
2. Buka kembali Claude Desktop
3. Buka Pengaturan → Pengembang dan periksa lencana **berjalan** berwarna hijau di sebelah whisper

Jika masih tidak muncul:

1. Buka `claude_desktop_config.json` dan periksa kesalahan sintaks JSON (koma yang hilang, kurung kurawal yang tidak cocok)
2. Pastikan semua jalur menggunakan dua backslash
3. Jalankan `check_config` di Claude Desktop untuk mendapatkan diagnostik

---

## download_model timeout pada model besar

Claude Desktop memiliki timeout 4 menit untuk panggilan alat MCP. Unduhan model besar pada koneksi lambat mungkin melebihi batas ini.

**Ukuran file:**
- `large-v3` — 2.9 GB
- `large-v3-turbo` — 1.6 GB
- `large-v3-q5_0` — 1.1 GB
- `large-v3-turbo-q5_0` — 547 MB
- `medium.en` — 1.5 GB
- `medium.en-q5_0` — 514 MB

Pada koneksi cepat (100 Mbps+), bahkan large-v3 selesai diunduh dalam waktu kurang dari 4 menit. Pada koneksi lebih lambat, gunakan browser atau PowerShell untuk mengunduh langsung dan tempatkan file di direktori model secara manual:

```powershell
# Contoh — unduh large-v3-turbo secara langsung
Invoke-WebRequest -Uri "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin" `
  -OutFile "C:\whisper\models\ggml-large-v3-turbo.bin"
```

Kemudian gunakan `switch_model ggml-large-v3-turbo.bin` untuk mengaktifkannya.

---

## `check_config` melaporkan whisper-cli.exe tidak ditemukan

Jalur di konfigurasi tidak cocok dengan lokasi file yang sebenarnya.

Verifikasi file ada:
```
dir C:\whisper\Release\whisper-cli.exe
```

Jika ada di tempat lain, perbarui `WHISPER_CLI_PATH` di konfigurasi Anda agar sesuai dengan jalur yang sebenarnya.

---

## `check_config` melaporkan FFmpeg tidak ditemukan

FFmpeg tidak terpasang atau tidak ada di PATH sistem Anda.

Pasang via winget:
```
winget install ffmpeg
```

Atau unduh dari [ffmpeg.org](https://ffmpeg.org/download.html), ekstrak, dan tambahkan folder `bin` ke PATH sistem Anda.

Setelah memasang, buka command prompt baru dan verifikasi:
```
ffmpeg -version
```

Jika Anda memasang FFmpeg ke lokasi non-standar, atur variabel lingkungan `FFMPEG_PATH` di konfigurasi Claude Desktop:
```json
"env": {
  "FFMPEG_PATH": "C:\\ffmpeg\\bin\\ffmpeg.exe"
}
```

---

## Output transkripsi penuh dengan tag `[FOREIGN]`

**Penyebab:** Anda menggunakan model khusus bahasa Inggris (misalnya `ggml-medium.en.bin`) pada audio non-Inggris. Model khusus bahasa Inggris tidak dapat memproses bahasa lain dan menghasilkan `[FOREIGN]` sebagai placeholder untuk setiap segmen yang tidak dapat ditangani.

**Solusi:** Unduh dan gunakan `ggml-large-v3.bin` — model multibahasa. Ini diperlukan untuk transkripsi non-Inggris, deteksi bahasa otomatis, atau terjemahan.

```
https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin
```

Simpan ke `C:\whisper\models\` dan perbarui konfigurasi:
```json
"WHISPER_MODEL": "C:\\whisper\\models\\ggml-large-v3.bin"
```

Atau ganti per-transkripsi menggunakan parameter `model` di `transcribe_audio` atau `generate_subtitles`.

> **Catatan:** Model khusus bahasa Inggris (`*.en.bin`) lebih cepat dan akurat untuk konten bahasa Inggris tetapi sama sekali tidak dapat menangani bahasa lain. Jika Anda bekerja dengan konten multibahasa, `large-v3` adalah model yang tepat terlepas dari hardware.

---

## Transkripsi tidak menghasilkan output atau file kosong

**Kemungkinan penyebab:**

1. **Model salah untuk bahasa** — Model khusus bahasa Inggris (`*.en.bin`) tidak dapat mentranskrip bahasa lain. Gunakan `ggml-large-v3.bin` untuk konten multibahasa.

2. **Kualitas audio terlalu rendah** — File dengan bitrate sangat rendah (misalnya rekaman ponsel `.3gp` lama menggunakan codec AMR-NB ~12kbps) mungkin berada di batas kemampuan whisper. Lingkungan yang bising (kebisingan latar belakang, gema, pembicara jauh) juga menantang. Coba `large-v3` yang lebih baik menangani audio yang terdegradasi.

3. **File diam atau rusak** — Jalankan `analyze_media` pada file untuk memeriksa apakah FFprobe mendeteksi aliran audio yang valid.

4. **Kegagalan konversi** — File mungkin tidak dikonversi ke WAV dengan benar. Coba konversi secara manual terlebih dahulu:
```
ffmpeg -i yourfile.3gp -ar 16000 -ac 1 output.wav
```
Kemudian transkripsi WAV secara langsung.

---

## Tugas latar belakang gagal pada file dengan karakter khusus atau Unicode di nama file

**Penyebab:** whisper-cli.exe tidak dapat menulis file output saat jalur mengandung karakter Unicode (bahasa Indonesia, Jepang, Korea, emoji, tanda kurung, dll.) atau karakter khusus tertentu.

**Solusi sementara saat ini:** Ubah nama file agar hanya menggunakan karakter ASCII sebelum transkripsi, lalu ubah nama kembali jika diperlukan.

```
ren "nama_file_indonesia.mp4" "temp_transcribe.mp4"
```

**Status:** Ini adalah bug yang diketahui. Perbaikan direncanakan yang akan merutekan output melalui jalur temp yang disanitasi dan memindahkan hasilnya ke tujuan yang benar setelah selesai.

---

## Tugas latar belakang menampilkan "gagal" tanpa output

**Kemungkinan penyebab:**

1. **Nama file Unicode** — Lihat di atas.

2. **Jalur model salah** — Proses terpisah tidak mewarisi jalur yang telah dikoreksi. Jalankan `check_config` untuk memverifikasi jalur.

3. **Proses dihentikan** — Jika whisper-cli.exe dihentikan secara manual di tengah tugas, tidak ada file output yang akan ada. Coba lagi.

4. **VRAM tidak cukup** — Model besar pada GPU dengan VRAM rendah mungkin gagal secara diam-diam. Coba model yang lebih kecil.

5. **Konversi file gagal** — Coba transkripsi file WAV langsung untuk mengisolasi apakah masalahnya ada di konversi atau transkripsi.

---

## Transkripsi latar belakang tidak menghasilkan output SRT

**Penyebab:** Mode latar belakang (`background=true` di `transcribe_audio`) saat ini hanya menghasilkan output `.txt`. Format SRT dalam mode latar belakang belum diimplementasikan.

**Solusi:** Untuk file di bawah ~4 menit, gunakan `generate_subtitles` dalam mode pemblokiran. Untuk file yang lebih panjang, transkripsi dalam mode latar belakang terlebih dahulu untuk mendapatkan `.txt`, kemudian jika SRT diperlukan, gunakan `generate_subtitles` pada file yang sama (akan mentranskrip ulang).

**Status:** Dukungan SRT dalam mode latar belakang direncanakan untuk rilis mendatang.

---

## GPU tidak digunakan (CPU macet di atas 50%)

**Penyebab:** Anda menjalankan binary khusus CPU yang disertakan dengan rilis whisper.cpp standar.

**Solusi:** Unduh build yang mengaktifkan Vulkan dari [halaman rilis](https://github.com/eviscerations/whisper-windows-mcp/releases/tag/v1.4.0) dan ekstrak ke `C:\whisper\Release\`.

Verifikasi akselerasi GPU aktif:
- Minta Claude `check_system`
- Cari `✅ Vulkan binary: ggml-vulkan.dll found` dalam output
- Pantau Task Manager → Performa → GPU selama transkripsi — utilisasi GPU seharusnya naik ke 15–30%

---

## `check_system` melaporkan jumlah VRAM yang salah

Ini adalah keterbatasan Windows yang diketahui. Perintah `wmic` membaca VRAM dari registry, yang pada banyak kartu AMD melaporkan setengah VRAM fisik. Vega 56 dengan 8GB HBM2 biasanya menampilkan 4GB. Ini hanya masalah tampilan — whisper menggunakan VRAM fisik penuh selama inferensi.

---

## Error "Transkripsi sudah berlangsung"

Ada proses `whisper-cli.exe` yang berjalan dari tugas sebelumnya. Tunggu hingga selesai, atau:

1. Buka Task Manager → tab Detail
2. Temukan `whisper-cli.exe`
3. Klik kanan → Akhiri tugas

Kemudian coba lagi.

---

## Deteksi bahasa otomatis salah

Deteksi otomatis Whisper berjalan pada 30 detik pertama audio. Jika file dimulai dalam bahasa yang berbeda dari sebagian besar kontennya, deteksi mungkin salah.

**Solusi:** Tentukan bahasa secara eksplisit (misalnya `language=id`) daripada mengandalkan deteksi otomatis.

---

## Pembuatan subtitle menghasilkan "(berbicara dalam bahasa asing)" di seluruh bagian

Whisper mendeteksi ucapan tetapi tidak dapat mentranskrip. Penyebab paling umum:

1. **Model salah** — Menggunakan model khusus bahasa Inggris pada audio non-Inggris. Gunakan `large-v3`.

2. **Kualitas audio** — Lingkungan yang bising (dapur, kerumunan, gema) mungkin mengalahkan model medium. Coba `large-v3`.

3. **Bahasa campuran** — File dengan dua bahasa yang bergantian akan membuat bahasa minoritas diisi placeholder dengan pengaturan satu bahasa.

---

## Terjemahan subtitle hanya menghasilkan bahasa Inggris

Ini adalah desain yang disengaja. Flag `--translate` bawaan Whisper hanya menerjemahkan **ke bahasa Inggris**. Untuk terjemahan ke bahasa target lain, terjemahkan konten file `.srt` secara terpisah.

---

## Transkripsi batch berhenti maju

Panggil `check_batch_progress` lagi. Jika masih macet:

1. Periksa Task Manager untuk proses `whisper-cli.exe` yang berjalan
2. Periksa log tugas di `%TEMP%\whisper-mcp-jobs\`
3. File yang gagal ditandai dalam laporan batch — jalankan ulang secara individual dengan `transcribe_audio`

---

## Membersihkan direktori tugas sementara

whisper-windows-mcp menulis file status tugas dan log ke `%TEMP%\whisper-mcp-jobs\` selama transkripsi. File-file ini terakumulasi dari waktu ke waktu dan dapat menghabiskan ruang disk, terutama file `.log` dari tugas transkripsi yang panjang.

Setelah batch atau tugas selesai dan Anda telah memverifikasi transkrip output, Anda dapat dengan aman menghapus semua yang ada di direktori ini:

```powershell
Remove-Item "$env:TEMP\whisper-mcp-jobs\*" -Recurse -Force
```

Direktori akan dibuat ulang secara otomatis pada transkripsi berikutnya. Tidak ada file output transkrip yang disimpan secara permanen di sini — file dipindahkan ke direktori sumber saat selesai. Hanya metadata tugas dan log yang tersisa.

**Catatan:** Jangan hapus direktori ini saat transkripsi sedang berlangsung — file status batch diperlukan agar `check_batch_progress` berfungsi.

---

## Batch besar tanpa pengawasan dari command line

Untuk batch yang sangat besar di mana Anda ingin menjalankan semalaman tanpa Claude, gunakan PowerShell.

**Penting:** whisper-cli.exe tidak dapat membaca MP4, MKV, atau sebagian besar format video secara langsung. FFmpeg harus mengkonversi setiap file ke WAV terlebih dahulu. whisper juga menulis transkrip ke stdout dan output diagnostik ke stderr — gunakan `Start-Process -RedirectStandardOutput` untuk menangkap transkrip dengan benar. Menggunakan pipe `|` atau mengalihkan stderr dengan `2>$null` tidak menangkap apa pun.

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

Ganti `*.mp4` dengan `*.mkv`, `*.m4a`, dll. sesuai jenis file Anda. Pemeriksaan lewati `Test-Path` berarti menjalankan ulang skrip setelah gangguan tidak akan memproses ulang file yang sudah selesai.

Script ini menulis file `.txt` di sebelah setiap sumber. Alat MCP akan mengenali file-file ini sebagai sudah ditranskripsi saat Anda menjalankan `analyze_media` atau `start_batch` setelahnya.

---

## Lokasi file konfigurasi

```
C:\Users\NamaPengguna\AppData\Roaming\Claude\claude_desktop_config.json
```

Jika `AppData` tidak terlihat: Tampilan → Tampilkan → Item tersembunyi di File Explorer.

---

## Contoh konfigurasi lengkap yang berfungsi

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

`FFMPEG_PATH` default ke `ffmpeg` (mengasumsikan ada di PATH). Atur secara eksplisit hanya jika FFmpeg dipasang di lokasi non-standar.
