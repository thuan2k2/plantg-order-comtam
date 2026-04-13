import React, { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext();

// 1. BỘ TỪ ĐIỂN ĐA NGÔN NGỮ CHI TIẾT
const dictionary = {
  vi: {
    welcome: 'Chào mừng,',
    orderNow: 'Đặt Cơm Ngay',
    checkOrder: 'Lịch sử đơn hàng',
    register: 'Đăng ký thành viên',
    themeLight: 'Giao diện Sáng',
    themeDark: 'Giao diện Tối',
    themeSystem: 'Theo hệ thống',
    lang: 'Tiếng Việt',
    // Trang Order & CheckOrder
    phone: 'Số điện thoại',
    address: 'Địa chỉ nhận hàng',
    fullName: 'Họ và tên',
    items: 'Chi tiết món',
    total: 'Thành tiền',
    payment: 'Thanh toán',
    note: 'Ghi chú',
    apply: 'Áp dụng',
    voucher: 'Mã giảm giá',
    myVouchers: 'Kho mã của tôi',
    confirmOrder: 'Xác nhận đặt đơn',
    reOrder: 'Đặt lại đơn này',
    cancelOrder: 'Yêu cầu hủy đơn',
    back: 'Quay lại',
    status: 'Trạng thái',
    loading: 'Đang tải dữ liệu...'
  },
  en: {
    welcome: 'Welcome,',
    orderNow: 'Order Now',
    checkOrder: 'Order History',
    register: 'Register Member',
    themeLight: 'Light Mode',
    themeDark: 'Dark Mode',
    themeSystem: 'System Default',
    lang: 'English',
    // Trang Order & CheckOrder
    phone: 'Phone Number',
    address: 'Delivery Address',
    fullName: 'Full Name',
    items: 'Order Items',
    total: 'Total Amount',
    payment: 'Payment',
    note: 'Note',
    apply: 'Apply',
    voucher: 'Voucher Code',
    myVouchers: 'My Vouchers',
    confirmOrder: 'Confirm Order',
    reOrder: 'Re-order this',
    cancelOrder: 'Cancel Order',
    back: 'Back',
    status: 'Status',
    loading: 'Loading...'
  },
  zh: {
    welcome: '欢迎,',
    orderNow: '立即点餐',
    checkOrder: '历史订单',
    register: '注册会员',
    themeLight: '浅色模式',
    themeDark: '深色模式',
    themeSystem: '系统默认',
    lang: '中文',
    // Trang Order & CheckOrder
    phone: '电话号码',
    address: '收货地址',
    fullName: '姓名',
    items: '菜品详情',
    total: '总额',
    payment: '支付方式',
    note: '备注',
    apply: '应用',
    voucher: '优惠码',
    myVouchers: '我的优惠券',
    confirmOrder: '确认下单',
    reOrder: '重新下单',
    cancelOrder: '取消订单',
    back: '返回',
    status: '状态',
    loading: '加载中...'
  }
};

export const SettingsProvider = ({ children }) => {
  // 1. Khởi tạo State từ LocalStorage
  const [language, setLanguage] = useState(() => localStorage.getItem('app_lang') || 'vi');
  const [theme, setTheme] = useState(() => localStorage.getItem('app_theme') || 'system');

  // 2. Cập nhật LocalStorage khi có thay đổi
  useEffect(() => {
    localStorage.setItem('app_lang', language);
  }, [language]);

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
      // Nếu là 'system', kiểm tra preference của máy
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (isDark) root.classList.add('dark');
      else root.classList.remove('dark');
    }
  };

  // 4. Lắng nghe thay đổi theme từ hệ thống (nếu dùng mode system)
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') applyTheme('system');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // 5. Hàm dịch thuật (Translation)
  const t = (key) => {
    // Nếu tìm thấy key trong từ điển của ngôn ngữ hiện tại thì trả về, không thì trả về Tiếng Việt, bí quá trả về chính key đó
    return dictionary[language]?.[key] || dictionary['vi'][key] || key;
  };

  return (
    <SettingsContext.Provider value={{ language, setLanguage, theme, setTheme, t }}>
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