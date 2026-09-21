# Deploy lên DirectAdmin (hosting PHP/Apache)

Tài liệu này mô tả toàn bộ quy trình từ `npm run build` đến khi site chạy thật.

Mô hình deploy: **không phải static hosting thuần**. Site chạy qua `index.php` để inject SEO meta và token server-side, nên host phải có PHP + Apache mod_rewrite (DirectAdmin mặc định có đủ).

---

## 1. Build ở máy local

```bash
npm run build
```

Lệnh này chạy 4 bước, theo thứ tự:

1. `scripts/cleanup-dist-js.js` — xoá các file JS cũ trong `dist/assets/js` (giữ lại `panorama.js` của VR360).
2. `tsc -b && vite build` — build React. Lưu ý `build.emptyOutDir = false`, nghĩa là **`dist/` không bị xoá sạch** — đây là cố ý, để giữ `dist/assets/vr-data` và `panorama.js`.
3. `scripts/inject-seo.js` — gọi API lấy SEO thật rồi ghi meta tag tĩnh vào `dist/index.html`.
4. `scripts/copy-server-files.js` — copy `server/*.php` và `server/.htaccess` vào `dist/`.

Sau khi build, `dist/` phải có:

```
dist/
├── index.html            # app shell (KHÔNG được serve trực tiếp, index.php sẽ đọc file này)
├── index.php             # entrypoint thật: login API, inject SEO + token, echo HTML
├── api-proxy.php         # endpoint frontend gọi để xin token mới
├── .htaccess             # rewrite rules
├── config.example.php    # file mẫu, PHẢI đổi tên/copy thành config.php trên server
├── README.txt            # ghi chú deploy tự sinh
└── assets/
    ├── css/
    ├── js/               # bundle + panorama.js
    └── vr-data/          # bộ export 3DVista (nếu dự án có VR360)
```

Kiểm tra nhanh trước khi upload:

```bash
ls dist/index.php dist/api-proxy.php dist/.htaccess
ls dist/assets/vr-data/locale/en.txt   # chỉ khi dự án có VR360
```

Nếu thiếu `.htaccess` thì do copy bằng tay bỏ sót file ẩn — chạy lại `npm run build`.

---

## 2. Upload lên DirectAdmin

### Cách nhanh nhất: nén rồi extract trên server

```bash
cd dist
zip -r ../deploy.zip . -x "README.txt"
```

Lưu ý: `zip -r .` có bao gồm file ẩn `.htaccess`. Nếu dùng công cụ nén trên Windows, phải bật hiển thị file ẩn, nếu không `.htaccess` sẽ bị bỏ sót và site sẽ 404 ở mọi route trừ trang chủ.

Trên DirectAdmin:

1. Đăng nhập DirectAdmin → **File Manager**.
2. Vào thư mục web root: `domains/<ten-domain>/public_html`.
3. Nếu là deploy lại: xoá nội dung cũ, **nhưng giữ lại `config.php` và `assets/vr-data/`** (xem mục 5).
4. Upload `deploy.zip` → chọn file → **Extract**.
5. Xoá `deploy.zip` sau khi extract.

### Cách khác: FTP/SFTP

Upload toàn bộ nội dung bên trong `dist/` (không upload chính thư mục `dist`) vào `public_html`. Đảm bảo client FTP có bật "show hidden files" để `.htaccess` được đưa lên.

---

## 3. Tạo `config.php` trên server

Đây là bước bắt buộc và hay bị quên nhất. `config.php` **không** nằm trong git và **không** được build ra — phải tạo thủ công trên server.

Trong File Manager, tại `public_html`:

1. Copy `config.example.php` → đặt tên `config.php`.
2. Sửa nội dung:

```php
<?php
define('API_BASE_URL', 'https://travel.link360.vn/api/v1');
define('API_USERNAME', 'tenkhachsan@admin.com');
define('API_PASSWORD', 'mat-khau-that');

define('TENANT_CODE', 'tenant-code-that');
define('TENANT_ID',   '1');
define('PROPERTY_ID', '13');

define('VR360_CDN_URL',  'https://travel.link360.vn');
define('SITE_BASE_URL',  'https://domain-khach-san.com');
define('APP_NAME',       'Tên Khách Sạn');
```

