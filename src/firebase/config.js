import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// MỚI: Import getFunctions để sử dụng Cloud Functions
import { getFunctions } from "firebase/functions";

// Cấu hình Firebase của bạn
const firebaseConfig = {
  apiKey: "AIzaSyADsIsf4oDLvhOREzhTRClQsYR7C1WHKyc",
  authDomain: "plantg-order-comtam.firebaseapp.com",
  projectId: "plantg-order-comtam",
  storageBucket: "plantg-order-comtam.firebasestorage.app",
  messagingSenderId: "593191873561",
  appId: "1:593191873561:web:ab02c10988c438e724ce88"
};

// CẬP NHẬT: Thêm từ khóa 'export' trước 'const app' 
// Điều này cực kỳ quan trọng để Firebase Auth hoạt động trong App.jsx và authService.js
export const app = initializeApp(firebaseConfig);

// Xuất Firestore Database
export const db = getFirestore(app);

// Xuất Firebase Storage
export const storage = getStorage(app);

// MỚI: Khởi tạo và xuất Firebase Functions
export const functions = getFunctions(app);