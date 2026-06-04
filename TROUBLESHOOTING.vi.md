# whisper-windows-mcp — Khắc phục sự cố

---

## Danh sách kiểm tra nhanh

Trước khi tìm hiểu sâu hơn, hãy xác nhận tất cả những điều sau:

- Đường dẫn trong `claude_desktop_config.json` dùng **dấu gạch chéo ngược kép** (`C:\\whisper\\...`)
- `whisper-cli.exe` tồn tại tại đường dẫn được chỉ định trong `WHISPER_CLI_PATH`
- Tệp mô hình `.bin` tồn tại tại đường dẫn được chỉ định trong `WHISPER_MODEL`
- FFmpeg đã cài đặt và có thể truy cập (`ffmpeg -version` hoạt động trong command prompt)
- Claude Desktop đã được **khởi động lại hoàn toàn** sau khi chỉnh sửa cấu hình (thoát từ system tray, không chỉ đóng cửa sổ)
- Máy chủ whisper hiển thị **đang chạy** (huy hiệu màu xanh) trong Cài đặt → Nhà phát triển

---

## "whisper không được kết nối" hoặc không có công cụ nào

**Nguyên nhân phổ biến nhất:** Claude Desktop không được khởi động lại hoàn toàn sau khi chỉnh sửa cấu hình.

1. Nhấp chuột phải vào biểu tượng Claude trong system tray → Thoát
2. Mở lại Claude Desktop
3. Đi đến Cài đặt → Nhà phát triển và kiểm tra huy hiệu **đang chạy** màu xanh bên cạnh whisper

Nếu vẫn không hiển thị:

1. Mở `claude_desktop_config.json` và kiểm tra lỗi cú pháp JSON (thiếu dấu phẩy, dấu ngoặc không khớp)
2. Đảm bảo tất cả đường dẫn dùng dấu gạch chéo ngược kép
3. Chạy `check_config` trong Claude Desktop để nhận thông tin chẩn đoán

---

## download_model bị timeout với mô hình lớn

Claude Desktop có thời gian timeout 4 phút cho các lệnh gọi công cụ MCP. Tải xuống mô hình lớn trên kết nối chậm có thể vượt quá giới hạn này.

**Kích thước tệp:**
- `large-v3` — 2.9 GB
- `large-v3-turbo` — 1.6 GB
- `large-v3-q5_0` — 1.1 GB
- `large-v3-turbo-q5_0` — 547 MB
- `medium.en` — 1.5 GB
- `medium.en-q5_0` — 514 MB

Trên kết nối nhanh (100 Mbps+), ngay cả large-v3 cũng tải trong vòng 4 phút. Trên kết nối chậm hơn, hãy dùng trình duyệt hoặc PowerShell để tải trực tiếp và đặt tệp vào thư mục mô hình thủ công:

```powershell
# Ví dụ — tải trực tiếp large-v3-turbo
Invoke-WebRequest -Uri "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin" `
  -OutFile "C:\whisper\models\ggml-large-v3-turbo.bin"
