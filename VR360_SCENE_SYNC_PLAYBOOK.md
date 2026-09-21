# VR360 SCENE SYNC PLAYBOOK

Tai lieu nay chuan hoa flow `vr360-scene-sync` sau khi da duoc sua that tren Restaurant. Muc tieu la de cac du an sau nhu `Hotel` va `Park` co the:

- doc scene that tu bo export 3DVista
- preview scene list
- sync scene len backend bang `POST`
- giu local viewer va parser dung cung mot he quy chieu runtime
- tranh cac loi race condition, stale cache, app shell HTML, build xoa mat asset

## 1. Muc tieu dung cua helper

Route:

```text
/vr360-scene-sync
```

Page nay khong phai demo page. No phai:

1. doc scene that
2. preview scene list
3. build payload sync
4. gui `POST` len backend
5. sau build van mo duoc

## 2. Kien truc file chuan

- `src/pages/VR360SceneSyncPage.tsx`
- `src/services/vr360SceneSyncService.ts`
- `src/utils/vr360SceneParser.ts`
- `src/components/common/ThreeDVistaBackground.tsx`
- `src/constants/routes.ts`
- `src/config.ts`
- `vite.config.ts`
- `scripts/copy-server-files.js`

## 3. Flow synchronization day du

### 3.1. Scene discovery flow

1. page mount
2. parser tim base path hop le
3. parser fetch:
   - `locale/en.txt`
   - `script_general.js`
4. parser bo qua response HTML
5. parser build danh sach scene
6. page render preview

### 3.2. Backend scene read flow

1. helper co the `GET /vr360/scenes`
2. neu backend tra scene that thi doc duoc
3. neu backend tra placeholder `"string"` thi bo qua
4. fallback ve scene parse tu export

### 3.3. Sync submit flow

1. user bam sync
2. service lay endpoint tu `VITE_VR360_SCENE_SYNC_ENDPOINT`
3. build payload
4. `POST` JSON len backend
5. neu `PANORAMA_URL_DOMAIN` co cau hinh thi moi ghep full domain cho `panorama_url`

### 3.4. Render flow

1. parser source hop le -> `Scene Export Preview`
2. scene list co du item:
   - `order`
   - `id`
   - `name`
   - `subtitle`
   - `panorama_url`
3. payload preview duoc tao tu chinh scene list do

## 4. Lifecycle scene day du

### 4.1. Parse lifecycle

- bat dau o helper page
- cache parser promise de tranh doc lai vo ich
- cho phep force refresh khi user bam "Doc lai scene"

### 4.2. Runtime viewer lifecycle

- viewer local va parser dung cung bo export
- helper khong duoc parse bo export A roi runtime viewer lai dung export B

### 4.3. Sync lifecycle

- build payload tu scene parser
- khong bien doi scene name trong luc sync
- khong chen full domain vao parser
- chi chen full domain o service sync

## 5. Asset loading flow bat buoc

Bo export 3DVista phai dong bo:

- `vr-data/locale/en.txt`
- `vr-data/script_general.js`
- `vr-data/lib/...`
- `vr-data/skin/...`
- `panorama.js`

Khong duoc:

- tron `panorama.js` cua export khac
- copy tung file le tu nhieu nguon
- sua tay `vr-data`

## 6. Flow transition va preload lien quan

### 6.1. Transition local VR

Sau khi scene sync len backend, page thuong se dung:

- `target_id`
- `scene_name`
- `panorama_url`

de local viewer transition scene qua `setMediaByName`.

### 6.2. Preload

Helper khong phai preload toan bo scene vao viewer. Nhiem vu cua helper la:

- doc metadata scene that
- dong bo metadata ve backend

Runtime viewer moi chiu trach nhiem load canh that khi user mo page.

## 7. Race conditions da tung gap

### 7.1. Parser doc nham HTML app shell

Trieu chung:

- `200 OK`
- nhung parse ra rong

Nguyen nhan:

- Vite dev hoac server tra app shell thay vi text/js that

Fix:

- parser detect HTML va reject candidate do

### 7.2. Backend scenes tra placeholder `"string"`

Trieu chung:

- helper hien scene `string`
- source la backend nhung khong phai du lieu that

Fix:

- loc bo placeholder scene truoc khi dung backend response

### 7.3. Parser cache rong giu mai

Trieu chung:

- luc dau chua copy `vr-data` thi parser ra rong
- copy xong van khong thay doi

Fix:

- co `forceRefresh`
- nut "Doc lai scene" phai reset parser cache

