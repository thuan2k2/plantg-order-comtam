import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Import các Pages dành cho Khách hàng
import Home from './pages/Home';
import Register from './pages/Register';
import Order from './pages/Order';
import CheckOrder from './pages/CheckOrder';

// Admin Pages
import AdminLayout from './pages/Admin/AdminLayout';
import Dashboard from './pages/Admin/Dashboard';
import ManageOrders from './pages/Admin/ManageOrders';
import ManageUsers from './pages/Admin/ManageUsers';
import ManageMenu from './pages/Admin/ManageMenu';
import AdminLogin from './pages/Admin/AdminLogin';
// BỔ SUNG: Trang thống kê đơn hàng mới
import Statistics from './pages/Admin/Statistics'; 

// CSS Toàn cục
import './index.css';

// --- COMPONENT BẢO VỆ ROUTE ADMIN ---
const ProtectedAdminRoute = ({ children }) => {
  // Đồng bộ với logic logout trong AdminLayout: kiểm tra adminToken
  const isAuthenticated = localStorage.getItem('adminToken') === 'true';
  
  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }
  return children;
};

function App() {
  return (
    <Router>
      <div className="app-container">
        <Routes>
          {/* --- Cấu trúc các trang dành cho Khách hàng --- */}
          <Route path="/" element={<Home />} />
          <Route path="/dangky" element={<Register />} />
          
          <Route path="/order" element={<Order />} />
          <Route path="/order/:username" element={<Order />} />
          
          <Route path="/checkorder" element={<CheckOrder />} />

          {/* --- Cấu trúc các trang dành cho Admin --- */}
          
          <Route path="/admin/login" element={<AdminLogin />} />

          <Route 
            path="/admin" 
            element={
              <ProtectedAdminRoute>
                <AdminLayout />
              </ProtectedAdminRoute>
            }
          >
            {/* Dashboard: Tổng quan doanh thu & đơn mới */}
            <Route index element={<Dashboard />} />
            
            {/* ManageOrders: Chỉ hiện đơn hàng của HÔM NAY */}
            <Route path="orders" element={<ManageOrders />} />
            
            {/* Statistics: Xem lại toàn bộ lịch sử đơn hàng & Tìm kiếm nâng cao */}
            <Route path="statistics" element={<Statistics />} />
            
            <Route path="users" element={<ManageUsers />} />
            <Route path="menu" element={<ManageMenu />} />
          </Route>

          {/* --- Route xử lý lỗi 404 --- */}
          <Route path="*" element={
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-10 text-center">
              <div className="max-w-md w-full bg-white p-8 rounded-[2.5rem] shadow-xl border border-gray-100">
                <h1 className="text-6xl font-black text-gray-200 mb-4">404</h1>
                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-8">Trang không tồn tại</p>
                <button 
                  onClick={() => window.location.href = '/'}
                  className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-blue-100 active:scale-95 transition-all"
                >
                  QUAY VỀ TRANG CHỦ
                </button>
              </div>
            </div>
          } />
        </Routes>
      </div>
    </Router>
  );
}

export default App;