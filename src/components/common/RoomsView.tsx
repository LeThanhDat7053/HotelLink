import type { FC } from 'react';
import { memo, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RoomList } from './RoomList';
import { RoomDetail } from './RoomDetail';
import { useRoomDetail, useRoomDetailByCode } from '../../hooks/useRooms';
import { useProperty } from '../../context/PropertyContext';
import { useLanguage } from '../../context/LanguageContext';
import { getLocalizedPath } from '../../constants/routes';
import { getMenuTranslations } from '../../constants/translations';
import type { RoomUIData } from '../../types/room';

interface RoomsViewProps {
  className?: string;
  onTitleChange?: (title: string) => void;
  onRoomVrChange?: (targetId: string | null, panoramaUrl: string | null, vrLink: string | null) => void;
  onViewingDetailChange?: (isViewing: boolean) => void;
  initialCode?: string; // Code from URL passed from App.tsx
}

export const RoomsView: FC<RoomsViewProps> = memo(({
  className = '',
  onTitleChange,
  onRoomVrChange,
  onViewingDetailChange,
  initialCode
}) => {
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [currentCode, setCurrentCode] = useState<string | undefined>(initialCode);
  const navigate = useNavigate();
  const { propertyId } = useProperty();
  const { locale } = useLanguage();

  // Sync initialCode from props when URL changes
  useEffect(() => {
    setCurrentCode(initialCode);
    if (!initialCode) {
      setSelectedRoomId(null);
    }
    onViewingDetailChange?.(!!initialCode);
  }, [initialCode, onViewingDetailChange]);

  // Fetch room detail when selected by ID (click từ list)
  const { room: roomById, loading: loadingById, error: errorById } = useRoomDetail({
    propertyId,
    roomId: selectedRoomId,
    locale,
    enabled: selectedRoomId !== null && selectedRoomId > 0,
  });

  // Fetch room detail by code (từ URL khi page load)
  const { room: roomByCode, loading: loadingByCode, error: errorByCode } = useRoomDetailByCode({
    propertyId,
    roomCode: currentCode,
    locale,
    enabled: !!currentCode && (selectedRoomId === null || selectedRoomId <= 0),
  });

  // Combine room data: ưu tiên roomById nếu có, fallback roomByCode.
  // Chặn data cũ: khi đổi phòng, hook giữ data phòng trước trong lúc fetch phòng mới
  // → phải bỏ qua nếu id/code không khớp, tránh emit VR của phòng cũ (nhảy cảnh sai).
  const room =
    selectedRoomId && selectedRoomId > 0
      ? roomById && roomById.id === selectedRoomId
        ? roomById
        : null
      : roomByCode && (!currentCode || roomByCode.code === currentCode)
        ? roomByCode
        : null;
  const loading = selectedRoomId && selectedRoomId > 0 ? loadingById : loadingByCode;
  const error = selectedRoomId && selectedRoomId > 0 ? errorById : errorByCode;

  const handleRoomClick = useCallback((room: RoomUIData) => {
    setSelectedRoomId(room.id);
    setCurrentCode(room.code);
    const newPath = getLocalizedPath(`/phong-nghi/${room.code}`, locale);
    navigate(newPath, { replace: true });
    onTitleChange?.(room.name);
    onViewingDetailChange?.(true);
    // Emit VR info ngay lập tức từ list data — không chờ fetch detail
    // để chuyển cảnh mượt như các menu lớn
    onRoomVrChange?.(room.targetId, room.panoramaUrl, room.vrLink);
  }, [onTitleChange, onViewingDetailChange, onRoomVrChange, navigate, locale]);

  const handleBack = useCallback(() => {
    setSelectedRoomId(null);
    setCurrentCode(undefined);
    const cleanPath = '/phong-nghi';
    const newPath = getLocalizedPath(cleanPath, locale);
    navigate(newPath, { replace: true });
    const t = getMenuTranslations(locale);
    onTitleChange?.(t.rooms);
    onViewingDetailChange?.(false);
  }, [onTitleChange, onViewingDetailChange, navigate, locale]);

  // Update title when room data changes
  useEffect(() => {
    if (room) {
      onTitleChange?.(room.name);
    }
  }, [room, onTitleChange]);

  // Set title to list page title when not viewing detail
  useEffect(() => {
    if (!selectedRoomId && !currentCode) {
      const t = getMenuTranslations(locale);
      onTitleChange?.(t.rooms);
    }
  }, [selectedRoomId, currentCode, locale, onTitleChange]);

  // Show detail view when room is selected or code in URL
  if (selectedRoomId !== null && selectedRoomId > 0) {
    return (
      <RoomDetail 
        room={room} 
        loading={loading}
        error={error}
        onBack={handleBack}
        onRoomVrChange={onRoomVrChange}
        className={className}
        roomCode={currentCode}
      />
    );
  }

  // Show detail view when code is in URL (page load with slug)
  if (currentCode) {
    return (
      <RoomDetail 
        room={room} 
        loading={loading}
        error={error}
        onBack={handleBack}
        onRoomVrChange={onRoomVrChange}
        className={className}
        roomCode={currentCode}
      />
    );
  }

  // Show list view
  return (
    <RoomList 
      onRoomClick={handleRoomClick}
      className={className}
    />
  );
});

RoomsView.displayName = 'RoomsView';
