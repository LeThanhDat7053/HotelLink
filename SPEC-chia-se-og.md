# Đặc tả chức năng: Chia sẻ OG (Open Graph)

Tài liệu mô tả **chức năng và cách hoạt động**, không gắn với stack/cấu trúc của project gốc.
Thuật ngữ trung tính: **trang chia sẻ** = một đơn vị nội dung có link riêng (sản phẩm, bài viết, cảnh 360°...).

---

## 1. Mục tiêu

Khi người dùng dán link một trang lên Facebook / Zalo / Messenger / Telegram / X..., ô xem trước (preview card)
phải hiện **đúng tiêu đề, mô tả, ảnh của chính trang đó**, không phải thông tin chung của cả website.
Người quản trị chỉnh được nội dung preview, xem trước trước khi lưu, và tạo ảnh chia sẻ ngay trong admin.

Lý do bắt buộc **render phía server (SSR)**: crawler của mạng xã hội không chạy JavaScript, chỉ đọc HTML trả về
lần đầu. Thẻ OG gắn bằng JS phía client sẽ **không** được nhận.

---

## 2. Thành phần

| # | Thành phần | Vai trò |
|---|---|---|
| A | Link ngắn | Mỗi trang chia sẻ có `url_slug` riêng → `GET /<url_slug>` |
| B | Dữ liệu OG | Tiêu đề, mô tả (2 ngôn ngữ), ảnh — có giá trị mặc định + bản tuỳ chỉnh |
| C | Lớp ghi đè | Mặc định hệ thống → tuỳ chỉnh của admin → tuỳ chỉnh của từng cá nhân (sale/tác giả) |
| D | SSR chèn thẻ | Server dựng HTML trang, chèn khối meta OG/Twitter/canonical/hreflang |
| E | Ảnh chia sẻ | Upload hoặc chụp tự động, lưu file tĩnh, tên có timestamp |
| F | Màn hình admin | Form sửa OG + preview card + nút chụp ảnh + chọn ngôn ngữ |
| G | Nút "Chia sẻ" công khai | Ở trang public: lấy link ngắn của trang đang xem → Web Share API / clipboard |

---

## 3. Mô hình dữ liệu

### 3.1. Bảng `social_metadata` (tuỳ chỉnh của admin)

| Field | Kiểu | Ghi chú |
|---|---|---|
| `id` | string | |
| `meta_key` | string, unique | Khoá nhóm (xem 3.3) |
| `title_vi` | string ≤255 | **Bắt buộc** |
| `description_vi` | string ≤1000 | **Bắt buộc** |
| `title_en` | string ≤255 | Rỗng → dùng bản VI |
| `description_en` | string ≤1000 | Rỗng → dùng bản VI |
| `image_url` | string ≤1000 | `http(s)://...` hoặc đường dẫn bắt đầu bằng `/` |
| `updated_at`, `updated_by` | | Audit |

### 3.2. Ghi đè cá nhân (lưu trong hồ sơ người dùng, ví dụ `profile.share_settings`)

```json
{
  "og":      { "<page_key>": { "titleVi": "", "descriptionVi": "", "titleEn": "", "descriptionEn": "", "image": "" } },
  "home_og": { "titleVi": "", "descriptionVi": "", "image": "" }
}
```

- Mọi field đều **tuỳ chọn** (ghi đè từng phần). Field rỗng = theo cấu hình của admin.
- `home_og` dùng cho trang chủ cá nhân của người đó.

### 3.3. Nhóm dùng chung metadata (`meta_key`)

Nhiều trang có thể dùng chung một bộ OG — sửa một lần áp cho cả nhóm:

- Trang gắn với một thực thể (vd. sản phẩm) → `meta_key = entity:<id>`.
- Trang không gắn thực thể → `meta_key = group:<sha1(lowercase(trim(label)))>` (cùng nhãn = cùng nhóm).
- Nếu cả nhóm cùng nhãn chỉ có đúng 1 thực thể → toàn nhóm dùng key của thực thể đó.

Admin phải thấy rõ: *"Dùng chung cho N trang cùng nhóm"* và *nguồn mặc định là gì*.

---

## 4. Thứ tự hợp nhất (resolve) OG

Với mỗi trang, tính theo thứ tự, **field có giá trị ở lớp sau thắng**:

1. **Mặc định hệ thống**
   - Có thực thể: `title = "<tên thực thể> – <SITE_NAME>"`, `description = mô tả ngắn thực thể`, `image = ảnh đầu tiên của thực thể`.
   - Không có: `title = "<label> – <SITE_NAME>"`, `description = câu mô tả chung`, `image = DEFAULT_OG_IMAGE`.
