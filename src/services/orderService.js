import { 
  collection, 
  addDoc, 
  updateDoc, 
  getDocs,
  doc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp, 
  onSnapshot 
} from 'firebase/firestore';
import { db } from '../firebase/config';

const COLLECTION_NAME = 'orders';

/**
 * 1. Tạo một đơn hàng mới (Hỗ trợ note và cấu trúc món mới)
 */
export const createOrder = async (orderData) => {
  try {
    const newOrder = {
      ...orderData,
      note: orderData.note || "", 
      status: 'PENDING',
      createdAt: serverTimestamp(),
    };
    const docRef = await addDoc(collection(db, COLLECTION_NAME), newOrder);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Lỗi createOrder:", error);
    return { success: false, error: error.message };
  }
};

/**
 * 2. Lấy toàn bộ đơn hàng (Dạng tĩnh cho Thống kê)
 */
export const getAllOrders = async () => {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      time: doc.data().createdAt?.toDate().toLocaleString('vi-VN') || 'N/A'
    }));
  } catch (error) {
    console.error("Lỗi getAllOrders:", error);
    return [];
  }
};

/**
 * 3. LẮNG NGHE ĐƠN HÀNG TRONG NGÀY (Dành cho trang Quản lý đơn hàng Admin)
 * Tự động lọc các đơn hàng có trường 'time' chứa chuỗi ngày hiện tại
 */
export const subscribeToOrdersByDate = (dateStr, callback) => {
  const ordersRef = collection(db, COLLECTION_NAME);
  const q = query(ordersRef, orderBy("createdAt", "desc"));

  return onSnapshot(q, (snapshot) => {
    const allOrders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      time: doc.data().createdAt && typeof doc.data().createdAt.toDate === 'function'
        ? doc.data().createdAt.toDate().toLocaleString('vi-VN')
        : 'Vừa xong'
    }));
    
    // Lọc thủ công các đơn hàng trong ngày (Ví dụ: "13/04/2026")
    const filtered = allOrders.filter(o => o.time && o.time.includes(dateStr));
    callback(filtered);
  }, (error) => {
    console.error("Lỗi Realtime (By Date):", error);
  });
};

/**
 * 4. LẮNG NGHE ĐƠN HÀNG THEO SĐT (Dành cho khách hàng)
 */
export const subscribeToOrdersByPhone = (phone, callback) => {
  if (!phone) return () => {};
  const cleanPhone = phone.trim();
  const q = query(
    collection(db, COLLECTION_NAME),
    where("phone", "==", cleanPhone),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      time: doc.data().createdAt && typeof doc.data().createdAt.toDate === 'function'
        ? doc.data().createdAt.toDate().toLocaleString('vi-VN')
        : 'Vừa xong'
    }));
    callback(orders);
  });
};

/**
 * 5. LẮNG NGHE TOÀN BỘ ĐƠN HÀNG (Dành cho Dashboard & Thống kê Admin)
 */
export const subscribeToAllOrders = (callback) => {
  const q = query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      time: doc.data().createdAt && typeof doc.data().createdAt.toDate === 'function'
        ? doc.data().createdAt.toDate().toLocaleString('vi-VN')
        : 'N/A'
    }));
    callback(orders);
  });
};

/**
 * 6. Cập nhật trạng thái
 */
export const updateOrderStatus = async (orderId, newStatus) => {
  try {
    const orderRef = doc(db, COLLECTION_NAME, orderId);
    await updateDoc(orderRef, {
      status: newStatus,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error("Lỗi updateOrderStatus:", error);
    return { success: false, error: error.message };
  }
};