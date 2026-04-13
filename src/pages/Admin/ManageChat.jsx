import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { sendMessage, markRead, closeChat } from '../../services/chatService';

const ManageChat = () => {
  const [chats, setChats] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [reply, setReply] = useState('');

  // 1. Khai báo Refs cho âm thanh và cuộn trang
  const audioRef = useRef(new Audio('/status-update.mp3')); // Đổi sang file trong public
  const messagesEndRef = useRef(null);
  const prevChatsRef = useRef([]); 

  useEffect(() => {
    audioRef.current.volume = 0.5;
  }, []);

  // 2. Lắng nghe dữ liệu và phát âm thanh khi có khách nhắn tin
  useEffect(() => {
    const q = query(collection(db, 'support_chats'), orderBy('lastUpdated', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snap) => {
      const newChats = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Kiểm tra tin nhắn mới từ khách hàng
      newChats.forEach(newChat => {
        const oldChat = prevChatsRef.current.find(c => c.id === newChat.id);
        
        if (!oldChat || newChat.messages.length > oldChat.messages.length) {
          const lastMsg = newChat.messages[newChat.messages.length - 1];
          // Chỉ phát chuông nếu là tin nhắn mới từ phía USER
          if (lastMsg && lastMsg.sender === 'USER') {
            audioRef.current.play().catch(e => console.log("Chuông bị chặn:", e));
          }
        }
      });

      prevChatsRef.current = newChats;
      setChats(newChats);
    });

    return () => unsubscribe();
  }, []);

  const activeChat = chats.find(c => c.id === activeId);

  // 3. Tự động cuộn xuống khi có tin nhắn mới
  useEffect(() => {
    if (activeChat) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeChat?.messages]);

  const handleReply = async (e) => {
    e.preventDefault();
    if (!reply.trim() || !activeId) return;
    await sendMessage(activeId, 'ADMIN', reply);
    setReply('');
  };

  const handleCloseChat = async (id) => {
    if (window.confirm("Hoàn thành hỗ trợ và xóa vĩnh viễn đoạn chat này?")) {
      await closeChat(id);
      setActiveId(null);
    }
  };

  return (
    <div className="flex h-[calc(100vh-180px)] min-h-[600px] bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden animate-in fade-in duration-500">
      
      {/* DANH SÁCH KHÁCH ĐANG CHỜ HỖ TRỢ */}
      <div className="w-1/3 border-r border-gray-100 overflow-y-auto bg-gray-50/50">
        <div className="p-6 border-b border-gray-100 bg-white sticky top-0 z-10">
          <h3 className="font-black uppercase text-xs tracking-widest text-gray-400">Tin nhắn hỗ trợ</h3>
        </div>

        {chats.length === 0 && (
          <div className="p-10 text-center flex flex-col items-center gap-3">
            <span className="text-3xl grayscale opacity-30">📭</span>
            <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest leading-relaxed">Không có yêu cầu <br/> hỗ trợ hiện tại</p>
          </div>
        )}

        {chats.map(c => (
          <div 
            key={c.id} 
            onClick={() => { setActiveId(c.id); markRead(c.id, 'ADMIN'); }}
            className={`p-5 cursor-pointer border-b border-gray-50 transition-all flex items-center gap-4 ${activeId === c.id ? 'bg-blue-600 text-white' : 'hover:bg-white bg-transparent'}`}
          >
            {/* Avatar trong danh sách */}
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-sm flex-shrink-0 bg-white">
              <img 
                src={c.userAvatar || `https://ui-avatars.com/api/?name=${c.userName}&background=random`} 
                className="w-full h-full object-cover"
                alt="avt"
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center mb-0.5">
                <p className={`font-black text-xs uppercase truncate ${activeId === c.id ? 'text-white' : 'text-gray-800'}`}>
                  {c.userName}
                </p>
                {c.unreadAdmin && (
                  <span className="w-2.5 h-2.5 bg-red-500 rounded-full shadow-sm animate-pulse border-2 border-white"></span>
                )}
              </div>
              <p className={`text-[10px] font-bold ${activeId === c.id ? 'text-blue-100' : 'text-gray-400'}`}>
                {c.userPhone}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* NỘI DUNG ĐOẠN CHAT */}
      <div className="flex-1 flex flex-col bg-white">
        {activeChat ? (
          <>
            {/* Header phòng chat */}
            <div className="p-4 px-6 border-b border-gray-100 flex justify-between items-center bg-white shadow-sm z-10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-100 bg-gray-50">
                  <img src={activeChat.userAvatar || `https://ui-avatars.com/api/?name=${activeChat.userName}&background=random`} alt="avt" />
                </div>
                <div>
                   <p className="font-black uppercase text-[11px] text-gray-800 leading-none">{activeChat.userName}</p>
                   <p className="text-[9px] font-bold text-green-500 mt-1 uppercase tracking-widest">Đang kết nối</p>
                </div>
              </div>
              <button 
                onClick={() => handleCloseChat(activeId)} 
                className="text-[9px] font-black text-red-500 uppercase border border-red-100 px-4 py-2 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm active:scale-95"
              >
                Hoàn tất & Xóa
              </button>
            </div>
            
            {/* Vùng tin nhắn */}
            <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-gray-50/30 no-scrollbar">
              {activeChat.messages.map((m, i) => {
                const isAdmin = m.sender === 'ADMIN';
                return (
                  <div key={i} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm font-medium leading-relaxed shadow-sm ${
                      isAdmin 
                        ? 'bg-gray-900 text-white rounded-tr-none' 
                        : 'bg-white border border-gray-100 text-gray-800 rounded-tl-none'
                    }`}>
                      {m.text}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input trả lời */}
            <form onSubmit={handleReply} className="p-4 border-t border-gray-100 bg-white flex gap-3">
              <input 
                value={reply} 
                onChange={e => setReply(e.target.value)} 
                placeholder="Nhập nội dung phản hồi khách hàng..." 
                className="flex-1 bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-gray-300" 
              />
              <button type="submit" className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-blue-100">
                GỬI TIN
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center flex-col text-gray-200">
            <div className="w-32 h-32 bg-gray-50 rounded-full flex items-center justify-center text-6xl mb-6 shadow-inner animate-bounce duration-[2000ms]">
               💬
            </div>
            <p className="font-black uppercase text-[10px] tracking-[0.4em] text-gray-300">Chọn một hội thoại để bắt đầu</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageChat;