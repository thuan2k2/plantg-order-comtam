import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';

const ManageEvents = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [newTime, setNewTime] = useState("");

  // Cấu trúc dữ liệu mặc định nếu database chưa có
  const defaultData = {
    luckyXu: { min: 10, max: 100, duration: 15, activeTimes: [] },
    dailyBox: { min: 10, max: 50 },
    attendance: { coins: 10 }
  };

  const [formData, setFormData] = useState(defaultData);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const snap = await getDoc(doc(db, 'system', 'events'));
        if (snap.exists()) {
          // Gộp dữ liệu trên mạng với cấu trúc mặc định để tránh lỗi undefined
          setFormData({
            luckyXu: { ...defaultData.luckyXu, ...snap.data().luckyXu },
            dailyBox: { ...defaultData.dailyBox, ...snap.data().dailyBox },
            attendance: { ...defaultData.attendance, ...snap.data().attendance }
          });
        }
      } catch (error) {
        console.error("Lỗi khi tải dữ liệu sự kiện:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchEvents();
  }, []);

  // Hàm Lưu toàn bộ cấu hình lên Firebase
  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'system', 'events'), formData, { merge: true });
      alert("✅ Đã lưu cấu hình sự kiện thành công!");
    } catch (error) {
      console.error("Lỗi lưu cấu hình:", error);
      alert("❌ Lỗi khi lưu sự kiện, vui lòng thử lại.");
    } finally {
      setIsSaving(false);
    }
  };

  // Hàm Thêm/Xóa khung giờ Lì xì rơi
  const handleAddTime = () => {
    if (!newTime) return;
    if (formData.luckyXu.activeTimes.includes(newTime)) {
      alert("Khung giờ này đã tồn tại!");
      return;
    }
    setFormData({
      ...formData,
      luckyXu: {
        ...formData.luckyXu,
        activeTimes: [...formData.luckyXu.activeTimes, newTime].sort() // Sắp xếp giờ từ sáng đến tối
      }
    });
    setNewTime("");
  };

  const handleRemoveTime = (timeToRemove) => {
    setFormData({
      ...formData,
      luckyXu: {
        ...formData.luckyXu,
        activeTimes: formData.luckyXu.activeTimes.filter(t => t !== timeToRemove)
      }
    });
  };

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500 mb-4"></div>
      <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Đang tải cấu hình...</p>
    </div>
  );

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-24">
      
      <div>
        <h2 className="text-2xl font-black uppercase tracking-tighter text-gray-800 dark:text-white">Quản lý Sự kiện & Xu</h2>
        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mt-2 uppercase tracking-widest">
          Thiết lập các phần thưởng tự động để tăng tương tác khách hàng
        </p>
      </div>

      {/* ========================================================= */}
      {/* KHỐI 1: SỰ KIỆN LUCKY XU (LÌ XÌ RƠI) */}
      {/* ========================================================= */}
      <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-[2.5rem] shadow-sm border border-red-100 dark:border-red-900/30 transition-colors relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 dark:bg-red-900/10 rounded-bl-full opacity-50 pointer-events-none"></div>
        
        <div className="flex items-center gap-4 mb-8 relative z-10">
          <div className="w-14 h-14 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg shadow-red-200 dark:shadow-none border-2 border-red-400">🧧</div>
          <div>
            <h3 className="font-black text-lg text-red-600 dark:text-red-400 uppercase tracking-wide">Sự kiện Lucky Xu (Lì xì rơi)</h3>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest mt-1">Xuất hiện ngẫu nhiên giữa màn hình trang chủ</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8 relative z-10">
          <div>
            <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest ml-1 mb-2 block">Xu nhận tối thiểu</label>
            <input 
              type="number" min="1"
              value={formData.luckyXu.min} 
              onChange={(e) => setFormData({...formData, luckyXu: {...formData.luckyXu, min: Number(e.target.value)}})}
              className="w-full p-4 bg-gray-50 dark:bg-gray-700 dark:text-white rounded-2xl border-none font-bold text-sm focus:ring-2 focus:ring-red-500 outline-none transition-all" 
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest ml-1 mb-2 block">Xu nhận tối đa</label>
            <input 
              type="number" min="1"
              value={formData.luckyXu.max}
              onChange={(e) => setFormData({...formData, luckyXu: {...formData.luckyXu, max: Number(e.target.value)}})}
              className="w-full p-4 bg-gray-50 dark:bg-gray-700 dark:text-white rounded-2xl border-none font-bold text-sm focus:ring-2 focus:ring-red-500 outline-none transition-all" 
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest ml-1 mb-2 block">Thời gian hiển thị (Giây)</label>
            <input 
              type="number" min="5" max="60"
              value={formData.luckyXu.duration}
              onChange={(e) => setFormData({...formData, luckyXu: {...formData.luckyXu, duration: Number(e.target.value)}})}
              className="w-full p-4 bg-gray-50 dark:bg-gray-700 dark:text-white rounded-2xl border-none font-bold text-sm focus:ring-2 focus:ring-red-500 outline-none transition-all" 
            />
          </div>
        </div>

        <div className="bg-red-50/50 dark:bg-gray-700/30 p-5 rounded-2xl border border-red-100 dark:border-gray-700 relative z-10">
          <label className="text-[10px] font-black uppercase text-red-600 dark:text-red-400 tracking-widest block mb-4">
            Khung giờ xuất hiện Lì xì trong ngày
          </label>
          
          <div className="flex flex-wrap gap-3 mb-4">
            {formData.luckyXu.activeTimes.length === 0 ? (
              <span className="text-xs text-gray-400 italic">Chưa cài đặt khung giờ nào.</span>
            ) : (
              formData.luckyXu.activeTimes.map((time, idx) => (
                <span key={idx} className="px-4 py-2 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-xl text-sm font-black flex items-center gap-3 shadow-sm border border-red-200 dark:border-red-800">
                  ⏰ {time}
                  <button 
                    onClick={() => handleRemoveTime(time)}
                    className="w-5 h-5 bg-red-200 dark:bg-red-800 rounded-full flex items-center justify-center text-red-600 dark:text-red-300 hover:bg-red-500 hover:text-white transition-colors"
                  >
                    ✕
                  </button>
                </span>
              ))
            )}
          </div>
          
          <div className="flex gap-3 items-center">
            <input 
              type="time" 
              value={newTime} 
              onChange={e => setNewTime(e.target.value)} 
              className="p-3 bg-white dark:bg-gray-700 dark:text-white rounded-xl border border-gray-200 dark:border-gray-600 outline-none font-bold focus:ring-2 focus:ring-red-500" 
            />
            <button 
              onClick={handleAddTime} 
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-md transition-all active:scale-95"
            >
              Thêm giờ
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-3 font-bold">Lưu ý: Các khung giờ nên cách nhau ít nhất 2 phút để hệ thống chống spam hoạt động tốt.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* ========================================================= */}
        {/* KHỐI 2: HỘP QUÀ HẰNG NGÀY */}
        {/* ========================================================= */}
        <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-[2.5rem] shadow-sm border border-orange-100 dark:border-orange-900/30 transition-colors">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-orange-500 rounded-xl flex items-center justify-center text-white text-xl shadow-lg border-2 border-orange-300">🎁</div>
            <div>
              <h3 className="font-black text-base text-gray-800 dark:text-white uppercase tracking-wide">Hộp quà hằng ngày</h3>
              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-1">Mỗi khách nhận 1 lần/ngày</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest w-24">Tối thiểu</span>
              <input 
                type="number" min="1"
                value={formData.dailyBox.min} 
                onChange={(e) => setFormData({...formData, dailyBox: {...formData.dailyBox, min: Number(e.target.value)}})}
                className="flex-1 p-3 bg-gray-50 dark:bg-gray-700 dark:text-white rounded-xl border-none font-bold text-sm focus:ring-2 focus:ring-orange-500 text-right outline-none" 
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest w-24">Tối đa</span>
              <input 
                type="number" min="1"
                value={formData.dailyBox.max} 
                onChange={(e) => setFormData({...formData, dailyBox: {...formData.dailyBox, max: Number(e.target.value)}})}
                className="flex-1 p-3 bg-gray-50 dark:bg-gray-700 dark:text-white rounded-xl border-none font-bold text-sm focus:ring-2 focus:ring-orange-500 text-right outline-none" 
              />
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* KHỐI 3: ĐIỂM DANH HẰNG NGÀY */}
        {/* ========================================================= */}
        <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-[2.5rem] shadow-sm border border-blue-100 dark:border-blue-900/30 transition-colors">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center text-white text-xl shadow-lg border-2 border-blue-300">📅</div>
            <div>
              <h3 className="font-black text-base text-gray-800 dark:text-white uppercase tracking-wide">Điểm danh 7 ngày</h3>
              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-1">Hệ thống tự x10 quà vào ngày 7</p>
            </div>
          </div>
          
          <div>
            <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest ml-1 mb-2 block">Xu nhận mỗi ngày (Cơ bản)</label>
            <div className="relative">
              <input 
                type="number" min="1"
                value={formData.attendance.coins} 
                onChange={(e) => setFormData({...formData, attendance: {...formData.attendance, coins: Number(e.target.value)}})}
                className="w-full p-4 bg-gray-50 dark:bg-gray-700 dark:text-white rounded-2xl border-none font-black text-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all pl-12" 
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl">🪙</span>
            </div>
            <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-4 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl">
              👉 Ngày 7 khách sẽ nhận được: <span className="font-black">{formData.attendance.coins * 10} Xu</span>
            </p>
          </div>
        </div>

      </div>

      {/* ========================================================= */}
      {/* NÚT LƯU THAY ĐỔI */}
      {/* ========================================================= */}
      <div className="pt-6">
        <button 
          onClick={handleSaveConfig}
          disabled={isSaving}
          className={`w-full py-5 rounded-[2rem] font-black uppercase tracking-[0.2em] text-xs shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3
            ${isSaving 
              ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed text-white' 
              : 'bg-green-600 hover:bg-green-700 text-white shadow-green-200 dark:shadow-none'}`}
        >
          {isSaving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Đang lưu cấu hình...
            </>
          ) : 'Lưu tất cả sự kiện'}
        </button>
      </div>

    </div>
  );
};

export default ManageEvents;