<?php
/**
 * ============================================
 * GÓC NHÌN VR360 THEO VỊ TRÍ MENU — GHI FILE JSON
 * ============================================
 * Dữ liệu nằm ở data/vr360-views.json NGAY TRÊN HOSTING KHÁCH SẠN:
 * - Website ĐỌC thẳng file tĩnh /data/vr360-views.json → backend sập vẫn có góc.
 * - Chỉ trang /vr360-scene-sync GHI qua endpoint này, cần mật khẩu
 *   VR360_EDITOR_PASSWORD trong config.php (gửi qua header X-VR360-Editor-Key).
 *
 * Cấu trúc file:
 * {
 *   "version": 1,
 *   "updatedAt": "2026-09-29T10:00:00+07:00",
 *   "views": {
 *     "/phong-nghi/deluxe-triple": {            ← đường dẫn trang (không tiền tố ngôn ngữ), chữ thường
 *       "label": "Phòng nghỉ › Deluxe Triple",
 *       "sceneId": "panorama_…", "sceneName": "Lobby",
 *       "yaw": 120.5, "pitch": -5.2, "hfov": 95,
 *       "updatedAt": "…"
 *     }
 *   }
 * }
 *
 * GET                               → trả nội dung file (dự phòng khi file tĩnh bị chặn)
 * POST {"action":"verify"}          → kiểm tra mật khẩu
 * POST {"action":"save","path","view"}
 * POST {"action":"delete","path"}
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/_json_store.php';

header('X-Content-Type-Options: nosniff');

const VR360_VIEWS_FILE = JSON_STORE_DATA_DIR . '/vr360-views.json';

function vr360_number($value, float $min, float $max): ?float
{
    if (!is_int($value) && !is_float($value) && !(is_string($value) && is_numeric($value))) return null;
    $number = round((float) $value, 2);
    return ($number >= $min && $number <= $max) ? $number : null;
}

function vr360_sanitize_view($view): ?array
{
    if (!is_array($view)) return null;

    $sceneName = isset($view['sceneName']) && is_string($view['sceneName']) ? trim($view['sceneName']) : '';
    $sceneId = isset($view['sceneId']) && is_string($view['sceneId']) ? trim($view['sceneId']) : '';
    $label = isset($view['label']) && is_string($view['label']) ? trim($view['label']) : '';
    $yaw = vr360_number($view['yaw'] ?? null, -360, 360);
    $pitch = vr360_number($view['pitch'] ?? null, -90, 90);
    $hfov = isset($view['hfov']) ? vr360_number($view['hfov'], 1, 180) : null;

    if ($sceneName === '' || json_store_strlen($sceneName) > 200) return null;
    if ($sceneId !== '' && !preg_match('/^[A-Za-z0-9_-]{1,120}$/', $sceneId)) return null;
    if ($yaw === null || $pitch === null) return null;

    return [
        'label' => json_store_substr($label, 255),
        'sceneId' => $sceneId !== '' ? $sceneId : null,
        'sceneName' => $sceneName,
        'yaw' => $yaw,
        'pitch' => $pitch,
        'hfov' => $hfov,
        'updatedAt' => date('c'),
    ];
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate');
    echo json_store_encode(json_store_read(VR360_VIEWS_FILE, 'views'), 'views');
    exit;
}

if ($method !== 'POST') {
    json_store_respond(405, ['ok' => false, 'error' => 'method_not_allowed']);
}

json_store_require_editor();
$input = json_store_input();

switch ($input['action'] ?? '') {
    case 'verify':
        json_store_respond(200, ['ok' => true]);

    case 'save':
        $path = json_store_normalize_path($input['path'] ?? null);
        $view = vr360_sanitize_view($input['view'] ?? null);
        if ($path === null || $view === null) {
            json_store_respond(422, ['ok' => false, 'error' => 'invalid', 'message' => 'Dữ liệu không hợp lệ (path / cảnh / yaw / pitch)']);
        }
        $store = json_store_update(VR360_VIEWS_FILE, 'views', function (array $store) use ($path, $view) {
            $store['views'][$path] = $view;
            return $store;
        });
        json_store_respond(200, ['ok' => true, 'data' => json_decode(json_store_encode($store, 'views'), true)]);

    case 'delete':
        $path = json_store_normalize_path($input['path'] ?? null);
        if ($path === null) {
            json_store_respond(422, ['ok' => false, 'error' => 'invalid', 'message' => 'Đường dẫn không hợp lệ']);
        }
        $store = json_store_update(VR360_VIEWS_FILE, 'views', function (array $store) use ($path) {
            unset($store['views'][$path]);
            return $store;
        });
        json_store_respond(200, ['ok' => true, 'data' => json_decode(json_store_encode($store, 'views'), true)]);

    default:
        json_store_respond(400, ['ok' => false, 'error' => 'unknown_action']);
}
