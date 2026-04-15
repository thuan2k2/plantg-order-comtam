import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase/config';
import { claimMailboxAttachment } from '../services/chatService';

const NotificationCenter = () => {
  // Trạng thái Tab đang mở: 'NOTIF' | 'MAIL' | null (đang đóng)
  const [activeTab, setActiveTab] = useState(null); 
  
  // Dữ liệu
  const [notifications, setNotifications] = useState([]);
  const [mails, setMails] = useState([]);
  const [userData, setUserData] = useState({});
  
  // Trạng thái xử lý API để tránh spam click
  const [claimingId, setClaimingId] = useState(null);
  
  // Lấy SĐT khách hàng
  const phone = JSON.parse(localStorage.getItem('recentPhones') || '[]')[0];

  // ==========================================
  // 1. LẮNG NGHE DỮ LIỆU REAL-TIME
  // ==========================================
  useEffect(() => {
    if (!phone) return;

    // Lắng nghe User Data (để biết thư nào đã được Claim)
    const unsubUser = onSnapshot(doc(db, 'users', phone), (doc) => {
      if (doc.exists()) setUserData(doc.data());
    });

    // Lắng nghe Thông báo (Chỉ lấy 'all' hoặc đúng SĐT của khách)
    const qNotif = query(
      collection(db, 'notifications'), 
      where('target', 'in', ['all', phone]), 
      orderBy('createdAt', 'desc')
    );
    const unsubNotif = onSnapshot(qNotif, (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Lắng nghe Hòm thư
    const qMail = query(
      collection(db, 'mailbox'), 
      where('target', 'in', ['all', phone]), 
      orderBy('createdAt', 'desc')
    );
    const unsubMail = onSnapshot(qMail, (snap) => {
      setMails(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { 
      unsubUser(); 
      unsubNotif(); 
      unsubMail(); 
    };
  }, [phone]);

  // ==========================================
  // 2. LOGIC TÍNH TOÁN & XỬ LÝ
  // ==========================================
  
  // Đếm số lượng chưa đọc (Chấm đỏ)
  const unreadNotifs = notifications.filter(n => !n.readBy?.includes(phone)).length;
  const unreadMails = mails.filter(m => !m.readBy?.includes(phone)).length;

  // Đánh dấu đã đọc khi người dùng click vào Item
  const handleMarkAsRead = async (item, collectionName) => {
    // Tránh gọi API thừa nếu đã đọc rồi
    if (item.readBy?.includes(phone)) return; 
    
    try {
      await updateDoc(doc(db, collectionName, item.id), {
        readBy: arrayUnion(phone)
      });
    } catch (error) {
      console.error("Lỗi cập nhật trạng thái đọc:", error);
    }
  };

  // API Nhận Quà (Gọi từ Backend qua chatService)
  const handleClaimAttachment = async (mail) => {
    if (claimingId) return; // Đang xử lý 1 thư khác thì chặn
    
    setClaimingId(mail.id);
    try {
      const res = await claimMailboxAttachment(phone, mail.id);
      alert(`🎉 Nhận thành công ${res.reward} xu!`);
      // Không cần set lại state vì onSnapshot của UserData sẽ tự động làm mờ nút
    } catch (error) {
      alert(error.message || "Có lỗi xảy ra khi nhận quà.");
    } finally {
      setClaimingId(null);
    }
  };

  if (!phone) return null;

  return (
    <>
      {/* ========================================= */}
      {/* NÚT FLOAT GÓC TRÊN BÊN PHẢI */}
      {/* ========================================= */}
      <div className="flex gap-3">
        
        {/* Nút Hòm thư */}
        <button 
          onClick={() => setActiveTab(activeTab === 'MAIL' ? null : 'MAIL')} 
          className="relative w-12 h-12 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 flex items-center justify-center text-xl hover:scale-105 active:scale-95 transition-all"
        >
          ✉️
          {unreadMails > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white dark:border-gray-800 animate-bounce shadow-sm">
              {unreadMails > 9 ? '9+' : unreadMails}
            </span>
          )}
        </button>

        {/* Nút Thông báo */}
        <button 
          onClick={() => setActiveTab(activeTab === 'NOTIF' ? null : 'NOTIF')} 
          className="relative w-12 h-12 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 flex items-center justify-center text-xl hover:scale-105 active:scale-95 transition-all"
        >
          🔔
          {unreadNotifs > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white dark:border-gray-800 animate-bounce shadow-sm">
              {unreadNotifs > 9 ? '9+' : unreadNotifs}
            </span>
          )}
        </button>

      </div>

      {/* ========================================= */}
      {/* POPUP HIỂN THỊ DANH SÁCH (Glassmorphism) */}
      {/* ========================================= */}
      {activeTab && (
        <>
          {/* Overlay tàng hình để click ra ngoài đóng Popup */}
          <div className="fixed inset-0 z-40" onClick={() => setActiveTab(null)}></div>
          
          <div className="absolute top-20 right-6 w-80 max-h-[60vh] bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl shadow-2xl rounded-3xl border border-gray-100 dark:border-gray-700 flex flex-col z-50 animate-in slide-in-from-top-4 fade-in duration-200 overflow-hidden">
            
            {/* Header */}
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
              <h3 className="font-black text-sm uppercase tracking-wider text-gray-800 dark:text-white">
                {activeTab === 'NOTIF' ? 'Thông báo hệ thống' : 'Hòm thư của bạn'}
              </h3>
              <button onClick={() => setActiveTab(null)} className="text-gray-400 hover:text-red-500 transition-colors w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">✕</button>
            </div>

            {/* List Content */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 no-scrollbar">
              
              {/* ================= RENDER THÔNG BÁO ================= */}
              {activeTab === 'NOTIF' && notifications.map(n => {
                const isRead = n.readBy?.includes(phone);
                return (
                  <div 
                    key={n.id} 
                    onClick={() => handleMarkAsRead(n, 'notifications')}
                    className={`p-4 rounded-2xl cursor-pointer transition-all border ${
                      isRead 
                        ? 'bg-transparent border-gray-100 dark:border-gray-700 opacity-70' 
                        : 'bg-blue-50/50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 shadow-sm'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1.5">
                      <span className="font-bold text-sm text-gray-800 dark:text-gray-100">{n.title}</span>
                      {!isRead && <span className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-1 flex-shrink-0 animate-pulse"></span>}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">{n.content}</p>
                    <p className="text-[9px] text-gray-400 mt-2 uppercase font-bold tracking-widest">
                      {n.createdAt ? new Date(n.createdAt.toDate()).toLocaleDateString('vi-VN') : 'Mới'}
                    </p>
                  </div>
                );
              })}

              {/* ================= RENDER HÒM THƯ ================= */}
              {activeTab === 'MAIL' && mails.map(m => {
                const isRead = m.readBy?.includes(phone);
                // Kiểm tra xem ID của thư này đã nằm trong mảng claimedMails của User chưa
                const isClaimed = userData.claimedMails?.includes(m.id);
                const hasAttachment = m.items && m.items.coins > 0;

                return (
                  <div 
                    key={m.id} 
                    onClick={() => handleMarkAsRead(m, 'mailbox')}
                    className={`p-4 rounded-2xl cursor-pointer transition-all border ${
                      isRead 
                        ? 'bg-gray-50 border-gray-100 dark:bg-gray-900/50 dark:border-gray-800' 
                        : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800 shadow-md shadow-yellow-100/50 dark:shadow-none'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold text-sm text-gray-800 dark:text-gray-100">{m.title}</span>
                      {!isRead && <span className="w-2.5 h-2.5 rounded-full bg-red-500 mt-1 flex-shrink-0 animate-pulse"></span>}
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 whitespace-pre-wrap">{m.content}</p>
                    
                    {/* KHU VỰC NHẬN ĐÍNH KÈM */}
                    {hasAttachment && (
                      <div className="pt-3 border-t border-dashed border-gray-200 dark:border-gray-700 flex justify-between items-center mt-2">
                        <span className="text-[10px] font-black text-yellow-600 dark:text-yellow-400 uppercase tracking-widest bg-yellow-100 dark:bg-yellow-900/50 px-2 py-1 rounded-lg">
                          +{m.items.coins} XU
                        </span>
                        <button 
                          disabled={isClaimed || claimingId === m.id}
                          // stopPropagation để không kích hoạt hàm handleMarkAsRead khi bấm nút Nhận
                          onClick={(e) => { e.stopPropagation(); handleClaimAttachment(m); }}
                          className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all ${
                            isClaimed 
                              ? 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed' 
                              : 'bg-gray-900 text-white hover:bg-black active:scale-95 shadow-md dark:bg-yellow-500 dark:hover:bg-yellow-600'
                          }`}
                        >
                          {claimingId === m.id ? 'Đang xử lý...' : isClaimed ? 'Đã nhận' : 'Nhận đính kèm'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* ================= EMPTY STATES ================= */}
              {activeTab === 'NOTIF' && notifications.length === 0 && (
                <div className="text-center py-12 opacity-40">
                  <span className="text-4xl block mb-3">🔕</span>
                  <p className="text-xs font-bold uppercase tracking-widest">Không có thông báo mới</p>
                </div>
              )}
              
              {activeTab === 'MAIL' && mails.length === 0 && (
                <div className="text-center py-12 opacity-40">
                  <span className="text-4xl block mb-3">📭</span>
                  <p className="text-xs font-bold uppercase tracking-widest">Hòm thư trống</p>
                </div>
              )}

            </div>
          </div>
        </>
      )}
    </>
  );
};

export default NotificationCenter;