import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  updateDoc, 
  doc, 
  getDoc,
  setDoc, 
  deleteDoc, 
  serverTimestamp, 
  orderBy,
  onSnapshot,
  increment,
  addDoc // MỚI: Thêm import addDoc để ghi log
} from 'firebase/firestore';

// MỚI: Thêm import để gọi Cloud Functions
import { httpsCallable } from 'firebase/functions'; 
import { db, app, functions } from '../firebase/config'; 

const auth = getAuth(app);
const COLLECTION_NAME = 'users';

/**
 * ==========================================
 * PHẦN 1: QUẢN LÝ TÀI KHOẢN KHÁCH HÀNG
 * ==========================================
 */

export const registerUser = async (userData) => {
  try {
    const cleanPhone = userData.username.trim();
    const userRef = doc(db, COLLECTION_NAME, cleanPhone); 
    
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return { success: false, error: 'Số điện thoại này đã được đăng ký!' };
    }

    const newUser = {
      ...userData,
      username: cleanPhone,
      role: 'user',   
      status: 'ACTIVE', 
      totalOrders: 0,
      createdAt: serverTimestamp(),
      isBanned: false, 
      banUntil: null,
      
      passcode: userData.passcode || "123456", 
      walletBalance: 0,    
      totalXu: 0,          
      totalSpend: 0,       
      avatarUrl: "",      
      addresses: userData.address ? [{ id: Date.now(), detail: userData.address, isDefault: true }] : []
    };

    await setDoc(userRef, newUser);
    return { success: true, id: cleanPhone };
  } catch (error) {
    console.error("Lỗi registerUser:", error);
    return { success: false, error: error.message };
  }
};

export const getUserByPhone = async (phone) => {
  try {
    if (!phone) return null;
    const cleanPhone = phone.trim();
    const userRef = doc(db, COLLECTION_NAME, cleanPhone);
    const snap = await getDoc(userRef);
    
    if (!snap.exists()) {
       const q = query(collection(db, COLLECTION_NAME), where("username", "==", cleanPhone));
       const qs = await getDocs(q);
       if (qs.empty) return null;
       const fallbackData = { id: qs.docs[0].id, ...qs.docs[0].data() };
       return checkBanStatus(fallbackData);
    }
    
    const userData = { id: snap.id, ...snap.data() };
    return checkBanStatus(userData);

  } catch (error) {
    console.error("Lỗi khi tìm user:", error);
    throw error;
  }
};

const checkBanStatus = async (userData) => {
  if (userData.isBanned) {
    if (userData.banUntil === 'permanent') {
       throw new Error("Tài khoản của bạn đã bị cấm vĩnh viễn. Vui lòng liên hệ quản trị viên.");
    }
    
    const now = new Date().getTime();
    if (now < userData.banUntil) {
       const dateStr = new Date(userData.banUntil).toLocaleString('vi-VN');
       throw new Error(`Tài khoản của bạn đang bị tạm khóa đến ${dateStr}.`);
    } else {
       await updateUserBanStatus(userData.id, { isBanned: false, banUntil: null });
       userData.isBanned = false; 
    }
  }
  return userData;
};

/**
 * ==========================================
 * MỚI: API GỌI BẢO MẬT (CHỐNG CHEAT)
 * ==========================================
 */

export const applyQuickBan = async ({ phone, reason, days }) => {
  if (!phone) return;
  try {
    // 1. Gọi Firebase Functions để thực hiện Ban bảo mật
    const applyBanFn = httpsCallable(functions, 'applyQuickBan');
    await applyBanFn({ phone, reason, days });
    
    // 2. GHI LOG VÀO NHẬT KÝ HỆ THỐNG
    await addDoc(collection(db, 'admin_logs'), {
      type: 'SECURITY',
      source: 'F12_HACK_DETECTED',
      action: `Cấm tự động 1 ngày`,
      targetPhone: phone,
      reason: reason,
      createdAt: serverTimestamp()
    });

    console.warn(`Đã yêu cầu cấm SĐT ${phone} do: ${reason}`);
  } catch (e) {
    console.error("Lỗi gửi yêu cầu Cấm:", e);
  }
};


