<?php
/**
 * ==============================================
 * FILE MẪU CẤU HÌNH API - TOÀN BỘ DỰ ÁN
 * ==============================================
 * Đây là file mẫu. Để sử dụng:
 * 1. Copy file này thành `config.php`
 * 2. Điền thông tin API thật của bạn
 * 3. KHÔNG commit config.php lên git (đã được gitignore)
 * 
 * File này điều khiển API cho:
 * - Server-side: Meta link (index.php)
 * - Client-side: React frontend (src/api.ts)
 */

// ===== API Configuration =====
define('API_BASE_URL', 'https://travel.link360.vn/api/v1');
define('API_USERNAME', 'your-email@example.com');
define('API_PASSWORD', 'your-password-here');

// ===== Tenant & Property =====
define('TENANT_CODE', 'your-tenant-code');
define('TENANT_ID', '1');
define('PROPERTY_ID', '1');

// ===== Additional Config =====
define('VR360_CDN_URL', 'https://travel.link360.vn');
define('SITE_BASE_URL', 'https://yourhotel.com');
define('APP_NAME', 'Your Hotel Name');          // = SITE_NAME: hậu tố tiêu đề chia sẻ + og:site_name

// ===== Chia sẻ OG (Facebook / Zalo / Messenger…) =====
// Ảnh dùng khi trang không có ảnh nào. Để trống = ảnh SEO / logo của khách sạn trên backend.
// Có thể là URL đầy đủ hoặc đường dẫn trên hosting, vd '/share-images/default-og.jpg' (khuyến nghị 1200×630).
define('DEFAULT_OG_IMAGE', '');

// Tiền tố link chia sẻ: https://<domain>/<SHORTLINK_PREFIX>/<url_slug>. Để trống = "canh".
define('SHORTLINK_PREFIX', 'canh');

// ===== Trang chỉnh góc VR360 (/vr360-scene-sync) =====
// Mật khẩu để LƯU góc nhìn vào data/vr360-views.json. Để trống = tắt chức năng lưu.
// Đặt mật khẩu dài, riêng cho từng khách sạn; chỉ đưa cho người quản trị nội dung.
define('VR360_EDITOR_PASSWORD', '');