2. **Tuỳ chỉnh admin** (`social_metadata` theo `meta_key`).
3. **Tuỳ chỉnh cá nhân** (`og[page_key]`), chỉ áp khi request được gắn với người đó
   (qua `?sale=<slug>` hoặc subdomain riêng `<slug>.<domain>`).

Ngôn ngữ: `?lang=en` → dùng bản EN; bản EN rỗng thì lùi về VI.

Kết quả trả về cho admin còn kèm: `key`, `sharedCount`, `source {type, label}`, `custom` (đã tuỳ chỉnh chưa), `defaults`.

---

## 5. SSR trang chia sẻ — `GET /<url_slug>`

### 5.1. Luồng xử lý

1. Tra `url_slug`:
   - Không có → **404**.
   - Là alias cũ (đã đổi link) → **301** sang link mới, **giữ nguyên query string**.
2. Xác định ngữ cảnh cá nhân (`?sale=` / subdomain) → lấy lớp ghi đè.
3. Resolve OG theo mục 4.
4. Chuẩn hoá ảnh: đường dẫn `/...` → ghép `origin` thành URL tuyệt đối.
   `origin` lấy từ `X-Forwarded-Proto` + `X-Forwarded-Host` (chạy sau reverse proxy), fallback `Host`.
5. Nếu ảnh là file local → đọc header PNG/JPEG lấy kích thước thật cho `og:image:width/height`.
6. Đọc HTML template, chèn khối meta, trả về.

### 5.2. Khối meta chèn vào `<head>`

```html
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{origin}/{url_slug}">
<link rel="alternate" hreflang="vi" href="{canonical}">
<link rel="alternate" hreflang="en" href="{canonical}?lang=en">
<meta property="og:type" content="website">
<meta property="og:site_name" content="{SITE_NAME}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="{image_abs}">
<meta property="og:image:secure_url" content="{image_abs}">      <!-- chỉ khi https -->
<meta property="og:image:width" content="{w}">                   <!-- khi đọc được -->
<meta property="og:image:height" content="{h}">
<meta property="og:image:alt" content="{title}">
<meta property="og:locale" content="vi_VN | en_GB">
<meta property="og:locale:alternate" content="en_GB | vi_VN">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{desc}">
<meta name="twitter:image" content="{image_abs}">
```

### 5.3. Quy tắc chèn

- **Escape HTML** mọi giá trị (`& < > "`).
- Đặt `<html lang="vi|en">` theo ngôn ngữ.
- Template có cặp marker `<!-- SCENE_META_START -->...<!-- SCENE_META_END -->` → thay toàn bộ phần giữa.
- Không có marker → **xoá** các thẻ `og:*`, `twitter:*`, `description`, `canonical`, `<title>` sẵn có rồi chèn khối mới trước `</head>`.
  Mục đích: trong HTML chỉ còn **một** bộ OG (crawler thường lấy thẻ đầu tiên).
- `canonical` luôn là link ngắn **không** kèm `?sale=` → các bản chia sẻ cá nhân vẫn gộp về một URL chuẩn.

### 5.4. Trang chủ cá nhân — `GET /`

Cùng cơ chế nhưng gọn hơn: `title/description/image` lấy theo thứ tự
`home_og` cá nhân → mặc định (`"<Tên người> – <Tên site>"`, mô tả site, ảnh bìa site → ảnh thumbnail → `DEFAULT_OG_IMAGE`).

---

## 6. Ảnh chia sẻ

### 6.1. Upload — `POST /admin-api/share-image` (multipart)

| | |
|---|---|
| Auth | Mọi user đã đăng nhập (cá nhân cũng tự tạo ảnh của mình) |
| Body | `file` (jpg/png), `slug` |
| Giới hạn | ≤ 3MB, chỉ `image/jpeg`, `image/png`; đọc header xác nhận là ảnh thật |
| Lưu | `share-images/<slug>-<YYYYMMDD-HHMMSS>-<6 hex>.<ext>`, ghi file `.tmp` rồi `rename` (atomic) |
| Response | `{ ok, image: "/share-images/<name>", width, height }` |
| Errors | `422 invalid_file` (sai loại/quá dung lượng), `422 invalid_image` (không đọc được kích thước) |

- Tên file **luôn mới** mỗi lần upload → Facebook/Zalo không dùng ảnh cache cũ.
- Thư mục phục vụ tĩnh `/share-images/*` (cache 1 ngày).
- Upload chỉ trả URL; **chưa** gán vào OG cho đến khi người dùng bấm **Lưu**.
- Kích thước khuyến nghị: **1200×630** (tỉ lệ 1.91:1).