/**
 * ==========================================
 * PHẦN 2: BẢO MẬT & XÁC THỰC PASSCODE KHÁCH HÀNG
 * ==========================================
 */

export const verifyPasscode = async (phone, inputPasscode) => {
  try {
    const q = query(collection(db, COLLECTION_NAME), where("username", "==", phone.trim()));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return false;
    const user = snapshot.docs[0].data();
    
    return user.passcode === inputPasscode;
  } catch (e) {
    return false;
  }
};

export const updateCustomerSecure = async (phone, newData, inputPasscode) => {
  const isValid = await verifyPasscode(phone, inputPasscode);
  if (!isValid) return { success: false, error: "Mã Passcode không chính xác!" };

  try {
    const q = query(collection(db, COLLECTION_NAME), where("username", "==", phone.trim()));
    const snapshot = await getDocs(q);
    const userId = snapshot.docs[0].id;
    
    const userRef = doc(db, COLLECTION_NAME, userId);
    
    const { username, phone: _p, ...safeData } = newData;

    await updateDoc(userRef, { 
      ...safeData, 
      updatedAt: serverTimestamp() 
    });
    
    return { success: true };
  } catch (e) { 
    return { success: false, error: e.message }; 
  }
};

export const updateCustomerAddresses = async (phone, addressList, inputPasscode) => {
  const isValid = await verifyPasscode(phone, inputPasscode);
  if (!isValid) return { success: false, error: "Mã Passcode không chính xác!" };

  if (addressList.length > 3) {
    return { success: false, error: "Chỉ được lưu tối đa 3 địa chỉ giao hàng." };
  }

  try {
    const q = query(collection(db, COLLECTION_NAME), where("username", "==", phone.trim()));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return { success: false, error: "Không tìm thấy dữ liệu người dùng." };
    
    const userId = snapshot.docs[0].id;
    const userRef = doc(db, COLLECTION_NAME, userId);
    
    await updateDoc(userRef, { 
      addresses: addressList, 
      updatedAt: serverTimestamp() 
    });
    
    return { success: true };
  } catch (e) { 
    return { success: false, error: e.message }; 
  }
};

export const changeCustomerPasscode = async (phone, oldPasscode, newPasscode) => {
  const isValid = await verifyPasscode(phone, oldPasscode);
  if (!isValid) return { success: false, error: "Mã Passcode hiện tại không chính xác!" };

  try {
    const q = query(collection(db, COLLECTION_NAME), where("username", "==", phone.trim()));
    const snapshot = await getDocs(q);
    const userId = snapshot.docs[0].id;
    
    const userRef = doc(db, COLLECTION_NAME, userId);
    await updateDoc(userRef, { passcode: newPasscode, updatedAt: serverTimestamp() });
    
    return { success: true };
  } catch (e) { 
    return { success: false, error: e.message }; 
  }
};


/**
 * ==========================================
 * PHẦN 3: QUẢN LÝ ADMIN & QUYỀN TRUY CẬP
 * ==========================================
 */

export const loginAdmin = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    localStorage.setItem('adminToken', 'true');
    return { success: true, user };
  } catch (error) {
    console.error("Lỗi đăng nhập Admin:", error);
    let errorMessage = "Lỗi hệ thống";
    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
      errorMessage = "Email hoặc mật khẩu không chính xác";
    }
    return { success: false, error: errorMessage };
  }
};

