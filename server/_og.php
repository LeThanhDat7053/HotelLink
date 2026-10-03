<?php
/**
 * ============================================
 * OPEN GRAPH PHÍA SERVER (SSR) — index.php dùng
 * ============================================
 * Crawler Facebook/Zalo/Messenger… KHÔNG chạy JavaScript → thẻ OG phải có sẵn trong HTML.
 * Mỗi trang (/, /phong-nghi, /phong-nghi/<code>…) có tiêu đề / mô tả / ảnh riêng.
 *
 * Thứ tự hợp nhất (field có giá trị ở lớp sau thắng):
 *   1. Mặc định hệ thống
 *      - Trang chủ        : SEO của site (meta_title / meta_description), ảnh OG mặc định
 *      - Trang mục        : "<tên mục> – <SITE_NAME>", mô tả site, ảnh OG mặc định
 *      - Trang chi tiết   : "<tên phòng/nhà hàng…> – <SITE_NAME>", mô tả ngắn, ảnh đại diện của mục đó
 *   2. Tuỳ chỉnh admin trong data/share-og.json (trang /vr360-scene-sync)
 * Ngôn ngữ: /en/... (hoặc ngôn ngữ khác tiếng Việt) dùng bản EN; bản EN rỗng thì lùi về VI.
 *
 * GIỮ KHỚP với src/utils/shareOgDefaults.ts (trang admin tính mặc định cùng quy tắc để xem trước).
 * File bắt đầu bằng "_" bị .htaccess chặn truy cập trực tiếp.
 */

require_once __DIR__ . '/_json_store.php';

// Phải khớp SUPPORTED_LOCALES trong src/constants/routes.ts
const OG_LOCALES = ['ar', 'de', 'en', 'es', 'fr', 'hi', 'id', 'it', 'ja', 'ko', 'ms', 'pt', 'ru', 'ta', 'th', 'tl', 'vi', 'yue', 'zh', 'zh-tw'];

// Segment đầu là route thật của site (không phải slug sale) — khớp ROUTES trong src/constants/routes.ts
const OG_ROUTE_SEGMENTS = [
    'gioi-thieu', 'phong-nghi', 'am-thuc', 'nha-hang', 'lobby-bar', 'tien-ich', 'ho-boi', 'phong-gym', 'dich-vu',
    'phong-hop', 'phong-tam-hoi', 'dich-vu-khac', 'chinh-sach', 'lien-he', 'thu-vien-anh', 'tin-tuc-su-kien',
    'uu-dai', 'dat-phong', 'noi-quy-khach-san', 'vr360-scene-sync',
];

// Nhãn mục [vi, en] — khớp SHARE_OG_PAGE_LABELS trong src/utils/shareOgDefaults.ts
const OG_PAGE_LABELS = [
    '/gioi-thieu' => ['Giới thiệu', 'About Us'],
    '/phong-nghi' => ['Phòng nghỉ', 'Rooms'],
    '/am-thuc' => ['Ẩm thực', 'Dining'],
    '/tien-ich' => ['Tiện ích', 'Facilities'],
    '/dich-vu' => ['Dịch vụ', 'Services'],
    '/uu-dai' => ['Ưu đãi', 'Offers'],
    '/chinh-sach' => ['Chính sách', 'Policies'],
    '/lien-he' => ['Liên hệ', 'Contact'],
    '/thu-vien-anh' => ['Thư viện ảnh', 'Gallery'],
    '/noi-quy-khach-san' => ['Nội quy khách sạn', 'Hotel Regulations'],
];

// Trang chi tiết: /<segment>/<code> → danh sách nào trong API, field mã + field tên
const OG_DETAIL_SOURCES = [
    'phong-nghi' => ['endpoint' => '/vr-hotel/rooms', 'code' => 'room_code', 'name' => 'name'],
    'am-thuc' => ['endpoint' => '/vr-hotel/dining', 'code' => 'code', 'name' => 'name'],
    'tien-ich' => ['endpoint' => '/vr-hotel/facilities', 'code' => 'code', 'name' => 'name'],
    'dich-vu' => ['endpoint' => '/vr-hotel/services', 'code' => 'code', 'name' => 'name'],
    'uu-dai' => ['endpoint' => '/vr-hotel/offers', 'code' => 'code', 'name' => 'title'],
];

const OG_DESCRIPTION_EXCERPT = 200;

