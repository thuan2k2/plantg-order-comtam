import { db } from '../firebase/config';
import { 
  collection, doc, setDoc, updateDoc, deleteDoc, 
  onSnapshot, query, orderBy, serverTimestamp, arrayUnion, getDocs 
} from 'firebase/firestore';

const CHAT_COLLECTION = 'support_chats';

// 1. Khởi tạo hoặc lấy phòng chat (Dùng SĐT làm ID)
export const startChat = async (phone, name, orderId = null) => {
  const chatRef = doc(db, CHAT_COLLECTION, phone);
  await setDoc(chatRef, {
    userPhone: phone,
    userName: name || 'Khách vãng lai',
    orderId: orderId,
    messages: [],
    unreadAdmin: true,
    unreadUser: false,
    lastUpdated: serverTimestamp()
  }, { merge: true }); // Dùng merge để không xóa tin cũ nếu lỡ tay bấm lại
};

// 2. Gửi tin nhắn mới
export const sendMessage = async (chatId, sender, text) => {
  const chatRef = doc(db, CHAT_COLLECTION, chatId);
  await updateDoc(chatRef, {
    messages: arrayUnion({
      sender, // 'USER' hoặc 'ADMIN'
      text,
      time: new Date().getTime()
    }),
    unreadAdmin: sender === 'USER',
    unreadUser: sender === 'ADMIN',
    lastUpdated: serverTimestamp()
  });
};

// 3. Đánh dấu đã đọc
export const markRead = async (chatId, role) => {
  const chatRef = doc(db, CHAT_COLLECTION, chatId);
  if (role === 'ADMIN') await updateDoc(chatRef, { unreadAdmin: false });
  else await updateDoc(chatRef, { unreadUser: false });
};

// 4. Kết thúc và Xóa sạch dữ liệu (Tiết kiệm bộ nhớ)
export const closeChat = async (chatId) => {
  await deleteDoc(doc(db, CHAT_COLLECTION, chatId));
};