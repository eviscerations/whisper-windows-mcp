# Arsitektur Privasi — whisper-windows-mcp

Dokumen ini menjelaskan data apa yang tetap di mesin Anda, data apa yang meninggalkan mesin, dan cara mengkonfigurasi alat untuk konten yang diatur atau sensitif.

---

## Jaminan Inti

whisper-windows-mcp dibangun di atas arsitektur yang mengutamakan lokal. **File audio dan video tidak pernah meninggalkan mesin Anda.** Transkripsi berjalan sepenuhnya di hardware Anda menggunakan whisper.cpp — tidak ada layanan cloud, tidak ada koneksi internet, tidak ada panggilan API yang terlibat dalam transkripsi itu sendiri.

Jaminan ini berlaku tanpa syarat untuk file media.

---

## Data yang Selalu Tersimpan Lokal

| Data | Meninggalkan mesin? |
|---|---|
| File audio | ❌ Tidak pernah |
| File video | ❌ Tidak pernah |
| File model Whisper | ❌ Tidak pernah |
| File WAV konversi sementara | ❌ Tidak pernah (dihapus setelah transkripsi) |
| File status batch dan tugas | ❌ Tidak pernah |
| File transkrip `.txt` / `.srt` / `.vtt` di disk | ❌ Tidak pernah |

---

## Data yang Dapat Meninggalkan Mesin (mode standar)

Saat respons alat menyertakan teks transkrip, teks tersebut dikembalikan ke Claude Desktop dan diproses oleh API Anthropic. Ini adalah perilaku MCP standar — teks berpindah dari server MCP lokal ke model Claude melalui jaringan.

| Data | Meninggalkan mesin? |
|---|---|
| Teks transkrip yang dikembalikan sebaris dalam respons alat | ✅ Ya, dalam mode standar |
| Teks transkrip yang diunggah langsung ke Claude sebagai file | ✅ Ya (di luar MCP sepenuhnya — tidak ada kontrol privasi yang berlaku) |

Celah ini ada antara jaminan "tidak ada data yang meninggalkan mesin" dari alat dan perilaku aktual saat Anda meminta Claude untuk membaca, meringkas, atau menganalisis transkrip. Sebagian besar pengguna — mereka yang mentranskrip konten publik seperti video YouTube, podcast, atau rekaman streaming — tidak terpengaruh oleh perbedaan ini.

Bagi pengguna yang menangani rekaman pribadi, rahasia, atau yang diatur, perbedaan ini penting.

---

## Mode Privasi

`WHISPER_PRIVACY_MODE` membatasi semua respons alat hanya ke metadata. Saat aktif:

- Respons alat hanya mengembalikan: nama file, jumlah kata, jalur penyimpanan, status penyelesaian
- Tidak ada teks transkrip yang disertakan dalam respons alat mana pun, sama sekali
- Claude tidak dapat membaca, menganalisis, atau meneruskan konten transkrip dalam bentuk apa pun
- Transkrip hanya ada sebagai file lokal di disk

Mode privasi dirancang untuk penerapan hukum, medis, keuangan, dan perusahaan di mana konten transkrip tidak boleh meninggalkan lingkungan lokal dalam keadaan apa pun.

### Mengaktifkan secara global (variabel lingkungan)

Atur di `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "whisper": {
      "command": "npx",
      "args": ["-y", "whisper-windows-mcp"],
      "env": {
        "WHISPER_CLI_PATH": "C:\\whisper\\Release\\whisper-cli.exe",
        "WHISPER_MODEL": "C:\\whisper\\models\\ggml-large-v3.bin",
        "WHISPER_PRIVACY_MODE": "true"
      }
    }
  }
}
```

Memerlukan restart Claude Desktop untuk diterapkan.

### Mengaktifkan per-panggilan (tidak perlu restart)

Teruskan `privacy_mode=true` langsung ke alat transkripsi mana pun:

- *"Transkrip file ini dalam mode privasi"*
- *"Mulai batch pada folder ini, privacy_mode=true"*
- *"Periksa kemajuan job_123, privacy_mode=true"*

Parameter per-panggilan menggantikan variabel lingkungan global dalam kedua arah. Teruskan `privacy_mode=false` untuk menonaktifkan satu panggilan meskipun `WHISPER_PRIVACY_MODE=true` secara global.

### Perilaku gerbang mode privasi

