# whisper-windows-mcp — Lộ trình phát triển

Phiên bản hiện tại: **v2.2.0**

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

**SRT trong chế độ nền:** `spawnDetached` trước đây mã cứng `-otxt` bất kể định dạng được yêu cầu, và `generate_subtitles` chặn đồng bộ và bị timeout MCP 4 phút với tệp dài hơn. Đã sửa bằng cách thêm tham số `outputFormat` vào `spawnDetached`, hỗ trợ đầu ra `text` và `srt` trong chế độ nền.

### ✅ v2.0.1 — Sửa lỗi (đã gộp vào v2.2.0)
- Mã cứng `--max-context 0` trong cả `buildArgs` và `spawnDetached` — ngăn vòng lặp ảo giác trên âm thanh dài. `--condition-on-previous-text` và `--no-context` không phải flag hợp lệ trong tệp nhị phân hiện tại (thế hệ v1.8.3) — `--max-context N` là flag đúng.
- Mã cứng `--no-speech-thold 0.6` trong cả hai hàm — xử lý các đoạn dưới ngưỡng tin cậy là im lặng thay vì nội dung ảo giác.
- Xác thực đường dẫn (`validateInputPath`) — từ chối đường dẫn UNC và duyệt `..`.
- Bảo vệ kích thước tệp `MAX_FILE_SIZE_MB = 10240`.
- Chú thích bảo mật tiêm nhiễm phiên âm trong `transcribeSingle`.
- Sửa lệnh CLI batch bị hỏng trong TROUBLESHOOTING.md — ghi lại phương pháp chuyển đổi FFmpeg đúng và cách dùng `Start-Process -RedirectStandardOutput`.

### ✅ v2.1.0 — Bộ quản lý mô hình (đã gộp vào v2.2.0)
- Thay đổi `WHISPER_MODEL` từ `const` sang `let` (có thể thay đổi trong phiên).
- `MODEL_REGISTRY` — 16 mô hình, biến thể độ chính xác đầy đủ và lượng tử hóa, URL tải xuống Hugging Face.
- `ALLOWED_HF_PREFIXES` — danh sách URL cho phép giới hạn tải xuống vào namespace `ggerganov/whisper.cpp` và `ggml-org`.
- Công cụ `list_models` — quét thư mục mô hình, hiển thị mô hình đang hoạt động, kích thước, trường hợp sử dụng, các tải xuống có sẵn.
- Công cụ `download_model` — tải xuống từ Hugging Face qua `https` tích hợp sẵn của Node.js, đổi tên nguyên tử (sửa race condition giải phóng file handle Windows).
- Công cụ `switch_model` — xác thực phần mở rộng `.bin`, ràng buộc thư mục, kiểm tra khóa tiến trình.
- Cập nhật `recommendedModel()` để đề xuất `large-v3-turbo` cho VRAM 6GB+.

### ✅ v2.2.0 — Mở rộng chất lượng, tham số và phần cứng (hiện tại)
- Interface `WhisperOptions` thay thế đối số vị trí trong `buildArgs`.
- Tham số mới trong `transcribe_audio`: `temperature`, `prompt`, `condition_on_prev_text`, `no_speech_thold`, `beam_size`, `best_of`, `gpu_device`, `processors`, `word_timestamps`, `max_segment_length`, `split_on_word`, `diarize`, `vad_model`, `offset_t`, `duration`.
- Tham số mới trong `generate_subtitles`: `temperature`, `prompt`, `beam_size`, `best_of`, `diarize`, `vad_model`.
- Tái cấu trúc `spawnDetached` — tất cả flag chất lượng giờ được áp dụng trong chế độ nền/đợt.
- Cập nhật `runSrtPass` để chấp nhận `extraOpts`.
- Sửa đầu ra đợt — `readBatchProgress` giờ di chuyển đầu ra tạm thời đến đích cuối cùng trước khi xác nhận (nguyên nhân gốc của tất cả kết quả "thất bại" trong đợt).

**Lưu ý tương thích flag:** `gpu_device` / `-g` được thêm trong whisper.cpp v1.8.4. Tệp nhị phân Vulkan đã biên dịch sẵn trong các bản phát hành là thế hệ v1.8.3 — tham số này được công cụ chấp nhận nhưng sẽ không có hiệu lực cho đến khi người dùng cập nhật lên tệp nhị phân v1.8.4+.

**Flag hợp lệ đã xác nhận trong tệp nhị phân hiện tại (thế hệ v1.8.3):**
`--max-context`, `--no-speech-thold`, `--processors`, `--offset-t`, `--duration`, `--best-of`, `--beam-size`, `--diarize`, `--tinydiarize`, `--temperature`, `--prompt`, flag VAD.

