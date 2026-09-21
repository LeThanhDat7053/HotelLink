import api from '../api';
import { appConfig } from '../config';
import type { Vr360SceneItem } from '../types/settings';

interface Vr360SceneSyncPayload {
  tenant_code: string;
  property_id?: number;
  scenes: Array<{
    id: string;
    name: string;
    subtitle?: string;
    panorama_url: string;
    order: number;
  }>;
}

const getAbsolutePanoramaUrl = (panoramaUrl: string): string => {
  const baseDomain = appConfig.PANORAMA_URL_DOMAIN || window.location.origin;
  return new URL(panoramaUrl, baseDomain).toString();
};

export const vr360SceneSyncService = {
  buildPayload(scenes: Vr360SceneItem[]): Vr360SceneSyncPayload {
    const propertyId = Number(appConfig.PROPERTY_ID);

    return {
      tenant_code: appConfig.TENANT_CODE,
      property_id: Number.isFinite(propertyId) && propertyId > 0 ? propertyId : undefined,
      scenes: scenes.map((scene) => ({
        id: scene.id,
        name: scene.name,
        subtitle: scene.subtitle,
        panorama_url: getAbsolutePanoramaUrl(scene.panorama_url),
        order: scene.order,
      })),
    };
  },

  async syncScenes(scenes: Vr360SceneItem[]): Promise<unknown> {
    const endpoint = appConfig.VR360_SCENE_SYNC_ENDPOINT;
    if (!endpoint) {
      throw new Error('VITE_VR360_SCENE_SYNC_ENDPOINT is not configured.');
    }

    const payload = this.buildPayload(scenes);
    const { data } = await api.post(endpoint, payload, {
      headers: appConfig.PROPERTY_ID
        ? { 'x-property-id': String(appConfig.PROPERTY_ID) }
        : undefined,
    });
    return data;
  },
};
