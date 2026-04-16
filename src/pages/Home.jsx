import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, onSnapshot, getDoc, updateDoc } from 'firebase/firestore'; 
import { db } from '../firebase/config';
import UsernamePopup from '../components/UsernamePopup';
import { useSettings } from '../contexts/SettingsContext'; 
import { getUserByPhone } from '../services/authService'; 

// IMPORT 2 COMPONENT MỚI
import Gamification from '../components/Gamification';
import NotificationCenter from '../components/NotificationCenter';

// --- HÀM KIỂM TRA GIỜ MỞ CỬA ---
const checkIfOpen = (openTimeStr) => {
  if (!openTimeStr || !openTimeStr.includes('-')) return true; // Mặc định mở nếu không parse được
  
  try {
    const now = new Date();
    const currentMin = now.getHours() * 60 + now.getMinutes(); 

    const [startStr, endStr] = openTimeStr.split('-');
    
    const [startH, startM] = startStr.trim().split(':').map(Number);
    const start = (startH || 0) * 60 + (startM || 0);

    const [endH, endM] = endStr.trim().split(':').map(Number);
    const end = (endH || 0) * 60 + (endM || 0);

    return currentMin >= start && currentMin <= end;
  } catch (e) {
    return true;
  }
};

const Home = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useSettings(); 
  
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [hasOrderedBefore, setHasOrderedBefore] = useState(false);
  const [savedPhone, setSavedPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(''); 
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [totalXu, setTotalXu] = useState(0);

  const [isAdminOnline, setIsAdminOnline] = useState(false);

  // MỚI: Thêm canPreOrder vào cấu trúc state
  const [sysConfig, setSysConfig] = useState({
    isOpen: true,
    isActuallyOpen: true, 
    canPreOrder: false,
    openTime: '11:00 - 21:00',
    sysNotice: '',
    preOrderEnabled: false
  });

  // ====================================================
  // STATES CHO SỰ KIỆN LUCKY XU (LÌ XÌ RƠI)
  // ====================================================
  const [luckyConfig, setLuckyConfig] = useState(null);
  const [showLuckyXu, setShowLuckyXu] = useState(false);
  const [isOpeningLuckyXu, setIsOpeningLuckyXu] = useState(false);
  const [luckyReward, setLuckyReward] = useState(null);

  useEffect(() => {
    // 1. Lắng nghe thay đổi Cấu hình hệ thống & Cập nhật logic 2 nút
    const unsubConfig = onSnapshot(doc(db, 'system', 'config'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const actuallyOpen = data.isOpen && checkIfOpen(data.openTime);
        const preOrder = data.isOpen && data.preOrderEnabled;
        
        setSysConfig({ 
          ...data, 
          isActuallyOpen: actuallyOpen,
          canPreOrder: preOrder
        });
      }
    });

    // 1.5 Tạo timer để check giờ mở cửa tự động mỗi phút
    const openStatusTimer = setInterval(() => {
      setSysConfig(prev => {
        const actuallyOpen = prev.isOpen && checkIfOpen(prev.openTime);
        const preOrder = prev.isOpen && prev.preOrderEnabled;
        
        // Chỉ cập nhật state nếu có sự thay đổi để tránh re-render liên tục
        if (prev.isActuallyOpen !== actuallyOpen || prev.canPreOrder !== preOrder) {
          return { ...prev, isActuallyOpen: actuallyOpen, canPreOrder: preOrder };
        }
        return prev;
      });
    }, 60000);

    // 2. Lắng nghe trạng thái Online của Admin
    const unsubAdminStatus = onSnapshot(doc(db, 'system', 'admin_status'), (docSnap) => {
      if (docSnap.exists()) {
        setIsAdminOnline(docSnap.data().isOnline || false);
      }
    });

    // 3. Lắng nghe cấu hình Sự Kiện (Lucky Xu)
    const unsubEvents = onSnapshot(doc(db, 'system', 'events'), (docSnap) => {
      if (docSnap.exists() && docSnap.data().luckyXu) {
        setLuckyConfig(docSnap.data().luckyXu);
      }
    });

    // 4. Logic đồng bộ thông tin khách hàng Real-time
    const syncWithFirebase = async () => {
      const savedPhones = JSON.parse(localStorage.getItem('recentPhones') || '[]');
      const userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
      
      if (savedPhones.length > 0) {
        const phone = savedPhones[0];
        setSavedPhone(phone);
        setHasOrderedBefore(true);

        const cleanPhone = phone.trim();
        const userRef = doc(db, 'users', cleanPhone);

        const unsubUser = onSnapshot(userRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setTotalXu(data.totalXu || data.coins || 0); 
            setAvatarUrl(data.avatarUrl || ''); 
            
            if (data.fullName && data.fullName !== customerName) {
              setCustomerName(data.fullName);
              const updatedProfile = { ...userProfile, fullName: data.fullName, avatarUrl: data.avatarUrl || '' };
              localStorage.setItem('userProfile', JSON.stringify(updatedProfile));
            }
          }
        });

        try {
          if (!userProfile.fullName) {
            const cloudData = await getUserByPhone(cleanPhone);
            if (cloudData) {
              setCustomerName(cloudData.fullName);
              setAvatarUrl(cloudData.avatarUrl || '');
              localStorage.setItem('userProfile', JSON.stringify({
                fullName: cloudData.fullName,
                username: cloudData.username,
                address: cloudData.address,
                avatarUrl: cloudData.avatarUrl || ''
              }));
            }
          } else {
            setCustomerName(userProfile.fullName);
            setAvatarUrl(userProfile.avatarUrl || '');
          }
        } catch (error) {
          handleLogoutCustomer(false); 
        }

        return unsubUser;
      }
    };

    const cleanupUser = syncWithFirebase();

    return () => {
      unsubConfig();
      unsubAdminStatus();
      unsubEvents();
      clearInterval(openStatusTimer);
      if (typeof cleanupUser === 'function') cleanupUser();
    };
  }, []);

  // ====================================================
  // VÒNG LẶP KIỂM TRA GIỜ XUẤT HIỆN LUCKY XU
  // ====================================================
  useEffect(() => {
    if (!luckyConfig || !savedPhone) return;

    const checkTime = async () => {
      if (showLuckyXu || isOpeningLuckyXu || luckyReward !== null) return;

      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      if (luckyConfig.activeTimes && luckyConfig.activeTimes.includes(currentTime)) {
        const todayStr = now.toDateString();
        const timeKey = `${todayStr} ${currentTime}`;
        
        const userSnap = await getDoc(doc(db, 'users', savedPhone));
        if (userSnap.exists() && userSnap.data().lastLuckyReceived !== timeKey) {
          setShowLuckyXu(true);
          
          window.luckyTimeout = setTimeout(() => {
            setShowLuckyXu(false);
          }, (luckyConfig.duration || 15) * 1000);
        }
      }
    };

    const timer = setInterval(checkTime, 10000); 
    return () => {
      clearInterval(timer);
      if (window.luckyTimeout) clearTimeout(window.luckyTimeout);
    };
  }, [luckyConfig, savedPhone, showLuckyXu, isOpeningLuckyXu, luckyReward]);

  // ====================================================
  // HÀM XỬ LÝ KHUI LÌ XÌ
  // ====================================================
  const handleOpenLuckyXu = async () => {
    if (!savedPhone || isOpeningLuckyXu) return;
    
    if (window.luckyTimeout) clearTimeout(window.luckyTimeout);
    
    setIsOpeningLuckyXu(true);

    const userRef = doc(db, 'users', savedPhone);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.exists() ? userSnap.data() : {};

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const timeKey = `${now.toDateString()} ${currentTime}`;

    if (userData.lastLuckyReceived === timeKey) {
      alert("Bạn đã nhận lì xì ở khung giờ này rồi!");
      setIsOpeningLuckyXu(false);
      setShowLuckyXu(false);
      return;
    }

    setTimeout(async () => {
      try {
        const min = luckyConfig.min || 1;
        const max = luckyConfig.max || 300;
        const randomXu = Math.floor(Math.random() * (max - min + 1)) + min;

        const currentXu = userData.totalXu || userData.coins || 0;

        await updateDoc(userRef, {
          totalXu: currentXu + randomXu,
          coins: currentXu + randomXu,
          lastLuckyReceived: timeKey
        });

        setLuckyReward(randomXu);
      } catch (error) {
        console.error("Lỗi khui quà:", error);
        alert("Có lỗi xảy ra, vui lòng thử lại.");
        setShowLuckyXu(false);
      } finally {
        setIsOpeningLuckyXu(false);
      }
    }, 3000);
  };

  const handleLogoutCustomer = (confirm = true) => {
    if (!confirm || window.confirm("Bạn muốn đăng xuất khỏi tài khoản này?")) {
      localStorage.removeItem('recentPhones');
      localStorage.removeItem('userProfile');
      setHasOrderedBefore(false);
      setSavedPhone('');
      setCustomerName('');
      setAvatarUrl('');
      setTotalXu(0);
      window.location.reload(); 
    }
  };

  // Biến để xác định UI tổng thể của Quán (Nếu 1 trong 2 chế độ đang mở thì Quán được coi là Active)
  const isShopActive = sysConfig.isActuallyOpen || sysConfig.canPreOrder;

  return (
    <div className="min-h-screen bg-orange-50/30 dark:bg-gray-900 flex flex-col items-center p-6 font-sans transition-colors duration-300 relative">
      
      {/* THÔNG BÁO TỪ ADMIN */}
      {sysConfig.sysNotice && (
        <div className="w-full max-w-md bg-yellow-100 text-yellow-800 text-[10px] font-bold p-3 rounded-2xl mb-4 text-center shadow-sm animate-in fade-in slide-in-from-top-4">
          <span className="mr-2">📢</span>{sysConfig.sysNotice}
        </div>
      )}

      {/* TOP BAR: THIẾT LẬP & AVATAR */}
      <div className="absolute top-6 left-6 flex gap-3 z-40">
        <div className="relative">
          <button 
            onClick={() => setShowThemeMenu(!showThemeMenu)}
            className="w-10 h-10 flex items-center justify-center bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full shadow-md border border-gray-100 dark:border-gray-700 hover:scale-105 transition-transform"
          >
            {theme === 'light' ? '☀️' : theme === 'dark' ? '🌙' : '💻'}
          </button>
          
          {showThemeMenu && (
            <div className="absolute left-0 mt-2 w-36 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden animate-in fade-in zoom-in-95">
              {[
                { id: 'light', label: '☀️ Giao diện sáng' },
                { id: 'dark', label: '🌙 Giao diện tối' },
                { id: 'system', label: '💻 Theo hệ thống' }
              ].map(tOption => (
                <button 
                  key={tOption.id} 
                  onClick={() => { setTheme(tOption.id); setShowThemeMenu(false); }}
                  className={`w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-colors ${theme === tOption.id ? 'bg-orange-50 dark:bg-gray-700 text-orange-600 dark:text-orange-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                >
                  {tOption.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="absolute top-6 right-6 flex gap-3 z-40">
        {hasOrderedBefore && <NotificationCenter />}

        {hasOrderedBefore && (
          <button 
            onClick={() => navigate('/settings')}
            className="w-12 h-12 flex items-center justify-center bg-white dark:bg-gray-800 rounded-full shadow-md border border-gray-100 dark:border-gray-700 hover:scale-105 transition-transform overflow-hidden"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            )}
          </button>
        )}
      </div>

      {/* HEADER LOGO */}
      <div className={`w-full max-w-md mt-24 mb-8 text-center transition-all duration-500 ${isShopActive ? '' : 'grayscale opacity-70'}`}>
        <div className="relative inline-block">
          <div className={`w-28 h-28 ${isShopActive ? 'bg-orange-500' : 'bg-gray-500'} rounded-full flex items-center justify-center shadow-2xl shadow-orange-200 dark:shadow-none border-4 border-white dark:border-gray-800 transition-colors`}>
            <span className="text-5xl">🍱</span>
          </div>
          {sysConfig.isActuallyOpen ? (
            <div className="absolute -top-2 -right-4 bg-red-600 text-white text-[10px] font-black px-3 py-1 rounded-lg rotate-12 shadow-md">
              HOT!
            </div>
          ) : sysConfig.canPreOrder ? (
            <div className="absolute -top-2 -right-6 bg-blue-600 text-white text-[10px] font-black px-3 py-1 rounded-lg rotate-12 shadow-md">
              ĐẶT TRƯỚC
            </div>
          ) : (
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] bg-gray-900 text-white text-xs font-black px-3 py-2 rounded-lg -rotate-12 shadow-md border-2 border-white uppercase tracking-widest whitespace-nowrap animate-pulse">
              ĐÃ ĐÓNG CỬA
            </div>
          )}
        </div>
        
        <div className="mt-6">
          <h1 className="text-4xl font-black text-gray-800 dark:text-gray-100 tracking-tighter leading-none transition-colors">
            CƠM TẤM VINHOMES <br/>
            <span className={`${isShopActive ? 'text-orange-600' : 'text-gray-500'} text-2xl uppercase italic`}>Kitchen House</span>
          </h1>
          <div className="flex justify-center gap-1 mt-3">
            {[1,2,3,4,5].map(i => <span key={i} className="text-yellow-500 text-sm">⭐</span>)}
          </div>
        </div>
      </div>

      {/* CUSTOMER GREETING & XU REWARDS */}
      <div className="w-full max-w-xs mb-8 flex flex-col items-center z-10">
        {hasOrderedBefore ? (
          <>
            <div className="w-full bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-orange-100 dark:border-gray-700 text-center relative overflow-hidden transition-colors group">
              <div className="absolute top-0 right-0 w-12 h-12 bg-orange-50 dark:bg-gray-700 rounded-bl-full opacity-50 transition-all group-hover:scale-150"></div>
              
              <p className="text-[10px] font-black text-orange-400 uppercase tracking-[0.2em] mb-1">Thành viên thân thiết</p>
              <h2 className="text-lg font-black text-gray-800 dark:text-white truncate transition-colors">
                  Chào mừng {customerName || 'Bạn'}!
              </h2>
              <p className="text-xs text-gray-400 font-bold mb-4">{savedPhone}</p>
              
              <button 
                onClick={() => handleLogoutCustomer()}
                className="text-[10px] font-black text-red-500 border border-red-100 dark:border-red-900/50 px-4 py-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors uppercase tracking-widest"
              >
                Đăng xuất
              </button>
            </div>

            <div className="w-full mt-4">
              <button 
                onClick={() => navigate('/rewards')}
                className="w-full bg-gradient-to-r from-orange-400 to-red-500 p-4 rounded-2xl flex items-center justify-between shadow-lg shadow-orange-200 dark:shadow-none active:scale-95 transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl drop-shadow-md">🪙</span>
                  <div className="text-left">
                    <p className="text-[9px] font-black text-white/80 uppercase leading-none">Xu Plant G của bạn</p>
                    <p className="text-sm font-black text-white mt-1">{totalXu.toLocaleString()} Xu</p>
                  </div>
                </div>
                <span className="bg-white/20 text-white text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest backdrop-blur-sm">Đổi quà →</span>
              </button>
            </div>
          </>
        ) : (
          <div className="text-center">
            <p className="text-sm text-gray-400 dark:text-gray-400 font-medium italic transition-colors mb-2">
              "Cơm dẻo, sườn thơm, đậm đà vị nhà"
            </p>
          </div>
        )}
      </div>

      {/* ACTION BUTTONS */}
      <div className="w-full max-w-xs space-y-4 z-10">
        
        {/* NÚT 1: ĐẶT CƠM NGAY */}
        <button
          onClick={() => {
            if (!sysConfig.isActuallyOpen) return alert(`Quán hiện chưa tới giờ nhận đơn giao ngay.\nGiờ mở cửa: ${sysConfig.openTime || '11:00 - 21:00'}`);
            hasOrderedBefore ? navigate(`/order?user=${savedPhone}`) : setIsPopupOpen(true);
          }}
          className={`w-full ${sysConfig.isActuallyOpen ? 'bg-gray-800 dark:bg-orange-600 hover:bg-black dark:hover:bg-orange-700 shadow-xl shadow-gray-200 dark:shadow-none' : 'bg-gray-400 cursor-not-allowed'} text-white font-black py-5 rounded-2xl transition-all active:scale-95 flex justify-center items-center gap-3 uppercase text-sm tracking-widest`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
          {sysConfig.isActuallyOpen ? 'ĐẶT CƠM NGAY' : 'CHƯA TỚI GIỜ MỞ CỬA'}
        </button>

        {/* NÚT 2: ĐẶT GIAO SAU */}
        {sysConfig.canPreOrder && (
          <button
            onClick={() => hasOrderedBefore ? navigate(`/order?user=${savedPhone}&type=schedule`) : setIsPopupOpen(true)}
            className="w-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 font-black py-4 rounded-2xl transition-all active:scale-95 flex justify-center items-center gap-3 uppercase text-xs tracking-widest border border-orange-200 dark:border-orange-800 hover:bg-orange-200 dark:hover:bg-orange-900/50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Đặt giao sau (Hẹn giờ)
          </button>
        )}

        <button
          onClick={() => navigate(hasOrderedBefore ? `/checkorder?user=${savedPhone}` : '/checkorder')}
          className="w-full bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 text-gray-800 dark:text-orange-400 hover:bg-gray-50 dark:hover:bg-gray-700 font-black py-5 rounded-2xl transition-all active:scale-95 flex justify-center items-center gap-3 uppercase text-sm tracking-widest"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
          KIỂM TRA ĐƠN HÀNG
        </button>

        {!hasOrderedBefore && (
          <div className="flex gap-4 pt-2">
            <button
              onClick={() => setIsPopupOpen(true)}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-lg shadow-blue-200 dark:shadow-none transition-all active:scale-95 uppercase text-[11px] tracking-widest"
            >
              ĐĂNG NHẬP
            </button>
            <button
              onClick={() => navigate('/dangky')}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-orange-200 dark:shadow-none transition-all active:scale-95 uppercase text-[11px] tracking-widest"
            >
              ĐĂNG KÝ
            </button>
          </div>
        )}
      </div>

      {hasOrderedBefore && <Gamification />}

      <div className="mt-auto pt-10 pb-6 text-center w-full flex flex-col items-center z-10">
        <div className="flex items-center justify-center gap-2 mb-4 bg-white/50 dark:bg-gray-800/50 px-4 py-2 rounded-full border border-gray-100 dark:border-gray-700 shadow-sm backdrop-blur-sm">
          <div className="relative flex h-2.5 w-2.5">
            {isAdminOnline && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            )}
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isAdminOnline ? 'bg-green-500' : 'bg-gray-400'}`}></span>
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
            Hỗ trợ: {isAdminOnline ? 'Trực tuyến' : 'Ngoại tuyến'}
          </span>
        </div>

        <p className="text-[10px] font-black text-orange-200 dark:text-gray-600 uppercase tracking-[0.3em] transition-colors">
          Open: {sysConfig.openTime || '11:00 - 21:00'}
        </p>
        <div className="mt-2 text-gray-200 dark:text-gray-700 transition-colors">••••••••••••</div>
      </div>

      {/* ========================================================= */}
      {/* OVERLAY GIAO DIỆN SỰ KIỆN LUCKY XU */}
      {/* ========================================================= */}
      {showLuckyXu && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          {luckyReward === null ? (
            <div 
              onClick={!isOpeningLuckyXu ? handleOpenLuckyXu : undefined}
              className={`relative cursor-pointer transition-all duration-500 ${isOpeningLuckyXu ? 'animate-bounce scale-110' : 'hover:scale-105 animate-in zoom-in'}`}
            >
              <div className="w-48 h-64 bg-gradient-to-b from-red-500 to-red-700 rounded-2xl shadow-2xl border-4 border-yellow-400 flex flex-col items-center justify-center text-white overflow-hidden relative">
                {/* Lớp mờ rải hạt trang trí */}
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-yellow-300 via-transparent to-transparent"></div>
                
                <div className="w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center text-red-600 text-3xl font-black mb-4 shadow-inner border-2 border-yellow-200 z-10">福</div>
                <p className="font-black text-center px-4 uppercase tracking-tighter z-10 text-yellow-300 drop-shadow-md text-lg leading-tight">Lucky Xu<br/>Đang Rơi!</p>
                <p className="text-[10px] mt-4 opacity-90 uppercase font-black tracking-widest bg-black/20 px-3 py-1 rounded-full z-10">Chạm để mở</p>
              </div>
              
              {isOpeningLuckyXu && (
                <div className="absolute -top-12 left-0 right-0 text-center text-yellow-400 font-black tracking-widest uppercase text-xs animate-pulse drop-shadow-lg">
                  Đang khui quà...
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] text-center animate-in zoom-in duration-300 shadow-2xl border border-yellow-100 dark:border-gray-700 max-w-xs w-full mx-4 relative overflow-hidden">
              <div className="absolute -top-10 -right-10 text-9xl opacity-10">🧧</div>
              <h2 className="text-5xl mb-4 relative z-10">🎉</h2>
              <p className="text-gray-500 dark:text-gray-400 font-black uppercase text-[10px] tracking-[0.2em] relative z-10">Bạn đã mở được</p>
              <p className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-500 my-4 drop-shadow-sm relative z-10">
                +{luckyReward} Xu
              </p>
              <button 
                onClick={() => {
                  setShowLuckyXu(false); 
                  setLuckyReward(null);
                }} 
                className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl relative z-10"
              >
                Tuyệt vời
              </button>
            </div>
          )}
        </div>
      )}

      <UsernamePopup 
        isOpen={isPopupOpen} 
        onClose={() => setIsPopupOpen(false)} 
      />
    </div>
  );
};

export default Home;