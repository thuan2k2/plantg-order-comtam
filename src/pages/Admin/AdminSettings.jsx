import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth'; // Lấy thông tin tài khoản đăng nhập
import { db } from '../../firebase/config';
import { updateAdminProfile } from '../../services/authService'; // Hàm cập nhật avatar

const AdminSettings = () => {
  const auth = getAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // State cho ảnh Admin
  const [adminAvatar, setAdminAvatar] = useState('');
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);

  // State cho cấu hình vận hành
  const [config, setConfig] = useState({
    isOpen: true,
    minOrder: 0,
    openTime: '',
    sysNotice: ''
  });

  // Tải cấu hình từ Firebase khi vào trang
  useEffect(() => {
    const fetchConfig = async () => {
      setIsLoading(true);
      try {
        // Lấy config
        const snap = await getDoc(doc(db, 'system', 'config'));
        if (snap.exists()) {
          setConfig(snap.data());
        } else {
          console.warn("Chưa có document system/config trên Firestore.");
        }
        
        // Lấy ảnh đại diện Admin hiện tại
        if (auth.currentUser) {
          setAdminAvatar(auth.currentUser.photoURL || '');
        }
      } catch (error) {
        console.error("Lỗi tải cấu hình:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    // Đợi Firebase Auth khởi tạo xong
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setAdminAvatar(user.photoURL || '');
        fetchConfig();
      }
    });

    return () => unsubscribe();
  }, [auth]);

  // HÀM LƯU ẢNH ĐẠI DIỆN ADMIN
  const handleUpdateAvatar = async () => {
    if (isUpdatingAvatar) return;
    setIsUpdatingAvatar(true);
    
    const res = await updateAdminProfile(adminAvatar);
    if (res.success) {
      alert("✅ Đã cập nhật ảnh đại diện Admin thành công!");
    } else {
      alert("❌ Lỗi: " + res.error);
    }
    
    setIsUpdatingAvatar(false);
  };

  // HÀM LƯU CẤU HÌNH VẬN HÀNH
  const handleSaveConfig = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'system', 'config'), config);
      alert("✅ Cấu hình hệ thống đã được cập nhật thành công!");
    } catch (error) {
      console.error("Lỗi lưu cấu hình:", error);
      alert("❌ Lỗi: Bạn cần chạy Script khởi tạo tại đường dẫn /setup-system trước hoặc kiểm tra Firestore Rules.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
      <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Đang tải thiết lập...</p>
    </div>
  );

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-10 animate-in fade-in duration-500 pb-20">
      
      {/* 1. KHỐI HỒ SƠ ADMIN */}
      <section className="space-y-4">
        <h2 className="text-xl font-black uppercase tracking-tighter text-gray-800">Hồ sơ Quản trị viên</h2>
        <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border shadow-sm flex flex-col md:flex-row items-center gap-8">
          <div className="relative flex-shrink-0">
            <div className="w-28 h-28 rounded-[2rem] overflow-hidden border-4 border-gray-50 shadow-xl bg-gray-100">
              <img 
                src={adminAvatar || `https://ui-avatars.com/api/?name=Admin&background=000&color=fff`} 
                className="w-full h-full object-cover" 
                alt="Admin Avt" 
                onError={(e) => { e.target.src = 'https://ui-avatars.com/api/?name=Admin&background=000&color=fff'; }}
              />
            </div>
            <div className="absolute -bottom-2 -right-2 bg-green-500 border-4 border-white w-6 h-6 rounded-full"></div>
          </div>
          
          <div className="flex-1 space-y-4 w-full">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-2 block">
                Link ảnh đại diện (Hiển thị ở mục Chat)
              </label>
              <input 
                type="text" 
                value={adminAvatar} 
                onChange={e => setAdminAvatar(e.target.value)}
                className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-bold text-sm focus:ring-2 focus:ring-blue-500 transition-all"
                placeholder="https://example.com/admin.jpg"
              />
            </div>
            <button 
              onClick={handleUpdateAvatar}
              disabled={isUpdatingAvatar}
              className={`bg-blue-600 text-white px-6 py-3.5 rounded-xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all shadow-lg shadow-blue-100 flex items-center gap-2
                ${isUpdatingAvatar ? 'opacity-70 cursor-not-allowed' : 'hover:bg-blue-700'}`}
            >
              {isUpdatingAvatar ? (
                 <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Đang lưu...</>
              ) : 'Cập nhật Avatar'}
            </button>
          </div>
        </div>
      </section>

      <hr className="border-dashed border-gray-200" />

      {/* 2. KHỐI CẤU HÌNH VẬN HÀNH QUÁN */}
      <section className="space-y-4">
        <h2 className="text-xl font-black uppercase tracking-tighter text-gray-800">Cấu hình vận hành Quán</h2>

        {/* Trạng thái cửa hàng */}
        <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border flex flex-col sm:flex-row justify-between items-center shadow-sm gap-4">
          <div className="text-center sm:text-left">
            <p className="font-black uppercase text-sm text-gray-800">Trạng thái đóng/mở cửa</p>
            <p className="text-xs text-gray-400 mt-1">Khi đóng, nút "Xác nhận đặt đơn" của khách sẽ bị vô hiệu hóa.</p>
          </div>
          <button 
            onClick={() => setConfig({...config, isOpen: !config.isOpen})}
            className={`w-full sm:w-auto px-8 py-4 rounded-2xl font-black uppercase text-xs transition-all duration-300 shadow-md active:scale-95
              ${config.isOpen 
                ? 'bg-green-500 text-white shadow-green-100 hover:bg-green-600' 
                : 'bg-red-500 text-white shadow-red-100 hover:bg-red-600'}`}
          >
            {config.isOpen ? '● Đang mở cửa' : '○ Đang đóng cửa'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Thông báo hệ thống */}
          <div className="md:col-span-2 bg-white p-6 sm:p-8 rounded-[2.5rem] border shadow-sm">
            <label className="block text-[10px] font-black text-gray-400 uppercase mb-3 tracking-widest ml-1">Thông báo nổi bật (Hiện ở Trang chủ)</label>
            <textarea 
              value={config.sysNotice || ''} 
              onChange={e => setConfig({...config, sysNotice: e.target.value})}
              className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-bold text-sm resize-none h-24 focus:ring-2 focus:ring-blue-500 transition-all"
              placeholder="Ví dụ: Cơm tấm hôm nay có thêm sườn muối ớt rất cay và ngon..."
            />
          </div>

          {/* Giờ mở cửa */}
          <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border shadow-sm">
            <label className="block text-[10px] font-black text-gray-400 uppercase mb-3 tracking-widest ml-1">Giờ hoạt động hiển thị</label>
            <input 
              value={config.openTime || ''} 
              onChange={e => setConfig({...config, openTime: e.target.value})}
              className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-black text-blue-600 focus:ring-2 focus:ring-blue-500 transition-all"
              placeholder="Ví dụ: 11:00 - 21:00"
            />
          </div>

          {/* Đơn hàng tối thiểu */}
          <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border shadow-sm">
            <label className="block text-[10px] font-black text-gray-400 uppercase mb-3 tracking-widest ml-1">Giá trị đơn tối thiểu (đ)</label>
            <input 
              type="number"
              value={config.minOrder || 0} 
              onChange={e => setConfig({...config, minOrder: parseInt(e.target.value) || 0})}
              className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-black text-red-500 focus:ring-2 focus:ring-red-500 transition-all"
            />
          </div>
        </div>

        <button 
          onClick={handleSaveConfig}
          disabled={isSaving}
          className={`w-full py-6 rounded-[2rem] font-black uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3
            ${isSaving ? 'bg-gray-400 cursor-not-allowed' : 'bg-gray-900 text-white hover:bg-black'}`}
        >
          {isSaving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Đang lưu dữ liệu...
            </>
          ) : 'Lưu tất cả thiết lập hệ thống'}
        </button>
      </section>

    </div>
  );
};

export default AdminSettings;