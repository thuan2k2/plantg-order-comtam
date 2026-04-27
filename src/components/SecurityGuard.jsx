import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { applyQuickBan } from '../services/authService';

const SecurityGuard = ({ phone }) => {
  const [banData, setBanData] = useState(null);
  const [countdown, setCountdown] = useState("");

  // KIỂM TRA QUYỀN MIỄN TRỪ
  const isAdminPath = window.location.pathname.startsWith('/admin');
  const hasAdminToken = localStorage.getItem('adminToken') === 'true';
  const isExempted = isAdminPath || hasAdminToken;

  // 1. LẮNG NGHE TRẠNG THÁI BAN TỪ FIREBASE
  useEffect(() => {
    // ĐÃ SỬA: Bỏ qua nếu chưa đăng nhập hoặc đang là admin
    if (!phone || phone === "" || isExempted) {
      setBanData(null);
      return;
    }

    const unsub = onSnapshot(doc(db, 'users', phone), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        
        if (data.isBanned) {
          // Xử lý thông minh tất cả các trường hợp lưu trữ thời gian cấm
          const banTimeData = data.bannedUntil || data.banUntil;
          let expireTime = 0;

          if (banTimeData === 'permanent' || data.bannedUntil === 'permanent' || data.banUntil === 'permanent') {
            // Nếu cấm vĩnh viễn, set hạn cấm là 100 năm nữa
            expireTime = Date.now() + 100 * 365 * 24 * 60 * 60 * 1000; 
          } else if (banTimeData && typeof banTimeData.toDate === 'function') {
            // Định dạng chuẩn Firestore Timestamp
            expireTime = banTimeData.toDate().getTime();
          } else if (banTimeData) {
            // Định dạng chuỗi (String)
            expireTime = new Date(banTimeData).getTime();
          }

          if (expireTime > Date.now()) {
            setBanData({ 
              ...data, 
              expireTime, 
              banReason: data.banReason || 'Vi phạm chính sách hệ thống'
            });
          } else {
            setBanData(null); 
          }
        } else {
          setBanData(null);
        }
      }
    });

    return () => unsub();
  }, [phone, isExempted]);

  // 2. CHỐNG F12 / DEVTOOLS & GỌI LỆNH CẤM (CHỈ DÀNH CHO KHÁCH HÀNG ĐÃ ĐĂNG NHẬP)
  useEffect(() => {
    // ĐÃ SỬA: Chỉ kích hoạt bảo vệ khi khách hàng đã đăng nhập SĐT
    if (!phone || phone === "" || isExempted) return;

    let hasTriggered = false;

    const triggerBan = (reason) => {
      if (hasTriggered) return;
      hasTriggered = true;
      applyQuickBan({ phone, reason, days: 1 });
    };

    const handleKeyDown = (e) => {
      if (
        e.keyCode === 123 || 
        (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74)) || 
        (e.ctrlKey && e.keyCode === 85)
      ) {
        e.preventDefault();
        triggerBan("Sử dụng công cụ nhà phát triển (DevTools / F12)");
      }
    };

    const detectDevToolsResize = () => {
      const threshold = 160;
      const widthDiff = window.outerWidth - window.innerWidth;
      const heightDiff = window.outerHeight - window.innerHeight;
      
      if (window.innerWidth > 768 && (widthDiff > threshold || heightDiff > threshold)) {
        triggerBan("Can thiệp cửa sổ trình duyệt (Mở DevTools)");
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', detectDevToolsResize);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', detectDevToolsResize);
    };
  }, [phone, isExempted]);

  // 3. LOGIC ĐỒNG HỒ ĐẾM NGƯỢC
  useEffect(() => {
    if (!banData) return;

    const timer = setInterval(() => {
      const diff = banData.expireTime - Date.now();
      
      if (diff <= 0) {
        setBanData(null);
        clearInterval(timer);
        return;
      }

      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);

      let timeString = "";
      if (d > 0) timeString += `${d} ngày `;
      timeString += `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      
      setCountdown(timeString);
    }, 1000);

    return () => clearInterval(timer);
  }, [banData]);

  // Không hiển thị gì nếu không bị cấm hoặc là Admin
  if (!banData || isExempted) return null;

  return (
    <div className="fixed inset-0 z-[99999] bg-black/95 backdrop-blur-lg flex items-center justify-center p-6 text-center select-none">
      <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl animate-in zoom-in border-4 border-red-500 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#ef4444_10px,#ef4444_20px)] pointer-events-none"></div>
        
        <div className="relative z-10">
          <div className="text-6xl mb-4 animate-bounce drop-shadow-md">⚠️</div>
          <h2 className="text-2xl font-black text-red-600 uppercase mb-4 tracking-widest">Bạn đã bị Cấm!</h2>
          <p className="text-gray-800 dark:text-gray-200 font-bold mb-6 text-sm leading-relaxed">
            Phát hiện hành vi đáng ngờ: <br/>
            <span className="text-red-600 dark:text-red-400 font-black text-base">{banData.banReason || 'Vi phạm chính sách'}</span>
            <br/><br/>
            Hành vi của bạn đã được hệ thống lưu lại và Quản trị viên sẽ xem xét xử lý.
          </p>
          <div className="bg-red-50 dark:bg-red-900/20 p-5 rounded-2xl border-2 border-red-200 dark:border-red-800/50 mb-6 shadow-inner">
            <p className="text-[10px] font-black text-red-400 dark:text-red-500 uppercase tracking-widest mb-2">Thời gian cấm còn lại</p>
            <p className="text-3xl font-mono font-black text-red-600 dark:text-red-400 tracking-tighter">{countdown}</p>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed italic font-medium">Nếu đây là lỗi, hãy liên hệ Admin.</p>
        </div>
      </div>
    </div>
  );
};

export default SecurityGuard;