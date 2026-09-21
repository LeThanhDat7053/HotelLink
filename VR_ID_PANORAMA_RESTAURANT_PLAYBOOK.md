# VR ID PANORAMA RESTAURANT PLAYBOOK

Tai lieu nay chuan hoa toan bo logic `target_id / panorama name / local viewer` sau khi da fix thuc te tren Restaurant. Muc tieu la de AI migrate `Hotel` va `Park` khong lap lai chuoi loi:

- co `target_id` nhung khong hien canh
- resolve ra scene nhung viewer trang
- page dung local VR nhung van bi `vr360_link` de len
- title/page state dung nhung runtime 3DVista chua ready

## 1. Mental model bat buoc

Local VR hien tai khong mo scene truc tiep bang `target_id`.

Flow dung la:

1. backend tra `target_id`
2. frontend co scene list that
3. resolver map `target_id -> scene.name`
4. `ThreeDVistaBackground` goi:
   - `openPanoramaByName(scene.name)`
   - hoac `tour.setMediaByName(scene.name)`

Neu bo qua buoc 2 hoac 3 thi scene se khong bao gio mo dung.

## 2. Structure du lieu chuan

### 2.1. Page settings

```ts
type PageSettings = {
  target_id?: string | number | null;
  panorama_url?: string | null;
  vr360_link?: string;
  vr_title?: string;
  title_translations?: Record<string, string>;
};
```

### 2.2. Scene item

```ts
type Vr360SceneItem = {
  id: string;
  name: string;
  subtitle?: string;
  panorama_url: string;
  order: number;
};
```

### 2.3. Y nghia tung field

- `target_id`
  - khoa ky thuat backend luu tren page/section
- `scene.id`
  - khoa ky thuat scene trong export hoac scene sync backend
- `scene.name`
  - ten ma runtime 3DVista thuc su hieu de mo canh
- `panorama_url`
  - fallback URL noi bo dang `/?viewer=vr360&scene=<sceneName>`

## 3. Mapping dung giua id va panorama

### 3.1. Rule resolve da chot

Trong `src/utils/vr360SceneResolver.ts`, resolver dung phai la:

1. neu `target_id` la so duong
   - map theo `order`
2. neu `target_id` la string
   - match `scene.id`
   - fallback `scene.name`
3. neu van khong ra
   - parse tu `panorama_url`

### 3.2. Vi du dung

```json
{
  "target_id": "panorama_1F3621C0_0EE2_8F12_41A0_744398EE7BE4",
  "scene_name": "pano-01",
  "panorama_url": "/?viewer=vr360&scene=pano-01"
}
```

Ket qua dung:

- `target_id` match `scene.id`
- resolver tra `pano-01`
- runtime mo:

```ts
tour.setMediaByName("pano-01")
```

### 3.3. Pattern cam

- Dung `target_id` lam tham so truyen thang vao `setMediaByName`
- Hardcode:

```ts
"1" -> "pano-01"
```

- Dung title UI de suy ra scene name

## 4. Scene list phai den tu export that

Scene list hien tai duoc parse tu:

- `locale/en.txt`
- `script_general.js`

Khong duoc:

- viet tay `pano-01`, `pano-02`, `pano-03`
- copy scene list mau tu swagger
- dung du lieu `"string"` tu backend lam scene that

## 5. Fallback logic da chot

### 5.1. Chon VR mode

- co `requestedSceneFromUrl`
  - local VR
- co `target_id`
  - local VR
- khong co `target_id` nhung resolve duoc `panorama_url`
  - local VR
- khong co local scene hop le nhung co `vr360_link`
  - external VR

### 5.2. Fallback title menu

- uu tien `title_translations[locale]`
- locale hien tai khong co thi fallback hardcode cua locale do
- khong dung `vr_title` de de len title menu list

## 6. Validation logic bat buoc truoc khi sua

Truoc khi sua VR theo id, AI phai kiem tra:

