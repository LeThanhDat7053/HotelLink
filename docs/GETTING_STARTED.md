# Getting Started — Chạy dự án trên máy local

Tài liệu cho người mới clone repo về. Làm đúng thứ tự từ trên xuống.

## 1. Yêu cầu môi trường

| Thứ | Phiên bản | Ghi chú |
|-----|-----------|---------|
| Node.js | >= 20 | Vite 7 yêu cầu Node 20+ |
| npm | >= 10 | đi kèm Node |
| Git | bất kỳ | |
| PHP | 8.x | chỉ cần **trên server**, không cần ở local |

Kiểm tra:

```bash
node -v
npm -v
```

## 2. Clone & cài dependency

```bash
git clone <repo-url> ten-khach-san
cd ten-khach-san
npm install
```

Nếu `npm install` báo xung đột peer dependency (antd 6 / React 19):

```bash
npm install --legacy-peer-deps
```

## 3. Tạo file `.env`

`.env` **không** nằm trong git (đã gitignore vì chứa credentials). Tự tạo từ file mẫu:

```bash
cp .env.example .env
```

Rồi điền giá trị. Các biến bắt buộc:

| Biến | Ý nghĩa | Lấy ở đâu |
|------|---------|-----------|
| `VITE_API_BASE_URL` | Gốc API, không có `/` cuối | thường là `https://travel.link360.vn/api/v1` |
| `VITE_API_USERNAME` | Tài khoản API | admin backend cấp |
| `VITE_API_PASSWORD` | Mật khẩu API | admin backend cấp |
| `VITE_TENANT_CODE` | Mã định danh khách sạn | admin backend cấp |
| `VITE_TENANT_ID` | ID tenant | admin backend cấp |
| `VITE_PROPERTY_ID` | ID property (cơ sở) | admin backend cấp |
| `VITE_SITE_BASE_URL` | Domain thật của site, không có `/` cuối | do bên khách sạn cung cấp |
| `VITE_APP_NAME` | Tên hiển thị trên tab trình duyệt | |

Các biến tuỳ chọn: xem `.env.example`.

Cách xin thông tin từ backend: xem [NEW_HOTEL_CHECKLIST.md](NEW_HOTEL_CHECKLIST.md#1-xin-thông-tin-từ-backend).

## 4. Kiểm tra kết nối API trước khi chạy

```bash
curl -X GET "https://travel.link360.vn/api/v1/vr-hotel/settings" \
  -H "X-Tenant-Code: <tenant_code>" \
  -H "X-Property-Id: <property_id>"
```

Trả về JSON có `seo`, `logo_media_id`, `primary_color`... là đúng. Trả về 401/404 thì `.env` sai hoặc backend chưa tạo property — đừng chạy tiếp, xử lý dứt điểm ở bước này.

## 5. Chạy dev

```bash
npm run dev
```

Mở http://localhost:5173

Ở chế độ dev:

- Frontend tự login API bằng `VITE_API_USERNAME` / `VITE_API_PASSWORD` (xem `src/api.ts`).
- Vite proxy `/api/v1` sang `https://travel.link360.vn` để tránh CORS (xem `vite.config.ts`).
- Không có `index.php`, nên SEO server-side không chạy — điều này bình thường.

Ở production thì ngược lại: `index.php` login hộ và nhúng token vào `window.__SERVER_TOKEN__`, frontend không bao giờ thấy password. Chi tiết: [ARCHITECTURE_OVERVIEW.md](ARCHITECTURE_OVERVIEW.md#luồng-cấu-hình--xác-thực).

## 6. Các lệnh có sẵn

```bash
npm run dev          # dev server, port 5173
npm run build        # build production đầy đủ (dọn js cũ → tsc → vite → inject SEO → copy file PHP)
npm run build:only   # build, bỏ qua inject SEO và copy file server
npm run inject-seo   # chỉ chạy lại bước inject SEO vào dist/index.html
npm run preview      # xem thử bản build, port 4173
npm run setup        # wizard tạo .env cho khách sạn mới
npm run lint         # ESLint
```

## 7. Lỗi thường gặp

**Trang trắng, console báo 401** — token hết hạn hoặc credentials sai. Xoá `server/token_cache.txt` (nếu chạy production) và kiểm tra lại `.env`.

**Build lỗi TypeScript** — `npm run build` chạy `tsc -b` trước, lỗi type sẽ chặn build. Sửa type, đừng bypass bằng `build:only` rồi deploy.

**VR360 không hiện ở local** — bộ export 3DVista nằm ở `dist/assets/vr-data`, không nằm trong `public/`. Dev server đọc thẳng từ `dist/` qua plugin trong `vite.config.ts`. Nếu `dist/` trống thì VR360 sẽ không có gì để hiển thị. Xem [VR360.md](VR360.md).
