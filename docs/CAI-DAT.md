# Hướng dẫn cài đặt đầy đủ

Tiện ích này gồm **hai nửa**, phải cài cả hai:

| Nửa | Nằm ở đâu | Lo việc gì |
| --- | --- | --- |
| **Tiện ích giao diện** | `SillyTavern/public/scripts/extensions/third-party/memo-suite/` | Bảng 0-32, điện thoại, Tiếp sức cốt truyện, các nút bấm |
| **Plugin máy chủ** | `SillyTavern/plugins/vvv-theater-memory-server/` | Lưu cấu hình API, lấy danh sách mô hình, RAG/truy hồi, hồ sơ vĩnh viễn, Memory Hub, NovelAI |

> ⚠️ **Chỉ cài nửa giao diện thì bấm “Lưu” sẽ không lưu được, “Lấy danh sách mô hình”
> cũng không chạy.** Vì API key được cất ở phía máy chủ (`data/<tài-khoản>/vvv-theater-memory/config.json`),
> không cất trong trình duyệt. Không có plugin máy chủ thì không có chỗ nào để ghi.

---

## Bước 1 — Cài tiện ích giao diện

Trong SillyTavern: **Extensions** (biểu tượng khối xếp chồng) → **Install Extension** →
dán địa chỉ:

```
https://github.com/SolNg/memo-suite
```

Chọn phạm vi cài (toàn hệ thống hoặc riêng tài khoản) → **Install**.

Sau khi xong, kiểm tra thư mục đã xuất hiện:

```bash
ls SillyTavern/public/scripts/extensions/third-party/memo-suite/manifest.json
```

**Nếu trước đây bạn đã cài bản `vvv-story-memory-suite` hoặc `vvv-unified-core`, hãy gỡ đi.**
Hai bản cùng chạy 0-32 sẽ ghi ký ức hai lần trong một lượt; bản này phát hiện được và tự
dừng, nên bạn sẽ thấy “cài rồi mà không hiện gì”.

---

## Bước 2 — Tìm thư mục gốc SillyTavern

Nếu chưa chắc SillyTavern nằm ở đâu, dùng một trong các cách sau:

```bash
pm2 list                                  # nếu chạy bằng PM2, cột script chỉ ra đường dẫn
ps aux | grep -i sillytavern              # xem tiến trình đang chạy từ đâu
find / -name "server.js" -path "*SillyTavern*" 2>/dev/null   # dò cả máy
```

Thư mục gốc là nơi có **cả** `server.js` **và** `config.yaml`. Ví dụ hay gặp:
`/home/www/SillyTavern`, `/root/SillyTavern`, `~/SillyTavern`.

Từ đây tài liệu viết tắt thư mục đó là `$ST`:

```bash
ST=/home/www/SillyTavern     # sửa lại cho đúng máy của bạn
ls $ST/server.js $ST/config.yaml
```

---

## Bước 3 — Bật server plugin trong `config.yaml`

SillyTavern **mặc định tắt** server plugin. Đây là nguyên nhân phổ biến nhất của lỗi 404.

```bash
grep -n "enableServerPlugins" $ST/config.yaml
```

- Nếu ra `enableServerPlugins: false` → sửa thành `true`.
- Nếu **không ra gì** → thêm một dòng mới vào `config.yaml`:

```yaml
enableServerPlugins: true
```

Lưu ý YAML: viết sát lề trái (không thụt đầu dòng), sau dấu hai chấm có đúng một dấu cách.

---

## Bước 4 — Cài plugin máy chủ

Vào đúng thư mục tiện ích vừa cài ở Bước 1 rồi chạy script kèm theo:

```bash
cd $ST/public/scripts/extensions/third-party/memo-suite
bash install-server.sh $ST
```

Script sẽ: sao lưu bản cũ (nếu có) → chép plugin sang `$ST/plugins/vvv-theater-memory-server`
→ chỉnh quyền cho khớp chủ sở hữu của thư mục SillyTavern → tự `pm2 restart` nếu tìm thấy PM2.

Kiểm tra kết quả:

```bash
ls $ST/plugins/vvv-theater-memory-server/index.mjs
```

**Muốn làm tay** (khi không chạy được script):

```bash
mkdir -p $ST/plugins
cp -a $ST/public/scripts/extensions/third-party/memo-suite/server-plugin/vvv-theater-memory-server \
      $ST/plugins/
chown -R $(stat -c '%u:%g' $ST) $ST/plugins/vvv-theater-memory-server
```

**Nếu chạy bằng Docker:** thư mục `plugins/` phải nằm trong volume được gắn vào container,
nếu không plugin sẽ biến mất mỗi lần dựng lại container.

---

