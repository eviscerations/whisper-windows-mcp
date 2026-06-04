# Kiến trúc quyền riêng tư — whisper-windows-mcp

Tài liệu này mô tả dữ liệu nào ở lại máy của bạn, dữ liệu nào rời khỏi máy và cách cấu hình công cụ cho nội dung được quản lý hoặc nhạy cảm.

---

## Đảm bảo cốt lõi

whisper-windows-mcp được xây dựng trên kiến trúc ưu tiên cục bộ. **Tệp âm thanh và video không bao giờ rời khỏi máy của bạn.** Phiên âm chạy hoàn toàn trên phần cứng của bạn bằng whisper.cpp — không có dịch vụ đám mây, không cần kết nối internet, không có lệnh gọi API nào liên quan đến bản thân việc phiên âm.

Đảm bảo này áp dụng vô điều kiện cho tệp phương tiện.

---

## Dữ liệu luôn ở lại cục bộ

| Dữ liệu | Rời khỏi máy? |
|---|---|
| Tệp âm thanh | ❌ Không bao giờ |
| Tệp video | ❌ Không bao giờ |
| Tệp mô hình Whisper | ❌ Không bao giờ |
| Tệp WAV chuyển đổi tạm thời | ❌ Không bao giờ (xóa sau khi phiên âm) |
| Tệp trạng thái đợt và tác vụ | ❌ Không bao giờ |
| Tệp phiên âm `.txt` / `.srt` / `.vtt` trên đĩa | ❌ Không bao giờ |

---

## Dữ liệu có thể rời khỏi máy (chế độ tiêu chuẩn)

Khi phản hồi công cụ bao gồm văn bản phiên âm, văn bản đó được trả về cho Claude Desktop và được xử lý bởi API của Anthropic. Đây là hành vi MCP tiêu chuẩn — văn bản di chuyển từ máy chủ MCP cục bộ đến mô hình của Claude qua mạng.

| Dữ liệu | Rời khỏi máy? |
|---|---|
| Văn bản phiên âm trả về nội tuyến trong phản hồi công cụ | ✅ Có, ở chế độ tiêu chuẩn |
| Văn bản phiên âm tải lên trực tiếp cho Claude dưới dạng tệp | ✅ Có (ngoài MCP — không áp dụng kiểm soát quyền riêng tư) |

Khoảng cách này tồn tại giữa đảm bảo "không có dữ liệu nào rời khỏi máy" của công cụ và hành vi thực tế khi bạn yêu cầu Claude đọc, tóm tắt hoặc phân tích bản phiên âm. Hầu hết người dùng — những người phiên âm nội dung công khai như video YouTube, podcast hoặc bản ghi phát trực tuyến — không bị ảnh hưởng bởi sự phân biệt này.

Đối với người dùng xử lý bản ghi riêng tư, bí mật hoặc được quản lý, sự phân biệt này quan trọng.

---

## Chế độ quyền riêng tư

`WHISPER_PRIVACY_MODE` giới hạn tất cả phản hồi công cụ chỉ có siêu dữ liệu. Khi được bật:

- Tất cả phản hồi công cụ chỉ trả về: tên tệp, số từ, đường dẫn lưu, trạng thái hoàn thành
- Không có văn bản phiên âm nào được bao gồm trong bất kỳ phản hồi công cụ nào
- Claude không thể đọc, phân tích hoặc chuyển tiếp nội dung phiên âm dưới bất kỳ hình thức nào
- Bản phiên âm chỉ tồn tại dưới dạng tệp cục bộ trên đĩa

Chế độ này được thiết kế cho triển khai pháp lý, y tế, tài chính và doanh nghiệp nơi nội dung phiên âm không được rời khỏi môi trường cục bộ trong bất kỳ trường hợp nào.

### Bật toàn cục (biến môi trường)

Đặt trong `claude_desktop_config.json`:

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

Yêu cầu khởi động lại Claude Desktop để có hiệu lực.

### Bật theo từng lệnh gọi (không cần khởi động lại)

Truyền `privacy_mode=true` trực tiếp vào bất kỳ công cụ phiên âm nào:

- *"Phiên âm tệp này ở chế độ quyền riêng tư"*
- *"Bắt đầu đợt trên thư mục này, privacy_mode=true"*
- *"Kiểm tra tiến trình job_123, privacy_mode=true"*

Tham số theo từng lệnh gọi ghi đè biến môi trường toàn cục theo cả hai hướng. Truyền `privacy_mode=false` để tắt cho một lệnh gọi duy nhất ngay cả khi `WHISPER_PRIVACY_MODE=true` được đặt toàn cục.

### Hành vi cổng chế độ quyền riêng tư

