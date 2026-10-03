/**
 * Góc nhìn VR360 theo VỊ TRÍ MENU — nội dung file data/vr360-views.json trên hosting.
 * Khoá = đường dẫn trang không có tiền tố ngôn ngữ, chữ thường:
 *   "/"                          Trang chủ
 *   "/phong-nghi"                danh sách phòng
 *   "/phong-nghi/deluxe-triple"  chi tiết 1 phòng (code trên URL)
 */
export interface Vr360PageView {
  /** Nhãn cho người đọc file, vd "Phòng nghỉ › Deluxe Triple" */
  label?: string;
  sceneId: string | null;
  sceneName: string;
  yaw: number;
  pitch: number;
  /** Độ zoom lúc lưu — chỉ tham khảo, website chưa áp (zoom mặc định khác nhau giữa máy) */
  hfov: number | null;
  updatedAt?: string;
}

export interface Vr360ViewsFile {
  version: number;
  updatedAt: string | null;
  views: Record<string, Vr360PageView>;
}
