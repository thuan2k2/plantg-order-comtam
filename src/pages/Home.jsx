import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import UsernamePopup from '../components/UsernamePopup';

const Home = () => {
  const navigate = useNavigate();
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  
  // States để kiểm tra khách cũ
  const [hasOrderedBefore, setHasOrderedBefore] = useState(false);
  const [savedPhone, setSavedPhone] = useState('');

  useEffect(() => {
    // Kiểm tra lịch sử đặt hàng trong LocalStorage
    const savedPhones = JSON.parse(localStorage.getItem('recentPhones') || '[]');
    
    if (savedPhones.length > 0) {
      setHasOrderedBefore(true);
      setSavedPhone(savedPhones[0]); // Lấy số điện thoại gần nhất
    }
  }, []);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
      {/* Logo / Hình ảnh minh họa */}
      <div className="mb-8 relative">
        <div className="w-24 h-24 bg-orange-100 text-orange-500 rounded-[2rem] flex items-center justify-center mx-auto shadow-xl shadow-orange-50 transition-transform hover:scale-105">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">
          Plant G
        </div>
      </div>

      {/* Nội dung chào mừng */}
      <div className="space-y-2 mb-12">
        <h1 className="text-3xl font-black text-gray-800 tracking-tighter uppercase leading-tight">
          {hasOrderedBefore ? 'Chào mừng trở lại!' : 'Cơm Tấm Vinhomes'}
        </h1>
        <p className="text-sm text-gray-400 font-medium max-w-[280px] mx-auto leading-relaxed">
          {hasOrderedBefore 
            ? `Rất vui được phục vụ bạn tiếp tục với số điện thoại ${savedPhone}` 
            : 'Hệ thống đặt món nhanh chóng dành riêng cho cư dân Vinhomes.'}
        </p>
      </div>

      {/* Cụm Nút Chức Năng */}
      <div className="w-full max-w-xs space-y-4">
        
        {/* NÚT 1: ĐẶT HÀNG (Luôn hiển thị) */}
        <button
          onClick={() => hasOrderedBefore ? navigate(`/order?user=${savedPhone}`) : setIsPopupOpen(true)}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 px-6 rounded-2xl shadow-lg shadow-blue-100 transition-all active:scale-95 flex justify-center items-center gap-3 uppercase text-xs tracking-widest"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
          </svg>
          Đặt hàng ngay
        </button>

        {/* NÚT 2: KIỂM TRA ĐƠN HÀNG (Mới bổ sung) */}
        <button
          onClick={() => navigate(hasOrderedBefore ? `/checkorder?user=${savedPhone}` : '/checkorder')}
          className="w-full bg-white border-2 border-gray-100 text-gray-700 hover:bg-gray-50 font-black py-4 px-6 rounded-2xl transition-all active:scale-95 flex justify-center items-center gap-3 uppercase text-xs tracking-widest shadow-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          Kiểm tra đơn hàng
        </button>

        {/* NÚT 3: ĐĂNG KÝ (Ẩn nếu là khách cũ) */}
        {!hasOrderedBefore && (
          <button
            onClick={() => navigate('/dangky')}
            className="w-full bg-green-50 text-green-600 hover:bg-green-100 border border-green-200 font-black py-4 px-6 rounded-2xl transition-all active:scale-95 flex justify-center items-center gap-3 uppercase text-[11px] tracking-widest"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
            Đăng ký tài khoản
          </button>
        )}
      </div>

      {/* Footer nhỏ */}
      <div className="mt-20 pt-8 border-t border-gray-50 w-full max-w-[150px]">
        <p className="text-[9px] font-black text-gray-300 uppercase tracking-[0.2em]">Plant G System</p>
      </div>

      {/* Popup nhập SĐT nhanh nếu chưa lưu */}
      <UsernamePopup 
        isOpen={isPopupOpen} 
        onClose={() => setIsPopupOpen(false)} 
      />
    </div>
  );
};

export default Home;