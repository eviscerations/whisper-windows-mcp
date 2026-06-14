# whisper-windows-mcp — Lộ trình phát triển

Phiên bản hiện tại: **v2.4.0**

---

## Nguyên tắc thiết kế

Các nguyên tắc này chi phối mọi quyết định trong dự án và được ưu tiên hơn tốc độ thêm tính năng.

**Giảm thiểu sử dụng Claude API.** Toàn bộ quy trình phiên âm — quét, phân tích, xếp hàng, chạy, xác nhận, chuyển đổi mô hình — phải thực hiện được với ít tương tác Claude nhất có thể. Công cụ này phải hoạt động đầy đủ cho người dùng Claude gói miễn phí không trả phí Pro hoặc Max. Mỗi lệnh gọi công cụ tốn ngân sách sử dụng. Thiết kế theo nguyên tắc này.

**Luôn chỉ một phiên bản whisper.** Không bao giờ tạo ra tiến trình whisper-cli.exe thứ hai khi đang có một tiến trình chạy. Khóa tiến trình là bắt buộc và không có ngoại lệ.

**Ưu tiên cục bộ, mặc định là riêng tư.** Âm thanh không bao giờ rời khỏi máy. Không cần API đám mây cho chức năng cốt lõi. Các tích hợp tùy chọn (ví dụ: tải mô hình từ Hugging Face) phải được ghi lại rõ ràng là tùy chọn.

**Kiểm soát người dùng rõ ràng.** Không có thao tác hàng loạt im lặng. Các hành động phá hủy hoặc không thể hoàn tác cần xác nhận. Người dùng phải luôn biết điều gì sắp xảy ra trước khi nó xảy ra.

**Đường dẫn an toàn Unicode.** Tất cả I/O tệp phải xử lý đúng tên tệp không phải ASCII, bao gồm tiếng Việt, tiếng Nhật, tiếng Trung, emoji, dấu ngoặc và các ký tự đặc biệt khác.

**Mô-đun và có thể kết hợp.** Các công cụ độc lập. Người dùng dùng những gì họ cần. Không có tính năng nào phải yêu cầu tính năng khác trừ khi không thể tránh khỏi.

**Tối ưu hóa trước tính năng.** Khi nghi ngờ giữa thêm tính năng và giảm tải hệ thống hoặc số lượng lệnh gọi API, hãy giảm tải. Các đợt tối ưu hóa lớn rất tốn kém. Thiết kế kiến trúc đúng ngay từ đầu.

---

## Đã hoàn thành

### ✅ v1.3.1 — Khóa tiến trình
Thêm kiểm tra `isWhisperRunning()` dùng `tasklist /FI` trước khi tạo bất kỳ tiến trình phiên âm nào. Trả về lỗi rõ ràng với hướng dẫn Task Manager thay vì tạo tiến trình cạnh tranh.

### ✅ v1.4.0 — Tăng tốc GPU Vulkan
Biên dịch whisper.cpp từ nguồn với `-DGGML_VULKAN=ON` dùng VS Build Tools 2022 và Vulkan SDK. Phân phối tệp nhị phân Vulkan đã biên dịch sẵn dưới dạng `whisper-vulkan-win-x64.zip`.

**Kết quả trên AMD Radeon RX Vega 56:** Mức sử dụng GPU trung bình ~16%. Tệp 58 phút hoàn thành trong ~4.5 phút trên GPU so với ~88 phút chỉ dùng CPU.

### ✅ v1.5.0 — Chẩn đoán hệ thống
Công cụ `check_system`: Phát hiện GPU qua `wmic`, xác nhận Vulkan DLL, báo cáo VRAM, đề xuất kích thước mô hình.

### ✅ v1.6.0 — Phân tích tệp trước
Công cụ `analyze_media` qua FFprobe: thời lượng, kích thước, codec, trạng thái phiên âm, ước tính thời gian CPU và GPU. Quét tệp đơn hoặc thư mục với tùy chọn sắp xếp.

