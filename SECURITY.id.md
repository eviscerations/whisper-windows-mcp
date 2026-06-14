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

**Gerbang mode privasi:** saat mode privasi aktif, konfirmasi pengungkapan ditampilkan sebelum setiap operasi transkripsi. Ini disengaja dan tidak dapat dilewati — kepatuhan regulasi mengharuskan persetujuan yang diinformasikan per-operasi.

**Gerbang persetujuan:** dalam mode standar, pengungkapan satu kali per sesi ditampilkan sebelum teks transkrip apa pun dikembalikan ke API untuk pertama kali. Atur `WHISPER_CONSENT_ACKNOWLEDGED=true` di konfigurasi Anda untuk melewatinya bagi konten yang tidak sensitif.

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
  3. **Validasi input** — jalur traversal direktori dan UNC ditolak; `switch_model` dibatasi pada direktori model yang dikonfigurasi; `download_model` dibatasi pada daftar yang diizinkan dari namespace Hugging Face terpercaya.

Alat ini **tidak** dirancang untuk dikendalikan oleh agen yang tidak terpercaya atau dijalankan sebagai infrastruktur bersama. Postur tersebut akan memerlukan sandbox OS/kontainer dan kebijakan egress — di luar cakupan alat transkripsi lokal pengguna tunggal.

## Keputusan Desain yang Diketahui

- **Injeksi jalur file:** Alat menerima jalur file absolut dari Claude. Ini adalah desain yang disengaja — alat ini dimaksudkan untuk digunakan dengan Claude Desktop oleh pemilik mesin. Jangan paparkan server MCP ini ke akses jaringan yang tidak terpercaya.
- **Tidak ada sandboxing:** whisper-cli.exe berjalan dengan izin yang sama seperti Claude Desktop. Ini adalah standar untuk alat MCP lokal.
- **File sementara:** File WAV perantara ditulis ke `%TEMP%\whisper_tmp_*.wav` dan dihapus setelah transkripsi. File status tugas ditulis ke `%TEMP%\whisper-mcp-jobs\` dan dibersihkan secara otomatis setelah 7 hari saat server dimulai.
- **Konten transkrip:** Teks transkrip yang dikembalikan dalam respons alat diproses oleh API Claude dalam mode standar. Aktifkan `WHISPER_PRIVACY_MODE=true` atau teruskan `privacy_mode=true` per-panggilan untuk mencegah hal ini. Lihat [PRIVACY.md](PRIVACY.md).
- **Injeksi transkrip:** File audio dapat mengandung konten lisan yang, saat ditranskrip, menyerupai instruksi. Pertahanan bawaan Claude menangani hal ini. Server MCP itu sendiri menandai semua konten transkrip sebagai data yang tidak terpercaya dan tidak pernah menginterpretasikannya sebagai instruksi.
- **Unduhan model:** Alat `download_model` hanya mengunduh dari dua namespace Hugging Face terpercaya (`ggerganov/whisper.cpp` dan `ggml-org`). Pengalihan divalidasi terhadap daftar yang diizinkan sebelum diikuti. URL sembarang ditolak di tingkat kode. Unduhan yang terpotong/tidak lengkap ditolak (pemeriksaan Content-Length) sebelum file `.part` dipromosikan ke nama model.
- **Pergantian model:** `switch_model` hanya menerima file `.bin` dalam direktori model yang dikonfigurasi. Jalur di luarnya ditolak melalui kontainmen jalur ternormalisasi — direktori berprefiks saudara seperti `…\models-evil` tidak dapat memenuhi pemeriksaan — terlepas dari cara jalur ditentukan.
