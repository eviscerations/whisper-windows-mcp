# Kebijakan Keamanan

## Cakupan

whisper-windows-mcp adalah alat yang mengutamakan lokal. Semua pemrosesan audio terjadi di mesin Anda — tidak ada audio, file video, atau data pribadi yang dikirim ke server mana pun. Permukaan serangan terbatas pada:

- Sistem file lokal (jalur file yang diteruskan ke alat)
- Binary whisper-cli.exe dan dependensinya
- Koneksi Claude Desktop MCP (hanya IPC lokal)
- Teks transkrip yang dikembalikan dalam respons alat (lihat Arsitektur Privasi di bawah)

## Arsitektur Privasi

**File audio tidak pernah meninggalkan mesin Anda.** Jaminan ini bersifat tanpa syarat.

**Teks transkrip mungkin meninggalkan mesin Anda** dalam mode standar. Saat respons alat menyertakan teks transkrip, teks tersebut diproses oleh API Claude. Ini adalah perilaku MCP standar tetapi menciptakan celah antara filosofi desain "utamakan lokal" alat dan aliran data aktual bagi pengguna yang menangani konten yang diatur atau rahasia.

**Mode privasi** (`WHISPER_PRIVACY_MODE=true` atau `privacy_mode=true` per-panggilan) membatasi semua respons alat hanya ke metadata — tidak ada teks transkrip yang pernah dikembalikan ke API Claude. Ini adalah konfigurasi yang tepat untuk penerapan medis, hukum, keuangan, dan perusahaan.

**Gerbang mode privasi:** saat mode privasi aktif, konfirmasi pengungkapan ditampilkan sebelum setiap operasi transkripsi, dikunci per operasi (alat + argumen). Server memberlakukan *blok* — ia menahan operasi dan mengembalikan pengungkapan saat pertama kali melihat operasi tertentu. Server **tidak** memberlakukan bahwa seorang manusia telah menjawab: gerbang terbuka saat panggilan identik dikirim ulang, dengan asumsi bahwa host telah menampilkan pengungkapan dan pengguna menjawab "ya". Klien yang mengirim ulang panggilan yang sama tanpa manusia dalam prosesnya dapat memenuhi gerbang dengan sendirinya. Perlakukan ini sebagai kontrol persetujuan-terinformasi prosedural yang bergantung pada host MCP menghormati pengungkapan, bukan sebagai penghalang kriptografis.

**Gerbang persetujuan:** dalam mode standar, pengungkapan satu kali per sesi ditampilkan sebelum teks transkrip apa pun dikembalikan ke API untuk pertama kali. Atur `WHISPER_CONSENT_ACKNOWLEDGED=true` di konfigurasi Anda untuk melewatinya bagi konten yang tidak sensitif. Perhatikan bahwa ini adalah gerbang *satu-kali-per-sesi*: setelah transkrip pertama yang dikonfirmasi, transkrip berikutnya dalam sesi yang sama dikembalikan tanpa permintaan ulang. Gunakan mode privasi untuk konten yang tidak boleh pernah mencapai API terlepas dari status sesi.

Lihat [PRIVACY.md](PRIVACY.md) untuk deskripsi arsitektur privasi lengkap, panduan kerangka kepatuhan (HIPAA, GDPR, hak istimewa pengacara-klien, FERPA, SOX, PCI-DSS), dan instruksi konfigurasi.

## Verifikasi Binary

Untuk memverifikasi integritas binary `whisper-cli.exe` dalam rilis pre-built, periksa hash SHA256-nya di PowerShell:

```powershell
Get-FileHash "C:\whisper\Release\whisper-cli.exe" -Algorithm SHA256
```

