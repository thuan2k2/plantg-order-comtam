import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { app } from './firebase/config';

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
import ManageVouchers from './pages/Admin/ManageVouchers'; // 1. IMPORT THÊM Ở ĐÂY
import AdminLogin from './pages/Admin/AdminLogin';
import Statistics from './pages/Admin/Statistics'; 

// CSS Toàn cục
import './index.css';

// --- COMPONENT BẢO VỆ ROUTE ADMIN ---
const ProtectedAdminRoute = ({ children }) => {
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const auth = getAuth(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsLoggedIn(true);
      } else {
        setIsLoggedIn(false);
      }
      setCheckingStatus(false);
    });
    return () => unsubscribe();
  }, [auth]);

  if (checkingStatus) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white font-sans">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-blue-600 mb-4"></div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Hệ thống đang bảo mật...</p>
      </div>
    );
  }

  if (!isLoggedIn) {
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
            <Route index element={<Dashboard />} />
            <Route path="orders" element={<ManageOrders />} />
            <Route path="statistics" element={<Statistics />} />
            <Route path="users" element={<ManageUsers />} />
            <Route path="menu" element={<ManageMenu />} />
            
            {/* 2. KHAI BÁO ROUTE CHO TRANG VOUCHER TẠI ĐÂY */}
            <Route path="vouchers" element={<ManageVouchers />} />
          </Route>

          {/* --- Route xử lý lỗi 404 --- */}
          <Route path="*" element={
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-10 text-center font-sans">
              <div className="max-w-md w-full bg-white p-12 rounded-[3rem] shadow-2xl shadow-gray-200/50 border border-gray-100 animate-in fade-in zoom-in duration-500">
                <h1 className="text-8xl font-black text-blue-50 mb-2 tracking-tighter relative">
                   404
                   <span className="absolute inset-0 flex items-center justify-center text-4xl text-gray-800">Oops!</span>
                </h1>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em] mb-10">Trang này không tồn tại hoặc đã bị gỡ bỏ</p>
                <button 
                  onClick={() => window.location.href = '/'}
                  className="w-full bg-blue-600 text-white py-5 rounded-[2rem] text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-100 active:scale-95 transition-all"
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