import React, { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext();

export const SettingsProvider = ({ children }) => {
  // 1. Chỉ giữ lại State của Theme (Sáng/Tối/Hệ thống)
  const [theme, setTheme] = useState(() => localStorage.getItem('app_theme') || 'system');

  // 2. Cập nhật LocalStorage và giao diện khi Theme thay đổi
  useEffect(() => {
    localStorage.setItem('app_theme', theme);
    applyTheme(theme);
  }, [theme]);

  // 3. Hàm xử lý logic Theme (Thêm/Xóa class 'dark' vào thẻ HTML)
  const applyTheme = (currentTheme) => {
    const root = window.document.documentElement;
    
    if (currentTheme === 'dark') {
      root.classList.add('dark');
    } else if (currentTheme === 'light') {
      root.classList.remove('dark');
    } else {
      // Nếu là 'system', kiểm tra cấu hình của máy người dùng
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (isDark) root.classList.add('dark');
      else root.classList.remove('dark');
    }
  };

  // 4. Lắng nghe thay đổi theme từ hệ thống (khi máy người dùng tự động chuyển ngày/đêm)
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') applyTheme('system');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // 5. Hàm dịch thuật dự phòng (Tránh lỗi build khi bạn chưa gỡ hết biến t() ở các file khác)
  const t = (key) => {
    const fallbackDictionary = {
      welcome: 'Chào mừng',
      orderNow: 'ĐẶT CƠM NGAY',
      checkOrder: 'KIỂM TRA ĐƠN HÀNG',
      register: 'Đăng ký thành viên',
      themeLight: 'Sáng',
      themeDark: 'Tối',
      themeSystem: 'Hệ thống'
    };
    return fallbackDictionary[key] || key;
  };

  return (
    // Đã gỡ bỏ language và setLanguage
    <SettingsContext.Provider value={{ theme, setTheme, t }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};