const { ApplicationBuilder, CommandHandler, MessageHandler } = require("zalo-bot-js");
const admin = require("firebase-admin");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

dotenv.config();

// --- KHỞI TẠO FIREBASE ADMIN ---
// Đảm bảo đường dẫn file json đúng
const serviceAccountPath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// --- KHỞI TẠO ZALO BOT ---
const app = new ApplicationBuilder()
  .token(process.env.ZALO_BOT_TOKEN)
  .build();

/**
 * 1. LỆNH /link: Kết nối Zalo ID với Số điện thoại khách hàng
 */
app.addHandler(new CommandHandler("link", async (update) => {
  const text = update.message?.text || "";
  const phone = text.split(" ")[1]?.trim();
  const zaloId = update.fromUser?.id;

  if (!phone || phone.length < 10) {
    return await update.message?.replyText("⚠️ Cú pháp: /link [Số điện thoại]");
  }

  try {
    const userRef = db.collection('users').doc(phone);
    const snap = await userRef.get();

    if (!snap.exists) {
      return await update.message?.replyText("❌ SĐT này chưa đăng ký trên Website!");
    }

    await userRef.update({ zaloId: zaloId });
    await update.message?.replyText(`✅ Chào ${snap.data().fullName}! Liên kết Zalo thành công.`);
  } catch (e) {
    await update.message?.replyText("❌ Lỗi: " + e.message);
  }
}));

/**
 * 2. LẮNG NGHE ĐƠN HÀNG (REAL-TIME)
 */
db.collection('orders').onSnapshot((snapshot) => {
  snapshot.docChanges().forEach(async (change) => {
    if (change.type === "modified") {
      const order = change.doc.data();
      const orderId = change.doc.id;

      const userSnap = await db.collection('users').doc(order.phone).get();
      const zaloId = userSnap.data()?.zaloId;

      if (zaloId) {
        const statusMap = {
          'PREPARING': '👨‍🍳 Đang chuẩn bị món',
          'SHIPPING': '🚚 Đang giao hàng',
          'COMPLETED': '✅ Đã hoàn thành',
          'CANCELLED': '❌ Đã bị hủy'
        };

        const message = `🔔 THÔNG BÁO ĐƠN HÀNG #${orderId.slice(-6).toUpperCase()}\n` +
                        `Trạng thái: ${statusMap[order.status] || order.status}\n` +
                        `Sản phẩm: ${order.items}`;
        
        try {
            await app.bot.sendMessage(zaloId, { text: message });
        } catch (err) {
            console.error("Lỗi gửi tin nhắn Zalo:", err.message);
        }
      }
    }
  });
});

/**
 * 3. CHAT BRIDGE: NHẬN TIN ZALO -> ĐẨY VÀO WEB ADMIN
 */
app.addHandler(new MessageHandler(async (update) => {
  const text = update.message?.text;
  const zaloId = update.fromUser?.id;

  if (!text || text.startsWith("/")) return;

  const userQuery = await db.collection('users').where("zaloId", "==", zaloId).limit(1).get();
  
  if (!userQuery.empty) {
    const phone = userQuery.docs[0].id;
    await db.collection('support_chats').doc(phone).collection('messages').add({
      sender: 'USER',
      text: `[Zalo]: ${text}`,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    await db.collection('support_chats').doc(phone).set({
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      unreadAdmin: true
    }, { merge: true });
  }
}));

// CHẠY BOT
void app.runPolling();
console.log("🚀 Zalo Bot (CommonJS) đang chạy và lắng nghe Firebase...");