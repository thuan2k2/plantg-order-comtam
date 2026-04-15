import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { claimDailyReward, claimDailyCheckIn } from '../services/chatService';

const Gamification = () => {
  const [userData, setUserData] = useState(null);
  const [isGiftLoading, setIsGiftLoading] = useState(false);
  const [isCheckInLoading, setIsCheckInLoading] = useState(false);
  
  // Trạng thái hiển thị Popup
  const [showCalendar, setShowCalendar] = useState(false);
  const [rewardMessage, setRewardMessage] = useState(null);

  // Lấy SĐT từ localStorage (giống cách Home.jsx đang làm)
  const phone = JSON.parse(localStorage.getItem('recentPhones') || '[]')[0];

  // 1. Lắng nghe Real-time dữ liệu User
  useEffect(() => {
    if (!phone) return;
    const unsub = onSnapshot(doc(db, 'users', phone), (doc) => {
      if (doc.exists()) {
        setUserData(doc.data());
      }
    });
    return () => unsub();
  }, [phone]);

  // 2. Logic tính toán ngày mới (GMT+7) ở Frontend để hiển thị/ẩn Icon
  const checkAvailableToday = (timestamp) => {
    if (!timestamp) return true; // Chưa từng nhận
    
    // Ép kiểu giờ Việt Nam để so sánh ngày
    const options = { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' };
    const date = new Date(timestamp.toDate()); // Firestore timestamp to JS Date
    
    const lastActionStr = date.toLocaleDateString('en-GB', options);
    const todayStr = new Date().toLocaleDateString('en-GB', options);
    
    return lastActionStr !== todayStr;
  };

  const canClaimGift = checkAvailableToday(userData?.lastDailyGift);
  const canCheckIn = checkAvailableToday(userData?.lastCheckIn);
  const currentStreak = userData?.checkInStreak || 0;

  // 3. Gọi API Hộp Quà (Backend)
  const handleOpenGift = async () => {
    if (isGiftLoading || !canClaimGift) return;
    setIsGiftLoading(true);
    
    try {
      const result = await claimDailyReward(phone);
      // Hiển thị thông báo
      setRewardMessage(`🎉 Chúc mừng! Bạn nhận được ${result.reward} xu từ hộp quà bí ẩn.`);
      
      // Tự động tắt thông báo sau 3 giây
      setTimeout(() => setRewardMessage(null), 3000);
    } catch (error) {
      // Bắt lỗi từ Cloud Functions (ví dụ: đã nhận rồi do spam click)
      alert(error.message || "Có lỗi xảy ra, vui lòng thử lại.");
    } finally {
      setIsGiftLoading(false);
    }
  };

  // 4. Gọi API Điểm danh (Backend)
  const handleCheckIn = async () => {
    if (isCheckInLoading || !canCheckIn) return;
    setIsCheckInLoading(true);
    
    try {
      const result = await claimDailyCheckIn(phone);
      setRewardMessage(`📅 Điểm danh ngày ${result.streak} thành công! Nhận ${result.reward} xu.`);
      setTimeout(() => setRewardMessage(null), 3000);
      
      // Có thể đóng lịch sau khi điểm danh thành công
      // setShowCalendar(false); 
    } catch (error) {
      alert(error.message || "Có lỗi xảy ra, vui lòng thử lại.");
    } finally {
      setIsCheckInLoading(false);
    }
  };

  if (!phone) return null;

  return (
    <>
      {/* CỤM NÚT NỔI Ở GÓC DƯỚI BÊN TRÁI */}
      <div className="fixed bottom-24 left-6 flex flex-col gap-4 z-40">
        
        {/* Nút 1: Hộp Quà Bí Ẩn */}
        {canClaimGift && (
          <button 
            onClick={handleOpenGift}
            disabled={isGiftLoading}
            className="group relative w-14 h-14 bg-gradient-to-tr from-yellow-400 to-orange-500 rounded-2xl shadow-xl flex items-center justify-center text-3xl animate-bounce hover:scale-110 active:scale-95 transition-all"
            title="Mở hộp quà hàng ngày"
          >
            {isGiftLoading ? <span className="animate-spin text-white text-sm">⏳</span> : '🎁'}
            
            {/* Hiệu ứng chấm đỏ nhấp nháy */}
            <span className="absolute -top-2 -right-2 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-white"></span>
            </span>
          </button>
        )}

        {/* Nút 2: Lịch Điểm Danh */}
        <button 
          onClick={() => setShowCalendar(true)}
          className={`relative w-14 h-14 rounded-2xl shadow-xl flex flex-col items-center justify-center border-2 transition-all hover:scale-105 active:scale-95 ${
            canCheckIn ? 'bg-white border-blue-500' : 'bg-gray-100 border-gray-300 opacity-80'
          }`}
          title="Điểm danh 7 ngày"
        >
          <span className={`text-[10px] font-black uppercase leading-none ${canCheckIn ? 'text-blue-500' : 'text-gray-400'}`}>
            Ngày {currentStreak}
          </span>
          <span className="text-xl mt-0.5">{canCheckIn ? '📅' : '✅'}</span>
          
          {canCheckIn && (
             <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-[9px] font-bold flex items-center justify-center rounded-full border-2 border-white shadow-sm">!</span>
          )}
        </button>
      </div>

      {/* ========================================= */}
      {/* POPUP: BẢNG LỊCH ĐIỂM DANH 7 NGÀY */}
      {/* ========================================= */}
      {showCalendar && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200" 
          onClick={() => setShowCalendar(false)}
        >
          <div 
            className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[2rem] p-6 shadow-2xl relative" 
            onClick={e => e.stopPropagation()} // Chặn click xuyên thấu
          >
            <button 
              onClick={() => setShowCalendar(false)} 
              className="absolute top-4 right-4 w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              ✕
            </button>
            
            <div className="text-center mb-6">
              <h2 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-wide">Điểm danh 7 ngày</h2>
              <p className="text-xs font-bold text-gray-500 mt-1">Duy trì chuỗi để nhận 100 xu vào ngày 7!</p>
            </div>

            {/* Grid hiển thị 7 ngày */}
            <div className="grid grid-cols-4 gap-3 mb-6">
              {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                const isClaimed = day <= currentStreak;
                const isToday = day === currentStreak + 1;
                const isLastDay = day === 7;
                const reward = isLastDay ? 100 : 10;

                return (
                  <div key={day} className={`relative flex flex-col items-center justify-center py-3 rounded-2xl border-2 transition-all ${
                    isClaimed ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' :
                    isToday && canCheckIn ? 'bg-yellow-50 border-yellow-400 animate-pulse shadow-md shadow-yellow-100 dark:shadow-none' : 
                    'bg-gray-50 border-transparent dark:bg-gray-700'
                  } ${isLastDay ? 'col-span-4 flex-row gap-4 py-4' : ''}`}>
                    
                    <span className="text-[10px] font-black text-gray-400 uppercase">Ngày {day}</span>
                    <span className="font-bold text-gray-800 dark:text-white my-1 text-lg">
                      {isClaimed ? '✅' : `+${reward}`}
                    </span>
                    <span className="text-[8px] font-bold text-yellow-500 uppercase tracking-widest">Xu</span>
                    
                  </div>
                );
              })}
            </div>

            {/* Nút Hành động */}
            <button 
              onClick={handleCheckIn}
              disabled={!canCheckIn || isCheckInLoading}
              className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-lg active:scale-95 ${
                canCheckIn 
                  ? 'bg-blue-600 text-white shadow-blue-200 dark:shadow-none hover:bg-blue-700' 
                  : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed shadow-none'
              }`}
            >
              {isCheckInLoading ? 'Đang xử lý...' : canCheckIn ? 'Điểm danh ngay' : 'Đã điểm danh hôm nay'}
            </button>
          </div>
        </div>
      )}

      {/* ========================================= */}
      {/* TOAST MESSAGE: THÔNG BÁO NHẬN THƯỞNG */}
      {/* ========================================= */}
      {rewardMessage && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-top-4 fade-in duration-300 pointer-events-none">
          <div className="bg-gray-900/95 backdrop-blur-md text-white px-6 py-4 rounded-2xl shadow-2xl border border-gray-700 flex items-center gap-3">
            <span className="text-sm font-bold tracking-wide">{rewardMessage}</span>
          </div>
        </div>
      )}
    </>
  );
};

export default Gamification;