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
    // Tự động nhận diện khách quen từ dữ liệu đã lưu khi đặt hàng thành công
    const savedPhones = JSON.parse(localStorage.getItem('recentPhones') || '[]');
    const userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
    
    if (savedPhones.length > 0) {
      setHasOrderedBefore(true);
      setSavedPhone(savedPhones[0]);
      setCustomerName(userProfile.fullName || '');
    }
  }, []);

  // Hàm Đăng xuất khách hàng (Xóa dấu vết để đặt bằng số khác)
  const handleLogoutCustomer = () => {
    if (window.confirm("Bạn muốn đặt hàng bằng số điện thoại khác?")) {
      localStorage.removeItem('recentPhones');
      localStorage.removeItem('userProfile');
      // Reset trạng thái tại chỗ
      setHasOrderedBefore(false);
      setSavedPhone('');
      setCustomerName('');
      // Reload để đảm bảo các component liên quan cập nhật lại từ đầu
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 font-sans">
      
      {/* KHỐI BRANDING (ĐỒNG BỘ VỚI CÁC TRANG ADMIN/ORDER) */}
      <div className="w-full max-w-sm text-center mb-10">
        <div className="relative inline-block mb-6">
          <div className="w-24 h-24 bg-blue-600 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-blue-200 border-4 border-white animate-in zoom-in duration-500">
            <span className="text-4xl text-white">🍱</span>
          </div>
          <div className="absolute -bottom-2 -right-2 bg-orange-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-lg">
            PLANT G
          </div>
        </div>
        
        <h1 className="text-4xl font-black text-gray-800 tracking-tighter leading-tight uppercase">
          Cơm Tấm <br/>
          <span className="text-blue-600">Nhà Làm</span>
        </h1>
        <div className="flex justify-center gap-1 mt-3">
            {[1,2,3,4,5].map(i => <span key={i} className="text-yellow-400 text-[10px]">★</span>)}
        </div>
      </div>

      {/* THẺ THÔNG TIN KHÁCH HÀNG (CARD STYLE) */}
      <div className="w-full max-w-xs mb-8">
        {hasOrderedBefore ? (
          <div className="bg-white rounded-[2.5rem] p-6 shadow-xl shadow-gray-200/50 border border-gray-100 text-center animate-in slide-in-from-bottom-5 duration-700 relative overflow-hidden">
            {/* Họa tiết trang trí chìm */}
            <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 rounded-bl-full -mr-4 -mt-4 opacity-50"></div>
            
            <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1 relative z-10">Thành viên ưu tiên</p>
            <h2 className="text-xl font-black text-gray-800 truncate px-2 relative z-10">
               Chào {customerName || 'Bạn'}!
            </h2>
            <p className="text-xs text-gray-400 font-bold mb-5 mt-1 relative z-10">{savedPhone}</p>
            
            <button 
              onClick={handleLogoutCustomer}
              className="text-[10px] font-black text-red-400 hover:text-red-600 border border-red-50 px-4 py-1.5 rounded-full transition-all uppercase tracking-widest relative z-10 bg-red-50/30"
            >
              Đổi số khác
            </button>
          </div>
        ) : (
          <div className="text-center px-6">
            <p className="text-sm text-gray-500 font-medium italic leading-relaxed">
              "Cơm dẻo, sườn thơm, đậm đà vị nhà. Đặt món ngay để thưởng thức hương vị ấm cúng tại Vinhomes."
            </p>
          </div>
        )}
      </div>

      {/* CỤM NÚT CHỨC NĂNG CHÍNH (ĐỒNG BỘ STYLE) */}
      <div className="w-full max-w-xs space-y-4">
        <button
          onClick={() => hasOrderedBefore ? navigate(`/order?user=${savedPhone}`) : setIsPopupOpen(true)}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-[2rem] shadow-xl shadow-blue-100 transition-all active:scale-95 flex justify-center items-center gap-3 uppercase text-xs tracking-[0.2em]"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
          Đặt cơm ngay
        </button>

        <button
          onClick={() => navigate(hasOrderedBefore ? `/checkorder?user=${savedPhone}` : '/checkorder')}
          className="w-full bg-white border-2 border-gray-100 text-gray-800 hover:bg-gray-50 font-black py-5 rounded-[2rem] transition-all active:scale-95 flex justify-center items-center gap-3 uppercase text-xs tracking-[0.2em] shadow-sm"
        >
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          Kiểm tra đơn
        </button>

        {!hasOrderedBefore && (
          <button
            onClick={() => navigate('/dangky')}
            className="w-full bg-orange-50 text-orange-600 hover:bg-orange-100 border border-orange-100 font-black py-5 rounded-[2rem] transition-all active:scale-95 flex justify-center items-center gap-3 uppercase text-[10px] tracking-[0.2em]"
          >
            Đăng ký thành viên
          </button>
        )}
      </div>

      {/* FOOTER ĐỒNG BỘ */}
      <div className="mt-16 text-center">
        <p className="text-[9px] font-black text-gray-300 uppercase tracking-[0.4em]">
          Mở cửa: 11:00 - 21:00
        </p>
        <p className="text-[9px] font-black text-gray-200 uppercase tracking-[0.2em] mt-2">
          Plant G Order System 2025
        </p>
      </div>

      {/* Component Popup nhập tên/SĐT cho khách mới */}
      <UsernamePopup 
        isOpen={isPopupOpen} 
        onClose={() => setIsPopupOpen(false)} 
      />
    </div>
  );
};

export default Home;