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
| Tệp phiên âm `.txt` / `.srt` trên đĩa | ❌ Không bao giờ |

---

## Dữ liệu có thể rời khỏi máy (hành vi mặc định)

Khi phản hồi công cụ bao gồm văn bản phiên âm, văn bản đó được trả về cho Claude Desktop và được xử lý bởi API của Anthropic. Đây là hành vi MCP tiêu chuẩn — văn bản di chuyển từ máy chủ MCP cục bộ đến mô hình của Claude qua mạng.

| Dữ liệu | Rời khỏi máy? |
|---|---|
| Văn bản phiên âm trả về trong phản hồi công cụ | ✅ Có, theo mặc định |
| Văn bản phiên âm tải lên trực tiếp cho Claude dưới dạng tệp | ✅ Có (ngoài MCP) |

Khoảng cách này tồn tại giữa đảm bảo "không có dữ liệu nào rời khỏi máy" của công cụ và hành vi thực tế khi bạn yêu cầu Claude đọc, tóm tắt hoặc phân tích bản phiên âm. Hầu hết người dùng — những người phiên âm nội dung công khai như video YouTube, podcast hoặc bản ghi phát trực tuyến — không bị ảnh hưởng bởi sự phân biệt này.

Đối với người dùng xử lý bản ghi riêng tư, bí mật hoặc được quản lý, sự phân biệt này quan trọng.

---

## Chế độ quyền riêng tư (đang lên kế hoạch — chưa được triển khai)

Biến môi trường `WHISPER_PRIVACY_MODE` đang được lên kế hoạch cho một bản phát hành tương lai. Khi được bật:

- Tất cả phản hồi công cụ chỉ trả về siêu dữ liệu: tên tệp, thời lượng, số từ, trạng thái hoàn thành
- Không có văn bản phiên âm nào được bao gồm trong bất kỳ phản hồi công cụ nào
- Claude không thể đọc, phân tích hoặc chuyển tiếp nội dung phiên âm dưới bất kỳ hình thức nào
- Bản phiên âm chỉ tồn tại dưới dạng tệp `.txt` cục bộ trên đĩa

Chế độ này được thiết kế cho triển khai pháp lý, y tế, tài chính và doanh nghiệp nơi nội dung phiên âm không được rời khỏi môi trường cục bộ trong bất kỳ trường hợp nào.

**Cấu hình đã lên kế hoạch:**

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

Cho đến khi tính năng này ra mắt: nếu bạn cần phân tích nội dung phiên âm mà không truyền đến API của Claude, hãy mở tệp `.txt` trực tiếp trong trình soạn thảo văn bản hoặc công cụ xử lý cục bộ.

---

## Hướng dẫn cho ngành được quản lý

Thông tin dưới đây chỉ mang tính chất thông tin chung. Tác giả của công cụ này không phải là luật sư. Người dùng chịu trách nhiệm duy nhất về việc tuân thủ các luật và quy định hiện hành. Khi có nghi ngờ, hãy tham khảo ý kiến luật sư có trình độ trước khi phiên âm nội dung được quản lý.

### HIPAA (Hoa Kỳ — chăm sóc sức khỏe)
Các nhà cung cấp dịch vụ y tế, công ty bảo hiểm và các cộng sự kinh doanh của họ bị cấm truyền Thông tin Sức khỏe Được Bảo vệ (PHI) cho các bên thứ ba không được phép mà không có Thỏa thuận Cộng tác Kinh doanh (BAA). Anthropic không cung cấp HIPAA BAA cho việc sử dụng API người tiêu dùng Claude.

**Các trường hợp sử dụng bị ảnh hưởng:** Tư vấn bệnh nhân, ghi chú lâm sàng, buổi trị liệu, cuộc gọi yêu cầu bảo hiểm, bản ghi hành chính bệnh viện.

**Khuyến nghị hiện tại:** Không phiên âm âm thanh bệnh nhân rồi yêu cầu Claude tóm tắt hoặc phân tích bản phiên âm trừ khi tổ chức của bạn đã thiết lập thỏa thuận xử lý tuân thủ. Sử dụng `WHISPER_PRIVACY_MODE` khi có sẵn.

### GDPR (EU/EEA)
Dữ liệu cá nhân của cư dân EU không thể được chuyển cho các bộ xử lý bên thứ ba mà không có sự đồng ý rõ ràng và cơ sở pháp lý để xử lý. Văn bản phiên âm chứa tên, địa điểm hoặc bất kỳ thông tin nhận dạng nào cấu thành dữ liệu cá nhân theo GDPR.

**Các trường hợp sử dụng bị ảnh hưởng:** Phỏng vấn, cuộc họp, bản ghi trung tâm cuộc gọi, thủ tục tòa án liên quan đến cư dân EU.

**Khuyến nghị hiện tại:** Hãy lưu ý rằng việc tải lên bản phiên âm chứa dữ liệu cá nhân cư dân EU lên Claude có thể có tác động GDPR tùy thuộc vào vai trò và mục đích xử lý của bạn.

### Đặc quyền luật sư-khách hàng (Hoa Kỳ, Anh, Úc và hầu hết các thẩm quyền thông luật)
Thông tin liên lạc giữa luật sư và khách hàng được bảo vệ pháp lý. Tiết lộ cho bên thứ ba không được phép có thể làm mất đặc quyền. Không có tiền lệ pháp lý được thiết lập bảo vệ thông tin liên lạc luật sư-khách hàng khi được xử lý bởi API AI thương mại.

**Các trường hợp sử dụng bị ảnh hưởng:** Lời khai pháp lý, tư vấn khách hàng, bản ghi chiến lược nội bộ, phỏng vấn nhân chứng.

**Khuyến nghị hiện tại:** Luật sư phiên âm thông tin liên lạc có đặc quyền không nên tải những bản phiên âm đó lên Claude để phân tích mà không có đánh giá pháp lý độc lập về tác động đặc quyền.

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

## Tải tệp phiên âm trực tiếp lên Claude

Khi bạn tải tệp `.txt` phiên âm trực tiếp lên Claude dưới dạng tệp đính kèm — hoàn toàn bên ngoài công cụ MCP — máy chủ MCP không có khả năng hiển thị và không thể áp dụng bất kỳ kiểm soát quyền riêng tư nào.

Tải bản phiên âm trực tiếp lên Claude tương đương với việc gửi nội dung âm thanh cho Anthropic. Không có chế độ quyền riêng tư hay bảo vệ cấp MCP tương lai nào áp dụng cho việc tải tệp trực tiếp.

Người dùng xử lý nội dung được quản lý không được tải bản phiên âm trực tiếp lên Claude. Con đường phân tích an toàn duy nhất cho nội dung được quản lý là các công cụ xử lý cục bộ không truyền nội dung ra ngoài.

---

## Báo cáo lo ngại về quyền riêng tư

Nếu bạn xác định vấn đề quyền riêng tư hoặc khoảng cách kiến trúc không được đề cập ở đây, vui lòng sử dụng báo cáo lỗ hổng riêng tư của GitHub thay vì mở issue công khai. Xem [SECURITY.md](SECURITY.md) để biết hướng dẫn báo cáo.
