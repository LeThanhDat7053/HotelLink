import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Nói chuyện với iframe /vr360-angle-picker.html bằng postMessage — cùng giao thức mà dashboard
 * backend dùng (docs/VR360_SCENE_ANGLE_BACKEND_SPEC.md §5). Trang picker cùng origin nên
 * chấp nhận lệnh từ trang này.
 */
const NS = 'hotellink.vr360';

export interface PickerScene {
  index: number;
  id: string | null;
  name: string | null;
  defaultPose: { yaw: number; pitch: number } | null;
}

export interface PickerPose {
  scene: { id: string | null; name: string | null } | null;
  yaw: number | null;
  pitch: number | null;
  hfov: number | null;
}

interface PickerMessage extends Partial<PickerPose> {
  ns: string;
  type: 'ready' | 'pose' | 'opened' | 'error';
  requestId?: string;
  scenes?: PickerScene[];
  userInitiated?: boolean;
  ok?: boolean;
  message?: string;
}

export const usePickerBridge = () => {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const pendingRef = useRef(new Map<string, (message: PickerMessage) => void>());
  const [ready, setReady] = useState(false);
  const [scenes, setScenes] = useState<PickerScene[]>([]);
  const [pose, setPose] = useState<PickerPose | null>(null);
  /** true khi admin tự kéo/zoom kể từ lần mở cảnh / lưu gần nhất */
  const [userMoved, setUserMoved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback((message: Record<string, unknown>) => {
    frameRef.current?.contentWindow?.postMessage({ ns: NS, ...message }, window.location.origin);
  }, []);

  const request = useCallback(
    (message: Record<string, unknown>, timeoutMs = 20000) =>
      new Promise<PickerMessage>((resolve, reject) => {
        const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const timer = window.setTimeout(() => {
          pendingRef.current.delete(requestId);
          reject(new Error('Khung xem trước không phản hồi'));
        }, timeoutMs);
        pendingRef.current.set(requestId, (reply) => {
          window.clearTimeout(timer);
          resolve(reply);
        });
        send({ ...message, requestId });
      }),
    [send],
  );

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) return;
      const data = event.data as PickerMessage | null;
      if (!data || data.ns !== NS) return;

      if (data.requestId && pendingRef.current.has(data.requestId)) {
        pendingRef.current.get(data.requestId)?.(data);
        pendingRef.current.delete(data.requestId);
      }

      switch (data.type) {
        case 'ready':
          setReady(true);
          setError(null);
          setScenes(data.scenes ?? []);
          break;
        case 'pose':
          setPose({ scene: data.scene ?? null, yaw: data.yaw ?? null, pitch: data.pitch ?? null, hfov: data.hfov ?? null });
          if (data.userInitiated) setUserMoved(true);
          break;
        case 'error':
          if (!data.requestId) setError(data.message ?? 'Lỗi khung xem trước');
          break;
        default:
          break;
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  /** Mở cảnh; pose = null → góc gốc của tour */
  const openScene = useCallback(
    async (scene: { id?: string | null; name?: string | null }, targetPose: { yaw: number; pitch: number } | null) => {
      const reply = await request({ type: 'open', scene, pose: targetPose });
      setUserMoved(false);
      if (!reply.ok) throw new Error(reply.message || 'Không mở được cảnh');
    },
    [request],
  );

  /** Đọc thẳng camera ngay lúc gọi — "thấy sao lưu vậy" */
  const readPose = useCallback(async (): Promise<PickerPose> => {
    const reply = await request({ type: 'get-pose' }, 5000);
    const current = { scene: reply.scene ?? null, yaw: reply.yaw ?? null, pitch: reply.pitch ?? null, hfov: reply.hfov ?? null };
    setPose(current);
    return current;
  }, [request]);

  const previewPose = useCallback(
    (targetPose: { yaw: number; pitch: number }) => {
      send({ type: 'set-pose', pose: targetPose });
    },
    [send],
  );

  const handleFrameLoad = useCallback(() => {
    // Phòng khi trang cha gắn listener sau lúc picker gửi "ready"
    send({ type: 'hello' });
  }, [send]);

  return {
    frameRef,
    ready,
    scenes,
    pose,
    userMoved,
    setUserMoved,
    error,
    openScene,
    readPose,
    previewPose,
    handleFrameLoad,
  };
};
