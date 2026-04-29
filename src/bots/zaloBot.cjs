const { ApplicationBuilder, CommandHandler, MessageHandler } = require("zalo-bot-js");
const admin = require("firebase-admin");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

// 1. CẤU HÌNH DOTENV
const envPath = path.resolve(__dirname, "../../.env");
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

// 2. KIỂM TRA BIẾN MÔI TRƯỜNG
const SA_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "./serviceAccountKey.json";
const BOT_TOKEN = process.env.ZALO_BOT_TOKEN;
const ADMIN_ZALO_ID = process.env.ZALO_BOT_ADMIN_ID; // ID Zalo nhận thông báo đơn hàng

// 3. KHỞI TẠO FIREBASE ADMIN
try {
    const serviceAccountPath = path.resolve(SA_PATH);
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    }
    console.log("✅ Firebase Admin đã kết nối.");
} catch (error) {
    console.error("❌ Lỗi khởi tạo Firebase:", error.message);
    process.exit(1);
}

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

// 4. KHỞI TẠO ZALO BOT
const app = new ApplicationBuilder()
  .token(BOT_TOKEN)
  .build();

/**
 * ==========================================
 * PHẦN 1: CÁC LỆNH ĐIỀU KHIỂN (COMMANDS)
 * ==========================================
 */

app.addHandler(new CommandHandler("id", async (update) => {
    const zaloId = update.fromUser?.id || update.userId;
    await update.message?.replyText(`🆔 ID Zalo của bạn là: ${zaloId}`);
}));

app.addHandler(new CommandHandler("link", async (update) => {
  const text = update.message?.text || "";
  const phone = text.split(" ")[1]?.trim();
  const zaloId = update.fromUser?.id || update.message?.fromUser?.id || update.userId;

  if (!phone || phone.length < 10) return await update.message?.replyText("⚠️ Cú pháp: /link [Số điện thoại]");
  if (!zaloId) return await update.message?.replyText("❌ Không xác định được ID Zalo. Vui lòng thử lại!");

  try {
    const userRef = db.collection('users').doc(phone);
    const snap = await userRef.get();
    if (!snap.exists) return await update.message?.replyText("❌ SĐT này chưa đăng ký trên Website!");

    await userRef.update({ 
        zaloId: zaloId,
        lastLinkedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    await update.message?.replyText(`✅ Chào ${snap.data().fullName}! Liên kết Zalo thành công.`);
  } catch (e) { await update.message?.replyText("❌ Lỗi hệ thống: " + e.message); }
}));

/**
 * ==========================================
 * PHẦN 2: LẮNG NGHE FIREBASE (REAL-TIME)
 * ==========================================
 */

// A. LẮNG NGHE ĐƠN HÀNG (BÁO ĐƠN MỚI CHO ADMIN & TRẠNG THÁI CHO KHÁCH)
db.collection('orders').onSnapshot((snapshot) => {
  snapshot.docChanges().forEach(async (change) => {
    const order = change.doc.data();
    const orderId = change.doc.id;

    // 1. THÔNG BÁO ĐƠN MỚI ĐẾN ZALO ADMIN
    if (change.type === "added" && !order.createdByAdmin) {
        if (ADMIN_ZALO_ID) {
            const msgAdmin = `🛒 ĐƠN HÀNG MỚI #${orderId.slice(-6).toUpperCase()}\n` +
                             `👤 Khách: ${order.customer}\n` +
                             `📞 SĐT: ${order.phone}\n` +
                             `📍 Đ/C: ${order.address}\n` +
                             `🍱 Món: ${order.items}\n` +
                             `💰 Tổng: ${order.total}`;
            
            await app.bot.sendMessage(ADMIN_ZALO_ID, {
                text: msgAdmin,
                buttons: [
                    { title: "👨‍🍳 Nhận đơn", payload: `CONFIRM_ORDER|${orderId}` },
                    { title: "❌ Hủy đơn", payload: `CANCEL_ORDER|${orderId}` }
                ]
            });
        }
    }

    // 2. BÁO THAY ĐỔI TRẠNG THÁI CHO KHÁCH
    if (change.type === "modified") {
      const userSnap = await db.collection('users').doc(order.phone).get();
      const zaloId = userSnap.data()?.zaloId;

      if (zaloId) {
        const statusMap = { 'PREPARING': '👨‍🍳 Đang chuẩn bị món', 'SHIPPING': '🚚 Đang giao hàng', 'COMPLETED': '✅ Đã hoàn thành', 'CANCELLED': '❌ Đã bị hủy' };
        const msg = `🔔 THÔNG BÁO ĐƠN #${orderId.slice(-6).toUpperCase()}\nTrạng thái: ${statusMap[order.status] || order.status}`;
        await app.bot.sendMessage(zaloId, { text: msg });
      }
    }
  });
});

// B. ĐỒNG BỘ TIN NHẮN TỪ WEB SANG ZALO (ADMIN -> KHÁCH)
db.collection('support_chats').onSnapshot((snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
        const chatData = change.doc.data();
        if (chatData && chatData.unreadUser === true) {
            const phone = change.doc.id;
            const userSnap = await db.collection('users').doc(phone).get();
            const zaloId = userSnap.data()?.zaloId;

            if (zaloId) {
                const msgSnap = await db.collection('support_chats').doc(phone)
                                        .collection('messages').orderBy('createdAt', 'desc').limit(1).get();
                if (!msgSnap.empty && msgSnap.docs[0].data().sender === 'ADMIN') {
                    const text = msgSnap.docs[0].data().text;
                    await app.bot.sendMessage(zaloId, { text: `💬 Admin trả lời:\n${text}` });
                    await db.collection('support_chats').doc(phone).update({ unreadUser: false });
                }
            }
        }
    });
});