### 6.2. Chụp ảnh từ cảnh 360° (tour 3DVista)

Nút **"Chụp ảnh từ góc hiện tại"**: lấy góc nhìn đang hiển thị trong khung preview, dựng lại ảnh phối cảnh
**1200×630 JPEG** ngay trên trình duyệt từ các tile cube của bản xuất 3DVista, rồi upload theo 6.1.

#### 6.2.1. Nguyên tắc

- **Không chụp canvas của tour đang chạy.** Canvas WebGL của player thường không giữ drawing buffer,
  còn dính hotspot/UI/overlay và khung không đúng tỉ lệ. Ảnh được **render lại offscreen** từ tile gốc nên sạch và đúng kích thước.
- Cùng origin với tour (tile phục vụ tĩnh tại `/<tour>/media/`) → canvas không bị tainted, `toBlob` chạy được.
- Chụp đúng thứ đang thấy: đọc camera thật ngay trước khi chụp (6.2.2), không dùng số đã lưu.

#### 6.2.2. Lấy góc nhìn từ preview

- Admin nhúng tour trong một **iframe cùng origin** (trang preview riêng). Trang đó gắn API lên `window.__scenePreview`:
  `isReady()`, `currentPano()`, `getPose() → { yaw, pitch, hfov }`, `go(pano, pose)`, `setPose()`, `onPoseChange(cb)`...
- Admin truy cập qua `iframe.contentWindow.__scenePreview`.
- Ngay trước khi chụp: `getPose()` → làm tròn 2 chữ số → `{ yaw, pitch, fov }`. Đang chế độ "xoay thử" thì giữ số trong form.
- Chỉ cho chụp khi cảnh **có trong bản xuất** (có tile). Không có → báo lỗi *"Chỉ chụp được khi cảnh có trong bản xuất"*.

#### 6.2.3. Khung crop trên preview

Vẽ một khung chữ nhật tỉ lệ **1200:630** ở giữa khung preview để người dùng canh trước vùng ảnh:

```
W, H = kích thước khung preview; target = 1200/630
nếu W/H > target: khung = (H·target) × H      // khung preview rộng → bám chiều cao
ngược lại:        khung = W × (W/target)       // khung preview hẹp → bám chiều rộng
```

Ảnh render dùng cùng **hfov** trải trên 1200px ngang nên nội dung trong khung khớp ảnh chụp.

#### 6.2.4. Cấu trúc tile 3DVista

```
/<tour>/media/<panoId>_0/<face>/<zoom>/<row>_<col>.jpg
```

| Thành phần | Giá trị |
|---|---|
| `face` | `r` `l` `u` `d` `f` `b` (phải, trái, trên, dưới, trước, sau) |
| `zoom` | `0` (nét nhất) … `3` (thô nhất); số tile mỗi cạnh `n = 2^(3 − zoom)` → 8, 4, 2, 1 |
| Tile | 512×512 px; cạnh mặt cube = `512 · n` |
| `row`, `col` | 0 … n−1, tính từ góc trên-trái của mặt |

Hệ trục mỗi mặt (pháp tuyến `n`, trục phải của ảnh `r`, trục lên của ảnh `u`), camera nhìn về `−Z`, `+Y` là lên:

| Mặt | n | r | u |
|---|---|---|---|
| r | ( 1, 0, 0) | ( 0, 0, 1) | (0, 1, 0) |
| l | (−1, 0, 0) | ( 0, 0,−1) | (0, 1, 0) |
| u | ( 0, 1, 0) | ( 1, 0, 0) | (0, 0, 1) |
| d | ( 0,−1, 0) | ( 1, 0, 0) | (0, 0,−1) |
| f | ( 0, 0,−1) | ( 1, 0, 0) | (0, 1, 0) |
| b | ( 0, 0, 1) | (−1, 0, 0) | (0, 1, 0) |

#### 6.2.5. Tia nhìn và tra mặt cube

Với điểm ảnh ở toạ độ chuẩn hoá `x ∈ [−1,1]` (trái→phải), `y ∈ [−1,1]` (dưới→trên):

```
tanH   = tan(fov/2)                  // fov = góc nhìn ngang (hfov)
aspect = 630/1200
d = normalize(x·tanH, y·tanH·aspect, −1)
d = xoay quanh trục X một góc  pitch·PITCH_SIGN
d = xoay quanh trục Y một góc  yaw·YAW_SIGN
```

