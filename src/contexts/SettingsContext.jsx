import React, { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext();

// 1. BỘ TỪ ĐIỂN ĐA NGÔN NGỮ (Bạn có thể bổ sung thêm từ vựng ở đây)
const dictionary = {
  vi: {
    welcome: 'Chào mừng đến với',
    orderNow: 'Đặt Cơm Ngay',
    checkOrder: 'Kiểm tra đơn hàng',
    themeLight: 'Sáng',
    themeDark: 'Tối',
    themeSystem: 'Hệ thống',
    lang: 'Tiếng Việt'
  },
  en: {
    welcome: 'Welcome to',
    orderNow: 'Order Now',
    checkOrder: 'Check your order',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeSystem: 'System',
    lang: 'English'
  },
  zh: {
    welcome: '欢迎来到',
    orderNow: '立即点餐',
    checkOrder: '查询订单',
    themeLight: '浅色',
    themeDark: '深色',
    themeSystem: '系统',
    lang: '中文'
  }
};

export const SettingsProvider = ({ children }) => {
  // Khởi tạo State từ localStorage (Mặc định: 'vi' và 'system')
  const [language, setLanguage] = useState(() => localStorage.getItem('app_lang') || 'vi');
  const [theme, setTheme] = useState(() => localStorage.getItem('app_theme') || 'system');

  // Xử lý lưu và áp dụng Language
  useEffect(() => {
    localStorage.setItem('app_lang', language);
  }, [language]);

  // Xử lý lưu và áp dụng Theme (Chèn class 'dark' vào HTML)
  useEffect(() => {
    localStorage.setItem('app_theme', theme);
    const root = window.document.documentElement;
    
    const applyDarkTheme = (isDark) => {
      if (isDark) root.classList.add('dark');
      else root.classList.remove('dark');
    };

    if (theme === 'system') {
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyDarkTheme(systemPrefersDark);
      
      // Lắng nghe hệ thống đổi màu
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e) => applyDarkTheme(e.matches);
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      applyDarkTheme(theme === 'dark');
    }
  }, [theme]);

  // Hàm dịch thuật (Translation function)
  const t = (key) => {
    return dictionary[language]?.[key] || dictionary['vi'][key] || key;
  };

  return (
    <SettingsContext.Provider value={{ language, setLanguage, theme, setTheme, t }}>
      {children}
    </SettingsContext.Provider>
  );
};

// Custom hook để gọi nhanh trong các Component
export const useSettings = () => useContext(SettingsContext);