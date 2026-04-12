import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Import các Pages (Sẽ được tạo mã chi tiết ở các bước sau)
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

// CSS Toàn cục
import './index.css';

function App() {
  return (
    <Router>
      <div className="app-container">
        <Routes>
          {/* Cấu trúc các trang dành cho Khách hàng */}
          <Route path="/" element={<Home />} />
          <Route path="/dangky" element={<Register />} />
          
          <Route path="/order" element={<Order />} />

          {/* :username là dynamic param để xác định khách hàng nào đang đặt hàng */}
          <Route path="/order/:username" element={<Order />} />
          
          {/* Trang kiểm tra trạng thái đơn hàng (Sử dụng query param ?user=...) */}
          <Route path="/checkorder" element={<CheckOrder />} />

          {/* Cấu trúc các trang dành cho Admin */}
          <Route path="/admin" element={<AdminLayout />}>
            {/* Các route con nằm trong layout của Admin */}
            <Route index element={<Dashboard />} />
            <Route path="orders" element={<ManageOrders />} />
            <Route path="users" element={<ManageUsers />} />
            <Route path="menu" element={<ManageMenu />} />
          </Route>

          {/* Route xử lý khi khách truy cập link không tồn tại */}
          <Route path="*" element={<div className="p-10 text-center">Trang không tồn tại hoặc đã bị di dời.</div>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;