# Ghi chú bản dịch tiếng Việt

Tài liệu này mô tả cách tiện ích `vvv-story-memory-suite` được Việt hóa, thuật ngữ
đối chiếu, và những điều cần biết trước khi chuyển đổi giữa bản gốc tiếng Trung và
bản tiếng Việt.

## 1. Phạm vi đã dịch

Toàn bộ phần chữ mà người dùng hoặc mô hình nhìn thấy đều đã sang tiếng Việt:

| Thành phần | Tệp | Ghi chú |
| --- | --- | --- |
| Điểm vào tiện ích | `index.js` | Menu, thông báo, cảnh báo xung đột |
| Sân Khấu Không Bao Giờ Hạ Màn | `modules/theater/index.js` | Toàn bộ giao diện, prompt, chú thích, heuristic |
| Tiếp sức cốt truyện | `modules/theater/relay.js` | Đạo diễn, bốn giai đoạn, góc nhìn |
| Bổ trợ sân khấu | `modules/theater/addon.js`, `modules/theater/style.css` | |
| Hỏi đáp ngoài lề | `modules/creative/*` | |
| Dùng chung | `modules/shared/*` | |
| Memory Hub | `memory-hub/index.html`, `memory-hub/app.js`, `memory-hub/style.css` | |
| Plugin máy chủ | `server-plugin/vvv-theater-memory-server/index.mjs` | Thông báo lỗi, nhật ký |
| Manifest | `manifest.json` | Tên hiển thị và mô tả |

Ngoài chữ hiển thị, các **heuristic vốn viết cho tiếng Trung** cũng được viết lại
cho tiếng Việt: nhận diện số đếm (`mười`, `mươi`, `trăm`, `nghìn`, `vạn`, `mốt`,
`lăm`, `tư`), ngày tháng (`ngày D tháng M`, `d/m/yyyy`), buổi trong ngày, từ khóa
món ăn – trang phục – đơn hàng – di chuyển, câu phủ định, xưng hô thân tộc, và cách
tách token cho truy hồi BM25/vector (âm tiết + bigram).

## 2. Những gì **không** dịch

Giữ nguyên có chủ đích:

- **Định danh kỹ thuật**: `vvv_theater_memory`, `vvv_story_relay`,
  `/api/plugins/vvv-theater-memory-server`, `dataRoot/vvv/vvv-theater-memory`,
  các mốc `fixed39` / `fixed40` / `fixed41` / `fixed42`, tên hàm, tên biến, khóa JSON
  của giao thức (`mainline`, `promises`, `lifeFacts`, `anchors`…).
- **Tên thương hiệu**: giữ dạng Latin/chính thức — WeChat, WeChat Pay, Alipay,
  Meituan, Ele.me, Taobao, JD, Didi, Dianping, Xiaomi, Huawei, IKEA, UNIQLO,
  Nestlé, LEGO, NovelAI, SillyTavern… Danh mục hàng hóa mô phỏng trong điện thoại
  cũng theo quy tắc này.
- **Tên riêng của tác giả gốc** trong `manifest.json`.
- **Từ khóa tiếng Hàn** trong bộ nhận diện bối cảnh (`학교`, `학생`, `대학`,
  `기숙사`, `동아리`) — vốn có ở bản gốc để nhận bối cảnh đa ngôn ngữ.

## 3. Thuật ngữ đối chiếu

| Tiếng Trung | Tiếng Việt |
| --- | --- |
| 永不落幕的剧场 | Sân Khấu Không Bao Giờ Hạ Màn |
| 小剧场 | Sân Khấu Nhỏ |
| 记忆中枢 | Trung tâm Ký ức |
| 幕后七条 | Bảy điều hậu trường |
| 彼间私文 | Bỉ Gian Tư Văn |
| 剧情接力 | Tiếp sức cốt truyện |
| 楼层 | Tầng |
| 正文 | Chính văn |
| 约定 | Lời hẹn |
| 秘密知情边界 | Ranh giới người biết bí mật |
| 阶段总结 / 大总结 / 时代总结 | Tổng kết giai đoạn / Tổng kết lớn / Tổng kết thời đại |
| 结构化记忆 | Ký ức có cấu trúc |
| 事件锚点 | Mốc neo sự kiện |
| 生活账本 | Sổ đời sống |
| 冷热检索 | Truy hồi nóng-nguội |
| 记忆体检 | Khám ký ức |
| 盲读 / 原文核验 | Đọc mù / Đối chiếu chính văn |
| 场景防回滚锁 | Khóa chống hồi cảnh |
| USER主权锁 | Khóa chủ quyền USER |
| 独立API | API riêng |
| 向量 / 关键词 / 标签 / 联想 | Vector / Từ khóa / Thẻ / Liên tưởng |
| 小手机 | Điện thoại nhỏ |
| 知情簿 | Sổ ai biết |

