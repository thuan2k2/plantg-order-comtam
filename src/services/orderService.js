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
 * Tích hợp đầy đủ trường note và định dạng chuẩn
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
 * 2. Lấy toàn bộ đơn hàng (Dạng tĩnh)
 * Dùng cho các báo cáo xuất dữ liệu hoặc Dashboard khởi tạo
 */
export const getAllOrders = async () => {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      time: doc.data().createdAt?.toDate().toLocaleString('vi-VN') || 'Đang xử lý...'
    }));
  } catch (error) {
    console.error("Lỗi getAllOrders:", error);
    return [];
  }
};

/**
 * 3. LẮNG NGHE ĐƠN HÀNG TRONG NGÀY (Real-time)
 * Dành cho trang ManageOrders của Admin
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
        // Chuyển đổi timestamp thành string ngay tại đây để filter
        time: data.createdAt?.toDate().toLocaleString('vi-VN') || 'Vừa xong'
      };
    });
    
    // Lọc các đơn có ngày trùng với dateStr (Ví dụ: "13/04/2026")
    const filtered = allOrders.filter(o => o.time && o.time.includes(dateStr));
    callback(filtered);
  }, (error) => {
    console.error("Lỗi bảo mật/kết nối (By Date):", error);
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
      time: doc.data().createdAt?.toDate().toLocaleString('vi-VN') || 'Vừa xong'
    }));
    callback(orders);
  }, (error) => {
    console.error("Lỗi lắng nghe theo SĐT:", error);
  });
};

/**
 * 5. LẮNG NGHE TOÀN BỘ ĐƠN HÀNG (Dashboard & Thống kê Admin)
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
  }, (error) => {
    console.error("Lỗi bảo mật/kết nối (All Orders):", error);
  });
};

/**
 * 6. Cập nhật trạng thái đơn hàng
 * Kiểm tra quyền Admin dựa trên localStorage nếu cần bảo mật thêm tại đây
 */
export const updateOrderStatus = async (orderId, newStatus) => {
  try {
    const isAdmin = localStorage.getItem('adminToken') === 'true';
    if (!isAdmin && newStatus !== 'CANCEL_REQUESTED') {
      throw new Error("Hành động bị từ chối: Thiếu quyền Admin.");
    }

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