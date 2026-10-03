<?php
/**
 * ============================================
 * UPLOAD ẢNH CHIA SẺ (OG IMAGE)
 * ============================================
 * POST multipart: file (jpg/png ≤ 3MB), slug
 * → lưu share-images/<slug>-<YYYYMMDD-HHMMSS>-<6 hex>.<ext> (ghi .tmp rồi rename)
 * → { ok, image: "/share-images/<tên>", width, height }
 *
 * Tên file LUÔN mới mỗi lần upload → Facebook/Zalo không dính ảnh cache cũ.
 * Upload chỉ trả URL; ảnh chưa gắn vào OG cho tới khi admin bấm Lưu (share-og.php).
 * Kích thước khuyến nghị 1200×630.
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/_json_store.php';

header('X-Content-Type-Options: nosniff');

const SHARE_IMAGE_DIR = __DIR__ . '/share-images';
const SHARE_IMAGE_MAX_BYTES = 3 * 1024 * 1024;

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    json_store_respond(405, ['ok' => false, 'error' => 'method_not_allowed']);
}

json_store_require_editor();

$file = $_FILES['file'] ?? null;
if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'])) {
    json_store_respond(422, ['ok' => false, 'error' => 'invalid_file', 'message' => 'Không nhận được file ảnh']);
}
if ($file['size'] > SHARE_IMAGE_MAX_BYTES) {
    json_store_respond(422, ['ok' => false, 'error' => 'invalid_file', 'message' => 'Ảnh vượt quá 3MB']);
}

// Xác nhận là ảnh thật bằng header file, không tin đuôi/MIME trình duyệt gửi lên
$info = @getimagesize($file['tmp_name']);
$extensions = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png'];
if (!$info || !isset($extensions[$info[2]])) {
    json_store_respond(422, ['ok' => false, 'error' => 'invalid_file', 'message' => 'Chỉ nhận ảnh JPG hoặc PNG']);
}
if (empty($info[0]) || empty($info[1])) {
    json_store_respond(422, ['ok' => false, 'error' => 'invalid_image', 'message' => 'Không đọc được kích thước ảnh']);
}

// slug chỉ để đặt tên file dễ nhận biết: "/phong-nghi/dlx-dbl3" → "phong-nghi-dlx-dbl3"
$slug = strtolower((string) ($_POST['slug'] ?? ''));
$slug = trim(preg_replace('/[^a-z0-9]+/', '-', $slug) ?? '', '-');
$slug = substr($slug !== '' ? $slug : 'home', 0, 80);

if (!is_dir(SHARE_IMAGE_DIR) && !@mkdir(SHARE_IMAGE_DIR, 0755, true)) {
    json_store_respond(500, ['ok' => false, 'error' => 'not_writable', 'message' => 'Không tạo được thư mục share-images/']);
}

$name = sprintf('%s-%s-%s.%s', $slug, date('Ymd-His'), bin2hex(random_bytes(3)), $extensions[$info[2]]);
$target = SHARE_IMAGE_DIR . '/' . $name;
$tmpTarget = $target . '.tmp';

if (!move_uploaded_file($file['tmp_name'], $tmpTarget) || !rename($tmpTarget, $target)) {
    @unlink($tmpTarget);
    json_store_respond(500, ['ok' => false, 'error' => 'write_failed', 'message' => 'Không lưu được ảnh lên hosting']);
}
@chmod($target, 0644);

json_store_respond(200, [
    'ok' => true,
    'image' => '/share-images/' . $name,
    'width' => (int) $info[0],
    'height' => (int) $info[1],
]);
