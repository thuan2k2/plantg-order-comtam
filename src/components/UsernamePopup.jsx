import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserByPhone } from '../services/authService';

const UsernamePopup = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  // Nếu state isOpen là false, không render gì cả
  if (!isOpen) return null;

  const handleLogin = async (e) => {
    e.preventDefault();
    
    // Kiểm tra định dạng SĐT cơ bản
    const cleanPhone = phone.trim();
    if (cleanPhone.length < 10) {
      alert("Vui lòng nhập Số điện thoại hợp lệ!");
      return;
    }

    setLoading(true);
    try {
      // Tìm kiếm user trên Firebase dựa trên ID là SĐT
      const user = await getUserByPhone(cleanPhone);

      if (user) {
        // 1. Lưu vào LocalStorage để các trang Home/Order nhận diện được ngay
        localStorage.setItem('recentPhones', JSON.stringify([user.username]));
        localStorage.setItem('userProfile', JSON.stringify(user));
        
        onClose();
        // 2. Chuyển hướng qua trang Order kèm tham số user
        navigate(`/order?user=${user.username}`);
        
        // 3. Reload nhẹ để Home cập nhật state Real-time (Avatar, Xu...)
        window.location.reload();
      } else {
        // Nếu không thấy SĐT trên Firebase
        if (window.confirm("Số điện thoại này chưa đăng ký thành viên. Bạn có muốn đăng ký mới không?")) {
          onClose();
          navigate('/dangky');
        }
      }
    } catch (error) {
      console.error("Lỗi đăng nhập:", error);
      alert(error.message || "Có lỗi xảy ra khi kiểm tra thông tin.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-300">
        
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
             <span className="text-2xl">👤</span>
          </div>
          <h2 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-tighter">Đăng nhập nhanh</h2>
          <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mt-1 uppercase tracking-widest">
            Nhập SĐT để truy cập Ví & Xu tích lũy
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <input 
            type="tel" 
            placeholder="Số điện thoại của bạn..." 
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoFocus
            className="w-full p-5 bg-gray-50 dark:bg-gray-700 dark:text-white rounded-2xl border-none outline-none font-black text-center text-lg focus:ring-2 focus:ring-blue-600 transition-all placeholder:text-gray-300 dark:placeholder:text-gray-500"
          />

          <div className="flex gap-3">
            <button 
              type="button"
              onClick={onClose} 
              className="flex-1 py-4 font-black text-gray-400 dark:text-gray-500 uppercase text-[10px] tracking-widest hover:bg-gray-100 dark:hover:bg-gray-700 rounded-2xl transition-colors"
            >
              Hủy
            </button>
            <button 
              type="submit"
              disabled={loading}
              className={`flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-blue-100 dark:shadow-none active:scale-95 transition-all
                ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'}`}
            >
              {loading ? 'Đang kiểm tra...' : 'Vào hệ thống →'}
            </button>
          </div>
        </form>

        <div className="mt-8 pt-6 border-t border-dashed border-gray-100 dark:border-gray-700 text-center">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Bạn là người mới?</p>
          <button 
            onClick={() => { onClose(); navigate('/dangky'); }}
            className="text-orange-500 dark:text-orange-400 font-black text-xs uppercase tracking-tighter hover:underline"
          >
            Đăng ký thành viên ngay
          </button>
        </div>
      </div>
    </div>
  );
};

export default UsernamePopup;