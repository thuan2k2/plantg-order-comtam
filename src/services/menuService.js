import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, orderBy, query } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'; // Thêm Storage
import { db, storage } from '../firebase/config'; // Thêm storage từ config

const COLLECTION_NAME = 'menu';

/**
 * Hàm hỗ trợ: Tải ảnh lên Firebase Storage
 * @param {File} file - Tệp tin hình ảnh từ input
 * @returns {string|null} - Link ảnh công khai
 */
export const uploadImage = async (file) => {
  if (!file) return null;
  try {
    // Tạo đường dẫn lưu file: menu/ten_file_thoi_gian.png
    const storageRef = ref(storage, `menu/${Date.now()}_${file.name}`);
    
    // Tải tệp lên
    const snapshot = await uploadBytes(storageRef, file);
    
    // Lấy link URL công khai của tệp vừa tải
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error) {
    console.error("Lỗi upload ảnh lên Storage:", error);
    return null;
  }
};

/**
 * Lấy danh sách toàn bộ thực đơn
 */
export const getMenu = async () => {
  try {
    const menuRef = collection(db, COLLECTION_NAME);
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
 * Thêm một món ăn mới vào thực đơn (Đã hỗ trợ link ảnh)
 */
export const addMenuItem = async (itemData) => {
  try {
    const menuRef = collection(db, COLLECTION_NAME);
    const docRef = await addDoc(menuRef, {
      ...itemData,
      // Đảm bảo có trường image (nếu không có thì để rỗng)
      image: itemData.image || '' 
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Lỗi thêm món ăn:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Cập nhật thông tin món ăn
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