import type { FC, CSSProperties } from 'react';
import { memo, useState, useEffect } from 'react';
import { Button, Grid, Spin, Alert, Image, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { usePropertyData } from '../../context/PropertyContext';
import { useSale } from '../../context/SaleContext';
import { useVrHotelSettings } from '../../hooks/useVR360';
import { getMenuTranslations } from '../../constants/translations';
import { ImageGalleryViewer } from './ImageGalleryViewer';
import { BookingOptionsModal, getBookingBehavior } from './BookingOptionsModal';
import { getBookingUrlWithMessage, createBookingMessage, copyToClipboard } from '../../utils/bookingHelper';
import { resolveContact } from '../../utils/contactResolver';
import type { DiningUIData } from '../../types/dining';

const { useBreakpoint } = Grid;

interface DiningDetailProps {
  dining: DiningUIData | null;
  loading?: boolean;
  error?: Error | null;
  onBack: () => void;
  onDiningVrChange?: (targetId: string | null, panoramaUrl: string | null, vrLink: string | null) => void;
  className?: string;
}

export const DiningDetail: FC<DiningDetailProps> = memo(({
  dining,
  loading = false,
  error = null,
  onBack,
  onDiningVrChange,
  className = '',
}) => {
  const screens = useBreakpoint();
  const { primaryColor } = useTheme();
  const { locale } = useLanguage();
  const { propertyId } = usePropertyData();
  const { settings } = useVrHotelSettings(propertyId);
  const { saleContact } = useSale();
  const t = getMenuTranslations(locale);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);

  const openGallery = (index: number) => {
    setGalleryIndex(index);
    setGalleryOpen(true);
  };

  const closeGallery = () => {
    setGalleryOpen(false);
  };

  // Handler nút Đặt ngay
  // Logic mới: Hiện popup với 3 lựa chọn (Messenger, Zalo, Booking)
  // Nếu chỉ có 1 option → redirect trực tiếp
  const handleBooking = async () => {
    const itemName = dining?.name || '';

    // Gộp contact: có sale (?ref=) thì dùng contact của sale, ngược lại của hotel.
    // Lưu ý: bookingUrl mặc định CHỈ dùng của dining (không fallback settings);
    // khi có sale thì dùng booking_url của sale.
    const { messengerUrl, zaloPhone, phoneUrl, bookingUrl } = resolveContact(saleContact, {
      messengerUrl: settings?.messenger_url,
      zaloPhone: settings?.phone_number,
      bookingUrl: dining?.bookingUrl,
    });

    // Check behavior: show modal hay redirect trực tiếp
    const { shouldShowModal, singleOption } = getBookingBehavior(
      messengerUrl,
      zaloPhone,
      bookingUrl,
      phoneUrl
    );

    // Nếu chỉ có 1 option → redirect trực tiếp
    if (!shouldShowModal && singleOption) {
      let finalUrl = singleOption.url;

      // Gọi điện: tel: → quay số; URL thường → mở tab mới
      if (singleOption.type === 'phone') {
        if (finalUrl.startsWith('tel:')) {
          window.location.href = finalUrl;
        } else {
          window.open(finalUrl, '_blank', 'noopener,noreferrer');
        }
        return;
      }

      // Xử lý Messenger - thêm pre-fill message
      if (singleOption.type === 'messenger') {
        finalUrl = getBookingUrlWithMessage(singleOption.url, itemName, t.wantToBook);
      }

      // Xử lý Zalo - copy message và thêm ?text= parameter
      if (singleOption.type === 'zalo') {
        const bookingMessage = createBookingMessage(itemName, t.wantToBook);
        const copied = await copyToClipboard(bookingMessage);
        if (copied) {
          message.success(t.messageCopied);
        }
        const encodedMessage = encodeURIComponent(bookingMessage);
        finalUrl = `${singleOption.url}?text=${encodedMessage}`;
      }

      window.open(finalUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    // Nếu có nhiều options → show modal
    if (shouldShowModal) {
      setBookingModalOpen(true);
      return;
    }

    // Không có option nào
    console.warn('No booking URL available');
  };

  // Đổi VR360 background khi vào chi tiết ẩm thực
  useEffect(() => {
    onDiningVrChange?.(dining?.targetId ?? null, dining?.panoramaUrl ?? null, dining?.vrLink ?? null);
    // Cleanup: reset về null khi unmount
    return () => {
      onDiningVrChange?.(null, null, null);
    };
  }, [dining?.id, dining?.targetId, dining?.panoramaUrl, dining?.vrLink, onDiningVrChange]);

  // Container styles theo CSS được cung cấp
  const containerStyle: CSSProperties = {
    float: 'left' as const,
    width: '100%',
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    lineHeight: '22px',
    textAlign: 'justify' as const,
  };

  // Back button style
  const backButtonStyle: CSSProperties = {
    marginBottom: 16,
    color: primaryColor,
    borderColor: `${primaryColor}80`,
    backgroundColor: 'transparent',
    fontSize: screens.md ? 13 : 12,
  };

  // Paragraph style theo CSS được cung cấp
  const paragraphStyle: CSSProperties = {
    background: 'transparent',
    outline: 'none',
    margin: '0 auto',
    padding: 0,
    border: 'none',
    fontSize: '100%',
    font: 'inherit',
    verticalAlign: 'baseline',
    display: 'block',
    marginBlockStart: '1em',
    marginBlockEnd: '1em',
    marginInlineStart: 0,
    marginInlineEnd: 0,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: '22px',
    textAlign: 'justify' as const,
  };

  // First paragraph không có margin top
  const firstParagraphStyle: CSSProperties = {
    ...paragraphStyle,
    marginBlockStart: 0,
  };

  const galleryContainerStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 5,
    marginTop: 10,
  };

  // Loading state
  if (loading) {
    return (
      <div className={`dining-detail ${className}`} style={{ textAlign: 'center', padding: '40px 0' }}>
        <Spin size="large" />
        <p style={{ color: 'rgba(255, 255, 255, 0.6)', marginTop: 16 }}>Đang tải chi tiết ẩm thực...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`dining-detail ${className}`}>
        <Button 
          type="text" 
          icon={<ArrowLeftOutlined />}
          onClick={onBack}
          style={backButtonStyle}
        >
          Quay lại
        </Button>
        <Alert
          type="error"
          title="Lỗi tải dữ liệu"
          message={error.message || 'Không thể tải thông tin ẩm thực. Vui lòng thử lại sau.'}
        />
      </div>
    );
  }

  // Empty/Not found state
  if (!dining) {
    return (
      <div className={`dining-detail ${className}`}>
        <Button 
          type="text" 
          icon={<ArrowLeftOutlined />}
          onClick={onBack}
          style={backButtonStyle}
        >
          Quay lại
        </Button>
        <Alert
          type="info"
          title="Không tìm thấy"
          message="Thông tin ẩm thực không tồn tại."
        />
      </div>
    );
  }

  // Tách description thành các đoạn bằng dấu xuống dòng
  const paragraphs = dining.description.split('\n\n').filter(p => p.trim());

  return (
    <div className={`dining-detail ${className}`} style={containerStyle}>
      {/* Back button */}
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={onBack}
        style={backButtonStyle}
        className="dining-back-btn"
      >
        {t.back}
      </Button>

      {/* Nội dung chi tiết - chỉ là thẻ <p> đơn giản */}
      <div className="page-content">
        {paragraphs.map((paragraph, index) => (
          <p 
            key={index} 
            style={index === 0 ? firstParagraphStyle : paragraphStyle}
          >
            {paragraph}
          </p>
        ))}

        {/* Operating Hours - from API */}
        {dining.operatingHours && (
          <p style={{ 
            color: primaryColor, 
            fontSize: screens.md ? 13 : 11, 
            fontWeight: 500,
            marginTop: 16 
          }}>
            {t.operatingHours}: <strong>{dining.operatingHours}</strong>
          </p>
        )}

        {/* Gallery Images nếu có */}
        {dining.galleryImages && dining.galleryImages.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <h4 style={{ color: primaryColor, fontSize: screens.md ? 15 : 13, marginBottom: 8 }}>{t.images}</h4>
            <div style={galleryContainerStyle}>
              {dining.galleryImages.map((img, idx) => (
                <div
                  key={idx}
                  style={{ cursor: 'pointer', borderRadius: 4, overflow: 'hidden' }}
                  onClick={() => openGallery(idx)}
                >
                  <Image
                    src={img}
                    alt={`${dining.name} - Image ${idx + 1}`}
                    width="100%"
                    height={80}
                    style={{ objectFit: 'cover' }}
                    preview={false}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Nút Đặt ngay - hiện khi có ít nhất 1 booking option - NẰM CUỐI CÙNG */}
        {(() => {
          const { optionCount } = getBookingBehavior(
            settings?.messenger_url,
            settings?.phone_number,
            dining.bookingUrl
          );
          
          return optionCount > 0 ? (
            <div style={{
              marginTop: 20,
              padding: screens.md ? '18px 20px' : '14px 16px',
              background: `linear-gradient(135deg, ${primaryColor}40 0%, ${primaryColor}20 100%)`,
              borderRadius: 12,
              border: `1px solid ${primaryColor}60`,
              boxShadow: `0 4px 15px ${primaryColor}30`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Button 
                type="primary"
                size={screens.md ? 'large' : 'middle'}
                onClick={handleBooking}
                style={{ 
                  background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100%)`,
                  borderColor: primaryColor,
                  color: '#000',
                  fontWeight: 600,
                  fontSize: screens.md ? 16 : 14,
                  padding: screens.md ? '10px 40px' : '8px 30px',
                  height: 'auto',
                  borderRadius: 8,
                  boxShadow: `0 4px 12px ${primaryColor}50`,
                  transition: 'all 0.3s ease',
                  width: '100%',
                }}
                onMouseEnter={(e) => {
                  const btn = e.currentTarget as HTMLElement;
                  btn.style.transform = 'translateY(-2px)';
                  btn.style.boxShadow = `0 6px 20px ${primaryColor}70`;
                }}
                onMouseLeave={(e) => {
                  const btn = e.currentTarget as HTMLElement;
                  btn.style.transform = 'translateY(0)';
                  btn.style.boxShadow = `0 4px 12px ${primaryColor}50`;
                }}
              >
                {t.bookNow}
              </Button>
            </div>
          ) : null;
        })()}
      </div>

      {/* Image Gallery Viewer - Fullscreen */}
      <ImageGalleryViewer
        images={dining.galleryImages}
        initialIndex={galleryIndex}
        visible={galleryOpen}
        onClose={closeGallery}
      />

      {/* Booking Options Modal */}
      <BookingOptionsModal
        open={bookingModalOpen}
        onClose={() => setBookingModalOpen(false)}
        {...resolveContact(saleContact, {
          messengerUrl: settings?.messenger_url,
          zaloPhone: settings?.phone_number,
          bookingUrl: dining?.bookingUrl,
        })}
        itemName={dining?.name || ''}
        wantToBookText={t.wantToBook}
        messageCopiedText={t.messageCopied}
        primaryColor={primaryColor}
      />
    </div>
  );
});

DiningDetail.displayName = 'DiningDetail';
