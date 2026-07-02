# whisper-windows-mcp — Lộ trình phát triển

Phiên bản hiện tại: **v2.5.0**

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

## Đã lên kế hoạch — v2.5.0: Máy chủ mô hình bền vững

Giữ mô hình Whisper thường trú giữa các lần phiên âm thay vì tải lại nó ở mỗi lần gọi.

Đây là mức tăng thông lượng lớn nhất hiện có. whisper-cli là một lần: nó tải lại toàn bộ mô hình ở mỗi lệnh gọi, và v2.4.0 đã đo lần tải lại đó ở mức ~110 giây trên một GPU bị giới hạn bộ nhớ — một khoản thuế cố định phải trả cho mỗi tệp, độc lập với độ dài âm thanh. Đối với công việc theo đợt và lưu trữ, nó chi phối thời gian thực tế nhiều hơn cả bản thân việc phiên âm.

**Cách tiếp cận:** chạy `whisper-server` (HTTP) đi kèm của whisper.cpp như một tiến trình sống lâu duy nhất với mô hình được giữ trong bộ nhớ. Máy chủ MCP gửi mỗi lần phiên âm đến nó qua localhost và nhận kết quả về mà không phải trả chi phí tải lại lần nữa.

**Điều hòa với "luôn một phiên bản whisper":** nguyên tắc được giữ nguyên, cơ chế tiến hóa. Máy chủ thường trú *trở thành* phiên bản duy nhất; khóa tiến trình thay đổi từ "không bao giờ tạo whisper-cli thứ hai" thành "tuần tự hóa các yêu cầu với một máy chủ thường trú duy nhất". Không có tính đồng thời nào được đưa vào.

**Ràng buộc thiết kế:**
- Vòng đời rõ ràng: start / stop / status, với kiểm tra sức khỏe. Máy chủ không bao giờ được khởi động âm thầm như một tác dụng phụ của một lệnh gọi không liên quan.
- Chỉ ràng buộc vào localhost — không bao giờ là một giao diện có thể định tuyến. Không để lộ ra mạng (nhất quán với nguyên tắc ưu tiên cục bộ và việc tăng cường của v2.4.0).
- Dự phòng nhẹ nhàng: nếu máy chủ không chạy, việc phiên âm vẫn hoạt động qua đường dẫn whisper-cli một lần hiện có. Máy chủ là một tối ưu hóa, không phải một phụ thuộc bắt buộc.
- `switch_model` tải lại mô hình trong máy chủ thường trú (vẫn rẻ hơn nhiều khi phân bổ so với tải lại theo từng tệp).
- Các cổng quyền riêng tư và đồng ý không thay đổi — chúng nằm trên cơ chế phiên âm.
- Lựa chọn cổng có xử lý xung đột; tắt sạch khi nhận SIGINT/SIGTERM cùng với việc dọn dẹp tệp tạm hiện có.

**Trạng thái — Giai đoạn 1 ✅ đã triển khai (chờ phát hành):** công cụ `whisper_server` (`start` / `stop` / `status`); `transcribe_audio` và `transcribe_batch` dạng chặn định tuyến qua máy chủ thường trú trên localhost (`127.0.0.1`, đã xác minh với HTTP API `whisper-server` hiện tại của whisper.cpp); `switch_model` hoán đổi nóng mô hình thường trú qua `POST /load` mà không cần khởi động lại; bộ bảo vệ thời gian chờ tiền cảnh được bỏ qua ở chế độ máy chủ (không có việc tải lại phải trả); `check_config` báo cáo trạng thái máy chủ; máy chủ do nó sở hữu bị kill khi tắt để giải phóng VRAM. Quy tắc một-công-cụ / VRAM-dùng-chung được thực thi bằng một biện pháp chặn cứng trong đường dẫn tạo tiến trình tách rời cộng với các từ chối thân thiện: khi máy chủ đang hoạt động, tác vụ nền, `start_batch`, `generate_subtitles`, đầu ra `lrc`/`csv`, và các tùy chọn theo từng yêu cầu mà HTTP API không hỗ trợ (`beam_size`, `best_of`, `word_timestamps`, `diarize`, `tinydiarize`, `vad_model`, `offset_t`, `duration`, v.v.) bị từ chối với thông báo "hãy dừng máy chủ trước" thay vì âm thầm giảm cấp. Cấu hình: `WHISPER_SERVER_PATH`, `WHISPER_SERVER_PORT` (mặc định 8571, chỉ localhost).

**Trạng thái — Giai đoạn 2 (đã lên kế hoạch):** định tuyến tác vụ nền/`start_batch` qua máy chủ thường trú. Đây là mức tăng thông lượng/lưu trữ lớn hơn và cần lớp tác vụ/hàng đợi được làm lại xoay quanh các yêu cầu HTTP thay vì PID tách rời (tiến trình không có PID, hủy bỏ). Đánh giá lại sau khi Giai đoạn 1 hoàn tất.

