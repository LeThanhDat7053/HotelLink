import api from '../api';
import { appConfig } from '../config';
import type {
  PageCode,
  PageSettings,
  PagesSettings,
  VR360SettingsResponse,
  VRHotelBaseSettingsResponse,
  VRHotelSettingsResponse,
  Vr360SceneItem,
} from '../types/settings';

const getRuntimeRequestHeaders = (propertyId?: number | string | null) => {
  const resolvedPropertyId = propertyId ?? appConfig.PROPERTY_ID;
  const resolvedTenantCode = appConfig.TENANT_CODE || appConfig.TENANT_ID;

  return {
    ...(resolvedTenantCode ? { 'x-tenant-code': String(resolvedTenantCode) } : {}),
    ...(resolvedPropertyId ? { 'x-property-id': String(resolvedPropertyId) } : {}),
  };
};

const PAGE_CODE_TO_LEGACY_KEY: Record<string, PageCode> = {
  room: 'rooms',
  rooms: 'rooms',
  hotel_rooms: 'rooms',
  dining: 'dining',
  restaurant: 'dining',
  restaurants: 'dining',
  cafe: 'dining',
  cafes: 'dining',
  food: 'dining',
  food_service: 'dining',
  food_services: 'dining',
  facility: 'facilities',
  facilities: 'facilities',
  amenity: 'facilities',
  amenities: 'facilities',
  service: 'services',
  services: 'services',
  branch: 'services',
  branches: 'services',
  offer: 'offers',
  offers: 'offers',
  promotion: 'offers',
  promotions: 'offers',
  introduction: 'introduction',
  about: 'introduction',
  policies: 'policies',
  policy: 'policies',
  rules: 'rules',
  regulation: 'rules',
  contact: 'contact',
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const normalizeNullableString = (value: unknown): string | null => {
  if (!isNonEmptyString(value)) return null;
  const normalized = value.trim();
  if (normalized === 'string') return null;
  return normalized;
};

const normalizeTargetId = (value: unknown): string | number | null => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (!isNonEmptyString(value)) {
    return null;
  }

  const normalized = value.trim();
  if (!normalized || normalized === 'string') {
    return null;
  }

  const asNumber = Number(normalized);
  if (Number.isFinite(asNumber) && asNumber > 0 && String(asNumber) === normalized) {
    return asNumber;
  }

  return normalized;
};

const normalizeTitleTranslations = (value: unknown): Record<string, string> | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .map(([locale, title]) => [locale, normalizeNullableString(title)] as const)
    .filter((entry): entry is readonly [string, string] => Boolean(entry[1]));

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

const normalizePageSettings = (value: unknown): PageSettings => {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

  return {
    ...source,
    vr_title: normalizeNullableString(source.vr_title) ?? undefined,
    vr360_link: normalizeNullableString(source.vr360_link),
    panorama_url: normalizeNullableString(source.panorama_url),
    target_id: normalizeTargetId(source.target_id),
    scene_name: normalizeNullableString(source.scene_name),
    is_displaying: typeof source.is_displaying === 'boolean' ? source.is_displaying : undefined,
    title_translations: normalizeTitleTranslations(source.title_translations),
  };
};

