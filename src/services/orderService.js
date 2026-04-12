import { collection, addDoc, getDocs, query, where, updateDoc, doc, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

// Tên của collection (bảng dữ liệu) trên Firestore
const COLLECTION_NAME = 'orders';

/**
 * Tạo một đơn hàng mới (Dành cho trang Order.jsx của khách)
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
    console.error("Lỗi khi tạo đơn hàng: ", error);
    return { success: false, error: error.message };
  }
};

/**
 * Lấy danh sách đơn hàng của MỘT khách cụ thể (Dành cho trang CheckOrder.jsx)
 * FIX: Thêm thông báo lỗi Index cụ thể
 */
export const getOrdersByPhone = async (phone) => {
  try {
    if (!phone) return [];
    
    const ordersRef = collection(db, COLLECTION_NAME);
    
    // LƯU Ý: Lệnh query này bắt buộc phải có INDEX trên Firebase Console
    const q = query(
      ordersRef, 
      where("phone", "==", phone), 
      orderBy("createdAt", "desc")
    );
    
    const querySnapshot = await getDocs(q);
    const orders = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      orders.push({
        id: doc.id,
        ...data,
        // Fix định dạng thời gian an toàn
        time: data.createdAt 
          ? data.createdAt.toDate().toLocaleString('vi-VN') 
          : 'Đang xử lý...'
      });
    });
    
    return orders;
  } catch (error) {
    // Nếu bạn thấy lỗi này trong Console trình duyệt, hãy click vào link Firebase cung cấp để tạo Index
    if (error.code === 'failed-precondition') {
      console.error("LỖI: Bạn chưa tạo Index cho query này trong Firebase Console!");
    } else {
      console.error("Lỗi khi lấy đơn hàng theo SĐT: ", error);
    }
    return [];
  }
};

/**
 * Lấy TOÀN BỘ đơn hàng (Dành cho trang Admin ManageOrders.jsx)
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
        time: data.createdAt ? data.createdAt.toDate().toLocaleString('vi-VN') : 'N/A'
      });
    });
    
    return orders;
  } catch (error) {
    console.error("Lỗi khi lấy toàn bộ đơn hàng: ", error);
    return [];
  }
};

/**
 * Cập nhật trạng thái của một đơn hàng (Dành cho Admin duyệt đơn/huỷ đơn)
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
    console.error("Lỗi cập nhật trạng thái đơn: ", error);
    return { success: false, error: error.message };
  }
};