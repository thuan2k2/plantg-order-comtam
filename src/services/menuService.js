import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, orderBy, query, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase/config';

const COLLECTION_NAME = 'menu';

/**
 * Hàm hỗ trợ: Tải ảnh lên Firebase Storage
 */
export const uploadImage = async (file) => {
  if (!file) return null;
  try {
    const storageRef = ref(storage, `menu/${Date.now()}_${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error) {
    console.error("Lỗi upload ảnh lên Storage:", error);
    return null;
  }
};

/**
 * Lấy danh sách thực đơn THỜI GIAN THỰC
 * Giúp Admin và Khách thấy món mới ngay lập tức
 */
export const subscribeToMenu = (callback) => {
  const menuRef = collection(db, COLLECTION_NAME);
  const q = query(menuRef, orderBy("name", "asc"));

  return onSnapshot(q, (snapshot) => {
    const menuItems = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(menuItems);
  });
};

/**
 * Lấy danh sách thực đơn (Dạng tĩnh)
 */
export const getMenu = async () => {
  try {
    const menuRef = collection(db, COLLECTION_NAME);
    const q = query(menuRef, orderBy("name", "asc"));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Lỗi tải thực đơn:", error);
    return [];
  }
};

/**
 * Thêm một món ăn mới
 * BỔ SUNG: Mặc định category nếu không có
 */
export const addMenuItem = async (itemData) => {
  try {
    const menuRef = collection(db, COLLECTION_NAME);
    const docRef = await addDoc(menuRef, {
      ...itemData,
      category: itemData.category || 'MAIN', // MAIN, SIDE, EXTRA
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
 * Xoá món ăn
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