/** Tiền tố link ngắn: https://<domain>/<prefix>/<urlSlug> — đổi được bằng SHORTLINK_PREFIX trong config.php */
function og_shortlink_prefix(): string
{
    $prefix = defined('SHORTLINK_PREFIX') ? strtolower(trim((string) SHORTLINK_PREFIX, " /")) : '';
    return preg_match('/^[a-z0-9-]+$/', $prefix) ? $prefix : 'canh';
}
const OG_TITLE_SEPARATOR = ' – ';

function og_escape(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/**
 * Tách URL: [/<sale>][/<lang>]/<trang>
 * → pagePath "/phong-nghi/dlx-dbl3" (chữ thường), lang "vi"|"en", langPrefix "" | "/en" | "/ja"…
 */
function og_request_context(string $requestUri): array
{
    $path = parse_url($requestUri, PHP_URL_PATH) ?: '/';
    $segments = array_values(array_filter(explode('/', rawurldecode($path)), 'strlen'));

    $salePrefix = '';
    $first = strtolower($segments[0] ?? '');
    $knownSegments = array_merge(OG_ROUTE_SEGMENTS, [og_shortlink_prefix()]);
    if ($first !== '' && !in_array($first, OG_LOCALES, true) && !in_array($first, $knownSegments, true)) {
        $salePrefix = '/' . array_shift($segments); // slug của sale (vd /coraltest/...) — canonical không giữ
    }

    $locale = 'vi';
    $maybeLocale = strtolower($segments[0] ?? '');
    if ($maybeLocale !== '' && in_array($maybeLocale, OG_LOCALES, true)) {
        $locale = $maybeLocale;
        array_shift($segments);
    }

    // Link ngắn /<prefix>/<slug> → trang thật được tra ở og_resolve_shortlink()
    $shortSlug = null;
    if (count($segments) === 2 && strtolower($segments[0]) === og_shortlink_prefix()) {
        $shortSlug = strtolower($segments[1]);
    }

    $pagePath = json_store_normalize_path('/' . implode('/', $segments)) ?? '/';

    return [
        'pagePath' => $pagePath,
        'canonicalPath' => $pagePath,
        'shortSlug' => $shortSlug,
        'salePrefix' => $salePrefix,
        'query' => (string) (parse_url($requestUri, PHP_URL_QUERY) ?? ''),
        'locale' => $locale,
        'lang' => $locale === 'vi' ? 'vi' : 'en',
        'langPrefix' => $locale === 'vi' ? '' : '/' . ($locale === 'zh-tw' ? 'zh-TW' : $locale),
    ];
}

/**
 * Link ngắn /<prefix>/<slug>:
 *   - slug đang dùng      → ctx trỏ về trang thật, canonical = link ngắn, status 200
 *   - slug cũ (alias)     → 301 sang link mới, GIỮ query string (trang đã bỏ link → mở thẳng)
 *   - không có            → 404
 * @return array{ctx: array, status: int, redirect: ?string}
 */
function og_resolve_shortlink(array $ctx): array
{
    if ($ctx['shortSlug'] === null) return ['ctx' => $ctx, 'status' => 200, 'redirect' => null];

    $store = json_store_read(JSON_STORE_DATA_DIR . '/share-og.json', 'items');
    $slug = $ctx['shortSlug'];
    $prefix = '/' . og_shortlink_prefix() . '/';

    foreach ($store['items'] as $path => $item) {
        if (($item['urlSlug'] ?? '') === $slug) {
            $ctx['pagePath'] = $path;
            $ctx['canonicalPath'] = $prefix . $slug;
            return ['ctx' => $ctx, 'status' => 200, 'redirect' => null];
        }
    }

    $aliases = is_array($store['aliases'] ?? null) ? $store['aliases'] : [];
    if (isset($aliases[$slug])) {
        $path = (string) $aliases[$slug];
        $current = (string) ($store['items'][$path]['urlSlug'] ?? '');
        if ($current !== '') {
            $target = $ctx['salePrefix'] . $ctx['langPrefix'] . $prefix . $current;
            return ['ctx' => $ctx, 'status' => 301, 'redirect' => $target . ($ctx['query'] !== '' ? '?' . $ctx['query'] : '')];
        }
        $ctx['pagePath'] = $path;
        $ctx['canonicalPath'] = $prefix . $slug;
        return ['ctx' => $ctx, 'status' => 200, 'redirect' => null];
    }

    $ctx['pagePath'] = '/';
    $ctx['canonicalPath'] = '/';
    $ctx['shortSlug'] = null;
    return ['ctx' => $ctx, 'status' => 404, 'redirect' => null];
}

/** origin sau reverse proxy: X-Forwarded-Proto/Host → Host → SITE_BASE_URL */
function og_origin(): string
{
    $proto = $_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ((!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http');
    $proto = strtolower(trim(explode(',', $proto)[0])) === 'https' ? 'https' : 'http';
    $host = trim(explode(',', $_SERVER['HTTP_X_FORWARDED_HOST'] ?? ($_SERVER['HTTP_HOST'] ?? ''))[0]);

    if ($host !== '' && preg_match('/^[A-Za-z0-9.-]+(:\d+)?$/', $host)) {
        return $proto . '://' . $host;
    }
    return defined('SITE_BASE_URL') ? rtrim((string) SITE_BASE_URL, '/') : '';
}

function og_excerpt(string $html, int $maxLength = OG_DESCRIPTION_EXCERPT): string
{
    $text = html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $text = trim(preg_replace('/\s+/u', ' ', $text) ?? '');
    if (json_store_strlen($text) <= $maxLength) return $text;

    $cut = json_store_substr($text, $maxLength);
    $space = function_exists('mb_strrpos') ? mb_strrpos($cut, ' ', 0, 'UTF-8') : strrpos($cut, ' ');
    return rtrim($space !== false && $space > $maxLength * 0.6 ? json_store_substr($cut, (int) $space) : $cut, " ,.;:-") . '…';
}

function og_media_url(string $apiBase, $mediaId): string
{
    return is_numeric($mediaId) ? rtrim($apiBase, '/') . '/media/' . (int) $mediaId . '/view' : '';
}

/** Ảnh đại diện: ảnh primary (không phải VR360) → ảnh đầu tiên theo sort_order */
function og_entity_image(array $entity, string $apiBase): string
{
    $media = array_values(array_filter($entity['media'] ?? [], function ($item) {
        return is_array($item) && empty($item['is_vr360']) && isset($item['media_id']);
    }));
    if (!$media) return '';

    foreach ($media as $item) {
        if (!empty($item['is_primary'])) return og_media_url($apiBase, $item['media_id']);
    }
    usort($media, function ($a, $b) {
        return ($a['sort_order'] ?? 0) <=> ($b['sort_order'] ?? 0);
    });
    return og_media_url($apiBase, $media[0]['media_id']);
}

/** Cache file nhỏ để trang chi tiết không gọi API mỗi lượt xem (crawler + khách) */
function og_cached(string $key, int $ttl, callable $producer)
{
    $dir = __DIR__ . '/cache';
    $file = $dir . '/og-' . md5($key) . '.json';
    if (is_file($file) && time() - filemtime($file) < $ttl) {
        $cached = json_decode((string) file_get_contents($file), true);
        if (is_array($cached)) return $cached['value'] ?? null;
    }

    $value = $producer();
    if ($value !== null && (is_dir($dir) || @mkdir($dir, 0755, true))) {
        @file_put_contents($file . '.tmp', json_encode(['value' => $value], JSON_UNESCAPED_UNICODE));
        @rename($file . '.tmp', $file);
    }
    return $value;
}

/**
 * Mặc định hệ thống cho 1 trang.
 * @param callable $apiGet fn(string $endpoint): ?array — gọi API backend (đã kèm token / tenant / property)
 */
function og_defaults(array $ctx, ?array $settings, callable $apiGet, string $apiBase): array
{
    $lang = $ctx['lang'];
    $seoAll = is_array($settings['seo'] ?? null) ? $settings['seo'] : [];
    $seo = $seoAll[$lang] ?? [];
    $seoVi = $seoAll['vi'] ?? [];

    $siteName = defined('APP_NAME') && trim((string) APP_NAME) !== ''
        ? trim((string) APP_NAME)
        : trim((string) ($seoVi['meta_title'] ?? ''));
    $siteDescription = trim((string) ($seo['meta_description'] ?? '')) ?: trim((string) ($seoVi['meta_description'] ?? ''));

    $defaultImage = defined('DEFAULT_OG_IMAGE') && trim((string) DEFAULT_OG_IMAGE) !== ''
        ? trim((string) DEFAULT_OG_IMAGE)
        : og_media_url($apiBase, $seoVi['meta_image_media_id'] ?? ($settings['logo_media_id'] ?? null));

    $withSite = function (string $label) use ($siteName): string {
        return $siteName !== '' && $label !== $siteName ? $label . OG_TITLE_SEPARATOR . $siteName : $label;
    };

    $path = $ctx['pagePath'];
    $result = [
        'title' => $siteName,
        'description' => $siteDescription,
        'image' => $defaultImage,
        'siteName' => $siteName,
        'source' => ['type' => 'site', 'label' => 'Thông tin chung của website'],
    ];

    if ($path === '/') {
        $result['title'] = trim((string) ($seo['meta_title'] ?? '')) ?: $siteName;
        $result['source'] = ['type' => 'home', 'label' => 'SEO trang chủ'];
        return $result;
    }

    $segments = explode('/', ltrim($path, '/'));
    $base = '/' . $segments[0];

    if (count($segments) === 2 && isset(OG_DETAIL_SOURCES[$segments[0]])) {
        $source = OG_DETAIL_SOURCES[$segments[0]];
        $code = $segments[1];
        $entity = og_cached("entity:{$source['endpoint']}:{$code}", 600, function () use ($apiGet, $source, $code) {
            $list = $apiGet($source['endpoint'] . '?skip=0&limit=200');
            if (!is_array($list)) return null;
            foreach ($list as $item) {
                if (is_array($item) && strtolower((string) ($item[$source['code']] ?? '')) === $code) return $item;
            }
            return null;
        });

        if (is_array($entity)) {
            $translations = is_array($entity['translations'] ?? null) ? $entity['translations'] : [];
            $tr = $translations[$ctx['locale']] ?? $translations[$lang] ?? $translations['vi'] ?? [];
            $name = trim((string) ($tr[$source['name']] ?? ''));
            $description = og_excerpt((string) ($tr['description'] ?? ''));
            $image = og_entity_image($entity, $apiBase);

            if ($name !== '') $result['title'] = $withSite($name);
            if ($description !== '') $result['description'] = $description;
            if ($image !== '') $result['image'] = $image;
            $result['source'] = ['type' => 'entity', 'label' => 'Dữ liệu ' . (OG_PAGE_LABELS[$base][0] ?? 'mục') . ': ' . ($name ?: $code)];
            return $result;
        }
    }

    if (isset(OG_PAGE_LABELS[$base])) {
        $label = OG_PAGE_LABELS[$base][$lang === 'vi' ? 0 : 1];
        $result['title'] = $withSite($label);
        $result['source'] = ['type' => 'page', 'label' => 'Tên mục + mô tả website'];
    }
    return $result;
}

/** Lớp 2: tuỳ chỉnh admin. Field rỗng = giữ mặc định; EN rỗng → bản VI của admin */
function og_apply_custom(array $og, ?array $custom, string $lang): array
{
    if (!$custom) return $og;

    $pick = function (string $field) use ($custom, $lang): string {
        $vi = trim((string) ($custom[$field . 'Vi'] ?? ''));
        $en = trim((string) ($custom[$field . 'En'] ?? ''));
        return $lang === 'vi' ? $vi : ($en !== '' ? $en : $vi);
    };

    $title = $pick('title');
    $description = $pick('description');
    $image = trim((string) ($custom['image'] ?? ''));

    if ($title !== '') $og['title'] = $title;
    if ($description !== '') $og['description'] = $description;
    if ($image !== '') $og['image'] = $image;
    $og['custom'] = true;
    return $og;
}

function og_read_custom(string $pagePath): ?array
{
    $store = json_store_read(JSON_STORE_DATA_DIR . '/share-og.json', 'items');
    $item = $store['items'][$pagePath] ?? null;
    return is_array($item) ? $item : null;
}

/** Khối meta chèn vào <head> — mọi giá trị đều escape */
function og_render_block(array $og, array $ctx, string $origin): string
{
    // canonical: link ngắn nếu vào bằng link ngắn; không kèm query / tiền tố sale
    $canonicalPath = $ctx['canonicalPath'] ?? $ctx['pagePath'];
    $canonical = $origin . $ctx['langPrefix'] . ($canonicalPath === '/' && $ctx['langPrefix'] !== '' ? '' : $canonicalPath);
    $viUrl = $origin . $canonicalPath;
    $enUrl = $origin . '/en' . ($canonicalPath === '/' ? '' : $canonicalPath);

    $image = (string) ($og['image'] ?? '');
    $width = $height = null;
    if ($image !== '' && $image[0] === '/') {
        // Ảnh trên chính hosting (share-images/…) → đọc kích thước thật cho og:image:width/height
        $local = realpath(__DIR__ . parse_url($image, PHP_URL_PATH));
        if ($local && strpos($local, realpath(__DIR__)) === 0 && is_file($local)) {
            $info = @getimagesize($local);
            if ($info) {
                $width = (int) $info[0];
                $height = (int) $info[1];
            }
        }
        $image = $origin . $image;
    }

    $isVi = $ctx['lang'] === 'vi';
    $e = 'og_escape';
    $lines = [
        '<title>' . $e($og['title']) . '</title>',
        '<meta name="description" content="' . $e($og['description']) . '">',
        '<link rel="canonical" href="' . $e($canonical) . '">',
        '<link rel="alternate" hreflang="vi" href="' . $e($viUrl) . '">',
        '<link rel="alternate" hreflang="en" href="' . $e($enUrl) . '">',
        '<meta property="og:type" content="website">',
        '<meta property="og:site_name" content="' . $e($og['siteName'] ?: $og['title']) . '">',
        '<meta property="og:title" content="' . $e($og['title']) . '">',
        '<meta property="og:description" content="' . $e($og['description']) . '">',
        '<meta property="og:url" content="' . $e($canonical) . '">',
    ];
    if ($image !== '') {
        $lines[] = '<meta property="og:image" content="' . $e($image) . '">';
        if (stripos($image, 'https://') === 0) {
            $lines[] = '<meta property="og:image:secure_url" content="' . $e($image) . '">';
        }
        if ($width && $height) {
            $lines[] = '<meta property="og:image:width" content="' . $width . '">';
            $lines[] = '<meta property="og:image:height" content="' . $height . '">';
        }
        $lines[] = '<meta property="og:image:alt" content="' . $e($og['title']) . '">';
    }
    $lines[] = '<meta property="og:locale" content="' . ($isVi ? 'vi_VN' : 'en_GB') . '">';
    $lines[] = '<meta property="og:locale:alternate" content="' . ($isVi ? 'en_GB' : 'vi_VN') . '">';
    $lines[] = '<meta name="twitter:card" content="summary_large_image">';
    $lines[] = '<meta name="twitter:title" content="' . $e($og['title']) . '">';
    $lines[] = '<meta name="twitter:description" content="' . $e($og['description']) . '">';
    if ($image !== '') {
        $lines[] = '<meta name="twitter:image" content="' . $e($image) . '">';
    }

    return "    " . implode("\n    ", $lines) . "\n";
}

/**
 * Chèn khối OG: thay vùng <!-- OG_META_START -->…<!-- OG_META_END -->, đồng thời XOÁ mọi thẻ
 * title / description / canonical / alternate / og:* / twitter:* còn sót ngoài vùng đó
 * (vd do scripts/inject-seo.js chèn lúc build) → HTML chỉ còn MỘT bộ OG.
 */
function og_inject(string $html, string $block, string $lang): string
{
    $slot = '<!--OG_META_SLOT-->';
    // Marker có thể kèm chú thích: <!-- OG_META_START — … -->
    $html = preg_replace('#<!--\s*OG_META_START\b[^>]*-->.*?<!--\s*OG_META_END\b[^>]*-->#s', $slot, $html, 1) ?? $html;

    $headEnd = stripos($html, '</head>');
    if ($headEnd === false) return $html;
    $head = substr($html, 0, $headEnd);
    $rest = substr($html, $headEnd);

    $patterns = [
        '#[ \t]*<title\b[^>]*>.*?</title>\s*#is',
        '#[ \t]*<meta\s+(?:property|name)\s*=\s*["\'](?:og:[^"\']*|twitter:[^"\']*|description)["\'][^>]*>\s*#i',
        '#[ \t]*<link\s+rel\s*=\s*["\'](?:canonical|alternate)["\'][^>]*>\s*#i',
    ];
    $head = preg_replace($patterns, '', $head) ?? $head;

    if (strpos($head, $slot) !== false) {
        $head = str_replace($slot, "\n" . $block, $head);
    } else {
        $head .= $block;
    }

    $html = $head . $rest;
    return preg_replace('/<html\b[^>]*>/i', '<html lang="' . ($lang === 'vi' ? 'vi' : 'en') . '">', $html, 1) ?? $html;
}
