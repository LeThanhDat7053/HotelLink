import type { FC, CSSProperties } from 'react';
import { memo, useMemo } from 'react';
import { Modal, Button, message } from 'antd';
import { useLanguage } from '../../context/LanguageContext';
import { getMenuTranslations } from '../../constants/translations';
import { getBookingUrlWithMessage, createBookingMessage, copyToClipboard } from '../../utils/bookingHelper';

// Custom Messenger Icon - Uses primaryColor from API
const MessengerIcon = ({ color }: { color: string }) => (
  <svg width="32" height="32" viewBox="0 0 512 512" fill={color} xmlns="http://www.w3.org/2000/svg" style={{ filter: `drop-shadow(0 3px 8px ${color}99)` }}>
    <path d="M256.55 8C116.52 8 8 110.34 8 248.57c0 72.3 29.71 134.78 78.07 177.94 8.35 7.51 6.63 11.86 8.05 58.23A19.92 19.92 0 0 0 122 502.31c52.91-23.3 53.59-25.14 62.56-22.7C337.85 521.8 504 423.7 504 248.57 504 110.34 396.59 8 256.55 8zm149.24 185.13l-73 115.57a37.37 37.37 0 0 1-53.91 9.93l-58.08-43.47a15 15 0 0 0-18 0l-78.37 59.44c-10.46 7.93-24.16-4.6-17.11-15.67l73-115.57a37.36 37.36 0 0 1 53.91-9.93l58.08 43.47a15 15 0 0 0 18 0l78.37-59.44c10.45-7.93 24.13 4.6 17.11 15.67z" />
  </svg>
);

// Custom Zalo Icon - Uses primaryColor from API
const ZaloIcon = ({ color }: { color: string }) => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill={color} xmlns="http://www.w3.org/2000/svg" style={{ filter: `drop-shadow(0 3px 8px ${color}99)` }}>
    <path d="M5.76 2.56c-1.76 0-3.2 1.44-3.2 3.2v20.48c0 1.76 1.44 3.2 3.2 3.2h20.48c1.76 0 3.2-1.44 3.2-3.2v-20.48c0-1.76-1.44-3.2-3.2-3.2h-20.48zM5.76 3.84h4.211c-2.285 2.378-3.571 5.452-3.571 8.64 0 3.302 1.351 6.464 3.782 8.857 0.077 0.134 0.141 0.793-0.154 1.555-0.186 0.48-0.557 1.107-1.274 1.344-0.275 0.090-0.454 0.36-0.435 0.648s0.231 0.531 0.512 0.589c1.837 0.365 3.026-0.186 3.986-0.621 0.864-0.397 1.434-0.666 2.311-0.308 1.792 0.698 3.699 1.056 5.67 1.056 2.62 0 5.14-0.64 7.36-1.848v2.488c0 1.068-0.852 1.92-1.92 1.92h-20.48c-1.068 0-1.92-0.852-1.92-1.92v-20.48c0-1.068 0.852-1.92 1.92-1.92zM21.12 9.6c0.352 0 0.64 0.288 0.64 0.64v5.76c0 0.352-0.288 0.64-0.64 0.64s-0.64-0.288-0.64-0.64v-5.76c0-0.352 0.288-0.64 0.64-0.64zM11.52 10.24h3.2c0.23 0 0.449 0.128 0.564 0.332 0.109 0.198 0.102 0.448-0.020 0.646l-2.591 4.141h2.047c0.352 0 0.64 0.288 0.64 0.64s-0.288 0.64-0.64 0.64h-3.2c-0.23 0-0.449-0.128-0.564-0.332-0.109-0.198-0.102-0.448 0.020-0.646l2.591-4.141h-2.047c-0.352 0-0.64-0.288-0.64-0.64s0.288-0.64 0.64-0.64zM17.6 12.16c0.39 0 0.755 0.108 1.081 0.287 0.115-0.166 0.295-0.287 0.519-0.287 0.352 0 0.64 0.288 0.64 0.64v3.2c0 0.352-0.288 0.64-0.64 0.64-0.224 0-0.404-0.121-0.519-0.288-0.326 0.179-0.691 0.288-1.081 0.288-1.235 0-2.24-1.005-2.24-2.24s1.005-2.24 2.24-2.24zM24.64 12.16c1.235 0 2.24 1.005 2.24 2.24s-1.005 2.24-2.24 2.24c-1.235 0-2.24-1.005-2.24-2.24s1.005-2.24 2.24-2.24zM17.6 13.44c-0.066 0-0.131 0.007-0.194 0.020-0.125 0.026-0.242 0.075-0.344 0.144s-0.19 0.157-0.259 0.259c-0.069 0.102-0.118 0.219-0.144 0.344-0.013 0.063-0.020 0.127-0.020 0.194s0.007 0.131 0.020 0.194c0.013 0.063 0.031 0.123 0.055 0.18s0.054 0.113 0.089 0.164c0.034 0.051 0.074 0.098 0.117 0.141s0.090 0.083 0.141 0.117c0.102 0.069 0.219 0.118 0.344 0.144 0.063 0.013 0.127 0.020 0.194 0.020s0.131-0.007 0.194-0.020c0.438-0.089 0.766-0.475 0.766-0.94 0-0.531-0.429-0.96-0.96-0.96zM24.64 13.44c-0.066 0-0.131 0.007-0.194 0.020s-0.123 0.031-0.18 0.055c-0.057 0.024-0.113 0.054-0.164 0.089s-0.098 0.074-0.141 0.117c-0.087 0.087-0.158 0.19-0.206 0.305-0.024 0.057-0.042 0.117-0.055 0.18s-0.020 0.127-0.020 0.194c0 0.066 0.007 0.131 0.020 0.194s0.031 0.123 0.055 0.18c0.024 0.057 0.054 0.113 0.089 0.164s0.074 0.098 0.117 0.141c0.043 0.043 0.090 0.083 0.141 0.117s0.106 0.065 0.164 0.089c0.057 0.024 0.117 0.042 0.18 0.055s0.127 0.020 0.194 0.020c0.066 0 0.131-0.007 0.194-0.020 0.438-0.089 0.766-0.475 0.766-0.94 0-0.531-0.429-0.96-0.96-0.96z" />
  </svg>
);

