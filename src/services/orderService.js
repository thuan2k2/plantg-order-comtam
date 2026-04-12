import { collection, addDoc, getDocs, query, where, updateDoc, doc, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

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
 * Đã thêm log để debug chính xác lỗi Index
 */
export const getOrdersByPhone = async (phone) => {
  try {
    if (!phone) return [];
    
    // Loại bỏ khoảng trắng để tránh lỗi so khớp "0333..." và " 0333..."
    const cleanPhone = phone.trim();
    const ordersRef = collection(db, COLLECTION_NAME);
    
    // LƯU Ý: Nếu Index chưa "Enabled", query này sẽ luôn trả về mảng rỗng []
    const q = query(
      ordersRef, 
      where("phone", "==", cleanPhone), 
      orderBy("createdAt", "desc")
    );
    
    const querySnapshot = await getDocs(q);
    const orders = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      orders.push({
        id: doc.id,
        ...data,
        time: data.createdAt && typeof data.createdAt.toDate === 'function'
          ? data.createdAt.toDate().toLocaleString('vi-VN') 
          : 'Vừa xong'
      });
    });
    
    console.log(`Đã tìm thấy ${orders.length} đơn cho số: ${cleanPhone}`);
    return orders;
  } catch (error) {
    // Log chi tiết lỗi để bạn copy link tạo Index nếu nó xuất hiện
    console.error("Lỗi getOrdersByPhone chi tiết:", error);
    return [];
  }
};

/**
 * Lấy TOÀN BỘ đơn hàng (Dành cho Admin)
 */
export const getAllOrders = async () => {
  try {
    const ordersRef = collection(db, COLLECTION_NAME);
    // Sắp xếp đơn mới nhất lên đầu
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
          : 'N/A'
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