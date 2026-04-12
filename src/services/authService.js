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
  serverTimestamp, 
  orderBy,
  onSnapshot 
} from 'firebase/firestore';
import { db, app } from '../firebase/config'; // Đảm bảo đã export app từ config

const auth = getAuth(app);
const COLLECTION_NAME = 'users';

/**
 * 1. Đăng ký tài khoản khách hàng mới (Firestore)
 * Vẫn giữ cơ chế cũ dành cho khách hàng không cần mật khẩu
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
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(usersRef, newUser);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Lỗi registerUser:", error);
    return { success: false, error: error.message };
  }
};

/**
 * 2. ĐĂNG NHẬP ADMIN (Sử dụng Firebase Authentication)
 * Thay thế logic cũ so sánh chuỗi mật khẩu thủ công
 */
export const loginAdmin = async (email, password) => {
  try {
    // Đăng nhập bằng hệ thống Auth của Firebase
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Lưu trạng thái bổ trợ vào localStorage để các thành phần cũ không bị lỗi
    localStorage.setItem('adminToken', 'true');
    
    return { success: true, user };
  } catch (error) {
    console.error("Lỗi đăng nhập Admin:", error);
    let errorMessage = "Lỗi hệ thống";
    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
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
 * 5. Lấy thông tin khách bằng SĐT (Real-time)
 */
export const getUserByPhone = async (phone) => {
  try {
    if (!phone) return null;
    const usersRef = collection(db, COLLECTION_NAME);
    const q = query(usersRef, where("username", "==", phone.trim()));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return null;
    const userDoc = snapshot.docs[0];
    return { id: userDoc.id, ...userDoc.data() };
  } catch (error) {
    return null;
  }
};

/**
 * 6. Lấy toàn bộ danh sách khách hàng (Real-time cho Admin)
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
  });
};

/**
 * 7. Cập nhật thông tin khách hàng
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
    return { success: false, error: error.message };
  }
};