**Không có trong tệp nhị phân hiện tại:** `--no-context` (dùng `--max-context 0`), `--condition-on-previous-text` (chỉ là tên Python API), `--gpu-device` / `-g` (v1.8.4+).

---

## Lỗi nghiêm trọng — Tự động tiến đợt (đã xác nhận, chờ sửa)

### Đợt không tự động tiến khi không có polling tích cực

`start_batch` không tự chủ tiến queue giữa các tệp. Đợt chỉ tiến khi `check_batch_progress` được gọi. Không có polling, đợt dừng vô thời hạn sau mỗi tệp — whisper-cli.exe thoát, không có tiến trình mới được tạo, queue không tiến.

Điều này phá vỡ mục tiêu thiết kế cốt lõi là xử lý hàng loạt qua đêm không giám sát, và trực tiếp vi phạm nguyên tắc thiết kế giảm thiểu lệnh gọi Claude API. Một đợt 95 tệp clip ngắn yêu cầu khoảng 200 lệnh gọi polling trong 100 phút để hoàn thành.

**Nguyên nhân gốc:** `readBatchProgress` chứa tất cả logic tiến queue. Nó chỉ thực thi khi `check_batch_progress` được gọi rõ ràng. Không có bộ đếm thời gian nền, trình theo dõi tệp hay vòng lặp tự chủ.

**Sửa đã lên kế hoạch — Tùy chọn B (exit callback, mạnh mẽ khuyến nghị):** Gắn handler `on('exit')` vào tiến trình con whisper-cli đã tạo. Khi tiến trình thoát, ngay lập tức gọi logic tiến để xác nhận đầu ra và tạo tác vụ tiếp theo. Dựa trên sự kiện, kích hoạt chính xác một lần mỗi lần hoàn thành tệp, không tốn chi phí polling và API.

**Tùy chọn A (chỉ dự phòng):** `setInterval` nền với khoảng polling dựa trên thời lượng được suy ra từ dữ liệu thời lượng FFprobe đã có trong JSON trạng thái đợt. Kích thước tệp không phải là đại diện đáng tin cậy cho thời lượng.

**Ràng buộc bổ sung:** Bản sửa không được tạo whisper-cli.exe thứ hai khi đã có một tiến trình đang chạy — khóa tiến trình phải được tôn trọng trong đường dẫn tự động tiến.

**Giải pháp tạm thời (hiện tại):** Gọi `check_batch_progress` lặp lại cho đến khi đợt hoàn thành. Cần khoảng một lần polling mỗi tệp.

---

## Đã lên kế hoạch — Kiến trúc quyền riêng tư (trước khi chuyển đổi Bun)

Những thay đổi này phải được phát hành trước khi chuyển đổi Bun và trước bất kỳ thay đổi giấy phép nào tạo điều kiện cho việc áp dụng thương mại hoặc doanh nghiệp. Phát hành công cụ cấp doanh nghiệp mà không có các biện pháp bảo vệ tuân thủ đã được giải quyết tạo ra trách nhiệm pháp lý cho người dùng trong các ngành được quản lý.

### Biến môi trường `WHISPER_PRIVACY_MODE`
Công cụ hiện đảm bảo không có **âm thanh** nào rời khỏi máy. Nó không mở rộng đảm bảo này cho **văn bản phiên âm** — khi nội dung phiên âm được trả về trong phản hồi công cụ, văn bản đó được xử lý bởi API của Claude và rời khỏi môi trường cục bộ.

Khoảng cách này vô hình với người dùng hợp lý hiểu "không có dữ liệu nào rời khỏi máy" bao gồm tất cả nội dung được tạo ra từ âm thanh của họ.

Thêm `WHISPER_PRIVACY_MODE` như biến môi trường trong `claude_desktop_config.json`. Khi được bật:
- Tất cả phản hồi công cụ chỉ trả về siêu dữ liệu: tên tệp, thời lượng, số từ, trạng thái hoàn thành
- Không có văn bản phiên âm nào được bao gồm trong bất kỳ phản hồi công cụ nào
- Claude không thể đọc, phân tích hoặc chuyển tiếp nội dung phiên âm dưới bất kỳ hình thức nào
- Bản phiên âm chỉ tồn tại dưới dạng tệp `.txt` cục bộ

Đây là giải pháp đúng cho triển khai y tế, pháp lý, tài chính và doanh nghiệp. Không lệnh gọi API, không truyền dữ liệu, không rủi ro tuân thủ.

