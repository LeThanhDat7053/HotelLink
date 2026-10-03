// Mật khẩu lưu góc chỉ giữ trong tab hiện tại (sessionStorage) — đóng tab là phải nhập lại
const SESSION_KEY = 'vr360_editor_key';

export const editorKeyStorage = {
  read(): string | null {
    try {
      return window.sessionStorage.getItem(SESSION_KEY);
    } catch {
      return null;
    }
  },
  write(key: string) {
    try {
      window.sessionStorage.setItem(SESSION_KEY, key);
    } catch {
      // sessionStorage bị chặn → vẫn dùng được trong phiên này
    }
  },
  clear() {
    try {
      window.sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // bỏ qua
    }
  },
};