**Tiêu đề cố định của tổng kết giai đoạn (U1.6.2)** — các mô-đun đều dùng đúng
sáu tiêu đề này, không được đổi lẻ tẻ:

```
【THỜI GIAN VÀ BỐI CẢNH】
【1. CỐT TRUYỆN CỐT LÕI VÀ HÀNH ĐỘNG】
【2. TRẠNG THÁI NHÂN VẬT VÀ THAY ĐỔI QUAN HỆ】
【3. BÍ MẬT VÀ RANH GIỚI NGƯỜI BIẾT】
【4. VẬT PHẨM THEN CHỐT VÀ LỜI HẸN】
【5. MANH MỐI VÀ VIỆC CHƯA GIẢI QUYẾT】
```

**Trạng thái lời hẹn**: `Chờ thực hiện` · `Đang diễn ra` · `Mặc định đã thực hiện` ·
`Đã thực hiện` · `Có hiệu lực lâu dài` · `Điều kiện chưa kích hoạt` ·
`Quá hạn chưa xác nhận` · `Hủy`.

**Tiền tố nhật ký**: `[vvv Trung tâm Ký ức]` · `[vvv Sân Khấu Nhỏ]` ·
`[vvv Điện Thoại Nhỏ]` · `[vvv Tiếp sức cốt truyện]`.

## 4. Tương thích dữ liệu — đọc trước khi chuyển bản

Các bảng ký ức được lưu dưới dạng đối tượng có **khóa là tên cột bằng chữ**. Bản
Việt hóa đã dịch những khóa đó (`姓名` → `Họ tên`, `状态` → `Trạng thái`,
`覆盖楼层` → `Tầng bao phủ`, `总结内容` → `Nội dung tổng kết`…), đồng thời dịch cả
các giá trị trạng thái mà chương trình tự sinh.

Hệ quả:

- Kho ký ức tạo bằng **bản tiếng Trung** khi mở bằng **bản tiếng Việt** sẽ hiện các
  cột trống, vì khóa cũ không khớp khóa mới. Dữ liệu **không bị xóa**, chỉ là không
  được hiển thị và không vào prompt.
- Chiều ngược lại cũng vậy.
- Cấu hình API, khóa lưu trên máy chủ, thư mục dữ liệu và ID tiện ích **không đổi**,
  nên phần kết nối vẫn hoạt động bình thường sau khi chuyển.

Khuyến nghị: nếu đang có hồ sơ dài bằng bản tiếng Trung, hãy tạo ảnh chụp an toàn
(`Ảnh chụp an toàn` trong phần cài đặt) trước khi đổi sang bản này, và bắt đầu một
cuộc trò chuyện mới thay vì trộn hai bản trên cùng một archive.

## 5. Kiểm tra sau khi dịch

Mỗi lần cập nhật bản dịch đều chạy:

```bash
node --check index.js                  # và mọi tệp .js/.mjs khác
python3 -m json.tool manifest.json     # và mọi tệp .json khác
bash verify.sh
```

`tests/standalone-integrity.mjs` là bài kiểm tra tính toàn vẹn của bản gốc; kết quả
của nó phải giống hệt kết quả trên mã nguồn chưa dịch — nghĩa là bản dịch không làm
thay đổi hành vi.

> ℹ️ **Lưu ý:** `bash verify.sh` hiện dừng ở khẳng định `server multi-account mode missing`
> trong `tests/standalone-integrity.mjs`. Đây là lỗi **có sẵn từ bản gốc chưa dịch** (chuỗi
> `multi-account mode` không tồn tại trong `server-plugin/.../index.mjs` của thượng nguồn),
> không phải do bản Việt hóa gây ra. Toàn bộ phần kiểm tra cú pháp JS/MJS/JSON phía trước
> đều qua, và bài kiểm tra dừng đúng tại cùng một dòng như khi chạy trên mã nguồn gốc.
>
> Thay đổi duy nhất trong `tests/standalone-integrity.mjs` là chuỗi mẫu của dấu hiệu
> Hỏi đáp ngoài lề, được cập nhật cho khớp bản dịch.

