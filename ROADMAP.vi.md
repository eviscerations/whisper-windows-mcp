# whisper-windows-mcp — Lộ trình phát triển

Phiên bản hiện tại: **v2.5.0**

---

## Nguyên tắc thiết kế

Các nguyên tắc này chi phối mọi quyết định trong dự án và được ưu tiên hơn tốc độ thêm tính năng.

**Giảm thiểu sử dụng Claude API.** Toàn bộ quy trình phiên âm — quét, phân tích, xếp hàng, chạy, xác nhận, chuyển đổi mô hình — phải thực hiện được với ít tương tác Claude nhất có thể. Công cụ này phải hoạt động đầy đủ cho người dùng Claude gói miễn phí không trả phí Pro hoặc Max. Mỗi lệnh gọi công cụ tốn ngân sách sử dụng. Hãy thiết kế theo nguyên tắc này.

**Luôn chỉ một phiên bản whisper.** Không bao giờ tạo ra tiến trình whisper-cli.exe thứ hai khi đang có một tiến trình chạy. Khóa tiến trình là bắt buộc và không có ngoại lệ.

**Ưu tiên cục bộ, mặc định là riêng tư.** Âm thanh không bao giờ rời khỏi máy. Không cần API đám mây cho chức năng cốt lõi. Các tích hợp tùy chọn (ví dụ: tải mô hình từ Hugging Face) phải được ghi lại rõ ràng là tùy chọn.

**Kiểm soát người dùng rõ ràng.** Không có thao tác hàng loạt im lặng. Các hành động phá hủy hoặc không thể hoàn tác cần xác nhận. Người dùng phải luôn biết điều gì sắp xảy ra trước khi nó xảy ra.

**Đường dẫn an toàn Unicode.** Tất cả I/O tệp phải xử lý đúng tên tệp không phải ASCII, bao gồm tiếng Nhật, tiếng Trung, emoji, dấu ngoặc và các ký tự đặc biệt khác.

**Mô-đun và có thể kết hợp.** Các công cụ đều độc lập. Người dùng dùng những gì họ cần. Không có tính năng nào phải yêu cầu tính năng khác mới hoạt động được trừ khi không thể tránh khỏi.

**Tối ưu hóa trước tính năng.** Khi phân vân giữa thêm tính năng và giảm tải hệ thống hoặc số lượng lệnh gọi API, hãy giảm tải. Các đợt tối ưu hóa lớn rất tốn kém. Hãy thiết kế kiến trúc đúng ngay từ đầu.

---

## Đã hoàn thành

### ✅ v1.3.1 — Khóa tiến trình
Thêm kiểm tra `isWhisperRunning()` dùng `tasklist /FI` trước khi tạo bất kỳ tiến trình phiên âm nào. Trả về lỗi rõ ràng với hướng dẫn Task Manager thay vì tạo tiến trình cạnh tranh.

### ✅ v1.4.0 — Tăng tốc GPU Vulkan
Biên dịch whisper.cpp từ nguồn với `-DGGML_VULKAN=ON` dùng VS Build Tools 2022 và Vulkan SDK. Phân phối tệp nhị phân Vulkan biên dịch sẵn dưới dạng `whisper-vulkan-win-x64.zip`.

**Kết quả trên AMD Radeon RX Vega 56:** Mức sử dụng GPU trung bình ~16%. Tệp 58 phút hoàn thành trong ~4.5 phút trên GPU so với ~88 phút chỉ dùng CPU.

### ✅ v1.5.0 — Chẩn đoán hệ thống
Công cụ `check_system`: phát hiện GPU qua `wmic`, xác nhận Vulkan DLL, báo cáo VRAM, đề xuất kích thước mô hình.

### ✅ v1.6.0 — Phân tích tệp trước
Công cụ `analyze_media` qua FFprobe: thời lượng, kích thước, codec, trạng thái phiên âm, ước tính thời gian CPU và GPU. Quét tệp đơn hoặc thư mục với tùy chọn sắp xếp.

### ✅ v1.7.0 — Phiên âm nền + Theo dõi tiến trình
Kiến trúc tiến trình tách rời: `transcribe_audio` với `background=true` tạo whisper như một tiến trình tách rời và trả về ID tác vụ ngay lập tức. `check_progress` phân tích dấu thời gian của các đoạn trong stderr của whisper để tính phần trăm và ETA theo thời gian thực.

### ✅ v1.8.0 — Xử lý hàng loạt tuần tự có xác nhận
`start_batch` và `check_batch_progress`: xử lý tuần tự tự động, xác nhận phiên âm (phát hiện đầu ra trống/ngắn), tự động tiến hàng đợi, dấu thời gian tiến trình theo từng tệp.

