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

  // --- THEO DÕI TRẠNG THÁI ONLINE/OFFLINE CỦA ADMIN ---
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
      const data = JSON.stringify({ isOnline: false });
      const blob = new Blob([data], { type: 'application/json' });
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
    { path: '/admin/communication', label: 'Thông báo & Quà', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
    )},
    { path: '/admin/events', label: 'Quản lý Sự kiện', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
    )},
    // --- BỔ SUNG: TRANG QUẢN LÝ ĐÁNH GIÁ ---
    { path: '/admin/ratings', label: 'Đánh giá & Phản hồi', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
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
              onClick={() => viewMode === 'mobile' && setIsSidebarOpen(false)} 
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
                {isActive('/admin/communication') && 'Thông báo & Quà tặng'}
                {isActive('/admin/events') && 'Quản lý Sự kiện'}
                {isActive('/admin/ratings') && 'Đánh giá & Phản hồi'}
                {isActive('/admin/settings') && 'Cài đặt hệ thống'}
              </h1>
              <p className="text-[8px] sm:text-[9px] text-green-500 font-bold uppercase tracking-widest mt-0.5 truncate flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                Đang trực tuyến
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
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