const removeUndefinedValues = <T extends Record<string, unknown>>(value: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as Partial<T>;

const mergePageSettings = (base?: PageSettings, override?: PageSettings): PageSettings => {
  const merged: PageSettings = {
    ...(base ?? {}),
    ...removeUndefinedValues(override ?? {}),
  };

  if (base?.title_translations || override?.title_translations) {
    merged.title_translations = {
      ...(base?.title_translations ?? {}),
      ...(override?.title_translations ?? {}),
    };
  }

  return merged;
};

const filterPlaceholderScene = (scene: Record<string, unknown>): boolean => {
  const id = normalizeNullableString(scene.id ?? scene.target_id);
  const name = normalizeNullableString(scene.name ?? scene.scene_name);
  const panoramaUrl = normalizeNullableString(scene.panorama_url);

  return Boolean(
    id &&
      id !== 'string' &&
      name &&
      name !== 'string' &&
      panoramaUrl &&
      panoramaUrl !== 'string' &&
      !panoramaUrl.includes('scene=string'),
  );
};

const normalizeScenes = (
  scenes: Array<Partial<Vr360SceneItem> & Record<string, unknown>> | undefined,
): Vr360SceneItem[] => {
  if (!Array.isArray(scenes)) {
    return [];
  }

  return scenes
    .filter((scene): scene is Record<string, unknown> => Boolean(scene && typeof scene === 'object'))
    .filter(filterPlaceholderScene)
    .map((scene, index) => {
      const orderValue = scene.order ?? scene.display_order ?? index;
      const order =
        typeof orderValue === 'number' && Number.isFinite(orderValue) ? orderValue : index;

      return {
        id: normalizeNullableString(scene.id ?? scene.target_id) ?? `scene-${index}`,
        name: normalizeNullableString(scene.name ?? scene.scene_name) ?? `pano-${index + 1}`,
        subtitle: normalizeNullableString(scene.subtitle ?? scene.title) ?? undefined,
        panorama_url:
          normalizeNullableString(scene.panorama_url) ??
          `/?viewer=vr360&scene=${encodeURIComponent(
            normalizeNullableString(scene.name ?? scene.scene_name) ?? `pano-${index + 1}`,
          )}`,
        order,
      };
    })
    .sort((left, right) => left.order - right.order);
};

const normalizePageCode = (rawKey: string): PageCode | null => {
  const normalized = rawKey.trim().toLowerCase();
  return PAGE_CODE_TO_LEGACY_KEY[normalized] ?? null;
};

const extractVr360Pages = (settings: VR360SettingsResponse | null): PagesSettings => {
  if (!settings?.sections) {
    return {};
  }

  return Object.entries(settings.sections).reduce<PagesSettings>((accumulator, [rawKey, value]) => {
    const pageCode = normalizePageCode(rawKey);
    if (!pageCode || !value) {
      return accumulator;
    }

    accumulator[pageCode] = mergePageSettings(
      accumulator[pageCode],
      normalizePageSettings({ ...value, section_code: rawKey }),
    );
    return accumulator;
  }, {});
};

const normalizeBasePages = (pages: PagesSettings | undefined): PagesSettings => {
  if (!pages) {
    return {};
  }

  return Object.entries(pages).reduce<PagesSettings>((accumulator, [pageCode, value]) => {
    const normalizedPageCode = normalizePageCode(pageCode);
    if (!normalizedPageCode || !value) {
      return accumulator;
    }

    accumulator[normalizedPageCode] = normalizePageSettings(value);
    return accumulator;
  }, {});
};

const mergeSettingsResponses = (
  baseSettings: VRHotelBaseSettingsResponse,
  vr360Settings: VR360SettingsResponse | null,
): VRHotelSettingsResponse => {
  const basePages = normalizeBasePages(baseSettings.pages);
  const vr360Pages = extractVr360Pages(vr360Settings);
  const mergedPages = Object.keys({ ...basePages, ...vr360Pages }).reduce<PagesSettings>(
    (accumulator, pageCode) => {
      const typedPageCode = pageCode as PageCode;
      accumulator[typedPageCode] = mergePageSettings(
        basePages[typedPageCode],
        vr360Pages[typedPageCode],
      );
      return accumulator;
    },
    {},
  );

  return {
    ...baseSettings,
    pages: mergedPages,
    scenes: normalizeScenes(vr360Settings?.scenes),
    vr360_settings: vr360Settings,
  };
};

export const settingsService = {
  async getBaseHotelSettings(propertyId?: number | string | null): Promise<VRHotelBaseSettingsResponse> {
    const { data } = await api.get<VRHotelBaseSettingsResponse>('/vr-hotel/settings', {
      headers: getRuntimeRequestHeaders(propertyId),
    });
    return data;
  },

  async getVr360Settings(propertyId?: number | string | null): Promise<VR360SettingsResponse | null> {
    try {
      const { data } = await api.get<VR360SettingsResponse>('/vr-hotel/vr360/settings', {
        headers: getRuntimeRequestHeaders(propertyId),
      });
      return data;
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } }).response?.status;
      if (status === 404 || status === 400 || status === 422 || status === 500) {
        return null;
      }
      return null;
    }
  },

  async getVRHotelSettings(propertyId?: number | string | null): Promise<VRHotelSettingsResponse> {
    const [baseSettings, vr360Settings] = await Promise.all([
      this.getBaseHotelSettings(propertyId),
      this.getVr360Settings(propertyId),
    ]);

    return mergeSettingsResponses(baseSettings, vr360Settings);
  },

  async getLogoUrl(logoMediaId?: number | null): Promise<string | null> {
    if (!logoMediaId) return null;

    const baseURL = appConfig.API_BASE_URL || 'https://travel.link360.vn/api/v1';
    return `${baseURL}/media/${logoMediaId}/view`;
  },

  async getSettingsWithLogoUrl(): Promise<{
    logoUrl: string | null;
    settings: VRHotelSettingsResponse;
  }> {
    const settings = await this.getVRHotelSettings(appConfig.PROPERTY_ID);
    const logoUrl = await this.getLogoUrl(settings.logo_media_id);

    return { logoUrl, settings };
  },
};
