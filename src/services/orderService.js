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
 * 1. Tạo đơn hàng mới
 */
export const createOrder = async (orderData) => {
  try {
    const newOrder = {
      ...orderData,
      note: orderData.note || "", 
      status: 'PENDING',
      paymentMethod: 'CASH',     // Mặc định là Tiền mặt
      paymentStatus: 'UNPAID',    // Mặc định là Chưa thanh toán
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
 * 2. Cập nhật phương thức thanh toán (Dành cho Khách hàng)
 */
export const updatePaymentMethod = async (orderId, method, isTransferred = false) => {
  try {
    const orderRef = doc(db, COLLECTION_NAME, orderId);
    const updateData = {
      paymentMethod: method,
      updatedAt: serverTimestamp()
    };
    
    if (method === 'TRANSFER' && isTransferred) {
      updateData.paymentStatus = 'WAITING_CONFIRM';
    } else if (method === 'CASH') {
      updateData.paymentStatus = 'UNPAID';
    }

    await updateDoc(orderRef, updateData);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * 3. Xác nhận trạng thái tiền tệ (Dành cho Admin)
 */
export const confirmPaymentStatus = async (orderId, isPaid) => {
  try {
    const orderRef = doc(db, COLLECTION_NAME, orderId);
    await updateDoc(orderRef, {
      paymentStatus: isPaid ? 'PAID' : 'UNPAID',
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * 4. Hủy đơn hàng có điều kiện (Dành cho Khách hàng)
 */
export const requestCancelOrder = async (orderId, status, reason = "") => {
  try {
    const orderRef = doc(db, COLLECTION_NAME, orderId);
    const isDirectCancel = status === 'PENDING'; 
    
    await updateDoc(orderRef, {
      status: isDirectCancel ? 'CANCELLED' : 'CANCEL_REQUESTED',
      cancelReason: reason || "Khách tự hủy trong thời gian cho phép",
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * 5. Xóa đơn hàng mềm (Dành cho Admin)
 */
export const deleteOrderSoft = async (orderId) => {
  try {
    const orderRef = doc(db, COLLECTION_NAME, orderId);
    await updateDoc(orderRef, {
      status: 'DELETED',
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * 6. FIX LỖI BUILD: Bổ sung export hàm subscribeToOrdersByPhone
 * Dành cho trang CheckOrder tra cứu đơn hàng
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
      time: doc.data().createdAt?.toDate().toLocaleString('vi-VN') || 'Vừa xong'
    }));
    callback(orders);
  }, (error) => {
    console.error("Lỗi lắng nghe theo SĐT:", error);
  });
};

/**
 * 7. Lắng nghe đơn hàng trong ngày (Admin)
 */
export const subscribeToOrdersByDate = (dateStr, callback) => {
  const ordersRef = collection(db, COLLECTION_NAME);
  const q = query(ordersRef, orderBy("createdAt", "desc"));

  return onSnapshot(q, (snapshot) => {
    const allOrders = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        time: data.createdAt?.toDate().toLocaleString('vi-VN') || 'Vừa xong'
      };
    });
    const filtered = allOrders.filter(o => o.time.includes(dateStr) && o.status !== 'DELETED');
    callback(filtered);
  });
};

/**
 * 8. Lắng nghe toàn bộ đơn hàng (Thống kê)
 */
export const subscribeToAllOrders = (callback) => {
  const q = query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      time: doc.data().createdAt?.toDate().toLocaleString('vi-VN') || 'N/A'
    }));
    callback(orders);
  });
};

/**
 * 9. Cập nhật trạng thái đơn hàng (Chung)
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