---

## Đã lên kế hoạch — v2.6.0: TinyDiarize (lượt nói mono, không phụ thuộc bổ sung)

Hỗ trợ `--tinydiarize` với các biến thể mô hình hỗ trợ `tdrz` (ví dụ: `ggml-small.en-tdrz.bin`). Không giống flag `--diarize` stereo (v2.2.0), TinyDiarize đánh dấu các lượt nói trên bản ghi **mono**, và không cần gì ngoài tệp mô hình — không Python, không dịch vụ bên ngoài.

**Phạm vi:**
- Thêm (các) biến thể mô hình `tdrz` vào `MODEL_REGISTRY` để `download_model` có thể lấy chúng từ các namespace Hugging Face đáng tin cậy hiện có.
- Nối một tùy chọn `tinydiarize` qua `buildArgs` và `spawnDetached` để nó hoạt động ở chế độ chặn, nền và đợt.

**Trạng thái:** ✅ Đã triển khai (chờ phát hành) — tham số `tinydiarize` trên `transcribe_audio` và `generate_subtitles` (hoạt động ở chế độ chặn và nền), `--tinydiarize` được luồn qua cả hai bộ dựng đối số, và `small.en-tdrz` được thêm vào `MODEL_REGISTRY` cho `download_model`. Đúng tinh thần: ưu tiên cục bộ, không phụ thuộc bổ sung.

---

## Đã lên kế hoạch — v2.7.0: Tìm kiếm bản phiên âm toàn dự án

Một công cụ độc lập để tìm kiếm một cụm từ hoặc mẫu trên mọi bản phiên âm trong một thư mục dự án và trả về các kết quả khớp cùng tệp nguồn và timecode của chúng. Được tách ra từ quy trình dự án video lớn hơn (xem "Về sau / Đang xem xét") — nửa này hữu ích một cách độc lập, rủi ro thấp và ít tốn API: việc tìm kiếm chạy cục bộ, và Claude chỉ tham gia khi người dùng xem xét kết quả.

**Trạng thái:** Đã lên kế hoạch.

---

## Đã lên kế hoạch — v2.8.0: Định dạng đầu ra nâng cao & tích hợp

Đầu ra mở rộng cho quy trình phân tích và tích hợp downstream. Một khoảng trống cụ thể cần lấp: đầu ra JSON hiện chưa được hỗ trợ ở chế độ nền (nó dự phòng về văn bản). JSON cấp từ để căn chỉnh clip và các định dạng tích hợp khác sẽ được xác định phạm vi từ phản hồi của người dùng.

---

## Về sau / Đang xem xét

Chưa lên lịch, nhưng đúng tinh thần và được xem lại khi năng lực cho phép.

