# VR360 — Lưu góc nhìn cho từng cảnh: đặc tả cho Backend

Tài liệu này mô tả phần **backend + dashboard** cần làm để admin chọn và lưu góc nhìn mở đầu cho
từng cảnh VR360. Phần website (frontend) **đã làm xong** và đang chờ API trả dữ liệu.

---

## 1. Tính năng và nguyên tắc

| Ai | Làm gì |
|---|---|
| **Admin (dashboard)** | Chọn cảnh → kéo xoay tới góc đẹp → bấm **Lưu** |
| **Website** | Mỗi khi mở cảnh đó sẽ vào thẳng **đúng góc đã lưu** |
| **Khách** | Chỉ xem. Có nút **Share** — link chỉ ghi *cảnh nào*, **không ghi góc** |

Nguyên tắc quan trọng: **backend là nơi duy nhất giữ góc.** Admin đổi góc từ 1 sang 2 thì mọi người
mở website — kể cả mở lại link đã share từ trước — đều thấy góc 2. Vì vậy backend không cần làm gì
cho link share.

---

## 2. Luồng tổng thể

```
┌─ Dashboard (travel.link360.vn) ────────────────────────────────┐
│  Chọn cảnh: [Lobby ▼]                                           │
│  ┌─ iframe: https://<domain-khach-san>/vr360-angle-picker.html ┐│
│  │  tour thật (assets/vr-data), admin kéo xoay                  ││
│  │  ── postMessage { yaw, pitch, hfov } ──►                     ││
│  └──────────────────────────────────────────────────────────────┘│
│  yaw 120.5 · pitch -5.2        [💾 Lưu] ──► API backend (mục 4.2) │
└──────────────────────────────────────────────────────────────────┘

Website khách sạn ── GET /vr-hotel/vr360/settings (mục 4.1) ──► scenes[].yaw/pitch ──► áp góc
```

**Vì sao dashboard phải nhúng trang của website mà không tự hiển thị tour?**
Tour 3DVista (`assets/vr-data`, vài trăm MB) chỉ nằm trên hosting của từng khách sạn. Trình duyệt
chặn trang ở domain `travel.link360.vn` đọc camera của tour ở domain khác (same-origin policy).
Trang `vr360-angle-picker.html` nằm cùng domain với tour nên đọc được, rồi gửi con số lên dashboard
bằng `postMessage`, cách mà trình duyệt cho phép 2 domain khác nhau trao đổi dữ liệu.
→ **Backend KHÔNG cần copy thư mục vr-data.**

---

## 3. Dữ liệu cần lưu

Thêm 3 trường vào **mỗi scene** (các scene hiện đang nhận qua endpoint sync VR360):

| Trường | Kiểu | Ràng buộc | Ý nghĩa |
|---|---|---|---|
| `yaw` | decimal(6,2), **nullable** | -360 … 360 | Góc xoay ngang (độ) |
| `pitch` | decimal(6,2), **nullable** | -90 … 90 | Góc ngẩng/cúi (độ) |
| `hfov` | decimal(6,2), **nullable** | 1 … 180 | Độ zoom lúc lưu. **Chỉ lưu tham khảo** — frontend hiện chưa áp |

- `yaw = null` **hoặc** `pitch = null` → cảnh chưa đặt góc → website dùng góc gốc của tour.
- "Về góc gốc" trên dashboard = lưu `yaw`, `pitch`, `hfov` về `null`.
- Tuỳ chọn, nên có: `view_updated_at`, `view_updated_by` để biết ai đổi góc lúc nào.

### Khoá nhận diện scene

Mỗi scene có:

- `id` dạng `panorama_<UUID>` — do 3DVista sinh. ⚠️ **UUID đổi toàn bộ mỗi lần xuất lại tour.**
- `name` — nhãn cảnh trong tour, thường giữ nguyên khi xuất lại.

---

## 4. API

### 4.1 Trả góc cho website — `GET /api/v1/vr-hotel/vr360/settings` *(bắt buộc)*

Frontend **đang gọi sẵn** endpoint này. Chỉ cần thêm 3 trường vào từng phần tử của `scenes`:

```json
{
  "scenes": [
    {
      "id": "panorama_5CFC7250_7D4D_200A_41C1_33BF0DB09AAA",
      "name": "Lobby",
      "subtitle": "",
      "panorama_url": "https://khachsan.com/?viewer=vr360&scene=Lobby",
      "order": 0,
      "yaw": 120.5,
      "pitch": -5.2,
      "hfov": 95
    },
    {
      "id": "panorama_EE1BBC5B_E01A_0F45_41B6_C73762A54FBB",
      "name": "Pool",
      "order": 1,
      "yaw": null,
      "pitch": null,
      "hfov": null
    }
  ],
  "sections": { "...": "giữ nguyên như hiện tại" }
}
```

