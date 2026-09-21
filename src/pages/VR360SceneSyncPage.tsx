import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, List, Space, Tag, Typography } from 'antd';
import { loadVr360ScenesWithMeta } from '../utils/vr360SceneParser';
import { vr360SceneSyncService } from '../services/vr360SceneSyncService';
import type { Vr360SceneItem } from '../types/settings';

const { Paragraph, Text, Title } = Typography;

export default function VR360SceneSyncPage() {
  const [scenes, setScenes] = useState<Vr360SceneItem[]>([]);
  const [basePath, setBasePath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const loadScenes = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await loadVr360ScenesWithMeta();
      setScenes(result.scenes);
      setBasePath(result.basePath);
    } catch (sceneError) {
      setError(sceneError instanceof Error ? sceneError.message : 'Failed to load scene export.');
      setScenes([]);
      setBasePath(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScenes();
  }, []);

  const payloadPreview = useMemo(() => vr360SceneSyncService.buildPayload(scenes), [scenes]);

  const handleSync = async () => {
    try {
      setSyncing(true);
      setSyncMessage(null);
      setError(null);
      await vr360SceneSyncService.syncScenes(scenes);
      setSyncMessage(`Synced ${scenes.length} scenes to backend.`);
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Failed to sync scenes.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div
      style={{
        padding: 24,
        height: '100vh',
        overflowY: 'auto',
        background: '#0f172a',
        color: '#fff',
      }}
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Title level={2} style={{ color: '#fff', marginBottom: 8 }}>
            VR360 Scene Sync
          </Title>
          <Paragraph style={{ color: 'rgba(255,255,255,0.72)', marginBottom: 0 }}>
            Parse scene metadata from the local 3DVista export, preview it, then sync it to backend.
          </Paragraph>
          {basePath ? (
            <Paragraph style={{ marginBottom: 0, marginTop: 4 }}>
              <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>
                Đang đọc từ:{' '}
              </Text>
              <Tag color="geekblue" style={{ fontFamily: 'monospace' }}>
                {basePath}
              </Tag>
            </Paragraph>
          ) : null}
        </div>

        {error ? <Alert type="error" message={error} /> : null}
        {syncMessage ? <Alert type="success" message={syncMessage} /> : null}

        <Space>
          <Button onClick={() => loadScenes()} loading={loading}>
            Doc lai scene
          </Button>
          <Button type="primary" onClick={handleSync} loading={syncing} disabled={scenes.length === 0}>
            Sync scene
          </Button>
        </Space>

        <Card
          title={`Scene Export Preview (${scenes.length})`}
          loading={loading}
          styles={{ body: { maxHeight: '40vh', overflowY: 'auto' } }}
        >
          <List
            dataSource={scenes}
            locale={{ emptyText: 'No scenes parsed from local export.' }}
            renderItem={(scene) => (
              <List.Item>
                <Space direction="vertical" size={0}>
                  <Text strong>{scene.name}</Text>
                  <Text type="secondary">
                    #{scene.order} | id: {scene.id}
                  </Text>
                  <Text type="secondary">{scene.panorama_url}</Text>
                </Space>
              </List.Item>
            )}
          />
        </Card>

        <Card title="Payload Preview">
          <pre
            style={{
              margin: 0,
              maxHeight: '40vh',
              overflow: 'auto',
              background: '#020617',
              color: '#e2e8f0',
              padding: 16,
              borderRadius: 8,
            }}
          >
            {JSON.stringify(payloadPreview, null, 2)}
          </pre>
        </Card>
      </Space>
    </div>
  );
}
