import type { FC, CSSProperties } from 'react';
import { memo, useState, useMemo, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  DownOutlined,
  CloseOutlined,
  MenuOutlined
} from '@ant-design/icons';
import { Dropdown, Button, Space, Grid } from 'antd';
import type { MenuProps } from 'antd';
import { useLanguage, type Language } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { useSale } from '../../context/SaleContext';
import { getMenuTranslations } from '../../constants/translations';
import { resolveContact } from '../../utils/contactResolver';
import { toTelLink } from './BookingOptionsModal';
import { useContact } from '../../hooks/useContact';
import { useVrHotelSettings } from '../../hooks/useVR360';
import { useIntroduction } from '../../hooks/useIntroduction';
import { usePolicy } from '../../hooks/usePolicy';
import { getLocalizedPath, extractCleanPath } from '../../constants/routes';
import { appConfig } from '../../config';

const { useBreakpoint } = Grid;

interface HeaderProps {
  className?: string;
  isMenuExpanded?: boolean;
  onMenuToggle?: (expanded: boolean) => void;
}

interface MenuItem {
  path: string;
  label: string;
  children?: MenuItem[];
}

export const Header: FC<HeaderProps> = memo(({ isMenuExpanded = false, onMenuToggle }) => {
  const [openSubMenu, setOpenSubMenu] = useState<string | null>(null);
  const { currentLang, availableLocales, setLanguage, locale } = useLanguage();
  const { primaryColor } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const propertyId = Number(appConfig.PROPERTY_ID || 0);
  const { content: contactData } = useContact(propertyId, locale);
  const { settings: vrHotelSettings, loading: vrSettingsLoading } = useVrHotelSettings(propertyId || null);
  const { saleContact } = useSale();
  // Contact hiển thị ở social bar: ưu tiên sale (?ref=), fallback hotel.
  const headerContact = resolveContact(saleContact, {
    messengerUrl: vrHotelSettings?.messenger_url,
    zaloPhone: vrHotelSettings?.phone_number,
    bookingUrl: vrHotelSettings?.booking_url,
  });
  const { introduction } = useIntroduction(propertyId || null);
  const { content: policyData } = usePolicy(propertyId, locale);

  // Auto-open menu sau khi settings load xong + delay để smooth (CHỈ desktop)
  useEffect(() => {
    const isDesktop = screens.md;
    if (!vrSettingsLoading && vrHotelSettings && isDesktop) {
      // Delay 500ms sau khi settings load xong rồi mở menu (chỉ desktop)
      const timer = setTimeout(() => {
        onMenuToggle?.(true);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [vrSettingsLoading, vrHotelSettings, onMenuToggle, screens.md]);

  // Lấy translations theo locale hiện tại
  const t = useMemo(() => getMenuTranslations(locale), [locale]);

  const resolveSectionTitle = useCallback(
    (sectionKey: string | undefined, fallbackTitle: string) => {
      if (!sectionKey) {
        return fallbackTitle;
      }

      const section = vrHotelSettings?.vr360_settings?.sections?.[sectionKey];
      return section?.title_translations?.[locale] || section?.vr_title || fallbackTitle;
    },
    [locale, vrHotelSettings?.vr360_settings?.sections],
  );

  // Mapping giữa menu path và API page key
  const pageKeyMap: Record<string, string> = {
    '/phong-nghi': 'rooms',
    '/am-thuc': 'dining',
    '/tien-ich': 'facilities',
    '/dich-vu': 'services',
    '/uu-dai': 'offers',
  };

  // Menu items với translations động theo locale
  const menuItems: MenuItem[] = useMemo(() => {
    const allItems = [
      { path: '/', label: t.home }, // Trang chủ
      { path: '/gioi-thieu', label: resolveSectionTitle('introduction', t.about) },
      { path: '/phong-nghi', label: resolveSectionTitle('rooms', t.rooms) },
      { path: '/am-thuc', label: resolveSectionTitle('dining', t.dining) },
      { path: '/tien-ich', label: resolveSectionTitle('facilities', t.facilities) },
      { path: '/dich-vu', label: resolveSectionTitle('services', t.services) },
      { path: '/uu-dai', label: resolveSectionTitle('offers', t.offers) },
      { path: '/chinh-sach', label: resolveSectionTitle('policies', t.policy) },
      { path: '/lien-he', label: resolveSectionTitle('contact', t.contact) },
    ];

    // Filter menu items dựa trên is_displaying từ các API
    return allItems.filter((item) => {
      // Trang Giới thiệu - check từ API introduction
      if (item.path === '/gioi-thieu') {
        return introduction?.isDisplaying !== false;
      }
      
      // Trang Chính sách - check từ API policies
      if (item.path === '/chinh-sach') {
        return policyData?.isDisplaying !== false;
      }
      
      // Trang Liên hệ - check từ API contact
      if (item.path === '/lien-he') {
        return contactData?.isDisplaying !== false;
      }
      
      // Các trang từ VR Hotel Settings (rooms, dining, facilities, services, offers)
      const pageKey = pageKeyMap[item.path];
      if (pageKey && vrHotelSettings?.pages) {
        const pageSettings = vrHotelSettings.pages[pageKey as keyof typeof vrHotelSettings.pages];
        return pageSettings?.is_displaying !== false;
      }
      
      // Trang chủ - hiển thị mặc định
      return true;
    });
  }, [contactData, introduction, policyData, resolveSectionTitle, t, vrHotelSettings]);

  // Footer links với translations động theo locale (có thể dùng sau)
  // const footerLinks = useMemo(() => [
  //   { path: '/thu-vien-anh', label: t.gallery },
  //   { path: '/noi-quy-khach-san', label: t.regulation },
  //   { path: '/tin-tuc-su-kien', label: t.news },
  // ], [t]);

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    // Navigate to same page but with new language
    const cleanPath = extractCleanPath(location.pathname);
    const newPath = getLocalizedPath(cleanPath, lang.code);
    navigate(newPath, { replace: true });
  };

  const toggleSubMenu = (path: string) => {
    setOpenSubMenu(openSubMenu === path ? null : path);
  };

  // Language dropdown menu items from API (no flags, only native_name)
  const languageMenuItems: MenuProps['items'] = availableLocales
    .filter(l => l.code !== currentLang.code)
    .map(lang => ({
      key: lang.code,
      label: (
        <span style={{ fontSize: 11, letterSpacing: 0.5, padding: '0 8px' }}>{lang.name}</span>
      ),
      onClick: () => handleLanguageChange(lang),
    }));

  // Style constants
  const headerStyle: CSSProperties = {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 2000, // Cao hơn iframe VR360 (zIndex: 0) và InfoBox (zIndex: 1999)
    pointerEvents: 'none',
  };

  const menuBgStyle: CSSProperties = {
    position: 'fixed',
    top: 0,
    right: 0,
    zIndex: 2000, // Cùng level với header
    width: screens.md ? 280 : screens.sm ? 260 : 240,
    maxWidth: screens.md ? 280 : screens.sm ? 260 : 240,
    background: '#000000ad',
    backdropFilter: 'blur(2px)',
    WebkitBackdropFilter: 'blur(2px)',
    borderBottomLeftRadius: 22,
    pointerEvents: 'auto',
  };

  const menuTopBarStyle: CSSProperties = {
    position: 'relative',
    width: '100%',
    height: 62,
  };

  const langMenuBgStyle: CSSProperties = {
    position: 'absolute',
    left: 16,
    top: 12,
    width: 138,
    height: 37,
    background: 'rgba(0, 0, 0, 0.3)',
    cursor: 'pointer',
    border: `1px solid ${primaryColor}99`,
    borderRadius: 12,
    zIndex: 10,
  };

  const langButtonStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    background: 'transparent',
    border: 'none',
    borderRadius: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    padding: '0 12px',
    fontSize: 11,
    letterSpacing: 0.5,
  };

  const toggleBtnStyle: CSSProperties = {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 62,
    height: 62,
    overflow: 'hidden',
    background: 'var(--primary-color, #ecc56d)', // Dùng CSS variable để tránh flash
    border: 'none',
    borderRadius: 0,
    padding: 0,
    margin: 0,
    cursor: 'pointer',
    transition: 'background 300ms linear',
    zIndex: 10,
  };

  const menuContentStyle: CSSProperties = {
    transformOrigin: 'top center',
    transition: 'all 300ms linear',
    transform: isMenuExpanded ? 'scaleY(1)' : 'scaleY(0)',
    opacity: isMenuExpanded ? 1 : 0,
    maxHeight: isMenuExpanded ? 'none' : 0,
  };

  // Responsive icon sizes for Messenger/Zalo
  const socialIconSize = screens.lg ? 22 : screens.md ? 20 : screens.sm ? 18 : 16;
  // Zalo icon has padding inside viewBox, so make it ~25% larger to match Messenger visually
  const zaloIconSize = screens.lg ? 28 : screens.md ? 25 : screens.sm ? 23 : 20;
  const socialBtnSize = screens.lg ? 42 : screens.md ? 38 : screens.sm ? 36 : 32;

  const socialBtnStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: socialBtnSize,
    height: socialBtnSize,
    textAlign: 'center',
    borderRadius: 12,
    margin: '0 10px',
    transition: 'all 200ms linear',
    color: 'white',
    textDecoration: 'none',
    background: 'rgba(255, 255, 255, 0.08)',
  };


  return (
    <header style={headerStyle}>
      <style>{`
        /* Primary Menu Items CSS */
        .primary-menu {
          float: left;
          width: 100%;
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .primary-menu .menu-item a {
          position: relative;
          display: block;
          width: 100%;
          height: 48px;
          line-height: 48px;
          color: rgba(255, 255, 255, 0.8);
          text-align: center;
          text-transform: uppercase;
          font-weight: 100;
          font-size: 13px;
          letter-spacing: 2px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.12);
          transition: all 300ms linear;
          text-decoration: none;
          background: transparent;
        }

        .primary-menu .menu-item a:hover {
          color: ${primaryColor};
        }

        .primary-menu .menu-item a::before {
          position: absolute;
          content: "";
          bottom: 0;
          right: 0;
          width: 100%;
          max-width: 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.5);
          transition: all 300ms linear;
        }

        .primary-menu .menu-item a:hover::before {
          max-width: 100%;
          right: auto;
          left: 0;
        }

        .primary-menu .menu-item a.active {
          color: ${primaryColor};
          font-weight: 600;
          background: rgba(236, 197, 109, 0.15);
          border-left: 4px solid ${primaryColor};
        }

        /* Menu item có submenu */
        .primary-menu .menu-item.has-submenu > div {
          position: relative;
          display: block;
          width: 100%;
          height: 48px;
          line-height: 48px;
          color: rgba(255, 255, 255, 0.8);
          text-align: center;
          text-transform: uppercase;
          font-weight: 100;
          font-size: 13px;
          letter-spacing: 2px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.12);
          transition: all 300ms linear;
          cursor: pointer;
        }

        .primary-menu .menu-item.has-submenu > div:hover {
          color: ${primaryColor};
        }

        /* Submenu CSS */
        .sub-menu {
          list-style: none;
          margin: 0;
          padding: 0;
          background: rgba(0, 0, 0, 0.3);
        }

        .sub-menu .menu-item a {
          height: 40px;
          line-height: 40px;
          font-size: 12px;
          letter-spacing: 1.5px;
          padding-left: 20px;
          text-align: left;
          color: rgba(255, 255, 255, 0.7);
        }

        .sub-menu .menu-item a:hover {
          color: #fff;
          background: rgba(212, 168, 85, 0.1);
        }

        ::-webkit-scrollbar {
          width: 2px;
        } 
        
        ::-webkit-scrollbar-thumb {
          background: ${primaryColor}80;
        }
        
        ::-webkit-scrollbar-track {
          background: transparent;
        }

        .lang-dropdown-custom .ant-dropdown-menu {
          background: #000000ad !important;
          backdrop-filter: blur(2px);
          border: 1px solid ${primaryColor}4D !important;
          borderRadius: 12px !important;
          padding: 8px 0 !important;
          marginTop: 8px !important;
        }

        .lang-dropdown-custom .ant-dropdown-menu-item {
          color: rgba(255, 255, 255, 0.8) !important;
          padding: 10px 16px !important;
          border-bottom: 1px solid ${primaryColor}26;
          borderRadius: 0 !important;
        }

        .lang-dropdown-custom .ant-dropdown-menu-item:last-child {
          border-bottom: none;
        }

        .lang-dropdown-custom .ant-dropdown-menu-item:hover {
          background: ${primaryColor}26 !important;
          color: ${primaryColor} !important;
        }
      `}</style>

      {/* Main Menu Panel - LUÔN Ở BÊN PHẢI */}
      <div style={menuBgStyle}>
        <div style={{ width: '100%', position: 'relative' }}>
          {/* Top Bar: Language Selector | Toggle Button */}
          <div style={menuTopBarStyle}>
            {/* Language Selector với Ant Design Dropdown */}
            <div style={langMenuBgStyle}>
              <Dropdown
                menu={{ items: languageMenuItems }}
                trigger={['hover']}
                placement="bottomLeft"
                styles={{ root: { zIndex: 2100 } }}
                classNames={{ root: 'lang-dropdown-custom' }}
              >
                <Button style={langButtonStyle}>
                  <Space size={4}>
                    <span style={{ fontWeight: 500 }}>{currentLang.name}</span>
                    <DownOutlined style={{ fontSize: 9 }} />
                  </Space>
                </Button>
              </Dropdown>
            </div>

            {/* Toggle Button - Hamburger hoặc X */}
            <Button
              onClick={() => onMenuToggle?.(!isMenuExpanded)}
              style={toggleBtnStyle}
              onMouseEnter={(e) => e.currentTarget.style.background = `var(--primary-color, #ecc56d)dd`}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--primary-color, #ecc56d)'}
              icon={
                isMenuExpanded ? (
                  <CloseOutlined style={{ fontSize: 20, color: '#fff' }} />
                ) : (
                  <MenuOutlined style={{ fontSize: 20, color: '#fff' }} />
                )
              }
            />
          </div>

          {/* Menu Content - CHỈ PHẦN NÀY MỚI EXPAND/COLLAPSE */}
          <div style={menuContentStyle}>
            <nav style={{ overflow: 'auto', maxHeight: 'calc(100vh - 220px)' }}>
              <ul className="primary-menu">
                {menuItems.map((item) => (
                  <li key={item.path} className={`menu-item ${item.children ? 'has-submenu' : ''}`}>
                    {item.children ? (
                      <>
                        <div
                          onClick={() => toggleSubMenu(item.path)}
                        >
                          <span>{item.label}</span>
                          <DownOutlined 
                            style={{ 
                              fontSize: '10px', 
                              marginLeft: '8px',
                              transition: 'transform 300ms',
                              transform: openSubMenu === item.path ? 'rotate(180deg)' : 'rotate(0deg)'
                            }}
                          />
                        </div>
                        {/* Submenu */}
                        <ul 
                          className="sub-menu" 
                          style={{
                            maxHeight: openSubMenu === item.path ? '300px' : '0',
                            overflow: 'hidden',
                            transition: 'all 300ms linear'
                          }}
                        >
                          {item.children.map((child) => (
                            <li key={child.path} className="menu-item">
                              <Link
                                to={getLocalizedPath(child.path, locale)}
                                className={isActive(child.path) ? 'active' : ''}
                              >
                                {child.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <Link
                        to={getLocalizedPath(item.path, locale)}
                        className={isActive(item.path) ? 'active' : ''}
                      >
                        {item.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>

            {/* Book Now Button - Full clickable area */}
            <Link 
              to={getLocalizedPath('/dat-phong', locale)} 
              style={{ 
                display: 'block',
                width: '100%',
                textDecoration: 'none'
              }}
            >
              <Button
                type="primary"
                size="large"
                block
                style={{
                  height: 52,
                  background: primaryColor,
                  color: 'white',
                  textAlign: 'center',
                  fontWeight: 500,
                  fontSize: 13,
                  letterSpacing: '0.15em',
                  borderRadius: 0,
                  border: 0,
                  marginTop: 0,
                  width: '100%',
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.85'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                {t.booking}
              </Button>
            </Link>

            {/* Social Bar - Messenger và Zalo */}
            <Space 
              size={14} 
              style={{ width: '100%', justifyContent: 'center', margin: '38px 0' }}
              wrap
            >
              {/* Messenger - chỉ hiện khi KHÔNG có sale (sale không có messenger) */}
              {headerContact.messengerUrl && (
                <a
                  href={headerContact.messengerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={socialBtnStyle}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = primaryColor;
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'white';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  }}
                  title="Messenger"
                >
                  <svg viewBox="0 0 512 512" style={{ width: socialIconSize, height: socialIconSize, fill: 'currentColor' }}>
                    <path d="M256.55 8C116.52 8 8 110.34 8 248.57c0 72.3 29.71 134.78 78.07 177.94 8.35 7.51 6.63 11.86 8.05 58.23A19.92 19.92 0 0 0 122 502.31c52.91-23.3 53.59-25.14 62.56-22.7C337.85 521.8 504 423.7 504 248.57 504 110.34 396.59 8 256.55 8zm149.24 185.13l-73 115.57a37.37 37.37 0 0 1-53.91 9.93l-58.08-43.47a15 15 0 0 0-18 0l-78.37 59.44c-10.46 7.93-24.16-4.6-17.11-15.67l73-115.57a37.36 37.36 0 0 1 53.91-9.93l58.08 43.47a15 15 0 0 0 18 0l78.37-59.44c10.45-7.93 24.13 4.6 17.11 15.67z"/>
                  </svg>
                </a>
              )}
              {/* Gọi điện - chỉ hiện khi có sale (phone_url) */}
              {headerContact.phoneUrl && (
                <a
                  href={toTelLink(headerContact.phoneUrl)}
                  style={socialBtnStyle}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = primaryColor;
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'white';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  }}
                  title={t.call || 'Gọi điện'}
                >
                  <svg viewBox="0 0 24 24" style={{ width: socialIconSize, height: socialIconSize, fill: 'currentColor' }}>
                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                  </svg>
                </a>
              )}
              {/* Zalo */}
              {headerContact.zaloPhone && (
                <a
                  href={headerContact.zaloPhone}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={socialBtnStyle}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = primaryColor;
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'white';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  }}
                  title="Zalo"
                >
                  <svg viewBox="0 0 32 32" style={{ width: zaloIconSize, height: zaloIconSize, fill: 'currentColor' }}>
                    <path d="M5.76 2.56c-1.76 0-3.2 1.44-3.2 3.2v20.48c0 1.76 1.44 3.2 3.2 3.2h20.48c1.76 0 3.2-1.44 3.2-3.2v-20.48c0-1.76-1.44-3.2-3.2-3.2h-20.48zM5.76 3.84h4.211c-2.285 2.378-3.571 5.452-3.571 8.64 0 3.302 1.351 6.464 3.782 8.857 0.077 0.134 0.141 0.793-0.154 1.555-0.186 0.48-0.557 1.107-1.274 1.344-0.275 0.090-0.454 0.36-0.435 0.648s0.231 0.531 0.512 0.589c1.837 0.365 3.026-0.186 3.986-0.621 0.864-0.397 1.434-0.666 2.311-0.308 1.792 0.698 3.699 1.056 5.67 1.056 2.62 0 5.14-0.64 7.36-1.848v2.488c0 1.068-0.852 1.92-1.92 1.92h-20.48c-1.068 0-1.92-0.852-1.92-1.92v-20.48c0-1.068 0.852-1.92 1.92-1.92zM21.12 9.6c0.352 0 0.64 0.288 0.64 0.64v5.76c0 0.352-0.288 0.64-0.64 0.64s-0.64-0.288-0.64-0.64v-5.76c0-0.352 0.288-0.64 0.64-0.64zM11.52 10.24h3.2c0.23 0 0.449 0.128 0.564 0.332 0.109 0.198 0.102 0.448-0.020 0.646l-2.591 4.141h2.047c0.352 0 0.64 0.288 0.64 0.64s-0.288 0.64-0.64 0.64h-3.2c-0.23 0-0.449-0.128-0.564-0.332-0.109-0.198-0.102-0.448 0.020-0.646l2.591-4.141h-2.047c-0.352 0-0.64-0.288-0.64-0.64s0.288-0.64 0.64-0.64zM17.6 12.16c0.39 0 0.755 0.108 1.081 0.287 0.115-0.166 0.295-0.287 0.519-0.287 0.352 0 0.64 0.288 0.64 0.64v3.2c0 0.352-0.288 0.64-0.64 0.64-0.224 0-0.404-0.121-0.519-0.288-0.326 0.179-0.691 0.288-1.081 0.288-1.235 0-2.24-1.005-2.24-2.24s1.005-2.24 2.24-2.24zM24.64 12.16c1.235 0 2.24 1.005 2.24 2.24s-1.005 2.24-2.24 2.24c-1.235 0-2.24-1.005-2.24-2.24s1.005-2.24 2.24-2.24zM17.6 13.44c-0.066 0-0.131 0.007-0.194 0.020-0.125 0.026-0.242 0.075-0.344 0.144s-0.19 0.157-0.259 0.259c-0.069 0.102-0.118 0.219-0.144 0.344-0.013 0.063-0.020 0.127-0.020 0.194s0.007 0.131 0.020 0.194c0.013 0.063 0.031 0.123 0.055 0.18s0.054 0.113 0.089 0.164c0.034 0.051 0.074 0.098 0.117 0.141s0.090 0.083 0.141 0.117c0.102 0.069 0.219 0.118 0.344 0.144 0.063 0.013 0.127 0.020 0.194 0.020s0.131-0.007 0.194-0.020c0.438-0.089 0.766-0.475 0.766-0.94 0-0.531-0.429-0.96-0.96-0.96zM24.64 13.44c-0.066 0-0.131 0.007-0.194 0.020s-0.123 0.031-0.18 0.055c-0.057 0.024-0.113 0.054-0.164 0.089s-0.098 0.074-0.141 0.117c-0.087 0.087-0.158 0.19-0.206 0.305-0.024 0.057-0.042 0.117-0.055 0.18s-0.020 0.127-0.020 0.194c0 0.066 0.007 0.131 0.020 0.194s0.031 0.123 0.055 0.18c0.024 0.057 0.054 0.113 0.089 0.164s0.074 0.098 0.117 0.141c0.043 0.043 0.090 0.083 0.141 0.117s0.106 0.065 0.164 0.089c0.057 0.024 0.117 0.042 0.18 0.055s0.127 0.020 0.194 0.020c0.066 0 0.131-0.007 0.194-0.020 0.438-0.089 0.766-0.475 0.766-0.94 0-0.531-0.429-0.96-0.96-0.96z"/>
                  </svg>
                </a>
              )}
            </Space>
          </div>
        </div>
      </div>
    </header>
  );
});

Header.displayName = 'Header';