### ✅ v1.9.0 — Hỗ trợ đa ngôn ngữ và dịch thuật
`generate_subtitles` với phát hiện `language=auto` và đầu ra SRT kép `translate_to_english=true`. Thêm hỗ trợ định dạng `.3gp` và `.ts`. `language=auto` cũng có trong `transcribe_audio`.

**Giới hạn đã biết:** Bản dịch tích hợp của Whisper chỉ nhắm đến tiếng Anh. Cần mô hình `large-v3` cho các ngôn ngữ không phải tiếng Anh — mô hình chỉ tiếng Anh (`*.en.bin`) xuất ra `[FOREIGN]` với âm thanh không phải tiếng Anh.

### ✅ v2.0.0 — Đường dẫn an toàn Unicode + SRT nền
**Tên tệp Unicode:** Tệp có ký tự không phải ASCII trong tên tệp gây ra lỗi phiên âm nền thất bại một cách lặng lẽ. Đã sửa bằng cách định tuyến tất cả đầu ra qua đường dẫn tạm thời đã làm sạch dựa trên ID tác vụ, sau đó di chuyển kết quả đến đích chính xác sau khi hoàn thành.

**SRT trong chế độ nền:** `spawnDetached` trước đây mã cứng `-otxt` bất kể định dạng được yêu cầu. Đã sửa bằng cách thêm tham số `outputFormat` vào `spawnDetached`, hỗ trợ đầu ra `text` và `srt` trong chế độ nền.

### ✅ v2.0.1 — Sửa lỗi (đã phát hành trong v2.2.0)
- Mã cứng `--max-context 0` trong cả `buildArgs` và `spawnDetached` — ngăn vòng lặp ảo giác trên âm thanh dài.
- Mã cứng `--no-speech-thold 0.6` trong cả hai hàm — các đoạn dưới ngưỡng tin cậy được xử lý như im lặng thay vì nội dung ảo giác.
- Xác thực đường dẫn (`validateInputPath`) — từ chối đường dẫn UNC và duyệt `..`.
- Bảo vệ kích thước tệp `MAX_FILE_SIZE_MB = 10240`.
- Chú thích bảo mật về tiêm nhiễm phiên âm trong `transcribeSingle`.
- Sửa lệnh CLI batch bị hỏng trong TROUBLESHOOTING.md.

### ✅ v2.1.0 — Bộ quản lý mô hình (đã phát hành trong v2.2.0)
- Thay đổi `WHISPER_MODEL` từ `const` sang `let` (có thể thay đổi trong phiên).
- `MODEL_REGISTRY` — 16 mô hình, biến thể độ chính xác đầy đủ và lượng tử hóa, URL tải xuống Hugging Face.
- `ALLOWED_HF_PREFIXES` — danh sách URL cho phép giới hạn tải xuống vào namespace `ggerganov/whisper.cpp` và `ggml-org`.
- Công cụ `list_models` — quét thư mục mô hình, hiển thị mô hình đang hoạt động, kích thước, trường hợp sử dụng, các bản tải xuống có sẵn.
- Công cụ `download_model` — tải xuống từ Hugging Face qua `https` tích hợp sẵn của Node.js, đổi tên nguyên tử.
- Công cụ `switch_model` — xác thực phần mở rộng `.bin`, ràng buộc thư mục, kiểm tra khóa tiến trình.
- Cập nhật `recommendedModel()` để đề xuất `large-v3-turbo` cho VRAM 6GB+.

### ✅ v2.2.0 — Mở rộng chất lượng, tham số và phần cứng
- Interface `WhisperOptions` thay thế đối số vị trí trong `buildArgs`.
- Tham số mới trong `transcribe_audio`: `temperature`, `prompt`, `condition_on_prev_text`, `no_speech_thold`, `beam_size`, `best_of`, `gpu_device`, `processors`, `word_timestamps`, `max_segment_length`, `split_on_word`, `diarize`, `vad_model`, `offset_t`, `duration`.
- Tham số mới trong `generate_subtitles`: `temperature`, `prompt`, `beam_size`, `best_of`, `diarize`, `vad_model`.
- Tái cấu trúc `spawnDetached` — tất cả flag chất lượng được áp dụng trong chế độ nền/đợt.
- Sửa đầu ra đợt — `readBatchProgress` giờ di chuyển đầu ra tạm thời đến đích cuối cùng trước khi xác nhận.

**Lưu ý tương thích flag:** `gpu_device` / `--device` được thêm trong whisper.cpp v1.8.4. Tệp nhị phân Vulkan biên dịch sẵn trong các bản phát hành là thế hệ v1.8.3 — tham số này được công cụ chấp nhận nhưng sẽ không có hiệu lực cho đến khi người dùng cập nhật lên tệp nhị phân v1.8.4+.

