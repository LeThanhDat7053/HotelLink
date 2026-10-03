<?php
// ===== 1. LOAD CẤU HÌNH TỪ FILE config.php =====
// Đọc config từ file riêng - có thể chỉnh trên server mà không cần build lại
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/_og.php';

// Link ngắn /canh/<slug>: link cũ → 301 ngay (giữ query), không cần gọi API
$ogContext = og_request_context($_SERVER['REQUEST_URI'] ?? '/');
$ogShortlink = og_resolve_shortlink($ogContext);
if ($ogShortlink['redirect'] !== null) {
    header('Location: ' . $ogShortlink['redirect'], true, 301);
    exit;
}
$ogContext = $ogShortlink['ctx'];
if ($ogShortlink['status'] === 404) {
    http_response_code(404);
}

$API_BASE_URL = API_BASE_URL;
$API_USERNAME = API_USERNAME;
$API_PASSWORD = API_PASSWORD;
$TENANT_CODE  = TENANT_CODE;
$PROPERTY_ID  = PROPERTY_ID;

$tokenCacheFile = __DIR__ . '/token_cache.txt';

// ===== 2. HÀM LOGIN & GỌI API =====
function loginAndGetToken($baseUrl, $user, $pass, $tenant) {
    $ch = curl_init("$baseUrl/auth/login");
    $formData = http_build_query(['username' => $user, 'password' => $pass]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $formData);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ["x-tenant-code: $tenant"]);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    $response = curl_exec($ch);
    $data = json_decode($response, true);
    curl_close($ch);
    return $data['access_token'] ?? null;
}

function getSettings($baseUrl, $token, $tenant, $propertyId) {
    return apiGetJson($baseUrl, '/vr-hotel/settings', $token, $tenant, $propertyId);
}

// GET 1 endpoint của API backend; backend chậm/sập thì trả status 0 thay vì treo cả trang
function apiGetJson($baseUrl, $endpoint, $token, $tenant, $propertyId) {
    $ch = curl_init($baseUrl . $endpoint);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "accept: application/json", 
        "x-tenant-code: $tenant", 
        "x-property-id: $propertyId", 
        "Authorization: Bearer $token"
    ]);
    $response = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['status' => $status, 'data' => json_decode($response, true)];
}

// ===== 3. XỬ LÝ CHÍNH =====
$authToken = @file_get_contents($tokenCacheFile);
if (!$authToken) {
    $authToken = loginAndGetToken($API_BASE_URL, $API_USERNAME, $API_PASSWORD, $TENANT_CODE);
    file_put_contents($tokenCacheFile, $authToken);
}

$result = getSettings($API_BASE_URL, $authToken, $TENANT_CODE, $PROPERTY_ID);
if ($result['status'] === 401) { // Token hết hạn
    $authToken = loginAndGetToken($API_BASE_URL, $API_USERNAME, $API_PASSWORD, $TENANT_CODE);
    file_put_contents($tokenCacheFile, $authToken);
    $result = getSettings($API_BASE_URL, $authToken, $TENANT_CODE, $PROPERTY_ID);
}

$data = is_array($result['data']) && $result['status'] === 200 ? $result['data'] : [];
$seo = $data['seo']['vi'] ?? [];

$key_api   = $seo['meta_keywords'] ?? "";
// Favicon: ưu tiên favicon_media_id, fallback logo_media_id, không có thì không dùng
$favicon_id = $data['favicon_media_id'] ?? $data['logo_media_id'] ?? null;
$fav_api   = $favicon_id ? "https://travel.link360.vn/api/v1/media/" . $favicon_id . "/view" : "";

if (!file_exists('index.html')) {
    die("Lỗi: Không tìm thấy file index.html nguồn");
}
$html = file_get_contents('index.html');

// ===== 4. OPEN GRAPH THEO TỪNG TRANG (SSR — xem _og.php) =====
// Mỗi trang có tiêu đề / mô tả / ảnh riêng: mặc định từ API + tuỳ chỉnh admin ở data/share-og.json
$ogApiGet = function ($endpoint) use ($API_BASE_URL, $authToken, $TENANT_CODE, $PROPERTY_ID) {
    $response = apiGetJson($API_BASE_URL, $endpoint, $authToken, $TENANT_CODE, $PROPERTY_ID);
    return $response['status'] === 200 && is_array($response['data']) ? $response['data'] : null;
};
$og = og_defaults($ogContext, $data, $ogApiGet, $API_BASE_URL);
$og = og_apply_custom($og, og_read_custom($ogContext['pagePath']), $ogContext['lang']);
$html = og_inject($html, og_render_block($og, $ogContext, og_origin()), $ogContext['lang']);

// Keywords (không thuộc OG)
$html = preg_replace('/<meta name="keywords" content=".*?"/i', '<meta name="keywords" content="'.og_escape((string) $key_api).'"', $html);

// Thay Favicon - chỉ thay nếu có favicon
if ($fav_api) {
    $html = str_replace('https://travel.link360.vn/api/v1/media/172/view', $fav_api, $html);
}

// ===== TIÊM DỮ LIỆU VÀO FRONTEND (BẢO MẬT) =====
// Config được nhúng trong __INITIAL_DATA__ (ít dễ thấy hơn)
$data['_config'] = [
    'api_base' => API_BASE_URL,
    'tenant' => TENANT_CODE,
    'tenant_id' => defined('TENANT_ID') ? TENANT_ID : '',
    'property_id' => PROPERTY_ID,
    'vr360_cdn' => defined('VR360_CDN_URL') ? VR360_CDN_URL : 'https://travel.link360.vn',
    'site_url' => defined('SITE_BASE_URL') ? SITE_BASE_URL : '',
    'app_name' => defined('APP_NAME') ? APP_NAME : '',
    'default_og_image' => defined('DEFAULT_OG_IMAGE') ? DEFAULT_OG_IMAGE : '',
    'shortlink_prefix' => og_shortlink_prefix(),
];
// Vào bằng link ngắn → React mở đúng trang thật (cảnh + góc đã lưu của trang đó)
$data['_share_target'] = $ogContext['shortSlug'] !== null ? $ogContext['pagePath'] : null;

$injectData = "<script id='__SERVER_DATA__'>
    window.__SERVER_TOKEN__ = '" . $authToken . "';
    window.__INITIAL_DATA__ = " . json_encode($data) . ";
</script>";
$html = str_replace('</head>', $injectData . '</head>', $html);

echo $html;