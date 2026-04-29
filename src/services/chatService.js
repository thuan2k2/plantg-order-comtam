import { db } from '../firebase/config';
import { 
  collection, doc, setDoc, updateDoc, getDoc,
  onSnapshot, query, orderBy, serverTimestamp, addDoc, getDocs, writeBatch 
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions'; 

const CHAT_COLLECTION = 'support_chats';

// Hàm Ghi Log An Toàn (Đảm bảo lỗi Log không làm sập giao dịch nhận quà)
const safeLogAdmin = async (logData) => {
  try {
    await addDoc(collection(db, 'admin_logs'), { ...logData, createdAt: serverTimestamp() });
  } catch (error) {
    console.warn("Cảnh báo: Không thể ghi log nhưng giao dịch đã hoàn tất thành công", error);
  }
};

/**
 * 1. Khởi tạo hoặc Cập nhật thông tin phòng chat lấy từ dữ liệu gốc 'users'
 * Hỗ trợ Zalo Bridge: Khởi tạo các cờ unread để Bot Zalo và Web Admin cùng theo dõi
 */
export const startChat = async (phone, name = null, avatarUrl = null, orderId = null) => {
  const chatRef = doc(db, CHAT_COLLECTION, phone);
  const userRef = doc(db, 'users', phone);
  
  const userSnap = await getDoc(userRef);
  const userData = userSnap.exists() ? userSnap.data() : {};

  await setDoc(chatRef, {
    userPhone: phone,
    userName: userData.fullName || name || 'Khách hàng',
    userAvatar: userData.avatarUrl || avatarUrl || '',
    orderId: orderId,
    unreadAdmin: true,
    unreadUser: false,
    lastUpdated: serverTimestamp() 
  }, { merge: true }); 
};

/**
 * 2. Gửi tin nhắn mới
 * Cập nhật: Cờ unreadUser sẽ kích hoạt Zalo Bot gửi tin nhắn về điện thoại khách
 */
export const sendMessage = async (chatId, sender, text) => {
  const chatRef = doc(db, CHAT_COLLECTION, chatId);
  const messagesRef = collection(db, CHAT_COLLECTION, chatId, 'messages');

  try {
    const senderUpper = sender.toUpperCase();
    const chatSnap = await getDoc(chatRef);
    
    if (!chatSnap.exists()) {
      await startChat(chatId);
    }

    // Bước 1: Thêm tin nhắn vào Subcollection
    await addDoc(messagesRef, {
      sender: senderUpper,
      text: text,
      createdAt: serverTimestamp()
    });

    // Bước 2: Cập nhật meta-data
    // unreadUser: true sẽ đánh động cho Zalo Bot (nếu khách có kết nối Zalo)
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

// 4. Đóng Chat
export const closeChat = async (chatId) => {
  try {
    const messagesRef = collection(db, CHAT_COLLECTION, chatId, "messages");
    const snapshot = await getDocs(messagesRef);
    const batch = writeBatch(db);
    
    snapshot.docs.forEach((messageDoc) => {
      batch.delete(messageDoc.ref);
    });
    
    const chatDocRef = doc(db, CHAT_COLLECTION, chatId);
    batch.update(chatDocRef, {
      unreadUser: false,
      unreadAdmin: false,
      lastUpdated: serverTimestamp()
    });
    
    await batch.commit();
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
// HỆ THỐNG GAMIFICATION & HÒM THƯ (REAL-TIME LOGS)
// ============================================================================

const functions = getFunctions();

// 6. Giao tiếp với API Nhận đính kèm Hòm thư
export const claimMailboxAttachment = async (phone, mailId) => {
  try {
    const claimFn = httpsCallable(functions, 'claimMailAttachment');
    const result = await claimFn({ phone, mailId });
    
    if (result.data && result.data.reward > 0) {
      const userSnap = await getDoc(doc(db, 'users', phone));
      const currentXu = userSnap.exists() ? (userSnap.data().totalXu || 0) : result.data.reward;
      
      safeLogAdmin({
        type: 'BALANCE', source: 'mail', targetPhone: phone, assetType: 'xu',
        walletChange: result.data.reward, walletBalance: currentXu, 
        reason: `Nhận quà từ Hòm thư hệ thống`
      });
    }
    return result.data;
  } catch (error) { throw error; }
};

// 7. Giao tiếp với API Mở hộp quà hàng ngày
export const claimDailyReward = async (phone) => {
  try {
    const giftFn = httpsCallable(functions, 'claimDailyGift');
    const result = await giftFn({ phone });
    
    if (result.data && result.data.reward > 0) {
      const userSnap = await getDoc(doc(db, 'users', phone));
      const currentXu = userSnap.exists() ? (userSnap.data().totalXu || 0) : result.data.reward;
      
      safeLogAdmin({
        type: 'BALANCE', source: 'gift', targetPhone: phone, assetType: 'xu',
        walletChange: result.data.reward, walletBalance: currentXu, 
        reason: `Mở hộp quà may mắn hàng ngày`
      });
    }
    return result.data;
  } catch (error) { throw error; }
};

// 8. Giao tiếp với API Điểm danh 7 ngày
export const claimDailyCheckIn = async (phone) => {
  try {
    const checkInFn = httpsCallable(functions, 'claimDailyCheckIn');
    const result = await checkInFn({ phone });
    
    if (result.data && result.data.reward > 0) {
      const userSnap = await getDoc(doc(db, 'users', phone));
      const currentXu = userSnap.exists() ? (userSnap.data().totalXu || 0) : result.data.reward;
      
      safeLogAdmin({
        type: 'BALANCE', source: 'checkin', targetPhone: phone, assetType: 'xu',
        walletChange: result.data.reward, walletBalance: currentXu, 
        reason: `Thưởng điểm danh (Ngày ${result.data.streak || 1})`
      });
    }
    return result.data;
  } catch (error) { throw error; }
};

// ============================================================================
// HÀM TESTING (DÙNG ĐỂ RESET THỬ NGHIỆM)
// ============================================================================

// 9. Xóa thời gian nhận quà để test lại
export const resetTestingGamification = async (phone) => {
  try {
    const userRef = doc(db, 'users', phone);
    await updateDoc(userRef, {
      lastDailyGift: null,
      lastCheckIn: null,
      attendanceCount: 0, 
      checkInStreak: 0,   
      dailyCheckInHistory: [],
      lastUpdateSource: 'admin', // ĐÃ THÊM: Để tránh bị hệ thống tự động Ban khi test
      updatedAt: serverTimestamp()
    });
    console.log("✅ Đã reset tiến trình test Gamification an toàn.");
    return true;
  } catch (error) { throw error; }
};

// 10. Xóa cờ đã nhận Lucky Xu
export const resetTestingLuckyXu = async (phone) => {
  try {
    const userRef = doc(db, 'users', phone);
    await updateDoc(userRef, {
      lastLuckyReceived: null,
      lastUpdateSource: 'admin', // ĐÃ THÊM: Tránh bị khóa khi test Lì xì
      updatedAt: serverTimestamp()
    });
    console.log("✅ Đã reset cờ Lucky Xu an toàn.");
    return true;
  } catch (error) { throw error; }
};