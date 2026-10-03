/**
 * /vr360-scene-sync — chỉnh góc nhìn VR360 cho từng vị trí menu.
 *
 * Luồng: chọn vị trí menu (trái) → iframe mở cảnh đang gắn → (tuỳ chọn) đổi cảnh ở cột phải
 * → kéo xoay tới góc đẹp → "Lưu". Góc + cảnh được ghi vào data/vr360-views.json trên hosting
 * (khoá = đường dẫn trang), website đọc file đó nên backend sập vẫn đúng góc.
 * Khối cuối trang giữ chức năng cũ: đồng bộ danh sách cảnh lên backend.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Collapse,
  ConfigProvider,
  Empty,
  Input,
  List,
  Modal,
  Segmented,
  Space,
  Spin,
  Tag,
  Tooltip,
  Tree,
  Typography,
  message,
  theme,
} from 'antd';
import type { DataNode } from 'antd/es/tree';
import {
  DeleteOutlined,
  ExportOutlined,
  ReloadOutlined,
  RollbackOutlined,
  SaveOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useLanguage } from '../context/LanguageContext';
import { useVr360Views } from '../hooks/useVr360Views';
import { Vr360ViewStoreError, normalizeViewPath, vr360ViewStore } from '../services/vr360ViewStore';
import type { Vr360PageView } from '../types/vr360Views';
import type { Vr360SceneItem } from '../types/settings';
import { loadVr360ScenesWithMeta } from '../utils/vr360SceneParser';
import { BackendSyncPanel } from '../components/vr360SceneSync/BackendSyncPanel';
import { EditorUnlock } from '../components/vr360SceneSync/EditorUnlock';
import { editorKeyStorage } from '../components/vr360SceneSync/editorKeyStorage';
import { flattenSlots, useMenuSlots, type MenuSlot } from '../components/vr360SceneSync/useMenuSlots';
import { usePickerBridge, type PickerScene } from '../components/vr360SceneSync/usePickerBridge';
import { ShareOgPanel } from '../components/vr360SceneSync/ShareOgPanel';
import { renderPanoShot, shareCropFrame } from '../utils/panoShot';

const { Text, Title } = Typography;

const PICKER_URL = '/vr360-angle-picker.html';

const formatAngle = (value: number | null | undefined) => (typeof value === 'number' ? value.toFixed(1) : '–');

const PAGE_CSS = `
  .vr360-editor { height: 100vh; height: 100dvh; overflow: auto; background: #0b1120; color: #e2e8f0; }
  .vr360-editor__grid {
    display: grid; gap: 12px; padding: 12px;
    grid-template-columns: 300px minmax(0, 1fr) 340px;
    grid-template-rows: minmax(0, 1fr);
    height: calc(100dvh - 72px); min-height: 520px;
  }
  .vr360-editor__panel {
    display: flex; flex-direction: column; min-height: 0;
    background: #111a2e; border: 1px solid rgba(148, 163, 184, 0.15); border-radius: 10px;
  }
  .vr360-editor__panel-head { padding: 10px 12px; border-bottom: 1px solid rgba(148, 163, 184, 0.12); }
  .vr360-editor__scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 6px; }
  .vr360-editor__stage { position: relative; flex: 1; min-height: 280px; background: #000; border-radius: 10px 10px 0 0; overflow: hidden; }
  .vr360-editor__stage iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
  .vr360-editor__scene { cursor: pointer; border-radius: 6px; padding: 6px 10px !important; }
  .vr360-editor__scene:hover { background: rgba(148, 163, 184, 0.1); }
  .vr360-editor__scene--active { background: rgba(250, 204, 21, 0.14) !important; }
  .vr360-editor .ant-tree .ant-tree-node-content-wrapper { padding: 2px 6px; }
  @media (max-width: 1100px) {
    .vr360-editor__grid { grid-template-columns: 1fr; height: auto; }
    .vr360-editor__panel { max-height: 420px; }
    .vr360-editor__stage { min-height: 60vh; }
  }
`;

export default function VR360SceneSyncPage() {
  const { locale } = useLanguage();
  const [editorKey, setEditorKey] = useState<string | null>(editorKeyStorage.read);
  const [selectedPath, setSelectedPath] = useState('/');
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [sceneQuery, setSceneQuery] = useState('');
  const [saving, setSaving] = useState(false);

  // Cảnh đọc từ bản xuất 3DVista — cho khối đồng bộ backend và để tra cảnh khi backend chưa có
  const [exportScenes, setExportScenes] = useState<Vr360SceneItem[]>([]);
  const [exportBasePath, setExportBasePath] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState(true);

  const loadExportScenes = useCallback(async () => {
    setExportLoading(true);
    try {
      const result = await loadVr360ScenesWithMeta();
      setExportScenes(result.scenes);
      setExportBasePath(result.basePath);
    } catch {
      setExportScenes([]);
      setExportBasePath(null);
    } finally {
      setExportLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadExportScenes();
  }, [loadExportScenes]);

  const views = useVr360Views();
  const bridge = usePickerBridge();
  const { openScene, readPose } = bridge;
  const [rightTab, setRightTab] = useState<'scenes' | 'og'>('scenes');
  const [ogDirty, setOgDirty] = useState(false);

  // Kích thước khung xem trước — để vẽ khung 1200:630 và tính góc nhìn khi chụp ảnh chia sẻ
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = stageRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) =>
      setStageSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const { slots, loading: slotsLoading, backendScenes, ogSite } = useMenuSlots(locale, exportScenes);

  const slotMap = useMemo(() => flattenSlots(slots), [slots]);
  const selectedSlot = slotMap.get(selectedPath.toLowerCase()) ?? null;
  const savedView: Vr360PageView | null = views.views[normalizeViewPath(selectedPath)] ?? null;
  const targetSceneName = savedView?.sceneName ?? selectedSlot?.assignedSceneName ?? null;
  const currentSceneName = bridge.pose?.scene?.name ?? null;

  /** Góc chung của cảnh từ backend (nếu có) — mở cảnh mới mà chưa lưu riêng thì dùng góc này */
  const backendPoseFor = useCallback(
    (sceneName: string) => {
      const scene = backendScenes.find((item) => item.name === sceneName);
      return typeof scene?.yaw === 'number' && typeof scene?.pitch === 'number'
        ? { yaw: scene.yaw, pitch: scene.pitch }
        : null;
    },
    [backendScenes],
  );

  const openSlot = useCallback(
    async (slot: MenuSlot, view: Vr360PageView | null) => {
      const sceneName = view?.sceneName ?? slot.assignedSceneName;
      if (!sceneName) return;
      const pose = view ? { yaw: view.yaw, pitch: view.pitch } : backendPoseFor(sceneName);
      try {
        await openScene({ id: view?.sceneId ?? null, name: sceneName }, pose);
      } catch (openError) {
        message.warning(
          `${openError instanceof Error ? openError.message : 'Không mở được cảnh'}: “${sceneName}” — chọn cảnh khác ở cột phải`,
        );
      }
    },
    [backendPoseFor, openScene],
  );

  // Mở cảnh của vị trí đang chọn khi: iframe sẵn sàng / đổi vị trí / dữ liệu menu vừa về.
  // Không mở lại sau khi Lưu (cùng cảnh) để không giật khung hình.
  const lastOpenedKeyRef = useRef<string | null>(null);
  const savedViewRef = useRef(savedView);
  useEffect(() => {
    savedViewRef.current = savedView;
  }, [savedView]);
  useEffect(() => {
    if (!bridge.ready || !selectedSlot || !targetSceneName) return;
    const openKey = `${selectedSlot.path}|${targetSceneName}`;
    if (lastOpenedKeyRef.current === openKey) return;
    lastOpenedKeyRef.current = openKey;
    void openSlot(selectedSlot, savedViewRef.current);
  }, [bridge.ready, openSlot, selectedSlot, targetSceneName]);

  const isDirty =
    bridge.userMoved || Boolean(currentSceneName && targetSceneName && currentSceneName !== targetSceneName);

  const confirmDiscard = (onOk: () => void) => {
    if (!isDirty && !ogDirty) {
      onOk();
      return;
    }
    const changed = [isDirty ? 'góc nhìn / cảnh' : null, ogDirty ? 'nội dung Chia sẻ OG' : null].filter(Boolean);
    Modal.confirm({
      title: 'Bỏ thay đổi chưa lưu?',
      content: `Bạn đã sửa ${changed.join(' và ')} nhưng chưa bấm Lưu.`,
      okText: 'Bỏ thay đổi',
      cancelText: 'Ở lại',
      onOk,
    });
  };

  const handleSelectSlot = (path: string) => {
    if (path === selectedPath) return;
    confirmDiscard(() => {
      lastOpenedKeyRef.current = null;
      setSelectedPath(path);
    });
  };

  const handlePickScene = async (scene: PickerScene) => {
    if (!scene.name) return;
    const pose =
      savedView && savedView.sceneName === scene.name
        ? { yaw: savedView.yaw, pitch: savedView.pitch }
        : backendPoseFor(scene.name);
    try {
      await openScene({ id: scene.id, name: scene.name }, pose);
    } catch (openError) {
      message.error(openError instanceof Error ? openError.message : 'Không mở được cảnh');
    }
  };

  const lockEditor = useCallback(() => {
    editorKeyStorage.clear();
    setEditorKey(null);
  }, []);

  /**
   * Chụp ảnh chia sẻ: đọc camera THẬT ngay lúc bấm, dựng 1200×630 từ tile của bản xuất
   * với góc nhìn ngang = phần nằm trong khung vàng trên khung xem trước.
   */
  const captureShot = useMemo(() => {
    if (!bridge.ready || stageSize.width === 0) return null;
    return async (onProgress: (done: number, total: number) => void) => {
      const pose = await readPose();
      if (!pose.scene?.id || pose.yaw === null || pose.pitch === null) {
        throw new Error('Chỉ chụp được khi cảnh có trong bản xuất');
      }
      const { fov } = shareCropFrame(stageSize.width, stageSize.height, pose.hfov ?? 110);
      const blob = await renderPanoShot({
        tourBasePath: exportBasePath ?? '/assets/vr-data',
        pano: pose.scene.id,
        yaw: pose.yaw,
        pitch: pose.pitch,
        fov,
        onProgress,
      });
      // Trả kèm góc đã chụp: Lưu thì góc này thành góc mở trang (link mở ra đúng như ảnh)
      return {
        blob,
        pose: {
          sceneId: pose.scene.id,
          sceneName: pose.scene.name ?? pose.scene.id,
          yaw: pose.yaw,
          pitch: pose.pitch,
          hfov: pose.hfov,
        },
      };
    };
  }, [bridge.ready, exportBasePath, readPose, stageSize.height, stageSize.width]);

  const cropFrame =
    rightTab === 'og' && bridge.ready && stageSize.width > 0
      ? shareCropFrame(stageSize.width, stageSize.height, bridge.pose?.hfov ?? 110)
      : null;

  const handleWriteError = (writeError: unknown) => {
    if (writeError instanceof Vr360ViewStoreError && writeError.status === 401) {
      lockEditor();
      message.error('Mật khẩu không còn đúng — nhập lại để lưu');
      return;
    }
    message.error(writeError instanceof Error ? writeError.message : 'Lưu thất bại');
  };

  const handleSave = async () => {
    if (!editorKey || !selectedSlot) return;
    setSaving(true);
    try {
      const pose = await bridge.readPose();
      if (!pose.scene?.name || pose.yaw === null || pose.pitch === null) {
        throw new Error('Chưa đọc được góc từ khung xem trước');
      }
      // Vị trí đổi cảnh → khoá mở lại theo cảnh mới, không mở lại cảnh cũ
      lastOpenedKeyRef.current = `${selectedSlot.path}|${pose.scene.name}`;
      await vr360ViewStore.saveView(editorKey, selectedSlot.path, {
        label: selectedSlot.fullLabel,
        sceneId: pose.scene.id,
        sceneName: pose.scene.name,
        yaw: pose.yaw,
        pitch: pose.pitch,
        hfov: pose.hfov,
      });
      bridge.setUserMoved(false);
      message.success(`Đã lưu góc cho “${selectedSlot.fullLabel}”`);
    } catch (saveError) {
      handleWriteError(saveError);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!editorKey || !selectedSlot || !savedView) return;
    Modal.confirm({
      title: `Xoá cấu hình của “${selectedSlot.fullLabel}”?`,
      content: 'Vị trí này sẽ quay về cảnh backend đang gắn và góc gốc của tour.',
      okText: 'Xoá',
      okButtonProps: { danger: true },
      cancelText: 'Huỷ',
      onOk: async () => {
        try {
          await vr360ViewStore.deleteView(editorKey, selectedSlot.path);
          lastOpenedKeyRef.current = selectedSlot.assignedSceneName
            ? `${selectedSlot.path}|${selectedSlot.assignedSceneName}`
            : null;
          await openSlot(selectedSlot, null);
          message.success('Đã xoá cấu hình');
        } catch (deleteError) {
          handleWriteError(deleteError);
        }
      },
    });
  };

  const handleResetToTourDefault = () => {
    const scene = bridge.scenes.find((item) => item.name === currentSceneName);
    if (!scene?.defaultPose) return;
    bridge.previewPose(scene.defaultPose);
    bridge.setUserMoved(true);
  };

  const treeData = useMemo<DataNode[]>(() => {
    const toNode = (slot: MenuSlot): DataNode => {
      const saved = views.views[normalizeViewPath(slot.path)];
      const sceneLabel = saved?.sceneName ?? slot.assignedSceneName;
      return {
        key: slot.path,
        title: (
          <div style={{ lineHeight: 1.3, padding: '2px 0' }}>
            <Space size={6}>
              <span>{slot.label}</span>
              {saved ? (
                <Tag color="gold" style={{ marginInlineEnd: 0, fontSize: 10, lineHeight: '16px' }}>
                  đã lưu
                </Tag>
              ) : null}
            </Space>
            <div style={{ fontSize: 11, opacity: 0.55 }}>{sceneLabel ?? 'chưa gắn cảnh'}</div>
          </div>
        ),
        children: slot.children?.map(toNode),
      };
    };
    return slots.map(toNode);
  }, [slots, views.views]);

  const filteredScenes = useMemo(() => {
    const query = sceneQuery.trim().toLowerCase();
    return query ? bridge.scenes.filter((scene) => scene.name?.toLowerCase().includes(query)) : bridge.scenes;
  }, [bridge.scenes, sceneQuery]);

  const savedCount = Object.keys(views.views).length;

  return (
    <ConfigProvider theme={{ algorithm: theme.darkAlgorithm }}>
      <style>{PAGE_CSS}</style>
      <div className="vr360-editor">
        {/* Thanh trên */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            padding: '12px 16px 0',
            minHeight: 60,
          }}
        >
          <div>
            <Title level={4} style={{ margin: 0 }}>
              Góc nhìn VR360 theo menu
            </Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {savedCount} vị trí đã lưu trong <code>data/vr360-views.json</code>
              {views.updatedAt ? ` · cập nhật ${new Date(views.updatedAt).toLocaleString('vi-VN')}` : ''}
            </Text>
            <Tooltip title="Đọc lại file JSON">
              <Button type="text" size="small" icon={<ReloadOutlined />} onClick={() => vr360ViewStore.load(true)} />
            </Tooltip>
          </div>
          <EditorUnlock editorKey={editorKey} onChange={setEditorKey} />
        </div>

        <div className="vr360-editor__grid">
          {/* Cột trái: vị trí menu */}
          <section className="vr360-editor__panel">
            <div className="vr360-editor__panel-head">
              <Text strong>1. Chọn vị trí menu</Text>
            </div>
            <div className="vr360-editor__scroll">
              {slotsLoading && slots.every((slot) => !slot.children?.length) ? (
                <Spin size="small" style={{ margin: 12 }} />
              ) : null}
              <Tree
                blockNode
                treeData={treeData}
                selectedKeys={[selectedPath]}
                expandedKeys={expandedKeys}
                onExpand={(keys) => setExpandedKeys(keys)}
                onSelect={(keys) => {
                  if (keys[0]) handleSelectSlot(String(keys[0]));
                }}
              />
            </div>
          </section>

          {/* Giữa: xem trước + lưu */}
          <section className="vr360-editor__panel">
            <div className="vr360-editor__stage" ref={stageRef}>
              <iframe
                ref={bridge.frameRef}
                src={PICKER_URL}
                title="Xem trước VR360"
                allow="fullscreen; xr-spatial-tracking; gyroscope; accelerometer"
                onLoad={bridge.handleFrameLoad}
              />
              {!bridge.ready ? (
                <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                  <Spin tip="Đang tải tour…" />
                </div>
              ) : null}
              {cropFrame ? (
                // Khung 1200:630 — đúng vùng "Chụp từ góc hiện tại" sẽ dựng thành ảnh
                <div
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: cropFrame.frameWidth,
                    height: cropFrame.frameHeight,
                    transform: 'translate(-50%, -50%)',
                    border: '2px solid #facc15',
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.35)',
                    pointerEvents: 'none',
                  }}
                >
                  <span
                    style={{ position: 'absolute', top: 4, left: 8, fontSize: 11, color: '#facc15', textShadow: '0 1px 2px #000' }}
                  >
                    Vùng ảnh chia sẻ 1200×630
                  </span>
                </div>
              ) : null}
            </div>

            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {bridge.error ? <Alert type="error" showIcon message={bridge.error} /> : null}

              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Text strong>{selectedSlot?.fullLabel ?? selectedPath}</Text>
                  <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                    {selectedPath}
                  </Text>
                  <div style={{ fontSize: 12, marginTop: 2 }}>
                    <Text type="secondary">Cảnh: </Text>
                    <Text>{currentSceneName ?? '–'}</Text>
                    <Text type="secondary" style={{ marginLeft: 12, fontFamily: 'monospace' }}>
                      yaw {formatAngle(bridge.pose?.yaw)} · pitch {formatAngle(bridge.pose?.pitch)} · hfov{' '}
                      {formatAngle(bridge.pose?.hfov)}
                    </Text>
                    {isDirty ? (
                      <Tag color="orange" style={{ marginLeft: 8 }}>
                        chưa lưu
                      </Tag>
                    ) : savedView ? (
                      <Tag color="green" style={{ marginLeft: 8 }}>
                        đang xem góc đã lưu
                      </Tag>
                    ) : null}
                  </div>
                </div>

                <Space wrap>
                  <Tooltip title={editorKey ? '' : 'Nhập mật khẩu ở góc trên để lưu'}>
                    <Button
                      type="primary"
                      icon={<SaveOutlined />}
                      onClick={handleSave}
                      loading={saving}
                      disabled={!editorKey || !bridge.ready || !selectedSlot}
                    >
                      Lưu góc
                    </Button>
                  </Tooltip>
                  <Tooltip title="Xem lại góc gốc tác giả tour đặt (chưa lưu)">
                    <Button icon={<RollbackOutlined />} onClick={handleResetToTourDefault} disabled={!bridge.ready}>
                      Góc gốc
                    </Button>
                  </Tooltip>
                  <Tooltip title="Xoá cấu hình của vị trí này">
                    <Button
                      danger
                      icon={<DeleteOutlined />}
                      onClick={handleDelete}
                      disabled={!editorKey || !savedView}
                    />
                  </Tooltip>
                  <Tooltip title="Mở trang này trên website">
                    <Button icon={<ExportOutlined />} href={selectedPath} target="_blank" rel="noopener noreferrer" />
                  </Tooltip>
                </Space>
              </div>

              {selectedSlot && !targetSceneName ? (
                <Alert
                  type="info"
                  showIcon
                  message="Vị trí này chưa gắn cảnh VR360 nào — chọn một cảnh ở cột phải rồi Lưu để gắn."
                />
              ) : null}
            </div>
          </section>

          {/* Cột phải: danh sách cảnh | Chia sẻ OG */}
          <section className="vr360-editor__panel">
            <div className="vr360-editor__panel-head">
              <Segmented
                block
                value={rightTab}
                onChange={(value) => setRightTab(value as 'scenes' | 'og')}
                options={[
                  { label: `Cảnh (${bridge.scenes.length})`, value: 'scenes' },
                  { label: ogDirty ? 'Chia sẻ OG ●' : 'Chia sẻ OG', value: 'og' },
                ]}
              />
            </div>
            {rightTab === 'og' ? (
              <div className="vr360-editor__scroll" style={{ padding: 12 }}>
                {selectedSlot ? (
                  <ShareOgPanel
                    key={selectedSlot.path}
                    slot={selectedSlot}
                    site={ogSite}
                    editorKey={editorKey}
                    captureShot={captureShot}
                    onDirtyChange={setOgDirty}
                    onUnauthorized={lockEditor}
                    onPreviewPose={(pose) => {
                      openScene({ id: pose.sceneId, name: pose.sceneName }, { yaw: pose.yaw, pitch: pose.pitch }).catch(
                        (error) => message.error(error instanceof Error ? error.message : 'Không mở được góc của link'),
                      );
                    }}
                    // Xoay để chụp ảnh link không phải là đổi góc menu → bỏ trạng thái "chưa lưu góc"
                    onShareSaved={() => bridge.setUserMoved(false)}
                  />
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chọn một vị trí menu" />
                )}
              </div>
            ) : (
              <>
            <div className="vr360-editor__panel-head">
              <Input
                size="small"
                allowClear
                placeholder="Tìm cảnh"
                prefix={<SearchOutlined />}
                value={sceneQuery}
                onChange={(event) => setSceneQuery(event.target.value)}
              />
            </div>
            <div className="vr360-editor__scroll">
              {bridge.ready && filteredScenes.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} /> : null}
              <List
                size="small"
                split={false}
                dataSource={filteredScenes}
                renderItem={(scene) => {
                  const isCurrent = scene.name === currentSceneName;
                  return (
                    <List.Item
                      className={`vr360-editor__scene${isCurrent ? ' vr360-editor__scene--active' : ''}`}
                      onClick={() => handlePickScene(scene)}
                    >
                      <Text style={{ fontSize: 13 }} strong={isCurrent}>
                        {scene.name || scene.id || `#${scene.index + 1}`}
                      </Text>
                      {scene.name === targetSceneName ? (
                        <Tag style={{ marginInlineEnd: 0, fontSize: 10 }}>{savedView ? 'đã lưu' : 'đang gắn'}</Tag>
                      ) : null}
                    </List.Item>
                  );
                }}
              />
            </div>
            <div className="vr360-editor__panel-head" style={{ borderTop: '1px solid rgba(148,163,184,0.12)' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                3. Kéo trong khung để xoay, lăn chuột để zoom, rồi bấm <b>Lưu góc</b>.
              </Text>
            </div>
              </>
            )}
          </section>
        </div>

        <div style={{ padding: '0 12px 16px' }}>
          <Collapse
            items={[
              {
                key: 'backend-sync',
                label: 'Đồng bộ danh sách cảnh lên backend',
                children: (
                  <BackendSyncPanel
                    scenes={exportScenes}
                    basePath={exportBasePath}
                    loading={exportLoading}
                    onReload={loadExportScenes}
                  />
                ),
              },
            ]}
          />
        </div>
      </div>
    </ConfigProvider>
  );
}
