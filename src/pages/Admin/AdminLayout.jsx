import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
// CẬP NHẬT: Import hàm đăng xuất từ authService
import { logoutAdmin } from '../../services/authService';

const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Hàm kiểm tra link hiện tại để tô màu menu đang active
  const isActive = (path) => location.pathname === path;

  // CẬP NHẬT: Sử dụng logoutAdmin của Firebase Auth thay vì xóa localStorage thủ công
  const handleLogout = async () => {
    if (window.confirm("Bạn có chắc chắn muốn thoát quyền Quản trị viên không?")) {
      try {
        const result = await logoutAdmin();
        if (result.success) {
          // Sau khi đăng xuất thành công, Firebase Auth sẽ xóa token thực
          // onAuthStateChanged trong App.jsx sẽ nhận biết và bảo vệ hệ thống
          navigate('/admin/login');
        } else {
          alert("Lỗi khi đăng xuất: " + result.error);
        }
      } catch (error) {
        console.error("Logout Error:", error);
        // Backup: Nếu Firebase lỗi, vẫn đẩy về login để đảm bảo an toàn
        navigate('/admin/login');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar - Thanh điều hướng bên trái */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col sticky top-0 h-screen">
        <div className="p-6 border-b border-gray-800">
          <h2 className="text-xl font-black text-orange-500 tracking-tighter">PLANT G ADMIN</h2>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Hệ thống quản lý</p>
        </div>

        <nav className="flex-1 p-4 space-y-2 mt-2">
          <Link 
            to="/admin" 
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${isActive('/admin') ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            Tổng quan
          </Link>

          <Link 
            to="/admin/orders" 
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${isActive('/admin/orders') ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
            Đơn hàng hôm nay
          </Link>

          <Link 
            to="/admin/statistics" 
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${isActive('/admin/statistics') ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            Lịch sử & Thống kê
          </Link>

          <Link 
            to="/admin/menu" 
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${isActive('/admin/menu') ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
            Quản lý Thực đơn
          </Link>

          <Link 
            to="/admin/users" 
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${isActive('/admin/users') ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            Khách hàng
          </Link>
        </nav>

        {/* NÚT THOÁT ADMIN */}
        <div className="p-4 border-t border-gray-800">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 text-red-400 hover:bg-red-500/10 w-full px-4 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Thoát Admin
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header trên cùng */}
        <header className="bg-white shadow-sm h-16 flex items-center justify-between px-8 z-20">
          <h1 className="text-sm font-black text-gray-800 uppercase tracking-tighter">
            {isActive('/admin') && 'Bảng điều khiển hệ thống'}
            {isActive('/admin/orders') && 'Danh sách đơn hàng hôm nay'}
            {isActive('/admin/statistics') && 'Thống kê & Tìm kiếm đơn hàng'}
            {isActive('/admin/users') && 'Cơ sở dữ liệu khách hàng'}
            {isActive('/admin/menu') && 'Thiết lập thực đơn'}
          </h1>
          
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-[11px] font-black text-gray-800 uppercase leading-none">Bếp Trưởng</p>
              <p className="text-[10px] text-green-500 font-bold">Trực tuyến</p>
            </div>
            <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-blue-400 rounded-2xl flex items-center justify-center text-white font-black shadow-lg shadow-blue-200">
              P
            </div>
          </div>
        </header>

        {/* Khu vực render nội dung */}
        <div className="flex-1 overflow-auto p-6 bg-gray-50/50">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;