Hằng số đo thực tế với 3DVista: `YAW_SIGN = −1`, `PITCH_SIGN = +1`.
Ảnh chụp bị lật gương so với preview → đổi dấu **đúng một** hằng số.

Tra mặt và toạ độ trên mặt:

```
face = mặt có dot(d, n_face) lớn nhất
t    = d / dot(d, n_face)                  // chiếu lên mặt phẳng cube
u    = (dot(t, r_face) + 1) / 2            // 0..1 trái→phải
v    = (1 − dot(t, u_face)) / 2            // 0..1 trên→dưới
tile = (col = floor(u·n), row = floor(v·n))
```

#### 6.2.6. Chọn mức zoom

1. Từ `zoom = 3` lùi dần về 0, lấy mức **thô nhất mà vẫn đủ nét**:
   `cạnh_mặt / 90 ≥ 1200 / fov` (số px trên 1° của tile ≥ số px trên 1° của ảnh ra).
2. Tính các tile cần dùng (6.2.7). Nếu tổng tile **> 48** hoặc texture ghép của một mặt vượt `MAX_TEXTURE_SIZE`
   của GPU → tăng `zoom` thêm 1 (thô hơn), tính lại, tới tối đa `zoom = 3`.

#### 6.2.7. Tính các tile nằm trong khung nhìn

- Bắn lưới tia **65 × 35** phủ đều khung ảnh, tra `(face, col, row)` cho từng tia.
- Tia rơi sát mép tile (< 4% cạnh tile) thì thêm cả tile bên cạnh, tránh viền đen khi nội suy.
- Mỗi mặt lấy **hình chữ nhật bao** các tile trúng: `{ c0, r0, cols, rows }`. Mặt không trúng tia nào thì bỏ qua.

#### 6.2.8. Tải tile và ghép texture

- Mỗi mặt: một canvas 2D kích thước `cols·512 × rows·512`, nền `#111`.
- Tải song song mọi tile, vẽ vào vị trí `((col−c0)·512, (row−r0)·512)`.
- Tile lỗi thì bỏ qua (giữ nền tối), không làm hỏng cả ảnh.
- Gọi `onProgress(done, total)` sau mỗi tile → UI hiện *"Tile 12/30"*.

#### 6.2.9. Render WebGL

- Canvas offscreen 1200×630, `getContext('webgl', { preserveDrawingBuffer: true })`.
- Vẽ một hình chữ nhật phủ màn hình (2 tam giác, `TRIANGLE_STRIP` 4 đỉnh `(−1,−1) (1,−1) (−1,1) (1,1)`).
- 6 texture (`t0..t5` theo thứ tự `r l u d f b`), mặt không dùng thì gán texture 1×1. Thông số `CLAMP_TO_EDGE` + `LINEAR`.
- Uniform: `uTanH`, `uAspect`, `uYaw`, `uPitch` (radian, đã nhân dấu), `uN = n`, `rect0..5 = (c0, r0, cols, rows)` của từng mặt.
- **Fragment shader** làm lại đúng 6.2.5 cho từng pixel: dựng tia → xoay pitch rồi yaw → chọn mặt → `uv`,
  rồi đổi sang toạ độ trong texture ghép: `(uv·uN − rect.xy) / rect.zw`.
- `canvas.toBlob(..., 'image/jpeg', 0.9)` → Blob.

#### 6.2.10. Luồng trên giao diện

1. Bấm chụp → đọc camera thật (6.2.2) → trạng thái *"Đang tải tile…"*, nút bị khoá.
2. `renderPanoShot({ pano, yaw, pitch, fov, onProgress })` → *"Tile d/t"*.
3. *"Đang tải lên…"* → `POST` upload (6.1) với file `<slug>.jpg`
   (ảnh cá nhân dùng slug `<page_slug>-<user_slug>`).
4. Gán `image = <url trả về>` vào form OG → preview card đổi ảnh → toast *"Đã chụp ảnh chia sẻ — bấm Lưu để áp dụng"*.
5. Lỗi (không có WebGL, shader lỗi, upload lỗi) → toast lỗi với nội dung thông báo; luôn trả nút về trạng thái thường.

#### 6.2.11. Áp sang tour khác

- Player khác 3DVista (krpano, Pannellum, Marzipano...) → chỉ cần đổi **đường dẫn tile**, **bảng hệ trục mặt** (6.2.4)
  và hai hằng số dấu. Phần tính tia, chọn zoom, tính tile và shader giữ nguyên.
- Nguồn là ảnh equirectangular thay vì cube → bỏ 6.2.6–6.2.8, nạp một texture duy nhất,
  shader tra `uv = (atan(d.x, −d.z)/2π + 0.5, acos(d.y)/π)`.

