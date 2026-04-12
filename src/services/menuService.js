import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase/config';

const COLLECTION_NAME = 'menu';

/**
 * Lấy danh sách toàn bộ thực đơn
 * Sẽ dùng chung cho cả trang Order.jsx (của khách) và ManageMenu.jsx (của Admin)
 */
export const getMenu = async () => {
  try {
    const menuRef = collection(db, COLLECTION_NAME);
    // Sắp xếp theo tên món cho gọn gàng
    const q = query(menuRef, orderBy("name", "asc"));
    const snapshot = await getDocs(q);
    
    const menuItems = [];
    snapshot.forEach((doc) => {
      menuItems.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return menuItems;
  } catch (error) {
    console.error("Lỗi tải thực đơn:", error);
    return [];
  }
};

/**
 * Thêm một món ăn mới vào thực đơn (Từ Admin)
 */
export const addMenuItem = async (itemData) => {
  try {
    const menuRef = collection(db, COLLECTION_NAME);
    const docRef = await addDoc(menuRef, itemData);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Lỗi thêm món ăn:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Cập nhật thông tin món ăn (Sửa tên, giá, đổi trạng thái hết món)
 */
export const updateMenuItem = async (itemId, updatedData) => {
  try {
    const itemRef = doc(db, COLLECTION_NAME, itemId);
    await updateDoc(itemRef, updatedData);
    return { success: true };
  } catch (error) {
    console.error("Lỗi cập nhật món ăn:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Xoá vĩnh viễn một món ăn khỏi thực đơn
 */
export const deleteMenuItem = async (itemId) => {
  try {
    const itemRef = doc(db, COLLECTION_NAME, itemId);
    await deleteDoc(itemRef);
    return { success: true };
  } catch (error) {
    console.error("Lỗi xoá món ăn:", error);
    return { success: false, error: error.message };
  }
};