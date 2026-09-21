import type { FC, CSSProperties } from 'react';
import { memo, useEffect } from 'react';
import { Button, Grid, Spin, Alert, Tag, Divider } from 'antd';
import { 
  ArrowLeftOutlined, 
  CalendarOutlined, 
  MoonOutlined,
  CheckCircleOutlined 
} from '@ant-design/icons';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import type { OfferUIData } from '../../types/offer';

const { useBreakpoint } = Grid;

// Translations cho Detail view
const DETAIL_TRANSLATIONS: Record<string, {
  loading: string;
  error: string;
  notFound: string;
  back: string;
  discount: string;
  validPeriod: string;
  from: string;
  to: string;
  conditions: string;
  minNights: string;
  nights: string;
  termsConditions: string;
  promoCode: string;
}> = {
  vi: {
    loading: 'Đang tải chi tiết ưu đãi...',
    error: 'Không thể tải thông tin ưu đãi. Vui lòng thử lại sau.',
    notFound: 'Thông tin ưu đãi không tồn tại.',
    back: 'Quay lại',
    discount: 'Giảm giá',
    validPeriod: 'Thời gian áp dụng',
    from: 'Từ',
    to: 'Đến',
    conditions: 'Điều kiện áp dụng',
    minNights: 'Ở tối thiểu',
    nights: 'đêm',
    termsConditions: 'Điều khoản & Điều kiện',
    promoCode: 'Mã ưu đãi',
  },
  en: {
    loading: 'Loading offer details...',
    error: 'Could not load offer details. Please try again later.',
    notFound: 'Offer not found.',
    back: 'Back',
    discount: 'Discount',
    validPeriod: 'Valid Period',
    from: 'From',
    to: 'To',
    conditions: 'Conditions',
    minNights: 'Minimum stay',
    nights: 'nights',
    termsConditions: 'Terms & Conditions',
    promoCode: 'Promo Code',
  },
  zh: {
    loading: '正在加载优惠详情...',
    error: '无法加载优惠详情。请稍后再试。',
    notFound: '优惠不存在。',
    back: '返回',
    discount: '折扣',
    validPeriod: '有效期',
    from: '从',
    to: '至',
    conditions: '适用条件',
    minNights: '最少住宿',
    nights: '晚',
    termsConditions: '条款与条件',
    promoCode: '优惠码',
  },
  ja: {
    loading: 'オファーの詳細を読み込み中...',
    error: 'オファーの詳細を読み込めませんでした。',
    notFound: 'オファーが見つかりません。',
    back: '戻る',
    discount: '割引',
    validPeriod: '有効期間',
    from: 'から',
    to: 'まで',
    conditions: '適用条件',
    minNights: '最低宿泊数',
    nights: '泊',
    termsConditions: '利用規約',
    promoCode: 'プロモコード',
  },
  ko: {
    loading: '혜택 상세 정보를 불러오는 중...',
    error: '혜택 상세 정보를 불러올 수 없습니다.',
    notFound: '혜택을 찾을 수 없습니다.',
    back: '뒤로',
    discount: '할인',
    validPeriod: '유효 기간',
    from: '부터',
    to: '까지',
    conditions: '적용 조건',
    minNights: '최소 숙박',
    nights: '박',
    termsConditions: '이용약관',
    promoCode: '프로모션 코드',
  },
  default: {
    loading: 'Loading...',
    error: 'Could not load offer.',
    notFound: 'Offer not found.',
    back: 'Back',
    discount: 'Discount',
    validPeriod: 'Valid Period',
    from: 'From',
    to: 'To',
    conditions: 'Conditions',
    minNights: 'Minimum stay',
    nights: 'nights',
    termsConditions: 'Terms & Conditions',
    promoCode: 'Promo Code',
  },
};

const getDetailTranslations = (locale: string) => {
  return DETAIL_TRANSLATIONS[locale] || DETAIL_TRANSLATIONS['default'];
};

interface OfferDetailProps {
  offer: OfferUIData | null;
  loading?: boolean;
  error?: Error | null;
  onBack: () => void;
  onOfferVrChange?: (targetId: string | null, panoramaUrl: string | null, vrLink: string | null) => void;
  className?: string;
}

