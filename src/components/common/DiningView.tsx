import type { FC } from 'react';
import { memo, useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DiningList } from './DiningList';
import { DiningDetail } from './DiningDetail';
import { useDiningDetail, useDiningDetailByCode } from '../../hooks/useDining';
import { useProperty } from '../../context/PropertyContext';
import { useLanguage } from '../../context/LanguageContext';
import { extractCleanPath, getLocalizedPath } from '../../constants/routes';
import { getMenuTranslations } from '../../constants/translations';
import type { DiningUIData } from '../../types/dining';

interface DiningViewProps {
  className?: string;
  onTitleChange?: (title: string) => void;
  onDiningVrChange?: (targetId: string | null, panoramaUrl: string | null, vrLink: string | null) => void;
  onViewingDetailChange?: (isViewing: boolean) => void;
  initialCode?: string; // Code từ URL để hiển thị detail ngay khi load
}

export const DiningView: FC<DiningViewProps> = memo(({
  className = '',
  onTitleChange,
  onDiningVrChange,
  onViewingDetailChange,
  initialCode
}) => {
  const [selectedDiningId, setSelectedDiningId] = useState<number | null>(null);
  const [currentCode, setCurrentCode] = useState<string | undefined>(initialCode);
  const navigate = useNavigate();
  const location = useLocation();
  const { propertyId } = useProperty();
  const { locale } = useLanguage();

  // Sync initialCode from props when URL changes
  useEffect(() => {
    setCurrentCode(initialCode);
    if (!initialCode) {
      setSelectedDiningId(null);
    }
    onViewingDetailChange?.(!!initialCode);
  }, [initialCode, onViewingDetailChange]);

  // Fetch dining detail by ID when clicked from list
  const { dining: diningById, loading: loadingById, error: errorById } = useDiningDetail({
    propertyId,
    diningId: selectedDiningId,
    locale,
    enabled: selectedDiningId !== null && selectedDiningId > 0,
  });

  // Fetch dining detail by code when loaded from URL
  const { dining: diningByCode, loading: loadingByCode, error: errorByCode } = useDiningDetailByCode({
    propertyId,
    diningCode: currentCode,
    locale,
    enabled: !!currentCode && (selectedDiningId === null || selectedDiningId <= 0),
  });

  // Combine results - prefer diningById if selected, fallback diningByCode.
  // Chặn data cũ khi đổi item: bỏ qua nếu id/code không khớp để không emit VR cũ.
  const dining =
    selectedDiningId && selectedDiningId > 0
      ? diningById && diningById.id === selectedDiningId
        ? diningById
        : null
      : diningByCode && (!currentCode || diningByCode.code === currentCode)
        ? diningByCode
        : null;
  const loading = selectedDiningId && selectedDiningId > 0 ? loadingById : loadingByCode;
  const error = selectedDiningId && selectedDiningId > 0 ? errorById : errorByCode;

  const handleDiningClick = useCallback((dining: DiningUIData) => {
    setSelectedDiningId(dining.id);
    setCurrentCode(dining.code);
    const cleanPath = extractCleanPath(location.pathname);
    const newPath = getLocalizedPath(`${cleanPath}/${dining.code}`, locale);
    navigate(newPath, { replace: true });
    onTitleChange?.(dining.name);
    onViewingDetailChange?.(true);
    onDiningVrChange?.(dining.targetId, dining.panoramaUrl, dining.vrLink);
  }, [onTitleChange, onViewingDetailChange, onDiningVrChange, navigate, location.pathname, locale]);

  const handleBack = useCallback(() => {
    setSelectedDiningId(null);
    setCurrentCode(undefined);
    const cleanPath = '/am-thuc';
    const newPath = getLocalizedPath(cleanPath, locale);
    navigate(newPath, { replace: true });
    const t = getMenuTranslations(locale);
    onTitleChange?.(t.dining);
    onDiningVrChange?.(null, null, null);
    onViewingDetailChange?.(false);
  }, [onTitleChange, onDiningVrChange, onViewingDetailChange, navigate, locale]);

  // Update title when dining data changes
  useEffect(() => {
    if (dining && (selectedDiningId || currentCode)) {
      onTitleChange?.(dining.name);
    }
  }, [dining, selectedDiningId, currentCode, onTitleChange]);

  // Set title to list page title when not viewing detail
  useEffect(() => {
    if (!selectedDiningId && !currentCode) {
      const t = getMenuTranslations(locale);
      onTitleChange?.(t.dining);
    }
  }, [selectedDiningId, currentCode, locale, onTitleChange]);

  // Show detail view when dining is selected (clicked from list)
  if (selectedDiningId !== null && selectedDiningId > 0) {
    return (
      <DiningDetail
        dining={dining}
        loading={loading}
        error={error}
        onBack={handleBack}
        onDiningVrChange={onDiningVrChange}
        className={className}
      />
    );
  }

  // Show detail view when code is in URL (page load with slug)
  if (currentCode) {
    return (
      <DiningDetail
        dining={dining}
        loading={loading}
        error={error}
        onBack={handleBack}
        onDiningVrChange={onDiningVrChange}
        className={className}
      />
    );
  }

  // Show list view
  return (
    <DiningList 
      onDiningClick={handleDiningClick}
      className={className}
    />
  );
});

DiningView.displayName = 'DiningView';
