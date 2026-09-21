# Project Architecture

## 1. Muc tieu kien truc

Du an nay phu hop nhat voi mo hinh:

- `multi-tenant frontend shell`
- `domain-oriented modules`
- `shared data-access layer`
- `deployment-aware config`

Thay vi tiep tuc tang them logic vao `App.tsx`, kien truc nen duoc chia thanh cac tang ro rang de:

- giam coupling giua UI va API
- de nhan ban cho nhieu khach san
- de thay doi route, locale, theme, SEO ma khong va cham toan app
- de refactor dan tung phan ma khong can viet lai tu dau

## 2. Hien trang codebase

Codebase hien tai da co nen tang tot:

- `src/api.ts`: HTTP client, auth token, tenant/property headers
- `src/services/*`: goi API va transform du lieu
- `src/hooks/*`: quan ly fetch state cho UI
- `src/context/*`: state toan cuc cho property, language, theme
- `src/components/common/*`: UI dung lai
- `src/pages/*`: entry theo route
- `server/*`: PHP proxy va artifact cho moi truong deploy
- `scripts/*`: build support va setup tenant moi

Van de chinh hien tai:

- `src/App.tsx` dang dong vai tro `app shell`, `route resolver`, `page orchestrator`, `view state manager`, `background media controller`
- module dang tach theo technical layer, nhung business domain nhu `rooms`, `offers`, `dining`, `facility`, `service` van bi dan trai qua `types/hooks/services/components`
- mot so logic cache, transform, fallback dang nam trong hook, kho tai su dung va kho test
- router va page shell chua duoc tach rieng nen viec them trang moi se tiep tuc lam file goc phinh ra

## 3. Kien truc de xuat

Su dung cau truc theo domain, nhung khong qua hoc thuat. Muc tieu la de chuyen doi tu code hien tai sang kien truc moi theo tung buoc.

```text
src/
  app/
    providers/
    router/
    layouts/
    bootstrap/

  shared/
    api/
    config/
    lib/
    ui/
    types/
    constants/

  entities/
    property/
    locale/
    media/
    settings/

  features/
    shell-navigation/
    shell-infobox/
    route-background/
    booking/
    seo/
    theme/

  widgets/
    home-content/
    about-content/
    rooms-content/
    dining-content/
    facility-content/
    service-content/
    offers-content/
    policy-content/
    contact-content/
    regulation-content/
    gallery-content/

  pages/
    home/
    about/
    rooms/
    offers/
    api-test/
```

## 4. Nguyen tac chia tang

### `app/`

Chua nhung thu khoi dong ung dung:

- providers goc
- router
- app layout
- app shell

Khong chua logic business cua `room`, `offer`, `contact`.

### `shared/`

Chua cac thu dung chung, khong gan domain:

- axios client base
- config doc tu `window` hoac `.env`
- helper routes, cache, formatting
- UI primitives
- generic TypeScript helpers

Code trong `shared/` khong import nguoc tu `features`, `widgets`, `pages`.

### `entities/`

Chua business model co tinh on dinh:

- `property`
- `settings`
- `locale`
- `media`

Moi entity nen co:

- `types.ts`
- `service.ts`
- `model.ts` hoac `mapper.ts`
- `hooks.ts` neu can

Vi du: logic doi `media_id -> url` nen nam o `entities/media`.

### `features/`

Chua use-case co hanh vi ro rang:

- doi ngon ngu
- dong mo info box
- doi VR360 background theo route
- redirect booking
- inject SEO

Feature co the dung nhieu entities va shared utilities, nhung khong chua page hoan chinh.

### `widgets/`

Chua khoi UI lon gan voi man hinh:

- room list/detail content
- dining content
- offer content
- contact content

Day la noi ghep `hooks + presentational components + handlers` de tao ra khoi UI co nghia.

### `pages/`

Chi la diem vao theo route:

- lay params
- chon widget/layout phu hop
- khong fetch linh tinh neu co the day xuong `widgets` hoac `features`

## 5. Data flow chuan

Luong du lieu nen thong nhat nhu sau:

```text
Route / User action
  -> Page
  -> Widget
  -> Feature hook
  -> Entity service
  -> shared/api client
  -> Backend API
```

Quy tac:

- `api client` xu ly auth, tenant, property header, retry
- `service` chi goi API va map DTO sang model
- `hook` chi quan ly lifecycle fetch, loading, error, cache orchestration nhe
- `component/widget` khong tu goi `axios`

## 6. App shell target

`App.tsx` nen duoc rut gon thanh:

```tsx
export function App() {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
}
```

Logic lon hien dang o `AppLayout` nen tach thanh cac feature/widget rieng:

- `features/route-background`
  - quyet dinh dang hien `image | youtube | vr360 iframe`
  - xu ly load state va fallback

- `features/shell-infobox`
  - quan ly open/close tren desktop va mobile
  - quyet dinh widget nao duoc render theo route

- `features/booking`
  - redirect booking page theo `settings.booking_url`

- `features/seo`
  - lay metadata theo route va locale

- `app/layouts/MainShell`
  - ghep `Header`, `BottomBar`, `RouteBackground`, `InfoPanel`

## 7. Kien truc module domain

Moi domain lon nen follow chung mot pattern:

```text
src/widgets/rooms-content/
  index.ts
  RoomsContent.tsx

src/entities/room/
  types.ts
  room.service.ts
  room.mapper.ts
  room.hooks.ts
```

Co the ap dung cho:

- `room`
- `dining`
- `facility`
- `service`
- `offer`
- `policy`
- `regulation`
- `contact`
- `property-post`

Pattern nay phu hop voi hien trang vi repo da co `services + hooks + types`, chi can gom lai theo domain.

## 8. Quy tac state management

Chi giu `context` cho state that su global:

- current property
- current locale
- theme tokens
- app shell state neu nhieu man hinh can dung chung

Khong dua vao context cac state cuc bo nhu:

- item dang chon trong room list
- modal gallery dang mo
- detail code tu route

Nhung state nay nen nam o widget/feature.

## 9. Cache strategy

Cache nen chia 3 muc:

### Muc 1: request/session cache

Cho cac data thay doi it:

- locales
- settings
- property detail

### Muc 2: localStorage cache co TTL

Chi dung cho:

- settings
- logo/favicon
- locale preference

Khong nen trai cache localStorage khap cac hook neu chua co utility chung. Nen gom vao:

- `shared/lib/cache.ts`

### Muc 3: in-memory transform cache

Cho cac tac vu map DTO -> UI model neu du lieu lon va lap lai.

## 10. Config va deployment architecture

Du an nay co 2 che do config, can giu ro rang:

- `development`: doc tu `.env`
- `production`: doc tu `window.__INITIAL_DATA__` va `api-proxy.php`

Kien truc nen xem day la mot phan chinh thuc cua he thong, khong phai workaround.

Quy uoc:

- moi config runtime tap trung trong `shared/config`
- khong doc `import.meta.env` truc tiep o nhieu noi
- moi service dung chung config qua `appConfig`

## 11. Testing strategy de xuat

Ngay ca khi chua them framework test, kien truc nen san sang cho test:

- `shared/api`: test retry/auth behavior
- `entities/*/mapper`: test transform DTO -> UI model
- `features/booking`: test redirect decision
- `features/route-background`: test media type va fallback

Neu bo sung test sau nay, uu tien:

1. unit test cho mapper va helper
2. integration test cho hooks/service
3. smoke test cho page shell quan trong

## 12. Lo trinh refactor khuyen nghi

### Phase 1: on dinh va tach shell

- tao `app/providers/AppProviders`
- tao `app/router/AppRouter`
- tao `app/layouts/MainShell`
- giu nguyen business logic, chi tach khoi `App.tsx`

### Phase 2: gom theo domain

- chuyen `types/services/hooks` cua `rooms` vao cung mot module
- lap lai voi `offers`, `dining`, `facility`, `service`

### Phase 3: tach feature dung chung

- `route-background`
- `shell-infobox`
- `booking`
- `seo`

### Phase 4: chuan hoa shared layer

- gom cache utility
- gom route utility
- gom media helper
- loai bo duplicate transform/fallback logic

## 13. Cau truc migration cu the cho repo nay

Day la mapping truc tiep tu hien trang sang target:

- `src/api.ts` -> `src/shared/api/client.ts`
- `src/config.ts` -> `src/shared/config/appConfig.ts`
- `src/context/*` -> `src/app/providers` hoac `src/entities/*`
- `src/services/roomService.ts` -> `src/entities/room/room.service.ts`
- `src/hooks/useRooms.ts` -> `src/entities/room/room.hooks.ts`
- `src/components/common/RoomsView.tsx` -> `src/widgets/rooms-content/RoomsContent.tsx`
- `src/components/common/SEOMeta.tsx` -> `src/features/seo/SEOMeta.tsx`
- `src/components/ThemeInjector.tsx` -> `src/features/theme/ThemeInjector.tsx`

Khong can chuyen tat ca trong 1 lan. Muc tieu la dua module moi vao truoc, sau do chuyen import dan.

## 14. Rule import de tranh roi lai

Nen ap dung quy tac mot chieu:

- `pages` -> import tu `widgets`, `features`, `entities`, `shared`
- `widgets` -> import tu `features`, `entities`, `shared`
- `features` -> import tu `entities`, `shared`
- `entities` -> import tu `shared`
- `shared` -> khong import nguoc

Neu giu duoc quy tac nay, codebase se kho bi "xoan import" tro lai.

## 15. Kien nghi thuc te cho du an nay

Neu chi uu tien 20% cong viec de giai quyet 80% van de, hay lam 3 viec sau truoc:

1. Rut gon `App.tsx` thanh `providers + router + shell`
2. Gom `rooms/dining/facility/service/offers` thanh domain module
3. Tach cache va background routing logic ra khoi component goc

Chi rieng 3 buoc nay da du de:

- giam do lon file trung tam
- them man hinh moi de hon
- giam bug khi doi locale/property/route
- de onboarding dev moi hon

## 16. Ket luan

Kien truc phu hop nhat cho repo nay khong phai micro-frontend hay state manager phuc tap. Huong di dung la:

- `app shell` ro rang
- `domain modules` cho business
- `shared infrastructure` cho API/config/cache
- refactor dan, khong rewrite

Do la huong vua an toan cho du an dang chay, vua de nhan ban cho nhieu hotel sau nay.
