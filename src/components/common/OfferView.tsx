import type { FC } from 'react';
import { memo, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { OfferList } from './OfferList';
import { OfferDetail } from './OfferDetail';
import { useOfferDetail } from '../../hooks/useOffers';
import { useProperty } from '../../context/PropertyContext';
import { useLanguage } from '../../context/LanguageContext';
import { getLocalizedPath } from '../../constants/routes';
import { getMenuTranslations } from '../../constants/translations';
import type { OfferUIData } from '../../types/offer';

interface OfferViewProps {
  className?: string;
  onTitleChange?: (title: string) => void;
  onOfferVrChange?: (targetId: string | null, panoramaUrl: string | null, vrLink: string | null) => void;
  onViewingDetailChange?: (isViewing: boolean) => void;
  initialCode?: string; // Code từ URL để hiển thị detail ngay khi load
}

export const OfferView: FC<OfferViewProps> = memo(({
  className = '',
  onTitleChange,
  onOfferVrChange,
  onViewingDetailChange,
  initialCode
}) => {
  const [selectedOfferCode, setSelectedOfferCode] = useState<string | undefined>(initialCode);
  const navigate = useNavigate();
  const { propertyId } = useProperty();
  const { locale } = useLanguage();
  const t = getMenuTranslations(locale);

  // Sync initialCode from props when URL changes
  useEffect(() => {
    setSelectedOfferCode(initialCode);
    onViewingDetailChange?.(!!initialCode);
  }, [initialCode, onViewingDetailChange]);

  // Fetch offer detail when selected
  const { offer: offerRaw, loading, error } = useOfferDetail({
    propertyId: propertyId ?? undefined,
    code: selectedOfferCode || '',
    locale,
  });
  // Chặn data cũ khi đổi ưu đãi: hook giữ offer trước trong lúc fetch offer mới
  // → bỏ qua nếu code không khớp, tránh emit VR của offer cũ.
  const offer =
    offerRaw && (!selectedOfferCode || offerRaw.code === selectedOfferCode)
      ? offerRaw
      : null;

  const handleOfferClick = useCallback((offer: OfferUIData) => {
    setSelectedOfferCode(offer.code);
    const newPath = getLocalizedPath(`/uu-dai/${offer.code}`, locale);
    navigate(newPath, { replace: true });
    onTitleChange?.(offer.title);
    onViewingDetailChange?.(true);
    onOfferVrChange?.(offer.targetId, offer.panoramaUrl, offer.vrLink);
  }, [onTitleChange, onViewingDetailChange, onOfferVrChange, navigate, locale]);

  const handleBack = useCallback(() => {
    setSelectedOfferCode(undefined);
    const newPath = getLocalizedPath('/uu-dai', locale);
    navigate(newPath, { replace: true });
    onTitleChange?.(t.offers);
    onOfferVrChange?.(null, null, null);
    onViewingDetailChange?.(false);
  }, [onTitleChange, onOfferVrChange, onViewingDetailChange, navigate, locale, t.offers]);

  // Update title when offer data changes
  useEffect(() => {
    if (offer && selectedOfferCode) {
      onTitleChange?.(offer.title);
    }
  }, [offer, selectedOfferCode, onTitleChange]);

  // Set title to list page title when not viewing detail
  useEffect(() => {
    if (!selectedOfferCode) {
      onTitleChange?.(t.offers);
    }
  }, [selectedOfferCode, locale, onTitleChange, t.offers]);

  // Show detail view when offer is selected
  if (selectedOfferCode) {
    return (
      <OfferDetail
        offer={offer}
        loading={loading}
        error={error}
        onBack={handleBack}
        onOfferVrChange={onOfferVrChange}
        className={className}
      />
    );
  }

  // Show list view
  return (
    <OfferList 
      onOfferClick={handleOfferClick}
      className={className}
    />
  );
});

OfferView.displayName = 'OfferView';

export default OfferView;
