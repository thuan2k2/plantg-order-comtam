import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
// MỚI: Import getDatabase để sử dụng Realtime Database cho tính năng onDisconnect
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyADsIsf4oDLvhOREzhTRClQsYR7C1WHKyc",
  authDomain: "plantg-order-comtam.firebaseapp.com",
  projectId: "plantg-order-comtam",
  storageBucket: "plantg-order-comtam.firebasestorage.app",
  messagingSenderId: "593191873561",
  appId: "1:593191873561:web:ab02c10988c438e724ce88",
  // MỚI: Thêm Database URL cho Realtime Database
  databaseURL: "https://plantg-order-comtam-default-rtdb.asia-southeast1.firebasedatabase.app"
};

// Khởi tạo ứng dụng Firebase
export const app = initializeApp(firebaseConfig);

// Xuất Firestore Database (Dữ liệu chính)
export const db = getFirestore(app);

// Xuất Firebase Storage (Hình ảnh)
export const storage = getStorage(app);

// Xuất Firebase Functions (Xử lý bảo mật server-side)
export const functions = getFunctions(app);

// MỚI: Khởi tạo và xuất Realtime Database (Dùng cho trạng thái Online/Offline Admin)
export const rtdb = getDatabase(app);