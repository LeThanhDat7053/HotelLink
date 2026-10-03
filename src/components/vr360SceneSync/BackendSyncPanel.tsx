import { useMemo, useState } from 'react';
import { Alert, Button, List, Space, Tag, Typography } from 'antd';
import { vr360SceneSyncService } from '../../services/vr360SceneSyncService';
import type { Vr360SceneItem } from '../../types/settings';

const { Text } = Typography;

interface BackendSyncPanelProps {
  scenes: Vr360SceneItem[];
  basePath: string | null;
  loading: boolean;
  onReload: () => void;
}

/** Chức năng cũ của trang: gửi danh sách cảnh (id, tên) đọc từ bản xuất 3DVista lên backend. */
export const BackendSyncPanel = ({ scenes, basePath, loading, onReload }: BackendSyncPanelProps) => {
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const payloadPreview = useMemo(() => vr360SceneSyncService.buildPayload(scenes), [scenes]);

  const handleSync = async () => {
    try {
      setSyncing(true);
      setSyncMessage(null);
      setError(null);
      await vr360SceneSyncService.syncScenes(scenes);
      setSyncMessage(`Đã đồng bộ ${scenes.length} cảnh lên backend.`);
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Đồng bộ thất bại.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {basePath ? (
        <Text type="secondary" style={{ fontSize: 12 }}>
          Đang đọc từ <Tag style={{ fontFamily: 'monospace' }}>{basePath}</Tag>
        </Text>
      ) : null}
      {error ? <Alert type="error" message={error} showIcon /> : null}
      {syncMessage ? <Alert type="success" message={syncMessage} showIcon /> : null}

      <Space>
        <Button onClick={onReload} loading={loading}>
          Đọc lại cảnh từ bản xuất
        </Button>
        <Button type="primary" onClick={handleSync} loading={syncing} disabled={scenes.length === 0}>
          Đồng bộ {scenes.length} cảnh lên backend
        </Button>
      </Space>

      <List
        size="small"
        bordered
        dataSource={scenes}
        style={{ maxHeight: 240, overflowY: 'auto' }}
        locale={{ emptyText: 'Không đọc được cảnh nào từ bản xuất.' }}
        renderItem={(scene) => (
          <List.Item>
            <Text>{scene.name}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              #{scene.order} · {scene.id}
            </Text>
          </List.Item>
        )}
      />

      <pre
        style={{
          margin: 0,
          maxHeight: 240,
          overflow: 'auto',
          fontSize: 12,
          padding: 12,
          borderRadius: 8,
          background: 'rgba(0, 0, 0, 0.35)',
        }}
      >
        {JSON.stringify(payloadPreview, null, 2)}
      </pre>
    </Space>
  );
};
