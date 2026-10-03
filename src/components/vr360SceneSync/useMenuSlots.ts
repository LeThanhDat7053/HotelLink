import { useEffect, useMemo, useState } from 'react';
import { appConfig } from '../../config';
import { getMenuTranslations } from '../../constants/translations';
import { useVrHotelSettings } from '../../hooks/useVR360';
import { roomService } from '../../services/roomService';
import { getDiningsForUI } from '../../services/diningService';
import { getFacilitiesForUI } from '../../services/facilityService';
import { getServicesForUI } from '../../services/serviceService';
import { getOffersForUI } from '../../services/offerService';
import { mediaService } from '../../services/mediaService';
import type { PageSettings, Vr360SceneItem } from '../../types/settings';
import { resolvePanoramaNameFromPageSettings } from '../../utils/vr360SceneResolver';
import { SHARE_OG_PAGE_LABELS, type ShareOgEntity, type ShareOgSite } from '../../utils/shareOgDefaults';

/**
 * Một vị trí menu gắn VR360. `path` là khoá lưu trong data/vr360-views.json và trùng với
 * đường dẫn trang trên website (không tiền tố ngôn ngữ) — App tra cứu đúng theo nó.
 */
export interface MenuSlot {
  path: string;
  label: string;
  /** Nhãn đầy đủ để ghi vào JSON, vd "Phòng nghỉ › Deluxe Triple" */
  fullLabel: string;
  /** Cảnh backend đang gắn (target_id / panorama_url) — dùng khi chưa có cấu hình JSON */
  assignedSceneName: string | null;
  /** Trang chi tiết (phòng, nhà hàng…): dữ liệu để tính OG mặc định */
  ogEntity?: ShareOgEntity;
  children?: MenuSlot[];
}

interface DetailItem {
  code: string;
  name: string;
  description: string;
  image: string;
  targetId: string | null;
  panoramaUrl: string | null;
}

type DetailGroup = 'rooms' | 'dining' | 'facilities' | 'services' | 'offers';

// Giữ đúng path như điều hướng thật trên website (RoomsView → /phong-nghi/<code>, …)
const DETAIL_BASE_PATH: Record<DetailGroup, string> = {
  rooms: '/phong-nghi',
  dining: '/am-thuc',
  facilities: '/tien-ich',
  services: '/dich-vu',
  offers: '/uu-dai',
};

const toDetail = (item: {
  code?: string | null;
  name?: string;
  title?: string;
  description?: string;
  primaryImage?: string | null;
  galleryImages?: string[];
  targetId?: string | number | null;
  panoramaUrl?: string | null;
}): DetailItem | null =>
  item.code
    ? {
        code: item.code,
        name: item.name || item.title || item.code,
        description: item.description || '',
        // Ảnh đại diện → ảnh đầu tiên (khớp og_entity_image trong server/_og.php)
        image: item.primaryImage || item.galleryImages?.[0] || '',
        targetId: item.targetId === null || item.targetId === undefined ? null : String(item.targetId),
        panoramaUrl: item.panoramaUrl ?? null,
      }
    : null;

type DetailLists = Record<DetailGroup, DetailItem[]>;

const fetchDetails = async (propertyId: number, locale: string): Promise<DetailLists> => {
  const [rooms, dining, facilities, services, offers] = await Promise.allSettled([
    roomService.getRoomsForUI(propertyId, locale),
    getDiningsForUI(propertyId, locale),
    getFacilitiesForUI(propertyId, locale),
    getServicesForUI(propertyId, locale),
    getOffersForUI(propertyId, locale),
  ]);

  // Một danh sách lỗi (backend chậm/sập) không làm hỏng cả cây menu
  const pick = (result: PromiseSettledResult<unknown[]>) =>
    result.status === 'fulfilled'
      ? (result.value as Parameters<typeof toDetail>[0][]).map(toDetail).filter((item): item is DetailItem => !!item)
      : [];

  return {
    rooms: pick(rooms),
    dining: pick(dining),
    facilities: pick(facilities),
    services: pick(services),
    offers: pick(offers),
  };
};

/**
 * @param exportScenes cảnh đọc từ bản xuất 3DVista — chỉ dùng khi backend chưa có danh sách cảnh
 *                     (cùng thứ tự ưu tiên với effectiveVrScenes trong App.tsx)
 */
