import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';

const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Hàm kiểm tra link hiện tại để tô màu menu đang active
  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar - Thanh điều hướng bên trái */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-5 border-b border-gray-800">
          <h2 className="text-xl font-bold text-orange-500">Cơm Tấm Admin</h2>
          <p className="text-sm text-gray-400 mt-1">plantg.id.vn</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <Link 
            to="/admin" 
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/admin') ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Tổng quan (Dashboard)
          </Link>

          <Link 
            to="/admin/orders" 
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/admin/orders') ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            Quản lý Đơn hàng
          </Link>

          <Link 
            to="/admin/users" 
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/admin/users') ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Khách hàng
          </Link>

          <Link 
            to="/admin/menu" 
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/admin/menu') ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            Thực đơn món ăn
          </Link>
        </nav>

        <div className="p-4 border-t border-gray-800">
          <button 
            onClick={() => {
              // TODO: Thêm logic đăng xuất Firebase Auth ở đây
              navigate('/');
            }}
            className="flex items-center gap-2 text-gray-400 hover:text-red-400 w-full px-4 py-2 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Về Trang chủ
          </button>
        </div>
      </aside>

      {/* Main Content - Khu vực nội dung thay đổi theo link */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header trên cùng */}
        <header className="bg-white shadow-sm h-16 flex items-center justify-between px-8 z-10">
          <h1 className="text-xl font-semibold text-gray-800">
            {isActive('/admin') && 'Tổng quan hệ thống'}
            {isActive('/admin/orders') && 'Quản lý Đơn hàng'}
            {isActive('/admin/users') && 'Danh sách Khách hàng'}
            {isActive('/admin/menu') && 'Quản lý Thực đơn'}
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 font-medium">Bếp chính</span>
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">A</div>
          </div>
        </header>

        {/* Nội dung các trang con (Dashboard, ManageOrders...) sẽ được render ở đây */}
        <div className="flex-1 overflow-auto p-8 bg-gray-50">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;