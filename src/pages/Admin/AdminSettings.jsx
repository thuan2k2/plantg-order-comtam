import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';

const AdminSettings = () => {
  const [config, setConfig] = useState({
    isOpen: true,
    minOrder: 0,
    openTime: '',
    sysNotice: ''
  });

  useEffect(() => {
    const fetchConfig = async () => {
      const snap = await getDoc(doc(db, 'system', 'config'));
      if (snap.exists()) setConfig(snap.data());
    };
    fetchConfig();
  }, []);

  const handleSave = async () => {
    try {
      await updateDoc(doc(db, 'system', 'config'), config);
      alert("Cấu hình hệ thống đã được cập nhật!");
    } catch (error) {
      alert("Lỗi: Bạn chưa chạy Script khởi tạo Bảng config! Hãy vào đường dẫn /setup-system trước.");
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <h2 className="text-2xl font-black uppercase tracking-tighter">Cấu hình vận hành</h2>

      {/* Trạng thái cửa hàng */}
      <div className="bg-white p-8 rounded-[2.5rem] border flex justify-between items-center shadow-sm">
        <div>
          <p className="font-black uppercase text-sm">Trạng thái đóng/mở cửa</p>
          <p className="text-xs text-gray-400 mt-1">Khi đóng, khách hàng sẽ không thể nhấn nút "Xác nhận đặt đơn".</p>
        </div>
        <button 
          onClick={() => setConfig({...config, isOpen: !config.isOpen})}
          className={`px-8 py-4 rounded-2xl font-black uppercase text-xs transition-all ${config.isOpen ? 'bg-green-500 text-white shadow-green-100 shadow-lg' : 'bg-red-500 text-white shadow-red-100 shadow-lg'}`}
        >
          {config.isOpen ? '● Đang mở cửa' : '○ Đang đóng cửa'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Thông báo hệ thống */}
        <div className="md:col-span-2 bg-white p-8 rounded-[2.5rem] border shadow-sm">
          <label className="block text-[10px] font-black text-gray-400 uppercase mb-3 tracking-widest">Thông báo nổi bật (Trang chủ)</label>
          <textarea 
            value={config.sysNotice || ''} 
            onChange={e => setConfig({...config, sysNotice: e.target.value})}
            className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-bold text-sm resize-none h-24"
            placeholder="Ví dụ: Hôm nay quán có món sườn non rất ngon..."
          />
        </div>

        {/* Giờ mở cửa */}
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
          <label className="block text-[10px] font-black text-gray-400 uppercase mb-3 tracking-widest">Giờ hoạt động hiển thị</label>
          <input 
            value={config.openTime || ''} 
            onChange={e => setConfig({...config, openTime: e.target.value})}
            className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-black text-blue-600"
            placeholder="11:00 - 21:00"
          />
        </div>

        {/* Đơn hàng tối thiểu */}
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
          <label className="block text-[10px] font-black text-gray-400 uppercase mb-3 tracking-widest">Giá trị đơn tối thiểu (đ)</label>
          <input 
            type="number"
            value={config.minOrder || 0} 
            onChange={e => setConfig({...config, minOrder: parseInt(e.target.value)})}
            className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-black text-red-500"
          />
        </div>
      </div>

      <button 
        onClick={handleSave}
        className="w-full bg-gray-900 text-white py-6 rounded-[2rem] font-black uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all"
      >
        Lưu tất cả thiết lập hệ thống
      </button>
    </div>
  );
};

export default AdminSettings;