## Bước 5 — Khởi động lại SillyTavern

Chọn đúng cách bạn đang chạy:

```bash
pm2 restart SillyTavern --update-env     # PM2
systemctl restart sillytavern            # systemd
docker restart sillytavern               # Docker
```

Chạy bằng `npm start` trong terminal thì Ctrl+C rồi chạy lại. Dùng aaPanel/bảng điều khiển
thì bấm nút khởi động lại của tiến trình tương ứng.

> Sửa `config.yaml` hay chép plugin đều **bắt buộc** khởi động lại mới có hiệu lực.

---

## Bước 6 — Xác nhận plugin đã sống

**Cách 1 — xem log khởi động,** phải có dòng:

```
[vvv-theater-memory-server] module discovered, preparing v0.9.3-...
```

```bash
pm2 logs SillyTavern --lines 100 | grep vvv-theater
```

**Cách 2 — gọi thẳng endpoint kiểm tra sức khỏe** (mở bằng trình duyệt đang đăng nhập
SillyTavern):

```
http://<địa-chỉ-SillyTavern>/api/plugins/vvv-theater-memory-server/health
```

- Trả về **JSON** → xong, sang Bước 7.
- Vẫn ra **trang 404** → plugin chưa được nạp: quay lại Bước 3 (thường là quên
  `enableServerPlugins`) và Bước 5 (quên khởi động lại).

---

## Bước 7 — Nhập API và lưu

Mở **0-32 → tab “API & mô hình”**, thẻ **“API sắp xếp / tổng kết riêng”**:

1. **Loại giao diện API** — `Tương thích OpenAI`, `Anthropic` hoặc `Gemini`.
2. **Base URL** — với loại tương thích OpenAI thì địa chỉ phải kết thúc bằng `/v1`,
   ví dụ `https://gcli.ggchan.dev/v1`. Không thêm `/chat/completions` vào đây.
3. **API Key** — dán khóa. Ô này hiển thị chấm tròn; để trống khi lưu lần sau nghĩa là
   **giữ nguyên khóa cũ trên máy chủ**, không phải xóa khóa.
4. Bấm **Lưu** → phải hiện thông báo thành công.
5. Bấm **Lấy danh sách mô hình** → ô **Mô hình mặc định** sẽ có gợi ý để chọn.
6. Chọn mô hình → **Lưu** lần nữa → bấm **Kiểm tra toàn tuyến**.

Ba thẻ còn lại (**Bảy điều hậu trường**, **API thời gian thực của điện thoại**,
**Mô hình vector**) làm y hệt và có khóa riêng, không dùng chung với thẻ đầu.

---

## Bảng xử lý sự cố

Mở **F12 → tab Network**, bấm nút đang lỗi rồi xem dòng yêu cầu tương ứng:

| Bạn thấy | Nguyên nhân | Cách xử lý |
| --- | --- | --- |
| **404** kèm nội dung HTML | Plugin máy chủ chưa nạp | Bước 3 → 4 → 5 |
| **403** | Thiếu header CSRF hợp lệ | Đóng hết tab SillyTavern cũ, mở lại đúng một tab rồi thử lại |
| **200** nhưng `only-vvv` | Tài khoản chưa được bật tính năng máy chủ | Xem lại phần cấu hình tài khoản của plugin |
| Bấm **Lưu** báo thành công, mở lại vẫn trống | Đang xem nhầm tài khoản | Dữ liệu tách riêng theo tài khoản đăng nhập; đăng nhập đúng tài khoản đã lưu |
| **Lấy danh sách mô hình** trả mảng rỗng | Base URL hoặc khóa sai | Kiểm tra Base URL có `/v1`, thử lại khóa; nhà cung cấp không hỗ trợ `/models` thì cứ gõ tay tên mô hình vào ô **Mô hình mặc định** |
| Nút **Memory Hub** mở ra trang trắng/404 | Đường dẫn tiện ích | Bản này đã tự suy ra đường dẫn theo vị trí thật của tiện ích, chỉ cần tải lại trang (Ctrl+F5) |
| Cài rồi mà không thấy gì trong menu | Còn bản VVV cũ đang chạy | Gỡ `vvv-unified-core` / `vvv-story-memory-suite`, tải lại SillyTavern |

---

## Kiểm tra nhanh toàn bộ tiện ích

```bash
cd $ST/public/scripts/extensions/third-party/memo-suite
bash verify.sh
```

Script kiểm tra cú pháp mọi tệp JS/JSON. Nó dừng ở khẳng định
`server multi-account mode missing` — đây là **lỗi có sẵn từ bản gốc**, không phải do
bản Việt hóa; xem [`BAN-DICH.md`](BAN-DICH.md) mục 5.