### ✅ v1.7.0 — Phiên âm nền + Theo dõi tiến trình
Kiến trúc tiến trình tách rời: `transcribe_audio` với `background=true` tạo whisper như tiến trình tách rời và trả về ID tác vụ ngay lập tức. `check_progress` phân tích dấu thời gian đoạn stderr của whisper để tính phần trăm và ETA theo thời gian thực.

### ✅ v1.8.0 — Xử lý hàng loạt tuần tự có xác nhận
`start_batch` và `check_batch_progress`: xử lý tuần tự tự động, xác nhận phiên âm (phát hiện đầu ra trống/ngắn), tự động tiến queue, dấu thời gian tiến trình theo từng tệp.

### ✅ v1.9.0 — Hỗ trợ đa ngôn ngữ và dịch thuật
`generate_subtitles` với phát hiện `language=auto` và đầu ra SRT kép `translate_to_english=true`. Thêm hỗ trợ định dạng `.3gp` và `.ts`. `language=auto` cũng có trong `transcribe_audio`.

**Giới hạn đã biết:** Bản dịch tích hợp của Whisper chỉ nhắm đến tiếng Anh. Cần mô hình `large-v3` cho các ngôn ngữ không phải tiếng Anh — mô hình chỉ tiếng Anh (`*.en.bin`) xuất ra `[FOREIGN]` với âm thanh không phải tiếng Anh.

### ✅ v2.0.0 — Đường dẫn an toàn Unicode + SRT nền
**Tên tệp Unicode:** Tệp có ký tự không phải ASCII trong tên tệp gây ra phiên âm nền thất bại lặng lẽ. Đã sửa bằng cách định tuyến tất cả đầu ra qua đường dẫn tạm thời đã làm sạch dựa trên ID tác vụ, sau đó di chuyển kết quả đến đích chính xác sau khi hoàn thành.

**SRT trong chế độ nền:** `spawnDetached` trước đây mã cứng `-otxt` bất kể định dạng được yêu cầu. Đã sửa bằng cách thêm tham số `outputFormat` vào `spawnDetached`, hỗ trợ đầu ra `text` và `srt` trong chế độ nền.

### ✅ v2.0.1 — Sửa lỗi (đã gộp vào v2.2.0)
- Mã cứng `--max-context 0` trong cả `buildArgs` và `spawnDetached` — ngăn vòng lặp ảo giác trên âm thanh dài.
- Mã cứng `--no-speech-thold 0.6` trong cả hai hàm — xử lý các đoạn dưới ngưỡng tin cậy là im lặng thay vì nội dung ảo giác.
- Xác thực đường dẫn (`validateInputPath`) — từ chối đường dẫn UNC và duyệt `..`.
- Bảo vệ kích thước tệp `MAX_FILE_SIZE_MB = 10240`.
- Chú thích bảo mật tiêm nhiễm phiên âm trong `transcribeSingle`.
- Sửa lệnh CLI batch bị hỏng trong TROUBLESHOOTING.md.

### ✅ v2.1.0 — Bộ quản lý mô hình (đã gộp vào v2.2.0)
- Thay đổi `WHISPER_MODEL` từ `const` sang `let` (có thể thay đổi trong phiên).
- `MODEL_REGISTRY` — 16 mô hình, biến thể độ chính xác đầy đủ và lượng tử hóa, URL tải xuống Hugging Face.
- `ALLOWED_HF_PREFIXES` — danh sách URL cho phép giới hạn tải xuống vào namespace `ggerganov/whisper.cpp` và `ggml-org`.
- Công cụ `list_models` — quét thư mục mô hình, hiển thị mô hình đang hoạt động, kích thước, trường hợp sử dụng, các tải xuống có sẵn.
- Công cụ `download_model` — tải xuống từ Hugging Face qua `https` tích hợp sẵn của Node.js, đổi tên nguyên tử.
- Công cụ `switch_model` — xác thực phần mở rộng `.bin`, ràng buộc thư mục, kiểm tra khóa tiến trình.
- Cập nhật `recommendedModel()` để đề xuất `large-v3-turbo` cho VRAM 6GB+.