- Số trả dạng **number** hoặc chuỗi số (`"120.50"`) đều được; frontend tự chuyển kiểu.
- **Không cache lâu** response này ở phía backend. Nếu có cache, phải xoá cache của property khi
  lưu góc. Website luôn gọi lại endpoint này mỗi lần tải trang, nên góc mới có hiệu lực ở lần tải
  trang kế tiếp.

### 4.2 Lưu góc từ dashboard *(đề xuất — backend chọn cách phù hợp)*

```
PATCH /api/v1/vr-hotel/vr360/scenes/{scene_id}/view
Headers: Authorization (admin), x-tenant-code, x-property-id  — như các API admin khác
Body:    { "yaw": 120.5, "pitch": -5.2, "hfov": 95 }
         { "yaw": null,  "pitch": null, "hfov": null }   ← về góc gốc
200 →    { "id": "panorama_…", "name": "Lobby", "yaw": 120.5, "pitch": -5.2, "hfov": 95 }
404 →    scene không thuộc property
422 →    sai kiểu / ngoài khoảng (mục 3)
```

Làm tròn 2 chữ số thập phân. Nếu dashboard đã có form sửa scene thì thêm 3 trường vào endpoint sẵn
có cũng được. Frontend không gọi endpoint này, chỉ dashboard gọi.

### 4.3 Endpoint sync scene hiện tại *(bắt buộc sửa)*

Trang `/vr360-scene-sync` của website định kỳ gửi danh sách scene lên backend (`id`, `name`,
`subtitle`, `panorama_url`, `order`). Payload **không chứa** góc. Khi xử lý sync:

1. **Không được xoá / ghi đè** `yaw`, `pitch`, `hfov` đang có.
2. Ghép scene cũ ↔ scene mới theo `id` trước; **nếu không khớp id thì ghép theo `name`**. Làm vậy vì
   xuất lại tour đổi hết UUID, ghép theo tên mới giữ được góc đã lưu.
3. Scene mới chưa từng có → 3 trường = `null`.

---

## 5. Màn "Góc nhìn cảnh" trong dashboard

### 5.1 Nhúng trang picker

```html
<iframe
  id="vr360-picker"
  src="https://<domain-website-khach-san>/vr360-angle-picker.html"
  allow="fullscreen; xr-spatial-tracking; gyroscope; accelerometer"
  style="width:100%; aspect-ratio:16/9; border:0">
</iframe>
```

- `<domain-website-khach-san>` là "domain website" của tenant/property, một trong 6 thông tin khi tạo
  khách sạn.
- Website đã cấu hình **chỉ cho `https://travel.link360.vn` nhúng** trang này (header
  `Content-Security-Policy: frame-ancestors`). Dashboard chạy ở domain khác (staging, localhost…)
  thì báo frontend để thêm vào danh sách.
- Mở trực tiếp trang này trên trình duyệt (không qua iframe) sẽ hiện thanh công cụ nhỏ: chọn cảnh,
  xem số yaw/pitch/hfov, copy JSON. Dùng để test nhanh.

### 5.2 Giao thức postMessage

Mọi message là object có `ns: "hotellink.vr360"`. Trường `requestId` là tuỳ chọn; nếu gửi kèm,
picker trả lại đúng `requestId` đó để dashboard ghép cặp request/response.

**Dashboard → picker** (gửi bằng `iframe.contentWindow.postMessage(msg, "https://<domain-website>")`):

| `type` | Trường thêm | Tác dụng |
|---|---|---|
| `hello` | — | Yêu cầu picker gửi lại `ready` (khi dashboard gắn listener muộn) |
| `open` | `scene: { id?, name? }`, `pose?: { yaw, pitch } \| null` | Mở cảnh. Có `pose` → mở ở góc đó (góc đã lưu). `null` → mở ở góc gốc của tour |
| `get-pose` | — | Hỏi góc hiện tại → picker trả `pose`. **Gọi ngay trước khi Lưu** |
| `set-pose` | `pose: { yaw, pitch }` | Quay cảnh đang mở tới góc này (xem thử / hoàn tác) |

**Picker → dashboard**:

| `type` | Trường | Khi nào |
|---|---|---|
| `ready` | `scenes: [{ index, id, name, defaultPose: {yaw,pitch} \| null }]`, `current: {id,name}` | Tour tải xong. `defaultPose` là góc gốc tác giả tour đặt |
| `pose` | `scene: {id,name}`, `yaw`, `pitch`, `hfov`, `userInitiated` | Mỗi khi camera đổi rồi đứng yên (~0,5s), hoặc trả lời `get-pose`. `userInitiated: true` = do admin kéo → nên bật trạng thái "chưa lưu" |
| `opened` | `ok`, `scene` | Trả lời `open` |
| `error` | `message` | Không tìm thấy tour / cảnh |

