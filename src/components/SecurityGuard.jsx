import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { applyQuickBan } from '../services/authService';

const SecurityGuard = ({ phone }) => {
  const [banData, setBanData] = useState(null);
  const [countdown, setCountdown] = useState("");

  // 1. LẮNG NGHE TRẠNG THÁI BAN TỪ FIREBASE
  useEffect(() => {
    if (!phone) return;

    const unsub = onSnapshot(doc(db, 'users', phone), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.isBanned && data.bannedUntil) {
          const expireTime = data.bannedUntil.toDate().getTime();
          if (expireTime > Date.now()) {
            setBanData({ ...data, expireTime });
          } else {
            setBanData(null); // Đã hết hạn cấm
          }
        } else {
          setBanData(null);
        }
      }
    });

    return () => unsub();
  }, [phone]);

  // 2. CHỐNG F12 / DEVTOOLS & GỌI LỆNH CẤM
  useEffect(() => {
    if (!phone) return;

    let hasTriggered = false;

    const triggerBan = (reason) => {
      if (hasTriggered) return;
      hasTriggered = true;
      applyQuickBan({ phone, reason, days: 1 }); // Phạt cấm 1 ngày
    };

    // Chặn phím tắt
    const handleKeyDown = (e) => {
      if (
        e.keyCode === 123 || // Phím F12
        (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74)) || // Ctrl+Shift+I hoặc J
        (e.ctrlKey && e.keyCode === 85) // Ctrl+U (Xem mã nguồn)
      ) {
        e.preventDefault();
        triggerBan("Sử dụng công cụ nhà phát triển (DevTools / F12)");
      }
    };

    // Phát hiện thay đổi kích thước cửa sổ bất thường (Khi bật Console UI)
    const detectDevToolsResize = () => {
      const threshold = 160;
      const widthDiff = window.outerWidth - window.innerWidth;
      const heightDiff = window.outerHeight - window.innerHeight;
      
      // Bỏ qua nếu ứng dụng đang chạy trên màn hình quá nhỏ (Tránh lỗi trên Mobile khi mở bàn phím ảo)
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
  }, [phone]);

  // 3. LOGIC ĐỒNG HỒ ĐẾM NGƯỢC
  useEffect(() => {
    if (!banData) return;

    const timer = setInterval(() => {
      const diff = banData.expireTime - Date.now();
      
      // Nếu hết thời gian thì gỡ popup
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

  // Nếu không bị cấm thì không hiển thị gì cả (Chạy ngầm)
  if (!banData) return null;

  // GIAO DIỆN KHI BỊ CẤM
  return (
    <div className="fixed inset-0 z-[99999] bg-black/95 backdrop-blur-lg flex items-center justify-center p-6 text-center select-none">
      <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl animate-in zoom-in border-4 border-red-500 relative overflow-hidden">
        
        {/* Background Pattern Cảnh báo */}
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
            <p className="text-[11px] font-bold text-red-600 mt-3 bg-red-100 dark:bg-red-900/60 py-1.5 rounded-full inline-block px-4">
              Mở khóa vào: {new Date(banData.expireTime).toLocaleString('vi-VN')}
            </p>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed italic font-medium">
            Nếu đây là sự nhầm lẫn, hãy liên hệ ngay với Quản trị viên để được hỗ trợ. Xin cảm ơn!
          </p>
        </div>
      </div>
    </div>
  );
};

export default SecurityGuard;