export const OfferDetail: FC<OfferDetailProps> = memo(({
  offer,
  loading = false,
  error = null,
  onBack,
  onOfferVrChange,
  className = '',
}) => {
  const screens = useBreakpoint();
  const { primaryColor } = useTheme();
  const { locale } = useLanguage();
  const t = getDetailTranslations(locale);

  // Đổi VR360 background khi vào chi tiết
  useEffect(() => {
    onOfferVrChange?.(offer?.targetId ?? null, offer?.panoramaUrl ?? null, offer?.vrLink ?? null);
    return () => {
      onOfferVrChange?.(null, null, null);
    };
  }, [offer?.id, offer?.targetId, offer?.panoramaUrl, offer?.vrLink, onOfferVrChange]);

  // Container styles
  const containerStyle: CSSProperties = {
    float: 'left' as const,
    width: '100%',
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    lineHeight: '22px',
  };

  const backButtonStyle: CSSProperties = {
    marginBottom: 16,
    color: primaryColor,
    borderColor: `${primaryColor}80`,
    backgroundColor: 'transparent',
    fontSize: screens.md ? 13 : 12,
  };

  const sectionStyle: CSSProperties = {
    marginBottom: 20,
  };

  const labelStyle: CSSProperties = {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginBottom: 4,
    display: 'block',
  };

  const valueStyle: CSSProperties = {
    color: '#fff',
    fontSize: 14,
  };

  const discountBoxStyle: CSSProperties = {
    background: `linear-gradient(135deg, ${primaryColor}20, ${primaryColor}10)`,
    border: `1px solid ${primaryColor}50`,
    borderRadius: 12,
    padding: 20,
    textAlign: 'center' as const,
    marginBottom: 20,
  };

  const discountValueStyle: CSSProperties = {
    color: primaryColor,
    fontSize: screens.md ? 48 : 36,
    fontWeight: 'bold',
    lineHeight: 1,
  };

  const promoCodeStyle: CSSProperties = {
    background: 'rgba(255, 255, 255, 0.1)',
    border: '2px dashed rgba(255, 255, 255, 0.3)',
    borderRadius: 8,
    padding: '12px 24px',
    display: 'inline-block',
    marginTop: 12,
  };

  const promoCodeTextStyle: CSSProperties = {
    color: '#fff',
    fontSize: screens.md ? 20 : 16,
    fontWeight: 'bold',
    letterSpacing: 2,
  };

  const paragraphStyle: CSSProperties = {
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: '22px',
    textAlign: 'justify' as const,
    margin: 0,
    marginBottom: 16,
  };

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // Loading state
  if (loading) {
    return (
      <div className={`offer-detail ${className}`} style={{ textAlign: 'center', padding: '40px 0' }}>
        <Spin size="large" />
        <p style={{ color: 'rgba(255, 255, 255, 0.6)', marginTop: 16 }}>{t.loading}</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`offer-detail ${className}`}>
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
          message={t.error}
          style={{ background: 'rgba(255, 77, 79, 0.1)', border: '1px solid rgba(255, 77, 79, 0.3)' }}
        />
      </div>
    );
  }

  // Not found state
  if (!offer) {
    return (
      <div className={`offer-detail ${className}`}>
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
          message={t.notFound}
          style={{ background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)' }}
        />
      </div>
    );
  }

  // Tách description thành các đoạn
  const paragraphs = offer.description.split('\n\n').filter(p => p.trim());

  return (
    <div className={`offer-detail ${className}`} style={containerStyle}>
      {/* Back button */}
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={onBack}
        style={backButtonStyle}
      >
        {t.back}
      </Button>

      {/* Discount Box - Highlight */}
      <div style={discountBoxStyle}>
        <div style={discountValueStyle}>
          {offer.discountDisplay}
        </div>
        <div style={{ color: 'rgba(255, 255, 255, 0.7)', marginTop: 8 }}>
          {t.discount}
        </div>
        
        {/* Promo Code */}
        <div style={promoCodeStyle}>
          <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 11, display: 'block', marginBottom: 4 }}>
            {t.promoCode}
          </span>
          <span style={promoCodeTextStyle}>{offer.code}</span>
        </div>
      </div>

      {/* Description */}
      <div style={sectionStyle}>
        {paragraphs.map((paragraph, index) => (
          <p key={index} style={paragraphStyle}>
            {paragraph}
          </p>
        ))}
      </div>

      <Divider style={{ borderColor: 'rgba(255, 255, 255, 0.1)', margin: '16px 0' }} />

      {/* Valid Period */}
      <div style={sectionStyle}>
        <span style={labelStyle}>
          <CalendarOutlined style={{ marginRight: 6 }} />
          {t.validPeriod}
        </span>
        <div style={valueStyle}>
          {t.from} <strong>{formatDate(offer.validFrom)}</strong> {t.to} <strong>{formatDate(offer.validTo)}</strong>
        </div>
      </div>

      {/* Conditions */}
      {offer.minNights > 0 && (
        <div style={sectionStyle}>
          <span style={labelStyle}>
            <CheckCircleOutlined style={{ marginRight: 6 }} />
            {t.conditions}
          </span>
          <Tag icon={<MoonOutlined />} style={{ 
            background: 'rgba(255, 255, 255, 0.1)',
            borderColor: primaryColor,
            color: '#fff',
            padding: '4px 12px',
            fontSize: 13,
          }}>
            {t.minNights} {offer.minNights} {t.nights}
          </Tag>
        </div>
      )}

      {/* Terms & Conditions */}
      {offer.termsConditions && (
        <div style={sectionStyle}>
          <span style={labelStyle}>{t.termsConditions}</span>
          <div style={{ 
            ...valueStyle, 
            fontSize: 13, 
            color: 'rgba(255, 255, 255, 0.7)',
            background: 'rgba(0, 0, 0, 0.2)',
            padding: 12,
            borderRadius: 8,
            whiteSpace: 'pre-wrap',
          }}>
            {offer.termsConditions}
          </div>
        </div>
      )}
    </div>
  );
});

OfferDetail.displayName = 'OfferDetail';

export default OfferDetail;
