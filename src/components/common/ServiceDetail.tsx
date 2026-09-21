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
import type { ServiceUIData } from '../../types/service';

const { useBreakpoint } = Grid;

interface ServiceDetailProps {
  service: ServiceUIData | null;
  loading?: boolean;
  error?: Error | null;
  onBack: () => void;
  onServiceVrChange?: (targetId: string | null, panoramaUrl: string | null, vrLink: string | null) => void;
  className?: string;
}

export const ServiceDetail: FC<ServiceDetailProps> = memo(({
  service,
  loading = false,
  error = null,
  onBack,
  onServiceVrChange,
  className = ''
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
    const itemName = service?.name || '';

    // Gộp contact: có sale (?ref=) thì dùng contact của sale, ngược lại của hotel.
    const { messengerUrl, zaloPhone, phoneUrl, bookingUrl } = resolveContact(saleContact, {
      messengerUrl: settings?.messenger_url,
      zaloPhone: settings?.phone_number,
      bookingUrl: service?.bookingUrl,
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

  // Đổi VR360 background khi vào chi tiết dịch vụ
  useEffect(() => {
    onServiceVrChange?.(service?.targetId ?? null, service?.panoramaUrl ?? null, service?.vrLink ?? null);
    // Cleanup: reset về null khi unmount
    return () => {
      onServiceVrChange?.(null, null, null);
    };
  }, [service?.id, service?.targetId, service?.panoramaUrl, service?.vrLink, onServiceVrChange]);

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

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error || !service) {
    return (
      <div>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={onBack}
          style={backButtonStyle}
        >
          Quay lại
        </Button>
        <Alert
          title="Lỗi"
          message={error?.message || "Không tìm thấy dịch vụ"}
          type="error"
          showIcon
        />
      </div>
    );
  }

  // Tách description thành các đoạn bằng dấu xuống dòng
  const paragraphs = service.description ? service.description.split('\n\n').filter(p => p.trim()) : [];
  const galleryImages = service.galleryImages || [];

  return (
    <div className={`service-detail ${className}`} style={containerStyle}>
      {/* Back button */}
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={onBack}
        style={backButtonStyle}
        className="service-back-btn"
      >
        {t.back}
      </Button>

      {/* Nội dung chi tiết */}
      <div className="page-content">
        {/* Availability - từ API */}
        {service.availability && (
          <p style={{ 
            color: primaryColor, 
            fontSize: screens.md ? 13 : 11, 
            marginBottom: 4,
            fontWeight: 500,
          }}>
            {t.availability}: <strong>{service.availability}</strong>
          </p>
        )}

        {/* Price Info - từ API */}
        {service.priceInfo && (
          <p style={{ 
            color: primaryColor, 
            fontSize: screens.md ? 13 : 11, 
            marginBottom: 12,
            fontWeight: 500,
          }}>
            {t.priceInfo}: <strong>{Number(service.priceInfo).toLocaleString()} VNĐ</strong>
          </p>
        )}

        {paragraphs.map((paragraph, index) => (
          <p 
            key={index} 
            style={index === 0 ? firstParagraphStyle : paragraphStyle}
          >
            {paragraph}
          </p>
        ))}

        {/* Gallery images */}
        {galleryImages.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <h4 style={{ color: primaryColor, fontSize: screens.md ? 15 : 13, marginBottom: 8 }}>{t.images}</h4>
            <div style={galleryContainerStyle}>
              {galleryImages.map((img, index) => (
                <div
                  key={index}
                  style={{ cursor: 'pointer', borderRadius: 4, overflow: 'hidden' }}
                  onClick={() => openGallery(index)}
                >
                  <Image
                    src={img}
                    alt={`${service.name} - Ảnh ${index + 1}`}
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
            service.bookingUrl
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
        images={galleryImages}
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
          bookingUrl: service?.bookingUrl,
        })}
        itemName={service?.name || ''}
        wantToBookText={t.wantToBook}
        messageCopiedText={t.messageCopied}
        primaryColor={primaryColor}
      />
    </div>
  );
});

ServiceDetail.displayName = 'ServiceDetail';