Giá trị ở đây chính là giá trị trong `.env` local, chỉ đổi cú pháp. `index.php` đọc file này rồi nhúng xuống frontend qua `window.__INITIAL_DATA__._config`, nên **sửa `config.php` trên server là đổi được config của cả app mà không cần build lại**.

3. Tạo file rỗng `token_cache.txt` trong cùng thư mục, phân quyền **664** (hoặc 666 nếu host khó tính). File này lưu access token để khỏi login lại mỗi request; nếu không ghi được thì mỗi lần load trang sẽ login lại, chậm nhưng vẫn chạy.

Phân quyền chuẩn:

| Đối tượng | Quyền |
|-----------|-------|
| Thư mục | 755 |
| File thường | 644 |
| `token_cache.txt` | 664 |

---

## 4. Kiểm tra sau khi deploy

Chạy lần lượt, đừng bỏ bước nào:

- [ ] Mở `https://domain.com` — trang chủ load, logo và màu sắc đúng của khách sạn.
- [ ] Mở `https://domain.com/phong-nghi` (hoặc route bất kỳ) — không bị 404. Nếu 404 → `.htaccess` chưa lên hoặc `mod_rewrite` tắt.
- [ ] Mở `https://domain.com/config.php` — phải trả về **403 Forbidden**. Nếu hiện code PHP hoặc trang trắng có nội dung → `.htaccess` chưa chặn, credentials đang bị lộ, xử lý ngay.
- [ ] Mở `https://domain.com/api-proxy.php?action=get-token` — trả JSON có `access_token`.
- [ ] View source trang chủ — thấy `<title>`, `og:image`, `canonical` là nội dung thật (không phải placeholder). Nếu là placeholder → `index.php` không chạy, đang bị serve thẳng `index.html`.
- [ ] Kiểm tra VR360 nếu có: `https://domain.com/assets/vr-data/locale/en.txt` phải trả về **text**, không phải HTML app shell.
- [ ] Test trên mobile.

---

## 5. Deploy lại (lần 2 trở đi)

Những file **tuyệt đối không ghi đè / không xoá** trên server:

- `config.php` — chứa credentials, không có trong bản build.
- `token_cache.txt` — sẽ tự sinh lại, nhưng giữ thì tốt hơn.
- `assets/vr-data/` — bộ export 3DVista rất nặng, không cần upload lại nếu tour không đổi.

Quy trình an toàn:

```bash
npm run build
# nén dist/ nhưng loại vr-data cho nhẹ
cd dist && zip -r ../deploy.zip . -x "assets/vr-data/*" "README.txt"
```

Trên server chỉ xoá `assets/css`, `assets/js` (trừ `panorama.js`), `index.html`, `index.php`, `api-proxy.php` rồi extract bản mới đè lên.

Sau mỗi lần deploy, nếu đổi credentials thì xoá `token_cache.txt` để buộc login lại.

---

## 6. Sự cố thường gặp

| Triệu chứng | Nguyên nhân | Cách xử lý |
|-------------|-------------|------------|
| Mọi route trừ `/` đều 404 | thiếu `.htaccess` | upload lại file ẩn `.htaccess` |
| Trang trắng, source chỉ có `<div id="root">` | `config.php` chưa tạo → `index.php` fatal error | tạo `config.php`, bật error log kiểm tra |
| Meta tag là placeholder | Apache serve `index.html` thay vì `index.php` | kiểm tra `DirectoryIndex index.php index.html` trong `.htaccess` |
| 500 Internal Server Error | sai cú pháp `config.php`, hoặc thiếu extension `curl` | xem error log trong DirectAdmin |
| Token liên tục hết hạn, site chậm | `token_cache.txt` không ghi được | chmod 664 |
| VR360 trắng | `assets/vr-data` chưa upload, hoặc bị rewrite về `index.php` | kiểm tra rule `^/assets/vr-data/` trong `.htaccess` |
| Đổi nội dung backend mà site không cập nhật | LiteSpeed cache / cache frontend (TTL mặc định 12h) | purge cache trong DirectAdmin, hoặc chỉnh `VITE_FRONTEND_CACHE_TTL_HOURS` |
