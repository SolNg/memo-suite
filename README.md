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

## TauriTavern trên iPhone/iPad: chỉ chạy được nửa giao diện

TauriTavern viết lại phần máy chủ bằng Rust nên **không chạy được plugin Node**. Giao diện
0-32 và việc chỉnh sửa tay vẫn dùng bình thường, nhưng mọi thứ đi qua plugin — API riêng,
RAG, hồ sơ vĩnh viễn, Memory Hub, nút “Lấy danh sách mô hình” — thì không. Không có chỗ nào
để chép plugin vào cả, vì trong app không có tiến trình Node.

Bảng điều khiển tự nhận ra và ghi **“Không thấy plugin”** ở thẻ “Phía máy chủ”. Muốn đủ
tính năng thì chạy SillyTavern thật trên máy tính/VPS rồi trỏ điện thoại vào đó — xem
[`docs/CAI-DAT.md`](docs/CAI-DAT.md).

## Hai nửa, hai cách cập nhật

- **Giao diện** (`public/scripts/extensions/third-party/memo-suite`) — trình duyệt tải lại
  là xong, nhưng iOS giữ cache rất dai nên phải xoá bộ nhớ đệm.
- **Plugin máy chủ** (`plugins/vvv-theater-memory-server`) — chạy trong tiến trình Node của
  SillyTavern, **chép tệp mới vào là chưa đủ, phải khởi động lại SillyTavern**.

Tab “API & mô hình” hiện phiên bản của cả hai; cả hai đều phải có chuỗi `vi.`. Nếu plugin
máy chủ còn là bản cũ, bảng điều khiển hiện thẳng một dòng cảnh báo đỏ thay vì để bạn
đoán — vì bản cũ chính là thứ trả về “0 mô hình” mà không kèm lý do.

## Tự kiểm tra

```bash
bash verify.sh
```

## Những mục fixed42 được giữ lại

Bản độc lập này lấy thẳng fixed42 làm nền mã, giữ nguyên fixed39 (thế giới duy nhất),
fixed40 (bảo vệ bản lưu mới), fixed41 (sửa thứ tự sinh của lượt bình thường) và
fixed42 (sửa nguồn sự thật duy nhất cho trạng thái mạng).

## Tối ưu cho điện thoại (iPhone / iPad / TauriTavern)

Bản gốc chỉ được làm cho máy tính. Bản này nhận diện thiết bị lúc chạy
(`detectDevice()` trong `index.js`: `pointer:coarse`, `hover:none`, `maxTouchPoints`,
cạnh ngắn màn hình) rồi gắn `data-vvvu-device="mobile|desktop"` lên thẻ `<html>`,
nên giao diện đổi theo thiết bị thật chứ không đoán theo bề rộng cửa sổ:

- **Chạm một lần là ăn.** Mọi quy tắc `:hover` đã được bọc trong `@media (hover:hover)`.
  Trên iOS, một quy tắc `:hover` lọt ra ngoài sẽ khiến cú chạm đầu tiên bị tính là
  "rê chuột" — đó chính là lý do trước đây phải chạm hai lần cho gần như mọi thứ.
- **Thắng được `!important` của bản gốc.** Bản gốc ghim `width:100vw; height:100dvh`
  kèm `!important` trong `@media (max-width:760px)` — đúng cỡ màn iPhone dọc. Thiếu
  `!important` thì phần tối ưu im lặng mất tác dụng ở màn dọc mà màn ngang vẫn chạy.
  `tests/standalone-integrity.mjs` giữ luôn điều kiện này để không tái phát.
- **Không co lớp phủ khi bàn phím bật lên.** Ô đang gõ bị xê dịch giữa lúc bàn phím
  trượt lên là iOS huỷ focus ngay (bàn phím nháy một cái rồi tắt). Nay lớp phủ giữ
  nguyên chiều cao và chỉ chừa thêm chỗ cuộn bằng đúng chiều cao bàn phím.
- **Không vẽ lại giữa lúc đang chạm hoặc đang gõ**, và giữ nguyên con trỏ cùng vị
  trí cuộn qua mỗi lần vẽ lại.
- **Giữ nguyên những gì đã gõ mà chưa Lưu.** Bấm dấu ✓ đóng bàn phím của iOS chính
  là bỏ focus, mà bỏ focus lại cho lần vẽ lại đang bị hoãn chạy ngay — ô nhập được
  dựng lại từ cấu hình trên máy chủ nên trước đây trắng sạch cả form.
- **Bảng điều khiển bám `visualViewport`**, không tràn ngang, không kéo qua kéo lại;
  bàn phím hiện lên thì khung co lại theo (`data-vvvu-keyboard`).
- **Ô nhập cỡ chữ 16px, vùng chạm ≥44px** để iOS không tự phóng to trang.
- **Chọn mô hình bằng nút bấm** thay cho `<datalist>` (iOS không hiện `<datalist>`).
- Lưới nhiều cột tự gộp thành một cột; máy tính giữ nguyên bố cục cũ.

Đã kiểm thử bằng Chromium thật ở đúng kích thước **iPhone 16 Pro Max (440×956, DPR 3)**,
cả dọc lẫn ngang, cùng một lượt chạy trên máy tính 1920×1080 để chắc chắn không hỏng
giao diện cũ.

## Bản sửa v1.0.1 cho đăng ký công khai

- Bỏ giới hạn chỉ khởi động với tài khoản `vvv`; mọi tài khoản SillyTavern đều tải được.
  (Bản gốc còn sót danh sách trắng ghi cứng trong plugin máy chủ nên vẫn trả HTTP 403
  `only-vvv`; bản này đã sửa hẳn — xem [`docs/CAI-DAT.md`](docs/CAI-DAT.md) mục “Tài khoản nào dùng được?”.)
- Dữ liệu vĩnh viễn phía máy chủ vẫn được cách ly theo thư mục tài khoản, không lẫn nhau.
- Menu tiện ích có thêm lối vào cố định: 0-32 / Thúc đẩy cốt truyện / Hỏi tác giả / Memory Hub.
- Nếu phát hiện bản VVV 0-00/0-32 cũ vẫn đang chạy, tiện ích sẽ báo xung đột rõ ràng
  thay vì “đã cài nhưng không hiện gì”.
- **Lấy danh sách mô hình** không còn im lặng trả về 0: máy chủ thử lần lượt `Bearer`,
  `?key=` và `x-api-key`, đọc được mọi kiểu phản hồi thường gặp, và khi vẫn thất bại
  thì in rõ từng lần thử hỏng vì lý do gì thay vì báo “Đã lấy được 0 mô hình”.
