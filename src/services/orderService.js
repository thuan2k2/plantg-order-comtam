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
  runTransaction,
  setDoc 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { applyQuickBan } from './authService'; // MỚI: Import lệnh trừng phạt bảo mật

const COLLECTION_NAME = 'orders';
const VOUCHER_COL = 'vouchers';

let isSubmittingOrder = false;

// BỘ NHỚ THEO DÕI BẢO MẬT (Chống SPAM & Dò Mã)
const spamTracker = {}; 
const voucherBruteForceTracker = {};

// Hàm Ghi Log An Toàn (Đảm bảo lỗi Log không làm sập giao dịch chính)
const safeLogAdmin = async (logData) => {
  try {
    await addDoc(collection(db, 'admin_logs'), { ...logData, createdAt: serverTimestamp() });
  } catch (error) {
    console.warn("Cảnh báo: Không thể ghi log nhưng giao dịch đã hoàn tất thành công", error);
  }
};

/**
 * ==========================================
 * 1. QUẢN LÝ ĐƠN HÀNG (TẠO, CẬP NHẬT)
 * ==========================================
 */

export const createOrderSecure = async (orderData) => {
  const cleanPhone = orderData.phone.trim();
  const now = Date.now();

  // BẢO MẬT 1: KIỂM TRA SPAM TẠO ĐƠN (Khoảng cách < 10 giây)
  if (spamTracker[cleanPhone] && now - spamTracker[cleanPhone] < 10000) {
    applyQuickBan({ phone: cleanPhone, reason: 'Phát hiện spam click tạo đơn hàng liên tục', type: 'SPAM' });
    return { success: false, error: "Hệ thống phát hiện Spam! Tài khoản đã bị tạm khóa bảo mật." };
  }
  spamTracker[cleanPhone] = now;

  if (isSubmittingOrder) {
    return { success: false, error: "Hệ thống đang xử lý đơn hàng, vui lòng không ấn liên tiếp!" };
  }
  isSubmittingOrder = true;

  try {
    const isWallet = orderData.paymentMethod === 'WALLET';
    const totalAmount = parseInt(orderData.total.replace(/\D/g, '')) || 0;
    
    let pendingLog = null; 

    const result = await runTransaction(db, async (transaction) => {
      const userRef = doc(db, 'users', cleanPhone);
      let currentBalance = 0;

      if (isWallet) {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw new Error("Không tìm thấy thông tin ví!");
        
        currentBalance = userDoc.data().walletBalance || 0;

        if (currentBalance < totalAmount) {
          // BẢO MẬT 2: PHÁT HIỆN HACK SỐ DƯ VÍ (Can thiệp frontend để hiện nút thanh toán)
          applyQuickBan({ phone: cleanPhone, reason: 'Phát hiện can thiệp mã nguồn thanh toán ảo (Hack số dư ví)', type: 'CHEAT' });
          throw new Error("Phát hiện can thiệp hệ thống! Tài khoản đã bị khóa vĩnh viễn.");
        }

        // Cập nhật trừ tiền trong ví
        transaction.update(userRef, {
          walletBalance: increment(-totalAmount),
          lastUpdateSource: 'order_payment',
          updatedAt: serverTimestamp()
        });

        pendingLog = {
          type: 'BALANCE',
          source: 'ORDER_PAYMENT',
          targetPhone: cleanPhone,
          assetType: 'wallet',
          walletChange: -totalAmount,
          walletBalance: currentBalance - totalAmount,
          reason: 'Thanh toán đơn hàng'
        };
      }

      const orderRef = doc(collection(db, COLLECTION_NAME));
      const newOrder = {
        ...orderData,
        status: 'PENDING',
        paymentStatus: isWallet ? 'PAID' : 'UNPAID', 
        adminNote: isWallet ? "THANH TOÁN VÍ (Thu 0đ)" : "",
        isPaid: isWallet,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp() 
      };
      
      transaction.set(orderRef, newOrder);
      return { id: orderRef.id };
    });

    if (pendingLog) {
      pendingLog.reason = `Thanh toán đơn hàng #${result.id.slice(-6).toUpperCase()}`;
      safeLogAdmin(pendingLog);
    }

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

export const adminCreateOrder = async (orderData) => {
  try {
    const cleanPhone = orderData.phone.trim();
    
    const newOrder = {
      phone: cleanPhone,
      customer: orderData.customer.trim(),
      address: orderData.address.trim() || 'Tại quán / Mua mang về',
      items: orderData.items.trim(),
      total: orderData.total.trim(),
      note: orderData.note.trim() || '',
      paymentMethod: 'CASH', 
      paymentStatus: 'UNPAID', 
      status: 'PENDING', 
      deliveryType: 'NOW', 
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdByAdmin: true 
    };

    const orderRef = await addDoc(collection(db, COLLECTION_NAME), newOrder);

    const userRef = doc(db, 'users', cleanPhone);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      await setDoc(userRef, {
        fullName: orderData.customer.trim(),
        phone: cleanPhone,
        address: orderData.address.trim(),
        username: cleanPhone,
        passcode: '123456', 
        coins: 0,
        totalXu: 0,
        walletBalance: 0,
        createdAt: serverTimestamp(),
        autoCreatedByAdmin: true 
      });
    } else {
      await updateDoc(userRef, {
        fullName: orderData.customer.trim(),
        address: orderData.address.trim() || userSnap.data().address || '',
        updatedAt: serverTimestamp()
      });
    }

    return { success: true, id: orderRef.id };
  } catch (error) {
    console.error("Lỗi adminCreateOrder:", error);
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
 * 2. HỆ THỐNG THANH TOÁN VÍ & TÍCH ĐIỂM
 * ==========================================
 */

export const processWalletPayment = async (phone, amount) => {
  try {
    const cleanPhone = phone.trim();
    const userRef = doc(db, 'users', cleanPhone); 
    let pendingLog = null;

    await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) throw new Error("Không tìm thấy tài khoản!");

      const currentBalance = userSnap.data().walletBalance || 0;
      if (currentBalance < amount) {
        // BẢO MẬT 3: HACK THANH TOÁN SAU KHI TẠO ĐƠN
        applyQuickBan({ phone: cleanPhone, reason: 'Phát hiện can thiệp thanh toán ví không hợp lệ', type: 'CHEAT' });
        throw new Error("Giao dịch bất thường! Tài khoản đã bị khóa.");
      }

      transaction.update(userRef, {
        walletBalance: increment(-amount),
        lastUpdateSource: 'order_payment',
        updatedAt: serverTimestamp()
      });

      pendingLog = {
        type: 'BALANCE', source: 'ORDER_PAYMENT', targetPhone: cleanPhone, assetType: 'wallet',
        walletChange: -amount, walletBalance: currentBalance - amount, reason: `Thanh toán bổ sung bằng Ví`
      };
    });

    if (pendingLog) safeLogAdmin(pendingLog);

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message || e };
  }
};