### Cổng đồng ý cho nội dung phiên âm
Khi `WHISPER_PRIVACY_MODE` không được bật (mặc định), bất kỳ phản hồi công cụ nào bao gồm văn bản phiên âm phải có thông báo tiết lộ ở lần sử dụng đầu tiên trong mỗi phiên. Thông báo tiết lộ phải truyền đạt rõ ràng rằng văn bản phiên âm được truyền đến API của Anthropic, rằng điều này nằm ngoài đảm bảo "không có dữ liệu nào rời khỏi máy", và rằng người dùng xử lý nội dung được quản lý phải xác nhận nghĩa vụ tuân thủ trước khi tiếp tục.

Triển khai: biến môi trường `WHISPER_CONSENT_ACKNOWLEDGED` mặc định là `false`. Ở lần trả về phiên âm đầu tiên trong phiên, nếu chưa được xác nhận, Claude trình bày thông báo tiết lộ và yêu cầu xác nhận rõ ràng. Sau khi được xác nhận trong phiên, các bản phiên âm tiếp theo được trả về mà không cần nhắc lại.

### Tài liệu `PRIVACY.md`
Tạo `PRIVACY.md` trong thư mục gốc repo bao gồm:
- Dữ liệu luôn ở cục bộ: tệp âm thanh, video, mô hình
- Dữ liệu có thể rời khỏi cục bộ (mặc định): văn bản phiên âm trong phản hồi công cụ
- Dữ liệu không bao giờ rời khỏi cục bộ (với chế độ riêng tư): tất cả
- Hướng dẫn khung tuân thủ theo ngành (HIPAA, GDPR, đặc quyền luật sư-khách hàng, FERPA, SOX, PCI-DSS, NDA/bí mật thương mại)
- Cách cấu hình chế độ riêng tư
- Tuyên bố miễn trách nhiệm rằng tác giả công cụ không phải là cố vấn pháp lý

### Cảnh báo riêng tư trong schema công cụ
Cập nhật mô tả công cụ `ListToolsRequestSchema` để bao gồm ghi chú riêng tư trên bất kỳ công cụ nào trả về văn bản phiên âm. Điều này hiển thị trong mô tả công cụ của Claude Desktop và tạo nhận thức tại điểm sử dụng.

