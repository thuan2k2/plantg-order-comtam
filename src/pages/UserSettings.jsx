// src/pages/UserSettings.jsx
import React, { useState, useEffect } from 'react';
import { verifyPasscode, updateCustomerProfile } from '../services/authService';

const UserSettings = () => {
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('userProfile')));
  const [isVerifying, setIsVerifying] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [tempData, setTempData] = useState({});

  const handleUpdateInfo = async () => {
    // Luôn yêu cầu Passcode trước khi cho phép lưu thông tin mới
    const isValid = await verifyPasscode(user.username, passcode);
    if (!isValid) return alert("Mã Passcode không chính xác!");

    await updateCustomerProfile(user.username, tempData);
    alert("Cập nhật thành công!");
    setIsVerifying(false);
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-900 min-h-screen">
      <h2 className="text-xl font-black uppercase mb-6">Cài đặt tài khoản</h2>
      
      {/* Thay đổi Avatar */}
      <div className="flex flex-col items-center mb-8">
        <img src={user.avatarUrl || '/default-avatar.png'} className="w-24 h-24 rounded-full border-4 border-blue-500" />
        <button className="text-xs font-bold text-blue-600 mt-2 uppercase">Đổi ảnh đại diện</button>
      </div>

      {/* Thông tin cá nhân */}
      <div className="space-y-4">
        <input 
          disabled value={user.username} 
          className="w-full p-4 bg-gray-100 rounded-2xl opacity-50" 
          title="Không thể đổi SĐT định danh"
        />
        <input 
          placeholder="Họ và tên" 
          onChange={(e) => setTempData({...tempData, fullName: e.target.value})} 
          className="w-full p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl"
        />
        <textarea 
          placeholder="Địa chỉ nhận hàng" 
          onChange={(e) => setTempData({...tempData, address: e.target.value})}
          className="w-full p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl"
        />
      </div>

      <button 
        onClick={() => setIsVerifying(true)}
        className="w-full mt-6 bg-blue-600 text-white py-4 rounded-2xl font-black uppercase"
      >
        Lưu thay đổi (Yêu cầu Passcode)
      </button>

      {/* Modal xác thực Passcode */}
      {isVerifying && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50">
          <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-sm">
            <p className="text-center font-black uppercase text-sm mb-4">Nhập Passcode để xác nhận</p>
            <input 
              type="password" maxLength="6" 
              className="w-full text-center text-2xl tracking-[1em] p-4 bg-gray-100 rounded-2xl mb-4"
              onChange={(e) => setPasscode(e.target.value)}
            />
            <div className="flex gap-2">
              <button onClick={() => setIsVerifying(false)} className="flex-1 py-3 text-gray-400 font-bold uppercase">Hủy</button>
              <button onClick={handleUpdateInfo} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold uppercase">Xác nhận</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};