# Kebijakan Keamanan

## Cakupan

whisper-windows-mcp adalah alat yang mengutamakan lokal. Semua pemrosesan audio terjadi di mesin Anda — tidak ada audio, file video, atau data pribadi yang dikirim ke server mana pun. Permukaan serangan terbatas pada:

- Sistem file lokal (jalur file yang diteruskan ke alat)
- Binary whisper-cli.exe dan dependensinya
- Koneksi Claude Desktop MCP (hanya IPC lokal)
- Teks transkrip yang dikembalikan dalam respons alat (lihat Arsitektur Privasi di bawah)

## Arsitektur Privasi

**File audio tidak pernah meninggalkan mesin Anda.** Jaminan ini bersifat tanpa syarat.

**Teks transkrip mungkin meninggalkan mesin Anda.** Saat respons alat menyertakan teks transkrip, teks tersebut diproses oleh API Claude. Ini adalah perilaku MCP standar tetapi menciptakan celah antara filosofi desain "utamakan lokal" alat dan aliran data aktual bagi pengguna yang menangani konten yang diatur atau rahasia.

Variabel lingkungan `WHISPER_PRIVACY_MODE` direncanakan yang akan membatasi semua respons alat hanya ke metadata — tidak ada teks transkrip yang dikembalikan ke API Claude. Ini adalah solusi yang dimaksudkan untuk penerapan medis, hukum, keuangan, dan perusahaan.

Lihat [PRIVACY.md](PRIVACY.md) untuk deskripsi arsitektur privasi lengkap, panduan kerangka kepatuhan (HIPAA, GDPR, hak istimewa pengacara-klien, FERPA, SOX, PCI-DSS), dan instruksi konfigurasi.

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

## Keputusan Desain yang Diketahui

- **Injeksi jalur file:** Alat menerima jalur file absolut dari Claude. Ini adalah desain yang disengaja — alat ini dimaksudkan untuk digunakan dengan Claude Desktop oleh pemilik mesin. Jangan paparkan server MCP ini ke akses jaringan yang tidak terpercaya.
- **Tidak ada sandboxing:** whisper-cli.exe berjalan dengan izin yang sama seperti Claude Desktop. Ini adalah standar untuk alat MCP lokal.
- **File sementara:** File WAV perantara ditulis ke `%TEMP%\whisper_tmp_*.wav` dan dihapus setelah transkripsi. File status tugas ditulis ke `%TEMP%\whisper-mcp-jobs\` dan bertahan hingga dihapus secara manual atau hingga fitur pembersihan otomatis yang direncanakan tersedia.
- **Konten transkrip:** Teks transkrip yang dikembalikan dalam respons alat diproses oleh API Claude. Ini terdokumentasi dan akan dapat diatasi melalui `WHISPER_PRIVACY_MODE` dalam rilis mendatang. Lihat [PRIVACY.md](PRIVACY.md).
