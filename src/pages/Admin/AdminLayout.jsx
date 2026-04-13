import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { logoutAdmin } from '../../services/authService';

const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // 1. Cơ chế Đóng/Mở Sidebar
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const isActive = (path) => location.pathname === path;

  const handleLogout = async () => {
    if (window.confirm("Bạn có chắc chắn muốn thoát quyền Quản trị viên không?")) {
      try {
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

  // CẬP NHẬT: Thêm mục Quản lý Voucher vào danh sách Menu
  const menuItems = [
    { path: '/admin', label: 'Tổng quan', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
    )},
    { path: '/admin/orders', label: 'Đơn hôm nay', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
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
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex overflow-hidden">
      
      {/* SIDEBAR */}
      <aside 
        className={`bg-gray-900 text-white flex flex-col sticky top-0 h-screen transition-all duration-300 ease-in-out z-50 shadow-2xl
          ${isSidebarOpen ? 'w-64' : 'w-20'}`}
      >
        {/* Logo & Toggle Button */}
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

        {/* Navigation Menu */}
        <nav className="flex-1 p-3 space-y-2 mt-4 overflow-y-auto no-scrollbar">
          {menuItems.map((item) => (
            <Link 
              key={item.path}
              to={item.path} 
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

              {!isSidebarOpen && (
                <div className="absolute left-full ml-4 px-3 py-2 bg-gray-800 text-white text-[9px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                  {item.label}
                </div>
              )}
            </Link>
          ))}
        </nav>

        {/* NÚT THOÁT ADMIN */}
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
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white/80 backdrop-blur-md h-20 flex items-center justify-between px-8 z-20 border-b border-gray-100">
          <div className="flex flex-col">
            <h1 className="text-sm font-black text-gray-800 uppercase tracking-tighter">
              {isActive('/admin') && 'Bảng điều khiển hệ thống'}
              {isActive('/admin/orders') && 'Quản lý đơn bếp hôm nay'}
              {isActive('/admin/statistics') && 'Báo cáo & Lịch sử vĩnh viễn'}
              {isActive('/admin/vouchers') && 'Quản lý kho Voucher'}
              {isActive('/admin/users') && 'Cơ sở dữ liệu khách hàng'}
              {isActive('/admin/menu') && 'Thiết lập danh mục thực đơn'}
            </h1>
            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Plant G Management System v2.0</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-[11px] font-black text-gray-800 uppercase leading-none">Admin Root</p>
              <p className="text-[9px] text-green-500 font-black uppercase mt-1 tracking-widest">● Trực tuyến</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-[1.25rem] flex items-center justify-center text-white font-black shadow-xl shadow-blue-200 border-2 border-white">
              PG
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto bg-gray-50/50 p-6">
          <div className="max-w-[1600px] mx-auto animate-in fade-in duration-700">
            <Outlet />
          </div>
        </div>
      </main>

      {!isSidebarOpen && <div className="fixed inset-0 bg-black/5 z-40 md:hidden pointer-events-none"></div>}
    </div>
  );
};

export default AdminLayout;