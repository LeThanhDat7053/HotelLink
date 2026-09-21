import type { FC, CSSProperties } from 'react';
import { memo, useState, useCallback, useEffect } from 'react';
import { Typography, Button, Grid, Spin, Alert, message } from 'antd';
import { 
  HomeOutlined, 
  ExpandOutlined, 
  RestOutlined,
  ArrowLeftOutlined,
  UserOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { getMenuTranslations } from '../../constants/translations';
import { usePropertyData } from '../../context/PropertyContext';
import { useSale } from '../../context/SaleContext';
import { useVrHotelSettings } from '../../hooks/useVR360';
import { ImageGalleryViewer } from './ImageGalleryViewer';
import { BookingOptionsModal, getBookingBehavior } from './BookingOptionsModal';
import { getBookingUrlWithMessage, createBookingMessage, copyToClipboard } from '../../utils/bookingHelper';
import { resolveContact } from '../../utils/contactResolver';
import type { RoomUIData } from '../../types/room';

const { Paragraph, Text } = Typography;
const { useBreakpoint } = Grid;

interface RoomDetailProps {
  room: RoomUIData | null;
  loading?: boolean;
  error?: Error | null;
  onBack?: () => void;
  onRoomVrChange?: (targetId: string | null, panoramaUrl: string | null, vrLink: string | null) => void;
  className?: string;
  roomCode?: string;
}

export const RoomDetail: FC<RoomDetailProps> = memo(({
  room,
  onRoomVrChange,
  loading = false,
  error = null,
  onBack,
  className = '',
}) => {
  const screens = useBreakpoint();
  const { primaryColor } = useTheme();
  const { locale } = useLanguage();
  const t = getMenuTranslations(locale);
  const { propertyId } = usePropertyData();
  const { settings } = useVrHotelSettings(propertyId);
  const { saleContact } = useSale();
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);

  // Icon mapping helper with dynamic color
  const iconStyle = { fontSize: 14, marginRight: 8, color: primaryColor };
  const getIcon = (iconType: string) => {
    switch (iconType) {
      case 'capacity': return <UserOutlined style={iconStyle} />;
      case 'area': return <ExpandOutlined style={iconStyle} />;
      case 'floor': return <HomeOutlined style={iconStyle} />;
      case 'bed': return <RestOutlined style={iconStyle} />;
      case 'price': return <DollarOutlined style={iconStyle} />;
      default: return <HomeOutlined style={iconStyle} />;
    }
  };

  const openGallery = useCallback((index: number) => {
    setGalleryIndex(index);
    setGalleryOpen(true);
  }, []);

  const closeGallery = useCallback(() => {
    setGalleryOpen(false);
  }, []);

  // Chuyển đến trang đặt phòng
  // Logic mới: Hiện popup với 3 lựa chọn (Messenger, Zalo, Booking)
  // Nếu chỉ có 1 option → redirect trực tiếp
  const handleBooking = useCallback(async () => {
    const itemName = room?.name || '';

    // Gộp contact: có sale (?ref=) thì dùng zalo_url/phone_url/booking_url của sale,
    // ngược lại dùng contact mặc định của hotel (messenger/zalo/booking).
    const { messengerUrl, zaloPhone, phoneUrl, bookingUrl } = resolveContact(saleContact, {
      messengerUrl: settings?.messenger_url,
      zaloPhone: settings?.phone_number,
      // Ưu tiên booking_url của room, fallback về settings (chỉ áp dụng khi không có sale)
      bookingUrl: room?.bookingUrl || settings?.booking_url,
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
  }, [room?.bookingUrl, room?.name, saleContact, settings?.messenger_url, settings?.phone_number, settings?.booking_url, t.wantToBook, t.messageCopied]);

  // Emit cả targetId lẫn vrLink lên parent, để App.tsx tự quyết định
  // ưu tiên local viewer (target_id) hay external link (vr_link)
  // tuỳ theo khách sạn có local 3DVista hay không
  useEffect(() => {
    if (!room) return;
    onRoomVrChange?.(room.targetId, room.panoramaUrl, room.vrLink);
    return () => {
      onRoomVrChange?.(null, null, null);
    };
  }, [room?.id, room?.targetId, room?.panoramaUrl, room?.vrLink, onRoomVrChange]);

  // Styles
  const scrollContainerStyle: CSSProperties = {
    float: 'left' as const,
    width: '100%',
    maxHeight: screens.md ? 272 : 220,
    paddingRight: 16,
    overflowY: 'auto',
    overflowX: 'hidden',
    maxWidth: '100%',
    paddingBottom: 6,
  };

  const descriptionStyle: CSSProperties = {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: screens.md ? 14 : 12,
    lineHeight: screens.md ? '22px' : '18px',
    textAlign: 'justify' as const,
    margin: 0,
    marginBottom: 16,
    whiteSpace: 'pre-wrap', // Giữ nguyên xuống dòng và khoảng trắng từ backend
  };

  const priceContainerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 20,
    padding: screens.md ? '24px 28px' : '20px 22px',
    background: `linear-gradient(135deg, ${primaryColor}40 0%, ${primaryColor}20 100%)`,
    borderRadius: 12,
    border: `1px solid ${primaryColor}60`,
    boxShadow: `0 4px 15px ${primaryColor}30`,
  };

  const priceTextStyle: CSSProperties = {
    color: 'white',
    fontSize: screens.md ? 22 : 18,
    fontWeight: 500,
    margin: 0,
  };

  const roomInfoStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: screens.md ? 13 : 11,
    marginBottom: 8,
    paddingLeft: 4,
  };

  const sectionTitleStyle: CSSProperties = {
    color: primaryColor,
    fontSize: screens.md ? 14 : 12,
    fontWeight: 500,
    marginTop: 16,
    marginBottom: 10,
    paddingBottom: 6,
    borderBottom: `1px solid ${primaryColor}80`,
  };

  const amenitiesListStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '4px 12px',
    margin: 0,
    padding: 0,
    listStyle: 'none',
  };

  const amenityItemStyle: CSSProperties = {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: screens.md ? 12 : 10,
    lineHeight: '18px',
    position: 'relative' as const,
    paddingLeft: 12,
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
      <div className={`room-detail ${className}`} style={{ textAlign: 'center', padding: '40px 0' }}>
        <Spin size="large" />
        <p style={{ color: 'rgba(255, 255, 255, 0.6)', marginTop: 16 }}>Đang tải chi tiết phòng...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`room-detail ${className}`}>
        {onBack && (
          <Button 
            type="text" 
            icon={<ArrowLeftOutlined />}
            onClick={onBack}
            style={{ 
              color: primaryColor, 
              padding: '0 0 8px 0',
              fontSize: screens.md ? 13 : 11,
            }}
          >
            {t.back}
          </Button>
        )}
        <Alert
          type="error"
          title={t.errorLoading}
          message={error.message || t.errorLoading}
        />
      </div>
    );
  }

  // Empty/Not found state
  if (!room) {
    return (
      <div className={`room-detail ${className}`}>
        {onBack && (
          <Button 
            type="text" 
            icon={<ArrowLeftOutlined />}
            onClick={onBack}
            style={{ 
              color: primaryColor, 
              padding: '0 0 8px 0',
              fontSize: screens.md ? 13 : 11,
            }}
          >
            Quay lại
          </Button>
        )}
        <Alert
          type="warning"
          title={t.notFound}
          message={t.notFound}
        />
      </div>
    );
  }

  // Format price
  const formattedPrice = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(room.price);

  return (
    <div className={`room-detail ${className}`}>
      {/* Back button */}
      {onBack && (
        <Button 
          type="text" 
          icon={<ArrowLeftOutlined />}
          onClick={onBack}
          style={{ 
            color: primaryColor, 
            padding: '0 0 8px 0',
            fontSize: screens.md ? 13 : 11,
          }}
        >
          {t.back}
        </Button>
      )}

      {/* Scrollable content */}
      <div className="nicescroll-bg" style={scrollContainerStyle}>
        {/* Description */}
        <Paragraph style={descriptionStyle}>
          {room.description}
        </Paragraph>

        {/* Price & Booking */}
        <div style={{
          ...priceContainerStyle,
          justifyContent: room.price > 0 ? 'space-between' : 'center',
        }}>
          {/* Price - Chỉ hiển thị khi giá > 0 */}
          {room.price > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: screens.md ? 14 : 12, margin: 0 }}>
                {t.pricePerNight}
              </Text>
              <Text style={priceTextStyle}>
                <strong style={{ color: primaryColor, fontSize: screens.md ? 28 : 22 }}>{formattedPrice}</strong>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: screens.md ? 16 : 14, marginLeft: 4 }}>/{t.night}</span>
              </Text>
            </div>
          )}
          {/* Button - Luôn hiển thị, full width khi không có giá */}
          <Button 
            type="primary"
            size="large"
            onClick={handleBooking}
            style={{ 
              background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100%)`,
              borderColor: primaryColor,
              color: '#000',
              fontWeight: 700,
              fontSize: screens.md ? 18 : 16,
              padding: screens.md ? '12px 36px' : '10px 28px',
              height: 'auto',
              borderRadius: 10,
              boxShadow: `0 4px 12px ${primaryColor}50`,
              transition: 'all 0.3s ease',
              width: room.price > 0 ? 'auto' : '100%',
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

        {/* Room Info */}
        <div className="room-info">
          {room.capacity > 0 && (
            <div style={roomInfoStyle}>
              {getIcon('capacity')}
              <span>{t.capacity}: <strong>{room.capacity} {t.people}</strong></span>
            </div>
          )}
          {room.size > 0 && (
            <div style={roomInfoStyle}>
              {getIcon('area')}
              <span>{t.area}: <strong>{room.size}m²</strong></span>
            </div>
          )}
          {room.floor !== null && (
            <div style={roomInfoStyle}>
              {getIcon('floor')}
              <span>{t.floor}: <strong>{room.floor}</strong></span>
            </div>
          )}
          {room.bedType && (
            <div style={roomInfoStyle}>
              {getIcon('bed')}
              <span>{t.bedType}: <strong>{room.bedType}</strong></span>
            </div>
          )}
        </div>

        {/* Amenities */}
        {room.amenities.length > 0 && (
          <>
            <div style={sectionTitleStyle}>{t.amenities}</div>
            <ul style={amenitiesListStyle}>
              {room.amenities.map((amenity, index) => (
                <li key={index} style={amenityItemStyle}>
                  <span style={{ 
                    position: 'absolute', 
                    left: 0, 
                    color: primaryColor 
                  }}>•</span>
                  {amenity}
                </li>
              ))}
            </ul>
          </>
        )}

        {/* Gallery - Ảnh chi tiết (is_primary=false) */}
        {room.galleryImages.length > 0 && (
          <>
            <div style={sectionTitleStyle}>{t.images}</div>
            <div style={galleryContainerStyle}>
              {room.galleryImages.map((img, index) => (
                <div
                  key={index}
                  onClick={() => openGallery(index)}
                  style={{ 
                    width: '100%', 
                    aspectRatio: '1/1',
                    backgroundImage: `url(${img})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    borderRadius: 4,
                    cursor: 'pointer',
                    transition: 'opacity 0.2s ease',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                />
              ))}
            </div>
          </>
        )}

      </div>

      {/* Image Gallery Viewer - Fullscreen */}
      <ImageGalleryViewer
        images={room.galleryImages}
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
          bookingUrl: room?.bookingUrl || settings?.booking_url,
        })}
        itemName={room?.name || ''}
        wantToBookText={t.wantToBook}
        messageCopiedText={t.messageCopied}
        primaryColor={primaryColor}
      />

      {/* Custom scrollbar styles */}
      <style>{`
        .room-detail .nicescroll-bg::-webkit-scrollbar {
          width: 2px;
        }
        .room-detail .nicescroll-bg::-webkit-scrollbar-thumb {
          background: ${primaryColor}80;
        }
        .room-detail .nicescroll-bg::-webkit-scrollbar-track {
          background: rgba(251, 228, 150, 0);
        }
      `}</style>
    </div>
  );
});

RoomDetail.displayName = 'RoomDetail';
