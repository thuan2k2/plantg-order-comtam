import { db } from '../firebase/config';
import { 
  collection, doc, setDoc, updateDoc, deleteDoc, 
  onSnapshot, query, orderBy, serverTimestamp, addDoc, getDocs, writeBatch
} from 'firebase/firestore';

const CHAT_COLLECTION = 'support_chats';

// 1. Khởi tạo thông tin phòng chat ở Document chính
export const startChat = async (phone, name, avatarUrl = '', orderId = null) => {
  const chatRef = doc(db, CHAT_COLLECTION, phone);
  
  // Chúng ta không lưu mảng messages ở đây nữa
  await setDoc(chatRef, {
    userPhone: phone,
    userName: name || 'Khách hàng',
    userAvatar: avatarUrl,
    orderId: orderId,
    unreadAdmin: true,
    unreadUser: false,
    lastUpdated: serverTimestamp()
  }, { merge: true }); 
};

// 2. Gửi tin nhắn mới (Cập nhật lưu vào Subcollection)
export const sendMessage = async (chatId, sender, text) => {
  const chatRef = doc(db, CHAT_COLLECTION, chatId);
  const messagesRef = collection(db, CHAT_COLLECTION, chatId, 'messages');

  try {
    // Bước 1: Thêm tin nhắn mới vào Subcollection 'messages'
    // Lưu ý: Dùng serverTimestamp cho đồng bộ
    await addDoc(messagesRef, {
      sender: sender.toUpperCase(), // 'USER' hoặc 'ADMIN'
      text: text,
      createdAt: serverTimestamp()
    });

    // Bước 2: Cập nhật trạng thái chưa đọc ở Document chính
    await updateDoc(chatRef, {
      unreadAdmin: sender.toUpperCase() === 'USER',
      unreadUser: sender.toUpperCase() === 'ADMIN',
      lastUpdated: serverTimestamp()
    });
  } catch (error) {
    console.error("Lỗi khi gửi tin nhắn:", error);
  }
};

// 3. Đánh dấu đã đọc
export const markRead = async (chatId, role) => {
  const chatRef = doc(db, CHAT_COLLECTION, chatId);
  try {
    if (role === 'ADMIN') {
      await updateDoc(chatRef, { unreadAdmin: false });
    } else {
      await updateDoc(chatRef, { unreadUser: false });
    }
  } catch (error) {
    console.warn("Lỗi đánh dấu đã đọc (có thể do document chưa tạo):", error);
  }
};

// 4. Kết thúc và Xóa sạch dữ liệu (Sử dụng WriteBatch để xóa Subcollection)
export const closeChat = async (chatId) => {
  try {
    const messagesRef = collection(db, CHAT_COLLECTION, chatId, "messages");
    const snapshot = await getDocs(messagesRef);
    
    const batch = writeBatch(db);
    
    // Xóa sạch lịch sử tin nhắn
    snapshot.docs.forEach((messageDoc) => {
      batch.delete(messageDoc.ref);
    });
    
    // Đặt lại trạng thái phòng chat thay vì xóa hoàn toàn document 
    // để giữ lại avatar/tên cho lần chat sau
    const chatDocRef = doc(db, CHAT_COLLECTION, chatId);
    batch.update(chatDocRef, {
      unreadUser: false,
      unreadAdmin: false,
      lastUpdated: serverTimestamp()
    });
    
    await batch.commit();
  } catch (error) {
    console.error("Lỗi khi xóa dữ liệu chat:", error);
  }
};

// 5. Lắng nghe toàn bộ chat cho Admin (Chỉ lấy meta data)
export const subscribeToAdminChats = (callback) => {
  const q = query(collection(db, CHAT_COLLECTION), orderBy('lastUpdated', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const chats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(chats);
  });
};