export const logoutAdmin = async () => {
  try {
    await signOut(auth);
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminInfo');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const subscribeToAuth = (callback) => {
  return onAuthStateChanged(auth, callback);
};

export const resetPasscodeByAdmin = async (userId, newPasscode) => {
  try {
    const userRef = doc(db, COLLECTION_NAME, userId);
    await updateDoc(userRef, { 
      passcode: newPasscode,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (e) { 
    return { success: false, error: e.message }; 
  }
};

export const adminUpdateBalance = async (userId, type, amount, note = "") => {
  try {
    const userRef = doc(db, COLLECTION_NAME, userId);
    
    // 1. Lấy dữ liệu hiện tại để biết số dư gốc
    const userSnap = await getDoc(userRef);
    const userData = userSnap.exists() ? userSnap.data() : {};
    
    const field = type === 'wallet' ? 'walletBalance' : 'totalXu';
    const currentBalance = userData[field] || 0;
    
    // 2. Cập nhật tiền/xu
    await updateDoc(userRef, {
      [field]: increment(amount),
      lastAdminAction: {
        type: amount > 0 ? 'TOPUP' : 'DEDUCT',
        asset: type,
        value: amount,
        note,
        at: new Date()
      },
      lastUpdateSource: 'admin',
      updatedAt: serverTimestamp()
    });

    // 3. GHI LOG BIẾN ĐỘNG SỐ DƯ
    await addDoc(collection(db, 'admin_logs'), {
      type: 'BALANCE',
      source: amount > 0 ? 'ADMIN_DEPOSIT' : 'ADMIN_DEDUCT',
      targetPhone: userId,
      assetType: type, // 'wallet' hoặc 'xu'
      walletChange: amount,
      walletBalance: currentBalance + amount, // Tổng số dư sau giao dịch
      reason: note || (amount > 0 ? 'Admin nạp thêm' : 'Admin trừ đi'),
      createdAt: serverTimestamp()
    });

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
};

export const updateAdminProfile = async (photoURL) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) return { success: false, error: "Chưa đăng nhập Admin" };

    await updateProfile(currentUser, { photoURL });
    
    const adminRef = doc(db, 'system', 'admin_profile');
    await setDoc(adminRef, { 
      photoURL, 
      email: currentUser.email,
      updatedAt: serverTimestamp() 
    }, { merge: true });

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};


/**
 * ==========================================
 * PHẦN 4: LẤY VÀ LẮNG NGHE DỮ LIỆU DANH SÁCH
 * ==========================================
 */

export const getAllUsers = async () => {
  try {
    const usersRef = collection(db, COLLECTION_NAME);
    const q = query(usersRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      joinDate: doc.data().createdAt?.toDate().toLocaleDateString('vi-VN') || 'Mới tạo'
    }));
  } catch (error) {
    console.error("Lỗi getAllUsers:", error);
    return [];
  }
};

export const subscribeToAllUsers = (callback) => {
  const usersRef = collection(db, COLLECTION_NAME);
  const q = query(usersRef, orderBy("createdAt", "desc"));

  return onSnapshot(q, (snapshot) => {
    const users = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      joinDate: doc.data().createdAt?.toDate().toLocaleDateString('vi-VN') || 'Mới tạo'
    }));
    callback(users);
  }, (error) => {
    console.error("Lỗi Real-time Users:", error);
  });
};

export const updateUserProfile = async (userId, updateData) => {
  try {
    const userRef = doc(db, COLLECTION_NAME, userId);
    await updateDoc(userRef, {
      ...updateData,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error("Lỗi updateUserProfile:", error);
    return { success: false, error: error.message };
  }
};

export const deleteUser = async (userId) => {
  try {
    const userRef = doc(db, COLLECTION_NAME, userId);
    await deleteDoc(userRef);
    return { success: true };
  } catch (error) {
    console.error("Lỗi khi xóa người dùng:", error);
    return { success: false, error: error.message };
  }
};

export const updateUserBanStatus = async (userId, banData) => {
  try {
    const userRef = doc(db, COLLECTION_NAME, userId);
    await updateDoc(userRef, {
      ...banData,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error("Lỗi khi cập nhật trạng thái cấm:", error);
    return { success: false, error: error.message };
  }
};