### ✅ v2.2.2 — Bản vá
- Sửa cấp phép kép — chỉnh sửa LICENSE và LICENSE-COMMERCIAL.md.
- Sửa lỗi tài liệu nhỏ.

### ✅ v2.3.0 — Tự động tiến đợt, kiến trúc quyền riêng tư, mở rộng định dạng đầu ra

**Tự động tiến đợt (sửa lỗi nghiêm trọng):** `start_batch` trước đây yêu cầu polling tích cực để tiến hàng đợi. Giờ mỗi tiến trình con whisper-cli được tạo ra đều có handler `on('exit')` gắn vào. Khi tiến trình thoát, đợt tự động tiến ngay lập tức qua exit callback — không tốn chi phí polling và không tiêu tốn lệnh gọi API. Một mutex ngăn tạo kép giữa exit handler và lệnh gọi `check_batch_progress` đồng thời.

**Kiến trúc quyền riêng tư:**
- Biến môi trường `WHISPER_PRIVACY_MODE` — khi đặt thành `true`, tất cả phản hồi công cụ chỉ trả về siêu dữ liệu (tên tệp, số từ, đường dẫn lưu). Không có văn bản phiên âm nào được gửi đến API của Claude. Bản phiên âm chỉ tồn tại dưới dạng tệp cục bộ.
- Biến môi trường `WHISPER_CONSENT_ACKNOWLEDGED` — khi đặt thành `true`, bỏ qua cổng đồng ý phiên một lần cho nội dung không nhạy cảm.
- Tham số `privacy_mode` theo từng lệnh gọi trong `transcribe_audio`, `transcribe_batch`, `start_batch` và `check_progress`. Ghi đè biến môi trường toàn cục theo cả hai hướng. Không cần khởi động lại để bật/tắt theo từng lệnh gọi.
- Cổng chế độ quyền riêng tư (`checkPrivacyGate()`) — chạy trước mỗi thao tác khi chế độ quyền riêng tư hiệu lực đang hoạt động. Kích hoạt ở lần gọi đầu tiên (hiển thị công bố), giải phóng ở lần gọi thứ hai (cho phép). Đặt lại sau mỗi thao tác. Hoàn toàn độc lập với cổng đồng ý phiên.
- Cổng đồng ý phiên (`transcriptPolicy()`) — chạy một lần mỗi phiên trước lệnh gọi trả về phiên âm đầu tiên ở chế độ tiêu chuẩn. Được tiêu thụ bởi flag `sessionConsentGiven`.
- `PRIVACY.md` — tài liệu tuân thủ đầy đủ bao gồm HIPAA, GDPR, đặc quyền luật sư-khách hàng, FERPA, SOX, PCI-DSS và NDA/bí mật thương mại.
- Cảnh báo quyền riêng tư trong phần mô tả của tất cả công cụ trả về văn bản phiên âm.

**Mở rộng định dạng đầu ra:**
- `vtt` — đầu ra phụ đề WebVTT qua `-ovtt`. Có sẵn trong `transcribe_audio`, `generate_subtitles`, `start_batch` và chế độ nền.
- `lrc` — định dạng lời bài hát/karaoke LRC qua `-olrc`. Có sẵn trong `transcribe_audio` và chế độ nền.
- `csv` — CSV có dấu thời gian qua `-ocsv`. Có sẵn trong `transcribe_audio` và chế độ nền.
- Giá trị mặc định `output_format` thay đổi từ `"text"` sang `"timestamps"` trên tất cả công cụ và đường dẫn mã. Văn bản thuần túy giờ là tùy chọn phải chủ động bật.

**Sửa lỗi:**
- Lỗi 1: `output_format` không được truyền đến các tác vụ nền — mặc định `"text"` được dùng bất kể định dạng được yêu cầu. Đã sửa bằng cách thay đổi mặc định thành `"timestamps"` và truyền đúng cách.
- Lỗi 2: `catch {}` im lặng trong thao tác di chuyển đầu ra của tác vụ nền nuốt mất các lỗi thất bại. Thêm kiểm tra `existsSync` rõ ràng cùng thông báo thất bại chi tiết sau khi di chuyển.
- Lỗi 3: Thêm chú thích thiết kế tại điểm tạo tiến trình nền, giải thích tại sao cổng đồng ý được trì hoãn có chủ ý đến `check_progress` cho các tác vụ nền không riêng tư.

