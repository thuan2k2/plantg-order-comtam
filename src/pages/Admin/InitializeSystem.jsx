import React, { useState } from 'react';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';

const InitializeSystem = () => {
  const [status, setStatus] = useState('Chưa bắt đầu');

  const runSetup = async () => {
    setStatus('Đang kiểm tra và khởi tạo...');
    try {
      const configRef = doc(db, 'system', 'config');
      const snap = await getDoc(configRef);

      // Thiết lập các giá trị mặc định cho hệ thống
      const defaultConfig = {
        isOpen: true,
        minOrder: 30000,           // Đơn tối thiểu 30k
        openTime: "11:00 - 21:00",
        sysNotice: "Chào mừng bạn đến với Cơm Tấm Plant G!",
        updatedAt: serverTimestamp()
      };

      // Ghi dữ liệu lên Firebase
      await setDoc(configRef, defaultConfig, { merge: true });
      
      setStatus('✅ KHỞI TẠO THÀNH CÔNG! Bảng system/config đã sẵn sàng.');
    } catch (error) {
      console.error(error);
      setStatus('❌ LỖI: ' + error.message);
    }
  };

  return (
    <div className="p-10 text-center font-sans">
      <h1 className="text-2xl font-black mb-4 uppercase">Cài đặt hệ thống gốc</h1>
      <p className="text-gray-500 mb-8">Nút này sẽ tự động tạo bảng cấu hình (isOpen, minOrder...) trên Firestore cho bạn.</p>
      
      <div className="bg-gray-100 p-6 rounded-3xl mb-6 font-mono text-sm">
        Trạng thái: <span className="font-bold text-blue-600">{status}</span>
      </div>

      <button 
        onClick={runSetup}
        className="bg-blue-600 text-white px-10 py-5 rounded-2xl font-black uppercase shadow-xl active:scale-95 transition-all"
      >
        Kích hoạt cấu hình ngay
      </button>
    </div>
  );
};

export default InitializeSystem;