Khi chế độ quyền riêng tư đang hoạt động, một xác nhận công khai được hiển thị **trước mỗi thao tác**. Điều này là có chủ ý — tuân thủ quy định yêu cầu sự đồng ý có hiểu biết trước mỗi sự kiện xử lý, không chỉ một lần mỗi phiên.

Văn bản công khai giống nhau mỗi lần theo thiết kế. Sự lặp lại mới là điểm mấu chốt: nếu bạn đang xử lý nội dung nhạy cảm, bạn phải xác nhận rõ ràng từng thao tác.

Đối với `start_batch` với chế độ quyền riêng tư: cần một xác nhận trước khi đợt bắt đầu. Tất cả tệp sau đó được xử lý không giám sát. Không có văn bản phiên âm nào được trả về ở bất kỳ thời điểm nào — chỉ có siêu dữ liệu tiến trình đợt.

---

## Cổng đồng ý (chế độ tiêu chuẩn)

Khi chế độ quyền riêng tư không hoạt động, một công khai phiên một lần được hiển thị trước khi văn bản phiên âm được trả về cho API của Claude lần đầu tiên trong một phiên.

Công khai bao gồm:
- Rằng văn bản phiên âm sẽ được truyền đến API của Anthropic
- Các khung quy định có thể áp dụng cho nội dung của bạn
- Cách bật chế độ quyền riêng tư nếu cần
- Cách bỏ qua vĩnh viễn cổng cho nội dung không nhạy cảm

Sau khi bạn xác nhận, cổng không kích hoạt lại cho phần còn lại của phiên. Khởi động lại Claude Desktop đặt lại phiên và cổng kích hoạt lại vào lần gọi trả về phiên âm tiếp theo.

**Đối với tác vụ nền:** Cổng đồng ý kích hoạt khi hoàn thành `check_progress`, không phải khi gọi `transcribe_audio`. Tại thời điểm gọi, chưa có văn bản phiên âm nào tồn tại — cổng kích hoạt ngay khi văn bản phiên âm lần đầu tiên được trả về cho API.

### Bỏ qua cổng vĩnh viễn

Nếu bạn thường xuyên phiên âm nội dung không nhạy cảm và không cần nhắc nhở nữa, hãy đặt trong cấu hình của bạn:

```json
"WHISPER_CONSENT_ACKNOWLEDGED": "true"
```

Không có hiệu lực khi chế độ quyền riêng tư đang hoạt động. Chế độ quyền riêng tư sử dụng cổng theo từng thao tác riêng của nó luôn kích hoạt bất kể cài đặt này.

---

## Tóm tắt luồng dữ liệu

| Chế độ | Âm thanh | Văn bản phiên âm | Cần xác nhận |
|---|---|---|---|
| Tiêu chuẩn | Chỉ cục bộ | Gửi đến Anthropic API | Một lần mỗi phiên (cổng đồng ý) |
| Chế độ quyền riêng tư (biến môi trường) | Chỉ cục bộ | Không bao giờ truyền | Trước mỗi thao tác |
| Chế độ quyền riêng tư (theo lệnh gọi) | Chỉ cục bộ | Không truyền cho lệnh gọi này | Trước thao tác này |
| `WHISPER_CONSENT_ACKNOWLEDGED=true` | Chỉ cục bộ | Gửi đến Anthropic API | Không bao giờ (bỏ qua) |

---

## Tải tệp phiên âm trực tiếp lên Claude

Khi bạn tải tệp `.txt` phiên âm trực tiếp lên Claude dưới dạng tệp đính kèm — hoàn toàn bên ngoài công cụ MCP — máy chủ MCP không có khả năng hiển thị và không thể áp dụng bất kỳ kiểm soát quyền riêng tư nào.

Tải bản phiên âm trực tiếp lên Claude tương đương với việc gửi nội dung âm thanh cho Anthropic. Chế độ quyền riêng tư và tất cả bảo vệ cấp MCP bị bỏ qua hoàn toàn bởi việc tải tệp trực tiếp.

Người dùng xử lý nội dung được quản lý không được tải bản phiên âm trực tiếp lên Claude. Con đường phân tích an toàn duy nhất cho nội dung được quản lý là các công cụ xử lý cục bộ không truyền nội dung ra ngoài.

---

## Hướng dẫn cho ngành được quản lý

Thông tin dưới đây chỉ mang tính chất thông tin chung. Tác giả của công cụ này không phải là luật sư. Người dùng chịu trách nhiệm duy nhất về việc tuân thủ các luật và quy định hiện hành. Khi có nghi ngờ, hãy tham khảo ý kiến luật sư có trình độ trước khi phiên âm nội dung được quản lý.

