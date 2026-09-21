import type { FC, CSSProperties } from 'react';
import { memo, useState, useEffect } from 'react';
import { Button, Grid, Spin, Alert, Image } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { getMenuTranslations } from '../../constants/translations';
import { ImageGalleryViewer } from './ImageGalleryViewer';
import type { FacilityUIData } from '../../types/facility';

const { useBreakpoint } = Grid;

interface FacilityDetailProps {
  facility: FacilityUIData | null;
  loading?: boolean;
  error?: Error | null;
  onBack: () => void;
  onFacilityVrChange?: (targetId: string | null, panoramaUrl: string | null, vrLink: string | null) => void;
  className?: string;
}

export const FacilityDetail: FC<FacilityDetailProps> = memo(({
  facility,
  loading = false,
  error = null,
  onBack,
  onFacilityVrChange,
  className = '',
}) => {
  const screens = useBreakpoint();
  const { primaryColor } = useTheme();
  const { locale } = useLanguage();
  const t = getMenuTranslations(locale);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const openGallery = (index: number) => {
    setGalleryIndex(index);
    setGalleryOpen(true);
  };

  const closeGallery = () => {
    setGalleryOpen(false);
  };

  // Đổi VR360 background khi vào chi tiết tiện ích
  useEffect(() => {
    onFacilityVrChange?.(facility?.targetId ?? null, facility?.panoramaUrl ?? null, facility?.vrLink ?? null);
    // Cleanup: reset về null khi unmount
    return () => {
      onFacilityVrChange?.(null, null, null);
    };
  }, [facility?.id, facility?.targetId, facility?.panoramaUrl, facility?.vrLink, onFacilityVrChange]);

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
      <div className={`facility-detail ${className}`} style={{ textAlign: 'center', padding: '40px 0' }}>
        <Spin size="large" />
        <p style={{ color: 'rgba(255, 255, 255, 0.6)', marginTop: 16 }}>Đang tải chi tiết tiện ích...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`facility-detail ${className}`}>
        <Button 
          type="text" 
          icon={<ArrowLeftOutlined />}
          onClick={onBack}
          style={backButtonStyle}
        >
          {t.back}
        </Button>
        <Alert
          type="error"
          title={t.errorLoading}
          message={error.message || 'Không thể tải thông tin tiện ích. Vui lòng thử lại sau.'}
        />
      </div>
    );
  }

  // Empty/Not found state
  if (!facility) {
    return (
      <div className={`facility-detail ${className}`}>
        <Button 
          type="text" 
          icon={<ArrowLeftOutlined />}
          onClick={onBack}
          style={backButtonStyle}
        >
          {t.back}
        </Button>
        <Alert
          type="info"
          title={t.notFound}
          message="Thông tin tiện ích không tồn tại."
        />
      </div>
    );
  }

  // Tách description thành các đoạn bằng dấu xuống dòng
  const paragraphs = facility.description.split('\n\n').filter(p => p.trim());

  return (
    <div className={`facility-detail ${className}`} style={containerStyle}>
      {/* Back button */}
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={onBack}
        style={backButtonStyle}
        className="facility-back-btn"
      >
        {t.back}
      </Button>

      {/* Nội dung chi tiết - chỉ là thẻ <p> đơn giản */}
      <div className="page-content">
        {/* Operating Hours - từ API */}
        {facility.operatingHours && (
          <p style={{ 
            color: primaryColor, 
            fontSize: screens.md ? 13 : 11, 
            marginBottom: 8,
            fontWeight: 500,
          }}>
            {t.operatingHours}: <strong>{facility.operatingHours}</strong>
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

        {/* Gallery Images nếu có */}
        {facility.galleryImages && facility.galleryImages.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <h4 style={{ color: primaryColor, fontSize: screens.md ? 15 : 13, marginBottom: 8 }}>{t.images}</h4>
            <div style={galleryContainerStyle}>
              {facility.galleryImages.map((img, idx) => (
                <div
                  key={idx}
                  style={{ cursor: 'pointer', borderRadius: 4, overflow: 'hidden' }}
                  onClick={() => openGallery(idx)}
                >
                  <Image
                    src={img}
                    alt={`${facility.name} - Image ${idx + 1}`}
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
      </div>

      {/* Image Gallery Viewer - Fullscreen */}
      <ImageGalleryViewer
        images={facility.galleryImages}
        initialIndex={galleryIndex}
        visible={galleryOpen}
        onClose={closeGallery}
      />
    </div>
  );
});

FacilityDetail.displayName = 'FacilityDetail';
