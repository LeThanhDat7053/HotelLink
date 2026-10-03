<?php
/**
 * ============================================
 * CHIA SẺ OG THEO TRANG — LINK NGẮN + OG — GHI FILE JSON
 * ============================================
 * Mỗi "trang chia sẻ" (= một vị trí menu: /, /phong-nghi, /phong-nghi/<code>…) có:
 *   - link ngắn  https://<domain>/<SHORTLINK_PREFIX>/<urlSlug>   (mặc định prefix "canh")
 *   - OG riêng   tiêu đề / mô tả VI-EN / ảnh (thường là ảnh chụp từ góc mở trang)
 * index.php đọc file này để chèn OG phía server và mở đúng trang khi vào bằng link ngắn.
 *
 * data/share-og.json — khoá items = đường dẫn trang (không tiền tố ngôn ngữ / sale), chữ thường:
 * {
 *   "version": 1, "updatedAt": "…",
 *   "items": {
 *     "/phong-nghi/dlx-dbl3": {
 *       "urlSlug": "deluxe-triple",
 *       "titleVi": "…", "descriptionVi": "…",   ← bắt buộc
 *       "titleEn": "",  "descriptionEn": "",    ← rỗng = dùng bản VI
 *       "image": "/share-images/…jpg",          ← http(s)://… hoặc /…, rỗng = ảnh mặc định
 *       "imagePose": { "sceneId": "panorama_…", "sceneName": "…", "yaw": 12.5, "pitch": -3 },  ← góc đã chụp ảnh
 *       "updatedAt": "…"
 *     }
 *   },
 *   "aliases": { "<urlSlug cũ>": "/phong-nghi/dlx-dbl3" }   ← đổi link → link cũ 301 sang link mới
 * }
 *
 * GET                                            → nội dung file
 * POST {"action":"save","path","metadata"}       → metadata gồm cả urlSlug, imagePose
 * POST {"action":"delete","path"}                → về OG mặc định (link ngắn cũ vẫn mở được trang)
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/_json_store.php';

header('X-Content-Type-Options: nosniff');

const SHARE_OG_FILE = JSON_STORE_DATA_DIR . '/share-og.json';
const SHARE_OG_SLUG_PATTERN = '/^[a-z0-9]+(?:-[a-z0-9]+)*$/';

function share_og_text($value, int $maxLength): string
{
    $text = is_string($value) ? trim(preg_replace('/\s+/u', ' ', $value) ?? '') : '';
    return json_store_substr($text, $maxLength);
}

function share_og_number($value, float $min, float $max): ?float
{
    if (!is_int($value) && !is_float($value) && !(is_string($value) && is_numeric($value))) return null;
    $number = round((float) $value, 2);
    return ($number >= $min && $number <= $max) ? $number : null;
}

/** "/phong-nghi/dlx-dbl3" → "phong-nghi-dlx-dbl3"; "/" → "trang-chu" */
function share_og_slug_from_path(string $path): string
{
    $slug = trim(preg_replace('/[^a-z0-9]+/', '-', strtolower($path)) ?? '', '-');
    return $slug !== '' ? substr($slug, 0, 120) : 'trang-chu';
}

/** Trả null khi thiếu tiêu đề/mô tả VI, ảnh sai định dạng hoặc slug sai dạng (→ 422 invalid_metadata) */
function share_og_sanitize($metadata): ?array
{
    if (!is_array($metadata)) return null;

    $clean = [
        'urlSlug' => strtolower(share_og_text($metadata['urlSlug'] ?? '', 120)),
        'titleVi' => share_og_text($metadata['titleVi'] ?? '', 255),
        'descriptionVi' => share_og_text($metadata['descriptionVi'] ?? '', 1000),
        'titleEn' => share_og_text($metadata['titleEn'] ?? '', 255),
        'descriptionEn' => share_og_text($metadata['descriptionEn'] ?? '', 1000),
        'image' => share_og_text($metadata['image'] ?? '', 1000),
        'imagePose' => null,
        'updatedAt' => date('c'),
    ];

    if ($clean['titleVi'] === '' || $clean['descriptionVi'] === '') return null;
    if ($clean['image'] !== '' && !preg_match('#^(https?://|/)#i', $clean['image'])) return null;
    if ($clean['urlSlug'] !== '' && !preg_match(SHARE_OG_SLUG_PATTERN, $clean['urlSlug'])) return null;

    $pose = $metadata['imagePose'] ?? null;
    if (is_array($pose) && $clean['image'] !== '') {
        $yaw = share_og_number($pose['yaw'] ?? null, -360, 360);
        $pitch = share_og_number($pose['pitch'] ?? null, -90, 90);
        $sceneName = share_og_text($pose['sceneName'] ?? '', 200);
        $sceneId = share_og_text($pose['sceneId'] ?? '', 120);
        if ($yaw !== null && $pitch !== null && $sceneName !== '') {
            $clean['imagePose'] = [
                'sceneId' => preg_match('/^[A-Za-z0-9_-]+$/', $sceneId) ? $sceneId : null,
                'sceneName' => $sceneName,
                'yaw' => $yaw,
                'pitch' => $pitch,
            ];
        }
    }
    return $clean;
}

