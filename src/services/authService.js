import { collection, addDoc, getDocs, query, where, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

const COLLECTION_NAME = 'users';

/**
 * Đăng ký tài khoản khách hàng mới
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

    // 2. Thêm khách hàng mới với trạng thái mặc định
    const newUser = {
      ...userData,
      status: 'ACTIVE', // Trạng thái mặc định: Đang hoạt động
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
 * Lấy thông tin khách hàng bằng Số điện thoại (Dành cho trang Order)
 */
export const getUserByPhone = async (phone) => {
  try {
    const usersRef = collection(db, COLLECTION_NAME);
    const q = query(usersRef, where("username", "==", phone));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return null; // Không tìm thấy khách hàng
    }
    
    // Trả về thông tin của khách hàng đầu tiên tìm thấy
    const userDoc = snapshot.docs[0];
    return { id: userDoc.id, ...userDoc.data() };
  } catch (error) {
    console.error("Lỗi khi lấy thông tin khách:", error);
    return null;
  }
};

/**
 * Lấy toàn bộ danh sách khách hàng (Dành cho Admin/ManageUsers)
 */
export const getAllUsers = async () => {
  try {
    const usersRef = collection(db, COLLECTION_NAME);
    const snapshot = await getDocs(usersRef);
    const users = [];
    
    snapshot.forEach((doc) => {
      users.push({
        id: doc.id,
        ...doc.data(),
        // Format ngày tham gia cho đẹp
        joinDate: doc.data().createdAt?.toDate().toLocaleDateString('vi-VN') || 'N/A'
      });
    });
    
    return users;
  } catch (error) {
    console.error("Lỗi khi tải danh sách khách hàng:", error);
    return [];
  }
};

/**
 * Khoá/Mở khoá tài khoản khách (Dành cho Admin)
 */
export const updateUserStatus = async (userId, newStatus) => {
  try {
    const userRef = doc(db, COLLECTION_NAME, userId);
    await updateDoc(userRef, { status: newStatus });
    return { success: true };
  } catch (error) {
    console.error("Lỗi cập nhật trạng thái khách:", error);
    return { success: false, error: error.message };
  }
};