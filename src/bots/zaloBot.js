const { ApplicationBuilder, CommandHandler, MessageHandler } = require("zalo-bot-js");
const admin = require("firebase-admin");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

// 1. CẤU HÌNH DOTENV
const envPath = path.resolve(__dirname, "../../.env");
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log("✅ Đã tìm thấy file .env");
} else {
    console.error("❌ KHÔNG TÌM THẤY FILE .ENV!");
    process.exit(1);
}

// 2. KIỂM TRA BIẾN MÔI TRƯỜNG
const SA_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "./serviceAccountKey.json";
const BOT_TOKEN = process.env.ZALO_BOT_TOKEN;
const ADMIN_ZALO_ID = process.env.ZALO_BOT_ADMIN_ID;

if (!BOT_TOKEN) {
    console.error("❌ Thiếu ZALO_BOT_TOKEN!");
    process.exit(1);
}

// 3. KHỞI TẠO FIREBASE ADMIN
try {
    const serviceAccountPath = path.resolve(SA_PATH);
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    console.log("✅ Firebase Admin đã kết nối.");
} catch (error) {
    console.error("❌ Lỗi khởi tạo Firebase:", error.message);
    process.exit(1);
}

const db = admin.firestore();

// 4. KHỞI TẠO ZALO BOT
const app = new ApplicationBuilder().token(BOT_TOKEN).build();

/**
 * ==========================================
 * PHẦN 1: CÁC LỆNH ĐIỀU KHIỂN (COMMANDS)
 * ==========================================
 */

// LỆNH /link: Liên kết tài khoản
app.addHandler(new CommandHandler("link", async (update) => {
  const text = update.message?.text || "";
  const phone = text.split(" ")[1]?.trim();
  const zaloId = update.fromUser?.id;

  if (!phone || phone.length < 10) return await update.message?.replyText("⚠️ Cú pháp: /link [Số điện thoại]");

  try {
    const userRef = db.collection('users').doc(phone);
    const snap = await userRef.get();
    if (!snap.exists) return await update.message?.replyText("❌ SĐT này chưa đăng ký trên Website!");

    await userRef.update({ zaloId: zaloId });
    await update.message?.replyText(`✅ Chào ${snap.data().fullName}! Liên kết Zalo thành công.`);
  } catch (e) { await update.message?.replyText("❌ Lỗi: " + e.message); }
}));

// LỆNH /menu: Đặt món trực tiếp
app.addHandler(new CommandHandler("menu", async (update) => {
    await app.bot.sendMessage(update.fromUser.id, {
        text: "🍛 THỰC ĐƠN ĐẶT MÓN NHANH:\n(Bấm nút dưới đây để đặt đơn ngay)",
        buttons: [
            { title: "Cơm Tấm Sườn - 35k", payload: "ORDER_SUON" },
            { title: "Cơm Tấm Gà - 40k", payload: "ORDER_GA" },
            { title: "Mở Website Đầy Đủ", payload: "LINK_WEB" }
        ]
    });
}));

/**
 * ==========================================
 * PHẦN 2: LẮNG NGHE FIREBASE (WEB -> ZALO)
 * ==========================================
 */

// A. LẮNG NGHE TRẠNG THÁI ĐƠN HÀNG
db.collection('orders').onSnapshot((snapshot) => {
  snapshot.docChanges().forEach(async (change) => {
    if (change.type === "modified" || (change.type === "added" && change.doc.data().createdByAdmin)) {
      const order = change.doc.data();
      const userSnap = await db.collection('users').doc(order.phone).get();
      const zaloId = userSnap.data()?.zaloId;

      if (zaloId) {
        const statusMap = { 'PREPARING': '👨‍🍳 Đang chuẩn bị', 'SHIPPING': '🚚 Đang giao', 'COMPLETED': '✅ Đã hoàn thành', 'CANCELLED': '❌ Đã hủy' };
        const message = `🔔 THÔNG BÁO ĐƠN HÀNG #${change.doc.id.slice(-6).toUpperCase()}\nTrạng thái: ${statusMap[order.status] || order.status}\nSản phẩm: ${order.items}`;
        await app.bot.sendMessage(zaloId, { text: message });
      }
    }
  });
});

