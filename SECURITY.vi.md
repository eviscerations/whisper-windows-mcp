# Chính sách bảo mật

## Phạm vi

whisper-windows-mcp là công cụ ưu tiên cục bộ. Tất cả xử lý âm thanh xảy ra trên máy của bạn — không có âm thanh, tệp video hay dữ liệu cá nhân nào được truyền đến bất kỳ máy chủ nào. Bề mặt tấn công được giới hạn ở:

- Hệ thống tệp cục bộ (đường dẫn tệp được truyền cho công cụ)
- Tệp nhị phân whisper-cli.exe và các phụ thuộc của nó
- Kết nối Claude Desktop MCP (chỉ IPC cục bộ)
- Văn bản phiên âm được trả về trong phản hồi công cụ (xem Kiến trúc quyền riêng tư bên dưới)

## Kiến trúc quyền riêng tư

**Tệp âm thanh không bao giờ rời khỏi máy của bạn.** Đảm bảo này là vô điều kiện.

**Văn bản phiên âm có thể rời khỏi máy của bạn.** Khi phản hồi công cụ bao gồm văn bản phiên âm, văn bản đó được xử lý bởi API của Claude. Đây là hành vi MCP tiêu chuẩn nhưng tạo ra khoảng cách giữa triết lý thiết kế "ưu tiên cục bộ" của công cụ và luồng dữ liệu thực tế đối với người dùng xử lý nội dung được quản lý hoặc bí mật.

Biến môi trường `WHISPER_PRIVACY_MODE` đang được lên kế hoạch sẽ giới hạn tất cả phản hồi công cụ chỉ có siêu dữ liệu — không có văn bản phiên âm nào được trả về cho API của Claude. Đây là giải pháp dự kiến cho triển khai y tế, pháp lý, tài chính và doanh nghiệp.

Xem [PRIVACY.md](PRIVACY.md) để biết mô tả kiến trúc quyền riêng tư đầy đủ, hướng dẫn khung tuân thủ (HIPAA, GDPR, đặc quyền luật sư-khách hàng, FERPA, SOX, PCI-DSS) và hướng dẫn cấu hình.

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

## Các quyết định thiết kế đã biết

- **Tiêm nhiễm đường dẫn tệp:** Công cụ chấp nhận đường dẫn tệp tuyệt đối từ Claude. Đây là thiết kế có chủ ý — công cụ được thiết kế để được sử dụng với Claude Desktop bởi chủ sở hữu máy. Không để lộ máy chủ MCP này cho truy cập mạng không đáng tin cậy.
- **Không có sandbox:** whisper-cli.exe chạy với cùng quyền hạn như Claude Desktop. Đây là hành vi tiêu chuẩn cho công cụ MCP cục bộ.
- **Tệp tạm thời:** Tệp WAV trung gian được ghi vào `%TEMP%\whisper_tmp_*.wav` và xóa sau khi phiên âm. Tệp trạng thái tác vụ được ghi vào `%TEMP%\whisper-mcp-jobs\` và tồn tại cho đến khi xóa thủ công hoặc cho đến khi tính năng tự động dọn dẹp đã lên kế hoạch ra mắt.
- **Nội dung phiên âm:** Văn bản phiên âm được trả về trong phản hồi công cụ được xử lý bởi API của Claude. Điều này được ghi lại và sẽ có thể giải quyết thông qua `WHISPER_PRIVACY_MODE` trong bản phát hành tương lai. Xem [PRIVACY.md](PRIVACY.md).