### ✅ v2.2.0 — Mở rộng chất lượng, tham số và phần cứng
- Interface `WhisperOptions` thay thế đối số vị trí trong `buildArgs`.
- Tham số mới trong `transcribe_audio`: `temperature`, `prompt`, `condition_on_prev_text`, `no_speech_thold`, `beam_size`, `best_of`, `gpu_device`, `processors`, `word_timestamps`, `max_segment_length`, `split_on_word`, `diarize`, `vad_model`, `offset_t`, `duration`.
- Tham số mới trong `generate_subtitles`: `temperature`, `prompt`, `beam_size`, `best_of`, `diarize`, `vad_model`.
- Tái cấu trúc `spawnDetached` — tất cả flag chất lượng giờ được áp dụng trong chế độ nền/đợt.
- Sửa đầu ra đợt — `readBatchProgress` giờ di chuyển đầu ra tạm thời đến đích cuối cùng trước khi xác nhận.

**Lưu ý tương thích flag:** `gpu_device` / `--device` được thêm trong whisper.cpp v1.8.4. Tệp nhị phân Vulkan đã biên dịch sẵn trong các bản phát hành là thế hệ v1.8.3 — tham số này được công cụ chấp nhận nhưng sẽ không có hiệu lực cho đến khi người dùng cập nhật lên tệp nhị phân v1.8.4+.

### ✅ v2.2.2 — Bản vá
- Sửa cấp phép kép — chỉnh sửa LICENSE và LICENSE-COMMERCIAL.md.
- Sửa lỗi tài liệu nhỏ.

### ✅ v2.3.0 — Tự động tiến đợt, kiến trúc quyền riêng tư, mở rộng định dạng đầu ra

**Tự động tiến đợt (sửa lỗi nghiêm trọng):** `start_batch` trước đây yêu cầu polling tích cực để tiến queue. Giờ mỗi tiến trình con whisper-cli được tạo ra đều có handler `on('exit')` được gắn vào. Khi tiến trình thoát, đợt ngay lập tức tự động tiến qua exit callback — không tốn chi phí polling và API. Mutex ngăn tạo kép giữa exit handler + lệnh gọi `check_batch_progress` đồng thời.

**Kiến trúc quyền riêng tư:**
- Biến môi trường `WHISPER_PRIVACY_MODE` — khi đặt thành `true`, tất cả phản hồi công cụ chỉ trả về siêu dữ liệu (tên tệp, số từ, đường dẫn lưu). Không có văn bản phiên âm nào được gửi đến API của Claude. Bản phiên âm chỉ tồn tại dưới dạng tệp cục bộ.
- Biến môi trường `WHISPER_CONSENT_ACKNOWLEDGED` — khi đặt thành `true`, bỏ qua cổng đồng ý phiên một lần cho nội dung không nhạy cảm.
- Tham số `privacy_mode` theo từng lệnh gọi trong `transcribe_audio`, `transcribe_batch`, `start_batch`, `check_progress`. Ghi đè biến môi trường toàn cục theo cả hai hướng. Không cần khởi động lại để bật/tắt.
- Cổng chế độ quyền riêng tư (`checkPrivacyGate()`) — chạy trước mỗi thao tác khi chế độ quyền riêng tư hiệu quả đang hoạt động. Kích hoạt lần đầu gọi (hiển thị công khai), giải phóng lần gọi thứ hai (cho phép). Đặt lại sau mỗi thao tác. Hoàn toàn độc lập với cổng đồng ý phiên.
- Cổng đồng ý phiên (`transcriptPolicy()`) — chạy một lần mỗi phiên trước lệnh gọi trả về phiên âm đầu tiên ở chế độ tiêu chuẩn. Tiêu thụ bằng flag `sessionConsentGiven`.
- `PRIVACY.md` — tài liệu tuân thủ đầy đủ bao gồm HIPAA, GDPR, đặc quyền luật sư-khách hàng, FERPA, SOX, PCI-DSS, NDA/bí mật thương mại.
- Cảnh báo quyền riêng tư trong mô tả công cụ của tất cả công cụ trả về văn bản phiên âm.