/**
 * ==========================================
 * PHẦN 3: XỬ LÝ TIN NHẮN & PHÍM BẤM (ZALO -> WEB)
 * ==========================================
 */
app.addHandler(new MessageHandler(async (update) => {
  const text = update.message?.text;
  const payload = update.message?.payload;
  const zaloId = update.fromUser?.id || update.userId;

  // XỬ LÝ PHÍM BẤM THAO TÁC ĐƠN HÀNG (DÀNH CHO ADMIN)
  if (payload) {
      const [action, orderId] = payload.split("|");
      
      // Kiểm tra quyền: Chỉ Admin mới được dùng nút này
      if (zaloId !== ADMIN_ZALO_ID) {
          return await update.message?.replyText("🚫 Bạn không có quyền thao tác đơn hàng.");
      }

      try {
          const orderRef = db.collection('orders').doc(orderId);
          if (action === "CONFIRM_ORDER") {
              await orderRef.update({ 
                  status: 'PREPARING', 
                  confirmedAt: admin.firestore.FieldValue.serverTimestamp() 
              });
              await update.message?.replyText(`✅ Đã nhận đơn #${orderId.slice(-6).toUpperCase()}. Web Admin đã cập nhật.`);
          }
          if (action === "CANCEL_ORDER") {
              await orderRef.update({ 
                  status: 'CANCELLED', 
                  updatedAt: admin.firestore.FieldValue.serverTimestamp() 
              });
              await update.message?.replyText(`🗑️ Đã hủy đơn #${orderId.slice(-6).toUpperCase()}.`);
          }
      } catch (e) { await update.message?.replyText("❌ Lỗi: " + e.message); }
      return;
  }

  if (!text || text.startsWith("/")) return;

  const userQuery = await db.collection('users').where("zaloId", "==", zaloId).limit(1).get();
  if (!userQuery.empty) {
    const phone = userQuery.docs[0].id;
    await db.collection('support_chats').doc(phone).collection('messages').add({
      sender: 'USER', text: `[Zalo]: ${text}`, createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    await db.collection('support_chats').doc(phone).set({ lastUpdated: admin.firestore.FieldValue.serverTimestamp(), unreadAdmin: true }, { merge: true });
  }
}));

// CHẠY BOT
void app.runPolling();
console.log("🚀 Zalo Bot Full-Sync đang chạy...");