### Tự động dọn dẹp thư mục tạm thời
`%TEMP%\whisper-mcp-jobs\` tích lũy tệp trạng thái tác vụ và nhật ký theo thời gian. Thêm tự động dọn dẹp tệp tác vụ hoàn thành sau khoảng thời gian lưu giữ có thể cấu hình (mặc định: 7 ngày). Hiện tại yêu cầu người dùng chạy `Remove-Item` thủ công.

---

## Đã lên kế hoạch — Chuyển đổi Bun

Chuyển đổi runtime từ Node.js sang [Bun](https://bun.sh) sau khi kiến trúc quyền riêng tư hoàn thành và trước khi thêm tính năng v2.3.0.

Vì Claude Desktop tạo máy chủ MCP mới khi khởi động mỗi phiên, thời gian khởi động nằm trên đường dẫn quan trọng. Bun chạy TypeScript gốc không cần bước biên dịch, khởi động nhanh hơn đáng kể so với Node và có I/O nhanh hơn.

**Những gì thay đổi:**
- Loại bỏ bước build `tsc` và thư mục `dist/`
- Người dùng chạy trực tiếp source TypeScript
- `tsconfig.json` trở thành tùy chọn
- Cập nhật script `package.json`
- Cập nhật quy trình publish npm

**Những gì không thay đổi:**
- Source code `src/index.ts` — Bun tương thích với TypeScript hiện có và API tích hợp sẵn của Node.js
- Tất cả hành vi công cụ và định dạng đầu ra
- Cấu hình Claude Desktop cho người dùng cuối

**Tại sao sau riêng tư, trước v2.3.0:** Codebase ở trạng thái dễ chuyển đổi nhất ngay bây giờ. Chuyển đổi sau khi thêm công cụ chỉ tăng khối lượng công việc mà không có lợi ích. Kiến trúc quyền riêng tư phải ra mắt trước như đã lưu ý ở trên.

---

## Đã lên kế hoạch — Xem xét giấy phép (sau khi chuyển đổi Bun)

Giấy phép MIT hiện tại cho phép sử dụng thương mại không giới hạn. Trước khi công cụ tiếp cận thị trường chuyên nghiệp và doanh nghiệp ở quy mô lớn, tình huống giấy phép phải được đánh giá.

**Phương pháp đã lên kế hoạch — Giấy phép kép:**
- MIT cho sử dụng cá nhân và phi thương mại (không thay đổi cho người dùng hiện tại)
- Giấy phép thương mại riêng cho sử dụng kinh doanh và doanh nghiệp
- Thời điểm chuyển đổi: bản phát hành chính tiếp theo sau khi chuyển đổi Bun

**Tại sao không phải bây giờ:** Thay đổi giấy phép trước khi kiến trúc quyền riêng tư hoàn thành có nghĩa là bán giấy phép thương mại cho công cụ có khoảng cách tuân thủ HIPAA/GDPR chưa được giải quyết. Quyền riêng tư ra mắt trước. Xem xét giấy phép theo sau.

Giấy phép thương mại, cảnh báo riêng tư trong schema công cụ và `PRIVACY.md` cùng nhau tạo thành câu chuyện tuân thủ tối thiểu khả thi cho người mua doanh nghiệp.

---

## Đã lên kế hoạch — v2.3.0: Mở rộng định dạng đầu ra

### Định dạng phụ đề VTT
Đầu ra WebVTT (`.vtt`) cùng với SRT. VTT là tiêu chuẩn web được YouTube, HTML5 `<video>` và hầu hết các trình phát hiện đại sử dụng. whisper-cli hỗ trợ gốc. Thêm `vtt` như định dạng đầu ra hợp lệ trong `transcribe_audio`, `generate_subtitles` và `spawnDetached`. Cập nhật `buildArgs` và tất cả schema công cụ liên quan, README và tài liệu đa ngôn ngữ.

### Định dạng LRC
Đầu ra định dạng LRC (`.lrc`) lời bài hát/karaoke qua `-olrc`. Được dùng bởi các trình phát phương tiện để hiển thị lời bài hát đồng bộ. Chi phí triển khai bằng không — flag CLI gốc.

### Định dạng CSV
Đầu ra CSV (`.csv`) qua `-ocsv`. Dữ liệu bảng có cấu trúc với thời gian đoạn — hữu ích cho phân tích downstream, quy trình căn chỉnh clip và nhập vào công cụ bảng tính. Chi phí triển khai bằng không — flag CLI gốc.

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

**Triển khai:** Cần [pyannote-audio](https://github.com/pyannote/pyannote-audio) — thư viện dựa trên Python với yêu cầu token truy cập mô hình Hugging Face. Stack phụ thuộc hoàn toàn riêng biệt so với pipeline whisper.cpp.

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

## Phân phối

Có sẵn trên [npm](https://www.npmjs.com/package/whisper-windows-mcp), [mcpservers.org](https://mcpservers.org) và [Glama](https://glama.ai).

---

## Tài liệu đa ngôn ngữ

Tài liệu tiếng Nhật, tiếng Hàn và tiếng Việt được duy trì song song với tiếng Anh. Các tệp sau phải được cập nhật để khớp với tài liệu tiếng Anh sau mỗi bản phát hành:

**Tiếng Nhật (`*.ja.md`)** — `README.ja.md` / `TROUBLESHOOTING.ja.md` / `ROADMAP.ja.md` / `PRIVACY.ja.md` / `SECURITY.ja.md`

**Tiếng Hàn (`*.ko.md`)** — `README.ko.md` / `TROUBLESHOOTING.ko.md` / `ROADMAP.ko.md` / `PRIVACY.ko.md` / `SECURITY.ko.md`

**Tiếng Việt (`*.vi.md`)** — `README.vi.md` / `TROUBLESHOOTING.vi.md` / `ROADMAP.vi.md` / `PRIVACY.vi.md` / `SECURITY.vi.md`

**Tiếng Indonesia (`*.id.md`)** — `README.id.md` / `TROUBLESHOOTING.id.md` / `ROADMAP.id.md` / `PRIVACY.id.md` / `SECURITY.id.md`

**Tiếng Ukraina (`*.uk.md`)** — `README.uk.md` / `TROUBLESHOOTING.uk.md` / `ROADMAP.uk.md` / `PRIVACY.uk.md` / `SECURITY.uk.md`

**Tiếng Bồ Đào Nha Brazil (`*.pt-BR.md`)** — `README.pt-BR.md` / `TROUBLESHOOTING.pt-BR.md` / `ROADMAP.pt-BR.md` / `PRIVACY.pt-BR.md` / `SECURITY.pt-BR.md`

**Tiếng Tây Ban Nha (`*.es.md`)** — `README.es.md` / `TROUBLESHOOTING.es.md` / `ROADMAP.es.md` / `PRIVACY.es.md` / `SECURITY.es.md`

Chào mừng đóng góp cộng đồng cho các ngôn ngữ khác.

---

## Đóng góp

Chào mừng pull request. Kiểm tra các issue hiện có trước khi bắt đầu làm việc.

Nếu bạn đã thử nghiệm tăng tốc GPU trên phần cứng không được liệt kê ở trên, vui lòng mở issue với mô hình GPU, VRAM, kích thước mô hình và thông lượng quan sát được. Điều này giúp xây dựng tài liệu tham khảo hiệu suất chính xác cho người dùng khác.