**Mở rộng định dạng đầu ra:**
- `vtt` — đầu ra phụ đề WebVTT qua `-ovtt`. Có sẵn trong `transcribe_audio`, `generate_subtitles`, `start_batch` và chế độ nền.
- `lrc` — định dạng lời bài hát/karaoke LRC qua `-olrc`. Có sẵn trong `transcribe_audio` và chế độ nền.
- `csv` — CSV có dấu thời gian qua `-ocsv`. Có sẵn trong `transcribe_audio` và chế độ nền.
- Giá trị mặc định `output_format` thay đổi từ `"text"` sang `"timestamps"` trên tất cả công cụ và đường dẫn mã. Văn bản thuần túy giờ là tùy chọn.

**Sửa lỗi:**
- Lỗi 1: `output_format` không được truyền đến tác vụ nền — mặc định `"text"` được dùng bất kể định dạng được yêu cầu. Đã sửa bằng cách thay đổi mặc định thành `"timestamps"` và truyền đúng cách.
- Lỗi 2: `catch {}` im lặng trên thao tác di chuyển đầu ra tác vụ nền nuốt lỗi thất bại. Thêm kiểm tra `existsSync` rõ ràng sau khi di chuyển với thông báo thất bại chi tiết.
- Lỗi 3: Thêm chú thích thiết kế tại điểm tạo nền giải thích tại sao cổng đồng ý được trì hoãn có chủ ý đến `check_progress` cho tác vụ nền không riêng tư.