// B. LẮNG NGHE TIN NHẮN TỪ ADMIN (WEB CHAT -> ZALO)
db.collection('support_chats').onSnapshot((snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
        const chatData = change.doc.data();
        // Nếu unreadUser là true tức là Admin vừa nhắn từ Web
        if (chatData.unreadUser === true) {
            const phone = change.doc.id;
            const userSnap = await db.collection('users').doc(phone).get();
            const zaloId = userSnap.data()?.zaloId;

            if (zaloId) {
                // Lấy tin nhắn mới nhất của Admin
                const msgSnap = await db.collection('support_chats').doc(phone)
                                        .collection('messages').orderBy('createdAt', 'desc').limit(1).get();
                
                if (!msgSnap.empty && msgSnap.docs[0].data().sender === 'ADMIN') {
                    const adminText = msgSnap.docs[0].data().text;
                    await app.bot.sendMessage(zaloId, { text: `💬 Admin trả lời:\n${adminText}` });
                    // Gửi xong thì reset cờ unreadUser trên Firebase
                    await db.collection('support_chats').doc(phone).update({ unreadUser: false });
                }
            }
        }
    });
});

// C. LẮNG NGHE CẢNH BÁO BẢO MẬT (GỬI CHO ADMIN)
db.collection('admin_logs').where('type', '==', 'SECURITY').orderBy('createdAt', 'desc').limit(1).onSnapshot(snap => {
    if (!snap.empty && ADMIN_ZALO_ID) {
        const log = snap.docs[0].data();
        const time = log.createdAt?.toDate().toLocaleTimeString('vi-VN');
        // Chỉ báo nếu log mới trong vòng 1 phút
        if (new Date() - log.createdAt?.toDate() < 60000) {
            app.bot.sendMessage(ADMIN_ZALO_ID, { text: `🛡️ CẢNH BÁO BẢO MẬT [${time}]\nKhách: ${log.targetPhone}\nHành vi: ${log.reason}\nPhạt: ${log.action}` });
        }
    }
});

/**
 * ==========================================
 * PHẦN 3: XỬ LÝ TIN NHẮN (ZALO -> WEB)
 * ==========================================
 */
app.addHandler(new MessageHandler(async (update) => {
  const text = update.message?.text;
  const payload = update.message?.payload;
  const zaloId = update.fromUser?.id;

  if (text?.startsWith("/")) return;

  // Xử lý Phím bấm (Buttons)
  if (payload) {
      if (payload === "ORDER_SUON" || payload === "ORDER_GA") {
          const userQuery = await db.collection('users').where("zaloId", "==", zaloId).limit(1).get();
          if (userQuery.empty) return await update.message?.replyText("❌ Bạn cần dùng lệnh /link [SĐT] trước khi đặt món.");
          
          const user = userQuery.docs[0].data();
          const dish = payload === "ORDER_SUON" ? "Cơm Tấm Sườn" : "Cơm Tấm Gà";
          const price = payload === "ORDER_SUON" ? "35.000đ" : "40.000đ";

          await db.collection('orders').add({
              phone: user.username, customer: user.fullName, address: user.address || "Chưa cập nhật",
              items: dish, total: price, status: 'PENDING', paymentMethod: 'CASH', paymentStatus: 'UNPAID',
              createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
          return await update.message?.replyText(`✅ Đã tạo đơn [${dish}]. Shipper sẽ liên hệ bạn tại SĐT ${user.username}.`);
      }
      return;
  }

  // Xử lý Chat thông thường
  const userQuery = await db.collection('users').where("zaloId", "==", zaloId).limit(1).get();
  if (!userQuery.empty) {
    const phone = userQuery.docs[0].id;
    await db.collection('support_chats').doc(phone).collection('messages').add({
      sender: 'USER', text: `[Zalo]: ${text}`, createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    await db.collection('support_chats').doc(phone).set({ lastUpdated: admin.firestore.FieldValue.serverTimestamp(), unreadAdmin: true }, { merge: true });
  }
}));

void app.runPolling();
console.log("🚀 Zalo Bot (Real-time Full Sync) đang chạy...");