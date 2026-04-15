import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { getAuth } from 'firebase/auth'; 
import { db } from '../../firebase/config';
import { updateAdminProfile } from '../../services/authService'; 
// Import 2 hàm test từ chatService
import { resetTestingGamification, resetTestingLuckyXu } from '../../services/chatService'; 

const AdminSettings = () => {
  const auth = getAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // State cho ảnh Admin
  const [adminAvatar, setAdminAvatar] = useState('');
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);

  // State cho Tin nhắn nhanh
  const [quickReplies, setQuickReplies] = useState([]);
  const [newReply, setNewReply] = useState('');

  // State cho cấu hình vận hành
  const [config, setConfig] = useState({
    isOpen: true,
    minOrder: 0,
    openTime: '',
    sysNotice: ''
  });

  // State cho Test Reset (Gamification & Lucky Xu)
  const [testPhone, setTestPhone] = useState('');

  // Tải cấu hình từ Firebase khi vào trang
  useEffect(() => {
    const fetchConfig = async () => {
      setIsLoading(true);
      try {
        const snap = await getDoc(doc(db, 'system', 'config'));
        if (snap.exists()) {
          setConfig(snap.data());
        } else {
          console.warn("Chưa có document system/config trên Firestore.");
        }
        
        if (auth.currentUser) {
          setAdminAvatar(auth.currentUser.photoURL || '');
        }
      } catch (error) {
        console.error("Lỗi tải cấu hình:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setAdminAvatar(user.photoURL || '');
        fetchConfig();
      }
    });

    return () => unsubscribe();
  }, [auth]);

  // Lắng nghe danh sách Tin nhắn nhanh
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system', 'quick_replies'), (docSnap) => {
      if (docSnap.exists()) {
        setQuickReplies(docSnap.data().list || []);
      }
    });
    return () => unsub();
  }, []);

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

  // --- CÁC HÀM QUẢN LÝ TIN NHẮN NHANH ---
  const handleAddReply = async (e) => {
    e.preventDefault(); 
    const text = newReply.trim();
    if (!text) return;

    try {
      const updatedList = [...quickReplies, text];
      const replyRef = doc(db, 'system', 'quick_replies');
      
      await setDoc(replyRef, { list: updatedList }, { merge: true });
      
      setNewReply('');
    } catch (error) {
      console.error("Lỗi thêm tin nhắn nhanh:", error);
      alert("Lỗi khi thêm tin nhắn nhanh!");
    }
  };

  const handleDeleteReply = async (index) => {
    if (window.confirm("Bạn muốn xóa mẫu tin nhắn này?")) {
      try {
        const updatedList = quickReplies.filter((_, i) => i !== index);
        await updateDoc(doc(db, 'system', 'quick_replies'), { list: updatedList });
      } catch (error) {
        console.error("Lỗi xóa tin nhắn nhanh:", error);
        alert("Lỗi khi xóa tin nhắn nhanh!");
      }
    }
  };

  // --- HÀM RESET TESTING ---
  const handleResetGamification = async () => {
    if (!testPhone.trim() || testPhone.trim().length < 10) {
      return alert("Vui lòng nhập đúng Số điện thoại cần reset!");
    }
    try {
      await resetTestingGamification(testPhone.trim());
      alert(`Đã reset thành công Hộp quà và Lịch điểm danh cho SĐT: ${testPhone}`);
    } catch (error) {
      alert("Lỗi khi reset: " + error.message);
    }
  };

  const handleResetLuckyXu = async () => {
    if (!testPhone.trim() || testPhone.trim().length < 10) {
      return alert("Vui lòng nhập đúng Số điện thoại cần reset!");
    }
    try {
      await resetTestingLuckyXu(testPhone.trim());
      alert(`Đã reset thành công cờ Lì xì rơi (Lucky Xu) cho SĐT: ${testPhone}\n(Hãy kiểm tra lại xem phút hiện tại có nằm trong Khung giờ sự kiện không nhé)`);
    } catch (error) {
      alert("Lỗi khi reset: " + error.message);
    }
  };

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
      <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Đang tải thiết lập...</p>
    </div>
  );

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-10 animate-in fade-in duration-500 pb-20 dark:bg-transparent">
      
      {/* 1. KHỐI HỒ SƠ ADMIN */}
      <section className="space-y-4">
        <h2 className="text-xl font-black uppercase tracking-tighter text-gray-800 dark:text-white">Hồ sơ Quản trị viên</h2>
        <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col md:flex-row items-center gap-8 transition-colors">
          <div className="relative flex-shrink-0">
            <div className="w-28 h-28 rounded-[2rem] overflow-hidden border-4 border-gray-50 dark:border-gray-700 shadow-xl bg-gray-100 dark:bg-gray-800">
              <img 
                src={adminAvatar || `https://ui-avatars.com/api/?name=Admin&background=000&color=fff`} 
                className="w-full h-full object-cover" 
                alt="Admin Avt" 
                onError={(e) => { e.target.src = 'https://ui-avatars.com/api/?name=Admin&background=000&color=fff'; }}
              />
            </div>
            <div className="absolute -bottom-2 -right-2 bg-green-500 border-4 border-white dark:border-gray-800 w-6 h-6 rounded-full transition-colors"></div>
          </div>
          
          <div className="flex-1 space-y-4 w-full">
            <div>
              <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1 mb-2 block">
                Link ảnh đại diện (Hiển thị ở mục Chat)
              </label>
              <input 
                type="text" 
                value={adminAvatar} 
                onChange={e => setAdminAvatar(e.target.value)}
                className="w-full p-4 bg-gray-50 dark:bg-gray-700 dark:text-white rounded-2xl border-none outline-none font-bold text-sm focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-gray-300 dark:placeholder:text-gray-500"
                placeholder="https://example.com/admin.jpg"
              />
            </div>
            <button 
              onClick={handleUpdateAvatar}
              disabled={isUpdatingAvatar}
              className={`bg-blue-600 text-white px-6 py-3.5 rounded-xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all shadow-lg shadow-blue-100 dark:shadow-none flex items-center gap-2
                ${isUpdatingAvatar ? 'opacity-70 cursor-not-allowed' : 'hover:bg-blue-700'}`}
            >
              {isUpdatingAvatar ? (
                 <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Đang lưu...</>
              ) : 'Cập nhật Avatar'}
            </button>
          </div>
        </div>
      </section>

      <hr className="border-dashed border-gray-200 dark:border-gray-700 transition-colors" />

      {/* 2. KHỐI QUẢN LÝ TIN NHẮN NHANH */}
      <section className="space-y-4">
        <div className="flex justify-between items-end">
          <div>
             <h2 className="text-xl font-black uppercase tracking-tighter text-gray-800 dark:text-white">Tin nhắn phản hồi nhanh</h2>
             <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mt-1">Dùng để trả lời nhanh trong mục Hỗ trợ khách</p>
          </div>
          <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg border border-blue-100 dark:border-blue-800">
            {quickReplies.length} mẫu
          </span>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm transition-colors">
          <form onSubmit={handleAddReply} className="flex flex-col sm:flex-row gap-3 mb-8">
            <input 
              type="text"
              value={newReply} 
              onChange={e => setNewReply(e.target.value)}
              placeholder="Nhập mẫu tin nhắn (VD: Dạ quán đã nhận được đơn của anh/chị...)"
              className="flex-1 p-4 bg-gray-50 dark:bg-gray-700 dark:text-white rounded-2xl border-none outline-none font-bold text-sm focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-gray-300 dark:placeholder:text-gray-500"
            />
            <button 
              type="submit"
              disabled={!newReply.trim()}
              className={`px-8 py-4 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg transition-all active:scale-95
                ${!newReply.trim() ? 'bg-gray-300 dark:bg-gray-600 shadow-none cursor-not-allowed' : 'bg-blue-600 shadow-blue-200 dark:shadow-none hover:bg-blue-700'}`}
            >
              Thêm mẫu
            </button>
          </form>

          {quickReplies.length === 0 ? (
            <div className="text-center p-8 bg-gray-50 dark:bg-gray-700/50 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-600">
              <span className="text-3xl opacity-50 block mb-2">⚡</span>
              <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Chưa có mẫu tin nhắn nhanh nào</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[300px] overflow-y-auto no-scrollbar pr-2">
              {quickReplies.map((text, i) => (
                <div key={i} className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-2xl group transition-all hover:border-blue-200 dark:hover:border-blue-800 border border-transparent">
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{text}</span>
                  <button 
                    onClick={() => handleDeleteReply(i)} 
                    className="p-2 text-red-400 dark:text-red-500 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity bg-red-50 dark:bg-red-900/30 rounded-xl"
                    title="Xóa mẫu tin này"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <hr className="border-dashed border-gray-200 dark:border-gray-700 transition-colors" />

      {/* 3. KHỐI CẤU HÌNH VẬN HÀNH QUÁN */}
      <section className="space-y-4">
        <h2 className="text-xl font-black uppercase tracking-tighter text-gray-800 dark:text-white">Cấu hình vận hành Quán</h2>

        <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-center shadow-sm gap-4 transition-colors">
          <div className="text-center sm:text-left">
            <p className="font-black uppercase text-sm text-gray-800 dark:text-gray-100">Trạng thái đóng/mở cửa</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mt-2">Khi đóng, nút đặt cơm của khách sẽ bị khóa.</p>
          </div>
          <button 
            onClick={() => setConfig({...config, isOpen: !config.isOpen})}
            className={`w-full sm:w-auto px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] transition-all duration-300 shadow-xl active:scale-95 border-2
              ${config.isOpen 
                ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-500 shadow-green-100 dark:shadow-none hover:bg-green-100' 
                : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-500 shadow-red-100 dark:shadow-none hover:bg-red-100'}`}
          >
            {config.isOpen ? '● Đang mở cửa' : '○ Đang đóng cửa'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2 bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm transition-colors">
            <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase mb-3 tracking-widest ml-1">Thông báo nổi bật (Hiện ở Trang chủ)</label>
            <textarea 
              value={config.sysNotice || ''} 
              onChange={e => setConfig({...config, sysNotice: e.target.value})}
              className="w-full p-4 bg-gray-50 dark:bg-gray-700 dark:text-white rounded-2xl border-none outline-none font-bold text-sm resize-none h-24 focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-gray-300 dark:placeholder:text-gray-500"
              placeholder="Ví dụ: Cơm tấm hôm nay có thêm sườn muối ớt rất cay và ngon..."
            />
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm transition-colors">
            <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase mb-3 tracking-widest ml-1">Giờ hoạt động hiển thị</label>
            <input 
              value={config.openTime || ''} 
              onChange={e => setConfig({...config, openTime: e.target.value})}
              className="w-full p-4 bg-gray-50 dark:bg-gray-700 dark:text-white rounded-2xl border-none outline-none font-black text-blue-600 dark:text-blue-400 focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-gray-300 dark:placeholder:text-gray-500"
              placeholder="Ví dụ: 11:00 - 21:00"
            />
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm transition-colors">
            <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase mb-3 tracking-widest ml-1">Giá trị đơn tối thiểu (đ)</label>
            <input 
              type="number"
              value={config.minOrder || 0} 
              onChange={e => setConfig({...config, minOrder: parseInt(e.target.value) || 0})}
              className="w-full p-4 bg-gray-50 dark:bg-gray-700 dark:text-white rounded-2xl border-none outline-none font-black text-red-500 dark:text-red-400 focus:ring-2 focus:ring-red-500 transition-all"
            />
          </div>
        </div>

        <button 
          onClick={handleSaveConfig}
          disabled={isSaving}
          className={`w-full py-6 rounded-[2.5rem] font-black uppercase tracking-[0.2em] text-xs shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3
            ${isSaving 
              ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed text-white' 
              : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-black dark:hover:bg-gray-200'}`}
        >
          {isSaving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
              Đang lưu dữ liệu...
            </>
          ) : 'Lưu tất cả thiết lập hệ thống'}
        </button>
      </section>

      <hr className="border-dashed border-gray-200 dark:border-gray-700 transition-colors" />

      {/* --- 4. KHỐI CÔNG CỤ TEST (TẠM THỜI) --- */}
      <section className="space-y-4">
        <h2 className="text-xl font-black uppercase tracking-tighter text-red-600 dark:text-red-400">🛠 Công cụ Test (Tạm thời)</h2>
        <div className="bg-red-50 dark:bg-red-900/10 p-6 sm:p-8 rounded-[2.5rem] border border-red-100 dark:border-red-900/30 shadow-sm flex flex-col gap-4 transition-colors">
          
          <div className="w-full mb-2">
            <label className="block text-[10px] font-black text-red-400 dark:text-red-500 uppercase mb-2 tracking-widest ml-1">
              SĐT khách hàng cần reset
            </label>
            <input
              type="tel"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="Nhập SĐT..."
              className="w-full p-4 bg-white dark:bg-gray-800 dark:text-white rounded-2xl border border-red-200 dark:border-red-800 outline-none font-bold text-sm focus:ring-2 focus:ring-red-500 transition-all placeholder:text-gray-300 dark:placeholder:text-gray-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={handleResetGamification}
              className="w-full px-6 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg shadow-red-200 dark:shadow-none active:scale-95"
            >
              Reset Hộp Quà & Điểm Danh
            </button>

            <button
              onClick={handleResetLuckyXu}
              className="w-full px-6 py-4 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg shadow-orange-200 dark:shadow-none active:scale-95 flex items-center justify-center gap-2"
            >
              <span>🧧</span> Reset Lì Xì (Lucky Xu)
            </button>
          </div>
          
        </div>
      </section>

    </div>
  );
};

export default AdminSettings;