export const useMenuSlots = (locale: string, exportScenes: Vr360SceneItem[]) => {
  const propertyId = Number(appConfig.PROPERTY_ID || 0);
  const { settings, loading: settingsLoading } = useVrHotelSettings(propertyId || null);
  const backendScenes = useMemo(() => settings?.scenes ?? [], [settings?.scenes]);
  const scenes = backendScenes.length > 0 ? backendScenes : exportScenes;
  const [details, setDetails] = useState<DetailLists | null>(null);
  // Bản tiếng Anh — chỉ để tính OG mặc định /en/… (tên + mô tả)
  const [detailsEn, setDetailsEn] = useState<DetailLists | null>(null);

  useEffect(() => {
    if (!propertyId) return;
    let active = true;
    fetchDetails(propertyId, locale).then((result) => {
      if (active) setDetails(result);
    });
    fetchDetails(propertyId, 'en').then((result) => {
      if (active) setDetailsEn(result);
    });
    return () => {
      active = false;
    };
  }, [locale, propertyId]);

  const slots = useMemo<MenuSlot[]>(() => {
    const t = getMenuTranslations(locale);
    const sections = settings?.vr360_settings?.sections;
    const pages = settings?.pages;

    const sectionTitle = (key: string, fallback: string) =>
      sections?.[key]?.title_translations?.[locale] || sections?.[key]?.vr_title || fallback;

    const assigned = (pageSettings: PageSettings | null | undefined) =>
      resolvePanoramaNameFromPageSettings(pageSettings, scenes);

    const leaf = (path: string, label: string, pageSettings: PageSettings | null | undefined): MenuSlot => ({
      path,
      label,
      fullLabel: label,
      assignedSceneName: assigned(pageSettings),
    });

    const group = (key: DetailGroup, label: string, pageSettings: PageSettings | null | undefined): MenuSlot => ({
      ...leaf(DETAIL_BASE_PATH[key], label, pageSettings),
      children: (details?.[key] ?? []).map((item) => {
        const en = detailsEn?.[key].find((candidate) => candidate.code === item.code);
        return {
          path: `${DETAIL_BASE_PATH[key]}/${item.code}`,
          label: item.name,
          fullLabel: `${label} › ${item.name}`,
          assignedSceneName: assigned({ target_id: item.targetId, panorama_url: item.panoramaUrl }),
          ogEntity: {
            name: { vi: item.name, en: en?.name ?? '' },
            description: { vi: item.description, en: en?.description ?? '' },
            image: item.image,
            groupLabel: SHARE_OG_PAGE_LABELS[DETAIL_BASE_PATH[key]]?.[0] ?? label,
          },
        };
      }),
    });

    // Thứ tự + nguồn cảnh khớp App.tsx (currentSectionSettings / chi tiết từng mục)
    return [
      leaf('/', t.home, sections?.home),
      leaf('/gioi-thieu', sectionTitle('introduction', t.about), sections?.introduction),
      group('rooms', sectionTitle('rooms', t.rooms), pages?.rooms),
      group('dining', sectionTitle('dining', t.dining), pages?.dining),
      group('facilities', sectionTitle('facilities', t.facilities), pages?.facilities),
      group('services', sectionTitle('services', t.services), pages?.services),
      group('offers', sectionTitle('offers', t.offers), pages?.offers),
      leaf('/chinh-sach', sectionTitle('policies', t.policy), sections?.policies),
      leaf('/lien-he', sectionTitle('contact', t.contact), sections?.contact),
      leaf('/thu-vien-anh', t.gallery, sections?.home),
      leaf('/noi-quy-khach-san', sectionTitle('rules', t.regulation), sections?.rules),
    ];
  }, [details, detailsEn, locale, scenes, settings]);

  // Thông tin chung của site cho OG mặc định — khớp og_defaults() trong server/_og.php
  const ogSite = useMemo<ShareOgSite>(() => {
    const seo = settings?.seo ?? {};
    const seoOf = (lang: string) => ({
      title: (seo[lang]?.meta_title ?? '').trim(),
      description: (seo[lang]?.meta_description ?? '').trim(),
    });
    const imageId = seo.vi?.meta_image_media_id ?? settings?.logo_media_id;
    return {
      siteName: appConfig.APP_NAME.trim() || seoOf('vi').title,
      seo: { vi: seoOf('vi'), en: seoOf('en') },
      defaultImage: appConfig.DEFAULT_OG_IMAGE || (imageId ? mediaService.getMediaUrl(Number(imageId)) : ''),
    };
  }, [settings?.logo_media_id, settings?.seo]);

  return {
    slots,
    ogSite,
    loading: settingsLoading || (Boolean(propertyId) && details === null),
    backendScenes,
  };
};

/** Duỗi cây thành map path → slot để tra nhanh */
export const flattenSlots = (slots: MenuSlot[]): Map<string, MenuSlot> => {
  const map = new Map<string, MenuSlot>();
  const walk = (items: MenuSlot[]) =>
    items.forEach((slot) => {
      map.set(slot.path.toLowerCase(), slot);
      if (slot.children) walk(slot.children);
    });
  walk(slots);
  return map;
};
