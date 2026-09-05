# VVV · Lõi Cốt Truyện & Ký Ức

> 🇻🇳 **Bản tiếng Việt.** Đây là bản Việt hóa toàn diện của tiện ích SillyTavern
> `vvv-story-memory-suite`. Xem [`docs/BAN-DICH.md`](docs/BAN-DICH.md) để biết
> thuật ngữ đối chiếu và **lưu ý quan trọng về tương thích dữ liệu**.

Tiện ích SillyTavern được tách độc lập trên nền **R21 fixed42**. Bản này chỉ giữ
và phát hành các năng lực cốt lõi sau:

- **0-32 · Sân Khấu Không Bao Giờ Hạ Màn**: ký ức đầy đủ, bối cảnh hiện tại,
  nhân vật/quan hệ, lời hẹn và bí mật, điện thoại, Bỉ Gian Tư Văn, đơn hàng,
  bản đồ thế giới, tuyến thế giới duy nhất…
- **Thúc đẩy / Tiếp sức cốt truyện bằng AI**: giữ nguyên phần cài đặt, đạo diễn,
  tính liền mạch, bốn giai đoạn, góc nhìn và tuyến gửi của `vvv_story_relay` gốc.
- **RAG / Memory Hub**: tiếp tục dùng `vvv-theater-memory-server` gốc, hồ sơ vĩnh
  viễn, BM25/vector/VCP và Memory Hub.
- **Hỏi đáp ngoài lề với tác giả**: tạm dừng nhập vai trong một lượt; sau khi trả
  lời xong, tin nhắn thường kế tiếp sẽ quay lại chế độ nhập vai.

## Tương thích dữ liệu

Kho mã này **cố ý không đổi** các khóa và thư mục sau, nên vẫn đọc được dữ liệu cũ:

- `vvv_theater_memory`
- `vvv_story_relay`
- `/api/plugins/vvv-theater-memory-server`
- `dataRoot/vvv/vvv-theater-memory`

Việc nâng cấp/tách bản sẽ không tự động xóa hồ sơ vĩnh viễn.

> ⚠️ **Riêng với bản Việt hóa:** tên cột trong các bảng ký ức (ví dụ `姓名` → `Họ tên`,
> `状态` → `Trạng thái`) và các giá trị trạng thái đã được dịch sang tiếng Việt. Vì vậy
> kho ký ức tạo bằng bản tiếng Trung **không đọc lại được nguyên vẹn** ở bản này, và
> ngược lại. Hãy đọc kỹ phần “Tương thích dữ liệu” trong [`docs/BAN-DICH.md`](docs/BAN-DICH.md)
> trước khi chuyển đổi giữa hai bản.

## Cài đặt / đăng ký qua GitHub

Địa chỉ kho mã:

`https://github.com/SolNg/memo-suite`

Dùng địa chỉ trên trong giao diện cài tiện ích của SillyTavern. Thư mục gốc của kho
chính là thư mục tiện ích tiêu chuẩn, `auto_update=true`.

> 📘 **Hướng dẫn cài đặt đầy đủ từng bước** (kể cả phần plugin máy chủ bắt buộc cho
> RAG/Memory Hub/API riêng): xem [`docs/CAI-DAT.md`](docs/CAI-DAT.md). Nếu bạn đang
> gặp lỗi *“Plugin phía máy chủ chưa được nạp (404)”* hoặc bấm **Lưu** mà API key
> không được giữ lại, hãy đọc tài liệu đó trước.

> **Quan trọng: đừng để bản `vvv-unified-core` cũ và bản độc lập này cùng chạy 0-32.**
> Khi phát hiện giao diện 0-00/0-32 đời cũ, bản độc lập sẽ tự dừng để tránh ghi ký ức
> hai lần trong cùng một lượt. Sau khi chuyển xong, hãy tắt hoặc gỡ giao diện 0-00 cũ
> rồi tải lại SillyTavern.

## Plugin phía máy chủ

RAG, hồ sơ vĩnh viễn, API riêng, Memory Hub… phụ thuộc vào `vvv-theater-memory-server`.
Nếu máy chủ của bạn đã cài sẵn thì cứ dùng tiếp; khi cần cập nhật bằng phiên bản trong
kho, hãy chạy lệnh sau tại thư mục kho:

```bash
bash install-server.sh /home/www/SillyTavern
```

Phía máy chủ vẫn giữ nguyên hành vi cũ, thư mục dữ liệu không đổi.

## Tự kiểm tra

```bash
bash verify.sh
```

## Những mục fixed42 được giữ lại

Bản độc lập này lấy thẳng fixed42 làm nền mã, giữ nguyên fixed39 (thế giới duy nhất),
fixed40 (bảo vệ bản lưu mới), fixed41 (sửa thứ tự sinh của lượt bình thường) và
fixed42 (sửa nguồn sự thật duy nhất cho trạng thái mạng).

## Bản sửa v1.0.1 cho đăng ký công khai

- Bỏ giới hạn chỉ khởi động với tài khoản `vvv`; mọi tài khoản SillyTavern đều tải được.
- Dữ liệu vĩnh viễn phía máy chủ vẫn được cách ly theo thư mục tài khoản, không lẫn nhau.
- Menu tiện ích có thêm lối vào cố định: 0-32 / Thúc đẩy cốt truyện / Hỏi tác giả / Memory Hub.
- Nếu phát hiện bản VVV 0-00/0-32 cũ vẫn đang chạy, tiện ích sẽ báo xung đột rõ ràng
  thay vì “đã cài nhưng không hiện gì”.
