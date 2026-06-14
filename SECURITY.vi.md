# Chính sách bảo mật

## Phạm vi

whisper-windows-mcp là công cụ ưu tiên cục bộ. Tất cả xử lý âm thanh xảy ra trên máy của bạn — không có âm thanh, tệp video hay dữ liệu cá nhân nào được truyền đến bất kỳ máy chủ nào. Bề mặt tấn công được giới hạn ở:

- Hệ thống tệp cục bộ (đường dẫn tệp được truyền cho công cụ)
- Tệp nhị phân whisper-cli.exe và các phụ thuộc của nó
- Kết nối Claude Desktop MCP (chỉ IPC cục bộ)
- Văn bản phiên âm được trả về trong phản hồi công cụ (xem Kiến trúc quyền riêng tư bên dưới)

## Kiến trúc quyền riêng tư

**Tệp âm thanh không bao giờ rời khỏi máy của bạn.** Đảm bảo này là vô điều kiện.

**Văn bản phiên âm có thể rời khỏi máy của bạn ở chế độ tiêu chuẩn.** Khi phản hồi công cụ bao gồm văn bản phiên âm, văn bản đó được xử lý bởi API của Claude. Đây là hành vi MCP tiêu chuẩn nhưng tạo ra khoảng cách giữa triết lý thiết kế "ưu tiên cục bộ" của công cụ và luồng dữ liệu thực tế đối với người dùng xử lý nội dung được quản lý hoặc bí mật.

**Chế độ quyền riêng tư** (`WHISPER_PRIVACY_MODE=true` hoặc `privacy_mode=true` theo từng lệnh gọi) giới hạn tất cả phản hồi công cụ chỉ có siêu dữ liệu — không có văn bản phiên âm nào được trả về cho API của Claude. Đây là cấu hình chính xác cho triển khai y tế, pháp lý, tài chính và doanh nghiệp.

**Cổng chế độ quyền riêng tư:** Khi chế độ quyền riêng tư đang hoạt động, một xác nhận công khai rõ ràng được hiển thị trước mỗi thao tác phiên âm. Điều này là có chủ ý và không thể bỏ qua — tuân thủ quy định yêu cầu sự đồng ý có hiểu biết theo từng thao tác.

**Cổng đồng ý:** Ở chế độ tiêu chuẩn, một công khai phiên một lần được hiển thị trước khi văn bản phiên âm được trả về cho API lần đầu tiên trong một phiên. Đặt `WHISPER_CONSENT_ACKNOWLEDGED=true` trong cấu hình của bạn để bỏ qua điều này cho nội dung không nhạy cảm.

Xem [PRIVACY.md](PRIVACY.md) để biết mô tả kiến trúc quyền riêng tư đầy đủ, hướng dẫn khung tuân thủ (HIPAA, GDPR, đặc quyền luật sư-khách hàng, FERPA, SOX, PCI-DSS) và hướng dẫn cấu hình.

## Xác minh tệp nhị phân

Để xác minh tính toàn vẹn của tệp nhị phân `whisper-cli.exe` trong bản phát hành đã biên dịch sẵn, hãy kiểm tra hash SHA256 trong PowerShell:

```powershell
Get-FileHash "C:\whisper\Release\whisper-cli.exe" -Algorithm SHA256
```

