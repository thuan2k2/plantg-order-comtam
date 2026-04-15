import { db } from '../firebase/config';
import { 
  collection, doc, setDoc, updateDoc, deleteDoc, 
  onSnapshot, query, orderBy, serverTimestamp, addDoc, getDocs, writeBatch 
} from 'firebase/firestore';

const CHAT_COLLECTION = 'support_chats';

// 1. Khởi tạo thông tin phòng chat ở Document chính
export const startChat = async (phone, name, avatarUrl = '', orderId = null) => {
  const chatRef = doc(db, CHAT_COLLECTION, phone);
  
  await setDoc(chatRef, {
    userPhone: phone,
    userName: name || 'Khách hàng',
    userAvatar: avatarUrl,
    orderId: orderId,
    unreadAdmin: true,
    unreadUser: false,
    lastUpdated: serverTimestamp() // Trường quan trọng để sắp xếp danh sách Admin
  }, { merge: true }); 
};

// 2. Gửi tin nhắn mới (Đã tối ưu hóa đồng bộ Web-Telegram)
export const sendMessage = async (chatId, sender, text) => {
  const chatRef = doc(db, CHAT_COLLECTION, chatId);
  const messagesRef = collection(db, CHAT_COLLECTION, chatId, 'messages');

  try {
    // Bước 1: Thêm tin nhắn vào Subcollection
    // Sử dụng toUpperCase để đồng nhất dữ liệu ('USER' hoặc 'ADMIN')
    const senderUpper = sender.toUpperCase();
    
    await addDoc(messagesRef, {
      sender: senderUpper,
      text: text,
      createdAt: serverTimestamp()
    });

    // Bước 2: Cập nhật Document chính để thông báo & sắp xếp lại danh sách
    await updateDoc(chatRef, {
      unreadAdmin: senderUpper === 'USER',
      unreadUser: senderUpper === 'ADMIN',
      lastUpdated: serverTimestamp() // Cập nhật để hội thoại nhảy lên đầu cột trái Admin
    });
  } catch (error) {
    console.error("Lỗi khi gửi tin nhắn:", error);
    // Nếu lỗi do Document chính không tồn tại (trường hợp admin search SĐT lạ), hãy tạo nó
    if (error.code === 'not-found') {
        await startChat(chatId, 'Khách hàng');
        return sendMessage(chatId, sender, text);
    }
  }
};

// 3. Đánh dấu đã đọc
export const markRead = async (chatId, role) => {
  const chatRef = doc(db, CHAT_COLLECTION, chatId);
  try {
    const roleUpper = role.toUpperCase();
    if (roleUpper === 'ADMIN') {
      await updateDoc(chatRef, { unreadAdmin: false });
    } else {
      await updateDoc(chatRef, { unreadUser: false });
    }
  } catch (error) {
    console.warn("Lỗi đánh dấu đã đọc:", error.message);
  }
};

// 4. Kết thúc và Xóa sạch dữ liệu (Sử dụng WriteBatch)
export const closeChat = async (chatId) => {
  try {
    const messagesRef = collection(db, CHAT_COLLECTION, chatId, "messages");
    const snapshot = await getDocs(messagesRef);
    
    const batch = writeBatch(db);
    
    // Xóa sạch subcollection messages
    snapshot.docs.forEach((messageDoc) => {
      batch.delete(messageDoc.ref);
    });
    
    // Reset trạng thái ở document chính
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

// 5. Lắng nghe toàn bộ chat cho Admin
export const subscribeToAdminChats = (callback) => {
  const q = query(collection(db, CHAT_COLLECTION), orderBy('lastUpdated', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const chats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(chats);
  });
};