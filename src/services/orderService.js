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
 * 1. Tạo một đơn hàng mới
 * Mặc định phương thức thanh toán là Tiền mặt (CASH) và chưa thanh toán (UNPAID)
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
 * Nếu khách báo "Đã chuyển khoản", set trạng thái là WAITING_CONFIRM
 */
export const updatePaymentMethod = async (orderId, method, isTransferred = false) => {
  try {
    const orderRef = doc(db, COLLECTION_NAME, orderId);
    const updateData = {
      paymentMethod: method, // 'CASH' hoặc 'TRANSFER'
      updatedAt: serverTimestamp()
    };
    
    if (method === 'TRANSFER' && isTransferred) {
      updateData.paymentStatus = 'WAITING_CONFIRM'; // Khách báo đã CK, chờ Admin xác nhận
    } else if (method === 'CASH') {
      updateData.paymentStatus = 'UNPAID'; // Quay về tiền mặt
    }

    await updateDoc(orderRef, updateData);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * 3. Xác nhận trạng thái tiền tệ (Dành cho Admin)
 * Nút "Đã nhận tiền" (PAID) hoặc "Chưa nhận tiền" (UNPAID)
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
 * - Nếu là PENDING: Hủy trực tiếp (CANCELLED)
 * - Nếu khác: Gửi yêu cầu kèm lý do (CANCEL_REQUESTED)
 */
export const requestCancelOrder = async (orderId, status, reason = "") => {
  try {
    const orderRef = doc(db, COLLECTION_NAME, orderId);
    const isDirectCancel = status === 'PENDING'; // Giả sử check logic 10p ở UI, PENDING cho hủy luôn
    
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
 * 5. Xóa đơn hàng mềm (Soft Delete - Dành cho Admin)
 * Chuyển trạng thái DELETED để ẩn khỏi danh sách bếp nhưng giữ lại trong lịch sử
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
 * 6. Lắng nghe đơn hàng real-time (Bộ lọc đồng bộ)
 */
export const subscribeToOrdersByDate = (dateStr, callback) => {
  const ordersRef = collection(db, COLLECTION_NAME);
  // Lọc bỏ đơn DELETED để bếp không thấy đơn đã xóa
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
    
    // Lọc: Cùng ngày VÀ trạng thái không phải DELETED
    const filtered = allOrders.filter(o => o.time.includes(dateStr) && o.status !== 'DELETED');
    callback(filtered);
  });
};

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
 * 7. Cập nhật trạng thái đơn hàng (General)
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
    return { success: false, error: error.message };
  }
};