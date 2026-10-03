/**
 * OG MẶC ĐỊNH của một trang — để trang /vr360-scene-sync xem trước và làm placeholder.
 * GIỮ KHỚP quy tắc với server/_og.php (og_defaults / og_apply_custom): server mới là nơi
 * thật sự chèn thẻ cho crawler.
 */
import type { ShareOgCustom } from '../services/shareOgStore';

export type ShareOgLang = 'vi' | 'en';

// Nhãn mục [vi, en] — khớp OG_PAGE_LABELS trong server/_og.php
export const SHARE_OG_PAGE_LABELS: Record<string, [string, string]> = {
  '/gioi-thieu': ['Giới thiệu', 'About Us'],
  '/phong-nghi': ['Phòng nghỉ', 'Rooms'],
  '/am-thuc': ['Ẩm thực', 'Dining'],
  '/tien-ich': ['Tiện ích', 'Facilities'],
  '/dich-vu': ['Dịch vụ', 'Services'],
  '/uu-dai': ['Ưu đãi', 'Offers'],
  '/chinh-sach': ['Chính sách', 'Policies'],
  '/lien-he': ['Liên hệ', 'Contact'],
  '/thu-vien-anh': ['Thư viện ảnh', 'Gallery'],
  '/noi-quy-khach-san': ['Nội quy khách sạn', 'Hotel Regulations'],
};

const TITLE_SEPARATOR = ' – ';
const EXCERPT_LENGTH = 200;

export interface ShareOgSite {
  siteName: string;
  /** SEO của site theo ngôn ngữ */
  seo: Record<ShareOgLang, { title: string; description: string }>;
  defaultImage: string;
}

/** Dữ liệu mục (phòng / nhà hàng…) của trang chi tiết */
export interface ShareOgEntity {
  name: Record<ShareOgLang, string>;
  description: Record<ShareOgLang, string>;
  image: string;
  /** Tên loại mục để ghi nguồn, vd "Phòng nghỉ" */
  groupLabel: string;
}

export interface ShareOgValue {
  title: string;
  description: string;
  image: string;
}

export interface ShareOgDefaults extends ShareOgValue {
  sourceLabel: string;
}

/** Bỏ HTML, gộp khoảng trắng, cắt ~200 ký tự ở ranh giới từ — như og_excerpt() */
export const shareOgExcerpt = (html: string, maxLength = EXCERPT_LENGTH): string => {
  const element = document.createElement('div');
  element.innerHTML = html;
  const text = (element.textContent || '').replace(/\s+/g, ' ').trim();
  const chars = [...text];
  if (chars.length <= maxLength) return text;

  const cut = chars.slice(0, maxLength).join('');
  const space = cut.lastIndexOf(' ');
  const trimmed = space > maxLength * 0.6 ? cut.slice(0, space) : cut;
  return `${trimmed.replace(/[ ,.;:-]+$/, '')}…`;
};

export const resolveShareOgDefaults = (
  pagePath: string,
  lang: ShareOgLang,
  site: ShareOgSite,
  entity: ShareOgEntity | null,
): ShareOgDefaults => {
  const withSite = (label: string) =>
    site.siteName && label !== site.siteName ? `${label}${TITLE_SEPARATOR}${site.siteName}` : label;
  const siteDescription = site.seo[lang].description || site.seo.vi.description;
  const base: ShareOgDefaults = {
    title: site.siteName,
    description: siteDescription,
    image: site.defaultImage,
    sourceLabel: 'Thông tin chung của website',
  };

  if (pagePath === '/') {
    return { ...base, title: site.seo[lang].title || site.siteName, sourceLabel: 'SEO trang chủ' };
  }

  if (entity) {
    const name = entity.name[lang] || entity.name.vi;
    const description = shareOgExcerpt(entity.description[lang] || entity.description.vi);
    return {
      title: name ? withSite(name) : base.title,
      description: description || base.description,
      image: entity.image || base.image,
      sourceLabel: `Dữ liệu ${entity.groupLabel}: ${entity.name.vi || pagePath}`,
    };
  }

  const label = SHARE_OG_PAGE_LABELS[`/${pagePath.split('/')[1] ?? ''}`];
  return label ? { ...base, title: withSite(label[lang === 'vi' ? 0 : 1]), sourceLabel: 'Tên mục + mô tả website' } : base;
};

/** Lớp tuỳ chỉnh admin: field rỗng giữ mặc định; EN rỗng lùi về VI — như og_apply_custom() */
export const applyShareOgCustom = (
  defaults: ShareOgValue,
  custom: Partial<ShareOgCustom> | null,
  lang: ShareOgLang,
): ShareOgValue => {
  if (!custom) return defaults;
  const pick = (vi?: string, en?: string) => (lang === 'vi' ? vi?.trim() : en?.trim() || vi?.trim()) || '';
  return {
    title: pick(custom.titleVi, custom.titleEn) || defaults.title,
    description: pick(custom.descriptionVi, custom.descriptionEn) || defaults.description,
    image: custom.image?.trim() || defaults.image,
  };
};
