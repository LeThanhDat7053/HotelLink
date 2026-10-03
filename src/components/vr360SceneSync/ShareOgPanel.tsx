/**
 * Khối "Chia sẻ OG" của 1 vị trí menu trên trang /vr360-scene-sync:
 * - link chia sẻ ngắn https://<domain>/canh/<slug> (tự theo domain đang chạy)
 * - preview card như bài đăng mạng xã hội + sửa tiêu đề / mô tả (VI-EN) / ảnh
 * - chụp ảnh từ góc đang xem: góc chụp = GÓC CỦA LINK. Mở link → hiện đúng góc trong ảnh;
 *   vào trang từ menu website vẫn là góc của menu (data/vr360-views.json) — hai góc độc lập.
 *   Đổi góc link (chụp lại + Lưu) → link cũ (cùng slug) mở ra góc mới.
 * Lưu vào data/share-og.json; crawler đọc qua index.php (server/_og.php).
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Alert, Button, Input, Modal, Segmented, Space, Tag, Tooltip, Typography, Upload, message } from 'antd';
import {
  CameraOutlined,
  CopyOutlined,
  DeleteOutlined,
  ExportOutlined,
  SaveOutlined,
  ThunderboltOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import {
  EditorApiError,
  SHARE_SLUG_PATTERN,
  shareOgStore,
  shortLinkPath,
  slugifyShareLink,
  type ShareImagePose,
  type ShareOgCustom,
} from '../../services/shareOgStore';
import { normalizeViewPath } from '../../services/vr360ViewStore';
import {
  applyShareOgCustom,
  resolveShareOgDefaults,
  type ShareOgLang,
  type ShareOgSite,
} from '../../utils/shareOgDefaults';
import type { MenuSlot } from './useMenuSlots';

const { Text } = Typography;

type FormState = Omit<ShareOgCustom, 'updatedAt' | 'imagePose'>;
const EMPTY_FORM: FormState = { urlSlug: '', titleVi: '', descriptionVi: '', titleEn: '', descriptionEn: '', image: '' };
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;

/** Kết quả chụp: ảnh + góc đã chụp (để lưu thành góc mở trang) */
export interface CapturedShot {
  blob: Blob;
  pose: ShareImagePose & { hfov: number | null };
}

const toForm = (custom: ShareOgCustom | null | undefined): FormState =>
  custom
    ? {
        urlSlug: custom.urlSlug,
        titleVi: custom.titleVi,
        descriptionVi: custom.descriptionVi,
        titleEn: custom.titleEn,
        descriptionEn: custom.descriptionEn,
        image: custom.image,
      }
    : EMPTY_FORM;

const sameForm = (a: FormState, b: FormState) =>
  (Object.keys(EMPTY_FORM) as Array<keyof FormState>).every((key) => a[key].trim() === b[key].trim());

interface ShareOgPanelProps {
  slot: MenuSlot;
  site: ShareOgSite;
  editorKey: string | null;
  /** Dựng ảnh 1200×630 từ góc đang xem trong khung preview (null = không chụp được lúc này) */
  captureShot: ((onProgress: (done: number, total: number) => void) => Promise<CapturedShot>) | null;
  onDirtyChange: (dirty: boolean) => void;
  onUnauthorized: () => void;
  /** Mở góc của link trong khung xem trước */
  onPreviewPose: (pose: ShareImagePose) => void;
  /** Đã lưu chia sẻ — trang bỏ trạng thái "chưa lưu góc" do xoay để chụp (góc menu không đổi) */
  onShareSaved: () => void;
}

