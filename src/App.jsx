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
import AdminLogin from './pages/Admin/AdminLogin'; // Trang đăng nhập Admin mới

// CSS Toàn cục
import './index.css';

// --- COMPONENT BẢO VỆ ROUTE ADMIN ---
// Nếu chưa đăng nhập (không có adminToken), đẩy về trang /admin/login
const ProtectedAdminRoute = ({ children }) => {
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
          
          {/* Hỗ trợ cả 2 dạng: /order và /order/0901234567 */}
          <Route path="/order" element={<Order />} />
          <Route path="/order/:username" element={<Order />} />
          
          {/* Trang kiểm tra đơn hàng */}
          <Route path="/checkorder" element={<CheckOrder />} />


          {/* --- Cấu trúc các trang dành cho Admin --- */}
          
          {/* 1. Trang đăng nhập Admin (Không bị khóa) */}
          <Route path="/admin/login" element={<AdminLogin />} />

          {/* 2. Cụm trang quản trị (Được bảo vệ bởi ProtectedAdminRoute) */}
          <Route 
            path="/admin" 
            element={
              <ProtectedAdminRoute>
                <AdminLayout />
              </ProtectedAdminRoute>
            }
          >
            {/* Các route con này chỉ hiện khi đã qua được lớp bảo vệ ở trên */}
            <Route index element={<Dashboard />} />
            <Route path="orders" element={<ManageOrders />} />
            <Route path="users" element={<ManageUsers />} />
            <Route path="menu" element={<ManageMenu />} />
          </Route>


          {/* --- Route xử lý lỗi 404 --- */}
          <Route path="*" element={
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-10 text-center">
              <div>
                <h1 className="text-4xl font-bold text-gray-800 mb-4">404</h1>
                <p className="text-gray-500 mb-6">Trang không tồn tại hoặc đã bị di dời.</p>
                <button 
                  onClick={() => window.location.href = '/'}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium"
                >
                  Quay về trang chủ
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