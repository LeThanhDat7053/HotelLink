# HotelLink Frontend — Multi-Hotel Platform

Frontend website khách sạn, kiến trúc multi-tenant: **một source code, nhiều khách sạn**. Toàn bộ nội dung, logo, màu sắc và SEO lấy từ backend qua `TENANT_CODE` + `PROPERTY_ID` — không hardcode.

React 19 · TypeScript · Vite 7 · Ant Design 6 · TailwindCSS 4 · PHP runtime (DirectAdmin/Apache)

---

## Bắt đầu nhanh

```bash
git clone <repo-url> ten-khach-san
cd ten-khach-san
npm install
npm run setup     # wizard sinh .env và test kết nối API
npm run dev       # http://localhost:5173
```

Chưa có thông tin tenant/property? Xem [cách xin từ backend](docs/NEW_HOTEL_CHECKLIST.md#1-xin-thông-tin-từ-backend).

---

## Tài liệu

Đọc theo đúng việc bạn đang cần làm:

| Việc | Tài liệu |
|------|----------|
| **Mới nhận dự án, muốn chạy được trên máy** | [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) |
| **Hiểu dự án hoạt động thế nào** | [docs/ARCHITECTURE_OVERVIEW.md](docs/ARCHITECTURE_OVERVIEW.md) |
| **Build và upload lên DirectAdmin** | [docs/DEPLOY_DIRECTADMIN.md](docs/DEPLOY_DIRECTADMIN.md) |
| **Nhân bản cho khách sạn mới** | [docs/NEW_HOTEL_CHECKLIST.md](docs/NEW_HOTEL_CHECKLIST.md) |
| **Nhúng tour VR360 3DVista** | [docs/VR360.md](docs/VR360.md) |
| Kế hoạch tái cấu trúc dài hạn | [docs/PROJECT_ARCHITECTURE.md](docs/PROJECT_ARCHITECTURE.md) |
| Playbook VR360 chuyên sâu | [VR360_SCENE_SYNC_PLAYBOOK.md](VR360_SCENE_SYNC_PLAYBOOK.md) · [VR_ID_PANORAMA_RESTAURANT_PLAYBOOK.md](VR_ID_PANORAMA_RESTAURANT_PLAYBOOK.md) |
| Tham chiếu API backend | [api-docs.md](api-docs.md) |

---

## Lệnh

```bash
npm run dev          # dev server, port 5173
npm run build        # build production đầy đủ (TS → Vite → inject SEO → copy file PHP)
npm run build:only   # build, bỏ qua inject SEO và copy file server
npm run inject-seo   # chỉ chạy lại bước inject SEO
npm run preview      # xem thử bản build, port 4173
npm run setup        # wizard tạo .env cho khách sạn mới
npm run lint         # ESLint
```

---

## Ba điều cần biết trước khi sửa code

**1. Config có hai nguồn.** Dev đọc `.env`; production đọc `server/config.php` do `index.php` nhúng vào `window.__INITIAL_DATA__._config`. `src/config.ts` ưu tiên nguồn server. Đổi config production **không cần build lại**, chỉ sửa `config.php` trên server.

**2. Site chạy qua `index.php`, không phải static hosting.** `index.php` login API, inject SEO meta và token rồi mới trả HTML. Host bắt buộc có PHP + mod_rewrite.

**3. `build.emptyOutDir = false` là cố ý.** `dist/assets/vr-data` và `dist/assets/js/panorama.js` là bộ export 3DVista, không do Vite sinh ra và không nằm trong git. Bật `emptyOutDir` lên là mất tour VR360. Xem [docs/VR360.md](docs/VR360.md).

---

## Bảo mật

`.env`, `server/config.php`, `server/token_cache.txt` chứa credentials và **không bao giờ** được commit (đã gitignore). Mỗi khách sạn dùng một tài khoản API riêng. Sau mỗi lần deploy, kiểm tra `https://domain.com/config.php` trả về **403 Forbidden**.