Hash dự kiến cho mỗi tệp nhị phân phát hành được công bố trên [trang phát hành](https://github.com/eviscerations/whisper-windows-mcp/releases). Không sử dụng tệp nhị phân có hash không khớp.

## Phiên bản được hỗ trợ

Các bản sửa lỗi bảo mật chỉ được áp dụng cho phiên bản đã phát hành mới nhất.

| Phiên bản | Được hỗ trợ |
|---|---|
| 2.x (mới nhất) | ✅ |
| 1.x | ❌ |

## Báo cáo lỗ hổng

**Không mở issue công khai cho lỗ hổng bảo mật.**

Sử dụng báo cáo lỗ hổng riêng tư của GitHub:
1. Đi đến [tab Bảo mật](https://github.com/eviscerations/whisper-windows-mcp/security)
2. Nhấp vào "Report a vulnerability"
3. Mô tả vấn đề với đủ chi tiết để tái hiện

Bạn sẽ nhận được phản hồi trong vòng 7 ngày. Nếu lỗ hổng được xác nhận, bản sửa lỗi sẽ được phát hành sớm nhất có thể và bạn sẽ được ghi nhận trong ghi chú phát hành nếu bạn muốn.

## Sandbox và phê duyệt

whisper-windows-mcp là một **công cụ cục bộ, đơn người dùng, được điều khiển bởi chủ sở hữu máy thông qua Claude Desktop.** Mô hình mối đe dọa của nó là chủ sở hữu chạy nó trên chính máy của họ — không phải một triển khai không đáng tin cậy, đa người thuê hay phơi bày ra mạng.

- **Sandbox:** không có, theo thiết kế. `whisper-cli.exe` chạy ở mức quyền của chính chủ sở hữu, giống như bất kỳ máy chủ MCP cục bộ nào. Biện pháp giảm thiểu ở đây không phải là cô lập ở cấp HĐH mà là phạm vi sử dụng — **không để lộ máy chủ này cho truy cập mạng không đáng tin cậy** (xem "Tiêm nhiễm đường dẫn tệp" bên dưới).
- **Phê duyệt theo từng lớp, không dựa trên sandbox:**
  1. **Phê duyệt của host** — lớp MCP của Claude Desktop kiểm soát việc gọi công cụ.
  2. **Cổng đồng ý / quyền riêng tư** — cần có xác nhận rõ ràng trước khi bất kỳ văn bản phiên âm nào rời khỏi máy để đến API của Claude; `WHISPER_PRIVACY_MODE` / `privacy_mode` theo từng lệnh gọi chỉ trả về siêu dữ liệu cho nội dung được quản lý. Cổng được khóa theo từng thao tác (công cụ + đối số). Xem [PRIVACY.md](PRIVACY.md).
  3. **Xác thực đầu vào** — các đường dẫn duyệt thư mục và UNC bị từ chối; `switch_model` được giới hạn trong thư mục mô hình đã cấu hình; `download_model` bị giới hạn trong danh sách cho phép các namespace Hugging Face đáng tin cậy.

Công cụ này **không** được thiết kế để được điều khiển bởi một tác nhân không đáng tin cậy hoặc chạy như cơ sở hạ tầng dùng chung. Tư thế đó sẽ đòi hỏi sandbox HĐH/container và một chính sách lưu lượng đi ra — nằm ngoài phạm vi của một công cụ phiên âm cục bộ đơn người dùng.

## Các quyết định thiết kế đã biết

- **Tiêm nhiễm đường dẫn tệp:** Công cụ chấp nhận đường dẫn tệp tuyệt đối từ Claude. Đây là thiết kế có chủ ý — công cụ được thiết kế để được sử dụng với Claude Desktop bởi chủ sở hữu máy. Không để lộ máy chủ MCP này cho truy cập mạng không đáng tin cậy.
- **Không có sandbox:** whisper-cli.exe chạy với cùng quyền hạn như Claude Desktop. Đây là hành vi tiêu chuẩn cho công cụ MCP cục bộ.
- **Tệp tạm thời:** Tệp WAV trung gian được ghi vào `%TEMP%\whisper_tmp_*.wav` và xóa sau khi phiên âm. Tệp trạng thái tác vụ được ghi vào `%TEMP%\whisper-mcp-jobs\` và tự động dọn dẹp sau 7 ngày khi khởi động máy chủ.
- **Nội dung phiên âm:** Văn bản phiên âm được trả về trong phản hồi công cụ được xử lý bởi API của Claude ở chế độ tiêu chuẩn. Để ngăn điều này, hãy bật `WHISPER_PRIVACY_MODE=true` hoặc truyền `privacy_mode=true` theo từng lệnh gọi. Xem [PRIVACY.md](PRIVACY.md).
- **Tiêm nhiễm phiên âm:** Tệp âm thanh có thể chứa nội dung khi phiên âm trông giống như hướng dẫn. Các biện pháp phòng thủ tích hợp của Claude xử lý điều này. Chính máy chủ MCP đánh dấu tất cả nội dung phiên âm là dữ liệu không đáng tin cậy và không bao giờ diễn giải nó là hướng dẫn.
- **Tải xuống mô hình bị hạn chế:** Công cụ `download_model` chỉ tải xuống từ hai namespace Hugging Face đáng tin cậy (`ggerganov/whisper.cpp` và `ggml-org`). Chuyển hướng được xác thực dựa trên danh sách cho phép trước khi tuân theo. URL tùy ý bị từ chối ở cấp mã. Các lượt tải bị cắt cụt/không hoàn chỉnh bị từ chối (kiểm tra Content-Length) trước khi tệp `.part` được thăng cấp thành tên mô hình.
- **Chuyển đổi mô hình được sandbox hóa:** `switch_model` chỉ chấp nhận tệp `.bin` trong thư mục mô hình đã cấu hình. Đường dẫn ngoài nó bị từ chối thông qua giới hạn đường dẫn chuẩn hóa — một thư mục có tiền tố-anh em như `…\models-evil` không thể thỏa mãn kiểm tra — bất kể đường dẫn được chỉ định như thế nào.
