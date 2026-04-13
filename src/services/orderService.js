import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc,
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
const VOUCHER_COL = 'vouchers';

let isSubmittingOrder = false;

/**
 * 1. Tạo đơn hàng mới (Chống Spam & Trừ lượt dùng Voucher)
 */
export const createOrder = async (orderData) => {
  if (isSubmittingOrder) {
    return { success: false, error: "Hệ thống đang xử lý đơn hàng, vui lòng không ấn liên tiếp!" };
  }
  isSubmittingOrder = true;
  try {
    const newOrder = {
      ...orderData,
      status: 'PENDING',
      paymentStatus: 'UNPAID',
      createdAt: serverTimestamp(),
    };
    const docRef = await addDoc(collection(db, COLLECTION_NAME), newOrder);
    
    // Nếu có sử dụng voucher, thực hiện trừ lượt sử dụng ngay lập tức
    if (orderData.appliedVoucherId) {
      const vRef = doc(db, VOUCHER_COL, orderData.appliedVoucherId);
      await updateDoc(vRef, {
        usageLimit: (orderData.currentUsageLimit || 1) - 1
      });
    }
    isSubmittingOrder = false;
    return { success: true, id: docRef.id };
  } catch (error) {
    isSubmittingOrder = false;
    console.error("Lỗi createOrder:", error);
    return { success: false, error: error.message };
  }
};

/**
 * 2. Cập nhật phương thức thanh toán
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
 * 3. QUẢN LÝ VOUCHER & LOGIC ĐỀN BÙ GIAO TRỄ
 */

// Lấy kho Voucher của riêng 1 Số điện thoại (Dùng cho trang Order)
export const getMyVouchers = async (phone) => {
  if (!phone) return [];
  try {
    // Tìm các voucher được gán đúng SĐT và còn lượt dùng
    const q = query(
      collection(db, VOUCHER_COL), 
      where("assignedPhone", "==", phone.trim()),
      where("usageLimit", ">", 0)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Lỗi getMyVouchers:", error);
    return [];
  }
};

export const getAllVouchers = async () => {
  try {
    const q = query(collection(db, VOUCHER_COL), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Lỗi getAllVouchers:", error);
    return [];
  }
};

// Hàm hoàn thành đơn hàng và TỰ ĐỘNG TẶNG VOUCHER NẾU TRỄ > 30 PHÚT
export const completeOrderWithBonus = async (order) => {
  try {
    const orderRef = doc(db, COLLECTION_NAME, order.id);
    const now = new Date();
    
    await updateDoc(orderRef, {
      status: 'COMPLETED',
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Tính toán thời gian: (Thời điểm hiện tại - Thời điểm bắt đầu làm món)
    if (order.confirmedAt) {
      const confirmTime = order.confirmedAt.toDate();
      const diffInMinutes = Math.floor((now - confirmTime) / (1000 * 60));

      // Nếu làm và giao mất hơn 30 phút -> Tặng mã xin lỗi
      if (diffInMinutes >= 30) {
        const bonusVoucher = {
          code: `SORRY${Math.floor(1000 + Math.random() * 9000)}`,
          value: 5000,
          type: 'CASH',
          assignedPhone: order.phone,
          usageLimit: 1, // Chỉ được dùng 1 lần
          description: "Quà bồi thường giao trễ > 30p",
          createdAt: serverTimestamp()
        };
        await addDoc(collection(db, VOUCHER_COL), bonusVoucher);
        return { success: true, late: true };
      }
    }
    return { success: true, late: false };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const validateVoucher = async (code, phone) => {
  try {
    const q = query(collection(db, VOUCHER_COL), where("code", "==", code.toUpperCase().trim()));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return { valid: false, msg: "Mã không tồn tại!" };
    
    const v = snapshot.docs[0].data();
    const vId = snapshot.docs[0].id;
    const now = new Date();

    if (v.assignedPhone && v.assignedPhone !== phone) {
      return { valid: false, msg: "Mã này không dành cho bạn!" };
    }
    if (v.usageLimit <= 0) return { valid: false, msg: "Mã đã hết lượt dùng!" };
    if (v.expiry && v.expiry.toDate() < now) return { valid: false, msg: "Mã đã hết hạn!" };

    return { valid: true, voucher: { id: vId, ...v } };
  } catch (error) {
    return { valid: false, msg: "Lỗi kết nối voucher." };
  }
};

export const createVoucher = async (vData) => {
  try {
    await addDoc(collection(db, VOUCHER_COL), {
      ...vData,
      code: vData.code.toUpperCase().trim(),
      createdAt: serverTimestamp()
    });
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
};

export const deleteVoucher = async (vId) => {
  try {
    await deleteDoc(doc(db, VOUCHER_COL, vId));
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
};

/**
 * 4. QUẢN LÝ KHÁCH HÀNG & THANH TOÁN
 */
export const updateCustomerProfile = async (userId, updatedData) => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { ...updatedData, updatedAt: serverTimestamp() });
    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
};

export const confirmPaymentStatus = async (orderId, isPaid) => {
  try {
    const orderRef = doc(db, COLLECTION_NAME, orderId);
    const updateData = { paymentStatus: isPaid ? 'PAID' : 'UNPAID', updatedAt: serverTimestamp() };
    if (!isPaid) { updateData.paymentMethod = 'CASH'; }
    await updateDoc(orderRef, updateData);
    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
};

/**
 * 5. SUBSCRIPTIONS & STATUS
 */
export const updateOrderStatus = async (orderId, newStatus) => {
  try {
    const orderRef = doc(db, COLLECTION_NAME, orderId);
    const updateData = { status: newStatus, updatedAt: serverTimestamp() };
    
    // MỐC QUAN TRỌNG: Ghi lại thời gian Admin bấm "Nhận đơn" để bắt đầu tính 30p
    if (newStatus === 'PREPARING') {
      updateData.confirmedAt = serverTimestamp();
    }
    
    await updateDoc(orderRef, updateData);
    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
};

// ... Các hàm subscribe giữ nguyên như cũ ...
export const subscribeToOrdersByPhone = (phone, callback) => {
  if (!phone) return () => {};
  const q = query(collection(db, COLLECTION_NAME), where("phone", "==", phone.trim()), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), time: doc.data().createdAt?.toDate().toLocaleString('vi-VN') || 'Mới' })));
  });
};

export const subscribeToOrdersByDate = (dateStr, callback) => {
  const q = query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const filtered = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data(), time: doc.data().createdAt?.toDate().toLocaleString('vi-VN') || '' }))
      .filter(o => o.time.includes(dateStr) && o.status !== 'DELETED');
    callback(filtered);
  });
};

export const subscribeToAllOrders = (callback) => {
  const q = query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), time: doc.data().createdAt?.toDate().toLocaleString('vi-VN') || 'N/A' })));
  });
};

export const deleteOrderSoft = async (orderId) => {
  try {
    const orderRef = doc(db, COLLECTION_NAME, orderId);
    await updateDoc(orderRef, { status: 'DELETED', updatedAt: serverTimestamp() });
    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
};

export const requestCancelOrder = async (orderId, status, reason = "") => {
  try {
    const orderRef = doc(db, COLLECTION_NAME, orderId);
    const isDirectCancel = status === 'PENDING'; 
    await updateDoc(orderRef, {
      status: isDirectCancel ? 'CANCELLED' : 'CANCEL_REQUESTED',
      cancelReason: reason || "Khách tự hủy",
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
};