function share_og_encode(array $store): string
{
    $store['aliases'] = (object) ($store['aliases'] ?? []);
    return json_store_encode($store, 'items');
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate');
    echo share_og_encode(json_store_read(SHARE_OG_FILE, 'items'));
    exit;
}

if ($method !== 'POST') {
    json_store_respond(405, ['ok' => false, 'error' => 'method_not_allowed']);
}

json_store_require_editor();
$input = json_store_input();
$path = json_store_normalize_path($input['path'] ?? null);
if ($path === null) {
    json_store_respond(422, ['ok' => false, 'error' => 'invalid_path', 'message' => 'Đường dẫn trang không hợp lệ']);
}

$conflict = null;

switch ($input['action'] ?? '') {
    case 'save':
        $metadata = share_og_sanitize($input['metadata'] ?? null);
        if ($metadata === null) {
            json_store_respond(422, [
                'ok' => false,
                'error' => 'invalid_metadata',
                'message' => 'Cần tiêu đề và mô tả tiếng Việt; ảnh phải là http(s)://… hoặc /…; link chỉ gồm a–z, 0–9, gạch ngang',
            ]);
        }

        $store = json_store_update(SHARE_OG_FILE, 'items', function (array $store) use ($path, $metadata, &$conflict) {
            $aliases = is_array($store['aliases'] ?? null) ? $store['aliases'] : [];
            $previousSlug = (string) ($store['items'][$path]['urlSlug'] ?? '');
            $slug = $metadata['urlSlug'] !== '' ? $metadata['urlSlug'] : ($previousSlug !== '' ? $previousSlug : share_og_slug_from_path($path));

            // Link phải duy nhất toàn site — kể cả link cũ (alias) của trang khác: link đó có thể đã được chia sẻ
            foreach ($store['items'] as $otherPath => $item) {
                if ($otherPath !== $path && ($item['urlSlug'] ?? '') === $slug) {
                    $conflict = "Link “{$slug}” đang dùng cho trang {$otherPath}";
                    return $store;
                }
            }
            if (isset($aliases[$slug]) && $aliases[$slug] !== $path) {
                $conflict = "Link “{$slug}” là link cũ của trang {$aliases[$slug]} (có thể đã được chia sẻ)";
                return $store;
            }

            if ($previousSlug !== '' && $previousSlug !== $slug) {
                $aliases[$previousSlug] = $path; // link cũ → 301 sang link mới
            }
            unset($aliases[$slug]);

            $metadata['urlSlug'] = $slug;
            $store['items'][$path] = $metadata;
            $store['aliases'] = $aliases;
            return $store;
        });

        if ($conflict !== null) {
            json_store_respond(422, ['ok' => false, 'error' => 'slug_taken', 'message' => $conflict]);
        }
        json_store_respond(200, ['ok' => true, 'data' => json_decode(share_og_encode($store), true)]);

    case 'delete':
        $store = json_store_update(SHARE_OG_FILE, 'items', function (array $store) use ($path) {
            $aliases = is_array($store['aliases'] ?? null) ? $store['aliases'] : [];
            $slug = (string) ($store['items'][$path]['urlSlug'] ?? '');
            if ($slug !== '') {
                $aliases[$slug] = $path; // link đã chia sẻ vẫn mở được trang (OG mặc định)
            }
            unset($store['items'][$path]);
            $store['aliases'] = $aliases;
            return $store;
        });
        json_store_respond(200, ['ok' => true, 'data' => json_decode(share_og_encode($store), true)]);

    default:
        json_store_respond(400, ['ok' => false, 'error' => 'unknown_action']);
}