// Custom Booking Icon - Uses primaryColor from API
const BookingIcon = ({ color }: { color: string }) => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg" style={{ filter: `drop-shadow(0 3px 8px ${color}99)` }}>
    <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zm-7 5l-4 4 1.41 1.41L10 16.17l4.59 4.58L16 19.34l-4-4z" />
  </svg>
);

// Custom Phone Icon - Uses primaryColor from API (nút Gọi điện cho sale)
const PhoneIcon = ({ color }: { color: string }) => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg" style={{ filter: `drop-shadow(0 3px 8px ${color}99)` }}>
    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
  </svg>
);

/**
 * Chuẩn hoá phone thành tel: link (nếu chưa có prefix).
 */
export const toTelLink = (phone: string): string => {
  const value = phone.trim();
  if (value.startsWith('tel:') || value.startsWith('http')) return value;
  return `tel:${value}`;
};

export interface BookingOption {
  type: 'messenger' | 'zalo' | 'phone' | 'booking';
  url: string;
  label: string;
  icon: React.ReactNode;
}

interface BookingOptionsModalProps {
  open: boolean;
  onClose: () => void;
  itemName: string;
  messengerUrl?: string | null;
  zaloPhone?: string | null;
  phoneUrl?: string | null;
  bookingUrl?: string | null;
  wantToBookText: string;
  messageCopiedText: string;
  primaryColor: string;
}

/**
 * Modal hiển thị các lựa chọn đặt phòng
 * - Nếu chỉ có 1 option → không cần modal, component cha sẽ redirect trực tiếp
 * - Nếu có 2-3 options → hiện modal để chọn
 */
