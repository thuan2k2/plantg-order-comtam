import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { app } from './firebase/config';

// Import Provider quản lý Cài đặt chung
import { SettingsProvider } from './contexts/SettingsContext';

// Import các Pages dành cho Khách hàng
import Home from './pages/Home';
import Register from './pages/Register';
import Order from './pages/Order';
import CheckOrder from './pages/CheckOrder';
import UserSettings from './pages/UserSettings'; 
import RewardCenter from './pages/RewardCenter'; 

// Import Widget Chat dành cho Khách hàng
import CustomerChat from './components/CustomerChat';

// --- MỚI: Import Vệ sĩ Bảo mật ---
import SecurityGuard from './components/SecurityGuard';

// Admin Pages
import AdminLayout from './pages/Admin/AdminLayout';
import Dashboard from './pages/Admin/Dashboard';
import ManageOrders from './pages/Admin/ManageOrders';
import ManageUsers from './pages/Admin/ManageUsers';
import ManageMenu from './pages/Admin/ManageMenu';
import ManageVouchers from './pages/Admin/ManageVouchers';
import ManageChat from './pages/Admin/ManageChat'; 
import AdminLogin from './pages/Admin/AdminLogin';
import Statistics from './pages/Admin/Statistics'; 
import AdminSettings from './pages/Admin/AdminSettings'; 
import ManageCommunication from './pages/Admin/ManageCommunication'; 
import ManageEvents from './pages/Admin/ManageEvents'; 
import ManageRatings from './pages/Admin/ManageRatings'; 
import ManageAllOrders from './pages/Admin/ManageAllOrders'; 
import ManageRanks from './pages/Admin/ManageRanks';

// CSS Toàn cục
import './index.css';

// --- COMPONENT BẢO VỆ ROUTE ADMIN ---
const ProtectedAdminRoute = ({ children }) => {
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const auth = getAuth(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsLoggedIn(!!user);
      setCheckingStatus(false);
    });
    return () => unsubscribe();
  }, [auth]);

  if (checkingStatus) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-gray-900 font-sans">
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
  // --- MỚI: State lưu SĐT để truyền cho Security Guard ---
  const [phone, setPhone] = useState('');

  useEffect(() => {
    // Liên tục kiểm tra SĐT đăng nhập để cập nhật cho hệ thống giám sát
    const checkPhone = () => {
      try {
        const recentPhones = JSON.parse(localStorage.getItem('recentPhones') || '[]');
        const currentPhone = recentPhones.length > 0 ? recentPhones[0] : '';
        if (currentPhone !== phone) {
          setPhone(currentPhone);
        }
      } catch(e) {
        console.error("Lỗi đọc SĐT:", e);
      }
    };
    
    checkPhone(); // Check ngay khi load
    const timer = setInterval(checkPhone, 2000); // Check mỗi 2 giây
    
    return () => clearInterval(timer);
  }, [phone]);

  return (
    <SettingsProvider>
      <Router>
        <div className="app-container dark:bg-gray-900 transition-colors duration-300 min-h-screen relative">
          <Routes>
            {/* --- Cấu trúc các trang dành cho Khách hàng --- */}
            <Route path="/" element={<Home />} />
            <Route path="/dangky" element={<Register />} />
            <Route path="/order" element={<Order />} />
            <Route path="/order/:username" element={<Order />} />
            <Route path="/checkorder" element={<CheckOrder />} />
            <Route path="/settings" element={<UserSettings />} /> 
            <Route path="/rewards" element={<RewardCenter />} />

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
              <Route path="vouchers" element={<ManageVouchers />} />
              <Route path="chat" element={<ManageChat />} />
              <Route path="communication" element={<ManageCommunication />} />
              <Route path="events" element={<ManageEvents />} />
              <Route path="ratings" element={<ManageRatings />} />
              
              <Route path="all-orders" element={<ManageAllOrders />} />
              <Route path="ranks" element={<ManageRanks />} />
              
              <Route path="settings" element={<AdminSettings />} /> 
            </Route>

            {/* --- Route xử lý lỗi 404 --- */}
            <Route path="*" element={
              <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-10 text-center font-sans">
                <div className="max-w-md w-full bg-white dark:bg-gray-800 p-12 rounded-[3rem] shadow-2xl border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in duration-500">
                  <h1 className="text-8xl font-black text-blue-50 dark:text-blue-900/30 mb-2 tracking-tighter relative">
                      404
                      <span className="absolute inset-0 flex items-center justify-center text-4xl text-gray-800 dark:text-gray-100">Oops!</span>
                  </h1>
                  <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.4em] mb-10">Trang này không tồn tại hoặc đã bị gỡ bỏ</p>
                  <button 
                    onClick={() => window.location.href = '/'}
                    className="w-full bg-blue-600 text-white py-5 rounded-[2rem] text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-100 dark:shadow-none active:scale-95 transition-all"
                  >
                    Quay về trang chủ
                  </button>
                </div>
              </div>
            } />
          </Routes>

          <CustomerChat />

          {/* --- MỚI: Tích hợp Vệ sĩ Bảo vệ Toàn hệ thống --- */}
          <SecurityGuard phone={phone} />
          
        </div>
      </Router>
    </SettingsProvider>
  );
}

export default App;