Saat mode privasi aktif, konfirmasi pengungkapan ditampilkan **sebelum setiap operasi**. Ini disengaja — kepatuhan regulasi mengharuskan persetujuan yang diinformasikan sebelum setiap kejadian pemrosesan, bukan hanya sekali per sesi.

Teks pengungkapan identik setiap saat berdasarkan desain. Pengulangannya adalah intinya: jika Anda menangani konten sensitif, Anda harus mengkonfirmasi setiap operasi secara eksplisit.

Konfirmasi terikat pada **operasi spesifik** — alat beserta argumen persisnya. Mengonfirmasi satu transkripsi tidak dapat memenuhi gerbang operasi yang berbeda, dan mengubah parameter apa pun diperlakukan sebagai operasi baru yang memerlukan konfirmasinya sendiri.

Untuk `start_batch` dengan mode privasi: satu konfirmasi diperlukan sebelum batch dimulai. Semua file kemudian diproses tanpa pengawasan. Tidak ada teks transkrip yang dikembalikan pada titik mana pun — hanya metadata kemajuan batch.

---

## Gerbang Persetujuan (mode standar)

Saat mode privasi tidak aktif, pengungkapan satu kali per sesi ditampilkan sebelum teks transkrip apa pun dikembalikan ke API Claude untuk pertama kali dalam sesi.

Pengungkapan mencakup:
- Bahwa teks transkrip akan dikirimkan ke API Anthropic
- Kerangka regulasi yang mungkin berlaku untuk konten Anda
- Cara mengaktifkan mode privasi jika diperlukan
- Cara melewati gerbang secara permanen untuk konten yang tidak sensitif

Setelah Anda mengkonfirmasi, gerbang tidak aktif lagi untuk sisa sesi. Restart Claude Desktop mereset sesi dan gerbang aktif lagi pada panggilan berikutnya yang mengembalikan transkrip.

**Untuk tugas latar belakang:** gerbang persetujuan aktif saat penyelesaian `check_progress`, bukan saat pemanggilan `transcribe_audio`. Pada saat pemanggilan, belum ada teks transkrip yang ada — tidak ada yang perlu dibatasi. Gerbang aktif begitu teks transkrip pertama kali akan dikembalikan ke API.

### Melewati gerbang secara permanen

Jika Anda secara rutin mentranskrip konten yang tidak sensitif dan tidak lagi membutuhkan pengingat, atur di konfigurasi Anda:

```json
"WHISPER_CONSENT_ACKNOWLEDGED": "true"
```

Ini tidak berpengaruh saat mode privasi aktif. Mode privasi menggunakan gerbang per-operasinya sendiri yang selalu aktif terlepas dari pengaturan ini.

---

## Ringkasan Aliran Data

| Mode | Audio | Teks transkrip | Konfirmasi diperlukan |
|---|---|---|---|
| Standar | Lokal saja | Dikirim ke API Anthropic | Sekali per sesi (gerbang persetujuan) |
| Mode privasi (variabel lingkungan) | Lokal saja | Tidak pernah dikirimkan | Sebelum setiap operasi |
| Mode privasi (per-panggilan) | Lokal saja | Tidak untuk panggilan ini | Sebelum operasi ini |
| `WHISPER_CONSENT_ACKNOWLEDGED=true` | Lokal saja | Dikirim ke API Anthropic | Tidak pernah (dilewati) |

---

## Mengunggah File Transkrip Langsung ke Claude

Saat Anda mengunggah file transkrip `.txt` langsung ke Claude sebagai lampiran file — sepenuhnya di luar alat MCP — server MCP tidak memiliki visibilitas dan tidak dapat menerapkan kontrol privasi apa pun.

Mengunggah transkrip langsung ke Claude setara dengan mengirim konten audio ke Anthropic. Mode privasi dan semua perlindungan tingkat MCP sepenuhnya dilewati oleh unggahan file langsung.

Pengguna yang menangani konten yang diatur tidak boleh mengunggah transkrip langsung ke Claude. Satu-satunya jalur analisis yang aman untuk konten yang diatur adalah alat pemrosesan lokal yang tidak mengirimkan konten secara eksternal.

---

## Panduan Industri yang Diatur