Hash yang diharapkan untuk setiap binary rilis diterbitkan di [halaman rilis](https://github.com/eviscerations/whisper-windows-mcp/releases). Jangan gunakan binary yang hashnya tidak cocok.

## Versi yang Didukung

Perbaikan keamanan hanya diterapkan pada versi yang diterbitkan terbaru.

| Versi | Didukung |
|---|---|
| 2.x (terbaru) | ✅ |
| 1.x | ❌ |

## Melaporkan Kerentanan

**Jangan buka issue publik untuk kerentanan keamanan.**

Gunakan pelaporan kerentanan pribadi GitHub:
1. Buka [tab Security](https://github.com/eviscerations/whisper-windows-mcp/security)
2. Klik "Report a vulnerability"
3. Jelaskan masalah dengan detail yang cukup untuk mereproduksinya

Anda akan menerima respons dalam 7 hari. Jika kerentanan dikonfirmasi, perbaikan akan dirilis sesegera mungkin dan Anda akan dikreditkan dalam catatan rilis jika Anda menginginkannya.

## Sandbox & persetujuan

whisper-windows-mcp adalah **alat lokal, pengguna tunggal, yang dikendalikan oleh pemilik mesin melalui Claude Desktop.** Model ancamannya adalah pemilik yang menjalankannya di mesin mereka sendiri — bukan penyebaran yang tidak terpercaya, multi-penyewa, atau terekspos ke jaringan.

- **Sandboxing:** tidak ada, secara desain. `whisper-cli.exe` berjalan pada tingkat izin pemilik sendiri, sama seperti server MCP lokal mana pun. Isolasi tingkat OS bukanlah mitigasi di sini; cakupan penggunaanlah mitigasinya — **jangan paparkan server ini ke akses jaringan yang tidak terpercaya** (lihat "Injeksi jalur file" di bawah).
- **Persetujuan berlapis, bukan berbasis sandbox:**
  1. **Persetujuan host** — lapisan MCP Claude Desktop mengatur pemanggilan alat.
  2. **Gerbang persetujuan / privasi** — konfirmasi eksplisit diperlukan sebelum teks transkrip apa pun meninggalkan mesin menuju API Claude; `WHISPER_PRIVACY_MODE` / `privacy_mode` per-panggilan hanya mengembalikan metadata untuk konten yang diatur. Gerbang dikunci per operasi (alat + argumen). Lihat [PRIVACY.md](PRIVACY.md).
  3. **Validasi input** — diterapkan secara defensif pada setiap alat yang menerima jalur atau ID:
     - Jalur traversal direktori (`..`) dan UNC (`\\server\share`) ditolak pada **semua** input file/folder, termasuk `analyze_media` dan `transcribe_batch` (dua yang terakhir sebelumnya hanya memvalidasi keberadaan — jalur UNC yang tidak divalidasi dapat memicu koneksi SMB keluar ke host penyerang).
     - `job_id` / `batch_id` dicocokkan dengan format persis yang dibuat server sebelum digunakan untuk membangun jalur sistem file apa pun, sehingga ID yang direkayasa tidak dapat keluar dari direktori tugas menuju baca/tulis/hapus file sembarang.
     - `switch_model` **dan** override `model` pada `transcribe_audio` keduanya dibatasi pada direktori model yang dikonfigurasi melalui penahanan jalur yang dinormalisasi — override tidak dapat digunakan untuk memberi file sembarang ke `whisper-cli` sebagai modelnya.
     - Jalur `vad_model` menolak traversal/UNC.
     - `download_model` dibatasi pada daftar yang diizinkan dari namespace Hugging Face terpercaya (URL awal dan setiap pengalihan).
     - Binary sistem Windows yang dipanggil secara implisit oleh server (`tasklist`, `wmic`) dipanggil melalui jalur absolut `System32` sehingga tidak dapat dibayangi oleh executable bernama sama yang ditanam lebih awal di `PATH`.

**Catatan tentang batas "agen yang tidak terpercaya".** Alat ini dirancang untuk satu pemilik yang mengendalikannya melalui Claude Desktop, bukan sebagai infrastruktur bersama atau terekspos ke jaringan. Namun, konten audio/video yang ditranskripsi itu sendiri adalah input yang tidak terpercaya yang dapat *menyerupai instruksi* dan memengaruhi alat mana yang dipanggil berikutnya dan dengan argumen apa (lihat "Injeksi transkrip" di bawah). Karena itu, validasi input di atas diterapkan secara defensif alih-alih hanya mengandalkan asumsi pengguna tunggal. Postur agen yang sepenuhnya tidak terpercaya atau multi-penyewa akan tetap memerlukan sandbox OS/kontainer dan kebijakan egress — di luar cakupan alat transkripsi lokal pengguna tunggal.

## Keputusan Desain yang Diketahui

- **Injeksi jalur file:** Alat menerima jalur file absolut dari Claude. Ini adalah desain yang disengaja — alat ini dimaksudkan untuk digunakan dengan Claude Desktop oleh pemilik mesin. Jalur traversal (`..`) dan UNC ditolak pada semua alat yang menerima jalur; jalur lokal absolut selebihnya diterima. Jangan paparkan server MCP ini ke akses jaringan yang tidak terpercaya.
- **Validasi ID tugas/batch:** `job_id` dan `batch_id` harus cocok dengan bentuk persis yang dibuat server (`job_<epochMs>_<8 hex>` / `batch_<epochMs>_<8 hex>`) sebelum digunakan untuk membangun jalur sistem file apa pun. Ini mencegah ID yang direkayasa keluar dari direktori tugas menuju baca, tulis, atau hapus file sembarang melalui penanganan penyelesaian tugas.
- **Gerbang persetujuan/privasi bersifat prosedural:** Gerbang bergantung pada host MCP yang menampilkan pengungkapan dan seorang manusia menjawab sebelum operasi dikirim ulang. Server memberlakukan perilaku blok-hingga-dikirim-ulang tetapi tidak dapat memverifikasi bahwa manusia telah menjawab. Untuk konten yang tidak boleh pernah mencapai API, andalkan mode privasi (respons hanya metadata), bukan gerbang saja.
- **Tidak ada sandboxing:** whisper-cli.exe berjalan dengan izin yang sama seperti Claude Desktop. Ini adalah standar untuk alat MCP lokal.
- **File sementara:** File WAV perantara ditulis ke `%TEMP%\whisper_tmp_*.wav` dan dihapus setelah transkripsi. File status tugas ditulis ke `%TEMP%\whisper-mcp-jobs\` dan dibersihkan secara otomatis setelah 7 hari saat server dimulai.
- **Konten transkrip:** Teks transkrip yang dikembalikan dalam respons alat diproses oleh API Claude dalam mode standar. Aktifkan `WHISPER_PRIVACY_MODE=true` atau teruskan `privacy_mode=true` per-panggilan untuk mencegah hal ini. Lihat [PRIVACY.md](PRIVACY.md).
- **Injeksi transkrip:** File audio dapat mengandung konten lisan yang, saat ditranskrip, menyerupai instruksi. Pertahanan bawaan Claude menangani hal ini. Server MCP itu sendiri menandai semua konten transkrip sebagai data yang tidak terpercaya dan tidak pernah menginterpretasikannya sebagai instruksi.
- **Unduhan model:** Alat `download_model` hanya mengunduh dari dua namespace Hugging Face terpercaya (`ggerganov/whisper.cpp` dan `ggml-org`). Pengalihan divalidasi terhadap daftar yang diizinkan sebelum diikuti. URL sembarang ditolak di tingkat kode. Unduhan yang terpotong/tidak lengkap ditolak (pemeriksaan Content-Length) sebelum file `.part` dipromosikan ke nama model. **Tindak lanjut:** unduhan belum diverifikasi terhadap digest SHA256 per-model, sehingga upstream yang disusupi atau penyerang on-path masih dapat menyajikan `.bin` berbahaya. Digest yang disematkan direncanakan; verifikasi hash secara manual terhadap halaman rilis untuk penerapan dengan jaminan tinggi.
- **Penahanan pemilihan model:** Baik `switch_model` maupun override `model` pada `transcribe_audio` hanya menerima file `.bin` dalam direktori model yang dikonfigurasi. Jalur di luarnya ditolak melalui kontainmen jalur ternormalisasi — direktori berprefiks saudara seperti `…\models-evil` tidak dapat memenuhi pemeriksaan — terlepas dari cara jalur ditentukan. Jalur `vad_model` menolak traversal/UNC.
- **Binary sistem implisit:** `tasklist` dan `wmic` dipanggil melalui jalur absolut `System32`, bukan dengan nama polos, sehingga tidak dapat dibayangi oleh executable bernama sama yang ditanam lebih awal di `PATH`.
- **Server model persisten:** alat opsional `whisper_server` menjalankan `whisper-server` milik whisper.cpp sebagai proses residen. Ia terikat hanya ke `127.0.0.1` — tidak pernah antarmuka yang dapat dirutekan — sehingga tidak dapat dijangkau dari luar mesin. Ia dimulai dan dihentikan secara eksplisit (tidak pernah dimulai otomatis), dan proses yang dimiliki dibunuh saat shutdown. Karena server residen dan `whisper-cli` sekali-jalan akan bersaing untuk GPU/VRAM yang sama, keduanya saling eksklusif: backstop keras di jalur detached-spawn mencegah tugas CLI apa pun diluncurkan saat server aktif, dan alat transkripsi menolak operasi yang memerlukan CLI sampai server dihentikan. `WHISPER_SERVER_PORT` memilih port localhost; host tidak dapat dikonfigurasi secara desain.