### Chuyển đổi Bun
Chuyển đổi runtime từ Node.js sang [Bun](https://bun.sh) để cắt giảm thời gian khởi động lạnh của máy chủ MCP và bỏ bước biên dịch `tsc` (mã nguồn chạy trực tiếp). Bị hạ cấp khỏi vị trí v2.5.0 trước đây: khi chi phí tải lại mô hình theo từng lần gọi là nút thắt cổ chai thực sự (xem v2.5.0 ở trên), việc cắt giảm thời gian khởi động của Node là một mức tăng biên, và độ trưởng thành của Bun trên Windows cộng với thay đổi mô hình phân phối mang theo rủi ro. Đáng làm về sau như một tối ưu hóa tùy chọn, không phải ưu tiên.

### Quy trình đổi tên & khớp dự án video
Nửa nặng hơn của bộ công cụ dự án, sau khi Tìm kiếm bản phiên âm toàn dự án (v2.7.0) hoàn thành: khớp mờ bản phiên âm clip đã chỉnh sửa với bản phiên âm nguồn để xác định điểm gốc, và hiển thị tên tệp mô tả được Claude đề xuất.

**Ràng buộc thiết kế:**
- Tệp nguồn **không bao giờ bị đổi tên hoặc sửa đổi**
- Tất cả đổi tên cần **xác nhận rõ ràng của người dùng**
- Phân tích và khớp xảy ra cục bộ — Claude chỉ được gọi khi người dùng xem xét kết quả, giảm thiểu lệnh gọi API

**Trạng thái:** Giai đoạn thiết kế.

### Dọn dẹp bản phiên âm dựa trên quy tắc
Hậu xử lý cục bộ, xác định — loại bỏ từ đệm và nói vấp, do người dùng kiểm soát. Có giá trị nhất cho người dùng chế độ quyền riêng tư, nơi bản phiên âm không bao giờ đến Claude để dọn dẹp. Được thu hẹp có chủ ý: ngắt đoạn và phân đoạn chủ đề là những việc Claude đã làm tốt trên văn bản được trả về, và xuất PDF/DOCX là sự phình phạm vi sang tạo tài liệu — cả hai đều nằm ngoài phạm vi ở đây.

**Trạng thái:** Đang xem xét.

### Phân tách người nói (pyannote-audio)
Phân tách người nói mono đầy đủ với nhãn ID người nói trong toàn bộ bản ghi. Khác với flag `--diarize` stereo tích hợp (v2.2.0) và TinyDiarize (v2.6.0).

**Triển khai:** cần [pyannote-audio](https://github.com/pyannote/pyannote-audio) — thư viện Python với yêu cầu token truy cập Hugging Face, một stack phụ thuộc hoàn toàn riêng biệt. Bị hạ ưu tiên: nó xung đột với tinh thần ưu tiên cục bộ / không phụ thuộc, và TinyDiarize đã bao phủ trường hợp mono không phụ thuộc. Nếu được theo đuổi, nó sẽ được phát hành như một bổ sung nâng cao tùy chọn với tài liệu cài đặt riêng, không bao giờ trong gói chính.

**Trạng thái:** Bị hạ ưu tiên / tùy chọn.

### Dịch sang ngôn ngữ không phải tiếng Anh
Flag `--translate` của Whisper chỉ nhắm đến tiếng Anh. Các ngôn ngữ đích tùy ý cần một API dịch bên ngoài hoặc một mô hình dịch cục bộ.

**Các tùy chọn đang xem xét:** LibreTranslate (có thể tự host, ưu tiên cục bộ), dịch LLM cục bộ hoặc tài liệu rõ ràng nằm ngoài phạm vi.

**Trạng thái:** Hoãn lại chờ một quyết định về cục bộ ưu tiên vs phụ thuộc API.

---

## Ngoài phạm vi / Không lên kế hoạch

Các tính năng được loại trừ có chủ ý, được ghi lại ở đây để quyết định là rõ ràng và không tái xuất hiện lặp đi lặp lại.

### Phiên âm microphone trực tiếp — không lên kế hoạch
Phiên âm theo thời gian thực từ microphone trực tiếp trước đây được dự kiến cho v2.7.0. Bị cắt vì nó xung đột với thiết kế cốt lõi của dự án:
- **Không khớp kiến trúc:** MCP là yêu cầu/phản hồi, không phải phát trực tuyến. Thu âm trực tiếp sẽ đòi hỏi hoặc polling liên tục (đốt ngân sách API) hoặc một lệnh gọi chặn dài chạm vào bộ bảo vệ thời gian chờ tiền cảnh của v2.4.0.
- **Nguyên tắc một-phiên-bản / giảm-thiểu-API:** trả về các đoạn cuộn cho Claude là việc gọi công cụ liên tục — trái ngược với "hoạt động được cho người dùng gói miễn phí" — và một tiến trình phát trực tuyến sống lâu gây căng thẳng cho khóa tiến trình.
- **Phụ thuộc bên ngoài:** nó sẽ phụ thuộc vào một API phát trực tuyến ổn định trong whisper.cpp mà không phải do chúng tôi lên lịch.

Chú thích trực tiếp là một hạng mục sản phẩm riêng biệt (độ trễ thấp, quản lý thiết bị, VAD) so với một công cụ phiên âm tệp/đợt. Người dùng cần nó được phục vụ tốt hơn bởi một công cụ thời gian thực chuyên dụng.

### Phiên âm URL YouTube (yt-dlp) — không lên kế hoạch như một công cụ đi kèm
YouTube-sang-bản-phiên-âm trực tiếp qua yt-dlp trước đây được lên kế hoạch. Bị bỏ như một tính năng hạng nhất vì:
- **Bề mặt bảo mật:** nó thêm việc lấy URL tùy ý và một lệnh gọi tiến trình con với đầu vào do người dùng kiểm soát, đảo ngược việc tăng cường của v2.4.0 vốn đã giảm chính xác bề mặt đó.
- **Bảo trì:** yt-dlp thường xuyên hỏng khi YouTube thay đổi — một cam kết bảo trì liên tục.
- **Ưu tiên cục bộ & cấp phép:** việc thu thập nội dung qua mạng nằm ngoài phạm vi ưu tiên cục bộ, và việc đóng gói một trình tải xuống vào một dự án được cấp phép thương mại là một vùng xám về ToS/trách nhiệm pháp lý.
- **Dư thừa:** người dùng có thể tự chạy yt-dlp và trỏ `transcribe_audio` vào tệp kết quả.

**Thay thế:** được ghi lại như một công thức (chạy yt-dlp, sau đó phiên âm tệp) trong README / TROUBLESHOOTING, thay vì một công cụ được bảo trì — quy trình vẫn khả dụng mà không phải sở hữu phụ thuộc hoặc bề mặt tấn công.

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