**Bổ sung:**
- Tự động dọn dẹp thư mục tạm thời — `cleanupOldJobFiles()` chạy khi khởi động, xóa tệp `.json` và `.log` cũ hơn 7 ngày trong `%TEMP%\whisper-mcp-jobs\`.
- `check_config` giờ báo cáo trạng thái chế độ quyền riêng tư.
- Nhật ký khởi động báo cáo chế độ quyền riêng tư bật/tắt.
- Interface `Job` được mở rộng thêm trường `privacyMode: boolean`.
- Interface `BatchState` được mở rộng thêm trường `privacyMode: boolean`.
- Kiểu `BackgroundFormat` loại trừ `json` (json trong chế độ nền vẫn không được hỗ trợ — dự phòng về `text`).

### ✅ v2.4.0 — Tăng cường, bộ bảo vệ tiền cảnh, bộ kiểm thử & CI

Một lượt rà soát bảo mật/độ bền; việc chuyển đổi Bun đã lên kế hoạch được dời sang v2.5.0.

**Bảo mật & tính đúng đắn:**
- Sửa lỗi giới hạn đường dẫn của `switch_model` — một thư mục có tiền tố-anh em (ví dụ `…\models-evil`) trước đây có thể thỏa mãn kiểm tra "bên trong thư mục mô hình" thông qua `startsWith` ngây thơ; được thay bằng kiểm tra giới hạn chuẩn hóa dựa trên `relative()`. Đóng lỗ hổng thoát mà SECURITY.md mô tả.
- Cổng quyền riêng tư/đồng ý được khóa **theo từng thao tác** (công cụ + đối số) — việc xác nhận một phiên âm không còn có thể thỏa mãn cổng của một thao tác khác.
- `download_model` từ chối các lượt tải bị cắt cụt (kiểm tra Content-Length) trước khi thăng cấp tệp `.part`. (Việc xác minh đầy đủ digest SHA256 được theo dõi cho một lượt sau.)
- Ép kiểu đầu vào — các tham số công cụ dạng số nhưng không phải số thực sự sẽ bị loại bỏ thay vì được chuyển cho whisper-cli dưới dạng `NaN`.

**Độ bền:**
- **Bộ bảo vệ thời gian chờ tiền cảnh** — một tệp đủ dài để vượt quá thời gian chờ công cụ MCP ~4 phút của Claude Desktop ở chế độ chặn được phát hiện trước và được định tuyến sang nền thay vì âm thầm hết thời gian chờ. Ngưỡng có thể cấu hình qua `WHISPER_FOREGROUND_MAX_SEC`. Ước tính thời gian đã được sửa (ước tính GPU cũ dự đoán thiếu nghiêm trọng; chi phí tải lại mô hình chiếm phần lớn nay đã được mô hình hóa — đo lường, không phải phỏng đoán).
- Ghi trạng thái công việc/đợt theo kiểu nguyên tử (tệp tạm + đổi tên) để một trình đọc đồng thời không thể quan sát thấy tệp JSON bị rách.
- ID công việc/đợt/tạm chống xung đột (có hậu tố UUID).
- Tắt nhẹ nhàng khi nhận SIGINT/SIGTERM, dọn dẹp các tệp tạm của chế độ chặn.

**Lựa chọn thiết bị GPU:**
- Biến môi trường `WHISPER_GPU_DEVICE`, và `gpu_device` nay được truyền qua `generate_subtitles` và lượt phát hiện ngôn ngữ (trước đây chỉ có trong `transcribe_audio`). `check_config` báo cáo thiết bị đang hoạt động. `check_system` không còn báo cáo sai sự cố trình điều khiển khi `wmic` (đã ngừng dùng trên Windows 11 24H2+) không trả về gì.

**Chất lượng:**
- Một bộ kiểm thử đơn vị `node:test` trên phần logic thuần túy (giới hạn đường dẫn, khóa cổng, ghi nguyên tử, ép kiểu đầu vào, ước tính thời gian chờ), không thêm phụ thuộc nào, cùng với một quy trình CI GitHub Actions chạy nó trên mỗi push/PR.

**Đã xác định cho một bản phát hành tương lai:** một đường dẫn mô hình bền vững (ví dụ `whisper-server` của whisper.cpp) để loại bỏ chi phí tải lại mô hình phải trả ở mỗi lần phiên âm — một mức tăng thông lượng lớn cho công việc theo đợt/lưu trữ.

### ✅ v2.5.0 — Máy chủ mô hình bền vững + TinyDiarize

**Máy chủ mô hình bền vững (Giai đoạn 1).** whisper-cli chạy một lần: nó tải lại toàn bộ mô hình ở mỗi lệnh gọi — v2.4.0 đã đo lần tải lại đó ở mức ~110 giây trên một GPU bị giới hạn bộ nhớ, một khoản thuế cố định cho mỗi tệp chi phối thời gian thực tế trong công việc theo đợt/lưu trữ. v2.5.0 thêm một chế độ mô hình thường trú tùy chọn giữ mô hình trong bộ nhớ giữa các lần phiên âm.
- Công cụ `whisper_server` (`start` / `stop` / `status`). Máy chủ thường trú *trở thành* phiên bản duy nhất, bảo toàn quy tắc một-phiên-bản-whisper: các yêu cầu tuần tự hóa với nó, không đưa vào tính đồng thời nào.
- `transcribe_audio` và `transcribe_batch` dạng chặn định tuyến qua máy chủ thường trú trên localhost (`127.0.0.1`) qua `POST /inference`, bỏ qua chi phí tải lại. Bộ bảo vệ thời gian chờ tiền cảnh được bỏ qua ở chế độ máy chủ (không có việc tải lại nào phải trả).
- `switch_model` hoán đổi nóng mô hình thường trú qua `POST /load` mà không cần khởi động lại. `check_config` báo cáo trạng thái máy chủ; máy chủ do nó sở hữu bị kill khi tắt để giải phóng VRAM.
- Quy tắc một-engine / VRAM-dùng-chung được thực thi bằng một biện pháp chặn cứng trong đường dẫn tạo tiến trình tách rời cùng với các từ chối thân thiện: khi máy chủ đang hoạt động, tác vụ nền, `start_batch`, `generate_subtitles`, đầu ra `lrc`/`csv`, và các tùy chọn theo từng yêu cầu mà HTTP API không hỗ trợ (`beam_size`, `best_of`, `word_timestamps`, `diarize`, `tinydiarize`, `vad_model`, `offset_t`, `duration`, v.v.) bị từ chối với thông báo "hãy dừng máy chủ trước" thay vì âm thầm giảm cấp.
- Cấu hình: `WHISPER_SERVER_PATH`, `WHISPER_SERVER_PORT` (mặc định 8571, chỉ localhost).

**Ràng buộc thiết kế:**
- Vòng đời rõ ràng: start / stop / status, với kiểm tra sức khỏe. Máy chủ không bao giờ được khởi động âm thầm như một tác dụng phụ của một lệnh gọi không liên quan.
- Chỉ ràng buộc vào localhost — không bao giờ là một giao diện có thể định tuyến. Không để lộ ra mạng (nhất quán với nguyên tắc ưu tiên cục bộ và việc tăng cường của v2.4.0).
- Dự phòng nhẹ nhàng: nếu máy chủ không chạy, việc phiên âm vẫn hoạt động qua đường dẫn whisper-cli một lần hiện có. Máy chủ là một tối ưu hóa, không phải một phụ thuộc bắt buộc.
- `switch_model` tải lại mô hình trong máy chủ thường trú (vẫn rẻ hơn nhiều khi phân bổ so với tải lại theo từng tệp).
- Các cổng quyền riêng tư và đồng ý không thay đổi — chúng nằm trên cơ chế phiên âm.
- Lựa chọn cổng có xử lý xung đột; tắt sạch khi nhận SIGINT/SIGTERM cùng với việc dọn dẹp tệp tạm hiện có.

**TinyDiarize.** Hỗ trợ `--tinydiarize` với các mô hình có bật `tdrz`. Không giống flag stereo `--diarize` (v2.2.0), TinyDiarize đánh dấu các lượt nói trên bản ghi **mono** và không cần gì ngoài tệp mô hình — không Python, không dịch vụ bên ngoài.
- Tham số `tinydiarize` trên `transcribe_audio` và `generate_subtitles` (chế độ chặn và nền); `--tinydiarize` được luồn qua cả hai bộ dựng đối số.
- `small.en-tdrz` được thêm vào `MODEL_REGISTRY` để `download_model` có thể lấy nó từ các namespace Hugging Face đáng tin cậy hiện có.

---

## Đã lên kế hoạch — v2.6.0: Máy chủ mô hình bền vững — Giai đoạn 2

Định tuyến các tác vụ nền và `start_batch` qua máy chủ thường trú. Giai đoạn 1 (v2.5.0) chỉ bao phủ phiên âm dạng chặn; đây là mức tăng lưu trữ/thông lượng lớn hơn, và cần lớp tác vụ/hàng đợi được làm lại xoay quanh các yêu cầu HTTP thay vì PID tách rời — theo dõi tiến trình mà không có PID, và hủy bỏ dựa trên HTTP.

Các **ràng buộc thiết kế** của máy chủ thường trú được thiết lập trong v2.5.0 tiếp tục chi phối Giai đoạn 2 — chỉ ràng buộc vào localhost, vòng đời rõ ràng, dự phòng nhẹ nhàng một lần, và các cổng quyền riêng tư/đồng ý không thay đổi. Giai đoạn 2 bổ sung việc định tuyến tác vụ/hàng đợi mà không nới lỏng bất kỳ ràng buộc nào trong số đó.

**Trạng thái:** Đã lên kế hoạch.

---

## Đã lên kế hoạch — v2.7.0: Tìm kiếm bản phiên âm toàn dự án

Một công cụ độc lập để tìm kiếm một cụm từ hoặc mẫu trên mọi bản phiên âm trong một thư mục dự án và trả về các kết quả khớp cùng tệp nguồn và timecode của chúng. Được tách ra từ quy trình dự án video lớn hơn (xem "Về sau / Đang xem xét") — nửa này hữu ích một cách độc lập, rủi ro thấp và ít tốn API: việc tìm kiếm chạy cục bộ, và Claude chỉ tham gia khi người dùng xem xét kết quả.

**Trạng thái:** Đã lên kế hoạch.

---

## Đã lên kế hoạch — v2.8.0: Đầu ra có thể nhập vào trình biên tập & định dạng tích hợp

Biến bản phiên âm thành các artifact mà một trình biên tập video nhập trực tiếp, để việc phiên âm đưa dữ liệu vào bản dựng thay vì dừng lại ở một tệp văn bản — động lực cốt lõi của dự án: giúp một kho phim thô lớn trở nên khả dụng cho một nhà sáng tạo đơn lẻ.

- **Marker CSV trước tiên** — điểm bắt đầu của các đoạn dưới dạng một CSV marker/chapter mà Premiere, Resolve và YouTube nhập một cách tự nhiên. Mang lại phần lớn giá trị "đưa nó vào trình biên tập của tôi" với một phần nhỏ chi phí và sự mong manh về phiên bản của một định dạng timeline đầy đủ.
- **Dữ liệu định thời cấp từ** — phơi bày JSON full-token của whisper.cpp (`--output-json-full` / `-ojf`) và dấu thời gian từ căn chỉnh DTW (`--dtw <preset>`, tự động khớp với mô hình đang hoạt động; các preset tồn tại cho mọi họ mô hình bao gồm `large.v3.turbo`, và áp dụng cho các mô hình lượng tử hóa). Đây là lớp định thời chính xác mà SRT cấp từ, việc đặt marker và căn chỉnh clip dựa vào; JSON theo từng token cũng mang các giá trị độ tin cậy cho những ai cần đến. Lưu ý: `--dtw` là một **flag thời-điểm-tải/ngữ-cảnh** (đặt tại lúc khởi tạo mô hình, không phải theo từng yêu cầu), nên nó nằm trong đường dẫn CLI một lần — API `/inference` của máy chủ thường trú `whisper-server` không thể áp dụng nó theo từng yêu cầu, nhất quán với việc từ chối cấp từ ở chế độ máy chủ trong v2.5.0.
- **Đóng lại khoảng trống JSON-trong-nền** — JSON hiện dự phòng về văn bản trong chế độ nền.
- **FCPXML / EDL — hoãn lại:** dài dòng, nhạy cảm với phiên bản, và kéo về phía phạm vi tích hợp trình biên tập. Chỉ xem lại nếu marker CSV tỏ ra không đủ.

**Ranh giới phạm vi:** phần này tạo ra các tệp mà trình biên tập *nhập vào* — nó không tự động hóa giao diện của trình biên tập. Trao đổi tiêu chuẩn thì đúng tinh thần và ít phụ thuộc; điều khiển ứng dụng là một mối quan tâm riêng.

Kết hợp với v2.7.0: tìm kiếm kho lưu trữ để tìm khoảnh khắc, sau đó trao cho trình biên tập một tệp marker để nhảy thẳng đến nó.

---

## Đã lên kế hoạch — v2.9.0: Chất lượng phiên âm & tinh chỉnh

Đào sâu về độ chính xác và khả năng kiểm soát phiên âm — tất cả đều là các passthrough không phụ thuộc của các flag whisper.cpp mà wrapper chưa phơi bày. Mọi tùy chọn ở đây đều là một tham số phiên âm một lần: không thêm chi phí gọi công cụ, hoạt động đầy đủ cho người dùng gói miễn phí.

- **Tinh chỉnh VAD** — các núm điều chỉnh phát hiện hoạt động giọng nói (`--vad-threshold`, thời lượng min-speech / min-silence / max-speech, speech-pad, samples-overlap). VAD đã bật nhưng chưa thể tinh chỉnh; những núm này khắc phục hành vi phân đoạn quá mức và thiếu mức đứng sau hầu hết các phàn nàn về chất lượng trong thực tế.
- **Chặn token không-phải-giọng-nói** (`--suppress-nst`) — loại bỏ các artifact `[music]` / tạp âm để có bản phiên âm sạch hơn.
- **Chỉ phát hiện ngôn ngữ** (`--detect-language`) — một phép thăm dò "đây là ngôn ngữ gì?" giá rẻ trả về mà không cần một lượt phiên âm đầy đủ. Có giá trị cho đối tượng đa ngôn ngữ và cho việc định tuyến trước khi phiên âm.
- **Ngưỡng độ bền / giải mã** — `--entropy-thold`, `--logprob-thold`, `--word-thold`, `--no-fallback`, `--temperature-inc`, `--carry-initial-prompt`, `--suppress-regex` cho âm thanh khó.
- **Núm hiệu năng** — flash attention (nay **bật mặc định** trong whisper.cpp hiện tại; phơi bày đường dẫn tắt `--no-flash-attn` / `-nfa` thay vì coi nó là tùy chọn phải chủ động bật), chỉ CPU (`--no-gpu`), kích thước audio-context (`--audio-ctx`).

**Trạng thái:** Đã lên kế hoạch.

---

## Đã lên kế hoạch — v3.0.0: Bộ hậu xử lý phụ đề

Một lớp xử lý theo đợt thuần TypeScript trên SRT / VTT / JSON mà máy chủ đã tạo ra — không phiên âm lại, không phụ thuộc mới, một bộ parser/serializer dùng chung. Phản chiếu chuỗi "chuyển đổi hàng loạt" của các trình biên tập phụ đề chuyên dụng (Subtitle Edit, Aegisub), thứ mà không MCP phiên âm cạnh tranh nào cung cấp. Đặc biệt, lượt sửa định thời nhắm vào các lỗi mà đầu ra Whisper thô thể hiện — cue trống trên đoạn im lặng, các đoạn chồng lấn hoặc quá ngắn, bản sao lặp vòng, dòng quá dài — nên bộ này dọn dẹp *chính* đầu ra của máy chủ này, không chỉ các tệp được nhập vào.

- **Sửa và xác thực định thời** — thực thi thời lượng cue tối thiểu / tối đa; sửa các cue chồng lấn; áp dụng khoảng cách tối thiểu giữa các cue; nối các khoảng trống dưới ngưỡng (kéo dài đến cue tiếp theo); loại bỏ các cue trống; gộp các cue trùng lặp (vòng lặp lặp lại của whisper); giới hạn ở hai dòng; sắp xếp + đánh số lại. Cùng với một **báo cáo lint** không làm thay đổi, gắn cờ tốc độ đọc theo từng cue (CPS), số ký tự mỗi dòng và vi phạm số dòng so với một hồ sơ có thể chọn (ví dụ YouTube 42 CPL / 20 CPS, Netflix 42 / 17) — sản phẩm mà các trình biên tập thực sự muốn có trước khi nhập.
- **Định thời lại** — dịch chuyển / dời tất cả cue; định thời lại theo khung hình (ví dụ 23.976 ↔ 25).
- **Sắp xếp lại luồng** — gộp các cue ngắn; tách các dòng dài về mức chars-per-line / chars-per-second tối đa, cân bằng hai dòng thay vì tách tham lam.
- **Chuyển đổi định dạng** — chuyển đổi các tệp hiện có giữa SRT / VTT / LRC / CSV / Markdown / văn bản thuần, cùng với đầu ra ASS/SSA (có kiểu mặc định), mà không phiên âm lại. Chuẩn hóa UTF-8 / ký tự xuống dòng khi ghi (thỏa mãn yêu cầu UTF-8 của YouTube, ngăn mojibake khi nhập lại).
- **Dọn dẹp văn bản** — tìm/thay thế (regex phải chủ động bật), loại bỏ từ đệm từ một danh sách từ tĩnh (không phải LLM), chuẩn hóa viết hoa, loại bỏ các chú thích cho người khiếm thính. Hoàn toàn mang tính cơ học — bất cứ điều gì cần phán đoán (sửa OCR, suy luận dấu câu) đều nằm ngoài; Claude chủ nhà xử lý điều đó trên văn bản được trả về.
- **Định dạng nhãn người nói** — định dạng các lượt nói stereo / TinyDiarize hiện có thành các khối có tiền tố người nói.
- **Thống kê tóm tắt** — số từ, thời lượng, WPM, CPS trung bình, tỷ lệ im lặng.

**Ràng buộc thiết kế:**
- Thuần TypeScript trên SRT / VTT / JSON mà máy chủ đã tạo ra — không phiên âm lại, không phụ thuộc runtime mới, một bộ parser/serializer dùng chung.
- Chỉ thao tác trên các tệp phụ đề/bản phiên âm hiện có — không bao giờ gọi whisper hoặc ffmpeg, không bao giờ chạm vào âm thanh.
- Chỉ mang tính xác định và dựa trên quy tắc — không LLM, không đám mây, không sửa chữa "thông minh". Bất cứ điều gì cần phán đoán (sửa OCR, suy luận dấu câu) đều nằm ngoài; Claude chủ nhà xử lý điều đó trên văn bản được trả về.
- Không phá hủy — ghi các tệp mới; không bao giờ ghi đè một tệp nguồn tại chỗ mà không có xác nhận rõ ràng của người dùng.
- Lượt lint / xác thực không làm thay đổi — nó báo cáo vi phạm, không bao giờ âm thầm viết lại.
- Chỉ các định dạng trao đổi tiêu chuẩn — không bao giờ điều khiển giao diện của một trình biên tập.

**Trạng thái:** Đã lên kế hoạch.

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
Hậu xử lý cục bộ, mang tính xác định — loại bỏ từ đệm và nói vấp, do người dùng kiểm soát. Có giá trị nhất cho người dùng chế độ quyền riêng tư, nơi bản phiên âm không bao giờ đến Claude để dọn dẹp. Được thu hẹp có chủ ý: ngắt đoạn và phân đoạn chủ đề là những việc Claude đã làm tốt trên văn bản được trả về, và xuất PDF/DOCX là sự phình phạm vi sang tạo tài liệu — cả hai đều nằm ngoài phạm vi ở đây.

**Trạng thái:** Được thăng cấp — việc dọn dẹp mang tính xác định được lên lịch trong Bộ hậu xử lý phụ đề v3.0.0; các lưu ý nằm ngoài phạm vi (ngắt đoạn, PDF/DOCX) vẫn giữ nguyên.

### Phân tách người nói (pyannote-audio)
Phân tách người nói mono đầy đủ với nhãn ID người nói trong toàn bộ bản ghi. Khác với flag `--diarize` stereo tích hợp (v2.2.0) và TinyDiarize (v2.5.0).

**Triển khai:** cần [pyannote-audio](https://github.com/pyannote/pyannote-audio) — một thư viện Python với yêu cầu token truy cập Hugging Face, một stack phụ thuộc hoàn toàn riêng biệt. Bị hạ ưu tiên: nó xung đột với tinh thần ưu tiên cục bộ / không phụ thuộc, và TinyDiarize đã bao phủ trường hợp mono không phụ thuộc. Nếu được theo đuổi, nó sẽ được phát hành như một bổ sung nâng cao tùy chọn với tài liệu cài đặt riêng, không bao giờ trong gói chính.

**Trạng thái:** Bị hạ ưu tiên / tùy chọn.

### Dịch sang các ngôn ngữ không phải tiếng Anh
Flag `--translate` của Whisper chỉ nhắm đến tiếng Anh. Các ngôn ngữ đích tùy ý cần một API dịch bên ngoài hoặc một mô hình dịch cục bộ.

**Các tùy chọn đang xem xét:** LibreTranslate (có thể tự host, ưu tiên cục bộ), dịch bằng LLM cục bộ, hoặc tài liệu ghi rõ là nằm ngoài phạm vi.

**Trạng thái:** Hoãn lại chờ một quyết định về ưu-tiên-cục-bộ vs phụ-thuộc-API.

---

## Ngoài phạm vi / Không lên kế hoạch

Các tính năng được loại trừ có chủ ý, được ghi lại ở đây để quyết định được rõ ràng và không tái xuất hiện lặp đi lặp lại.

### Phiên âm microphone trực tiếp — không lên kế hoạch
Phiên âm theo thời gian thực từ microphone trực tiếp trước đây được dự kiến cho v2.7.0. Bị cắt vì nó xung đột với thiết kế cốt lõi của dự án:
- **Không khớp kiến trúc:** MCP là yêu cầu/phản hồi, không phải phát trực tuyến. Thu âm trực tiếp sẽ đòi hỏi hoặc polling liên tục (đốt ngân sách API) hoặc một lệnh gọi chặn dài chạm vào bộ bảo vệ thời gian chờ tiền cảnh của v2.4.0.
- **Nguyên tắc một-phiên-bản / giảm-thiểu-API:** trả về các đoạn cuộn cho Claude là việc gọi công cụ liên tục — trái ngược với "hoạt động được cho người dùng gói miễn phí" — và một tiến trình phát trực tuyến sống lâu gây căng thẳng cho khóa tiến trình.
- **Phụ thuộc bên ngoài:** nó sẽ cần một phụ thuộc bên ngoài bổ sung.

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

**Sử dụng thương mại:** Cần có một giấy phép thương mại riêng cho bất kỳ mục đích kinh doanh, chuyên nghiệp hoặc tạo doanh thu nào. Xem [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md) để biết điều khoản và thông tin liên hệ.

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

Chào mừng pull request. Vui lòng kiểm tra các issue hiện có trước khi bắt đầu làm việc.

Nếu bạn đã thử nghiệm tăng tốc GPU trên phần cứng không được liệt kê ở trên, vui lòng mở issue với mô hình GPU, VRAM, kích thước mô hình và thông lượng quan sát được. Điều này giúp xây dựng một tài liệu tham khảo hiệu suất chính xác cho những người dùng khác.