export const ShareOgPanel = ({
  slot,
  site,
  editorKey,
  captureShot,
  onDirtyChange,
  onUnauthorized,
  onPreviewPose,
  onShareSaved,
}: ShareOgPanelProps) => {
  const store = useSyncExternalStore(shareOgStore.subscribe, shareOgStore.getSnapshot);
  const pathKey = normalizeViewPath(slot.path);
  const saved = store.items[pathKey] ?? null;

  const [lang, setLang] = useState<ShareOgLang>('vi');
  const [form, setForm] = useState<FormState>(() => toForm(saved));
  const [busy, setBusy] = useState<string | null>(null);
  // Ảnh vừa chụp + góc chụp — Lưu thì góc này thành góc mở trang (link mở ra đúng như ảnh)
  const [captured, setCaptured] = useState<(CapturedShot['pose'] & { image: string }) | null>(null);

  useEffect(() => {
    void shareOgStore.load();
  }, []);

  const dirty = !sameForm(form, toForm(saved));
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  const defaults = useMemo(
    () => resolveShareOgDefaults(pathKey, lang, site, slot.ogEntity ?? null),
    [lang, pathKey, site, slot.ogEntity],
  );
  const defaultsVi = useMemo(
    () => resolveShareOgDefaults(pathKey, 'vi', site, slot.ogEntity ?? null),
    [pathKey, site, slot.ogEntity],
  );
  // Đang gõ thì preview theo form; chưa có tuỳ chỉnh nào thì là mặc định
  const hasAnyValue = !sameForm(form, EMPTY_FORM);
  const effective = applyShareOgCustom(defaults, hasAnyValue ? form : null, lang);
  // Placeholder ô EN = giá trị sẽ hiện khi để trống (bản VI của admin nếu có, không thì mặc định EN)
  const enFallback = applyShareOgCustom(defaults, hasAnyValue ? { ...form, titleEn: '', descriptionEn: '' } : null, 'en');

  const titleField = lang === 'vi' ? 'titleVi' : 'titleEn';
  const descriptionField = lang === 'vi' ? 'descriptionVi' : 'descriptionEn';
  const setField = (field: keyof FormState, value: string) => setForm((previous) => ({ ...previous, [field]: value }));

  // ----- Link chia sẻ ngắn — tự theo domain đang chạy (dev, staging, domain thật…) -----
  const autoSlug = useMemo(() => {
    const taken = new Set(
      [
        ...Object.entries(store.items).filter(([path]) => path !== pathKey).map(([, item]) => item.urlSlug),
        ...Object.entries(store.aliases).filter(([, path]) => path !== pathKey).map(([slug]) => slug),
      ].filter(Boolean),
    );
    const base = slugifyShareLink(slot.label) || slugifyShareLink(pathKey) || 'trang-chu';
    let candidate = base;
    for (let index = 2; taken.has(candidate); index += 1) candidate = `${base}-${index}`;
    return candidate;
  }, [pathKey, slot.label, store.aliases, store.items]);

  const slug = form.urlSlug.trim() || autoSlug;
  const slugError = !SHARE_SLUG_PATTERN.test(slug)
    ? 'Chỉ dùng a–z, 0–9 và gạch ngang'
    : Object.entries(store.items).some(([path, item]) => path !== pathKey && item.urlSlug === slug)
      ? 'Trùng link của trang khác'
      : store.aliases[slug] && store.aliases[slug] !== pathKey
        ? 'Là link cũ của trang khác (có thể đã được chia sẻ)'
        : null;
  const shareUrl = `${window.location.origin}${shortLinkPath(slug)}`;
  const shareUrlSaved = Boolean(saved?.urlSlug) && saved?.urlSlug === slug;
  const pageUrl = shareUrlSaved ? shareUrl : `${window.location.origin}${slot.path}`;

  const copyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      message.success('Đã sao chép link');
    } catch {
      window.prompt('Link chia sẻ', shareUrl);
    }
  };

  const handleWriteError = (error: unknown) => {
    if (error instanceof EditorApiError && error.status === 401) {
      onUnauthorized();
      message.error('Mật khẩu không còn đúng — nhập lại để lưu');
      return;
    }
    message.error(error instanceof Error ? error.message : 'Thao tác thất bại');
  };

  const uploadBlob = async (blob: Blob, fileName: string) => {
    if (!editorKey) return;
    setBusy('Đang tải lên…');
    const uploaded = await shareOgStore.uploadImage(editorKey, slot.path, blob, fileName);
    setField('image', uploaded.image);
    return uploaded;
  };

  const handleCapture = async () => {
    if (!captureShot || !editorKey) return;
    setBusy('Đang tải tile…');
    try {
      const { blob, pose } = await captureShot((done, total) => setBusy(`Tile ${done}/${total}`));
      const fileName = `${pathKey === '/' ? 'home' : pathKey.slice(1).replace(/\//g, '-')}.jpg`;
      const uploaded = await uploadBlob(blob, fileName);
      if (uploaded) setCaptured({ ...pose, image: uploaded.image });
      message.success('Đã chụp — bấm Lưu để link chia sẻ mở ở góc này (góc của menu giữ nguyên)');
    } catch (error) {
      handleWriteError(error);
    } finally {
      setBusy(null);
    }
  };

  const handleUploadFile = async (file: File) => {
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      message.error('Chỉ nhận ảnh JPG hoặc PNG');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      message.error('Ảnh vượt quá 3MB');
      return;
    }
    try {
      const uploaded = await uploadBlob(file, file.name);
      if (uploaded && (uploaded.width < 600 || Math.abs(uploaded.width / uploaded.height - 1200 / 630) > 0.15)) {
        message.warning(`Ảnh ${uploaded.width}×${uploaded.height} — nên dùng 1200×630 để không bị cắt`);
      } else {
        message.success('Đã tải ảnh lên — bấm Lưu để áp dụng');
      }
    } catch (error) {
      handleWriteError(error);
    } finally {
      setBusy(null);
    }
  };

  const handleSave = async () => {
    if (!editorKey) return;
    // Tiêu đề / mô tả VI là bắt buộc: ô trống lưu theo giá trị mặc định đang hiển thị
    const metadata: FormState = {
      ...form,
      urlSlug: slug,
      titleVi: form.titleVi.trim() || defaultsVi.title,
      descriptionVi: form.descriptionVi.trim() || defaultsVi.description,
    };
    if (!metadata.titleVi || !metadata.descriptionVi) {
      message.error('Cần tiêu đề và mô tả tiếng Việt');
      return;
    }
    if (slugError) {
      message.error(`Link chia sẻ: ${slugError}`);
      return;
    }
    // Góc của ảnh: ảnh vừa chụp → góc vừa chụp; ảnh cũ giữ nguyên → góc cũ; ảnh khác → không rõ
    const usingCaptured = captured && captured.image === metadata.image ? captured : null;
    const imagePose: ShareImagePose | null = usingCaptured
      ? { sceneId: usingCaptured.sceneId, sceneName: usingCaptured.sceneName, yaw: usingCaptured.yaw, pitch: usingCaptured.pitch }
      : saved && saved.image === metadata.image
        ? saved.imagePose
        : null;

    setBusy('Đang lưu…');
    try {
      // Chỉ lưu vào data/share-og.json — góc của menu (data/vr360-views.json) KHÔNG đổi
      await shareOgStore.save(editorKey, slot.path, { ...metadata, imagePose });
      setForm(metadata);
      setCaptured(null);
      onShareSaved();
      message.success(
        usingCaptured
          ? `Đã lưu — link chia sẻ của “${slot.fullLabel}” giờ mở ở góc vừa chụp`
          : `Đã lưu chia sẻ cho “${slot.fullLabel}”`,
      );
    } catch (error) {
      handleWriteError(error);
    } finally {
      setBusy(null);
    }
  };

  const handleReset = () => {
    if (!editorKey || !saved) return;
    Modal.confirm({
      title: 'Về OG mặc định?',
      content: `Xoá tuỳ chỉnh của “${slot.fullLabel}”. Ảnh đã tải lên vẫn còn trên hosting.`,
      okText: 'Về mặc định',
      okButtonProps: { danger: true },
      cancelText: 'Huỷ',
      onOk: async () => {
        try {
          await shareOgStore.remove(editorKey, slot.path);
          setForm(EMPTY_FORM);
          message.success('Đã về OG mặc định');
        } catch (error) {
          handleWriteError(error);
        }
      },
    });
  };

  const imageSrc = effective.image;

  return (
    <Space direction="vertical" size={10} style={{ width: '100%' }}>
      <div style={{ fontSize: 12, lineHeight: 1.5 }}>
        <Text type="secondary">Riêng cho trang </Text>
        <Text code style={{ fontSize: 11 }}>
          {pathKey}
        </Text>
        {saved ? (
          <Tag color="gold" style={{ marginLeft: 6 }}>
            đã tuỳ chỉnh
          </Tag>
        ) : null}
        {dirty ? <Tag color="orange">chưa lưu</Tag> : null}
        <div>
          <Text type="secondary">Mặc định lấy từ: {defaults.sourceLabel}</Text>
        </div>
      </div>

      <div>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Link chia sẻ (tự theo domain)
        </Text>
        <Space.Compact block>
          <Input
            size="small"
            addonBefore={`/${shortLinkPath('').split('/')[1]}/`}
            value={form.urlSlug}
            placeholder={autoSlug}
            status={slugError ? 'error' : undefined}
            onChange={(event) => setField('urlSlug', event.target.value.toLowerCase().replace(/\s+/g, '-'))}
          />
          <Tooltip title="Tự sinh từ tên trang">
            <Button size="small" icon={<ThunderboltOutlined />} onClick={() => setField('urlSlug', autoSlug)} />
          </Tooltip>
          <Tooltip title="Sao chép link">
            <Button size="small" icon={<CopyOutlined />} onClick={copyShareUrl} disabled={!!slugError} />
          </Tooltip>
        </Space.Compact>
        <div style={{ fontSize: 11, marginTop: 2, wordBreak: 'break-all' }}>
          {slugError ? (
            <Text type="danger">{slugError}</Text>
          ) : shareUrlSaved ? (
            <a href={shareUrl} target="_blank" rel="noopener noreferrer">
              {shareUrl}
            </a>
          ) : (
            <Text type="secondary">{shareUrl} — có hiệu lực sau khi Lưu</Text>
          )}
        </div>
      </div>

      {/* Góc của link — độc lập với góc menu */}
      <div style={{ fontSize: 12, lineHeight: 1.5 }}>
        {captured && captured.image === form.image ? (
          <Text type="warning">
            Góc mới của link (chưa lưu): {captured.sceneName} · yaw {captured.yaw.toFixed(1)} · pitch {captured.pitch.toFixed(1)}
          </Text>
        ) : saved?.imagePose && saved.image === form.image ? (
          <Space size={6} wrap>
            <Text type="secondary">
              Link mở ở góc của ảnh: {saved.imagePose.sceneName} · yaw {saved.imagePose.yaw.toFixed(1)} · pitch{' '}
              {saved.imagePose.pitch.toFixed(1)}
            </Text>
            <Button size="small" type="link" style={{ padding: 0, height: 'auto' }} onClick={() => saved.imagePose && onPreviewPose(saved.imagePose)}>
              Xem góc của link
            </Button>
          </Space>
        ) : (
          <Text type="secondary">Link mở ở góc của trang (như vào từ menu). Chụp ảnh để link có góc riêng.</Text>
        )}
      </div>

      <Segmented
        block
        size="small"
        value={lang}
        onChange={(value) => setLang(value as ShareOgLang)}
        options={[
          { label: 'Tiếng Việt', value: 'vi' },
          { label: 'English', value: 'en' },
        ]}
      />

      {/* Preview card — mô phỏng bài đăng Facebook/Zalo */}
      <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(148,163,184,0.25)', background: '#1c2433' }}>
        <div style={{ position: 'relative', aspectRatio: '1200 / 630', background: '#0b1120' }}>
          {imageSrc ? (
            <img
              src={imageSrc}
              alt=""
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 12, opacity: 0.6 }}>
              Chưa có ảnh — chụp hoặc dán URL
            </div>
          )}
        </div>
        <div style={{ padding: '8px 10px' }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', opacity: 0.55 }}>{window.location.host}</div>
          <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {effective.title || '—'}
          </div>
          <div style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {effective.description}
          </div>
        </div>
      </div>

      <div>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Tiêu đề {lang === 'en' ? '(trống = dùng bản tiếng Việt)' : ''}
        </Text>
        <Input
          size="small"
          maxLength={255}
          value={form[titleField]}
          placeholder={lang === 'vi' ? defaults.title : enFallback.title}
          onChange={(event) => setField(titleField, event.target.value)}
        />
      </div>
      <div>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Mô tả
        </Text>
        <Input.TextArea
          size="small"
          maxLength={1000}
          autoSize={{ minRows: 2, maxRows: 5 }}
          value={form[descriptionField]}
          placeholder={lang === 'vi' ? defaults.description : enFallback.description}
          onChange={(event) => setField(descriptionField, event.target.value)}
        />
      </div>
      <div>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Ảnh (URL http(s)://… hoặc /…, 1200×630)
        </Text>
        <Input
          size="small"
          allowClear
          value={form.image}
          placeholder={defaults.image || 'Chưa có ảnh mặc định'}
          onChange={(event) => setField('image', event.target.value)}
        />
      </div>

      <Space wrap size={6}>
        <Tooltip title={captureShot ? 'Dựng ảnh 1200×630 đúng khung vàng trên khung xem trước' : 'Chỉ chụp được khi cảnh có trong bản xuất và khung xem trước đã sẵn sàng'}>
          <Button size="small" icon={<CameraOutlined />} onClick={handleCapture} disabled={!editorKey || !captureShot || !!busy}>
            Chụp từ góc hiện tại
          </Button>
        </Tooltip>
        <Upload
          accept="image/jpeg,image/png"
          showUploadList={false}
          beforeUpload={(file) => {
            void handleUploadFile(file);
            return false;
          }}
          disabled={!editorKey || !!busy}
        >
          <Button size="small" icon={<UploadOutlined />} disabled={!editorKey || !!busy}>
            Tải ảnh lên
          </Button>
        </Upload>
      </Space>

      {busy ? <Alert type="info" showIcon message={busy} style={{ padding: '2px 8px' }} /> : null}

      <Space wrap size={6}>
        <Tooltip title={editorKey ? '' : 'Nhập mật khẩu ở góc trên để lưu'}>
          <Button type="primary" size="small" icon={<SaveOutlined />} onClick={handleSave} disabled={!editorKey || !!busy || (!dirty && !!saved)}>
            Lưu OG
          </Button>
        </Tooltip>
        <Tooltip title="Xoá tuỳ chỉnh, quay về OG mặc định">
          <Button size="small" danger icon={<DeleteOutlined />} onClick={handleReset} disabled={!editorKey || !saved || !!busy} />
        </Tooltip>
        <Tooltip title="Kiểm tra trên Facebook Sharing Debugger (sau khi đã deploy)">
          <Button
            size="small"
            icon={<ExportOutlined />}
            href={`https://developers.facebook.com/tools/debug/?q=${encodeURIComponent(pageUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Facebook
          </Button>
        </Tooltip>
      </Space>
    </Space>
  );
};
