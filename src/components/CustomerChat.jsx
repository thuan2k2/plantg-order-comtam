import React, { useState, useEffect, useRef } from 'react';
import { sendMessage, markRead } from '../services/chatService';
import { collection, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import UserAvatar from './UserAvatar'; 
import VipBadge from './VipBadge'; // <-- NHÚNG COMPONENT VIP BADGE
import { getRankInfo } from '../utils/rankUtils'; // <-- NHÚNG HÀM TÍNH RANK

const CustomerChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [chatData, setChatData] = useState(null); 
  const [messages, setMessages] = useState([]); 
  const [input, setInput] = useState('');
  
  // State lưu dữ liệu User để lấy Rank
  const [userData, setUserData] = useState(null);

  const audioRef = useRef(new Audio('/status-update.mp3'));
  const messagesEndRef = useRef(null);
  const msgCountRef = useRef(0);

  const savedPhones = JSON.parse(localStorage.getItem('recentPhones') || '[]');
  const userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
  const phone = savedPhones[0];

  // Tính toán Rank Info
  const rankInfo = userData ? getRankInfo(userData.totalSpend || 0, userData.manualRankId) : null;

  // 0. LẮNG NGHE DỮ LIỆU USER ĐỂ TÍNH RANK
  useEffect(() => {
    if (!phone) return;
    const unsubUser = onSnapshot(doc(db, 'users', phone), (snap) => {
      if (snap.exists()) {
        setUserData(snap.data());
      }
    });
    return () => unsubUser();
  }, [phone]);

  // 1. LẮNG NGHE TRẠNG THÁI PHÒNG CHAT
  useEffect(() => {
    if (!phone) return;
    const unsubDoc = onSnapshot(doc(db, 'support_chats', phone), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setChatData(data);
        if (isOpen && data.unreadUser) {
          markRead(phone, 'USER');
        }
      } else {
        // Nếu bị Admin xóa chat, reset data hiển thị
        setChatData(null);
      }
    });
    return () => unsubDoc();
  }, [phone, isOpen]);

  // 2. LẮNG NGHE TIN NHẮN TỪ SUBCOLLECTION
  useEffect(() => {
    if (!phone) return;
    
    const q = query(collection(db, 'support_chats', phone, 'messages'), orderBy('createdAt', 'asc'));
    const unsubMessages = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(doc => doc.data());
      const currentLen = msgs.length;
      
      // Phát âm thanh khi có tin nhắn mới từ Admin
      if (currentLen > msgCountRef.current && msgCountRef.current !== 0) {
        const lastMsg = msgs[currentLen - 1];
        if (lastMsg?.sender?.toUpperCase() === 'ADMIN') {
          audioRef.current.play().catch(err => console.log("Audio play blocked:", err));
        }
      }
      
      msgCountRef.current = currentLen; 
      setMessages(msgs);
    });
    
    return () => unsubMessages();
  }, [phone]);

  // 3. TỰ ĐỘNG CUỘN XUỐNG CUỐI
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // 4. GỬI TIN NHẮN 
  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    const messageText = input.trim();
    setInput(''); 
    
    try {
      await sendMessage(phone, 'USER', messageText);
    } catch (error) {
      console.error("Lỗi gửi tin nhắn:", error);
    }
  };

  if (!phone) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999]">
      {/* CỬA SỔ CHAT */}
      {isOpen && (
        <div className="absolute bottom-20 right-0 w-80 h-[480px] bg-white dark:bg-gray-800 shadow-2xl rounded-[2.5rem] flex flex-col overflow-hidden border border-gray-100 dark:border-gray-700 animate-in slide-in-from-bottom-10 duration-300">
          
          {/* HEADER CHAT */}
          <div className="bg-blue-600 p-5 text-white flex justify-between items-center shadow-lg z-10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-lg">👨‍🍳</div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest leading-none">Hỗ trợ Plant G</p>
                <p className="text-[9px] font-bold opacity-80 mt-1">Đang trực tuyến</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="w-8 h-8 flex items-center justify-center bg-black/10 rounded-full hover:bg-black/20 transition-colors">✕</button>
          </div>
          
          {/* NỘI DUNG TIN NHẮN */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-50 dark:bg-gray-900/50 no-scrollbar">
            
            {/* MỚI: THÔNG BÁO CẤP BẬC KHÁCH HÀNG VIP ĐẦU TRANG CHAT */}
            {rankInfo && (
               <div className="flex flex-col items-center justify-center pt-2 pb-4 opacity-80 animate-in fade-in">
                  <div className="flex items-center gap-1.5 bg-white dark:bg-gray-800 px-4 py-1.5 rounded-full shadow-sm border border-gray-200 dark:border-gray-700">
                     <VipBadge rankInfo={rankInfo} size="w-4 h-4" />
                     <span className="text-[9px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                       Khách hàng {rankInfo.current.name}
                     </span>
                  </div>
               </div>
            )}

            {messages.map((m, i) => {
              const isUser = m.sender?.toUpperCase() === 'USER';
              return (
                <div key={i} className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                  
                  {/* Avatar cạnh tin nhắn - Thay thế bằng UserAvatar cho User */}
                  <div className="flex-shrink-0 mb-1">
                    {isUser ? (
                      <UserAvatar 
                        avatarUrl={userProfile.avatarUrl || `https://ui-avatars.com/api/?name=${userProfile.fullName || 'Khách'}&background=random`}
                        totalSpend={userData?.totalSpend || 0}
                        manualRankId={userData?.manualRankId}
                        size="w-7 h-7"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full overflow-hidden border border-white dark:border-gray-700 shadow-sm">
                        <img 
                          src='/logo-admin.png' 
                          onError={(e) => { e.target.src = 'https://ui-avatars.com/api/?name=Admin&background=000'; }}
                          className="w-full h-full object-cover"
                          alt="admin-avt"
                        />
                      </div>
                    )}
                  </div>

                  {/* Bubble tin nhắn */}
                  <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm font-medium leading-relaxed shadow-sm ${
                    isUser 
                      ? 'bg-blue-600 text-white rounded-br-none' 
                      : 'bg-white dark:bg-gray-700 dark:text-gray-100 rounded-bl-none border border-gray-100 dark:border-gray-600'
                  }`}>
                    {m.text}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* FORM NHẬP TIN */}
          <form onSubmit={handleSend} className="p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 flex gap-2 z-20">
            <input 
              value={input} 
              onChange={e => setInput(e.target.value)} 
              placeholder="Hỏi bếp điều gì đó..." 
              className="flex-1 bg-gray-50 dark:bg-gray-700 dark:text-white border-none rounded-2xl px-5 py-3 text-sm outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/20 transition-all" 
            />
            <button type="submit" className="bg-blue-600 text-white w-12 h-12 rounded-2xl flex items-center justify-center active:scale-90 transition-transform shadow-lg shadow-blue-100 dark:shadow-none">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 rotate-90" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          </form>
        </div>
      )}

      {/* NÚT TRÒN BONG BÓNG */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-16 h-16 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center relative hover:scale-105 transition-all active:scale-95 group"
      >
        <div className="absolute inset-0 bg-blue-600 rounded-full animate-ping opacity-20 group-hover:hidden"></div>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
        
        {/* Chấm đỏ thông báo */}
        {chatData?.unreadUser && !isOpen && (
          <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 border-4 border-white dark:border-gray-900 rounded-full flex items-center justify-center text-[8px] font-black animate-bounce shadow-lg">1</span>
        )}
      </button>
    </div>
  );
};

export default CustomerChat;