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
      createdAt: serverTimestamp(), // Firebase sẽ gán thời gian khi ghi thành công
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), newOrder);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Lỗi createOrder:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Lấy đơn hàng theo SĐT (Dành cho CheckOrder)
 */
export const getOrdersByPhone = async (phone) => {
  try {
    if (!phone) return [];
    
    console.log("Đang truy vấn đơn hàng cho SĐT:", phone); // Log để kiểm tra input
    const ordersRef = collection(db, COLLECTION_NAME);
    
    // TRƯỜNG HỢP KHÔNG HIỆN LINK INDEX: 
    // Thử dùng query đơn giản này trước để xem dữ liệu có về không (bỏ orderBy)
    // Nếu query này chạy, nghĩa là do thiếu Index cho orderBy.
    const q = query(
      ordersRef, 
      where("phone", "==", phone.trim()), // Trim để tránh lỗi dấu cách thừa
      orderBy("createdAt", "desc")
    );
    
    const querySnapshot = await getDocs(q);
    const orders = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // KIỂM TRA DỮ LIỆU TỪNG DÒNG
      orders.push({
        id: doc.id,
        ...data,
        // Dùng optional chaining ?. và kiểm tra kiểu dữ liệu an toàn
        time: data.createdAt && typeof data.createdAt.toDate === 'function'
          ? data.createdAt.toDate().toLocaleString('vi-VN') 
          : 'Mới đặt (chờ xử lý...)'
      });
    });
    
    console.log(`Tìm thấy ${orders.length} đơn hàng cho SĐT ${phone}`);
    return orders;
  } catch (error) {
    console.error("Lỗi getOrdersByPhone:", error);
    // Nếu Console không hiện link, bạn có thể tự tạo Index thủ công trong Firebase:
    // Collection: orders | Field: phone (Ascending) | Field: createdAt (Descending)
    return [];
  }
};

/**
 * Lấy TOÀN BỘ đơn hàng (Dành cho Admin)
 */
export const getAllOrders = async () => {
  try {
    const ordersRef = collection(db, COLLECTION_NAME);
    
    // Nếu Admin không thấy đơn, thử bỏ orderBy này đi để test xem dữ liệu có hiện không
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
          : 'Đang cập nhật...'
      });
    });
    
    console.log("Tổng số đơn hàng Admin lấy được:", orders.length);
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