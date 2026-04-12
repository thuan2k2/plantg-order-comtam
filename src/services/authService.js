import { collection, addDoc, getDocs, query, where, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

const COLLECTION_NAME = 'users';

/**
 * Đăng ký tài khoản khách hàng mới
 * Mặc định mỗi tài khoản tạo ra sẽ có role là 'user'
 */
export const registerUser = async (userData) => {
  try {
    const usersRef = collection(db, COLLECTION_NAME);
    
    // 1. Kiểm tra xem Username (SĐT) đã tồn tại chưa
    const q = query(usersRef, where("username", "==", userData.username));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      return { success: false, error: 'Số điện thoại này đã được đăng ký!' };
    }

    // 2. Thêm khách hàng mới với role mặc định là 'user'
    const newUser = {
      ...userData,
      role: 'user',   // Mặc định là khách hàng
      status: 'ACTIVE', 
      totalOrders: 0,
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(usersRef, newUser);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Lỗi khi đăng ký:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Đăng nhập dành riêng cho Admin
 * Kiểm tra SĐT, Mật khẩu và Quyền hạn (role)
 */
export const loginAdmin = async (username, password) => {
  try {
    const user = await getUserByPhone(username);
    
    if (!user) {
      return { success: false, error: 'Tài khoản không tồn tại!' };
    }

    // Kiểm tra quyền Admin và Mật khẩu bạn đã quy định
    if (user.role === 'admin' && password === 'Thuan021208@') {
      // Lưu phiên đăng nhập vào LocalStorage
      localStorage.setItem('adminToken', 'true');
      localStorage.setItem('adminInfo', JSON.stringify({
        username: user.username,
        fullName: user.fullName
      }));
      return { success: true };
    } else if (user.role !== 'admin') {
      return { success: false, error: 'Bạn không có quyền truy cập trang Admin!' };
    } else {
      return { success: false, error: 'Mật khẩu Admin không chính xác!' };
    }
  } catch (error) {
    console.error("Lỗi đăng nhập Admin:", error);
    return { success: false, error: 'Lỗi hệ thống, vui lòng thử lại.' };
  }
};

/**
 * Lấy thông tin khách hàng bằng Số điện thoại
 */
export const getUserByPhone = async (phone) => {
  try {
    const usersRef = collection(db, COLLECTION_NAME);
    const q = query(usersRef, where("username", "==", phone));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return null;
    }
    
    const userDoc = snapshot.docs[0];
    return { id: userDoc.id, ...userDoc.data() };
  } catch (error) {
    console.error("Lỗi khi lấy thông tin khách:", error);
    return null;
  }
};

/**
 * Lấy toàn bộ danh sách khách hàng (Dành cho Admin)
 */
export const getAllUsers = async () => {
  try {
    const usersRef = collection(db, COLLECTION_NAME);
    const snapshot = await getDocs(usersRef);
    const users = [];
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      users.push({
        id: doc.id,
        ...data,
        joinDate: data.createdAt?.toDate().toLocaleDateString('vi-VN') || 'N/A'
      });
    });
    
    return users;
  } catch (error) {
    console.error("Lỗi khi tải danh sách khách hàng:", error);
    return [];
  }
};

/**
 * Cập nhật trạng thái hoặc quyền hạn (Dành cho Admin)
 * Ví dụ: Khóa tài khoản hoặc nâng cấp lên Admin
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
    console.error("Lỗi cập nhật thông tin:", error);
    return { success: false, error: error.message };
  }
};