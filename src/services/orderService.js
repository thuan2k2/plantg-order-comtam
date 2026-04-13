import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  getDocs,
  getDoc,
  doc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp, 
  onSnapshot,
  increment 
} from 'firebase/firestore';
import { db } from '../firebase/config';

const COLLECTION_NAME = 'orders';
const VOUCHER_COL = 'vouchers';

let isSubmittingOrder = false;

/**
 * 1. Tạo đơn hàng mới (Chống Spam & Trừ lượt dùng Voucher an toàn)
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
      updatedAt: serverTimestamp() // Thêm updatedAt ngay khi tạo
    };
    const docRef = await addDoc(collection(db, COLLECTION_NAME), newOrder);
    
    // Duyệt qua danh sách TẤT CẢ voucher đã dùng và trừ đi 1 lượt
    if (orderData.usedVouchers && orderData.usedVouchers.length > 0) {
      for (const v of orderData.usedVouchers) {
        await updateDoc(doc(db, VOUCHER_COL, v.id), {
          usageLimit: increment(-1)
        });
      }
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
 * 3. QUẢN LÝ VOUCHER 
 */
export const getMyVouchers = async (phone) => {
  try {
    const vouchersRef = collection(db, VOUCHER_COL);
    const now = new Date();

    const qPublic = query(vouchersRef, where("assignedPhone", "==", ""), where("usageLimit", ">", 0));
    const snapPublic = await getDocs(qPublic);
    const publicVouchers = snapPublic.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    let personalVouchers = [];
    if (phone && phone.trim().length >= 10) {
      const cleanPhone = phone.trim();
      const qPersonal = query(vouchersRef, where("assignedPhone", "==", cleanPhone), where("usageLimit", ">", 0));
      const snapPersonal = await getDocs(qPersonal);
      personalVouchers = snapPersonal.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    const allVouchers = [...publicVouchers, ...personalVouchers].filter(v => {
      if (!v.expiry) return true;
      return v.expiry.toDate() > now;
    });

    return allVouchers;
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

export const validateVoucher = async (code, phone) => {
  try {
    const q = query(collection(db, VOUCHER_COL), where("code", "==", code.toUpperCase().trim()));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return { valid: false, msg: "Mã không tồn tại!" };
    
    const v = snapshot.docs[0].data();
    const vId = snapshot.docs[0].id;
    const now = new Date();

    if (v.assignedPhone && v.assignedPhone.trim() !== "" && v.assignedPhone !== phone.trim()) {
      return { valid: false, msg: "Mã này không dành cho số điện thoại của bạn!" };
    }
    
    if (v.usageLimit <= 0) return { valid: false, msg: "Mã đã hết lượt dùng!" };
    if (v.expiry && v.expiry.toDate() < now) return { valid: false, msg: "Mã giảm giá đã hết hạn sử dụng!" };

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

// Hàm xử lý tặng Voucher khi giao trễ thủ công (Vòng đếm ngược)
export const awardLateVoucher = async (phone, orderId) => {
  try {
    const voucherCode = `XL-${orderId.slice(-4).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 3); // HSD 3 ngày

    await addDoc(collection(db, VOUCHER_COL), {
      code: voucherCode,
      type: 'CASH',
      value: 5000,
      usageLimit: 1,
      assignedPhone: phone,
      expiry: expiryDate,
      description: `Bồi thường giao trễ đơn #${orderId.slice(-6).toUpperCase()}`,
      createdAt: serverTimestamp()
    });

    // Đánh dấu đơn hàng đã được xử lý bồi thường
    const orderRef = doc(db, COLLECTION_NAME, orderId);
    await updateDoc(orderRef, { 
      lateVoucherStatus: 'AWARDED',
      updatedAt: serverTimestamp() 
    });

    return { success: true, code: voucherCode };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const completeOrderWithBonus = async (order) => {
  try {
    const orderRef = doc(db, COLLECTION_NAME, order.id);
    const now = new Date();
    
    await updateDoc(orderRef, {
      status: 'COMPLETED',
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    if (order.confirmedAt) {
      const confirmTime = order.confirmedAt.toDate();
      const diffInMinutes = Math.floor((now - confirmTime) / (1000 * 60));

      if (diffInMinutes >= 30) {
        // Đã vô hiệu hóa tự động phát Voucher.
        // Chỉ trả về trạng thái late: true để Admin biết đơn bị trễ (nếu cần dùng)
        return { success: true, late: true };
      }
    }
    return { success: true, late: false };
  } catch (error) {
    return { success: false, error: error.message };
  }
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
    const orderSnap = await getDoc(orderRef);
    if (!orderSnap.exists()) return { success: false };
    
    const order = orderSnap.data();
    const updateData = { status: newStatus, updatedAt: serverTimestamp() };
    
    // Thiết lập mốc thời gian bắt đầu đếm ngược 30 phút
    if (newStatus === 'PREPARING') {
      updateData.confirmedAt = serverTimestamp();
    }
    
    await updateDoc(orderRef, updateData);

    // CƠ CHẾ HOÀN MÃ: Nếu Admin hủy đơn khi đang PENDING, hoàn lại Voucher Tiền Mặt
    if (newStatus === 'CANCELLED' && order.status === 'PENDING' && order.usedVouchers) {
      for (const v of order.usedVouchers) {
        if (v.type !== 'FREESHIP') {
          await updateDoc(doc(db, VOUCHER_COL, v.id), { usageLimit: increment(1) });
        }
      }
    }

    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
};

export const subscribeToOrdersByPhone = (phone, callback) => {
  if (!phone) return () => {};
  const q = query(collection(db, COLLECTION_NAME), where("phone", "==", phone.trim()), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const validOrders = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data(), time: doc.data().createdAt?.toDate().toLocaleString('vi-VN') || 'Mới' }))
      .filter(o => o.status !== 'DELETED');
    callback(validOrders);
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

// Lưu Tên người xóa, Lý do xóa và Hoàn lại MỌI voucher
export const deleteOrderSoft = async (orderId, reason = "Xóa thủ công", deleterName = "Admin") => {
  try {
    const orderRef = doc(db, COLLECTION_NAME, orderId);
    const orderSnap = await getDoc(orderRef);
    if (!orderSnap.exists()) return { success: false };
    
    const order = orderSnap.data();

    await updateDoc(orderRef, { 
      status: 'DELETED', 
      deleteReason: reason,
      deletedBy: deleterName,
      updatedAt: serverTimestamp() 
    });

    // Nếu Admin xóa đơn hoàn toàn, tự động hoàn trả MỌI voucher đã dùng của đơn đó
    if (order.usedVouchers) {
      for (const v of order.usedVouchers) {
        await updateDoc(doc(db, VOUCHER_COL, v.id), { usageLimit: increment(1) });
      }
    }

    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
};

// Xử lý Khách hàng tự hủy đơn
export const requestCancelOrder = async (orderId, status, reason = "") => {
  try {
    const orderRef = doc(db, COLLECTION_NAME, orderId);
    const orderSnap = await getDoc(orderRef);
    if (!orderSnap.exists()) return { success: false, error: "Đơn không tồn tại" };

    const order = orderSnap.data();
    const isDirectCancel = status === 'PENDING'; 
    
    await updateDoc(orderRef, {
      status: isDirectCancel ? 'CANCELLED' : 'CANCEL_REQUESTED',
      cancelReason: reason || "Khách tự hủy",
      updatedAt: serverTimestamp()
    });

    // CƠ CHẾ HOÀN MÃ: Khách hủy đơn lúc PENDING -> Hoàn Voucher Tiền mặt
    if (isDirectCancel && order.usedVouchers) {
      for (const v of order.usedVouchers) {
        if (v.type !== 'FREESHIP') {
          await updateDoc(doc(db, VOUCHER_COL, v.id), { usageLimit: increment(1) });
        }
      }
    }

    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
};

// Hàm Hoàn tác đơn đã xóa
export const undoDeleteOrder = async (orderId, usedVouchers = []) => {
  try {
    const orderRef = doc(db, COLLECTION_NAME, orderId);
    
    // Khôi phục trạng thái về PENDING và xóa các trường lưu vết
    await updateDoc(orderRef, { 
      status: 'PENDING', 
      deleteReason: null,
      deletedBy: null,
      updatedAt: serverTimestamp() 
    });

    // Trừ lại số lượng voucher vì đơn đã sống lại
    if (usedVouchers && usedVouchers.length > 0) {
      for (const v of usedVouchers) {
        await updateDoc(doc(db, VOUCHER_COL, v.id), { usageLimit: increment(-1) });
      }
    }

    return { success: true };
  } catch (error) { 
    return { success: false, error: error.message }; 
  }
};