Mọi message đều có thêm `version: 1`.

### 5.3 Code mẫu phía dashboard

```js
const WEBSITE_ORIGIN = 'https://khachsan.com';            // domain website của property
const NS = 'hotellink.vr360';
const picker = document.getElementById('vr360-picker');
let currentPose = null;

const send = (msg) => picker.contentWindow.postMessage({ ns: NS, ...msg }, WEBSITE_ORIGIN);

window.addEventListener('message', (event) => {
  if (event.origin !== WEBSITE_ORIGIN || event.data?.ns !== NS) return;   // BẮT BUỘC kiểm origin
  const msg = event.data;

  if (msg.type === 'ready') {
    renderSceneList(msg.scenes);                                         // hoặc dùng danh sách scene của backend
  }
  if (msg.type === 'pose') {
    currentPose = msg;
    showNumbers(msg.yaw, msg.pitch, msg.hfov);
    if (msg.userInitiated) markDirty();
  }
});

picker.addEventListener('load', () => send({ type: 'hello' }));

// Chọn cảnh trong danh sách → mở ở góc đã lưu (nếu có)
function selectScene(scene) {
  const pose = scene.yaw != null && scene.pitch != null ? { yaw: scene.yaw, pitch: scene.pitch } : null;
  send({ type: 'open', scene: { id: scene.id, name: scene.name }, pose });
}

// Lưu: hỏi lại góc thật ngay trước khi gửi API
function save(scene) {
  const requestId = crypto.randomUUID();
  const onPose = async (event) => {
    if (event.origin !== WEBSITE_ORIGIN || event.data?.requestId !== requestId) return;
    window.removeEventListener('message', onPose);
    const { yaw, pitch, hfov } = event.data;
    await api.patch(`/vr-hotel/vr360/scenes/${scene.id}/view`, { yaw, pitch, hfov });
  };
  window.addEventListener('message', onPose);
  send({ type: 'get-pose', requestId });
}

// Về góc gốc
async function resetScene(scene) {
  await api.patch(`/vr-hotel/vr360/scenes/${scene.id}/view`, { yaw: null, pitch: null, hfov: null });
  send({ type: 'open', scene: { id: scene.id, name: scene.name }, pose: null });
}
```

### 5.4 Gợi ý UI

- Danh sách cảnh bên trái (từ API backend, có dấu ✓ cho cảnh đã đặt góc), iframe ở giữa, thanh
  dưới hiện `yaw · pitch · hfov` và các nút **Lưu** / **Về góc gốc**.
- Cảnh chưa lưu mà admin chọn cảnh khác → hỏi xác nhận.

---

## 6. Bảo mật

- Trang picker **công khai, chỉ đọc**, không có token và không ghi được gì. Mọi thao tác lưu đi qua
  API admin của backend có xác thực như bình thường.
- Dashboard **bắt buộc** kiểm `event.origin === WEBSITE_ORIGIN` trước khi tin một message.
- Picker chỉ nhận lệnh từ các origin được phép, cấu hình qua `VITE_VR360_PICKER_ALLOWED_ORIGINS`,
  mặc định `https://travel.link360.vn`.

---

## 7. Kiểm thử nghiệm thu

1. Gọi `GET /vr-hotel/vr360/settings` → mỗi scene có `yaw`, `pitch`, `hfov` (có thể `null`).
2. Dashboard: chọn cảnh → iframe hiện tour → kéo xoay → số trên dashboard đổi theo.
3. Bấm Lưu → gọi lại GET ở bước 1 thấy số mới.
4. Mở website ở trang dùng cảnh đó → vào đúng góc vừa lưu. **Kiểm cả điện thoại**, vì desktop và
   mobile dùng 2 bộ skin 3DVista khác nhau.
5. Bấm Share trên website, copy link. Đổi góc trên dashboard rồi lưu. Mở link cũ trong tab ẩn danh
   → thấy **góc mới**.
6. Chạy lại trang `/vr360-scene-sync` (sync scene) → góc đã lưu **không bị mất**.
7. "Về góc gốc" → website quay về góc mặc định của tour.

---

## 8. Phía frontend đã làm (để tham chiếu)

| Việc | File |
|---|---|
| Đọc `yaw/pitch/hfov` từ API | `src/services/settingsService.ts`, `src/types/settings.ts` |
| Áp góc khi mở cảnh (kể cả khi khách đi qua hotspot trong tour) | `src/utils/vr360Camera.ts`, `src/components/common/ThreeDVistaBackground.tsx` |
| Nút Share, link `?scene=<tên cảnh>` | `src/components/common/ShareSceneButton.tsx`, `src/App.tsx` |
| Trang picker cho dashboard | `vr360-angle-picker.html`, `src/picker/vr360AnglePicker.ts` |
| Cho phép dashboard nhúng picker | `server/.htaccess` |
