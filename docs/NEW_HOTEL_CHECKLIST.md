# Dùng dự án này làm mẫu cho khách sạn mới

Một source code phục vụ nhiều khách sạn. Về nguyên tắc: **chỉ đổi cấu hình, không sửa code**. Nếu phải sửa code cho một khách sạn cụ thể, dừng lại và cân nhắc — gần như chắc chắn thứ đó nên đến từ API.

Thời gian thực tế cho một khách sạn mới: khoảng 1–2 giờ nếu backend đã sẵn sàng.

---

## 1. Xin thông tin từ backend

Trước khi động vào code, liên hệ admin backend và xin đủ bộ sau:

| Thông tin | Dùng ở đâu | Ví dụ |
|-----------|------------|-------|
| `TENANT_CODE` | header `X-Tenant-Code` mọi request | `phoenix` |
| `TENANT_ID` | một số endpoint | `1` |
| `PROPERTY_ID` | header `X-Property-Id` | `13` |
| API username | login lấy token | `phoenix@admin.com` |
| API password | login lấy token | |
| API base URL | | `https://travel.link360.vn/api/v1` |

Phía backend cần đã làm xong:

- [ ] Tạo tenant + property cho khách sạn.
- [ ] Tạo tài khoản API riêng cho khách sạn này (**không dùng chung tài khoản giữa các khách sạn** — lộ một cái là lộ tất).
- [ ] Nhập nội dung: thông tin chung, SEO, logo, favicon, màu chủ đạo.
- [ ] Nhập dữ liệu các mục: phòng, ẩm thực, tiện ích, dịch vụ, ưu đãi, chính sách, liên hệ.
- [ ] Bật các ngôn ngữ cần dùng.

Xác nhận backend đã sẵn sàng bằng một lệnh, trước khi mất công setup frontend:

```bash
curl -X GET "https://travel.link360.vn/api/v1/vr-hotel/settings" \
  -H "X-Tenant-Code: <tenant_code>" \
  -H "X-Property-Id: <property_id>"
```

Phải thấy `seo`, `logo_media_id`, `primary_color` có giá trị thật. Nếu rỗng → yêu cầu backend nhập nội dung trước, đừng deploy site rỗng.

---

## 2. Setup frontend

```bash
git clone <repo-url> ten-khach-san
cd ten-khach-san
npm install
npm run setup          # wizard hỏi thông tin rồi sinh .env, có test API luôn
```

Không muốn dùng wizard thì `cp .env.example .env` rồi điền tay.

Chạy thử:

```bash
npm run dev
```

---

## 3. Những thứ CẦN đổi cho mỗi khách sạn

| Thứ | Ở đâu |
|-----|-------|
| Tenant / property / credentials | `.env` (local) và `server/config.php` (production) |
| Domain | `VITE_SITE_BASE_URL` trong `.env`, `SITE_BASE_URL` trong `config.php` |
| Tên hiển thị | `VITE_APP_NAME` / `APP_NAME` |
| Bộ export VR360 | `dist/assets/vr-data/` — xem [VR360.md](VR360.md) |

## 4. Những thứ KHÔNG cần đổi

Lấy hết từ API, đụng vào là sai:

- Logo, favicon — từ `logo_media_id`, `favicon_media_id`.
- Màu sắc, theme — từ `primary_color` và các field màu (`ThemeContext`, `ThemeInjector`).
- SEO meta — inject lúc build (`scripts/inject-seo.js`) và lúc chạy (`server/index.php`).
- Toàn bộ nội dung: phòng, ẩm thực, tiện ích, dịch vụ, ưu đãi, tin tức, chính sách, liên hệ.
- Đa ngôn ngữ — danh sách locale lấy từ backend.

## 5. Route có sẵn

Slug tiếng Việt, khai báo ở `src/constants/routes.ts`:

`/` · `/gioi-thieu` · `/phong-nghi` · `/am-thuc` · `/nha-hang` · `/lobby-bar` · `/tien-ich` · `/ho-boi` · `/phong-gym` · `/dich-vu` · `/phong-hop` · `/phong-tam-hoi` · `/dich-vu-khac` · `/chinh-sach` · `/lien-he` · `/thu-vien-anh` · `/tin-tuc-su-kien` · `/uu-dai` · `/dat-phong`

Ngôn ngữ khác gắn prefix: `/en/phong-nghi`. Tiếng Việt là mặc định, không có prefix.

Khách sạn không có mục nào thì mục đó tự ẩn khi API không trả dữ liệu — **không xoá route**.

---

## 6. Checklist bàn giao

Trước khi giao site cho khách:

- [ ] `.env` local đầy đủ, `npm run dev` chạy sạch, không lỗi console.
- [ ] `npm run build` không lỗi TypeScript.
- [ ] Upload `dist/` lên DirectAdmin theo [DEPLOY_DIRECTADMIN.md](DEPLOY_DIRECTADMIN.md).
- [ ] Đã tạo `config.php` trên server, credentials đúng của khách sạn này.
- [ ] `https://domain.com/config.php` trả về **403**.
- [ ] Mọi route mở được, không 404.
- [ ] View source thấy meta SEO thật.
- [ ] Logo, favicon, màu sắc đúng thương hiệu.
- [ ] Đổi ngôn ngữ hoạt động.
- [ ] Test trên mobile.
- [ ] VR360 (nếu có) mở được cảnh đúng.
- [ ] Bàn giao cho khách: đường dẫn admin backend + tài khoản để tự sửa nội dung.

## 7. Lưu ý bảo mật

- `.env`, `server/config.php`, `server/token_cache.txt` **không bao giờ** commit — đã có trong `.gitignore`, đừng `git add -f`.
- Mỗi khách sạn một tài khoản API riêng.
- Trên production, frontend **không** chứa password: `index.php` login hộ rồi nhúng token. Đừng đưa `VITE_API_PASSWORD` vào bản build production.
- Kiểm tra `config.php` trả 403 sau **mỗi** lần deploy.