---

## 7. Màn hình admin

### 7.1. Admin (quyền quản lý nội dung)

Tab **Chia sẻ OG** trong trang chi tiết mỗi trang chia sẻ:

- **Preview card** mô phỏng post mạng xã hội: ảnh 1.91:1, host, tiêu đề, mô tả. Chưa có ảnh → placeholder *"Chưa có ảnh — chụp hoặc dán URL"*.
- Chọn ngôn ngữ **VI / EN**; preview + các ô nhập đổi theo; EN rỗng hiển thị bản VI.
- Ô nhập: Tiêu đề, Mô tả, URL ảnh. Nút chụp/upload ảnh.
- Dòng gợi ý: dùng chung cho N trang hay riêng; nguồn mặc định; badge *đã tuỳ chỉnh*.
- Sửa OG ở một trang → cập nhật ngay mọi trang cùng `meta_key` trên giao diện.
- Đánh dấu **chưa lưu** (dirty); Lưu từng trang hoặc Lưu tất cả (bulk: validate hết trước, lỗi thì rollback, báo trang nào lỗi).

Validate khi lưu: `titleVi`, `descriptionVi` bắt buộc; ảnh phải `http(s)://` hoặc `/`; cắt độ dài theo mục 3.1 → `422 invalid_metadata`.

### 7.2. Cá nhân (sale/tác giả)

- Tab **Chia sẻ (OG)** theo từng trang: ô nhập để trống = *"Theo cấu hình chung"* (placeholder hiện giá trị đang hiệu lực); có nút trả về mặc định.
- Ảnh cá nhân upload với slug `<page_slug>-<user_slug>` để không đè ảnh của admin.
- Mục **Chia sẻ trang của tôi**: sửa `home_og` + preview card.
- Lưu qua `PATCH /auth/me/profile { share_settings }` — giữ nguyên các phần khác của `share_settings`.
- Validate ghi đè: trim, cắt độ dài, ảnh sai định dạng thì **bỏ** (không báo lỗi), không còn field nào → `null`.

---

## 8. Nút "Chia sẻ" trên trang công khai

Server truyền xuống client (vd. `window.__SITE__`):
`share: { prefix, scenes: { <id trang đang hiển thị>: <url_slug> } }` và `sale: { slug, host }` nếu có.

Khi bấm:

1. Xác định trang đang xem → tra `url_slug`. Không có link ngắn → dùng `/`.
2. Ghép `origin + [/prefix]/url_slug`.
3. Thêm `?sale=<slug>` **chỉ khi** đang có người phụ trách và hostname hiện tại **không phải** subdomain riêng của họ
   (lead từ link chia sẻ quy về đúng người).
4. Ghi analytics: hotspot `share:scene`, event `cta_clicked { channel: "share" }`.
5. Có `navigator.share` → mở share sheet hệ điều hành (huỷ thì bỏ qua).
   Không có → `navigator.clipboard.writeText` + toast *"Đã sao chép link"*; clipboard lỗi → `window.prompt` để tự copy.

---

## 9. Cấu hình (env)

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `SITE_NAME` | `Showroom 360` | Hậu tố tiêu đề + `og:site_name` |
| `DEFAULT_OG_IMAGE` | `/share-images/default-og.jpg` | Ảnh khi không có ảnh nào |
| `SHORTLINK_PREFIX` | rỗng | Có giá trị → link ngắn thành `/<prefix>/<url_slug>` |
| Thư mục ảnh | `share-images/` | Thêm vào `.gitignore`, mount volume khi deploy |

---

## 10. Checklist kiểm thử

- [ ] `curl -A facebookexternalhit <link>` trả HTML có đúng **một** bộ `og:*`, ảnh là URL tuyệt đối.
- [ ] Facebook Sharing Debugger / Zalo hiện đúng tiêu đề, mô tả, ảnh 1200×630.
- [ ] `?lang=en` ra bản EN; EN rỗng lùi về VI.
- [ ] `?sale=<slug>` ra OG cá nhân; `canonical` vẫn không có `?sale=`.
- [ ] Đổi `url_slug` → link cũ 301 sang link mới, giữ query.
- [ ] Upload lại ảnh → URL mới, crawler lấy ảnh mới sau khi scrape lại.
- [ ] Sau reverse proxy HTTPS: `og:url`, `og:image` là `https://`, có `og:image:secure_url`.
- [ ] Ký tự `"`, `<`, `&` trong tiêu đề/mô tả không làm vỡ HTML.
- [ ] Nút Chia sẻ: mobile mở share sheet, desktop copy link + toast.
