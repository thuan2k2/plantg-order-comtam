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
  runTransaction // Dùng transaction để đảm bảo an toàn ví
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

// FIX LỖI: Tạo đơn hàng kèm thanh toán Ví an toàn tuyệt đối
export const createOrderSecure = async (orderData) => {
  if (isSubmittingOrder) {
    return { success: false, error: "Hệ thống đang xử lý đơn hàng, vui lòng không ấn liên tiếp!" };
  }
  isSubmittingOrder = true;

  try {
    const cleanPhone = orderData.phone.trim();
    const isWallet = orderData.paymentMethod === 'WALLET';
    const totalAmount = parseInt(orderData.total.replace(/\D/g, '')) || 0;

    // 1. Dùng Transaction để đảm bảo tính nhất quán dữ liệu
    const result = await runTransaction(db, async (transaction) => {
      // Vì User ID bây giờ chính là SĐT, ta gọi thẳng doc() thay vì query getDocs
      const userRef = doc(db, 'users', cleanPhone);

      if (isWallet) {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw new Error("Không tìm thấy thông tin ví!");
        
        const currentBalance = userDoc.data().walletBalance || 0;

        if (currentBalance < totalAmount) {
          throw new Error("Số dư ví không đủ! Vui lòng nạp thêm.");
        }

        // Thực hiện trừ tiền
        transaction.update(userRef, {
          walletBalance: increment(-totalAmount),
          updatedAt: serverTimestamp()
        });
      }

      // 2. Tạo đơn hàng (Vẫn nằm trong vòng transaction)
      const orderRef = doc(collection(db, COLLECTION_NAME));
      const newOrder = {
        ...orderData,
        status: 'PENDING',
        paymentStatus: isWallet ? 'PAID' : 'UNPAID', // Nếu dùng ví thì tự set PAID
        adminNote: isWallet ? "THANH TOÁN VÍ (Thu 0đ)" : "",
        isPaid: isWallet,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp() 
      };
      
      transaction.set(orderRef, newOrder);
      return { id: orderRef.id };
    });

    // 3. Trừ lượt dùng Voucher an toàn (Sau khi giao dịch chính thành công)
    if (orderData.usedVouchers && orderData.usedVouchers.length > 0) {
      for (const v of orderData.usedVouchers) {
        await updateDoc(doc(db, VOUCHER_COL, v.id), {
          usageLimit: increment(-1)
        });
      }
    }

    isSubmittingOrder = false;
    return { success: true, id: result.id };
  } catch (error) {
    isSubmittingOrder = false;
    console.error("Lỗi createOrderSecure:", error);
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
 * 2. HỆ THỐNG THANH TOÁN VÍ & TÍCH ĐIỂM (CẬP NHẬT)
 * ==========================================
 */

// Hàm trừ tiền ví khi đặt hàng (Đã được chuyển vào trong hàm createOrderSecure)
export const processWalletPayment = async (phone, amount) => {
  try {
    const cleanPhone = phone.trim();
    const userRef = doc(db, 'users', cleanPhone); // ID là SĐT

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

// FIX LỖI ĐỒNG BỘ: Hoàn thành đơn hàng & Tích Xu (1,000đ = 10 Xu)
export const completeOrderWithBonus = async (order) => {
  try {
    const orderRef = doc(db, COLLECTION_NAME, order.id);
    const now = new Date();
    
    // 1. Cập nhật trạng thái đơn hàng
    await updateDoc(orderRef, {
      status: 'COMPLETED',
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // 2. Tính toán Xu (1,000đ = 10 Xu)
    const totalAmount = parseInt(order.total.replace(/\D/g, '')) || 0;
    const earnedXu = Math.floor(totalAmount / 1000) * 10;

    // 3. Tìm và cập nhật Xu vào User (Sử dụng trực tiếp ID Document là SĐT)
    if (earnedXu > 0) {
      const cleanPhone = order.phone.trim();
      const userDocRef = doc(db, 'users', cleanPhone);
      
      const userSnap = await getDoc(userDocRef);
      
      if (userSnap.exists()) {
        await updateDoc(userDocRef, {
          totalXu: increment(earnedXu),
          totalSpend: increment(totalAmount), // Ghi nhận tổng chi tiêu để tính Rank
          updatedAt: serverTimestamp()
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
    console.error("Lỗi hoàn thành đơn:", error);
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

// CƠ CHẾ HOÀN TIỀN VÍ (ĐỒNG BỘ THEO ID SĐT)
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

    // CƠ CHẾ HOÀN MÃ VÀ HOÀN TIỀN VÍ (CHỈ KHI HỦY ĐƠN PENDING)
    if (newStatus === 'CANCELLED' && order.status === 'PENDING') {
      // 1. Hoàn Voucher
      if (order.usedVouchers) {
        for (const v of order.usedVouchers) {
          if (v.type !== 'FREESHIP') {
            await updateDoc(doc(db, VOUCHER_COL, v.id), { usageLimit: increment(1) });
          }
        }
      }
      
      // 2. Hoàn Tiền Ví (Chỉ hoàn nếu KHÁCH ĐÃ THANH TOÁN BẰNG VÍ và ĐƠN ĐÃ PAID)
      if (order.paymentMethod === 'WALLET' && order.paymentStatus === 'PAID') {
        const totalAmount = parseInt(order.total.replace(/\D/g, '')) || 0;
        if (totalAmount > 0) {
          const cleanPhone = order.phone.trim();
          const userDocRef = doc(db, 'users', cleanPhone);
          
          const userSnap = await getDoc(userDocRef);
          if (userSnap.exists()) {
            await updateDoc(userDocRef, {
               walletBalance: increment(totalAmount),
               updatedAt: serverTimestamp()
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

      if (order.paymentMethod === 'WALLET' && order.paymentStatus === 'PAID') {
        const totalAmount = parseInt(order.total.replace(/\D/g, '')) || 0;
        if (totalAmount > 0) {
          const cleanPhone = order.phone.trim();
          const userDocRef = doc(db, 'users', cleanPhone);
          
          const userSnap = await getDoc(userDocRef);
          if (userSnap.exists()) {
            await updateDoc(userDocRef, {
               walletBalance: increment(totalAmount),
               updatedAt: serverTimestamp()
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