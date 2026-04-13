import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { sendMessage, markRead, closeChat } from '../../services/chatService';

const ManageChat = () => {
  const [chats, setChats] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [reply, setReply] = useState('');

  // 1. Khai báo Refs cho âm thanh và cuộn trang
  const audioRef = useRef(new Audio('/notification.mp3'));
  const messagesEndRef = useRef(null);
  const prevChatsRef = useRef([]); // Lưu lại state trước đó để so sánh tin nhắn mới

  // Giảm âm lượng thông báo xuống 50% cho đỡ giật mình
  useEffect(() => {
    audioRef.current.volume = 0.5;
  }, []);

  // 2. Lắng nghe dữ liệu và phát âm thanh
  useEffect(() => {
    const q = query(collection(db, 'support_chats'), orderBy('lastUpdated', 'desc'));
    
    return onSnapshot(q, (snap) => {
      const newChats = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Kiểm tra tin nhắn mới để phát "Ting"
      newChats.forEach(newChat => {
        const oldChat = prevChatsRef.current.find(c => c.id === newChat.id);
        
        // Nếu là chat mới HOẶC số lượng tin nhắn tăng lên
        if (!oldChat || newChat.messages.length > oldChat.messages.length) {
          const lastMsg = newChat.messages[newChat.messages.length - 1];
          // Chỉ phát tiếng nếu tin nhắn đó do khách hàng gửi (USER)
          if (lastMsg && lastMsg.sender === 'USER') {
            audioRef.current.play().catch(e => console.log("Trình duyệt chặn Autoplay:", e));
          }
        }
      });

      prevChatsRef.current = newChats; // Cập nhật lại bản sao cũ
      setChats(newChats);
    });
  }, []);

  const activeChat = chats.find(c => c.id === activeId);

  // 3. Tự động cuộn xuống khi có tin nhắn mới trong phòng đang mở
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
      setActiveId(null); // Trở về màn hình trống
    }
  };

  return (
    <div className="flex h-[600px] bg-white rounded-[2.5rem] shadow-sm border overflow-hidden">
      {/* Danh sách khách */}
      <div className="w-1/3 border-r overflow-y-auto bg-gray-50">
        <div className="p-4 font-black uppercase text-[10px] text-gray-400 tracking-widest border-b">Tin nhắn mới</div>
        {chats.length === 0 && (
          <div className="p-6 text-center text-xs font-bold text-gray-400 italic">Chưa có yêu cầu hỗ trợ nào.</div>
        )}
        {chats.map(c => (
          <div 
            key={c.id} 
            onClick={() => { setActiveId(c.id); markRead(c.id, 'ADMIN'); }}
            className={`p-4 cursor-pointer border-b transition-all ${activeId === c.id ? 'bg-blue-50' : 'hover:bg-white'}`}
          >
            <div className="flex justify-between items-center">
              <p className="font-black text-sm uppercase">{c.userName}</p>
              {c.unreadAdmin && <span className="w-2.5 h-2.5 bg-red-500 rounded-full shadow-sm animate-pulse"></span>}
            </div>
            <p className="text-[10px] text-gray-400 font-bold">{c.userPhone}</p>
          </div>
        ))}
      </div>

      {/* Nội dung chat */}
      <div className="flex-1 flex flex-col">
        {activeChat ? (
          <>
            <div className="p-4 border-b flex justify-between items-center bg-white z-10">
              <p className="font-black uppercase text-sm">{activeChat.userName}</p>
              <button 
                onClick={() => handleCloseChat(activeId)} 
                className="text-[10px] font-black text-red-500 uppercase border border-red-100 px-3 py-1.5 rounded-full hover:bg-red-50 transition-colors"
              >
                Xong & Xóa Chat
              </button>
            </div>
            
            <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-gray-50/50">
              {activeChat.messages.map((m, i) => (
                <div key={i} className={`flex ${m.sender === 'ADMIN' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm ${m.sender === 'ADMIN' ? 'bg-gray-800 text-white rounded-tr-none shadow-md' : 'bg-white border border-gray-100 rounded-tl-none shadow-sm text-gray-800'}`}>
                    {m.text}
                  </div>
                </div>
              ))}
              {/* Điểm neo để cuộn xuống */}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleReply} className="p-4 border-t bg-white flex gap-2">
              <input 
                value={reply} 
                onChange={e => setReply(e.target.value)} 
                placeholder="Nhập phản hồi..." 
                className="flex-1 bg-gray-100 border-none rounded-2xl px-5 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
              />
              <button type="submit" className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-xs active:scale-95 transition-transform shadow-md shadow-blue-200">
                GỬI
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center flex-col text-gray-300">
            <span className="text-6xl mb-4 opacity-50">💬</span>
            <p className="font-black uppercase text-xs tracking-[0.3em]">Chọn một khách hàng để hỗ trợ</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageChat;