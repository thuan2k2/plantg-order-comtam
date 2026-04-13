import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateCustomerSecure } from '../services/authService';

const UserSettings = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('userProfile')) || {});
  const [formData, setFormData] = useState({ fullName: user.fullName, address: user.address });
  const [isVerifying, setIsVerifying] = useState(false);
  const [passcode, setPasscode] = useState('');

  const handleSave = async () => {
    const res = await updateCustomerSecure(user.username, formData, passcode);
    if (res.success) {
      const updatedUser = { ...user, ...formData };
      localStorage.setItem('userProfile', JSON.stringify(updatedUser));
      alert("Cập nhật thông tin thành công!");
      setIsVerifying(false);
      setPasscode('');
    } else {
      alert(res.error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 font-sans">
      <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 shadow-xl">
        <div className="flex justify-between items-center mb-8">
          <button onClick={() => navigate(-1)} className="text-gray-400">← Quay lại</button>
          <h2 className="text-xl font-black uppercase text-center flex-1">Cài đặt tài khoản</h2>
          <div className="w-8"></div>
        </div>
        
        {/* Avatar Section */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-24 h-24 bg-blue-100 rounded-full border-4 border-white shadow-lg overflow-hidden">
             <img src={user.avatarUrl || `https://ui-avatars.com/api/?name=${user.fullName || 'User'}&background=random`} alt="avatar" />
          </div>
          <button className="mt-3 text-[10px] font-black text-blue-600 uppercase tracking-widest">Đổi ảnh đại diện</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Số điện thoại (ID không thể đổi)</label>
            <input disabled value={user.username || ''} className="w-full p-4 bg-gray-50 dark:bg-gray-700 rounded-2xl opacity-60 font-bold" />
          </div>
          <div>
            <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Họ và tên</label>
            <input 
              value={formData.fullName || ''} 
              onChange={e => setFormData({...formData, fullName: e.target.value})}
              className="w-full p-4 bg-gray-50 dark:bg-gray-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" 
            />
          </div>
          <div>
            <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Địa chỉ mặc định</label>
            <textarea 
              value={formData.address || ''} 
              onChange={e => setFormData({...formData, address: e.target.value})}
              className="w-full p-4 bg-gray-50 dark:bg-gray-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold resize-none" 
            />
          </div>
        </div>

        <button 
          onClick={() => setIsVerifying(true)}
          className="w-full mt-8 bg-blue-600 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg active:scale-95 transition-all"
        >
          Lưu thay đổi
        </button>
      </div>

      {/* Modal nhập Passcode bảo mật */}
      {isVerifying && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] w-full max-w-xs shadow-2xl animate-in zoom-in-95">
            <p className="text-center font-black uppercase text-xs mb-6">Xác nhận Passcode</p>
            <input 
              type="password" maxLength="6" placeholder="******"
              className="w-full text-center text-3xl tracking-[0.5em] p-4 bg-gray-100 dark:bg-gray-700 rounded-2xl mb-6 outline-none border-none"
              onChange={(e) => setPasscode(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => setIsVerifying(false)} className="flex-1 py-3 text-gray-400 font-black uppercase text-[10px]">Hủy</button>
              <button onClick={handleSave} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px]">Xác nhận</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserSettings;