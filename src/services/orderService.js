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
  increment,
  runTransaction // Import thêm runTransaction cho thanh toán an toàn
} from 'firebase/firestore';
import { db } from '../firebase/config';

const COLLECTION_NAME = 'orders';
const VOUCHER_COL = 'vouchers';

let isSubmittingOrder = false;

/**
 * ==========================================
 * 1. QUẢN LÝ ĐƠN HÀNG (TẠO, CẬP NHẬT)
 * ==========================================
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
      paymentStatus: orderData.paymentMethod === 'WALLET' ? 'PAID' : 'UNPAID', // Nếu dùng ví thì tự set PAID
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp() 
    };
    const docRef = await addDoc(collection(db, COLLECTION_NAME), newOrder);
    
    // Trừ lượt dùng Voucher an toàn
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
 * ==========================================
 * 2. HỆ THỐNG THANH TOÁN VÍ & TÍCH ĐIỂM (MỚI)
 * ==========================================
 */

// Hàm trừ tiền ví khi đặt hàng (Sử dụng Transaction để đảm bảo tính nhất quán)
export const processWalletPayment = async (phone, amount) => {
  try {
    // Tìm user document ID dựa trên số điện thoại
    const q = query(collection(db, 'users'), where("username", "==", phone.trim()));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return { success: false, error: "Người dùng không tồn tại!" };
    
    const userDocId = snapshot.docs[0].id;
    const userRef = doc(db, 'users', userDocId);

    // Chạy Transaction để trừ tiền an toàn
    await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) throw new Error("Không tìm thấy tài khoản!");

      const currentBalance = userSnap.data().walletBalance || 0;
      if (currentBalance < amount) throw new Error("Số dư ví Plant G không đủ để thanh toán!");

      transaction.update(userRef, {
        walletBalance: increment(-amount),
        updatedAt: serverTimestamp()
      });
    });

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message || e };
  }
};

// Hoàn thành đơn hàng & Tích Xu (1,000đ = 10 Xu)
export const completeOrderWithBonus = async (order) => {
  try {
    const orderRef = doc(db, COLLECTION_NAME, order.id);
    const now = new Date();
    
    // Cập nhật trạng thái đơn
    await updateDoc(orderRef, {
      status: 'COMPLETED',
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // TÍCH ĐIỂM: Tính số Xu được nhận (Chỉ tính nếu không thanh toán bằng Ví để tránh lạm phát Xu nội bộ, hoặc tùy chính sách quán)
    // Ở đây tính cho MỌI đơn hàng để khuyến khích
    const totalAmount = parseInt(order.total.replace(/\D/g, '')) || 0;
    const earnedXu = Math.floor(totalAmount / 1000) * 10;

    if (earnedXu > 0) {
      const q = query(collection(db, 'users'), where("username", "==", order.phone.trim()));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const userRef = doc(db, 'users', snap.docs[0].id);
        await updateDoc(userRef, {
          totalXu: increment(earnedXu),
          totalSpend: increment(totalAmount) // Ghi nhận tổng chi tiêu
        });
      }
    }

    // Logic kiểm tra đơn trễ (Cho tính năng Voucher trễ)
    if (order.confirmedAt) {
      const confirmTime = order.confirmedAt.toDate();
      const diffInMinutes = Math.floor((now - confirmTime) / (1000 * 60));

      if (diffInMinutes >= 30) {
        return { success: true, late: true, earnedXu };
      }
    }
    
    return { success: true, late: false, earnedXu };
  } catch (error) {
    return { success: false, error: error.message };
  }
};


/**
 * ==========================================
 * 3. QUẢN LÝ VOUCHER 
 * ==========================================
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

export const awardLateVoucher = async (phone, orderId) => {
  try {
    const voucherCode = `XL-${orderId.slice(-4).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 3);

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


/**
 * ==========================================
 * 4. CÁC HÀM SUBSCRIPTIONS & STATUS
 * ==========================================
 */

export const confirmPaymentStatus = async (orderId, isPaid) => {
  try {
    const orderRef = doc(db, COLLECTION_NAME, orderId);
    const updateData = { paymentStatus: isPaid ? 'PAID' : 'UNPAID', updatedAt: serverTimestamp() };
    if (!isPaid) { updateData.paymentMethod = 'CASH'; }
    await updateDoc(orderRef, updateData);
    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
};

export const updateOrderStatus = async (orderId, newStatus) => {
  try {
    const orderRef = doc(db, COLLECTION_NAME, orderId);
    const orderSnap = await getDoc(orderRef);
    if (!orderSnap.exists()) return { success: false };
    
    const order = orderSnap.data();
    const updateData = { status: newStatus, updatedAt: serverTimestamp() };
    
    if (newStatus === 'PREPARING') {
      updateData.confirmedAt = serverTimestamp();
    }
    
    await updateDoc(orderRef, updateData);

    // CƠ CHẾ HOÀN MÃ VÀ HOÀN TIỀN VÍ
    if (newStatus === 'CANCELLED' && order.status === 'PENDING') {
      // 1. Hoàn Voucher
      if (order.usedVouchers) {
        for (const v of order.usedVouchers) {
          if (v.type !== 'FREESHIP') {
            await updateDoc(doc(db, VOUCHER_COL, v.id), { usageLimit: increment(1) });
          }
        }
      }
      
      // 2. Hoàn Tiền Ví (Nếu đơn bị hủy mà khách đã thanh toán bằng ví)
      if (order.paymentMethod === 'WALLET') {
        const totalAmount = parseInt(order.total.replace(/\D/g, '')) || 0;
        if (totalAmount > 0) {
          const q = query(collection(db, 'users'), where("username", "==", order.phone.trim()));
          const snap = await getDocs(q);
          if (!snap.empty) {
            await updateDoc(doc(db, 'users', snap.docs[0].id), {
               walletBalance: increment(totalAmount)
            });
          }
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

    if (order.usedVouchers) {
      for (const v of order.usedVouchers) {
        await updateDoc(doc(db, VOUCHER_COL, v.id), { usageLimit: increment(1) });
      }
    }

    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
};

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

    // CƠ CHẾ HOÀN MÃ VÀ TIỀN: Khách hủy đơn lúc PENDING
    if (isDirectCancel) {
      if (order.usedVouchers) {
        for (const v of order.usedVouchers) {
          if (v.type !== 'FREESHIP') {
            await updateDoc(doc(db, VOUCHER_COL, v.id), { usageLimit: increment(1) });
          }
        }
      }

      if (order.paymentMethod === 'WALLET') {
        const totalAmount = parseInt(order.total.replace(/\D/g, '')) || 0;
        if (totalAmount > 0) {
          const q = query(collection(db, 'users'), where("username", "==", order.phone.trim()));
          const snap = await getDocs(q);
          if (!snap.empty) {
            await updateDoc(doc(db, 'users', snap.docs[0].id), {
               walletBalance: increment(totalAmount)
            });
          }
        }
      }
    }

    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
};

export const undoDeleteOrder = async (orderId, usedVouchers = []) => {
  try {
    const orderRef = doc(db, COLLECTION_NAME, orderId);
    
    await updateDoc(orderRef, { 
      status: 'PENDING', 
      deleteReason: null,
      deletedBy: null,
      updatedAt: serverTimestamp() 
    });

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