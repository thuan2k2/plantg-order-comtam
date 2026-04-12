import { 
  collection, 
  addDoc, 
  updateDoc, 
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
 * 1. Tạo một đơn hàng mới (Giữ nguyên)
 */
export const createOrder = async (orderData) => {
  try {
    const newOrder = {
      ...orderData,
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
 * 2. LẮNG NGHE ĐƠN HÀNG THEO SĐT (Dành cho khách hàng)
 * Thay vì trả về mảng, hàm này trả về một hàm "Hủy đăng ký" (Unsubscribe)
 */
export const subscribeToOrdersByPhone = (phone, callback) => {
  if (!phone) return () => {};

  const cleanPhone = phone.trim();
  const ordersRef = collection(db, COLLECTION_NAME);
  const q = query(
    ordersRef,
    where("phone", "==", cleanPhone),
    orderBy("createdAt", "desc")
  );

  // onSnapshot sẽ tự động gọi callback mỗi khi dữ liệu thay đổi
  return onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      time: doc.data().createdAt && typeof doc.data().createdAt.toDate === 'function'
        ? doc.data().createdAt.toDate().toLocaleString('vi-VN')
        : 'Vừa xong'
    }));
    callback(orders);
  }, (error) => {
    console.error("Lỗi Realtime (Phone):", error);
  });
};

/**
 * 3. LẮNG NGHE TOÀN BỘ ĐƠN HÀNG (Dành cho Admin)
 */
export const subscribeToAllOrders = (callback) => {
  const ordersRef = collection(db, COLLECTION_NAME);
  const q = query(ordersRef, orderBy("createdAt", "desc"));

  return onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      time: doc.data().createdAt && typeof doc.data().createdAt.toDate === 'function'
        ? doc.data().createdAt.toDate().toLocaleString('vi-VN')
        : 'N/A'
    }));
    callback(orders);
  }, (error) => {
    console.error("Lỗi Realtime (Admin):", error);
  });
};

/**
 * 4. Cập nhật trạng thái (Giữ nguyên)
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