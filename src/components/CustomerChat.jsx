import React, { useState, useEffect, useRef } from 'react';
import { startChat, sendMessage, closeChat, markRead } from '../services/chatService';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';

const CustomerChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [chat, setChat] = useState(null);
  const [input, setInput] = useState('');
  
  // 1. Khai báo các Ref xử lý âm thanh và cuộn trang
  const audioRef = useRef(new Audio('/notification.mp3'));
  const messagesEndRef = useRef(null);
  const msgCountRef = useRef(0);

  // Lấy SĐT từ localStorage (Đồng bộ với hệ thống cũ của bạn)
  const savedPhones = JSON.parse(localStorage.getItem('recentPhones') || '[]');
  const userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
  const phone = savedPhones[0];

  // 2. Lắng nghe tin nhắn và phát âm thanh
  useEffect(() => {
    if (!phone) return;
    
    const unsub = onSnapshot(doc(db, 'support_chats', phone), (snap) => {
      const newData = snap.data();

      if (newData && newData.messages) {
        const currentLen = newData.messages.length;
        
        // Chỉ phát âm thanh nếu có tin MỚI và không phải lần load trang đầu tiên
        if (currentLen > msgCountRef.current && msgCountRef.current !== 0) {
          const lastMsg = newData.messages[currentLen - 1];
          if (lastMsg.sender === 'ADMIN') {
            audioRef.current.play().catch(err => console.log("Trình duyệt chặn Autoplay:", err));
          }
        }
        msgCountRef.current = currentLen; // Cập nhật lại số lượng tin nhắn hiện tại
      }

      setChat(newData);
      if (isOpen && newData?.unreadUser) markRead(phone, 'USER');
    });
    
    return () => unsub();
  }, [phone, isOpen]);

  // 3. Tự động cuộn xuống cuối khi có tin nhắn mới hoặc mở chat
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chat?.messages, isOpen]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    if (!chat) await startChat(phone, userProfile.fullName);
    await sendMessage(phone, 'USER', input);
    setInput('');
  };

  if (!phone) return null; // Không hiện chat nếu chưa biết khách là ai

  return (
    <div className="fixed bottom-6 right-6 z-[9999]">
      {/* Cửa sổ chat */}
      {isOpen && (
        <div className="absolute bottom-20 right-0 w-80 h-[450px] bg-white dark:bg-gray-800 shadow-2xl rounded-[2rem] flex flex-col overflow-hidden border border-gray-100 dark:border-gray-700 animate-in slide-in-from-bottom-10">
          <div className="bg-blue-600 p-4 text-white font-black uppercase text-xs tracking-widest flex justify-between items-center shadow-md z-10">
            <span>Hỗ trợ trực tuyến</span>
            <button onClick={() => setIsOpen(false)} className="hover:scale-110 transition-transform">✕</button>
          </div>
          
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-gray-50 dark:bg-gray-900/50">
            {chat?.messages.map((m, i) => (
              <div key={i} className={`flex ${m.sender === 'USER' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${m.sender === 'USER' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white dark:bg-gray-700 dark:text-white rounded-tl-none shadow-sm border border-gray-100 dark:border-gray-600'}`}>
                  {m.text}
                </div>
              </div>
            ))}
            {/* Điểm neo để cuộn xuống */}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSend} className="p-3 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 flex gap-2">
            <input 
              value={input} 
              onChange={e => setInput(e.target.value)} 
              placeholder="Nhập tin nhắn..." 
              className="flex-1 bg-gray-100 dark:bg-gray-700 dark:text-white border-none rounded-xl px-4 py-2 text-sm outline-none placeholder:text-gray-400" 
            />
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-xl font-black text-xs active:scale-95 transition-transform shadow-md shadow-blue-200 dark:shadow-none">
              GỬI
            </button>
          </form>
        </div>
      )}

      {/* Nút tròn bong bóng */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-16 h-16 bg-blue-600 text-white rounded-full shadow-xl shadow-blue-200 dark:shadow-black/50 flex items-center justify-center relative hover:scale-105 transition-transform active:scale-95"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
        
        {/* Chấm đỏ thông báo */}
        {chat?.unreadUser && !isOpen && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 border-4 border-white dark:border-gray-900 rounded-full animate-bounce"></span>
        )}
      </button>
    </div>
  );
};

export default CustomerChat;