**Bổ sung:**
- Tự động dọn dẹp thư mục tạm thời — `cleanupOldJobFiles()` chạy khi khởi động xóa tệp `.json` và `.log` cũ hơn 7 ngày trong `%TEMP%\whisper-mcp-jobs\`.
- `check_config` giờ báo cáo trạng thái chế độ quyền riêng tư.
- Báo cáo bật/tắt chế độ quyền riêng tư trong nhật ký khởi động.
- Trường `privacyMode: boolean` được thêm vào interface `Job`.
- Trường `privacyMode: boolean` được thêm vào interface `BatchState`.
- Kiểu `BackgroundFormat` loại trừ `json` (json trong chế độ nền không được hỗ trợ — dự phòng về `text`).

### ✅ v2.4.0 — Tăng cường, bộ bảo vệ thời gian chờ tiền cảnh, bộ kiểm thử & CI

Một lượt rà soát bảo mật/độ bền; việc chuyển đổi Bun đã lên kế hoạch được dời sang v2.5.0.

**Bảo mật & tính đúng đắn:**
- Sửa lỗi giới hạn đường dẫn của `switch_model` — một thư mục có tiền tố-anh em (ví dụ `…\models-evil`) trước đây có thể thỏa mãn kiểm tra "bên trong thư mục mô hình" thông qua `startsWith` ngây thơ; được thay bằng giới hạn chuẩn hóa dựa trên `relative()`. Đóng lỗ hổng thoát mà SECURITY.md mô tả.
- Cổng quyền riêng tư/đồng ý được khóa **theo từng thao tác** (công cụ + đối số) — việc xác nhận một phiên âm không còn có thể thỏa mãn cổng của một thao tác khác.
- `download_model` từ chối các lượt tải bị cắt cụt (kiểm tra Content-Length) trước khi thăng cấp tệp `.part`. (Việc xác minh đầy đủ digest SHA256 được theo dõi cho một lượt sau.)
- Ép kiểu đầu vào — các tham số công cụ dạng số nhưng không phải số thực sự sẽ bị loại bỏ thay vì được chuyển cho whisper-cli dưới dạng `NaN`.

**Độ bền:**
- **Bộ bảo vệ thời gian chờ tiền cảnh** — một tệp đủ dài để vượt quá thời gian chờ công cụ MCP ~4 phút của Claude Desktop ở chế độ chặn được phát hiện trước và được định tuyến sang nền thay vì âm thầm hết thời gian chờ. Ngưỡng có thể cấu hình qua `WHISPER_FOREGROUND_MAX_SEC`. Ước tính thời gian đã được sửa (ước tính GPU cũ dự đoán thiếu nghiêm trọng; chi phí tải lại mô hình chiếm ưu thế nay đã được mô hình hóa — đo lường, không phải phỏng đoán).
- Ghi trạng thái công việc/đợt theo kiểu nguyên tử (tệp tạm + đổi tên) để một trình đọc đồng thời không thể quan sát thấy tệp JSON bị rách.
- ID công việc/đợt/tạm chống xung đột (có hậu tố UUID).
- Tắt nhẹ nhàng khi nhận SIGINT/SIGTERM, dọn dẹp các tệp tạm của chế độ chặn.

**Lựa chọn thiết bị GPU:**
- Biến môi trường `WHISPER_GPU_DEVICE`, và `gpu_device` nay được truyền qua `generate_subtitles` và lượt phát hiện ngôn ngữ (trước đây chỉ `transcribe_audio`). `check_config` báo cáo thiết bị đang hoạt động. `check_system` không còn báo cáo sai sự cố trình điều khiển khi `wmic` (đã ngừng dùng trên Windows 11 24H2+) không trả về gì.

**Chất lượng:**
- Một bộ kiểm thử đơn vị `node:test` trên phần logic thuần túy (giới hạn đường dẫn, khóa cổng, ghi nguyên tử, ép kiểu đầu vào, ước tính thời gian chờ), không thêm phụ thuộc, cùng với quy trình CI GitHub Actions chạy nó trên mỗi push/PR.

**Đã xác định cho bản phát hành tương lai:** một đường dẫn mô hình bền vững (ví dụ `whisper-server` của whisper.cpp) để loại bỏ chi phí tải lại mô hình phải trả ở mỗi lần phiên âm — một mức tăng thông lượng lớn cho công việc theo đợt/lưu trữ.

---

## Đã lên kế hoạch — v2.5.0: Chuyển đổi Bun

Chuyển đổi runtime từ Node.js sang [Bun](https://bun.sh).

Claude Desktop tạo máy chủ MCP mới vào mỗi lần khởi động phiên, vì vậy thời gian khởi động nằm trên đường dẫn quan trọng. Bun chạy TypeScript gốc mà không cần bước biên dịch, khởi động nhanh hơn đáng kể so với Node và I/O cũng nhanh hơn.

**Những gì thay đổi:**
- Bước biên dịch `tsc` và thư mục `dist/` bị xóa
- Người dùng chạy mã nguồn TypeScript trực tiếp
- `tsconfig.json` trở thành tùy chọn
- Cập nhật script `package.json`
- Cập nhật quy trình phát hành npm

**Những gì không thay đổi:**
- Mã nguồn `src/index.ts` — Bun tương thích với TypeScript hiện tại và các API tích hợp sẵn của Node.js
- Tất cả hành vi công cụ và định dạng đầu ra
- Cấu hình Claude Desktop cho người dùng cuối

---

## Đã lên kế hoạch — v2.6.0: Định dạng đầu ra nâng cao cho tích hợp công cụ bên ngoài

Hỗ trợ định dạng đầu ra mở rộng nhắm đến quy trình phân tích và tích hợp downstream. Phạm vi chính xác sẽ được xác định dựa trên phản hồi của người dùng sau v2.3.0.

---

## Đã lên kế hoạch — v2.7.0: Chế độ phiên âm microphone trực tiếp

Phiên âm theo thời gian thực từ đầu vào microphone trực tiếp. Phát trực tuyến âm thanh theo từng đoạn từ thiết bị ghi âm được chọn đến whisper, trả về các đoạn phiên âm đã hoàn thành theo cách cuộn.

**Ràng buộc thiết kế:**
- Lựa chọn thiết bị phải rõ ràng — không tự động thu microphone mặc định im lặng
- Người dùng phải có thể dừng luồng qua tương tác Claude Desktop
- Không được vi phạm ràng buộc một phiên bản whisper tại một thời điểm
- Đánh đổi giữa độ trễ và độ chính xác phải có thể cấu hình bởi người dùng

**Trạng thái:** Giai đoạn thiết kế. Phụ thuộc vào API phát trực tuyến ổn định của whisper.cpp.

---

## Đã lên kế hoạch — Các bản phát hành tương lai

### TinyDiarize
Hỗ trợ flag `--tinydiarize` với các biến thể mô hình hỗ trợ `tdrz` (ví dụ: `large-v2-tdrz`). Không giống flag `--diarize` stereo, TinyDiarize hoạt động trên bản ghi mono. Cần tải xuống biến thể mô hình đặc biệt. Độ chính xác thấp hơn diarization dựa trên pyannote nhưng không có phụ thuộc bổ sung ngoài tệp mô hình.

**Trạng thái:** Đã lên kế hoạch. Phụ thuộc vào `download_model` hỗ trợ các biến thể mô hình tdrz.

### Phiên âm URL YouTube
Phiên âm trực tiếp từ URL YouTube qua yt-dlp. Tải xuống âm thanh và phiên âm trong một bước. Yêu cầu yt-dlp đã cài đặt và có trong PATH.

**Ràng buộc thiết kế:** yt-dlp là tùy chọn. Công cụ phải hạ cấp nhẹ nhàng với hướng dẫn cài đặt rõ ràng nếu không tìm thấy. Không thay đổi chức năng cốt lõi cho người dùng không cần nó.

### Công cụ quy trình dự án video
Cho người dùng quản lý các dự án chỉnh sửa video lớn với thư mục clip nguồn và đã chỉnh sửa:

1. Quét thư mục nguồn và thư mục con clip
2. Khớp mờ bản phiên âm clip đã chỉnh sửa với bản phiên âm nguồn để xác định điểm gốc
3. Hiển thị tên tệp mô tả được Claude đề xuất dựa trên nội dung phiên âm, yêu cầu xác nhận rõ ràng của người dùng trước khi thực hiện bất kỳ đổi tên nào
4. Tìm kiếm phiên âm trong thư mục dự án với kết quả timecode

**Ràng buộc thiết kế:**
- Tệp nguồn **không bao giờ bị đổi tên hoặc sửa đổi**
- Tất cả đổi tên cần **xác nhận rõ ràng của người dùng**
- Tìm kiếm là công cụ độc lập, có thể dùng độc lập
- Phân tích và khớp xảy ra cục bộ — Claude chỉ được gọi khi người dùng xem xét kết quả, giảm thiểu lệnh gọi API

**Trạng thái:** Giai đoạn thiết kế.

### Phân tách người nói (pyannote-audio)
Phân tách người nói mono đầy đủ với nhãn ID người nói — đánh dấu chuyển đổi người nói trong toàn bộ bản ghi bất kể cấu hình kênh. Khác với flag `--diarize` stereo tích hợp (v2.2.0) và TinyDiarize.

**Triển khai:** Cần [pyannote-audio](https://github.com/pyannote/pyannote-audio) — thư viện dựa trên Python với yêu cầu token truy cập mô hình Hugging Face. Stack phụ thuộc hoàn toàn riêng biệt.

**Trạng thái:** Tính năng nâng cao tùy chọn với tài liệu cài đặt riêng. Không bao gồm trong gói chính.

### Dịch sang ngôn ngữ không phải tiếng Anh
Flag `--translate` của Whisper chỉ nhắm đến tiếng Anh. Hỗ trợ ngôn ngữ đích tùy ý cần API dịch bên ngoài hoặc mô hình dịch cục bộ.

**Các tùy chọn đang xem xét:** LibreTranslate (có thể tự host, ưu tiên cục bộ), dịch LLM cục bộ hoặc tài liệu rõ ràng nằm ngoài phạm vi.

**Trạng thái:** Hoãn lại chờ quyết định thiết kế về cục bộ ưu tiên vs phụ thuộc API.

### Dọn dẹp và định dạng bản phiên âm
Pipeline hậu xử lý:
- Loại bỏ từ đệm và nói vấp (tùy chọn, người dùng kiểm soát)
- Ngắt đoạn tại ranh giới chủ đề tự nhiên
- Định dạng theo người nói kết hợp với đầu ra phân tách người nói
- Xuất sang PDF hoặc DOCX

**Trạng thái:** Đã lên kế hoạch. Biến thể theo người nói phụ thuộc vào phân tách người nói.

---

## Giấy phép

whisper-windows-mcp được cấp phép kép.

**Sử dụng phi thương mại:** MIT — miễn phí cho mục đích cá nhân, giáo dục và phi thương mại. Xem [LICENSE](LICENSE).

**Sử dụng thương mại:** Cần có thỏa thuận giấy phép thương mại riêng cho bất kỳ mục đích kinh doanh, chuyên nghiệp hoặc tạo doanh thu nào. Xem [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md).

---

## Phân phối

Có sẵn trên [npm](https://www.npmjs.com/package/whisper-windows-mcp), [mcpservers.org](https://mcpservers.org), [Glama](https://glama.ai) và [awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers) (PR đã gửi).

---

## Tài liệu đa ngôn ngữ

Sau mỗi bản phát hành, các tệp sau phải được cập nhật để khớp với tài liệu tiếng Anh:

**Tiếng Nhật (`*.ja.md`)** — `README.ja.md` / `TROUBLESHOOTING.ja.md` / `ROADMAP.ja.md` / `PRIVACY.ja.md` / `SECURITY.ja.md`

**Tiếng Hàn (`*.ko.md`)** — `README.ko.md` / `TROUBLESHOOTING.ko.md` / `ROADMAP.ko.md` / `PRIVACY.ko.md` / `SECURITY.ko.md`

**Tiếng Việt (`*.vi.md`)** — `README.vi.md` / `TROUBLESHOOTING.vi.md` / `ROADMAP.vi.md` / `PRIVACY.vi.md` / `SECURITY.vi.md`

**Tiếng Indonesia (`*.id.md`)** — `README.id.md` / `TROUBLESHOOTING.id.md` / `ROADMAP.id.md` / `PRIVACY.id.md` / `SECURITY.id.md`

**Tiếng Ukraina (`*.uk.md`)** — `README.uk.md` / `TROUBLESHOOTING.uk.md` / `ROADMAP.uk.md` / `PRIVACY.uk.md` / `SECURITY.uk.md`

**Tiếng Bồ Đào Nha Brazil (`*.pt-BR.md`)** — `README.pt-BR.md` / `TROUBLESHOOTING.pt-BR.md` / `ROADMAP.pt-BR.md` / `PRIVACY.pt-BR.md` / `SECURITY.pt-BR.md`

**Tiếng Tây Ban Nha (`*.es.md`)** — `README.es.md` / `TROUBLESHOOTING.es.md` / `ROADMAP.es.md` / `PRIVACY.es.md` / `SECURITY.es.md`

**Tiếng Ba Lan (`*.pl.md`)** — `README.pl.md` / `TROUBLESHOOTING.pl.md` / `ROADMAP.pl.md` / `PRIVACY.pl.md` / `SECURITY.pl.md`

**Tiếng Romania (`*.ro.md`)** — `README.ro.md` / `TROUBLESHOOTING.ro.md` / `ROADMAP.ro.md` / `PRIVACY.ro.md` / `SECURITY.ro.md`

Chào mừng đóng góp cộng đồng cho các ngôn ngữ khác.

---

## Đóng góp

Chào mừng pull request. Kiểm tra các issue hiện có trước khi bắt đầu làm việc.

Nếu bạn đã thử nghiệm tăng tốc GPU trên phần cứng không được liệt kê ở trên, vui lòng mở issue với mô hình GPU, VRAM, kích thước mô hình và thông lượng quan sát được. Điều này giúp xây dựng tài liệu tham khảo hiệu suất chính xác cho người dùng khác.
