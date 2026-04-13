// src/pages/Admin/AdminSettings.jsx
import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';

const AdminSettings = () => {
  const [config, setConfig] = useState({
    isOpen: true,
    minOrder: 30000,
    openTime: "11:00 - 21:00",
    sysNotice: "Chào mừng bạn đến với Plant G!"
  });

  const saveConfig = async () => {
    await updateDoc(doc(db, 'system', 'config'), config);
    alert("Hệ thống đã cập nhật!");
  };

  return (
    <div className="p-8 space-y-8">
      <h2 className="text-2xl font-black uppercase">Cấu hình hệ thống</h2>
      
      {/* Đóng/Mở cửa hàng */}
      <div className="bg-white p-6 rounded-3xl border flex justify-between items-center">
        <div>
          <p className="font-black uppercase text-sm">Trạng thái cửa hàng</p>
          <p className="text-xs text-gray-400">Khách sẽ không thể đặt đơn nếu cửa hàng đóng.</p>
        </div>
        <button 
          onClick={() => setConfig({...config, isOpen: !config.isOpen})}
          className={`px-6 py-3 rounded-2xl font-black uppercase text-[10px] ${config.isOpen ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}
        >
          {config.isOpen ? 'Đang mở' : 'Đã đóng'}
        </button>
      </div>

      {/* Cài đặt giờ & Thông báo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-3xl border">
          <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Giờ hoạt động hiển thị</label>
          <input 
            value={config.openTime} 
            onChange={(e) => setConfig({...config, openTime: e.target.value})}
            className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-bold"
          />
        </div>
        <div className="bg-white p-6 rounded-3xl border">
          <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Giá trị đơn tối thiểu</label>
          <input 
            type="number" value={config.minOrder} 
            onChange={(e) => setConfig({...config, minOrder: e.target.value})}
            className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-bold"
          />
        </div>
      </div>

      <button onClick={saveConfig} className="w-full bg-gray-900 text-white py-5 rounded-3xl font-black uppercase shadow-xl">
        Lưu tất cả thiết lập
      </button>
    </div>
  );
};