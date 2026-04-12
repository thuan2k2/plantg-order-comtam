import { collection, addDoc, getDocs, query, where, updateDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';

const COLLECTION_NAME = 'users';

/**
 * Đăng ký tài khoản khách hàng mới
 */
export const registerUser = async (userData) => {
  try {
    const usersRef = collection(db, COLLECTION_NAME);
    
    // 1. Kiểm tra xem Username (SĐT) đã tồn tại chưa
    const q = query(usersRef, where("username", "==", userData.username.trim()));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      return { success: false, error: 'Số điện thoại này đã được đăng ký!' };
    }

    // 2. Thêm khách hàng mới
    const newUser = {
      ...userData,
      username: userData.username.trim(),
      role: 'user',   
      status: 'ACTIVE', 
      totalOrders: 0,
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(usersRef, newUser);
    console.log("Đăng ký thành công khách hàng ID:", docRef.id);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Lỗi khi đăng ký:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Đăng nhập dành riêng cho Admin
 */
export const loginAdmin = async (username, password) => {
  try {
    const user = await getUserByPhone(username);
    
    if (!user) {
      return { success: false, error: 'Tài khoản không tồn tại!' };
    }

    // Kiểm tra quyền Admin và Mật khẩu
    if (user.role === 'admin' && password === 'Thuan021208@') {
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
    return { success: false, error: 'Lỗi hệ thống.' };
  }
};

/**
 * Lấy thông tin khách hàng bằng Số điện thoại
 */
export const getUserByPhone = async (phone) => {
  try {
    if (!phone) return null;
    const usersRef = collection(db, COLLECTION_NAME);
    const q = query(usersRef, where("username", "==", phone.trim()));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return null;
    }
    
    const userDoc = snapshot.docs[0];
    return { id: userDoc.id, ...userDoc.data() };
  } catch (error) {
    console.error("Lỗi getUserByPhone:", error);
    return null;
  }
};

/**
 * Lấy toàn bộ danh sách khách hàng (Dành cho Admin)
 * Cập nhật: Thêm sắp xếp và check log dữ liệu
 */
export const getAllUsers = async () => {
  try {
    const usersRef = collection(db, COLLECTION_NAME);
    // Thêm orderBy để người mới đăng ký hiện lên đầu
    const q = query(usersRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    
    const users = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      users.push({
        id: doc.id,
        ...data,
        // Chuyển đổi Timestamp an toàn để tránh lỗi .toDate() of null
        joinDate: data.createdAt && typeof data.createdAt.toDate === 'function' 
          ? data.createdAt.toDate().toLocaleDateString('vi-VN') 
          : 'Mới tạo'
      });
    });
    
    console.log("Tổng số khách hàng lấy được từ Firebase:", users.length);
    return users;
  } catch (error) {
    console.error("Lỗi getAllUsers:", error);
    return [];
  }
};

/**
 * Cập nhật thông tin khách hàng
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