export const completeOrderWithBonus = async (order) => {
  try {
    const orderRef = doc(db, COLLECTION_NAME, order.id);
    const now = new Date();
    
    await updateDoc(orderRef, {
      status: 'COMPLETED', completedAt: serverTimestamp(), updatedAt: serverTimestamp()
    });

    const totalAmount = parseInt(order.total.replace(/\D/g, '')) || 0;
    const earnedXu = Math.floor(totalAmount / 1000) * 10;

    if (earnedXu > 0) {
      const cleanPhone = order.phone.trim();
      const userDocRef = doc(db, 'users', cleanPhone);
      const userSnap = await getDoc(userDocRef);
      
      if (userSnap.exists()) {
        const currentXu = userSnap.data().totalXu || 0;

        await updateDoc(userDocRef, {
          totalXu: increment(earnedXu), totalSpend: increment(totalAmount), 
          lastUpdateSource: 'order_payment', updatedAt: serverTimestamp()
        });

        safeLogAdmin({
          type: 'BALANCE', source: 'ORDER_BONUS', targetPhone: cleanPhone, assetType: 'xu',
          walletChange: earnedXu, walletBalance: currentXu + earnedXu, reason: `Thưởng xu hoàn thành đơn #${order.id.slice(-6).toUpperCase()}`
        });
      }
    }

    if (order.confirmedAt) {
      const confirmTime = order.confirmedAt.toDate();
      const diffInMinutes = Math.floor((now - confirmTime) / (1000 * 60));
      if (diffInMinutes >= 30) return { success: true, late: true, earnedXu };
    }
    
    return { success: true, late: false, earnedXu };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ==========================================
// HÀM NHẬN XU TỪ PET
// ==========================================
export const claimPetReward = async (phone, minCoins = 1, maxCoins = 100) => {
  try {
    const cleanPhone = phone.trim();

    // BẢO MẬT 4: PHÁT HIỆN BUG XU SỰ KIỆN (Truyền giá trị max siêu lớn)
    if (maxCoins > 700 || minCoins < 0) {
      applyQuickBan({ phone: cleanPhone, reason: 'Phát hiện can thiệp phần thưởng sự kiện (Bug Xu)', type: 'BUG_XU' });
      return { success: false, error: "Lỗi dữ liệu! Hành vi bất thường đã bị ghi nhận." };
    }

    const userRef = doc(db, 'users', cleanPhone);
    const userSnap = await getDoc(userRef);
    const currentXu = userSnap.exists() ? (userSnap.data().totalXu || 0) : 0;

    const rewardCoins = Math.floor(Math.random() * (maxCoins - minCoins + 1)) + minCoins;

    await updateDoc(userRef, {
      coins: increment(rewardCoins), totalXu: increment(rewardCoins),
      lastPetInteraction: serverTimestamp(), lastUpdateSource: 'pet', updatedAt: serverTimestamp()
    });

    safeLogAdmin({
      type: 'BALANCE', source: 'PET_REWARD', targetPhone: cleanPhone, assetType: 'xu',
      walletChange: rewardCoins, walletBalance: currentXu + rewardCoins, reason: `Nhận xu ngẫu nhiên từ Thú cưng`
    });

    return { success: true, reward: rewardCoins };
  } catch (error) {
    return { success: false, error: error.message };
  }
};


/**
 * ==========================================
 * 3. QUẢN LÝ VOUCHER (ĐÃ NÂNG CẤP REAL-TIME)
 * ==========================================
 */

// Hàm cũ (Dùng để lấy 1 lần, giữ lại để tương thích các File khác nếu cần)
export const getMyVouchers = async (phone) => {
  try {
    const vouchersRef = collection(db, VOUCHER_COL);
    const now = new Date();
    const qPublic = query(vouchersRef, where("assignedPhone", "==", ""), where("usageLimit", ">", 0));
    const snapPublic = await getDocs(qPublic);
    const publicVouchers = snapPublic.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    let personalVouchers = [];
    if (phone && phone.trim().length >= 10) {
      const qPersonal = query(vouchersRef, where("assignedPhone", "==", phone.trim()), where("usageLimit", ">", 0));
      const snapPersonal = await getDocs(qPersonal);
      personalVouchers = snapPersonal.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    return [...publicVouchers, ...personalVouchers].filter(v => !v.expiry || v.expiry.toDate() > now);
  } catch (error) { return []; }
};

// Hàm cũ
export const getAllVouchers = async () => {
  try {
    const q = query(collection(db, VOUCHER_COL), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) { return []; }
};

// MỚI: HÀM THEO DÕI VOUCHER CÁ NHÂN THEO THỜI GIAN THỰC (REAL-TIME)
export const subscribeToMyVouchers = (phone, callback) => {
  if (!phone) return () => {};
  const q = query(collection(db, VOUCHER_COL), where("usageLimit", ">", 0));
  
  return onSnapshot(q, (snapshot) => {
    const now = new Date();
    const allVouchers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // JS Filter để tránh lỗi Composite Index trên Firebase
    const validVouchers = allVouchers.filter(v => {
      if (v.expiry && v.expiry.toDate() < now) return false; // Hết hạn
      if (v.assignedPhone && v.assignedPhone.trim() !== "" && v.assignedPhone !== phone.trim()) return false; // Của người khác
      return true;
    });
    
    callback(validVouchers);
  });
};

// MỚI: HÀM THEO DÕI TOÀN BỘ VOUCHER (REAL-TIME CHO ADMIN)
export const subscribeToAllVouchers = (callback) => {
  const q = query(collection(db, VOUCHER_COL), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  });
};

export const validateVoucher = async (code, phone) => {
  try {
    const cleanPhone = phone.trim();
    const q = query(collection(db, VOUCHER_COL), where("code", "==", code.toUpperCase().trim()));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      // BẢO MẬT 5: PHÁT HIỆN DÒ MÃ VOUCHER RÁC (BRUTE-FORCE)
      voucherBruteForceTracker[cleanPhone] = (voucherBruteForceTracker[cleanPhone] || 0) + 1;
      if (voucherBruteForceTracker[cleanPhone] >= 7) {
        applyQuickBan({ phone: cleanPhone, reason: 'Phát hiện dấu hiệu bất thường (Dò tìm mã Voucher liên tục)', type: 'ANOMALY' });
        voucherBruteForceTracker[cleanPhone] = 0;
        return { valid: false, msg: "Hệ thống phát hiện spam dò mã. Tài khoản bị tạm khóa!" };
      }
      return { valid: false, msg: "Mã không tồn tại!" };
    }
    
    // Nếu nhập đúng mã thì reset lại bộ đếm cho khách hàng
    voucherBruteForceTracker[cleanPhone] = 0;
    
    const v = snapshot.docs[0].data();
    const vId = snapshot.docs[0].id;
    const now = new Date();

    if (v.assignedPhone && v.assignedPhone.trim() !== "" && v.assignedPhone !== cleanPhone) {
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
      code: voucherCode, type: 'CASH', value: 5000, usageLimit: 1, assignedPhone: phone,
      expiry: expiryDate, description: `Bồi thường giao trễ đơn #${orderId.slice(-6).toUpperCase()}`, createdAt: serverTimestamp()
    });

    const orderRef = doc(db, COLLECTION_NAME, orderId);
    await updateDoc(orderRef, { lateVoucherStatus: 'AWARDED', updatedAt: serverTimestamp() });

    return { success: true, code: voucherCode };
  } catch (error) { return { success: false, error: error.message }; }
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

    if (newStatus === 'CANCELLED' && order.status === 'PENDING') {
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
            const currentBalance = userSnap.data().walletBalance || 0;

            await updateDoc(userDocRef, {
               walletBalance: increment(totalAmount),
               lastUpdateSource: 'refund',
               updatedAt: serverTimestamp()
            });

            safeLogAdmin({
              type: 'BALANCE', source: 'ORDER_REFUND', targetPhone: cleanPhone, assetType: 'wallet',
              walletChange: totalAmount, walletBalance: currentBalance + totalAmount,
              reason: `Hoàn tiền do Admin hủy đơn #${orderId.slice(-6).toUpperCase()}`
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
      status: 'DELETED', deleteReason: reason, deletedBy: deleterName, updatedAt: serverTimestamp() 
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
      cancelReason: reason || "Khách tự hủy", updatedAt: serverTimestamp()
    });

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
            const currentBalance = userSnap.data().walletBalance || 0;

            await updateDoc(userDocRef, {
               walletBalance: increment(totalAmount), lastUpdateSource: 'refund', updatedAt: serverTimestamp()
            });

            safeLogAdmin({
              type: 'BALANCE', source: 'ORDER_REFUND', targetPhone: cleanPhone, assetType: 'wallet',
              walletChange: totalAmount, walletBalance: currentBalance + totalAmount,
              reason: `Hoàn tiền do khách tự hủy đơn #${orderId.slice(-6).toUpperCase()}`
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
      status: 'PENDING', deleteReason: null, deletedBy: null, updatedAt: serverTimestamp() 
    });

    if (usedVouchers && usedVouchers.length > 0) {
      for (const v of usedVouchers) {
        await updateDoc(doc(db, VOUCHER_COL, v.id), { usageLimit: increment(-1) });
      }
    }

    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
};