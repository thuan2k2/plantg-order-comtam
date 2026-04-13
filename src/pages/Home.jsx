import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore'; 
import { db } from '../firebase/config';
import UsernamePopup from '../components/UsernamePopup';
import { useSettings } from '../contexts/SettingsContext'; 
import { getUserByPhone } from '../services/authService'; 

const Home = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useSettings(); 
  
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [hasOrderedBefore, setHasOrderedBefore] = useState(false);
  const [savedPhone, setSavedPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(''); // MỚI: State lưu trữ Avatar
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  const [totalXu, setTotalXu] = useState(0);

  const [sysConfig, setSysConfig] = useState({
    isOpen: true,
    openTime: '11:00 - 21:00',
    sysNotice: ''
  });

  useEffect(() => {
    // 1. Lắng nghe thay đổi Cấu hình hệ thống
    const unsubConfig = onSnapshot(doc(db, 'system', 'config'), (doc) => {
      if (doc.exists()) {
        setSysConfig(doc.data());
      }
    }, (error) => {
      console.error("Lỗi lắng nghe cấu hình:", error);
    });

    // 2. Logic đồng bộ thông tin khách hàng Real-time
    const syncWithFirebase = async () => {
      const savedPhones = JSON.parse(localStorage.getItem('recentPhones') || '[]');
      const userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
      
      if (savedPhones.length > 0) {
        const phone = savedPhones[0];
        setSavedPhone(phone);
        setHasOrderedBefore(true);

        const cleanPhone = phone.trim();
        const userRef = doc(db, 'users', cleanPhone);

        // FIX ĐỒNG BỘ: Lắng nghe toàn bộ thay đổi của user bao gồm cả avatarUrl
        const unsubUser = onSnapshot(userRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setTotalXu(data.totalXu || 0); 
            setAvatarUrl(data.avatarUrl || ''); // Cập nhật Avatar lập tức
            
            if (data.fullName && data.fullName !== customerName) {
              setCustomerName(data.fullName);
              
              // Cập nhật local storage để dự phòng
              const updatedProfile = { ...userProfile, fullName: data.fullName, avatarUrl: data.avatarUrl || '' };
              localStorage.setItem('userProfile', JSON.stringify(updatedProfile));
            }
          }
        }, (err) => {
          console.error("Lỗi đồng bộ dữ liệu User:", err);
        });

        // Load dữ liệu nền (fallback)
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
          alert(error.message);
          handleLogoutCustomer(false); 
        }

        return unsubUser;
      }
    };

    const cleanupUser = syncWithFirebase();

    return () => {
      unsubConfig();
      if (typeof cleanupUser === 'function') cleanupUser();
    };
  }, []);

  const handleLogoutCustomer = (confirm = true) => {
    if (!confirm || window.confirm("Bạn muốn đặt hàng bằng số điện thoại khác?")) {
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

  const handleOrderClick = () => {
    if (!sysConfig.isOpen) {
      alert("Quán hiện đang đóng cửa, bạn vui lòng quay lại sau nhé!");
      return;
    }
    hasOrderedBefore ? navigate(`/order?user=${savedPhone}`) : setIsPopupOpen(true);
  };

  return (
    <div className="min-h-screen bg-orange-50/30 dark:bg-gray-900 flex flex-col items-center p-6 font-sans transition-colors duration-300">
      
      {/* THÔNG BÁO TỪ ADMIN */}
      {sysConfig.sysNotice && (
        <div className="w-full max-w-md bg-yellow-100 text-yellow-800 text-[10px] font-bold p-3 rounded-2xl mb-4 text-center shadow-sm animate-in fade-in slide-in-from-top-4">
          <span className="mr-2">📢</span>{sysConfig.sysNotice}
        </div>
      )}

      {/* TOP BAR: THIẾT LẬP & AVATAR */}
      <div className="absolute top-6 right-6 flex gap-3 z-50">
        {hasOrderedBefore && (
          <button 
            onClick={() => navigate('/settings')}
            className="w-10 h-10 flex items-center justify-center bg-white dark:bg-gray-800 rounded-full shadow-md border border-gray-100 dark:border-gray-700 hover:scale-105 transition-transform overflow-hidden"
            title="Cài đặt tài khoản"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            )}
          </button>
        )}

        <div className="relative">
          <button 
            onClick={() => setShowThemeMenu(!showThemeMenu)}
            className="w-10 h-10 flex items-center justify-center bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full shadow-md border border-gray-100 dark:border-gray-700 hover:scale-105 transition-transform"
          >
            {theme === 'light' ? '☀️' : theme === 'dark' ? '🌙' : '💻'}
          </button>
          
          {showThemeMenu && (
            <div className="absolute right-0 mt-2 w-36 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden animate-in fade-in zoom-in-95">
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

      {/* HEADER LOGO */}
      <div className={`w-full max-w-md mt-24 mb-8 text-center transition-all duration-500 ${sysConfig.isOpen ? '' : 'grayscale opacity-70'}`}>
        <div className="relative inline-block">
          <div className={`w-28 h-28 ${sysConfig.isOpen ? 'bg-orange-500' : 'bg-gray-500'} rounded-full flex items-center justify-center shadow-2xl shadow-orange-200 dark:shadow-none border-4 border-white dark:border-gray-800 transition-colors`}>
            <span className="text-5xl">🍱</span>
          </div>
          {sysConfig.isOpen ? (
            <div className="absolute -top-2 -right-4 bg-red-600 text-white text-[10px] font-black px-3 py-1 rounded-lg rotate-12 shadow-md">
              HOT!
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
            <span className={`${sysConfig.isOpen ? 'text-orange-600' : 'text-gray-500'} text-2xl uppercase italic`}>Kitchen House</span>
          </h1>
          <div className="flex justify-center gap-1 mt-3">
            {[1,2,3,4,5].map(i => <span key={i} className="text-yellow-500 text-sm">⭐</span>)}
          </div>
        </div>
      </div>

      {/* CUSTOMER GREETING & XU REWARDS */}
      <div className="w-full max-w-xs mb-10 flex flex-col items-center">
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
                onClick={handleLogoutCustomer}
                className="text-[10px] font-black text-red-500 border border-red-100 dark:border-red-900/50 px-4 py-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors uppercase tracking-widest"
              >
                Đổi số khác
              </button>
            </div>

            {/* NÚT ĐỔI THƯỞNG XU */}
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
            <p className="text-sm text-gray-400 dark:text-gray-400 font-medium italic transition-colors">
              "Cơm dẻo, sườn thơm, đậm đà vị nhà"
            </p>
          </div>
        )}
      </div>

      {/* ACTION BUTTONS (Đã Cấu Trúc Lại Cân Đối) */}
      <div className="w-full max-w-xs space-y-4">
        
        {/* Nút 1: Đặt Cơm (To) */}
        <button
          onClick={handleOrderClick}
          className={`w-full ${sysConfig.isOpen ? 'bg-gray-800 dark:bg-orange-600 hover:bg-black dark:hover:bg-orange-700 shadow-xl shadow-gray-200 dark:shadow-none' : 'bg-gray-400 cursor-not-allowed'} text-white font-black py-5 rounded-2xl transition-all active:scale-95 flex justify-center items-center gap-3 uppercase text-sm tracking-widest`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
          {sysConfig.isOpen ? 'ĐẶT CƠM NGAY' : 'TẠM ĐÓNG CỬA'}
        </button>

        {/* Nút 2: Kiểm Tra Đơn Hàng (To) */}
        <button
          onClick={() => navigate(hasOrderedBefore ? `/checkorder?user=${savedPhone}` : '/checkorder')}
          className="w-full bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 text-gray-800 dark:text-orange-400 hover:bg-gray-50 dark:hover:bg-gray-700 font-black py-5 rounded-2xl transition-all active:scale-95 flex justify-center items-center gap-3 uppercase text-sm tracking-widest"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
          KIỂM TRA ĐƠN HÀNG
        </button>

        {/* Nút 3 & 4: Đăng Nhập & Đăng Ký (Chia đôi nằm ngang) */}
        {!hasOrderedBefore && (
          <div className="flex gap-4">
            <button
              onClick={() => setIsPopupOpen(true)}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-2xl shadow-lg shadow-blue-200 dark:shadow-none transition-all active:scale-95 uppercase text-xs tracking-widest"
            >
              ĐĂNG NHẬP
            </button>
            <button
              onClick={() => navigate('/dangky')}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-black py-5 rounded-2xl shadow-lg shadow-orange-200 dark:shadow-none transition-all active:scale-95 uppercase text-xs tracking-widest"
            >
              ĐĂNG KÝ
            </button>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div className="mt-auto pt-10 pb-6 text-center">
        <p className="text-[10px] font-black text-orange-200 dark:text-gray-600 uppercase tracking-[0.3em] transition-colors">
          Open: {sysConfig.openTime || '11:00 - 21:00'}
        </p>
        <div className="mt-2 text-gray-200 dark:text-gray-700 transition-colors">••••••••••••</div>
      </div>

      <UsernamePopup 
        isOpen={isPopupOpen} 
        onClose={() => setIsPopupOpen(false)} 
      />
    </div>
  );
};

export default Home;