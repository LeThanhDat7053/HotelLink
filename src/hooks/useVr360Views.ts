import { useEffect, useSyncExternalStore } from 'react';
import { vr360ViewStore } from '../services/vr360ViewStore';
import type { Vr360ViewsFile } from '../types/vr360Views';

/**
 * Góc nhìn VR360 theo vị trí menu (data/vr360-views.json). Tự tải file khi dùng lần đầu;
 * cập nhật ngay khi trang /vr360-scene-sync lưu.
 */
export const useVr360Views = (): Vr360ViewsFile => {
  const file = useSyncExternalStore(vr360ViewStore.subscribe, vr360ViewStore.getSnapshot, vr360ViewStore.getSnapshot);

  useEffect(() => {
    void vr360ViewStore.load();
  }, []);

  return file;
};
