# whisper-windows-mcp

Máy chủ MCP (Model Context Protocol) dành riêng cho Windows. Sử dụng [whisper.cpp](https://github.com/ggml-org/whisper.cpp) để phiên âm tệp âm thanh và video cục bộ trong Claude Desktop — hỗ trợ tăng tốc GPU, đa ngôn ngữ và xử lý hàng loạt. Toàn bộ quá trình phiên âm chạy cục bộ — không có tệp âm thanh, video hay đường dẫn tệp nào được gửi ra ngoài.

> **Tại sao có gói này?**
> Gói `whisper-mcp` phổ biến được xây dựng cho macOS và yêu cầu môi trường Unix. Gói đó không hoạt động trên Windows. Gói này được viết dành riêng cho người dùng Windows muốn phiên âm AI cục bộ tích hợp với Claude Desktop.

---

## Bạn có thể làm gì

Sau khi cài đặt, bạn có thể nói trực tiếp trong Claude Desktop:

- *"Phiên âm C:\Users\Me\Downloads\meeting.mp3"*
- *"Phiên âm tất cả bản ghi trong thư mục này và lưu mỗi file thành văn bản"*
- *"Tạo phụ đề tiếng Việt và tiếng Anh cho video này"*
- *"Bắt đầu phiên âm hàng loạt tất cả file trong thư mục này"*
- *"Phiên âm những file này sẽ mất bao lâu?"*
- *"Kiểm tra xem tăng tốc GPU có đang hoạt động không"*

---

## Yêu cầu

1. **Node.js 18 trở lên** — [nodejs.org](https://nodejs.org)
2. **Tệp nhị phân whisper.cpp hỗ trợ Vulkan GPU** — xem Bước 1
3. **Tệp mô hình Whisper** — xem Bước 2
4. **FFmpeg** — cần thiết cho tệp video và định dạng âm thanh không phải WAV/MP3

---

## Bước 1 — Cài đặt tệp nhị phân whisper.cpp

### Tùy chọn A — Bản phát hành Vulkan đã được biên dịch sẵn (khuyến nghị)

Tải xuống `whisper-vulkan-win-x64.zip` từ [trang phát hành](https://github.com/eviscerations/whisper-windows-mcp/releases/tag/v1.4.0).

Đây là bản build tùy chỉnh với **tăng tốc Vulkan GPU** được bật. Hoạt động với GPU AMD, NVIDIA và Intel — không cần SDK riêng của từng nhà sản xuất.

Giải nén vào `C:\whisper\Release\`. Bạn sẽ có các tệp sau:

```
C:\whisper\Release\whisper-cli.exe
C:\whisper\Release\ggml-vulkan.dll
C:\whisper\Release\ggml.dll
C:\whisper\Release\ggml-base.dll
C:\whisper\Release\ggml-cpu.dll
C:\whisper\Release\whisper.dll
```

Tăng tốc GPU được kích hoạt tự động — không cần cấu hình thêm.

### Tùy chọn B — Biên dịch từ mã nguồn

Yêu cầu: Git, CMake, Visual Studio Build Tools 2022+ với "Desktop development with C++", Vulkan SDK từ [lunarg.com](https://vulkan.lunarg.com/sdk/home#windows).

```
git clone https://github.com/ggml-org/whisper.cpp
cd whisper.cpp
cmake -B build -DGGML_VULKAN=ON -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release --target whisper-cli
```

Sao chép các tệp nhị phân từ `build\bin\Release\` vào `C:\whisper\Release\`.

> **Lưu ý:** Bản phát hành Windows chính thức của whisper.cpp trên GitHub không bao gồm bản Vulkan. Bạn phải sử dụng bản phát hành đã biên dịch sẵn ở trên hoặc tự biên dịch từ mã nguồn với `-DGGML_VULKAN=ON`.

---

## Bước 2 — Tải xuống mô hình Whisper

| Mô hình | Kích thước | Tốc độ | Độ chính xác | Phù hợp nhất |
|---|---|---|---|---|
| `ggml-tiny.en.bin` | 75 MB | Rất nhanh | Cơ bản | Kiểm tra nhanh |
| `ggml-base.en.bin` | 142 MB | Nhanh | Tốt | Tiếng Anh hàng ngày |
| `ggml-small.en.bin` | 466 MB | Vừa | Tốt hơn | Bản ghi quan trọng |
| `ggml-medium.en.bin` | 1.5 GB | Nhanh trên GPU | Rất tốt | Tiếng Anh chất lượng cao nhất |
| `ggml-large-v3-turbo.bin` | 1.6 GB | Nhanh trên GPU | Xuất sắc | **Khuyến nghị cho xử lý hàng loạt GPU tiếng Anh — nhanh hơn large-v3 khoảng 6 lần với độ giảm chính xác tối thiểu** |
| `ggml-large-v3.bin` | 2.9 GB | Nhanh trên GPU | Xuất sắc | Đa ngôn ngữ, độ chính xác tối đa |
| `ggml-medium.en-q5_0.bin` | 514 MB | Nhanh | Rất tốt | **Lựa chọn tốt nhất chỉ dùng CPU tiếng Anh — độ chính xác cao với bộ nhớ thấp** |
| `ggml-large-v3-turbo-q5_0.bin` | 547 MB | Nhanh | Xuất sắc | **Lựa chọn tốt nhất chỉ dùng CPU đa ngôn ngữ** |
| `ggml-large-v3-q5_0.bin` | 1.1 GB | Vừa trên CPU | Xuất sắc | Đa ngôn ngữ, thân thiện với CPU |

Sử dụng `download_model` trong Claude Desktop để cài đặt trực tiếp. Cho **tiếng Anh**: `large-v3-turbo` (GPU) hoặc `medium.en-q5_0` (CPU) là lựa chọn tốt nhất. Cho **đa ngôn ngữ**: `large-v3-turbo` hoặc `large-v3-turbo-q5_0` (CPU). Mô hình chỉ tiếng Anh (`*.en.bin`) xuất ra `[FOREIGN]` với âm thanh không phải tiếng Anh và không thể dùng cho ngôn ngữ khác.

---

## Bước 3 — Cài đặt FFmpeg

FFmpeg cần thiết cho tệp video và định dạng âm thanh không phải gốc.

Cài đặt qua winget:
```
winget install ffmpeg
```

Hoặc tải xuống từ [ffmpeg.org](https://ffmpeg.org/download.html) và thêm vào PATH.

Xác nhận:
```
ffmpeg -version
```

---

## Bước 4 — Cài đặt máy chủ MCP

```
npm install -g whisper-windows-mcp
```

---

## Bước 5 — Cấu hình Claude Desktop

Mở Claude Desktop → Cài đặt → Nhà phát triển → Chỉnh sửa cấu hình.

Thêm mục `whisper`:

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

Vị trí tệp cấu hình: `C:\Users\TênNgườiDùng\AppData\Roaming\Claude\claude_desktop_config.json`

> Sử dụng **dấu gạch chéo ngược kép** trong tất cả đường dẫn.

Lưu và **khởi động lại hoàn toàn** Claude Desktop. Bạn sẽ thấy **whisper** được liệt kê với huy hiệu đang chạy màu xanh trong Cài đặt → Nhà phát triển.

---

## Bước 6 — Xác nhận cài đặt

Trong Claude Desktop, hỏi:

> *"Kiểm tra cấu hình whisper"*

Sau đó:

> *"Kiểm tra phần cứng hệ thống"*

Điều này xác nhận GPU của bạn được phát hiện và tăng tốc Vulkan đang hoạt động.

---

## Công cụ có sẵn

### `transcribe_audio`
Phiên âm một tệp. Hỗ trợ chế độ chặn (mặc định) hoặc nền cho tệp dài.

| Tham số | Mô tả |
|---|---|
| `file_path` | Đường dẫn tuyệt đối đến tệp (bắt buộc) |
| `language` | Mã ngôn ngữ (`vi`, `en`, `ja`, v.v.) hoặc `auto` để tự phát hiện. Mặc định: `en` |
| `output_format` | `text` (mặc định), `timestamps`, `json`, hoặc `srt` |
| `save_to_file` | Lưu bản phiên âm dưới dạng .txt bên cạnh tệp nguồn |
| `background` | Chạy như tác vụ nền — trả về ID tác vụ ngay lập tức. Dùng `check_progress` để theo dõi. Khuyến nghị cho tệp trên 10 phút. |
| `threads` | Ghi đè số luồng CPU |
| `temperature` | Nhiệt độ lấy mẫu 0.0–1.0. Mặc định 0.0 (xác định). Giá trị cao hơn giảm ảo giác trên âm thanh nhiều tạp âm. |
| `prompt` | Chuỗi ngữ cảnh trước — cải thiện độ chính xác cho từ vựng chuyên ngành hoặc tên người nói. Ví dụ: `"Tên: Keemstar, DramaAlert."` |
| `condition_on_prev_text` | Bật lại điều kiện hóa ngữ cảnh giữa các đoạn. Mặc định false. |
| `beam_size` | Độ rộng tìm kiếm chùm. Cao hơn = chính xác hơn, chậm hơn. Mặc định 5. |
| `best_of` | Số chuỗi ứng viên được đánh giá. Mặc định 5. |
| `gpu_device` | Chỉ số thiết bị GPU cho hệ thống đa GPU. Mặc định 0. |
| `processors` | Số bộ xử lý song song. Mặc định 1. |
| `word_timestamps` | Một từ mỗi đoạn có dấu thời gian. Hữu ích cho căn chỉnh clip. |
| `max_segment_length` | Độ dài đoạn tối đa tính bằng ký tự. |
| `diarize` | Phân tách người nói stereo — yêu cầu âm thanh stereo với người nói trên các kênh riêng biệt. |
| `vad_model` | Đường dẫn đến tệp .bin mô hình Silero VAD. Loại bỏ im lặng trước khi phiên âm — giảm ảo giác trên tệp nhiều tạp âm. |
| `offset_t` | Độ lệch bắt đầu tính bằng mili giây. |
| `duration` | Thời lượng xử lý tính bằng mili giây từ độ lệch. |

---

### `check_progress`
Theo dõi tác vụ phiên âm nền được bắt đầu bằng `transcribe_audio` (background=true).

Trả về thời gian đã trôi qua, dấu thời gian xử lý cuối cùng, phần trăm và bản phiên âm đầy đủ khi hoàn thành.

| Tham số | Mô tả |
|---|---|
| `job_id` | ID tác vụ được trả về bởi `transcribe_audio` |

---

### `start_batch`
Tự động phiên âm tuần tự tất cả tệp chưa phiên âm trong thư mục. Sắp xếp theo thời lượng (ngắn trước), xử lý từng tệp như tác vụ nền và xác nhận mỗi đầu ra.

| Tham số | Mô tả |
|---|---|
| `folder_path` | Đường dẫn đến thư mục (bắt buộc) |
| `language` | Mã ngôn ngữ. Mặc định: `en` |
| `threads` | Ghi đè số luồng CPU |

---

### `check_batch_progress`
Theo dõi một đợt đang chạy. Tự động chuyển sang tệp tiếp theo khi tệp hiện tại hoàn thành. Trả về tiến trình tổng thể, tệp hiện tại với dấu thời gian, ETA và các tệp thất bại.

| Tham số | Mô tả |
|---|---|
| `batch_id` | ID đợt được trả về bởi `start_batch` |

---

### `transcribe_batch` (tương tác)
Xử lý từng tệp một với xem trước và xác nhận trước mỗi tệp. Hữu ích khi bạn muốn xem xét trong quá trình thực hiện.

| Tham số | Mô tả |
|---|---|
| `folder_path` | Đường dẫn đến thư mục (bắt buộc) |
| `file_index` | Tệp cần xử lý (bắt đầu từ 1). Bỏ qua để liệt kê tệp trước. |
| `language` | Mã ngôn ngữ. Mặc định: `en` |
| `recursive` | Bao gồm các thư mục con |

---

### `generate_subtitles`
Tạo tệp phụ đề SRT. Hỗ trợ tự động phát hiện ngôn ngữ và đầu ra dịch sang tiếng Anh.

| Tham số | Mô tả |
|---|---|
| `file_path` | Đường dẫn đến tệp (bắt buộc) |
| `language` | Mã ngôn ngữ hoặc `auto` để tự phát hiện. Mặc định: `en` |
| `translate_to_english` | Cũng tạo `.en.srt` dịch sang tiếng Anh. Chỉ áp dụng khi nguồn không phải tiếng Anh. |
| `threads` | Ghi đè số luồng CPU |

Khi cả hai được yêu cầu, hai tệp được lưu bên cạnh nguồn:
- `tenfile.vi.srt` — ngôn ngữ gốc
- `tenfile.en.srt` — bản dịch tiếng Anh

> Bản dịch tích hợp của Whisper chỉ dịch **sang tiếng Anh**. Để dịch sang ngôn ngữ khác, hãy xử lý nội dung tệp .srt riêng biệt.

---

### `analyze_media`
Phân tích tệp trước khi phiên âm. Trả về thời lượng, kích thước, codec và thời gian phiên âm ước tính trên CPU và GPU. Với thư mục, hiển thị tất cả tệp trong bảng có thể sắp xếp kèm trạng thái phiên âm.

| Tham số | Mô tả |
|---|---|
| `path` | Đường dẫn đến tệp đơn hoặc thư mục (bắt buộc) |
| `sort_by` | Với thư mục: `duration` (mặc định), `name`, hoặc `size` |

---

### `check_config`
Xác nhận whisper-cli.exe, tệp mô hình và FFmpeg đều có thể truy cập. Chạy lệnh này trước nếu có bất kỳ sự cố nào.

---

### `list_models`
Liệt kê tất cả tệp mô hình Whisper đã cài đặt trong thư mục mô hình của bạn. Hiển thị tên tệp, kích thước, có đang hoạt động không, trạng thái lượng tử hóa và trường hợp sử dụng được khuyến nghị. Không gọi mạng — chỉ đọc hệ thống tệp cục bộ.

---

### `download_model`
Tải xuống mô hình Whisper trực tiếp từ Hugging Face vào thư mục mô hình của bạn. Nhận tên mô hình (ví dụ: `large-v3-turbo`, `medium.en-q5_0`) và tự động xử lý việc tải xuống. Chỉ tải xuống từ các namespace Hugging Face đáng tin cậy. Sau khi tải xuống, sử dụng `switch_model` để kích hoạt.

| Tham số | Mô tả |
|---|---|
| `model_name` | Tên mô hình cần tải xuống, ví dụ: `large-v3-turbo`, `large-v3-turbo-q5_0`, `medium.en-q5_0` |

---

### `switch_model`
Chuyển mô hình Whisper đang hoạt động cho phiên hiện tại mà không cần khởi động lại Claude Desktop. Thay đổi chỉ có hiệu lực trong phiên — không lưu sau khi khởi động lại. Để thay đổi vĩnh viễn, cập nhật `WHISPER_MODEL` trong cấu hình của bạn.

| Tham số | Mô tả |
|---|---|
| `model_name` | Tên tệp mô hình (ví dụ: `ggml-large-v3-turbo.bin`) hoặc đường dẫn đầy đủ. Phải là tệp `.bin` trong thư mục mô hình đã cấu hình. |

---

### `check_system`
Phát hiện phần cứng GPU và xác nhận tăng tốc Vulkan có sẵn. Báo cáo tên GPU, VRAM, có `ggml-vulkan.dll` không và đề xuất kích thước mô hình tốt nhất cho phần cứng của bạn.

---

## Định dạng được hỗ trợ

| Loại | Định dạng |
|---|---|
| Gốc (không cần chuyển đổi) | `mp3`, `wav` |
| Video (tự động chuyển đổi qua FFmpeg) | `mp4`, `mkv`, `avi`, `mov`, `webm`, `flv`, `wmv`, `m4v`, `ts`, `3gp` |
| Âm thanh (tự động chuyển đổi qua FFmpeg) | `m4a`, `ogg`, `flac` |

---

## Tăng tốc GPU

Bản phát hành Vulkan đã biên dịch sẵn bật tăng tốc GPU tự động. Đã thử nghiệm trên AMD Radeon RX Vega 56 (GCN thế hệ 5). Bất kỳ GPU nào hỗ trợ Vulkan 1.0+ đều sẽ hoạt động, bao gồm NVIDIA và Intel Arc.

**So sánh hiệu suất (mô hình medium.en, tệp âm thanh ~5 phút):**

| Phần cứng | Thời gian |
|---|---|
| Chỉ CPU (Ryzen 7 2700x, 8 luồng) | 8–12 phút |
| GPU (Vega 56 qua Vulkan) | 20–40 giây |

Mức sử dụng GPU trong quá trình phiên âm thường là 15–20%, giảm về trạng thái nhàn rỗi giữa các tệp. CPU duy trì khoảng 15%.

---

## Hỗ trợ đa ngôn ngữ

Whisper có thể tự động phát hiện ngôn ngữ được nói và phiên âm bằng ngôn ngữ đó. Mô hình dịch tích hợp chỉ dịch **sang tiếng Anh**.

Để có độ chính xác đa ngôn ngữ tốt nhất, hãy sử dụng mô hình `large-v3`. Mô hình chỉ tiếng Anh (`*.en.bin`) không thể phát hiện hoặc phiên âm các ngôn ngữ khác.

**Ví dụ — video nước ngoài có phụ đề:**
1. Yêu cầu Claude tạo phụ đề với `language=auto` và `translate_to_english=true`
2. Whisper phát hiện ngôn ngữ và tạo SRT ngôn ngữ gốc
3. Lần xử lý thứ hai tạo SRT dịch sang tiếng Anh
4. Tải tệp trong VLC qua Phụ đề → Thêm tệp phụ đề

---

## Thiết kế cho người dùng gói miễn phí

Công cụ này được xây dựng để giảm thiểu các tương tác với Claude API. Toàn bộ quy trình phiên âm — quét, phân tích, xếp hàng, chạy, xác nhận — được thiết kế để yêu cầu ít tương tác Claude nhất có thể. Công việc nặng được thực hiện cục bộ trên máy của bạn.

---

## Biến môi trường tùy chọn

| Biến | Mô tả |
|---|---|
| `WHISPER_CLI_PATH` | Đường dẫn đến whisper-cli.exe (bắt buộc) |
| `WHISPER_MODEL` | Đường dẫn đến tệp mô hình .bin (bắt buộc) |
| `WHISPER_THREADS` | Ghi đè số luồng CPU |
| `FFMPEG_PATH` | Đường dẫn đến ffmpeg nếu không có trong PATH hệ thống |
| `WHISPER_PRIVACY_MODE` | **Đang lên kế hoạch.** Khi đặt thành `true`, phản hồi công cụ chỉ trả về siêu dữ liệu — không có văn bản phiên âm nào được trả về cho Claude. Dành cho nội dung được quản lý hoặc bí mật. Xem [PRIVACY.md](PRIVACY.md). |

---

## Khắc phục sự cố

Xem [TROUBLESHOOTING.md](TROUBLESHOOTING.md) để biết giải pháp chi tiết. Xem [PRIVACY.md](PRIVACY.md) nếu bạn xử lý nội dung được quản lý.

Danh sách kiểm tra nhanh:
- Đường dẫn trong cấu hình dùng **dấu gạch chéo ngược kép** (`C:\\whisper\\...`)
- `whisper-cli.exe` tồn tại tại đường dẫn đã cấu hình
- Tệp mô hình `.bin` tồn tại tại đường dẫn đã cấu hình
- FFmpeg đã cài đặt và có trong PATH (`ffmpeg -version` hoạt động)
- Claude Desktop đã được **khởi động lại hoàn toàn** sau khi chỉnh sửa cấu hình
- Whisper hiển thị **đang chạy** (huy hiệu màu xanh) trong Cài đặt → Nhà phát triển

---

## Bảo mật và quyền riêng tư

whisper-windows-mcp được thiết kế với bảo mật là nguyên tắc cốt lõi.

**Âm thanh không bao giờ rời khỏi máy của bạn.** Không có tệp âm thanh hoặc video, đường dẫn tệp, hay dữ liệu đo lường nào được truyền đến bất kỳ máy chủ nào. Không cần API đám mây cho chức năng cốt lõi.

**Văn bản phiên âm và ranh giới API.** Khi phản hồi công cụ bao gồm văn bản phiên âm, văn bản đó được xử lý bởi API của Claude — nó rời khỏi máy cục bộ của bạn. Đối với hầu hết người dùng (nội dung công khai, podcast, bản ghi phát trực tuyến) đây là hành vi bình thường. Nếu bạn xử lý bản ghi y tế, pháp lý, tài chính hoặc được quản lý khác, hãy xem [PRIVACY.md](PRIVACY.md) để biết hướng dẫn tuân thủ và các tùy chọn cấu hình.

Biến môi trường `WHISPER_PRIVACY_MODE` đang được lên kế hoạch, sẽ giới hạn tất cả phản hồi công cụ chỉ có siêu dữ liệu (tên tệp, thời lượng, số từ) — không có văn bản phiên âm nào được trả về cho Claude. Đây là cấu hình chính xác cho nội dung được quản lý hoặc bí mật.

**Xác thực đầu vào.** Tất cả đường dẫn tệp được xác thực trước khi sử dụng — đường dẫn UNC (`\\server\share`) và chuỗi duyệt thư mục (`..`) bị từ chối. Tệp trên 10 GB bị từ chối để ngăn cạn kiệt tài nguyên.

**Nhận thức về tiêm nhiễm phiên âm.** Tệp âm thanh có thể chứa nội dung khi phiên âm trông giống như hướng dẫn. Các biện pháp phòng thủ tích hợp của Claude xử lý điều này, nhưng biết rằng nội dung phiên âm được coi là dữ liệu — không bao giờ là hướng dẫn — bởi chính máy chủ MCP cũng rất hữu ích.

**Tải xuống mô hình bị hạn chế.** Công cụ `download_model` chỉ tải xuống từ hai namespace Hugging Face đáng tin cậy (`ggerganov/whisper.cpp` và `ggml-org`). URL tùy ý bị từ chối. Chuyển hướng được xác thực dựa trên danh sách cho phép trước khi tuân theo.

**Chuyển đổi mô hình được sandbox hóa.** `switch_model` chỉ chấp nhận tệp `.bin` trong thư mục mô hình đã cấu hình. Đường dẫn ngoài thư mục đó bị từ chối.

**Không có phụ thuộc mạng mới.** Tải xuống mô hình sử dụng `https` tích hợp sẵn của Node.js — không có thư viện HTTP bên ngoài nào được thêm vào gói.

---

## Giấy phép

**Sử dụng phi thương mại:** MIT — miễn phí cho mục đích cá nhân, giáo dục và phi thương mại. Xem [LICENSE](LICENSE).

**Sử dụng thương mại:** Cần có thỏa thuận giấy phép thương mại riêng cho bất kỳ mục đích kinh doanh, chuyên nghiệp hoặc tạo doanh thu nào. Xem [LICENSE-COMMERCIAL.md](LICENSE-COMMERCIAL.md) để biết điều khoản và thông tin liên hệ.

## Đóng góp

Chào mừng pull request. Xem [ROADMAP.md](ROADMAP.md) để biết các tính năng đã lên kế hoạch.

Nếu bạn đã thử nghiệm tăng tốc GPU trên phần cứng không được liệt kê ở trên, vui lòng mở issue với kết quả của bạn — mô hình GPU, VRAM, kích thước mô hình và thông lượng quan sát được.
