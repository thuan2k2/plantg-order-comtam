import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Cấu hình Firebase của bạn (Lấy từ Firebase Console)
const firebaseConfig = {
  apiKey: "AIzaSyADsIsf4oDLvhOREzhTRClQsYR7C1WHKyc",
  authDomain: "plantg-order-comtam.firebaseapp.com", // Ví dụ
  projectId: "plantg-order-comtam",                  // Ví dụ
  storageBucket: "plantg-order-comtam.firebasestorage.app",  // Ví dụ
  messagingSenderId: "593191873561",
  appId: "1:593191873561:web:ab02c10988c438e724ce88"
};

// Khởi tạo Firebase
const app = initializeApp(firebaseConfig);

// Khởi tạo và xuất Firestore Database để các file khác sử dụng
export const db = getFirestore(app);