1. `GET /vr360/settings` co `target_id` that khong
2. scene list parse ra co item tuong ung khong
3. `scene.id` va `scene.name` khac nhau hay giong nhau
4. `panorama_url` co dung query `scene=<scene.name>` khong
5. page dang o mode `vr-id` hay `vr-link`
6. `ThreeDVistaBackground` co mount that khong
7. `rootPlayer` da san sang truoc khi goi scene chua

## 7. Cac loi that da tung gap

### 7.1. Backend co `target_id` nhung page van mo external VR

Nguyen nhan:

- `App.tsx` chon mode sai

Fix:

- `activeExternalVrUrl = shouldUseLocalVr ? null : ...`

### 7.2. Co `activePanoramaName` nhung viewer trang

Nguyen nhan:

- viewer candidate tro vao app shell HTML
- hoac `tour` chua ready

Fix:

- detect dung HTML viewer 3DVista
- doi `tour.player.getById('rootPlayer')`

### 7.3. `setMediaByName()` goi nham `scene.id`

Nguyen nhan:

- nham giua `scene.id` va `scene.name`

Fix:

- runtime chi mo theo `scene.name`

### 7.4. `events` va `achievements` de title/scene len nhau

Nguyen nhan:

- dung chung key `facilities`

Fix:

- tach `achievements` thanh key rieng trong `PagesSettings`

### 7.5. URL scene de vao menu route

Nguyen nhan:

- auto sync query scene vao page settings route

Fix:

- chi giu query scene khi user thuc su mo link scene truc tiep

## 8. Before / after structure

### 8.1. Before

- page chi co `vr360_link`
- scene name hardcode
- local viewer va external iframe de de nhau
- title menu khong on dinh theo locale

### 8.2. After

- page co `target_id`, `panorama_url`, `vr360_link`
- scene list parse that
- resolver co thu tu ro rang
- local VR uu tien hon
- scene direct URL vao `scene-only mode`
- title menu theo `title_translations[locale]`, thieu locale thi hardcode locale do

## 9. Pattern nen dung

- Dung adapter settings thay vi sua truc tiep tung component.
- Dung parser + resolver dung trung tam.
- Dung root query:

```text
/?viewer=vr360&scene=pano-03
```

- Dung `scene.name` cho runtime mo scene.
- Dung page-specific keys rieng cho `events`, `achievements`, `branches`, `promotions`, `spaces`.

## 10. Pattern cam

- Hardcode map id -> pano.
- Dung `vr360_link` de luon duoc uu tien.
- Goi scene khi iframe moi `onLoad` xong nhung `rootPlayer` chua san sang.
- Dung du lieu backend placeholder `"string"`.
- Dung title translation cua locale khac de bu sang locale hien tai neu business rule can strict locale.

## 11. Checklist verify sau khi sua

- [ ] `target_id` co trong page settings
- [ ] scene list parse that khong rong
- [ ] resolver tra ra `scene.name` dung
- [ ] `/?viewer=vr360&scene=pano-01` mo duoc scene
- [ ] page co `target_id` khong bi `vr360_link` de len
- [ ] `scene-only mode` an toan bo chrome UI
- [ ] `achievements` va `facilities` khong de len nhau
- [ ] menu title theo locale API, thieu locale thi hardcode

## 12. Debugging guide

Khi canh khong hien:

1. xem `currentPageSettings.target_id`
2. xem `vr360Scenes`
3. xem `resolvePanoramaNameFromPageSettings(...)`
4. xem viewer candidate nao duoc nhan
5. xem `rootPlayer` da co chua
6. xem `setMediaByName(scene.name)` co duoc goi khong

Khi title sai:

1. xem `title_translations`
2. xem locale hien tai
3. xem `Header` dang doc page key nao
4. xem page co bi map nham key legacy khong

## LESSONS LEARNED

- `target_id` khong phai scene name. Day la bai hoc lon nhat.
- Khong duoc sua local VR ma bo qua `App.tsx`, vi loi mode selection rat de che mat loi runtime that.
- Neu parser, viewer, build path, settings adapter khong dong bo cung mot tu duy, AI se fix lung tung va lap vo han.
- Tinh nang scene direct link nen duoc tinh tu dau vi no ep app shell phai sach logic hon.
