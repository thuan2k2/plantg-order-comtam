import React, { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext();

export const SettingsProvider = ({ children }) => {
  // 1. Quản lý Theme (Sáng/Tối)
  const [theme, setTheme] = useState(() => localStorage.getItem('app_theme') || 'system');

  // 2. Quản lý Chế độ hiển thị (Máy tính/Điện thoại)
  // Mặc định là 'desktop', lưu vào localStorage để ghi nhớ lựa chọn
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('admin_view_mode') || 'desktop');

  // Cập nhật LocalStorage và giao diện khi Theme thay đổi
  useEffect(() => {
    localStorage.setItem('app_theme', theme);
    applyTheme(theme);
  }, [theme]);

  // Cập nhật LocalStorage khi ViewMode thay đổi
  useEffect(() => {
    localStorage.setItem('admin_view_mode', viewMode);
  }, [viewMode]);

  // Hàm xử lý logic Theme
  const applyTheme = (currentTheme) => {
    const root = window.document.documentElement;
    if (currentTheme === 'dark') {
      root.classList.add('dark');
    } else if (currentTheme === 'light') {
      root.classList.remove('dark');
    } else {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (isDark) root.classList.add('dark');
      else root.classList.remove('dark');
    }
  };

  // Lắng nghe thay đổi theme từ hệ thống
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') applyTheme('system');
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // Hàm dịch thuật dự phòng (Giữ nguyên để tránh lỗi các file chưa sửa)
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
    <SettingsContext.Provider value={{ 
      theme, setTheme, 
      viewMode, setViewMode, // Cung cấp ViewMode cho toàn bộ App
      t 
    }}>
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