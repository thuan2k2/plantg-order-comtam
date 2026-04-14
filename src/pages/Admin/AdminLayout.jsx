import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'; 
import { db } from '../../firebase/config'; 
import { logoutAdmin } from '../../services/authService';
import { subscribeToAdminChats } from '../../services/chatService'; 
import { useSettings } from '../../contexts/SettingsContext'; 

const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const { viewMode, setViewMode } = useSettings();
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [unreadChatCount, setUnreadChatCount] = useState(0); 

  // --- MỚI: THEO DÕI TRẠNG THÁI ONLINE/OFFLINE CỦA ADMIN ---
  useEffect(() => {
    const adminStatusRef = doc(db, 'system', 'admin_status');
    
    // 1. Khi Component mount (Admin vào trang), set isOnline = true
    const setOnline = async () => {
      try {
        await setDoc(adminStatusRef, { 
          isOnline: true, 
          lastActive: serverTimestamp() 
        }, { merge: true });
      } catch (error) {
        console.error("Lỗi cập nhật trạng thái Online:", error);
      }
    };
    setOnline();

    // 2. Hàm set Offline
    const setOffline = () => {
      // Dùng sendBeacon nếu có thể để đảm bảo chạy khi tab bị tắt
      const data = JSON.stringify({ isOnline: false });
      const blob = new Blob([data], { type: 'application/json' });
      // LƯU Ý: Đây là phương pháp dự phòng nâng cao (không bắt buộc, nhưng Firebase API đôi khi không kịp chạy lúc tắt tab)
      // Trong mô hình này, ta gọi Firebase updateDoc trước
      setDoc(adminStatusRef, { isOnline: false, lastActive: serverTimestamp() }, { merge: true }).catch(e => console.log(e));
    };

    // 3. Lắng nghe sự kiện người dùng đóng tab / tải lại trang
    window.addEventListener('beforeunload', setOffline);
    
    // Cleanup: Khi Admin nhấn Logout hoặc rời khỏi trang React Router
    return () => {
      setOffline();
      window.removeEventListener('beforeunload', setOffline);
    };
  }, []);

  // --- LẮNG NGHE CHAT ---
  useEffect(() => {
    const unsub = subscribeToAdminChats((chats) => {
      const count = chats.filter(c => c.unreadAdmin).length;
      setUnreadChatCount(count);
    });
    return () => unsub();
  }, []);

  // --- QUẢN LÝ SIDEBAR THEO VIEWMODE ---
  useEffect(() => {
    if (viewMode === 'mobile') setIsSidebarOpen(false);
    else setIsSidebarOpen(true); 
  }, [viewMode]);

  const isActive = (path) => location.pathname === path;

  const handleLogout = async () => {
    if (window.confirm("Bạn có chắc chắn muốn thoát quyền Quản trị viên không?")) {
      try {
        // Cập nhật trạng thái offline trước khi logout
        const adminStatusRef = doc(db, 'system', 'admin_status');
        await setDoc(adminStatusRef, { isOnline: false, lastActive: serverTimestamp() }, { merge: true });

        const result = await logoutAdmin();
        if (result.success) {
          navigate('/admin/login');
        } else {
          alert("Lỗi khi đăng xuất: " + result.error);
        }
      } catch (error) {
        console.error("Logout Error:", error);
        navigate('/admin/login');
      }
    }
  };

  const menuItems = [
    { path: '/admin', label: 'Tổng quan', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
    )},
    { path: '/admin/orders', label: 'Đơn hôm nay', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
    )},
    { 
      path: '/admin/chat', 
      label: 'Hỗ trợ khách', 
      isChat: true, 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
    )},
    { path: '/admin/statistics', label: 'Thống kê', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
    )},
    { path: '/admin/menu', label: 'Thực đơn', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
    )},
    { path: '/admin/vouchers', label: 'Quản lý Voucher', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>
    )},
    { path: '/admin/users', label: 'Khách hàng', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
    )},
    { path: '/admin/settings', label: 'Cài đặt hệ thống', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
    )}
  ];

  return (
    <div className={`min-h-screen bg-gray-50 flex overflow-hidden transition-all duration-300
      ${viewMode === 'mobile' ? 'max-w-[480px] mx-auto shadow-2xl border-x border-gray-200' : 'w-full'}`}
    >
      
      {/* SIDEBAR */}
      <aside 
        className={`bg-gray-900 text-white flex flex-col sticky top-0 h-screen transition-all duration-300 ease-in-out z-50 shadow-2xl
          ${isSidebarOpen ? 'w-64' : 'w-20'}
          ${viewMode === 'mobile' ? 'fixed inset-y-0 left-0 transform' : ''}
          ${viewMode === 'mobile' && !isSidebarOpen ? '-translate-x-full' : 'translate-x-0'}
        `}
      >
        <div className={`p-6 border-b border-gray-800 flex items-center ${isSidebarOpen ? 'justify-between' : 'justify-center'}`}>
          {isSidebarOpen && (
            <div className="animate-in fade-in slide-in-from-left-2 duration-500">
              <h2 className="text-xl font-black text-orange-500 tracking-tighter leading-none">PLANT G</h2>
              <p className="text-[8px] text-gray-500 font-bold uppercase tracking-[0.3em] mt-1">Hệ thống Admin</p>
            </div>
          )}
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-gray-800 rounded-xl transition-all active:scale-90"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-2 mt-4 overflow-y-auto no-scrollbar">
          {menuItems.map((item) => (
            <Link 
              key={item.path}
              to={item.path} 
              onClick={() => viewMode === 'mobile' && setIsSidebarOpen(false)} // Đóng menu sau khi chọn ở Mobile
              className={`flex items-center gap-4 px-4 py-4 rounded-2xl font-bold text-sm transition-all group relative
                ${isActive(item.path) 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' 
                  : 'text-gray-500 hover:bg-gray-800 hover:text-white'}`}
            >
              <div className={`transition-transform duration-300 ${!isSidebarOpen && 'mx-auto scale-110'}`}>
                {item.icon}
              </div>
              
              {isSidebarOpen && (
                <span className="text-[11px] font-black uppercase tracking-widest whitespace-nowrap animate-in fade-in slide-in-from-left-2">
                  {item.label}
                </span>
              )}

              {/* BADGE THÔNG BÁO TIN NHẮN MỚI */}
              {item.isChat && unreadChatCount > 0 && (
                <span className={`absolute bg-red-500 text-white text-[9px] font-black flex items-center justify-center rounded-full animate-bounce shadow-lg
                  ${isSidebarOpen ? 'right-4 w-5 h-5' : 'top-2 right-2 w-4 h-4'}`}
                >
                  {unreadChatCount}
                </span>
              )}

              {!isSidebarOpen && (
                <div className="absolute left-full ml-4 px-3 py-2 bg-gray-800 text-white text-[9px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                  {item.label}
                </div>
              )}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-800">
          <button 
            onClick={handleLogout}
            className={`flex items-center gap-4 text-red-400 hover:bg-red-500/10 w-full px-4 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all
              ${!isSidebarOpen && 'justify-center'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            {isSidebarOpen && <span>Thoát hệ thống</span>}
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="bg-white/80 backdrop-blur-md h-20 flex items-center justify-between px-4 sm:px-8 z-20 border-b border-gray-100">
          
          <div className="flex items-center gap-3">
            {/* Nút Hamburger hiện ra ở chế độ Mobile Force */}
            {viewMode === 'mobile' && (
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 bg-gray-100 text-gray-600 rounded-xl"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
            )}

            <div className="flex flex-col">
              <h1 className="text-xs sm:text-sm font-black text-gray-800 uppercase tracking-tighter truncate max-w-[150px] sm:max-w-[300px]">
                {isActive('/admin') && 'Bảng điều khiển'}
                {isActive('/admin/orders') && 'Quản lý đơn bếp'}
                {isActive('/admin/chat') && 'Hỗ trợ trực tuyến'}
                {isActive('/admin/statistics') && 'Báo cáo & Thống kê'}
                {isActive('/admin/vouchers') && 'Kho Voucher'}
                {isActive('/admin/users') && 'Khách hàng'}
                {isActive('/admin/menu') && 'Thực đơn'}
                {isActive('/admin/settings') && 'Cài đặt hệ thống'}
              </h1>
              <p className="text-[8px] sm:text-[9px] text-green-500 font-bold uppercase tracking-widest mt-0.5 truncate flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                Đang trực tuyến
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* NÚT CHUYỂN ĐỔI CHẾ ĐỘ HIỂN THỊ */}
            <button 
              onClick={() => setViewMode(viewMode === 'auto' || viewMode === 'desktop' ? 'mobile' : 'desktop')}
              className={`hidden md:flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all shadow-sm border
                ${viewMode === 'mobile' 
                  ? 'bg-blue-600 text-white border-blue-500 hover:bg-blue-700' 
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
              title="Chuyển đổi giao diện Điện thoại / Máy tính"
            >
              {viewMode === 'mobile' ? '📱 Mobile' : '💻 PC'}
            </button>

            <div className="text-right hidden sm:block ml-2">
              <p className="text-[11px] font-black text-gray-800 uppercase leading-none">Admin</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-[1rem] sm:rounded-[1.25rem] flex items-center justify-center text-white text-xs sm:text-base font-black shadow-xl shadow-blue-200 border-2 border-white">
              PG
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto bg-gray-50/50 p-4 sm:p-6">
          <div className="max-w-[1600px] mx-auto animate-in fade-in duration-700">
            <Outlet />
          </div>
        </div>

        {/* Lớp phủ màn hình mờ khi mở Sidebar ở chế độ Mobile */}
        {viewMode === 'mobile' && isSidebarOpen && (
          <div 
            onClick={() => setIsSidebarOpen(false)} 
            className="absolute inset-0 bg-black/50 z-40 backdrop-blur-sm animate-in fade-in"
          ></div>
        )}
      </main>

    </div>
  );
};

export default AdminLayout;