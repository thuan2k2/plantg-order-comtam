import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  updateDoc, 
  doc, 
  deleteDoc, // Bổ sung import deleteDoc
  serverTimestamp, 
  orderBy,
  onSnapshot 
} from 'firebase/firestore';
import { db, app } from '../firebase/config'; 

const auth = getAuth(app);
const COLLECTION_NAME = 'users';

/**
 * 1. Đăng ký tài khoản khách hàng mới
 */
export const registerUser = async (userData) => {
  try {
    const usersRef = collection(db, COLLECTION_NAME);
    const q = query(usersRef, where("username", "==", userData.username.trim()));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      return { success: false, error: 'Số điện thoại này đã được đăng ký!' };
    }

    const newUser = {
      ...userData,
      username: userData.username.trim(),
      role: 'user',   
      status: 'ACTIVE', 
      totalOrders: 0,
      createdAt: serverTimestamp(),
      isBanned: false, // Bổ sung trường mặc định
      banUntil: null
    };

    const docRef = await addDoc(usersRef, newUser);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Lỗi registerUser:", error);
    return { success: false, error: error.message };
  }
};

/**
 * 2. ĐĂNG NHẬP ADMIN (Firebase Auth)
 */
export const loginAdmin = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    localStorage.setItem('adminToken', 'true');
    return { success: true, user };
  } catch (error) {
    console.error("Lỗi đăng nhập Admin:", error);
    let errorMessage = "Lỗi hệ thống";
    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
      errorMessage = "Email hoặc mật khẩu không chính xác";
    }
    return { success: false, error: errorMessage };
  }
};

/**
 * 3. ĐĂNG XUẤT ADMIN
 */
export const logoutAdmin = async () => {
  try {
    await signOut(auth);
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminInfo');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * 4. THEO DÕI TRẠNG THÁI ĐĂNG NHẬP
 */
export const subscribeToAuth = (callback) => {
  return onAuthStateChanged(auth, callback);
};

/**
 * 5. Lấy thông tin khách bằng SĐT (Có kiểm tra trạng thái cấm)
 */
export const getUserByPhone = async (phone) => {
  try {
    if (!phone) return null;
    const usersRef = collection(db, COLLECTION_NAME);
    const q = query(usersRef, where("username", "==", phone.trim()));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return null;
    const userDoc = snapshot.docs[0];
    const userData = { id: userDoc.id, ...userDoc.data() };

    // KIỂM TRA LỆNH CẤM TRƯỚC KHI TRẢ VỀ DỮ LIỆU
    if (userData.isBanned) {
      if (userData.banUntil === 'permanent') {
         throw new Error("Tài khoản của bạn đã bị cấm vĩnh viễn. Vui lòng liên hệ quản trị viên.");
      }
      
      const now = new Date().getTime();
      if (now < userData.banUntil) {
         const dateStr = new Date(userData.banUntil).toLocaleString('vi-VN');
         throw new Error(`Tài khoản của bạn đang bị tạm khóa đến ${dateStr}.`);
      } else {
         // Đã qua thời hạn cấm -> Tự động gỡ cấm
         await updateUserBanStatus(userData.id, { isBanned: false, banUntil: null });
         userData.isBanned = false; 
      }
    }

    return userData;
  } catch (error) {
    console.error("Lỗi khi tìm user:", error);
    throw error; // Ném lỗi để UI (ví dụ: màn hình Order) bắt và hiển thị Alert
  }
};

/**
 * 6. LẤY TOÀN BỘ KHÁCH HÀNG (Dạng tĩnh)
 */
export const getAllUsers = async () => {
  try {
    const usersRef = collection(db, COLLECTION_NAME);
    const q = query(usersRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      joinDate: doc.data().createdAt?.toDate().toLocaleDateString('vi-VN') || 'Mới tạo'
    }));
  } catch (error) {
    console.error("Lỗi getAllUsers:", error);
    return [];
  }
};

/**
 * 7. LẮNG NGHE KHÁCH HÀNG (Real-time)
 */
export const subscribeToAllUsers = (callback) => {
  const usersRef = collection(db, COLLECTION_NAME);
  const q = query(usersRef, orderBy("createdAt", "desc"));

  return onSnapshot(q, (snapshot) => {
    const users = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      joinDate: doc.data().createdAt?.toDate().toLocaleDateString('vi-VN') || 'Mới tạo'
    }));
    callback(users);
  }, (error) => {
    console.error("Lỗi Real-time Users:", error);
  });
};

/**
 * 8. Cập nhật thông tin khách hàng
 */
export const updateUserProfile = async (userId, updateData) => {
  try {
    const userRef = doc(db, COLLECTION_NAME, userId);
    await updateDoc(userRef, {
      ...updateData,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error("Lỗi updateUserProfile:", error);
    return { success: false, error: error.message };
  }
};

/**
 * 9. Xóa người dùng vĩnh viễn khỏi Firebase
 */
export const deleteUser = async (userId) => {
  try {
    const userRef = doc(db, COLLECTION_NAME, userId);
    await deleteDoc(userRef);
    return { success: true };
  } catch (error) {
    console.error("Lỗi khi xóa người dùng:", error);
    return { success: false, error: error.message };
  }
};

/**
 * 10. Cập nhật trạng thái Cấm / Gỡ cấm người dùng
 */
export const updateUserBanStatus = async (userId, banData) => {
  try {
    const userRef = doc(db, COLLECTION_NAME, userId);
    await updateDoc(userRef, {
      ...banData,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error("Lỗi khi cập nhật trạng thái cấm:", error);
    return { success: false, error: error.message };
  }
};