export const BookingOptionsModal: FC<BookingOptionsModalProps> = memo(({
  open,
  onClose,
  itemName,
  messengerUrl,
  zaloPhone,
  phoneUrl,
  bookingUrl,
  wantToBookText,
  messageCopiedText,
  primaryColor,
}) => {
  const { locale } = useLanguage();
  const t = getMenuTranslations(locale);

  // Build available options
  const options = useMemo<BookingOption[]>(() => {
    const result: BookingOption[] = [];

    // 1. Messenger
    if (messengerUrl && messengerUrl.trim() !== '') {
      // Nếu chỉ là ID/username, convert thành m.me URL
      const messengerLink = messengerUrl.startsWith('http')
        ? messengerUrl
        : `https://m.me/${messengerUrl}`;

      result.push({
        type: 'messenger',
        url: messengerLink,
        label: 'Messenger',
        icon: <MessengerIcon color={primaryColor} />,
      });
    }

    // 2. Zalo (từ phone_number)
    if (zaloPhone && zaloPhone.trim() !== '') {
      // Nếu đã là URL đầy đủ, dùng trực tiếp; nếu không thì thêm prefix
      const zaloLink = zaloPhone.startsWith('http')
        ? zaloPhone
        : `https://zalo.me/${zaloPhone}`;

      result.push({
        type: 'zalo',
        url: zaloLink,
        label: 'Zalo',
        icon: <ZaloIcon color={primaryColor} />,
      });
    }

    // 3. Gọi điện (chỉ có khi referral qua sale)
    if (phoneUrl && phoneUrl.trim() !== '') {
      result.push({
        type: 'phone',
        url: toTelLink(phoneUrl),
        label: t.call || 'Gọi điện',
        icon: <PhoneIcon color={primaryColor} />,
      });
    }

    // 4. Booking URL (Booking.com, website riêng, etc.)
    if (bookingUrl && bookingUrl.trim() !== '') {
      result.push({
        type: 'booking',
        url: bookingUrl,
        label: t.booking || 'Booking',
        icon: <BookingIcon color={primaryColor} />,
      });
    }

    return result;
  }, [messengerUrl, zaloPhone, phoneUrl, bookingUrl, t.booking, t.call, primaryColor]);

  // Handle click option
  const handleOptionClick = async (option: BookingOption) => {
    let finalUrl = option.url;

    // Xử lý Messenger - thêm pre-fill message
    if (option.type === 'messenger') {
      finalUrl = getBookingUrlWithMessage(option.url, itemName, wantToBookText);
    }

    // Xử lý Zalo - copy message và thêm ?text= parameter
    if (option.type === 'zalo') {
      const bookingMessage = createBookingMessage(itemName, wantToBookText);
      
      // Copy message vào clipboard
      const copied = await copyToClipboard(bookingMessage);
      if (copied) {
        message.success(messageCopiedText);
      }
      
      // Thêm ?text= parameter (có thể work trên một số platform)
      const encodedMessage = encodeURIComponent(bookingMessage);
      finalUrl = `${option.url}?text=${encodedMessage}`;
    }

    // Gọi điện: tel: → mở trình quay số; nếu là URL thường thì mở tab mới
    if (option.type === 'phone') {
      if (finalUrl.startsWith('tel:')) {
        window.location.href = finalUrl;
      } else {
        window.open(finalUrl, '_blank', 'noopener,noreferrer');
      }
      onClose();
      return;
    }

    // Open URL
    window.open(finalUrl, '_blank', 'noopener,noreferrer');
    onClose();
  };

  // Styles
  const modalBodyStyle: CSSProperties = {
    padding: '24px',
    background: 'rgba(0, 0, 0, 0.68)',
  };

  const modalHeaderStyle = `
    .booking-modal {
      z-index: 9999 !important;
    }
    .booking-modal .ant-modal-wrap {
      /* Center modal vertically and horizontally on all screen sizes */
      align-items: center !important;
      padding-top: 0 !important;
      z-index: 9999 !important;
    }
    .booking-modal .ant-modal-mask {
      z-index: 9998 !important;
    }
    .booking-modal .ant-modal-container {
      background-color: transparent !important;
    }
    .booking-modal .ant-modal-content {
      background: transparent !important;
      background-color: transparent !important;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      border-radius: 16px;
      overflow: hidden;
      padding: 0 !important;
      --ant-modal-content-bg: transparent;
    }
    .booking-modal .ant-modal-header {
      background: linear-gradient(135deg, ${primaryColor}dd 0%, ${primaryColor}99 100%);
      border-bottom: none;
      padding: 20px 24px;
      border-radius: 16px 16px 0 0;
      margin: 0;
      position: relative;
    }
    .booking-modal .ant-modal-title {
      color: white !important;
      font-size: 18px;
      font-weight: 600;
      text-align: center;
      margin: 0;
    }
    .booking-modal .ant-modal-body {
      background: rgba(0, 0, 0, 0.68);
      border-radius: 0 0 16px 16px;
      padding: 24px !important;
    }
    
    /* Mobile responsive */
    @media (max-width: 768px) {
      .booking-modal .ant-modal {
        max-width: calc(100vw - 32px) !important;
      }
    }
  `;

  const optionButtonStyle: CSSProperties = {
    width: '100%',
    height: 'auto',
    padding: '20px 24px',
    marginBottom: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 16,
    borderRadius: 12,
    fontSize: 18,
    fontWeight: 600,
    boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
    border: 'none',
  };

  const messengerStyle: CSSProperties = {
    ...optionButtonStyle,
    background: 'rgba(0, 0, 0, 0.68)',
    color: primaryColor,
    border: `1px solid ${primaryColor}50`,
  };

  const zaloStyle: CSSProperties = {
    ...optionButtonStyle,
    background: 'rgba(0, 0, 0, 0.68)',
    color: primaryColor,
    border: `1px solid ${primaryColor}50`,
  };

  const bookingStyle: CSSProperties = {
    ...optionButtonStyle,
    background: 'rgba(0, 0, 0, 0.68)',
    color: primaryColor,
    border: `1px solid ${primaryColor}50`,
  };

  const phoneStyle: CSSProperties = {
    ...optionButtonStyle,
    background: 'rgba(0, 0, 0, 0.68)',
    color: primaryColor,
    border: `1px solid ${primaryColor}50`,
  };

  const getButtonStyle = (type: BookingOption['type']): CSSProperties => {
    switch (type) {
      case 'messenger': return messengerStyle;
      case 'zalo': return zaloStyle;
      case 'phone': return phoneStyle;
      case 'booking': return bookingStyle;
      default: return optionButtonStyle;
    }
  };

  return (
    <>
      <style>{modalHeaderStyle}</style>
      <Modal
        open={open}
        onCancel={onClose}
        footer={null}
        title={t.bookNow || 'Đặt ngay'}
        centered={true}
        width={420}
        wrapClassName="booking-modal"
        closable={false}
        styles={{ body: modalBodyStyle }}
        zIndex={9999}
      >
        <div style={{ marginTop: 8 }}>
          {options.map((option) => (
            <Button
              key={option.type}
              type="primary"
              style={{
                ...getButtonStyle(option.type),
                transition: 'all 0.3s ease',
              }}
              onClick={() => handleOptionClick(option)}
              onMouseEnter={(e) => {
                const btn = e.currentTarget as HTMLElement;
                btn.style.transform = 'translateY(-2px)';
                btn.style.boxShadow = '0 8px 25px rgba(0,0,0,0.4)';
              }}
              onMouseLeave={(e) => {
                const btn = e.currentTarget as HTMLElement;
                btn.style.transform = 'translateY(0)';
                btn.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
              }}
            >
              {option.icon}
              <span>{option.label}</span>
            </Button>
          ))}
          
          {options.length === 0 && (
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', padding: 20 }}>
              {t.notAvailable || 'Không có phương thức đặt phòng'}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
});

/**
 * Helper function để xác định có cần show modal hay không
 * @returns { shouldShowModal, singleOption }
 */
export const getBookingBehavior = (
  messengerUrl?: string | null,
  zaloPhone?: string | null,
  bookingUrl?: string | null,
  phoneUrl?: string | null
): { shouldShowModal: boolean; singleOption: BookingOption | null; optionCount: number } => {
  const options: BookingOption[] = [];

  if (messengerUrl && messengerUrl.trim() !== '') {
    const messengerLink = messengerUrl.startsWith('http')
      ? messengerUrl
      : `https://m.me/${messengerUrl}`;
    options.push({
      type: 'messenger',
      url: messengerLink,
      label: 'Facebook Messenger',
      icon: null,
    });
  }

  if (zaloPhone && zaloPhone.trim() !== '') {
    // Nếu đã là URL đầy đủ, dùng trực tiếp; nếu không thì thêm prefix
    const zaloLink = zaloPhone.startsWith('http')
      ? zaloPhone
      : `https://zalo.me/${zaloPhone}`;
    options.push({
      type: 'zalo',
      url: zaloLink,
      label: 'Zalo',
      icon: null,
    });
  }

  if (phoneUrl && phoneUrl.trim() !== '') {
    options.push({
      type: 'phone',
      url: toTelLink(phoneUrl),
      label: 'Gọi điện',
      icon: null,
    });
  }

  if (bookingUrl && bookingUrl.trim() !== '') {
    options.push({
      type: 'booking',
      url: bookingUrl,
      label: 'Booking',
      icon: null,
    });
  }

  return {
    shouldShowModal: options.length > 1,
    singleOption: options.length === 1 ? options[0] : null,
    optionCount: options.length,
  };
};
