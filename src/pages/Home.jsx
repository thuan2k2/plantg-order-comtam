import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import UsernamePopup from '../components/UsernamePopup';

const Home = () => {
  const navigate = useNavigate();
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [hasOrderedBefore, setHasOrderedBefore] = useState(false);
  const [savedPhone, setSavedPhone] = useState('');
  const [customerName, setCustomerName] = useState('');

  useEffect(() => {
    // Kiểm tra thông tin khách cũ
    const savedPhones = JSON.parse(localStorage.getItem('recentPhones') || '[]');
    const userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
    
    if (savedPhones.length > 0) {
      setHasOrderedBefore(true);
      setSavedPhone(savedPhones[0]);
      setCustomerName(userProfile.fullName || '');
    }
  }, []);

  // Hàm Đăng xuất để đổi số khác
  const handleLogoutCustomer = () => {
    if (window.confirm("Bạn muốn đặt hàng bằng số điện thoại khác?")) {
      localStorage.removeItem('recentPhones');
      localStorage.removeItem('userProfile');
      setHasOrderedBefore(false);
      setSavedPhone('');
      setCustomerName('');
      window.location.reload(); // Tải lại để xóa trạng thái
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF9F2] flex flex-col items-center p-6 font-sans">
      
      {/* TRANG TRÍ CHỦ ĐỀ QUÁN CƠM */}
      <div className="w-full max-w-md mt-12 mb-8 text-center">
        <div className="relative inline-block">
          {/* Icon dĩa cơm cách điệu */}
          <div className="w-28 h-28 bg-orange-500 rounded-full flex items-center justify-center shadow-2xl shadow-orange-200 border-4 border-white">
            <span className="text-5xl">🍱</span>
          </div>
          <div className="absolute -top-2 -right-4 bg-red-600 text-white text-[10px] font-black px-3 py-1 rounded-lg rotate-12 shadow-md">
            HOT!
          </div>
        </div>
        
        <div className="mt-6">
          <h1 className="text-4xl font-black text-[#4A2C2A] tracking-tighter leading-none">
            CƠM TẤM VINHOMES <br/>
            <span className="text-orange-600 text-2xl">CƠM TẤM NHÀ LÀM</span>
          </h1>
          <div className="flex justify-center gap-1 mt-3">
            {[1,2,3,4,5].map(i => <span key={i} className="text-yellow-500 text-sm">⭐</span>)}
          </div>
        </div>
      </div>

      {/* THÔNG TIN KHÁCH HÀNG & NÚT ĐĂNG XUẤT */}
      <div className="w-full max-w-xs mb-10">
        {hasOrderedBefore ? (
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-orange-100 text-center relative overflow-hidden">
            {/* Họa tiết trang trí góc */}
            <div className="absolute top-0 right-0 w-12 h-12 bg-orange-50 rounded-bl-full opacity-50"></div>
            
            <p className="text-[10px] font-black text-orange-400 uppercase tracking-[0.2em] mb-1">Thành viên thân thiết</p>
            <h2 className="text-lg font-black text-[#4A2C2A] truncate">
               Chào {customerName || 'Bạn'}!
            </h2>
            <p className="text-xs text-gray-400 font-bold mb-4">{savedPhone}</p>
            
            <button 
              onClick={handleLogoutCustomer}
              className="text-[10px] font-black text-red-500 border border-red-100 px-4 py-1.5 rounded-full hover:bg-red-50 transition-colors uppercase tracking-widest"
            >
              Đổi số khác
            </button>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-sm text-[#4A2C2A]/60 font-medium italic">
              "Cơm dẻo, sườn thơm, đậm đà vị nhà"
            </p>
          </div>
        )}
      </div>

      {/* CỤM NÚT CHỨC NĂNG CHÍNH */}
      <div className="w-full max-w-xs space-y-4">
        <button
          onClick={() => hasOrderedBefore ? navigate(`/order?user=${savedPhone}`) : setIsPopupOpen(true)}
          className="w-full bg-[#4A2C2A] hover:bg-[#2D1A19] text-white font-black py-5 rounded-2xl shadow-xl shadow-brown-200 transition-all active:scale-95 flex justify-center items-center gap-3 uppercase text-sm tracking-widest"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
          Đặt cơm ngay
        </button>

        <button
          onClick={() => navigate(hasOrderedBefore ? `/checkorder?user=${savedPhone}` : '/checkorder')}
          className="w-full bg-white border-2 border-orange-100 text-orange-600 hover:bg-orange-50 font-black py-5 rounded-2xl transition-all active:scale-95 flex justify-center items-center gap-3 uppercase text-sm tracking-widest"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
          Lịch sử đơn
        </button>

        {!hasOrderedBefore && (
          <button
            onClick={() => navigate('/dangky')}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-5 rounded-2xl shadow-lg shadow-orange-200 transition-all active:scale-95 flex justify-center items-center gap-3 uppercase text-xs tracking-widest"
          >
            Đăng ký thành viên
          </button>
        )}
      </div>

      {/* TRANG TRÍ DƯỚI CÙNG */}
      <div className="mt-auto pt-10 pb-6 text-center">
        <p className="text-[10px] font-black text-orange-200 uppercase tracking-[0.3em]">
          Mở cửa: 11:00 - 21:00
        </p>
        <div className="mt-2 text-[#4A2C2A]/20">••••••••••••</div>
      </div>

      <UsernamePopup 
        isOpen={isPopupOpen} 
        onClose={() => setIsPopupOpen(false)} 
      />
    </div>
  );
};

export default Home;