```

Sau đó dùng `switch_model ggml-large-v3-turbo.bin` để kích hoạt.

---

## `check_config` báo không tìm thấy whisper-cli.exe

Đường dẫn trong cấu hình không khớp với vị trí thực tế của tệp.

Xác nhận tệp tồn tại:
```
dir C:\whisper\Release\whisper-cli.exe
```

Nếu ở vị trí khác, hãy cập nhật `WHISPER_CLI_PATH` trong cấu hình để khớp với đường dẫn thực tế.

---

## `check_config` báo không tìm thấy FFmpeg

FFmpeg chưa được cài đặt hoặc không có trong PATH hệ thống.

Cài đặt qua winget:
```
winget install ffmpeg
```

Hoặc tải xuống từ [ffmpeg.org](https://ffmpeg.org/download.html), giải nén và thêm thư mục `bin` vào PATH hệ thống.

Sau khi cài đặt, mở command prompt mới và xác nhận:
```
ffmpeg -version
```

Nếu bạn cài FFmpeg ở vị trí không chuẩn, hãy đặt biến môi trường `FFMPEG_PATH` trong cấu hình Claude Desktop:
```json
"env": {
  "FFMPEG_PATH": "C:\\ffmpeg\\bin\\ffmpeg.exe"
}
```

---

## Kết quả phiên âm đầy thẻ `[FOREIGN]`

**Nguyên nhân:** Bạn đang dùng mô hình chỉ tiếng Anh (ví dụ: `ggml-medium.en.bin`) với âm thanh không phải tiếng Anh. Mô hình chỉ tiếng Anh không thể xử lý các ngôn ngữ khác và xuất ra `[FOREIGN]` cho mọi đoạn không thể xử lý.

**Cách sửa:** Tải xuống và sử dụng `ggml-large-v3.bin` — mô hình đa ngôn ngữ. Đây là yêu cầu bắt buộc cho bất kỳ phiên âm không phải tiếng Anh, tự động phát hiện ngôn ngữ hoặc dịch nào.

```
https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin
```

Lưu vào `C:\whisper\models\` và cập nhật cấu hình:
```json
"WHISPER_MODEL": "C:\\whisper\\models\\ggml-large-v3.bin"
```

Hoặc ghi đè từng lần phiên âm bằng tham số `model` trong `transcribe_audio` hoặc `generate_subtitles`.

> **Lưu ý:** Mô hình chỉ tiếng Anh (`*.en.bin`) nhanh hơn và chính xác hơn cho nội dung tiếng Anh nhưng hoàn toàn không thể xử lý các ngôn ngữ khác. Nếu bạn làm việc với nội dung đa ngôn ngữ, `large-v3` là mô hình đúng bất kể phần cứng.

---

## Phiên âm không tạo ra đầu ra hoặc tệp trống

**Nguyên nhân có thể:**

1. **Mô hình sai cho ngôn ngữ** — Mô hình chỉ tiếng Anh (`*.en.bin`) không thể phiên âm các ngôn ngữ khác. Sử dụng `ggml-large-v3.bin` cho nội dung đa ngôn ngữ.

2. **Chất lượng âm thanh quá thấp** — Tệp có bitrate rất thấp (ví dụ: bản ghi điện thoại `.3gp` cũ dùng codec AMR-NB ~12kbps) có thể ở ranh giới whisper có thể xử lý. Môi trường nhiều tạp âm (tiếng ồn nền, vang, người nói xa) cũng gặp khó khăn. Hãy thử `large-v3` vì nó xử lý âm thanh kém chất lượng tốt hơn các mô hình nhỏ.

3. **Tệp im lặng hoặc bị hỏng** — Chạy `analyze_media` trên tệp để kiểm tra xem FFprobe có phát hiện luồng âm thanh hợp lệ không.

4. **Lỗi chuyển đổi** — Tệp có thể không chuyển đổi sang WAV đúng cách. Thử chuyển đổi thủ công trước:
```
ffmpeg -i yourfile.3gp -ar 16000 -ac 1 output.wav
```
Sau đó phiên âm tệp WAV trực tiếp.

---

## Tác vụ nền thất bại với tên tệp chứa ký tự đặc biệt hoặc Unicode

**Nguyên nhân:** whisper-cli.exe không thể ghi tệp đầu ra khi đường dẫn chứa ký tự Unicode (tiếng Việt, tiếng Nhật, tiếng Hàn, emoji, dấu ngoặc, v.v.) hoặc một số ký tự đặc biệt nhất định.

**Đã sửa trong v2.0.0.** Nếu bạn đang chạy phiên bản hiện tại, vấn đề này sẽ không xảy ra. Nếu vẫn xảy ra, hãy cập nhật bằng `npm install -g whisper-windows-mcp` và khởi động lại Claude Desktop.

Nếu bạn đang dùng phiên bản cũ, giải pháp tạm thời: đổi tên tệp để chỉ dùng ký tự ASCII trước khi phiên âm, sau đó đổi lại nếu cần.

```
ren "ten_file_tieng_viet.mp4" "temp_transcribe.mp4"
```

---

## Tác vụ nền hiển thị "thất bại" không có đầu ra

**Nguyên nhân có thể:**

1. **Đường dẫn mô hình sai** — Tiến trình tách rời không kế thừa đường dẫn đã sửa. Chạy `check_config` để xác nhận đường dẫn.

2. **Tiến trình bị tắt** — Nếu whisper-cli.exe bị tắt thủ công giữa chừng, sẽ không có tệp đầu ra. Thử lại.

3. **VRAM không đủ** — Mô hình lớn trên GPU ít VRAM có thể thất bại lặng lẽ. Thử mô hình nhỏ hơn.

4. **Lỗi chuyển đổi tệp** — Thử phiên âm tệp WAV trực tiếp để xác định vấn đề là ở chuyển đổi hay phiên âm.

---

## GPU không được sử dụng (CPU cao trên 50%)

**Nguyên nhân:** Bạn đang chạy tệp nhị phân chỉ dùng CPU đi kèm với bản phát hành whisper.cpp tiêu chuẩn.

**Cách sửa:** Tải xuống bản build có Vulkan từ [trang phát hành](https://github.com/eviscerations/whisper-windows-mcp/releases/tag/v1.4.0) và giải nén vào `C:\whisper\Release\`.

Xác nhận tăng tốc GPU đang hoạt động:
- Yêu cầu Claude `check_system`
- Tìm `✅ Vulkan binary: ggml-vulkan.dll found` trong đầu ra
- Theo dõi Task Manager → Hiệu suất → GPU trong quá trình phiên âm — mức sử dụng GPU sẽ tăng lên 15–30%

---

## `check_system` báo dung lượng VRAM sai

Đây là giới hạn đã biết của Windows. Lệnh `wmic` đọc VRAM từ registry, trên nhiều card AMD báo một nửa VRAM vật lý. Card Vega 56 có 8GB HBM2 thường hiển thị 4GB. Đây chỉ là vấn đề hiển thị — whisper sử dụng đầy đủ VRAM vật lý trong quá trình suy luận.

---

## Lỗi "Đang phiên âm"

Có một tiến trình `whisper-cli.exe` đang chạy từ tác vụ trước. Chờ nó hoàn thành, hoặc:

1. Mở Task Manager → tab Chi tiết
2. Tìm `whisper-cli.exe`
3. Nhấp chuột phải → Kết thúc tác vụ

Sau đó thử lại.

---

## Tự động phát hiện ngôn ngữ sai

Tự động phát hiện của Whisper chạy trên 30 giây đầu tiên của âm thanh. Nếu tệp bắt đầu bằng ngôn ngữ khác với phần lớn nội dung, việc phát hiện có thể sai.

**Cách sửa:** Chỉ định ngôn ngữ rõ ràng (ví dụ: `language=vi`) thay vì dựa vào tự động phát hiện.

---

## Tạo phụ đề tạo ra "(đang nói bằng tiếng nước ngoài)" trong suốt

Whisper phát hiện giọng nói nhưng không thể phiên âm. Nguyên nhân phổ biến nhất:

1. **Mô hình sai** — Đang dùng mô hình chỉ tiếng Anh với âm thanh không phải tiếng Anh. Dùng `large-v3`.

2. **Chất lượng âm thanh** — Môi trường nhiều tạp âm (nhà bếp, đám đông, tiếng vang) có thể vượt quá khả năng của mô hình medium. Thử `large-v3`.

3. **Ngôn ngữ hỗn hợp** — Tệp có hai ngôn ngữ xen kẽ sẽ có ngôn ngữ thiểu số được thay thế bằng ký hiệu chỗ giữ khi dùng cài đặt một ngôn ngữ.

---

## Dịch phụ đề chỉ ra tiếng Anh

Đây là hành vi có chủ ý. Flag `--translate` tích hợp của Whisper chỉ dịch **sang tiếng Anh**. Để dịch sang các ngôn ngữ đích khác, hãy xử lý nội dung tệp `.srt` riêng biệt.

---

## Phiên âm hàng loạt ngừng tiến triển

Gọi `check_batch_progress` lại. Nếu vẫn bị kẹt:

1. Kiểm tra Task Manager xem có tiến trình `whisper-cli.exe` đang chạy không
2. Kiểm tra nhật ký tác vụ trong `%TEMP%\whisper-mcp-jobs\`
3. Các tệp thất bại được đánh dấu trong báo cáo đợt — hãy chạy lại từng tệp riêng lẻ bằng `transcribe_audio`

---

## Dọn dẹp thư mục tệp tạm thời

whisper-windows-mcp ghi tệp trạng thái tác vụ và nhật ký vào `%TEMP%\whisper-mcp-jobs\` trong quá trình phiên âm. Máy chủ tự động dọn dẹp các tệp cũ hơn 7 ngày khi khởi động. Để dọn dẹp thủ công, sau khi đợt hoặc tác vụ hoàn thành và bạn đã xác nhận các bản phiên âm đầu ra, bạn có thể xóa an toàn mọi thứ trong thư mục này:

```powershell
Remove-Item "$env:TEMP\whisper-mcp-jobs\*" -Recurse -Force
```

Thư mục sẽ được tạo lại tự động vào lần phiên âm tiếp theo. Không có tệp đầu ra phiên âm nào được lưu vĩnh viễn ở đây — chúng được di chuyển đến thư mục nguồn khi hoàn thành. Chỉ có siêu dữ liệu tác vụ và nhật ký còn lại.

**Lưu ý:** Không xóa thư mục này trong khi đang phiên âm — các tệp trạng thái đợt cần thiết để `check_batch_progress` hoạt động.

---

## Xử lý hàng loạt lớn không giám sát từ dòng lệnh

Với các đợt rất lớn mà bạn muốn chạy qua đêm không cần Claude, hãy sử dụng PowerShell.

**Quan trọng:** whisper-cli.exe không thể đọc trực tiếp MP4, MKV hoặc hầu hết các định dạng video. FFmpeg phải chuyển đổi từng tệp sang WAV trước. whisper cũng ghi bản phiên âm vào stdout và đầu ra chẩn đoán vào stderr — sử dụng `Start-Process -RedirectStandardOutput` để bắt bản phiên âm đúng cách. Dùng pipe `|` hoặc chuyển hướng stderr với `2>$null` sẽ không bắt được gì.

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

Thay `*.mp4` bằng `*.mkv`, `*.m4a` v.v. để khớp với loại tệp của bạn. Kiểm tra bỏ qua `Test-Path` có nghĩa là chạy lại script sau khi bị gián đoạn sẽ không xử lý lại các tệp đã hoàn thành.

Script này ghi tệp `.txt` bên cạnh mỗi tệp nguồn. Các công cụ MCP sẽ nhận ra chúng là đã được phiên âm khi bạn chạy `analyze_media` hoặc `start_batch` sau đó.

---

## Vị trí tệp cấu hình

```
C:\Users\TênNgườiDùng\AppData\Roaming\Claude\claude_desktop_config.json
```

Nếu `AppData` không hiển thị: Xem → Hiển thị → Mục ẩn trong File Explorer.

---

## Ví dụ cấu hình hoàn chỉnh hoạt động

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

`FFMPEG_PATH` mặc định là `ffmpeg` (giả sử có trong PATH). Chỉ đặt rõ ràng nếu FFmpeg được cài đặt ở vị trí không chuẩn.
