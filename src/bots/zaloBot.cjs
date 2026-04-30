const ZaloBot = require('node-zalo-bot');
const express = require('express');
const admin = require('firebase-admin');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

// 1. KHỞI TẠO FIREBASE
const SA_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "./serviceAccountKey.json";
try {
    const serviceAccount = JSON.parse(fs.readFileSync(path.resolve(SA_PATH), 'utf8'));
    if (!admin.apps.length) {
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    }
} catch (error) { process.exit(1); }
const db = admin.firestore();

// 2. KHỞI TẠO SERVER & BOT (Chuyển sang Webhook cho Render)
const app = express();
app.use(express.json());

const bot = new ZaloBot(process.env.BOT_TOKEN, { polling: false });
const ADMIN_ZALO_ID = process.env.ZALO_BOT_ADMIN_ID;

// Hàm định dạng nội dung đơn hàng đầy đủ
const formatOrderInfo = (orderId, order) => {
    return `📦 CHI TIẾT ĐƠN HÀNG #${orderId.slice(-6).toUpperCase()}\n` +
           `--------------------------\n` +
           `👤 Khách: ${order.customer}\n` +
           `📞 SĐT: ${order.phone}\n` +
           `📍 Đ/C: ${order.address}\n` +
           `🍲 Món: ${order.items}\n` +
           `💰 Tổng tiền: ${order.total}\n` +
           `💳 T.Toán: ${order.paymentMethod} (${order.paymentStatus})\n` +
           `📝 Ghi chú: ${order.note || 'Không có'}\n` +
           `⏰ Lúc: ${order.createdAt?.toDate().toLocaleString('vi-VN')}`;
};

/**
 * --- XỬ LÝ LỆNH ---
 */
bot.onText(/\/id/, (msg) => bot.sendMessage(msg.chat.id, `🆔 ID của bạn: ${msg.chat.id}`));

bot.onText(/\/link (.+)/, async (msg, match) => {
    const phone = match[1].trim();
    try {
        const userRef = db.collection('users').doc(phone);
        const snap = await userRef.get();
        if (!snap.exists) return bot.sendMessage(msg.chat.id, "❌ SĐT chưa có trên hệ thống!");
        await userRef.update({ zaloId: msg.chat.id });
        bot.sendMessage(msg.chat.id, `✅ Chào ${snap.data().fullName}! Đã liên kết thành công.`);
    } catch (e) { bot.sendMessage(msg.chat.id, "❌ Lỗi: " + e.message); }
});

/**
 * --- LẮNG NGHE FIREBASE REAL-TIME ---
 */
db.collection('orders').onSnapshot((snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
        const order = change.doc.data();
        const orderId = change.doc.id;

        // Báo ĐƠN MỚI cho Admin (Đầy đủ thông tin)
        if (change.type === "added" && !order.createdByAdmin) {
            const isRecent = order.createdAt && (Date.now() - order.createdAt.toDate().getTime() < 60000);
            if (ADMIN_ZALO_ID && isRecent) {
                bot.sendMessage(ADMIN_ZALO_ID, formatOrderInfo(orderId, order), {
                    reply_markup: {
                        inline_keyboard: [[
                            { text: "👨‍🍳 Nhận đơn", callback_data: `CONFIRM|${orderId}` },
                            { text: "❌ Hủy đơn", callback_data: `CANCEL|${orderId}` }
                        ]]
                    }
                });
            }
        }

        // Báo THAY ĐỔI trạng thái cho Khách
        if (change.type === "modified") {
            const userSnap = await db.collection('users').doc(order.phone).get();
            const zaloId = userSnap.data()?.zaloId;
            if (zaloId) {
                const statusMap = { 'PREPARING': '👨‍🍳 Đang chuẩn bị', 'SHIPPING': '🚚 Đang giao', 'COMPLETED': '✅ Đã xong', 'CANCELLED': '❌ Đã hủy' };
                bot.sendMessage(zaloId, `🔔 Cập nhật đơn #${orderId.slice(-6).toUpperCase()}: ${statusMap[order.status] || order.status}`);
            }
        }
    });
});

/**
 * --- CẤU HÌNH WEBHOOK CHO RENDER ---
 */
app.post('/webhook', (req, res) => {
    if (req.headers['x-bot-api-secret-token'] !== process.env.WEBHOOK_SECRET_TOKEN) {
        return res.sendStatus(403);
    }
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

app.get('/', (req, res) => res.send("🚀 Bot PlantG is Running!"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server chạy tại cổng ${PORT}`);
    // Chỉ set Webhook khi có URL môi trường (Render sẽ cấp cái này)
    if (process.env.WEBHOOK_URL) {
        bot.setWebHook(process.env.WEBHOOK_URL, {
            secret_token: process.env.WEBHOOK_SECRET_TOKEN
        }).then(() => console.log("🔗 Webhook đã được đăng ký."));
    }
});