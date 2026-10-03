# MODULE "CÀI ĐẶT CẢNH VR360" TRONG DASHBOARD — TÀI LIỆU TỔNG HỢP ĐỂ TÁI SỬ DỤNG

> Tài liệu mô tả **đầy đủ** chức năng, mô hình dữ liệu, API, luồng URL và cơ chế điều khiển
> engine của module quản trị cảnh 360° (tour xuất từ **3DVista Pro**), viết **độc lập với dự án
> gốc** để có thể clone sang project khác. Mọi tên miền / tên site / số liệu đặc thù đã được thay
> bằng placeholder (`<domain>`, `<SITE_NAME>`, `<tour-dir>`).
>
> Quy ước trong tài liệu: `<tour-dir>/` = thư mục bản xuất 3DVista (ở dự án gốc là `vr-360/`),
> **chỉ đọc**, không bao giờ ghi vào. `/canh/` = tiền tố link ngắn (đổi được, xem §12).

---

## MỤC LỤC

1. [Phạm vi & bức tranh tổng thể](#1-phạm-vi--bức-tranh-tổng-thể)
2. [Khái niệm & khoá dữ liệu](#2-khái-niệm--khoá-dữ-liệu)
3. [Nguồn cảnh: catalog + đồng bộ từ bản xuất](#3-nguồn-cảnh-catalog--đồng-bộ-từ-bản-xuất)
4. [Phân chia cảnh thành nhóm](#4-phân-chia-cảnh-thành-nhóm)
5. [Màn Admin "Cảnh 360°" — từng khối chức năng](#5-màn-admin-cảnh-360--từng-khối-chức-năng)
6. [Khung xem trước tour thật (`scene-preview.html`)](#6-khung-xem-trước-tour-thật-scene-previewhtml)
7. [Ảnh chia sẻ dựng từ tile (`pano-shot.js`)](#7-ảnh-chia-sẻ-dựng-từ-tile-pano-shotjs)
8. [Mô hình dữ liệu (MySQL)](#8-mô-hình-dữ-liệu-mysql)
9. [API endpoints](#9-api-endpoints)
10. [Luồng link ngắn `/canh/<url_slug>`](#10-luồng-link-ngắn-canhurl_slug)
11. [Điều khiển engine 3DVista (`vr-core`)](#11-điều-khiển-engine-3dvista-vr-core)
12. [Checklist clone sang project khác](#12-checklist-clone-sang-project-khác)
13. [Bẫy đã đo được — đọc trước khi sửa](#13-bẫy-đã-đo-được--đọc-trước-khi-sửa)
14. [Module liên quan (tuỳ chọn)](#14-module-liên-quan-tuỳ-chọn)

---

## 1. Phạm vi & bức tranh tổng thể

Module biến **mỗi cảnh 360° thành một tài sản độc lập** có thể: đặt tên, đặt link ngắn đẹp, sinh
QR/mã nhúng, canh **góc nhìn mở đầu**, đặt metadata chia sẻ (Open Graph) riêng, bật/tắt tự xoay —
tất cả **không sửa một byte nào trong bản xuất 3DVista**.

```
┌──────────────────────────────┐   đồng bộ (đọc locale)   ┌─────────────────────────┐
│ <tour-dir>/  (3DVista export) │ ───────────────────────► │ data/catalog.json        │
│  locale/<lang>.txt            │                          │ registry cảnh: slug→UUID │
│  script_general.js            │◄─── đọc playlist/camera  └────────────┬────────────┘
│  media/<pano>_0/<face>/…      │◄─── đọc tile ảnh                      │ LEFT JOIN theo slug
└──────────────────────────────┘                                        ▼
                                                            ┌─────────────────────────┐
   ADMIN "Cảnh 360°" (SPA module)                            │ MySQL (3 bảng)           │
   ├─ cây nhóm/cảnh · tìm · lọc                              │ scene_settings           │
   ├─ khung preview tour THẬT (iframe) ─ canh yaw/pitch      │ scene_slug_alias         │
   ├─ tên · link ngắn · Copy · QR · mã nhúng                 │ scene_social_metadata    │
   ├─ preview OG · chụp ảnh 1200×630 · metadata theo nhóm    └────────────┬────────────┘
   └─ tự xoay · Lưu / Lưu tất cả · cảnh báo lệch                          │
                                                                          ▼
   KHÁCH mở /canh/<url_slug>                                 ┌─────────────────────────┐
   .htaccess ─► scene-page.php (OG + media-index + pose)     │ index.htm (trang tour)   │
             └► js/scene-deeplink.js ─► packages/vr-core ───►│ engine 3DVista           │
                                                             └─────────────────────────┘
```

Ba khối tách bạch, mỗi khối tự chạy được:

| Khối | Vai trò | Có thể bỏ khi clone? |
|---|---|---|
| **Catalog** (`data/catalog.json` + bộ đồng bộ) | Registry cảnh, khoá ổn định `slug`, cache UUID | Không — là nguồn danh sách cảnh |
| **Admin "Cảnh 360°"** (UI + API + DB) | Cấu hình từng cảnh | Không — là module chính |
| **Link ngắn + deep link** (rewrite + PHP + JS + vr-core) | Đưa khách vào đúng cảnh, đúng góc, OG riêng | Không — là đầu ra của module |
| Metadata theo địa điểm (`map/data/*`) | Mặc định OG lấy từ dữ liệu bản đồ | **Có** — không có thì tự rơi về nhóm theo nhãn |

---

## 2. Khái niệm & khoá dữ liệu

| Thuật ngữ | Là gì | Ai sở hữu | Ghi chú |
|---|---|---|---|
| **`pano`** (UUID) | `panorama_<UUID>` — id cảnh do 3DVista sinh | Máy | **Đổi toàn bộ sau mỗi lần xuất lại tour.** Chỉ là cache, không dùng làm khoá |
| **`slug`** (slug hệ thống) | Khoá ổn định của cảnh trong catalog (`a-z0-9`) | Hệ thống | Mọi module khác (combo, bản đồ, trang chào, scene_settings) trỏ vào đây. **Không sửa tay** |
| **`label`** | Nhãn thật của cảnh trong bản xuất (`<pano>.label = …` trong locale) | Máy (gương) | Refresh mỗi lần đồng bộ; dùng để nhận diện lại cảnh khi UUID đổi và để **gom nhóm** |
| **`name`** | Tên hiển thị curated (bán hàng/biên tập) | Người | Sinh 1 lần lúc tạo entry, **không generator nào ghi đè** |
| **`url_slug`** (link ngắn) | Phần sau `/canh/` — trường **RIÊNG**, `a-z0-9-` | Người vận hành | Đổi được; giá trị cũ tự vào bảng alias |
| **`title`** | Tên hiển thị của cảnh trong module | Người vận hành | Rỗng → `label + ' ' + số thứ tự trong nhóm` |
| **Nhóm** | Các cảnh cùng `label` | Máy | Cha = địa điểm, con = cảnh `01, 02, 03…` |
| **`meta_key`** | Khoá metadata OG dùng chung | Máy | `place:<id>` (nếu có bản đồ) hoặc `group:<sha1(label)>` |

**Nguyên tắc vàng:** bảng DB **chỉ chứa phần người vận hành đặt thêm**; `name/label/pano` KHÔNG chép
vào DB mà LEFT JOIN từ catalog lúc chạy → xuất lại tour, cấu hình vẫn còn.

---

## 3. Nguồn cảnh: catalog + đồng bộ từ bản xuất

### 3.1 Schema `data/catalog.json`

```json
{
  "defaultPano": "panorama_<UUID>",
  "destinations": {
    "<slug>": { "name": "Tên curated", "label": "Nhãn thật trong tour",
                "type": "", "icon": "", "pano": "panorama_<UUID>" }
  }
}
```

`type`/`icon` là trường phụ do module khác dùng (combo) — giữ hoặc bỏ tuỳ project. `pano: ""` =
entry bị **hạ cấp** (cảnh mất sau khi xuất lại mà slug vẫn đang được tham chiếu).

### 3.2 Thuật toán đồng bộ (catalog là GƯƠNG của bản xuất)

Đầu vào: mọi dòng `panorama_<UUID>.label = <text>` trong `<tour-dir>/locale/<lang-mặc-định>.txt`
(mỗi UUID lấy dòng `.label` ĐẦU TIÊN).

| Tình huống | Hành động |
|---|---|
| UUID mới, chưa slug nào trỏ | **Thêm** slug = `slugify(label)` (bỏ dấu, chữ thường, viết liền; trùng thì hậu tố `2,3…`) |
| UUID cũ mất, `label` khớp **đúng 1** cảnh mới | **Repoint** — giữ slug, đổi `pano` |
| `label` khớp 0 hoặc ≥2 cảnh | Slug **không được tham chiếu** → xoá · slug **đang được tham chiếu** → giữ entry, `pano = ""` |
| Cảnh đổi tiêu đề | Cập nhật `label`, **không** đụng `name` |
| `defaultPano` chết | Trỏ về cảnh đầu tiên còn sống |

Bất biến sau đồng bộ: `count(entry có pano) === count(cảnh trong bản xuất)`.

**Tập slug được bảo vệ** (`collectReferencedSlugs` / `catalog_referenced_slugs`) = gom slug từ mọi
file dữ liệu khác đang trỏ vào catalog. Khi clone: sửa hàm này cho đúng các file của project mới
(hoặc trả về rỗng nếu chưa có module nào khác).

### 3.3 Hai bản triển khai + cổng kiểm

| Bản | File | Dùng khi |
|---|---|---|
| Node (CLI) | `tools/gen-catalog.js` → lõi `tools/lib/catalog-sync.js` | dev / CI (`--dry`, `--report`) |
| PHP (web) | `admin/api/sync-catalog.php` → lõi `admin/api/_catalog_sync.php` | nút "Đồng bộ từ tour" trong Admin |

Hai lõi phải cho output **giống nhau từng byte** — `node tools/test-catalog-parity.js` + fixture
kiểm điều đó. PHP **bắt buộc ext `intl`** (transliterate slug); thiếu → 500, không ghi dữ liệu hỏng.

Endpoint PHP: `POST {"dry":true}` → trả diff + counts (added/repointed/removed/orphaned/labelChanged…)
để UI hiện hộp xác nhận; `POST {}` → backup `data/_backup/<ts>/catalog.json` → ghi nguyên tử
(tmp → rename) → ghi **fingerprint** `data/catalog-sync.json`:

```json
{ "at": "...", "by": "<user>", "locale": {"sha256","size","mtime"}, "playlist": {"size","mtime"}, "counts": {...} }
```

### 3.4 Phát hiện bản xuất đã đổi mà chưa đồng bộ

`GET admin/api/catalog-status.php` (chỉ đọc) so fingerprint với file hiện tại (size/mtime trước,
sha256 khi lệch) → `{ stale, reason, dangling[], orphaned[], intl }`. Admin shell dùng nó để chấm
🟡 (stale) / 🔴 (có slug treo) trên sidebar. **Không có gì tự chạy sau khi publish 3DVista** — không
hỏi thì không ai biết catalog cũ.

### 3.5 Tab "Điểm đến (catalog)" trong Admin

Sửa tay từng entry: `name`, `type`, `icon`, chọn `pano` từ dropdown (bỏ qua entry `pano:""`), xem
`label` (chỉ đọc), xoá entry. Lưu qua `tools/save-catalog.php` (POST nguyên chuỗi JSON 2-space →
validate `defaultPano` + từng entry + regex pano → backup → ghi nguyên tử). Nút **Đồng bộ từ tour**
= dry-run → hộp xác nhận in đủ counts → ghi thật.

---

## 4. Phân chia cảnh thành nhóm

Server (`admin/api/scenes.php`) làm toàn bộ việc gom nhóm, client chỉ vẽ:

1. Duyệt `destinations` **theo thứ tự trong catalog**.
2. Nhóm = `label`; nhóm mới → `{ id: "g<N>", name: label, scenes: [] }`.
3. Cảnh trong nhóm đánh số `no = "01","02",…` theo thứ tự gặp.
4. `title` mặc định = `label + " " + no` nếu người vận hành chưa đặt.

Kèm theo mỗi cảnh:

| Trường | Nguồn |
|---|---|
| `slug, pano, label, name` | catalog |
| `dir` | `pano + "_0"` — tên thư mục media, chỉ để đối chiếu |
| `tourYaw / tourPitch` | parse `script_general.js`: `"id":"<pano>_camera","initialPosition":{"pitch":…,"yaw":…}` — góc gốc tác giả tour đặt |
| `yaw/pitch/fov/autorotate/title/urlSlug` | `scene_settings` nếu có, không thì `tourYaw/tourPitch/75/false` |
| `inExport` | UUID có trong locale hiện tại không (quyết định preview tour thật hay ảnh giả) |
| `status` | `ok` (đã lưu) · `new` (chưa lưu) · `warn` |
| `warn` | 4 loại: cảnh không còn trong bản xuất · nhãn catalog ≠ nhãn bản xuất · `status=orphan` · `label_cache` ≠ label hiện tại |
| `meta` | metadata OG đã resolve (§5.7) |

**Chống báo động giả:** nếu < 50% catalog khớp bản xuất đang có trên máy (máy dev chỉ có bộ media
giả) → `vr.stale = true`, **tắt** cờ `warn` từng cảnh, chỉ báo một dòng ở khối `vr`.

Payload: `{ ok, total, defaultPano, groups[], counts{groups,configured,withUrl,warn}, vr{present,scenes,matched,stale,note} }`.

---

## 5. Màn Admin "Cảnh 360°" — từng khối chức năng

Module ESM `admin/assets/js/scenes.js`, đăng ký trong hash-router `app.js`
(`scenes: { title, load: () => import('./scenes.js?v=…') }`), nhận `{ root, topActions, toast }`.
Bố cục: **cây trái · sân khấu preview giữa · thanh thông tin dưới** (preview làm chủ đạo).

### 5.1 Thanh công cụ trên cùng

| Nút | Hành vi |
|---|---|
| 🔄 Tải lại danh sách | Gọi lại API; còn cảnh chưa lưu thì `confirm` trước; mutate tại chỗ mảng `tree/allScenes` (closure đang giữ tham chiếu) |
| ⚠ N lệch / ✓ không lệch / ⚠ bản xuất lệch | Mở modal liệt kê từng cảnh `warn` + ghi chú `vr.note` |
| "N cảnh chưa lưu" | Đếm client-side theo cờ `dirty` |
| 💾 Lưu tất cả | POST mảng cảnh dirty → `save-scenes-bulk.php` (một transaction) |

### 5.2 Cây cảnh bên trái

- Ô tìm kiếm: bỏ dấu (`NFD` + strip combining marks), so trên `title · slug · urlSlug`.
- Checkbox **"chỉ cảnh chưa đặt link"** (`!urlSlug`).
- Nhóm mở/đóng; đang tìm hoặc đang lọc thì bung hết.
- Dấu trạng thái trên từng dòng: `✓` ok · `⚠` warn · `●` dirty (chưa lưu).
- Chân cây: `shown/total cảnh · N nhóm`.

### 5.3 Sân khấu preview

| Thành phần | Vai trò |
|---|---|
| `#sc-frame` (iframe `scene-preview.html`) | Tour 3DVista **thật**, hiện khi `inExport` |
| `#sc-pv` (div gradient) | Ảnh mô phỏng khi cảnh không có trong bản xuất; kéo/lăn chuột vẫn đổi số |
| Khung chữ nhật `#sc-shot` | Báo đúng vùng sẽ được cắt làm ảnh chia sẻ **1200×630** — tính từ `fov` qua tang góc, khớp trục mà engine giữ cố định (`TOUR_FOV_AXIS = 'vertical'`) |
| Crosshair + dòng gợi ý | "Kéo–thả để canh góc · lăn chuột để phóng to/thu nhỏ" |
| HUD `yaw · pitch · fov` | Số thực đang hiển thị |
| ☑ **Xoay thử** | Chỉ quay trong khung, **không lưu**; bỏ tick → trả về đúng toạ độ đã đặt |
| ↺ **Về góc gốc tour** | `tourYaw/tourPitch`, fov 75 |
| ⛶ Toàn màn hình | `requestFullscreen` trên wrapper |

Kéo trong tour thật → iframe gọi ngược `onPoseChange` → `view` cập nhật → `markDirty()`. Có cửa sổ
`suppressUntil` để thay đổi do chính ta đặt (đổi cảnh) không bị coi là "chưa lưu"; pose kèm `pano`
để không gán góc của cảnh cũ cho cảnh vừa chọn.

### 5.4 Thanh thông tin — định danh, tên, link ngắn

| Trường | Loại | Ghi chú |
|---|---|---|
| Mã (`dir`) | chỉ đọc | tên thư mục media, để đối chiếu |
| Slug hệ thống 🔒 | chỉ đọc | khoá, module khác đang trỏ |
| Tên cảnh (`title`) | sửa | cập nhật cây ngay khi gõ |
| Nhãn thật trong bản xuất (`label`) | chỉ đọc | tự đồng bộ |
| Link ngắn (`/canh/` + `urlSlug`) | sửa | lowercase; **✨ tự sinh** = `slugify(title)` (bỏ dấu, `đ→d`, `[^a-z0-9]+ → -`, cắt gạch đầu/cuối) |
| Kiểm tra sống | — | `chưa đặt` · `chỉ được dùng a–z, 0–9, gạch ngang` (regex `^[a-z0-9]+(?:-[a-z0-9]+)*$`) · `trùng với cảnh "…"` · `hợp lệ` |
| Đường dẫn đầy đủ | chỉ đọc | `BASE_URL + '/canh/' + urlSlug`; **`BASE_URL = location.origin`** — không ghi cứng tên miền |
| ⧉ Copy · ▦ Mã QR · `</>` Mã nhúng | nút | disabled khi chưa có link hoặc link sai |

### 5.5 Modal Mã QR (`qr.js`)

- Bộ sinh QR **tự chứa** (`admin/assets/js/qr.js` — port thuật toán Nayuki, public domain), byte
  mode, tự chọn mask. API: `QR.generate(text, { ecc: 'M' }) → { size, modules[][], version }`.
- Nội dung mã hoá = **đúng chuỗi link ngắn** `<origin>/canh/<url_slug>` (cùng chuỗi với nút Copy).
- Xuất **SVG** (gộp mọi ô đen thành 1 `<path>`, `shape-rendering: crispEdges`, quiet zone 4) và
  **PNG** 256/512/1024 px (canvas). Tuỳ chọn **kèm nhãn tên cảnh** dưới mã (~10% chiều cao).
- Tên file: `qr-<url_slug>.svg` / `qr-<url_slug>-<size>.png`.
- Quyết định thiết kế: QR mã hoá link đọc được, KHÔNG phải link máy `/q/<id>`; tính bất biến nằm ở
  **bảng alias** (§8) chứ không ở hình dạng URL.

### 5.6 Modal Mã nhúng

Sinh `<iframe src="<origin>/canh/<url_slug>[?yaw=&pitch=&fov=]" allow="fullscreen; xr-spatial-tracking; gyroscope; accelerometer">`
với: Rộng/Cao · **tự co theo khung** (`width:100%; max-width; aspect-ratio`) · **kèm toạ độ đã canh**.
⚠ Tham số `?yaw/pitch/fov` hiện **chỉ mang tính thông tin** — client deep link (§10) lấy góc từ DB,
chưa đọc query string. Muốn dùng thật thì thêm parse ở `scene-deeplink.js`.

### 5.7 Khối "Preview chia sẻ (Open Graph)"

- Thẻ preview sống (ảnh · host · tiêu đề · mô tả), chọn ngôn ngữ preview.
- 5 trường: `titleVi · descriptionVi · titleEn · descriptionEn · image`.
- Nhãn phạm vi: **"Dùng chung cho N cảnh — sửa một lần áp dụng cho tất cả"** hoặc "Metadata riêng",
  kèm nguồn mặc định (`map/data · địa điểm <id>` hay `catalog · nhóm cùng nhãn`).
- Nút **📷 Chụp ảnh** → §7 → upload → điền `image` → phải bấm Lưu mới áp.
- Metadata **được gửi kèm payload lưu cảnh** khi `meta.dirty`, ghi vào `scene_social_metadata`
  theo `meta_key` (nhiều cảnh cùng key chia sẻ cùng object ở client — sửa một là đổi tất cả).

Cách resolve `meta_key` + giá trị mặc định (`backend/content/_scene_meta.php`):

```
slug ∈ POI nào (map_places: slug chính hoặc extras; POI không-shared thắng)?
  ├─ có  → key = place:<poi_id>; default title/desc từ map_i18n_<lang>.places[id].{name,desc};
  │        default image = POI.thumb
  ├─ không nhưng nhóm-cùng-label có đúng 1 POI chủ → dùng POI đó
  └─ không → key = group:sha1(lower(label)); default title = label; desc = câu mẫu; image = OG mặc định của site
overrides[key] (DB) ⊕ default → giá trị cuối (trường rỗng trong override rơi về default)
```

**Không bao giờ** mặc định ảnh OG bằng ảnh equirect gốc của cảnh (`<pano>_hd_t.jpg`) — ảnh cầu là
tài sản nội bộ, và nó nhìn méo trên preview. Ảnh đúng góc chỉ có qua nút Chụp ảnh hoặc dán URL.

### 5.8 Tự xoay

Checkbox **"cho phép tự xoay khi khách vào cảnh này"** (`autorotate`). Bật → khách vào là camera chạy
`initialSequence` của tour (thường quay trọn 360°) và **góc đã canh không giữ được** — UI cảnh báo
ngay cạnh. Bật/tắt xem thử tức thì trên tour thật (`spin(true)` / `setPose(đã lưu)`).

### 5.9 Lưu

- **💾 Lưu cảnh**: `syncPoseFromPreview()` (đọc THẲNG camera của khung xem trước ngay trước khi POST —
  "thấy sao lưu vậy") → kiểm link → `save-scene.php`.
- **💾 Lưu tất cả**: chặn nếu có cảnh dirty link sai; chỉ sync pose cho cảnh đang chọn (khung chỉ hiện
  một cảnh); POST mảng → `save-scenes-bulk.php`, rollback toàn bộ nếu 1 cảnh sai.
- Payload một cảnh: `{ slug, urlSlug, title, yaw, pitch, fov, autorotate, metadata? }` — **không** gửi
  `label/pano` (server tự lấy từ catalog để ghi `*_cache`).

---

## 6. Khung xem trước tour thật (`scene-preview.html`)

Trang host tour, nhúng **iframe same-origin** trong admin. Lý do iframe (ngoại lệ có chủ ý của luật
"không iframe cho tour"): engine cần `<base href="../<tour-dir>/">`, nạp thẳng vào trang admin sẽ
viết lại mọi URL tương đối của admin.

```html
<base href="../<tour-dir>/" />
<div id="viewer"></div>   <!-- trang host PHẢI tự định vị: position:fixed; inset:0; z-index:1 -->
<script type="module">
import { ensureTourLoaded, resolvePanoIndex, navigateToPano, getCurrentPanoId,
         getPanoramaPlayer, setEntryPose } from '../packages/vr-core/index.js?v=…';
```

API công bố `window.__scenePreview` (admin gọi thẳng, không cần postMessage):

| Hàm | Hành vi |
|---|---|
| `isReady()` / `onReady(cb)` | tour + player sẵn sàng |
| `go(pano, {yaw,pitch,fov}, autorotate)` | `resolvePanoIndex` (không có → báo "không có trong bản xuất") → nếu `!autorotate`: `cam.set('initialSequence', null)` + `cam.set('enterPointingToHorizon', false)` + **`setEntryPose`** → `navigateToPano` → `waitForPano` (poll tới 15s) → `setPose` hoặc `resumeCamera` → `hideSkin()` lại |
| `getPose()` | đọc `yaw`, `pitch`, **`hfov`** (KHÔNG đọc `fov` — thuộc tính ma) |
| `setPose(p)` | vòng **verify-retry**: đọc TRƯỚC khi set → `pauseCamera()` → set yaw/pitch → lặp 150ms, dừng khi 2 nhịp liên tiếp `near && still` VÀ ≥1,2s, trần 40 lần. KHÔNG ghi `fov` |
| `spin(on)` | tự xoay bằng rAF (`yaw += 0.35°/frame`), không dùng `resumeCamera()` (sequence đã bị xoá) |
| `onPoseChange(cb)` | báo pose khi **có cử chỉ con trỏ thật** (pointer/wheel/touch) trong 500ms gần nhất; im khi `setBusy`; sau khi thả chuột theo dõi quán tính tới khi **3 nhịp 120ms đứng yên** rồi báo nốt; quá 6s vẫn chạy → **bỏ lượt** (không chốt số sai) |
| `currentPano()` | UUID cảnh iframe đang hiển thị |
| `pause()/resume()` | wrapper `pauseCamera/resumeCamera` |

`hideSkin()`: ẩn mọi con của `rootPlayer` trừ `MainViewer` / class `ViewerArea` — khung canh góc chỉ
cần panorama, các nút skin vừa che vừa nuốt thao tác kéo. Dựa vào API component, không bám DOM id
(3DVista đánh lại id số mỗi lần xuất).

Iframe nạp **một lần** với `?v=` (hosting cache tĩnh dài — thiếu là sửa xong vẫn chạy bản cũ).

---

## 7. Ảnh chia sẻ dựng từ tile (`pano-shot.js`)

`renderPanoShot({ pano, yaw, pitch, fov, width = 1200, height = 630, onProgress }) → Promise<Blob JPEG>`

- **Không chụp canvas của 3DVista** (3 cách đã thử đều hỏng: buffer bị xoá → ảnh trắng; ép
  `preserveDrawingBuffer` → tour đen; resize iframe → mất khung vĩnh viễn).
- Tự dựng phối cảnh bằng **WebGL** từ **tile mặt cube** của bản xuất:
  `media/<pano>_0/<face>/<zoom>/<row>_<col>.jpg`, `face ∈ {r,l,u,d,f,b}`, tile 512², zoom
  `3 = 1×1 (512²) · 2 = 2×2 · 1 = 4×4 · 0 = 8×8 (4096²)`. ⚠ tên tile là `<HÀNG>_<CỘT>`.
- Chọn zoom **thô nhất vẫn đủ nét** cho khổ ảnh (`side/90 ≥ width/fov`), rồi thô dần nếu vượt
  `MAX_TILES = 48` hoặc `MAX_TEXTURE_SIZE`. Chỉ tải tile mà khung nhìn chạm tới (quét lưới tia 65×35),
  mỗi mặt dựng texture vừa khít hộp bao → thường 9–16 tile ≈ 1MB.
- Quy ước hướng từng mặt đã **đo thực nghiệm** (48 khả năng/mặt, chấm điểm so với ảnh cầu):
  `r→+X · l→−X · u→+Y · d→−Y · f→−Z · b→+Z`; `YAW_SIGN = -1`, `PITCH_SIGN = 1`. Ảnh ra lật/lệch so với
  khung xem thì chỉ đổi dấu đúng 1 trong 2 hằng.
- Ưu điểm: **không dính hotspot** (hotspot do engine vẽ đè lúc chạy), không đụng engine đang chạy.
- Góc lấy từ `view` đang hiển thị (HUD), không phải giá trị đã lưu — canh xong chụp ngay được.

Upload: `admin/api/upload-scene-share.php` (multipart `slug` + `file`, jpg/png ≤ 3MB, kiểm
`getimagesize`, ghi tmp → rename) → `scene-share/<slug>-<Ymd-His>-<6hex>.<ext>`. Tên có timestamp
để crawler Facebook/Zalo không dính cache ảnh cũ. Trả `{ ok, image: "/scene-share/<file>", width, height }`.

---

## 8. Mô hình dữ liệu (MySQL)

```sql
CREATE TABLE IF NOT EXISTS scene_settings (
  slug         VARCHAR(64)  NOT NULL,            -- KHOÁ = slug catalog
  url_slug     VARCHAR(120) NULL,                -- link ngắn, trường RIÊNG
  title        VARCHAR(255) NULL,                -- tên hiển thị, ghi đè name/label
  yaw          DECIMAL(6,2) NULL,                -- 0..360
  pitch        DECIMAL(6,2) NULL,                -- -90..90
  fov          DECIMAL(6,2) NULL,                -- 30..150 (= hfov thật đọc từ player)
  autorotate   TINYINT(1)   NOT NULL DEFAULT 0,
  pano_cache   VARCHAR(80)  NULL,                -- UUID lúc lưu — CHỈ để phát hiện lệch
  label_cache  VARCHAR(255) NULL,                -- nhãn lúc lưu — bắt ca "UUID sống mà nhãn đổi"
  status       ENUM('ok','orphan') NOT NULL DEFAULT 'ok',
  updated_at   DATETIME NOT NULL, updated_by VARCHAR(64) NULL,
  PRIMARY KEY (slug), UNIQUE KEY uq_url_slug (url_slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Đổi url_slug sau khi đã in QR → link cũ vẫn phải sống. Mỗi lần đổi tự đẩy giá trị cũ vào đây.
CREATE TABLE IF NOT EXISTS scene_slug_alias (
  old_slug   VARCHAR(120) NOT NULL,
  slug       VARCHAR(64)  NOT NULL,              -- trỏ về scene_settings.slug
  created_at DATETIME NOT NULL,
  PRIMARY KEY (old_slug), KEY k_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Open Graph theo NHÓM: meta_key = place:<id> | group:<sha1(label)>
CREATE TABLE IF NOT EXISTS scene_social_metadata (
  meta_key       VARCHAR(191) NOT NULL,
  title_vi       VARCHAR(255) NOT NULL, description_vi TEXT NOT NULL,
  title_en       VARCHAR(255) NOT NULL, description_en TEXT NOT NULL,
  image_url      VARCHAR(1000) NOT NULL,
  updated_at     DATETIME NOT NULL, updated_by VARCHAR(64) NULL,
  PRIMARY KEY (meta_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

Cảnh chưa cấu hình = **không có dòng nào** (không seed). Setup idempotent:
`php backend/content/setup-scenes.php` (CLI) hoặc GET qua HTTP có phiên admin.

### 8.1 Lõi ghi dùng chung (`backend/content/_scenes.php`)

| Hàm | Việc |
|---|---|
| `scene_slug_valid($s)` | `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `scene_catalog($root)` | nạp `destinations` — chỉ slug trong đây mới được lưu |
| `scene_sanitize($in, $catalog)` | slug phải có trong catalog · `urlSlug` lowercase + regex · yaw `0–360` (mặc định 0) · pitch `−90–90` (0) · fov `30–150` (75) · title ≤255 · ghi `pano_cache/label_cache` từ catalog |
| `scene_upsert($db, $c, $user)` | (1) `url_slug` phải duy nhất toàn hệ thống (trừ chính cảnh) → `RuntimeException` · (2) `url_slug` cũ của chính cảnh khác cái mới → **INSERT alias** · (3) `url_slug` mới trùng alias: của **chính cảnh** → xoá alias (lấy lại tên cũ hợp lệ); của **cảnh khác** → `RuntimeException` ("QR đã in đang trỏ vào đó") · (4) `INSERT … ON DUPLICATE KEY UPDATE`, `status='ok'` |

Nơi gọi mở transaction, bắt `RuntimeException` → 422 (lỗi người dùng), `Throwable` → 500, luôn rollback.

### 8.2 Lõi metadata (`backend/content/_scene_meta.php`)

`scene_meta_resolve_all($root, $catalog, $overrides)` → `slug ⇒ { titleVi, descriptionVi, titleEn,
descriptionEn, image, key, sharedCount, source{type,id,label}, custom, defaults }`;
`scene_meta_sanitize($in)` (title/desc VI bắt buộc, ≤255/≤1000, image `^(https?://|/)`);
`scene_meta_upsert($db, $key, $m, $user)`.

---

## 9. API endpoints

Tất cả JSON, `Cache-Control: no-store`. Endpoint admin gác bằng `require_admin(true)` (401 JSON).

| Endpoint | Method | Auth | Vào | Ra |
|---|---|---|---|---|
| `admin/api/scenes.php` | GET | admin | — | `{ ok, total, defaultPano, groups[], counts, vr }` (§4) |
| `admin/api/save-scene.php` | POST | admin | object 1 cảnh `{slug, urlSlug?, title?, yaw?, pitch?, fov?, autorotate?, metadata?}` | `{ ok, saved: slug }` · 422 lỗi validate/trùng · 500 |
| `admin/api/save-scenes-bulk.php` | POST | admin | mảng ≤400 cảnh | `{ ok, saved: n }` · 422 `{error, index}` — validate hết trước, bắt trùng `url_slug` **trong lô**, 1 transaction |
| `admin/api/upload-scene-share.php` | POST multipart | admin | `slug`, `file` | `{ ok, image, width, height }` |
| `backend/content/scene.php?slug=<url_slug>` | GET | **công khai** | — | 200 `{ ok, slug, pano, yaw, pitch, fov, autorotate }` · 301 `{ ok:false, redirect:"/canh/<mới>" }` · 404 |
| `backend/content/scene-page.php?slug=…` | GET (qua rewrite) | công khai | `?lang=vi|en` | HTML tour với OG riêng (§10) |
| `backend/content/setup-scenes.php` | GET/CLI | admin (HTTP) | — | tạo 3 bảng |
| `admin/api/sync-catalog.php` | POST | admin | `{dry?}` | diff / ghi catalog + fingerprint |
| `admin/api/catalog-status.php` | GET | admin | — | `{ stale, reason, dangling, orphaned, intl }` |
| `tools/save-catalog.php` | POST (chuỗi JSON) | admin | catalog | ghi `data/catalog.json` |

Auth dùng chung `admin/_auth.php`: `admin_config()` (đọc `config.php` > `config.sample.php`, users =
bcrypt), `admin_session_start()` (cookie HttpOnly, SameSite=Lax), `require_admin($asApi)`,
`admin_current_user()` (ghi vào `updated_by`).

Kết nối DB dùng chung `backend/analytics/_db.php`: `db(): PDO` (ERRMODE_EXCEPTION,
`EMULATE_PREPARES=false` → **một placeholder không dùng 2 lần**), `db_config()`, `send_json()`.
Cấu hình override ở `backend/analytics/db-config.php` (không commit).

---

## 10. Luồng link ngắn `/canh/<url_slug>`

### 10.1 Rewrite (`.htaccess` gốc site)

```apache
Options +FollowSymLinks
RewriteEngine On
RewriteBase /
# chừa file/thư mục thật
RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]
# /canh/<slug> → HTML động; QSA giữ ?lang=en và tham số mã nhúng
RewriteRule ^canh/([A-Za-z0-9-]+)/?$ backend/content/scene-page.php?slug=$1 [L,QSA]
```

Không bọc `<IfModule mod_rewrite.c>`: LiteSpeed mô phỏng mod_rewrite mà không nạp module → khối
IfModule bị bỏ qua im lặng. URL trên thanh địa chỉ **giữ nguyên** `/canh/…` (rewrite ngầm).

### 10.2 `scene-page.php` — HTML động, OG ở phía máy chủ

Crawler Facebook/Zalo **không chạy JavaScript** → Open Graph phải có ngay trong HTML.

1. Validate `url_slug` (regex). Tra `scene_settings.url_slug` →
   không có → tra `scene_slug_alias.old_slug` →
   alias có `url_slug` mới → **301** `/canh/<mới>` ·
   alias nhưng `url_slug` đã bị xoá trống → **phục vụ thẳng tại URL cũ** (canonical = chính nó) ·
   không gì cả → 404.
2. Slug phải còn trong catalog (404 nếu không). Resolve metadata (§5.7) với overrides từ DB.
3. `lang` = `?lang` hoặc mặc định; `origin` dựng từ `HTTP_HOST` (+`X-Forwarded-Proto`), có hằng
   dự phòng khi thiếu Host. `canonical = origin + /canh/ + url_slug`. Ảnh tương đối → tuyệt đối;
   ảnh local → `getimagesize` để in `og:image:width/height` (Facebook bỏ qua ảnh ở lần scrape đầu
   nếu phải tự tải về đo).
4. **`#media-index=N` sớm**: `playlist_index_for(root, pano)` (§10.4) → nếu có, in một `<script>` trong
   `<head>` đặt `location.hash = "#media-index=N"` **trước khi engine khởi tạo** (3DVista đọc
   `media-index` 1-based trong `_setMediaFromURL` lúc `DOMContentLoaded`) → tour **vào thẳng** cảnh,
   không có nhịp "cảnh mặc định rồi mới nhảy". Hash được dọn ở `setTimeout(0)` trong chính listener
   DOMContentLoaded + ở `load` để URL khách copy vẫn sạch.
5. **Góc mở đầu sớm** (khi `!autorotate` và có yaw/pitch): `<script>` poll 10ms cho tới khi
   `tour.player.getById("<pano>_camera")` tồn tại → `cam.get('initialPosition').set('yaw'|'pitch')`
   + `set('initialSequence', null)` + `set('enterPointingToHorizon', false)`; trần 20s. Đo được: bắt
   kịp trước lúc engine vào cảnh (~1s).
6. Thay vào `index.htm`: `<title>`, khối `<!-- SCENE_META_START -->…<!-- SCENE_META_END -->`
   (og:title/type/description/url/image[+size]/image:alt/site_name/locale/locale:alternate,
   twitter:card/title/description/url/image, meta description, canonical, hreflang vi/en, 2 script
   trên), và `<html lang>`. Header `Content-Language`, `Cache-Control: no-cache, no-store`.

**Yêu cầu với `index.htm`:** (a) `<base href="/<tour-dir>/">` **TUYỆT ĐỐI** — base tương đối sẽ hoá
`/canh/<tour-dir>/` → 404 mọi tài nguyên; (b) có cặp marker `SCENE_META_START/END` bao khối OG mặc
định; (c) nạp `../js/scene-deeplink.js` (`../` vượt base về gốc).

### 10.3 `js/scene-deeplink.js` — phía trình duyệt (classic script, dùng `window.VRCore`)

```
pathname khớp /\/canh\/([A-Za-z0-9-]+)\/?$/  → fetch scene.php?slug=…
  301 + redirect → location.replace(redirect)
  !ok           → im lặng, tour mở như thường (hỏng êm)
  ok → waitTour (poll tới khi mainPlayList có items, trần 30s — `window.tour` CÓ TRƯỚC playlist)
     → dọn #media-index nếu còn
     → !autorotate: VRCore.killEntryAnimation + VRCore.setEntryPose (lưới đỡ cho script sớm)
     → chưa đứng đúng cảnh: VRCore.navigateToPano (thất bại → log, dừng)
     → waitScene (poll getCurrentPanoId === pano, +250ms) → VRCore.applyOpeningView({yaw,pitch,fov,autorotate,pano})
     → GUARD 12s: mỗi 500ms nếu cảnh bị đẩy về cảnh khác → điều hướng lại (tối đa 3 lần);
       dừng ngay khi khách tương tác (pointerdown/keydown/wheel/touchstart)
```

Vì sao có guard: khi F5, engine nạp từ cache nhanh hơn, chuỗi khởi động của 3DVista (vào cảnh mặc
định) chạy **sau** lệnh điều hướng và ghi đè nó.

### 10.4 `_playlist_index.php` — chỉ mục pano → số thứ tự playlist

Parse `script_general.js`: cắt mảng `"id":"mainPlayList","items":[…]` bằng **duyệt ngoặc cân bằng**
(không regex phẳng — 3DVista không đảm bảo thứ tự khoá); `items` **trộn** chuỗi tham chiếu
`PanoramaPlayListItem_…` với object khai thẳng → phải xử lý cả hai, bỏ một loại là lệch số → mở nhầm
cảnh. Cache `data/playlist-index.json` khoá theo `mtime+size` của script → xuất lại tour là tự dựng
lại. Cấu trúc lạ (<50 mục) → trả `null` (không có chỉ mục còn hơn chỉ mục sai) → rơi về điều hướng JS.

---

## 11. Điều khiển engine 3DVista (`packages/vr-core/index.js`)

Module ESM đồng thời công bố `window.VRCore` cho classic script.

| Hàm | Việc | Ghi chú đã đo |
|---|---|---|
| `ensureTourLoaded({base, version, timeout})` | lazy-load `tdvplayer.js` → `script.js`, chèn `<base>` nếu chưa có, gọi `window.loadTour()`, poll tới khi `window.tour` + media list sẵn | trang host phải tự định vị `#viewer` |
| `resolvePanoIndex(tour, uuid)` | duyệt `mainPlayList.get('items')`, so `media.get('id')` | **chỉ cảnh trong main playlist mới điều hướng được** — nhiều UUID trong `script_general.js` không nằm đó |
| `navigateToPano(tour, uuid)` | `tour.setMediaByIndex(i)` | ⚠ `setMediaByName` nhận **nhãn**, không nhận id — truyền `panorama_…` là no-op im lặng; gọi tới CHÍNH cảnh đang đứng cũng no-op |
| `getCurrentPanoId(tour)` | `items[selectedIndex].get('media').get('id')` | |
| `getPanoramaPlayer(tour)` | `getByClassName('PanoramaPlayer')[0]`, fallback 2 id | ⚠ **hai bộ skin = hai player khác id** (`MainViewerPanoramaPlayer` desktop / `MainViewer_mobilePanoramaPlayer` mobile). Ghi cứng id desktop = trên điện thoại không bao giờ áp góc, im lặng |
| `killEntryAnimation(tour, pano)` | `cam.set('initialSequence', null)` + `cam.set('enterPointingToHorizon', false)` với `cam = getById(pano + '_camera')` | nhiều cảnh khai initialPosition chúi xuống đất + bay lên chân trời vài giây, ghi đè mọi lệnh đặt góc trong lúc chạy |
| `setEntryPose(tour, pano, {yaw, pitch})` | **`cam.get('initialPosition').set('yaw'|'pitch')`** TRƯỚC khi engine vào cảnh | ⭐ **đây là cơ chế đặt góc đúng duy nhất**; giữ nguyên zoom (hfov) |
| `applyOpeningView(tour, {yaw,pitch,fov,autorotate,pano})` | autorotate → `resumeCamera()`; ngược lại kill + setEntryPose + vòng `pauseCamera()`+`set()` retry (đọc trước khi set; dừng khi near&&still 2 nhịp và ≥1,2s; trần 40×150ms); trả hàm huỷ | |

**Thuộc tính ma:** `player.set('yaw'|'pitch'|'fov')` ghi vào thuộc tính mà `get()` dội lại **đúng số
vừa ghi** trong khi camera thật không nhúc nhích cho tới khi có thao tác chuột — mọi phép kiểm "set
rồi get" đều tự lừa mình. Trường zoom thật là **`hfov`** (đổi theo khổ màn, ví dụ 110 desktop / 90
mobile). `moveTo(y,p,h,0)` lái được camera nhưng **phá zoom** và tham số không ánh xạ ổn định — không dùng.

**Kiểm đúng cách:** chụp màn hình, hoặc kéo chuột 1px để engine đồng bộ rồi mới `get()`.

---

## 12. Checklist clone sang project khác

### 12.1 Danh sách file cần chép

```
data/catalog.json                     # registry cảnh (sinh bằng bộ đồng bộ)
tools/gen-catalog.js, tools/lib/catalog-sync.js(.test.js), tools/test-catalog-parity.js
tools/save-catalog.php
admin/api/_catalog_sync.php, sync-catalog.php, catalog-status.php

admin/_auth.php, config.sample.php, login.php, logout.php, index.php (shell)
admin/assets/js/app.js (hash router), ui.js (toast/esc/jsonGet/jsonPost)
admin/assets/js/scenes.js, qr.js, pano-shot.js
admin/assets/css/admin.css            # các class sc-* của mục Cảnh 360°
admin/scene-preview.html
admin/api/scenes.php, save-scene.php, save-scenes-bulk.php, upload-scene-share.php

backend/analytics/_db.php (+ db-config.sample.php)   # hoặc thay bằng lớp PDO của bạn: cần db(), db_config(), send_json()
backend/content/_scenes.php, _scene_meta.php, _playlist_index.php
backend/content/scene-page.php, scene.php, setup-scenes.php, sql/scenes-schema.sql

packages/vr-core/index.js
js/scene-deeplink.js
.htaccess                              # luật rewrite /canh/
index.htm                              # marker SCENE_META_START/END + <base> tuyệt đối + nạp scene-deeplink.js
scene-share/                           # thư mục ảnh OG đã chụp (ghi được)
```

### 12.2 Các điểm PHẢI đổi

| Điểm | Ở đâu |
|---|---|
| Tiền tố link ngắn `canh` | `.htaccess` (RewriteRule) · `scene-page.php` (`/canh/` trong 301 + canonical) · `scene.php` (`redirect`) · `scene-deeplink.js` (regex pathname) · `scenes.js` (`/canh/` trong UI, QR, embed) |
| Thư mục bản xuất `vr-360/` | `<base href>` của `index.htm` + `scene-preview.html` · đường dẫn locale/script/media trong `scenes.php`, `_playlist_index.php`, `catalog-status.php`, `sync-catalog.php`, `_catalog_sync.php`, `catalog-sync.js`, `pano-shot.js` (`MEDIA`), `vr-core` (`base`) |
| Locale mặc định của tour (`vi-VN.txt`) | mọi chỗ đọc locale ở trên |
| `og:site_name`, hậu tố `<title>`, `og:locale` cặp `vi_VN/en_GB` | `scene-page.php` |
| Ảnh OG mặc định của site + 2 câu mô tả mặc định | `_scene_meta.php` |
| Host dự phòng khi thiếu `HTTP_HOST` | `scene-page.php` |
| Ngôn ngữ metadata (hiện cố định 2 cột `_vi/_en`) | schema + `_scene_meta.php` + form trong `scenes.js` |
| Nguồn metadata theo địa điểm (`map/data/map_places.json`, `map_locales.json`, `map_i18n_*.json`) | `_scene_meta.php` — **không có thì mọi cảnh rơi về `group:` key, vẫn chạy** |
| Tập slug được bảo vệ khi đồng bộ | `collectReferencedSlugs` (Node) ⇄ `catalog_referenced_slugs` (PHP) — phải khớp nhau |
| Tên DB / user / pass | `backend/analytics/db-config.php` |
| Tài khoản admin (bcrypt), `session_name`, `login_url` | `admin/config.php` |
| `?v=` cache-bust: `scenes.js` trong `app.js`, `scene-preview.html` trong `scenes.js`, `vr-core` trong preview, `scene-deeplink.js` trong `index.htm` | bump khi sửa file tương ứng |

### 12.3 Thứ tự cài đặt

1. Đặt bản xuất 3DVista vào `<tour-dir>/`; phục vụ repo **ở web root** (nhiều URL tuyệt đối gốc web).
2. `node tools/gen-catalog.js` (hoặc Admin › Đồng bộ) → sinh `data/catalog.json`; kiểm `node tools/test-catalog-parity.js`.
3. Tạo `backend/analytics/db-config.php`; chạy `php backend/content/setup-scenes.php`.
4. Tạo `admin/config.php` với hash mật khẩu mới (`php -r 'echo password_hash("…", PASSWORD_DEFAULT);'`).
5. Sửa `index.htm`: `<base href="/<tour-dir>/">`, chèn marker `SCENE_META_START/END` quanh khối OG mặc định, nạp `../js/scene-deeplink.js`.
6. Đặt `.htaccess` gốc với luật rewrite; kiểm `curl -I /canh/khong-ton-tai` → 404 và file thật vẫn 200.
7. Mở Admin › Cảnh 360°: chọn cảnh → canh góc → đặt link → Lưu → mở `/canh/<slug>` trên **cả desktop lẫn điện thoại** (2 bộ skin) và kiểm bằng ảnh chụp, không chỉ bằng số.
8. Chia sẻ thử qua Facebook Sharing Debugger (Scrape Again) để xem OG.

### 12.4 Yêu cầu môi trường

PHP ≥ 8.0 + PDO MySQL + **ext intl** · MySQL 8 (`INSERT … VALUES() ON DUPLICATE KEY` chuẩn) · Apache/
LiteSpeed có mod_rewrite (nginx thì viết lại luật `location ~ ^/canh/`) · trình duyệt admin có WebGL
(chụp ảnh) · HTTPS trên production (OG `secure_url`, clipboard API).

---

## 13. Bẫy đã đo được — đọc trước khi sửa

| # | Bẫy | Hệ quả nếu quên |
|---|---|---|
| 1 | `player.set('yaw'/'pitch'/'fov')` là **thuộc tính ma**; `fov` không phải zoom thật (`hfov` mới đúng) | canh góc xong, mở link vẫn ra góc mặc định; mọi phép kiểm tự đo đều "đạt" |
| 2 | Góc mở đầu phải ghi vào **`initialPosition`** TRƯỚC khi engine vào cảnh; không có đường "vào lại cảnh" (`setMediaByIndex` tới cảnh đang đứng = no-op) | phải có script sớm trong `<head>` của trang link ngắn |
| 3 | **Hai bộ skin, hai player id** — dùng `getByClassName('PanoramaPlayer')` | mobile không bao giờ áp góc, im lặng |
| 4 | `window.tour` có **trước** `mainPlayList` (~1s) — chờ playlist, không chờ `!!tour` | bấm sớm → lệnh rơi vào hư không |
| 5 | Khi F5 engine nạp từ cache nhanh hơn → chuỗi khởi động ghi đè lệnh điều hướng | cần guard 12s trong deep link |
| 6 | Nhiều cảnh khai `initialPosition` chúi đất + `enterPointingToHorizon` → bay lên vài giây; chốt góc giữa quãng bay = lưu số sai | preview chỉ báo khi camera **thật sự đứng yên**, quá 6s thì bỏ lượt; lúc Lưu đọc thẳng camera |
| 7 | `setMediaByName` nhận nhãn, không nhận id; chỉ cảnh trong **main playlist** mới điều hướng được | binding "sống" mà bấm không đi đâu → kiểm bằng playlist parser |
| 8 | Không chụp canvas 3DVista (3 cách đều hỏng) → dựng lại từ tile; tên tile `<hàng>_<cột>` | ảnh trắng/đen, hoặc ảnh vỡ thành ô xáo trộn |
| 9 | Đổi/xoá `url_slug` sau khi in QR: phải có alias + phục vụ thẳng khi đích rỗng + **từ chối** slug đang là alias của cảnh khác | QR đã in chết hoặc dẫn nhầm cảnh |
| 10 | Base href của `index.htm` phải **tuyệt đối** | `/canh/<tour-dir>/…` 404 toàn bộ tour |
| 11 | OG phải render **server-side**; `og:image:width/height` nên có sẵn | preview trắng ở lần chia sẻ đầu |
| 12 | Bản xuất trên máy dev có thể là media giả → đừng lấy sự tồn tại file trong `media/` làm chuẩn; catalog mới là chân lý | báo động giả hàng loạt; `scenes.php` có ngưỡng 50% để tắt warn từng cảnh |
| 13 | `EMULATE_PREPARES=false` → một tên placeholder không dùng 2 lần trong 1 câu SQL | `HY093` im lặng |
| 14 | Iframe preview + module import động cần `?v=` riêng (không thừa hưởng từ trang cha) | sửa xong vẫn chạy bản cũ |
| 15 | `hideSkin`/tìm component theo **`data.name`/class**, không bám DOM id số | vỡ sau mỗi lần xuất lại tour |
| 16 | Đồng bộ catalog phải in đủ counts (kể cả `removed`) vào hộp xác nhận | người vận hành bấm Đồng ý mà không biết sắp mất slug |

---

## 14. Module liên quan (tuỳ chọn)

**Trình ghi đè dữ liệu động của tour (`dashboard-vr-editor/`)** — cùng tinh thần "không sửa bản
xuất": mọi chuỗi giao diện, tooltip hotspot, URL nút, ảnh skin, audio, floor map… của 3DVista nằm
trong `locale/<code>.txt` dạng `key = value`, player parse **last-wins**. Adapter vá `XMLHttpRequest`
trước khi tour boot, chỉ chặn đúng request locale và **nối thêm** các dòng override từ
`data/tour-config.json` → tour tự áp mà không đụng file gốc. Có Scan (sinh form từ locale), Load/Save,
Export JSON/XML, Apply (save + reload). Độc lập với module Cảnh 360°; hữu ích khi cần đổi nhãn/URL
trong tour mà không xuất lại từ 3DVista Studio.

**Cổng kiểm binding trước deploy** (`map/tools/check-bindings.js`, `--no-vr` khi không có bản xuất):
đọc thẳng `<tour-dir>/` và so với catalog + các file tham chiếu; bắt UUID chết, nhãn lệch, cảnh
không nằm trong main playlist, slug treo. Exit ≠ 0 chặn deploy. Nếu project mới không có module bản
đồ thì chỉ giữ phần catalog ⇄ playlist.
