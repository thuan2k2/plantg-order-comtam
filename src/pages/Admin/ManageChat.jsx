import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, doc, getDoc, setDoc, serverTimestamp, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { sendMessage, markRead } from '../../services/chatService'; 

const ManageChat = () => {
  const [chats, setChats] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [activeMessages, setActiveMessages] = useState([]); 
  const [reply, setReply] = useState('');
  const [searchPhone, setSearchPhone] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const [quickReplies, setQuickReplies] = useState([]);
  const [showQuickMenu, setShowQuickMenu] = useState(false);

  const audioRef = useRef(new Audio('/status-update.mp3'));
  const messagesEndRef = useRef(null);
  const prevChatsRef = useRef([]);

  useEffect(() => {
    audioRef.current.volume = 0.5;
  }, []);

  // 1. LẮNG NGHE DANH SÁCH CHAT
  useEffect(() => {
    const q = query(collection(db, 'support_chats'), orderBy('lastUpdated', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const newChats = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // LOGIC CHUÔNG MỚI
      newChats.forEach(newChat => {
        const oldChat = prevChatsRef.current.find(c => c.id === newChat.id);
        if (newChat.unreadAdmin) {
          if (!oldChat || !oldChat.unreadAdmin || (newChat.lastUpdated?.toMillis() !== oldChat.lastUpdated?.toMillis())) {
            audioRef.current.play().catch(e => console.log("Chuông bị chặn:", e));
          }
        }
      });

      prevChatsRef.current = newChats;
      setChats(newChats);
    });
    return () => unsubscribe();
  }, []);

  // 2. LẮNG NGHE TIN NHẮN TỪ SUBCOLLECTION
  useEffect(() => {
    if (!activeId) {
      setActiveMessages([]);
      return;
    }
    
    const q = query(
      collection(db, 'support_chats', activeId, 'messages'),
      orderBy('createdAt', 'asc')
    );
    
    const unsub = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setActiveMessages(msgs);
    });
    
    return () => unsub();
  }, [activeId]);

  // Lắng nghe danh sách Tin nhắn nhanh
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system', 'quick_replies'), (doc) => {
      if (doc.exists()) {
        setQuickReplies(doc.data().list || []);
      }
    });
    return () => unsub();
  }, []);

  // 3. FIX: TÌM KIẾM SĐT (Cho phép khách chưa đăng ký tài khoản)
  const handleInstantSearch = async (val) => {
    setSearchPhone(val);
    const cleanPhone = val.trim();
    
    if (cleanPhone.length >= 10) {
      setIsSearching(true);
      try {
        const userRef = doc(db, 'users', cleanPhone);
        const userSnap = await getDoc(userRef);

        // Lấy data hoặc khởi tạo đối tượng rỗng
        const userData = userSnap.exists() ? userSnap.data() : {};
        const chatId = cleanPhone; 

        const chatRef = doc(db, 'support_chats', chatId);
        const chatSnap = await getDoc(chatRef);

        if (!chatSnap.exists()) {
          await setDoc(chatRef, {
            userPhone: cleanPhone,
            userName: userData.fullName || 'Khách vãng lai',
            userAvatar: userData.avatarUrl || '',
            lastUpdated: serverTimestamp(),
            unreadAdmin: false,
            unreadUser: false
          });
        }
        
        setActiveId(chatId);
        setSearchPhone(''); 
      } catch (error) {
        console.error("Lỗi tìm khách:", error);
      } finally {
        setIsSearching(false);
      }
    }
  };

  const activeChat = chats.find(c => c.id === activeId);

  // Auto-scroll xuống cuối
  useEffect(() => {
    if (activeMessages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeMessages]);

  const handleReply = async (e) => {
    e.preventDefault();
    if (!reply.trim() || !activeId) return;
    await sendMessage(activeId, 'ADMIN', reply);
    setReply('');
  };

  const handleSendQuickReply = async (text) => {
    if (!activeId) return;
    await sendMessage(activeId, 'ADMIN', text);
    setShowQuickMenu(false);
  };

  // 4. HÀM ĐÓNG CHAT SỬ DỤNG BATCH
  const handleCloseChat = async (id) => {
    if (window.confirm("Xóa hội thoại này khỏi danh sách quản lý?")) {
      try {
        const messagesRef = collection(db, "support_chats", id, "messages");
        const snapshot = await getDocs(messagesRef);
        
        const batch = writeBatch(db);
        
        snapshot.docs.forEach((messageDoc) => {
          batch.delete(messageDoc.ref);
        });
        
        const chatDocRef = doc(db, "support_chats", id);
        batch.update(chatDocRef, {
          unreadUser: false,
          unreadAdmin: false
        });
        
        await batch.commit();
        setActiveId(null); 
        
      } catch (error) {
        console.error("Lỗi khi đóng chat:", error);
      }
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showQuickMenu && !e.target.closest('.quick-reply-container')) {
        setShowQuickMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showQuickMenu]);

  return (
    <div className="flex h-[calc(100vh-140px)] bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden transition-all duration-500">
      
      {/* CỘT TRÁI: DANH SÁCH & TÌM KIẾM */}
      <div className="w-full md:w-1/3 border-r border-gray-100 dark:border-gray-700 flex flex-col bg-gray-50/30 dark:bg-gray-900/20">
        
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="relative">
            <input 
              type="tel"
              placeholder="Tìm SĐT khách (Gõ đủ 10 số)..."
              value={searchPhone}
              onChange={e => handleInstantSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-100 dark:bg-gray-700 dark:text-white rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30">🔍</span>
            {isSearching && <div className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar">
          {chats.length === 0 && !activeId && (
            <div className="p-10 text-center opacity-30 italic text-xs font-bold dark:text-white">Không có hội thoại</div>
          )}

          {chats.map(c => (
            <div 
              key={c.id} 
              onClick={() => { setActiveId(c.id); markRead(c.id, 'ADMIN'); }}
              className={`p-5 cursor-pointer border-b border-gray-50 dark:border-gray-700/50 transition-all flex items-center gap-4 ${activeId === c.id ? 'bg-blue-600 text-white' : 'hover:bg-white dark:hover:bg-gray-800 bg-transparent'}`}
            >
              <div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-white shadow-sm flex-shrink-0 bg-white">
                <img src={c.userAvatar || `https://ui-avatars.com/api/?name=${c.userName}&background=random`} className="w-full h-full object-cover" alt="avt" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center">
                  <p className={`font-black text-xs uppercase truncate ${activeId === c.id ? 'text-white' : 'text-gray-800 dark:text-gray-200'}`}>{c.userName}</p>
                  {c.unreadAdmin && <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse border-2 border-white"></span>}
                </div>
                <p className={`text-[10px] font-bold mt-1 ${activeId === c.id ? 'text-blue-100' : 'text-gray-400'}`}>{c.userPhone}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CỘT PHẢI: NỘI DUNG CHAT */}
      <div className="hidden md:flex flex-1 flex-col bg-white dark:bg-gray-800 relative">
        {activeChat ? (
          <>
            {/* Header phòng chat */}
            <div className="p-4 px-8 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-white/80 dark:bg-gray-800/80 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-200">
                  <img src={activeChat.userAvatar || `https://ui-avatars.com/api/?name=${activeChat.userName}&background=random`} alt="avt" />
                </div>
                <div>
                   <p className="font-black uppercase text-xs text-gray-800 dark:text-white leading-none">{activeChat.userName}</p>
                   <p className="text-[9px] font-bold text-green-500 mt-1.5 uppercase tracking-widest">Đang trực tuyến</p>
                </div>
              </div>
              <button 
                onClick={() => handleCloseChat(activeId)} 
                className="text-[10px] font-black text-red-500 uppercase px-4 py-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-all border border-red-100 dark:border-red-900/30"
              >
                Đóng hỗ trợ
              </button>
            </div>
            
            {/* FIX: Hiển thị tin nhắn từ activeMessages */}
            <div className="flex-1 p-8 overflow-y-auto space-y-6 bg-gray-50/20 dark:bg-gray-900/10 no-scrollbar">
              {activeMessages && activeMessages.length > 0 ? (
                activeMessages.map((m, i) => {
                  const isAdmin = m.sender?.toUpperCase() === 'ADMIN';
                  return (
                    <div key={i} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
                      <div className={`max-w-[70%] px-5 py-3 rounded-[1.5rem] text-sm font-medium leading-relaxed shadow-sm ${
                        isAdmin 
                          ? 'bg-blue-600 text-white rounded-tr-none shadow-blue-100' 
                          : 'bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 text-gray-800 dark:text-gray-100 rounded-tl-none'
                      }`}>
                        {m.text}
                        <p className={`text-[8px] mt-1.5 font-bold uppercase opacity-50 ${isAdmin ? 'text-right' : 'text-left'}`}>
                          {m.createdAt ? new Date(m.createdAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Vừa xong'}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="h-full flex items-center justify-center text-gray-300 italic text-xs">
                    Chưa có tin nhắn nào trong cuộc hội thoại này.
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Form trả lời */}
            <form onSubmit={handleReply} className="p-6 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 flex gap-4">
              
              <div className="relative quick-reply-container flex items-center">
                <button 
                  type="button"
                  onClick={() => setShowQuickMenu(!showQuickMenu)}
                  className="w-12 h-12 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all text-xl"
                  title="Gửi tin nhắn nhanh"
                >
                  ⚡
                </button>
                
                {showQuickMenu && (
                  <div className="absolute bottom-full mb-4 left-0 w-80 bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden animate-in slide-in-from-bottom-2 z-50">
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700 text-[10px] font-black uppercase text-gray-400 tracking-widest">
                      Chọn tin nhắn nhanh ({quickReplies.length})
                    </div>
                    {quickReplies.length === 0 ? (
                       <div className="p-6 text-center text-xs text-gray-400 italic">Chưa có mẫu nào. Hãy thêm trong phần Cài đặt.</div>
                    ) : (
                      <div className="max-h-60 overflow-y-auto no-scrollbar">
                        {quickReplies.map((text, i) => (
                          <button 
                            key={i} 
                            type="button"
                            onClick={() => handleSendQuickReply(text)}
                            className="w-full text-left p-4 text-sm font-bold border-b border-gray-50 dark:border-gray-700/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-700 dark:text-gray-200 transition-colors"
                          >
                            {text}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <input 
                value={reply} 
                onChange={e => setReply(e.target.value)} 
                placeholder="Nhập nội dung phản hồi..." 
                className="flex-1 bg-gray-100 dark:bg-gray-700 dark:text-white border-none rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/50 transition-all" 
              />
              <button type="submit" className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-blue-200 dark:shadow-none hover:bg-blue-700">
                Gửi ngay
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center flex-col text-gray-200">
            <div className="w-40 h-40 bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center text-7xl mb-8 shadow-inner animate-pulse">💬</div>
            <p className="font-black uppercase text-xs tracking-[0.4em] text-gray-300 dark:text-gray-600">Trung tâm tin nhắn hỗ trợ</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageChat;