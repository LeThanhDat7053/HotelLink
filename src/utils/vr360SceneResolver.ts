import type { PageSettings, Vr360SceneItem } from '../types/settings';

export const parseSceneNameFromPanoramaUrl = (panoramaUrl?: string | null): string | null => {
  if (!panoramaUrl) {
    return null;
  }

  try {
    const parsedUrl = new URL(panoramaUrl, window.location.origin);
    const scene = parsedUrl.searchParams.get('scene');
    return scene?.trim() || null;
  } catch {
    const match = panoramaUrl.match(/[?&]scene=([^&]+)/i);
    return match ? decodeURIComponent(match[1]) : null;
  }
};

const matchTargetIdAsOrder = (
  targetId: string | number | null | undefined,
  scenes: Vr360SceneItem[],
): Vr360SceneItem | null => {
  if (typeof targetId === 'string' && targetId.trim()) {
    const parsedTargetId = Number(targetId);
    if (Number.isFinite(parsedTargetId) && parsedTargetId > 0) {
      return (
        scenes.find((scene) => scene.order === parsedTargetId || scene.order === parsedTargetId - 1) ??
        null
      );
    }
  }

  if (typeof targetId === 'number' && targetId > 0) {
    return scenes.find((scene) => scene.order === targetId || scene.order === targetId - 1) ?? null;
  }

  return null;
};

const matchTargetIdAsString = (
  targetId: string | number | null | undefined,
  scenes: Vr360SceneItem[],
): Vr360SceneItem | null => {
  if (typeof targetId !== 'string' || !targetId.trim()) {
    return null;
  }

  return (
    scenes.find((scene) => scene.id === targetId) ??
    scenes.find((scene) => scene.name === targetId) ??
    null
  );
};

export const resolvePanoramaNameFromPageSettings = (
  pageSettings: PageSettings | null | undefined,
  scenes: Vr360SceneItem[],
): string | null => {
  if (!pageSettings) {
    return null;
  }

  const fromTargetOrder = matchTargetIdAsOrder(pageSettings.target_id, scenes);
  if (fromTargetOrder) {
    return fromTargetOrder.name;
  }

  const fromTargetString = matchTargetIdAsString(pageSettings.target_id, scenes);
  if (fromTargetString) {
    return fromTargetString.name;
  }

  if (pageSettings.scene_name && typeof pageSettings.scene_name === 'string') {
    const fromSceneName = scenes.find((scene) => scene.name === pageSettings.scene_name);
    if (fromSceneName) {
      return fromSceneName.name;
    }
  }

  return parseSceneNameFromPanoramaUrl(pageSettings.panorama_url);
};

export const resolveSceneByName = (
  sceneName: string | null | undefined,
  scenes: Vr360SceneItem[],
): Vr360SceneItem | null => {
  if (!sceneName) {
    return null;
  }

  return scenes.find((scene) => scene.name === sceneName) ?? null;
};