### HIPAA (Hoa Kỳ — chăm sóc sức khỏe)
Các nhà cung cấp dịch vụ y tế, công ty bảo hiểm và các cộng sự kinh doanh của họ bị cấm truyền Thông tin Sức khỏe Được Bảo vệ (PHI) cho các bên thứ ba không được phép mà không có Thỏa thuận Cộng tác Kinh doanh (BAA). Anthropic không cung cấp HIPAA BAA cho việc sử dụng API người tiêu dùng Claude.

**Các trường hợp sử dụng bị ảnh hưởng:** Tư vấn bệnh nhân, ghi chú lâm sàng, buổi trị liệu, cuộc gọi yêu cầu bảo hiểm, bản ghi hành chính bệnh viện.

**Khuyến nghị:** Bật `WHISPER_PRIVACY_MODE=true` trước khi phiên âm bất kỳ âm thanh bệnh nhân nào. Không tắt nó giữa phiên.

### GDPR (EU/EEA)
Dữ liệu cá nhân của cư dân EU không thể được chuyển cho các bộ xử lý bên thứ ba mà không có sự đồng ý rõ ràng và cơ sở pháp lý để xử lý. Văn bản phiên âm chứa tên, địa điểm hoặc bất kỳ thông tin nhận dạng nào cấu thành dữ liệu cá nhân theo GDPR.

**Các trường hợp sử dụng bị ảnh hưởng:** Phỏng vấn, cuộc họp, bản ghi trung tâm cuộc gọi, thủ tục tòa án liên quan đến cư dân EU.

**Khuyến nghị:** Bật chế độ quyền riêng tư cho bất kỳ bản ghi nào có thể chứa dữ liệu cá nhân của cư dân EU/EEA.

### Đặc quyền luật sư-khách hàng (Hoa Kỳ, Anh, Úc và hầu hết các thẩm quyền thông luật)
Thông tin liên lạc giữa luật sư và khách hàng được bảo vệ pháp lý. Tiết lộ cho bên thứ ba không được phép có thể làm mất đặc quyền. Không có tiền lệ pháp lý được thiết lập bảo vệ thông tin liên lạc luật sư-khách hàng khi được xử lý bởi API AI thương mại.

**Các trường hợp sử dụng bị ảnh hưởng:** Lời khai pháp lý, tư vấn khách hàng, bản ghi chiến lược nội bộ, phỏng vấn nhân chứng.

**Khuyến nghị:** Luật sư phiên âm thông tin liên lạc có đặc quyền nên bật chế độ quyền riêng tư. Không tắt nó để phân tích — hãy sử dụng trình soạn thảo văn bản hoặc công cụ xử lý cục bộ cho nội dung có đặc quyền.

### FERPA (Hoa Kỳ — giáo dục)
Hồ sơ giáo dục của học sinh được bảo vệ. Các trường học và đại học không thể tiết lộ thông tin học sinh có thể nhận dạng cho bên thứ ba mà không có sự đồng ý.

**Các trường hợp sử dụng bị ảnh hưởng:** Bài giảng được ghi lại, buổi tư vấn học sinh, phiên điều trần học thuật, cuộc họp IEP.

### SOX (Hoa Kỳ — công ty đại chúng)
Thông tin liên lạc tài chính của các công ty đại chúng phải tuân theo các yêu cầu lưu giữ hồ sơ và bảo mật. Thông tin quan trọng không công khai (MNPI) không thể được tiết lộ có chọn lọc.

**Các trường hợp sử dụng bị ảnh hưởng:** Bản ghi cuộc họp kết quả kinh doanh, biên bản cuộc họp hội đồng quản trị, thông tin liên lạc với nhà đầu tư, thảo luận chiến lược tài chính nội bộ.

### PCI-DSS
Dữ liệu thẻ thanh toán không thể được lưu trữ hoặc truyền trong môi trường không an toàn. Bản ghi âm thanh số thẻ trong giao dịch nằm trong phạm vi.

**Các trường hợp sử dụng bị ảnh hưởng:** Bản ghi trung tâm cuộc gọi, cuộc gọi dịch vụ khách hàng liên quan đến xử lý thanh toán.

### Bảo mật bí mật thương mại / NDA
Thông tin kinh doanh bí mật, công thức độc quyền, chi tiết sản phẩm chưa phát hành và thông tin nhân sự có thể được bảo vệ theo hợp đồng hoặc pháp luật.

**Các trường hợp sử dụng bị ảnh hưởng:** Cuộc họp chiến lược doanh nghiệp, thảo luận R&D, cuộc gọi thẩm định M&A, thủ tục nhân sự.

---

## Báo cáo lo ngại về quyền riêng tư

Nếu bạn xác định vấn đề quyền riêng tư hoặc khoảng cách kiến trúc không được đề cập ở đây, vui lòng sử dụng báo cáo lỗ hổng riêng tư của GitHub thay vì mở issue công khai. Xem [SECURITY.md](SECURITY.md) để biết hướng dẫn báo cáo.
