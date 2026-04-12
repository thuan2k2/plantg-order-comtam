import { collection, addDoc, getDocs, query, where, updateDoc, doc, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

// Tên của collection (bảng dữ liệu) trên Firestore
const COLLECTION_NAME = 'orders';

/**
 * Tạo một đơn hàng mới (Dành cho trang Order.jsx của khách)
 * @param {Object} orderData - Chứa { customer, phone, address, items, total }
 */
export const createOrder = async (orderData) => {
  try {
    // Thêm các trường mặc định cho đơn mới
    const newOrder = {
      ...orderData,
      status: 'PENDING', // Trạng thái mặc định khi mới đặt
      createdAt: serverTimestamp(), // Lấy thời gian chuẩn của server Firebase
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), newOrder);
    
    // Trả về ID của đơn hàng vừa tạo để hiển thị cho khách
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Lỗi khi tạo đơn hàng: ", error);
    return { success: false, error: error.message };
  }
};

/**
 * Lấy danh sách đơn hàng của MỘT khách cụ thể (Dành cho trang CheckOrder.jsx)
 * @param {string} phone - Số điện thoại của khách hàng
 */
export const getOrdersByPhone = async (phone) => {
  try {
    const ordersRef = collection(db, COLLECTION_NAME);
    // Lọc các đơn có trường 'phone' khớp với sđt khách nhập, sắp xếp mới nhất lên đầu
    const q = query(ordersRef, where("phone", "==", phone), orderBy("createdAt", "desc"));
    
    const querySnapshot = await getDocs(q);
    const orders = [];
    
    querySnapshot.forEach((doc) => {
      orders.push({
        id: doc.id,
        ...doc.data(),
        // Chuyển đổi timestamp của Firebase thành chuỗi thời gian dễ đọc
        time: doc.data().createdAt?.toDate().toLocaleString('vi-VN') || 'Vừa xong'
      });
    });
    
    return orders;
  } catch (error) {
    console.error("Lỗi khi lấy đơn hàng theo SĐT: ", error);
    return [];
  }
};

/**
 * Lấy TOÀN BỘ đơn hàng (Dành cho trang Admin ManageOrders.jsx)
 */
export const getAllOrders = async () => {
  try {
    const ordersRef = collection(db, COLLECTION_NAME);
    // Sắp xếp đơn mới nhất lên đầu
    const q = query(ordersRef, orderBy("createdAt", "desc"));
    
    const querySnapshot = await getDocs(q);
    const orders = [];
    
    querySnapshot.forEach((doc) => {
      orders.push({
        id: doc.id,
        ...doc.data(),
        time: doc.data().createdAt?.toDate().toLocaleString('vi-VN') || 'N/A'
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
 * @param {string} orderId - ID của đơn hàng
 * @param {string} newStatus - Trạng thái mới (VD: 'PREPARING', 'CANCELLED')
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