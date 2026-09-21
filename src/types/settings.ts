export type PageCode =
  | 'rooms'
  | 'dining'
  | 'facilities'
  | 'services'
  | 'offers'
  | 'introduction'
  | 'policies'
  | 'rules'
  | 'contact';

export interface SEOMetadata {
  meta_title?: string;
  meta_description?: string;
  meta_keywords?: string;
  [key: string]: string | undefined;
}

export interface SEOData {
  [locale: string]: SEOMetadata;
}

export interface Vr360SceneItem {
  id: string;
  name: string;
  subtitle?: string;
  panorama_url: string;
  order: number;
}

export interface PageSettings {
  vr_title?: string;
  vr360_link?: string | null;
  panorama_url?: string | null;
  target_id?: string | number | null;
  scene_name?: string | null;
  is_displaying?: boolean;
  title_translations?: Record<string, string>;
  [key: string]: unknown;
}

export type PagesSettings = Partial<Record<PageCode, PageSettings>>;

export interface VRHotelBaseSettingsResponse {
  primary_color: string;
  background_color?: string;
  booking_url?: string;
  messenger_url?: string;
  phone_number?: string;
  logo_media_id?: number | null;
  favicon_media_id?: number | null;
  seo?: SEOData;
  pages?: PagesSettings;
}

export interface VR360SettingsSection extends PageSettings {
  section_code?: string;
}

export interface VR360SettingsResponse {
  scenes?: Array<Partial<Vr360SceneItem> & Record<string, unknown>>;
  sections?: Record<string, VR360SettingsSection | undefined>;
}

export interface VRHotelSettingsResponse extends VRHotelBaseSettingsResponse {
  pages?: PagesSettings;
  scenes?: Vr360SceneItem[];
  vr360_settings?: VR360SettingsResponse | null;
}

export interface ValidationErrorDetail {
  loc: Array<string | number>;
  msg: string;
  type: string;
}

export interface ValidationErrorResponse {
  detail: ValidationErrorDetail[];
}
