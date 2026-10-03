import { useState } from 'react';
import { Alert, Button, Input, Space, Tag } from 'antd';
import { LockOutlined, UnlockOutlined } from '@ant-design/icons';
import { Vr360ViewStoreError, vr360ViewStore } from '../../services/vr360ViewStore';
import { editorKeyStorage } from './editorKeyStorage';

interface EditorUnlockProps {
  editorKey: string | null;
  onChange: (key: string | null) => void;
}

/** Mật khẩu VR360_EDITOR_PASSWORD (config.php) — cần để GHI file JSON, xem trước thì không cần. */
export const EditorUnlock = ({ editorKey, onChange }: EditorUnlockProps) => {
  const [value, setValue] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (editorKey) {
    return (
      <Space>
        <Tag color="green" icon={<UnlockOutlined />}>
          Đã mở khoá lưu
        </Tag>
        <Button
          size="small"
          onClick={() => {
            editorKeyStorage.clear();
            onChange(null);
          }}
        >
          Khoá lại
        </Button>
      </Space>
    );
  }

  const handleUnlock = async () => {
    if (!value) return;
    setChecking(true);
    setError(null);
    try {
      await vr360ViewStore.verifyKey(value);
      editorKeyStorage.write(value);
      onChange(value);
      setValue('');
    } catch (unlockError) {
      const code = unlockError instanceof Vr360ViewStoreError ? unlockError.code : '';
      setError(
        code === 'editor_disabled'
          ? 'Chưa bật chức năng lưu: đặt VR360_EDITOR_PASSWORD trong config.php trên hosting.'
          : unlockError instanceof Error
            ? unlockError.message
            : 'Không kiểm tra được mật khẩu',
      );
    } finally {
      setChecking(false);
    }
  };

  return (
    <Space direction="vertical" size={4} style={{ alignItems: 'flex-end' }}>
      <Space.Compact>
        <Input.Password
          size="middle"
          placeholder="Mật khẩu để lưu"
          prefix={<LockOutlined />}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onPressEnter={handleUnlock}
          style={{ width: 200 }}
        />
        <Button type="primary" onClick={handleUnlock} loading={checking}>
          Mở khoá
        </Button>
      </Space.Compact>
      {error ? <Alert type="error" message={error} showIcon style={{ padding: '2px 8px' }} /> : null}
    </Space>
  );
};
