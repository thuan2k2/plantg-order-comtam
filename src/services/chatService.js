import { db } from '../firebase/config';
import { 
  collection, doc, setDoc, updateDoc, getDoc,
  onSnapshot, query, orderBy, serverTimestamp, addDoc, getDocs, writeBatch 
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions'; // THÊM THƯ VIỆN NÀY

const CHAT_COLLECTION = 'support_chats';

// 1. Khởi tạo hoặc Cập nhật thông tin phòng chat lấy từ dữ liệu gốc 'users'
export const startChat = async (phone, name = null, avatarUrl = null, orderId = null) => {
  const chatRef = doc(db, CHAT_COLLECTION, phone);
  const userRef = doc(db, 'users', phone);
  
  // Trích xuất dữ liệu từ collection users để đồng bộ thông tin chính xác
  const userSnap = await getDoc(userRef);
  const userData = userSnap.exists() ? userSnap.data() : {};

  await setDoc(chatRef, {
    userPhone: phone,
    // Ưu tiên thông tin từ users, nếu không có mới dùng thông tin truyền vào
    userName: userData.fullName || name || 'Khách hàng',
    userAvatar: userData.avatarUrl || avatarUrl || '',
    orderId: orderId,
    unreadAdmin: true,
    unreadUser: false,
    lastUpdated: serverTimestamp() 
  }, { merge: true }); 
};

// 2. Gửi tin nhắn mới (Đã tối ưu hóa đồng bộ dữ liệu User)
export const sendMessage = async (chatId, sender, text) => {
  const chatRef = doc(db, CHAT_COLLECTION, chatId);
  const messagesRef = collection(db, CHAT_COLLECTION, chatId, 'messages');

  try {
    const senderUpper = sender.toUpperCase();
    
    // Kiểm tra xem phòng chat đã tồn tại chưa
    const chatSnap = await getDoc(chatRef);
    
    if (!chatSnap.exists()) {
      // Nếu chưa có, khởi tạo phòng chat kèm thông tin từ collection users
      await startChat(chatId);
    }

    // Bước 1: Thêm tin nhắn vào Subcollection
    await addDoc(messagesRef, {
      sender: senderUpper,
      text: text,
      createdAt: serverTimestamp()
    });

    // Bước 2: Cập nhật meta-data ở Document chính
    await updateDoc(chatRef, {
      unreadAdmin: senderUpper === 'USER',
      unreadUser: senderUpper === 'ADMIN',
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

// 4. Đóng Chat: Xóa sạch dữ liệu tin nhắn trên Firebase
// Khi hàm này chạy, onSnapshot ở cả Admin và Khách sẽ nhận mảng rỗng và tự xóa giao diện
export const closeChat = async (chatId) => {
  try {
    const messagesRef = collection(db, CHAT_COLLECTION, chatId, "messages");
    const snapshot = await getDocs(messagesRef);
    
    const batch = writeBatch(db);
    
    // Xóa toàn bộ tin nhắn trong subcollection 'messages'
    snapshot.docs.forEach((messageDoc) => {
      batch.delete(messageDoc.ref);
    });
    
    // Cập nhật lại document chính (Reset trạng thái nhưng giữ lại thông tin User để lần sau nhắn tiếp)
    const chatDocRef = doc(db, CHAT_COLLECTION, chatId);
    batch.update(chatDocRef, {
      unreadUser: false,
      unreadAdmin: false,
      lastUpdated: serverTimestamp()
    });
    
    await batch.commit();
    // Sau khi batch hoàn tất, Firebase sẽ phát tín hiệu xóa tới tất cả các bên đang lắng nghe
  } catch (error) {
    console.error("Lỗi khi dọn dẹp dữ liệu chat:", error);
  }
};

// 5. Lắng nghe toàn bộ danh sách Chat cho Admin
export const subscribeToAdminChats = (callback) => {
  const q = query(collection(db, CHAT_COLLECTION), orderBy('lastUpdated', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const chats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(chats);
  });
};

// ============================================================================
// HỆ THỐNG GAMIFICATION & HÒM THƯ (NEW)
// ============================================================================

const functions = getFunctions();

// 6. Giao tiếp với API Nhận đính kèm Hòm thư
export const claimMailboxAttachment = async (phone, mailId) => {
  try {
    const claimFn = httpsCallable(functions, 'claimMailAttachment');
    const result = await claimFn({ phone, mailId });
    return result.data;
  } catch (error) {
    throw error;
  }
};

// 7. Giao tiếp với API Mở hộp quà hàng ngày
export const claimDailyReward = async (phone) => {
  try {
    const giftFn = httpsCallable(functions, 'claimDailyGift');
    const result = await giftFn({ phone });
    return result.data;
  } catch (error) {
    throw error;
  }
};

// 8. Giao tiếp với API Điểm danh 7 ngày
export const claimDailyCheckIn = async (phone) => {
  try {
    const checkInFn = httpsCallable(functions, 'claimDailyCheckIn');
    const result = await checkInFn({ phone });
    return result.data;
  } catch (error) {
    throw error;
  }
};

// ============================================================================
// HÀM TESTING (Dùng để reset giả lập qua ngày mới)
// ============================================================================

// 9. Xóa thời gian nhận quà để test lại
export const resetTestingGamification = async (phone) => {
  try {
    const userRef = doc(db, 'users', phone);
    // Ghi đè các trường thời gian thành null để Frontend và Backend hiểu là chưa nhận
    await updateDoc(userRef, {
      lastDailyGift: null,
      lastCheckIn: null
    });
    console.log("Đã reset thời gian nhận thưởng! Bạn có thể mở lại Hộp quà và Điểm danh.");
    return true;
  } catch (error) {
    console.error("Lỗi khi reset test:", error);
    throw error;
  }
};