### 7.4. Parser va viewer dung khac path

Trieu chung:

- helper page parse ra scene
- runtime page thuong van khong mo duoc scene local

Nguyen nhan:

- parser doc path A
- viewer load path B

Fix:

- dung cung danh sach candidate path giua parser va viewer

## 8. Bug render va state sync da tung gap

### 8.1. Route helper ton tai nhung render trang trang

Nguyen nhan:

- route chi la `<div />`

Fix:

- mount page that `VR360SceneSyncPage`

### 8.2. Scene list co du lieu nhung payload sai

Nguyen nhan:

- ghep full domain ngay tu parser

Fix:

- parser giu relative
- service sync moi ghep domain

### 8.3. Build xong helper mat asset

Nguyen nhan:

- build xoa sach `dist`

Fix:

- `build.emptyOutDir = false`
- script copy/static entrypoint

## 9. State update thu tu an toan

Trong helper page, thu tu dung nen la:

1. set loading
2. parse/fetch scene
3. set scene list
4. set parser diagnostics
5. set source
6. build payload tu scene list

Khong nen:

- set source la backend truoc khi validate backend scene
- set payload truoc khi scene list on dinh

## 10. Cleanup thu tu an toan

- parser promise co the giu cache, nhung phai cho phep reset khi can
- cac request background khong duoc tiep tuc spam khi route helper da unmount
- khong de `setState` sau unmount

## 11. Debugging guide

### 11.1. Khi helper khong parse duoc scene

Kiem tra:

1. `locale/en.txt` co mo duoc tren browser khong
2. `script_general.js` co mo duoc khong
3. response la text/js hay HTML
4. bo export co cung mot lan export khong

### 11.2. Khi helper parse duoc nhung page thuong van loi

Kiem tra:

1. `settingsService` co merge scene vao app khong
2. `target_id` co map dung qua resolver khong
3. `ThreeDVistaBackground` co cung candidate path voi parser khong

### 11.3. Khi sync len backend loi

Kiem tra:

1. `VITE_VR360_SCENE_SYNC_ENDPOINT`
2. method co phai `POST`
3. payload co dung shape:
   - `tenant_code`
   - `scenes`
4. `panorama_url` da ghep domain dung chua

## 12. Scene validation checklist

- [ ] scene list parse tu export that
- [ ] `id` khong rong
- [ ] `name` khong rong
- [ ] `panorama_url` la `/?viewer=vr360&scene=<name>`
- [ ] `order` co gia tri on dinh
- [ ] scene backend placeholder bi bo qua

## 13. Sync troubleshooting checklist

- [ ] route `/vr360-scene-sync` mo duoc
- [ ] helper khong render trang trang
- [ ] parser khong doc nham HTML
- [ ] parser va viewer dung cung runtime path
- [ ] payload preview dung shape
- [ ] sync endpoint dung `POST`
- [ ] build xong asset local van con

## 14. Performance optimization checklist

- [ ] parser co cache promise, tranh parse lai vo ich
- [ ] warm-up du lieu public khong chen vao helper flow sync
- [ ] helper khong preload scene image/texture khong can thiet
- [ ] khong spam request backend scenes khi backend chua support that

## 15. Build va deploy checklist

- [ ] `vite.config.ts` giu duoc `vr-data`, `panorama.js`
- [ ] static entrypoint helper duoc tao sau build
- [ ] production mo duoc `/vr360-scene-sync`
- [ ] local viewer va helper cung doc duoc bo export sau build

## 16. Anti-pattern can tranh

- Tao page demo parse scene nhung khong co `POST` service.
- Parse scene bang hardcode thay vi `locale/en.txt` + `script_general.js`.
- Dung bo export trong dev mot path, production mot path, nhung khong co fallback.
- Tin du lieu backend `"string"` la du lieu that.
- De parser va viewer dung hai bo export khac nhau.

## LESSONS LEARNED

- Helper scene sync phai duoc xem la mot phan runtime thuc su cua he thong, khong phai mot tool phu.
- Loi parse scene thuong khong nam o regex dau tien, ma nam o chuyen dang doc nham file HTML, nham path, hoac tron sai bo export.
- Cach tiet kiem thoi gian nhat cho future projects la chot cung mot logic candidate path cho parser va viewer ngay tu dau.
- Neu helper sync hoat dong ma page thuong khong hoat dong, loi thuong nam o `App.tsx` hoac `ThreeDVistaBackground`, khong nam o parser nua.
