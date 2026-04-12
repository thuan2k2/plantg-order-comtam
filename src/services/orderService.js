import { collection, addDoc, getDocs, query, where, updateDoc, doc, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

// Tên collection phải khớp chính xác với Firestore Console
const COLLECTION_NAME = 'orders';

/**
 * Tạo một đơn hàng mới
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
 * Lấy đơn hàng theo SĐT (Dành cho khách hàng tra cứu)
 */
export const getOrdersByPhone = async (phone) => {
  try {
    if (!phone) return [];
    
    const ordersRef = collection(db, COLLECTION_NAME);
    
    // Lưu ý: Nếu trang bị trắng hoặc lỗi, bạn phải vào Console trình duyệt
    // click vào link Firebase cung cấp để tạo "Composite Index" cho query này.
    const q = query(
      ordersRef, 
      where("phone", "==", phone.trim()), 
      orderBy("createdAt", "desc")
    );
    
    const querySnapshot = await getDocs(q);
    const orders = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      orders.push({
        id: doc.id,
        ...data,
        // Chuyển đổi Timestamp an toàn
        time: data.createdAt && typeof data.createdAt.toDate === 'function'
          ? data.createdAt.toDate().toLocaleString('vi-VN') 
          : 'Mới đặt...'
      });
    });
    
    return orders;
  } catch (error) {
    console.error("Lỗi getOrdersByPhone:", error);
    return [];
  }
};

/**
 * Lấy TOÀN BỘ đơn hàng (Dành cho Admin)
 */
export const getAllOrders = async () => {
  try {
    const ordersRef = collection(db, COLLECTION_NAME);
    const q = query(ordersRef, orderBy("createdAt", "desc"));
    
    const querySnapshot = await getDocs(q);
    const orders = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      orders.push({
        id: doc.id,
        ...data,
        time: data.createdAt && typeof data.createdAt.toDate === 'function'
          ? data.createdAt.toDate().toLocaleString('vi-VN') 
          : 'Đang tải...'
      });
    });
    
    return orders;
  } catch (error) {
    console.error("Lỗi getAllOrders:", error);
    return [];
  }
};

/**
 * Cập nhật trạng thái đơn hàng
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