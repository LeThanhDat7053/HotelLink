# Tổng quan dự án

Đọc file này trước khi sửa code. Nó mô tả **hiện trạng**; bản đề xuất tái cấu trúc dài hạn nằm ở [PROJECT_ARCHITECTURE.md](PROJECT_ARCHITECTURE.md).

---

## Dự án này là gì

Frontend website khách sạn, kiến trúc **multi-tenant**: một source code chạy cho nhiều khách sạn, phân biệt nhau bằng `TENANT_CODE` + `PROPERTY_ID` gửi kèm mỗi request API. Toàn bộ nội dung, logo, màu sắc, SEO đều lấy từ backend — không hardcode.

```
                 ┌─ tenant: phoenix, property: 13 → Phoenix Hotel
Backend API ─────┼─ tenant: fusion,  property: 10 → Fusion Suites
                 └─ tenant: grand,   property: 15 → Grand Hotel
```

## Tech stack

| Lớp | Công nghệ |
|-----|-----------|
| UI | React 19 + TypeScript |
| Routing | React Router v7 |
| Component library | Ant Design 6 |
| Styling | TailwindCSS 4 |
| Build | Vite 7 |
| HTTP | Axios |
| SEO | React Helmet Async + inject tĩnh lúc build + inject server-side qua PHP |
| Runtime server | PHP 8 trên Apache (DirectAdmin) |
| VR360 | 3DVista export, nhúng tĩnh |

---

## Cấu trúc thư mục

```
├── src/
│   ├── api.ts             # axios client, xử lý token, gắn header tenant/property
│   ├── config.ts          # config hợp nhất: ưu tiên server inject, fallback .env
│   ├── App.tsx            # app shell: router + orchestrate page + background
│   ├── pages/             # entry theo route
│   ├── components/common/ # UI dùng lại (view + detail của từng domain)
│   ├── hooks/             # fetch state cho UI (useRooms, useDining, useSettings...)
│   ├── services/          # gọi API và transform dữ liệu
│   ├── context/           # state toàn cục: property, language, theme, sale
│   ├── types/             # TypeScript types theo domain
│   ├── constants/         # routes, translations
│   └── utils/             # cache, resolver, parser VR360
├── server/                # artifact PHP cho production
│   ├── index.php          # entrypoint: login, inject SEO + token vào index.html
│   ├── api-proxy.php      # cấp token cho frontend mà không lộ credentials
│   ├── config.example.php # mẫu — copy thành config.php TRÊN SERVER
│   └── .htaccess          # rewrite rules + chặn config.php
├── scripts/               # script build
└── docs/                  # tài liệu
```

Quy ước đặt tên theo domain — mỗi mục nội dung (`room`, `dining`, `facility`, `service`, `offer`) có đủ bộ `types/` + `services/` + `hooks/` + `components/common/XxxView.tsx` + `XxxDetail.tsx`. Thêm mục mới thì đi theo đúng bộ đó.

---

## Luồng dữ liệu

```
Component  →  hook (useRooms)  →  service (roomService)  →  api.ts (axios)  →  Backend
                                                               ↑
                                            header: X-Tenant-Code, X-Property-Id, Bearer token
```

Component không gọi thẳng `api.ts`. Service chịu trách nhiệm transform dữ liệu; hook chịu trách nhiệm loading/error state.

Frontend có cache JSON ở browser (`src/utils/browserJsonCache.ts`), TTL mặc định 12 giờ, chỉnh bằng `VITE_FRONTEND_CACHE_TTL_HOURS`. Sửa nội dung trên admin mà site chưa đổi thì thường là do cache này hoặc LiteSpeed cache.

---

## Luồng cấu hình & xác thực

Đây là phần dễ nhầm nhất giữa dev và production.

### Dev local

```
.env  →  import.meta.env  →  src/config.ts  →  api.ts login bằng username/password
```

Vite proxy `/api/v1` sang backend để tránh CORS.

### Production

```
server/config.php
   ↓  index.php đọc, login API, lấy token
   ↓  inject vào HTML:
        window.__SERVER_TOKEN__   = '<token>'
        window.__INITIAL_DATA__._config = { api_base, tenant, property_id, site_url, ... }
   ↓
src/config.ts ưu tiên _config, bỏ qua .env
   ↓
api.ts dùng __SERVER_TOKEN__; khi hết hạn thì POST /api-proxy.php?action=get-token
```

Hệ quả cần nhớ:

- **Production không chứa password trong bundle JS.** Credentials chỉ nằm trong `config.php` trên server, và `.htaccess` chặn truy cập file này.
- **Đổi config production không cần build lại** — sửa `config.php` là đủ.
- `token_cache.txt` lưu token dùng chung, tránh login lại mỗi request.

---

## SEO hoạt động ra sao

Ba tầng, cộng dồn:

1. **Build time** — `scripts/inject-seo.js` gọi API rồi ghi meta tag tĩnh vào `dist/index.html`. Crawler thấy ngay cả khi không chạy JS.
2. **Server time** — `server/index.php` đọc `index.html`, thay title/description/og/favicon bằng dữ liệu API mới nhất. Đây là lý do Apache phải ưu tiên `index.php` hơn `index.html`.
3. **Runtime** — `SEOMeta.tsx` (React Helmet) cập nhật meta khi điều hướng trong app.

Nếu view source thấy meta placeholder → tầng 2 không chạy, kiểm tra `DirectoryIndex` trong `.htaccess`.

---

## Đa ngôn ngữ

Danh sách locale lấy từ backend (`GET /locales/`), khai báo tại `src/constants/routes.ts` (`SUPPORTED_LOCALES`). Tiếng Việt là mặc định và không có prefix URL; các ngôn ngữ khác dùng prefix (`/en/phong-nghi`). Nội dung dịch đến từ API theo từng field (`*_translations`); chuỗi giao diện tĩnh nằm ở `src/constants/translations.ts`.

---

## Theme

`primary_color`, `background_color` và các field màu lấy từ `vr-hotel/settings`, được `ThemeContext` + `ThemeInjector` bơm thành CSS variable. Không hardcode màu thương hiệu trong component.

---

## Đọc tiếp

| Việc cần làm | Tài liệu |
|--------------|----------|
| Chạy dự án lần đầu | [GETTING_STARTED.md](GETTING_STARTED.md) |
| Deploy lên hosting | [DEPLOY_DIRECTADMIN.md](DEPLOY_DIRECTADMIN.md) |
| Làm site cho khách sạn mới | [NEW_HOTEL_CHECKLIST.md](NEW_HOTEL_CHECKLIST.md) |
| Nhúng tour VR360 | [VR360.md](VR360.md) |
| Kế hoạch tái cấu trúc | [PROJECT_ARCHITECTURE.md](PROJECT_ARCHITECTURE.md) |
