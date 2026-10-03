<?php
/**
 * Hàm dùng chung cho các endpoint ghi dữ liệu của trang /vr360-scene-sync:
 * vr360-views.php (góc nhìn), share-og.php (OG chia sẻ), share-image.php (ảnh chia sẻ).
 *
 * - Ghi file JSON trong data/: khoá file + ghi nguyên tử (tmp → rename) + giữ 1 bản backup.
 * - Kiểm mật khẩu VR360_EDITOR_PASSWORD (config.php) qua header X-VR360-Editor-Key.
 *
 * File bắt đầu bằng "_" bị .htaccess chặn truy cập trực tiếp.
 */

if (!defined('JSON_STORE_LOADED')) {
    define('JSON_STORE_LOADED', true);

    define('JSON_STORE_DATA_DIR', __DIR__ . '/data');

    function json_store_respond(int $status, array $body): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store, no-cache, must-revalidate');
        echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    /** mbstring không phải hosting nào cũng bật — rơi về strlen/substr (đếm theo byte) */
    function json_store_strlen(string $value): int
    {
        return function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
    }

    function json_store_substr(string $value, int $length): string
    {
        return function_exists('mb_substr') ? mb_substr($value, 0, $length, 'UTF-8') : substr($value, 0, $length);
    }

    /** Đường dẫn trang: "/", "/phong-nghi", "/phong-nghi/deluxe-triple" — chữ thường, không "/" cuối */
    function json_store_normalize_path($path): ?string
    {
        if (!is_string($path)) return null;
        $path = strtolower(trim($path));
        if ($path !== '/') $path = rtrim($path, '/');
        if (strlen($path) > 200) return null;
        return preg_match('#^/(?:[a-z0-9_-]+(?:/[a-z0-9_-]+)*)?$#', $path) ? $path : null;
    }

    /** Đọc store; $collection là khoá của object chính ("views", "items"…) */
    function json_store_read(string $file, string $collection): array
    {
        $empty = ['version' => 1, 'updatedAt' => null, $collection => []];
        if (!is_file($file)) return $empty;
        $data = json_decode((string) file_get_contents($file), true);
        if (!is_array($data) || !isset($data[$collection]) || !is_array($data[$collection])) return $empty;
        return $data;
    }

    /** json_encode biến mảng rỗng thành [] — collection phải luôn là object {} */
    function json_store_encode(array $store, string $collection): string
    {
        $store[$collection] = (object) $store[$collection];
        if (isset($store['aliases']) && is_array($store['aliases'])) {
            $store['aliases'] = (object) $store['aliases'];
        }
        return json_encode($store, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    }

    /** Đọc → sửa → ghi dưới khoá file, ghi nguyên tử, giữ 1 bản <tên>.backup.json */
    function json_store_update(string $file, string $collection, callable $mutate): array
    {
        $dir = dirname($file);
        if (!is_dir($dir) && !@mkdir($dir, 0755, true)) {
            json_store_respond(500, ['ok' => false, 'error' => 'not_writable', 'message' => 'Không tạo được thư mục data/ trên hosting']);
        }

        $base = basename($file, '.json');
        $lock = fopen($dir . '/' . $base . '.lock', 'c');
        if (!$lock || !flock($lock, LOCK_EX)) {
            json_store_respond(500, ['ok' => false, 'error' => 'lock_failed', 'message' => 'Không khoá được file dữ liệu']);
        }

        try {
            $store = $mutate(json_store_read($file, $collection));
            $store['version'] = 1;
            $store['updatedAt'] = date('c');

            if (is_file($file)) {
                @copy($file, $dir . '/' . $base . '.backup.json');
            }

            $tmpFile = $file . '.tmp';
            if (file_put_contents($tmpFile, json_store_encode($store, $collection)) === false || !rename($tmpFile, $file)) {
                json_store_respond(500, ['ok' => false, 'error' => 'write_failed', 'message' => 'Không ghi được ' . basename($file)]);
            }
            return $store;
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }

    /** Dừng với 401/403 nếu mật khẩu sai hoặc chưa cấu hình */
    function json_store_require_editor(): void
    {
        $expectedKey = defined('VR360_EDITOR_PASSWORD') ? (string) VR360_EDITOR_PASSWORD : '';
        if ($expectedKey === '') {
            json_store_respond(403, [
                'ok' => false,
                'error' => 'editor_disabled',
                'message' => 'Chưa đặt VR360_EDITOR_PASSWORD trong config.php',
            ]);
        }

        $givenKey = (string) ($_SERVER['HTTP_X_VR360_EDITOR_KEY'] ?? '');
        if (!hash_equals($expectedKey, $givenKey)) {
            usleep(400000); // làm chậm dò mật khẩu
            json_store_respond(401, ['ok' => false, 'error' => 'unauthorized', 'message' => 'Sai mật khẩu']);
        }
    }

    function json_store_input(): array
    {
        $input = json_decode((string) file_get_contents('php://input'), true);
        return is_array($input) ? $input : [];
    }
}