Berikut hanya informasi umum. Penulis alat ini bukan pengacara. Pengguna bertanggung jawab penuh atas kepatuhan terhadap hukum dan peraturan yang berlaku. Jika ragu, konsultasikan dengan penasihat hukum yang berkualifikasi sebelum mentranskrip konten yang diatur.

### HIPAA (AS — layanan kesehatan)
Penyedia layanan kesehatan, perusahaan asuransi, dan mitra bisnis mereka dilarang mengirimkan Informasi Kesehatan Terlindungi (PHI) kepada pihak ketiga yang tidak berwenang tanpa Perjanjian Mitra Bisnis (BAA). Anthropic tidak menawarkan HIPAA BAA untuk penggunaan API konsumen Claude.

**Kasus penggunaan yang terpengaruh:** Konsultasi pasien, catatan klinis, sesi terapi, panggilan klaim asuransi, rekaman administratif rumah sakit.

**Rekomendasi:** Aktifkan `WHISPER_PRIVACY_MODE=true` sebelum mentranskrip audio pasien apa pun. Jangan nonaktifkan di tengah sesi.

### GDPR (EU/EEA)
Data pribadi penduduk EU tidak dapat ditransfer ke pemroses pihak ketiga tanpa persetujuan eksplisit dan dasar hukum untuk pemrosesan. Teks transkrip yang mengandung nama, lokasi, atau informasi pengidentifikasi apa pun merupakan data pribadi menurut GDPR.

**Kasus penggunaan yang terpengaruh:** Wawancara, rapat, rekaman call center, proses hukum yang melibatkan penduduk EU.

**Rekomendasi:** Aktifkan mode privasi untuk rekaman apa pun yang mungkin mengandung data pribadi penduduk EU/EEA.

### Hak Istimewa Pengacara-Klien (AS, Inggris, Australia, dan sebagian besar yurisdiksi hukum umum)
Komunikasi antara pengacara dan klien secara hukum memiliki hak istimewa. Pengungkapan kepada pihak ketiga yang tidak berwenang dapat menghilangkan hak istimewa. Tidak ada preseden hukum yang mapan yang melindungi komunikasi pengacara-klien saat diproses oleh API AI komersial.

**Kasus penggunaan yang terpengaruh:** Deposisi hukum, konsultasi klien, rekaman strategi internal, wawancara saksi.

**Rekomendasi:** Pengacara yang mentranskrip komunikasi yang memiliki hak istimewa harus mengaktifkan mode privasi. Jangan nonaktifkan untuk analisis — gunakan editor teks lokal atau alat pemrosesan untuk konten yang memiliki hak istimewa.

### FERPA (AS — pendidikan)
Catatan pendidikan siswa dilindungi. Sekolah dan universitas tidak dapat mengungkapkan informasi siswa yang dapat diidentifikasi kepada pihak ketiga tanpa persetujuan.

**Kasus penggunaan yang terpengaruh:** Kuliah yang direkam, sesi konseling siswa, sidang akademik, rapat IEP.

### SOX (AS — perusahaan publik)
Komunikasi keuangan perusahaan publik tunduk pada persyaratan penyimpanan catatan dan kerahasiaan. Informasi non-publik material (MNPI) tidak dapat diungkapkan secara selektif.

**Kasus penggunaan yang terpengaruh:** Rekaman earnings call, transkrip rapat dewan, komunikasi investor, diskusi strategi keuangan internal.

### PCI-DSS
Data kartu pembayaran tidak dapat disimpan atau dikirim di lingkungan yang tidak aman. Rekaman suara nomor kartu selama transaksi termasuk dalam cakupan.

**Kasus penggunaan yang terpengaruh:** Rekaman call center, panggilan layanan pelanggan yang melibatkan pemrosesan pembayaran.

### Perlindungan Rahasia Dagang / NDA
Informasi bisnis rahasia, formula eksklusif, detail produk yang belum dirilis, dan informasi personalia mungkin dilindungi oleh kontrak atau hukum.

**Kasus penggunaan yang terpengaruh:** Rapat strategi perusahaan, diskusi R&D, panggilan due diligence M&A, proses HR.

---

## Melaporkan Masalah Privasi

Jika Anda mengidentifikasi masalah privasi atau celah arsitektur yang tidak tercakup di sini, gunakan pelaporan kerentanan pribadi GitHub daripada membuka issue publik. Lihat [SECURITY.md](SECURITY.md) untuk instruksi pelaporan.
