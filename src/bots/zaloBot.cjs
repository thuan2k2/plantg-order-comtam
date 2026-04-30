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

// 2. CẤU HÌNH THỰC ĐƠN (Cập nhật từ ảnh) & TRẠNG THÁI
const MENU = [
    { keywords: ['sườn trứng', 'suon trung', 'sườn trứng'], name: 'Cơm tấm sườn trứng', price: 35000 },
    { keywords: ['cơm tấm sườn', 'com tam suon', 'cơm sườn'], name: 'Cơm tấm sườn', price: 35000 },
    { keywords: ['canh thêm', 'canh them'], name: 'Canh thêm', price: 0 },
    { keywords: ['cà chua thêm', 'ca chua them'], name: 'Cà chua thêm', price: 0 },
    { keywords: ['cơm thêm', 'com them'], name: 'Cơm thêm', price: 5000 },
    { keywords: ['dưa chua thêm', 'dua chua them'], name: 'Dưa chua thêm', price: 0 },
    { keywords: ['dưa leo thêm', 'dua leo them'], name: 'Dưa leo thêm', price: 0 },
    { keywords: ['nước mắm thêm', 'nuoc mam them'], name: 'Nước mắm thêm', price: 0 },
    { keywords: ['sườn thêm', 'suon them'], name: 'Sườn thêm', price: 10000 },
    { keywords: ['trứng thêm', 'trung them'], name: 'Trứng thêm', price: 5000 }
];

const userStates = {}; 
const pendingOrders = {};

const app = express();
app.use(express.json());
const bot = new ZaloBot(process.env.BOT_TOKEN, { polling: false });
const ADMIN_ZALO_ID = process.env.ZALO_BOT_ADMIN_ID;

// Hàm bóc tách đơn hàng
const parseOrder = (text) => {
    let items = [];
    let total = 0;
    const lines = text.toLowerCase().split(/[,|\n]/);
    lines.forEach(line => {
        MENU.forEach(m => {
            if (m.keywords.some(k => line.includes(k))) {
                const qtyMatch = line.match(/\d+/);
                const qty = qtyMatch ? parseInt(qtyMatch[0]) : 1;
                items.push(`${qty}x ${m.name}`);
                total += m.price * qty;
            }
        });
    });
    return items.length > 0 ? { items: items.join(', '), total } : null;
};

/**
 * --- XỬ LÝ TIN NHẮN TỰ ĐỘNG ---
 */
bot.on('message', async (msg) => {
    const zaloId = msg.chat.id;
    const text = msg.text?.trim();
    const name = msg.from?.display_name || "bạn";

    if (!text || text.startsWith('/')) return;

    // 1. XỬ LÝ CHÀO HỎI
    const greetings = ['hi', 'hello', 'xin chào', 'chào', 'bắt đầu'];
    if (greetings.includes(text.toLowerCase())) {
        userStates[zaloId] = null; 
        return bot.sendMessage(zaloId, `Xin chào ${name}. Cảm ơn bạn đã liên hệ với Shop PlantG. Bạn cần đặt món hay hỗ trợ gì ạ?`);
    }

    // 2. TRẠNG THÁI: ĐỢI SĐT
    if (userStates[zaloId] === 'WAITING_PHONE') {
        const phone = text.replace(/\D/g, '');
        if (phone.length < 10) return bot.sendMessage(zaloId, "⚠️ Số điện thoại không hợp lệ. Vui lòng nhập lại nhé!");

        const userSnap = await db.collection('users').doc(phone).get();
        pendingOrders[zaloId].phone = phone;

        if (userSnap.exists) {
            const userData = userSnap.data();
            await db.collection('users').doc(phone).update({ zaloId }); 
            pendingOrders[zaloId].address = userData.address;
            userStates[zaloId] = 'WAITING_CONFIRM';
            return bot.sendMessage(zaloId, `Dạ, hệ thống đã nhận ra ${name}! Đơn hàng của mình là: ${pendingOrders[zaloId].items}.\nGiao đến địa chỉ cũ: ${userData.address}.\n\nNhắn "Ok" để Xác nhận đơn hàng.`);
        } else {
            userStates[zaloId] = 'WAITING_ADDRESS';
            return bot.sendMessage(zaloId, `Dạ, chào mừng khách mới ạ! Cho mình xin địa chỉ giao hàng cụ thể nhé.`);
        }
    }

    // 3. TRẠNG THÁI: ĐỢI ĐỊA CHỈ
    if (userStates[zaloId] === 'WAITING_ADDRESS') {
        pendingOrders[zaloId].address = text;
        await db.collection('users').doc(pendingOrders[zaloId].phone).set({
            fullName: name, address: text, zaloId: zaloId, createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        userStates[zaloId] = 'WAITING_CONFIRM';
        return bot.sendMessage(zaloId, `Đã lưu thông tin! Đơn hàng của mình là: ${pendingOrders[zaloId].items}.\nTổng: ${pendingOrders[zaloId].total.toLocaleString()}đ.\n\nNhắn "Ok" để Xác nhận đơn hàng.`);
    }

    // 4. TRẠNG THÁI: XÁC NHẬN OK
    if (text.toLowerCase() === 'ok' && userStates[zaloId] === 'WAITING_CONFIRM') {
        const order = pendingOrders[zaloId];
        const docRef = await db.collection('orders').add({
            ...order, status: 'PENDING', total: order.total.toLocaleString() + 'đ', createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        bot.sendMessage(zaloId, `✅ Đã chốt! Đơn #${docRef.id.slice(-6).toUpperCase()} đang được quán chuẩn bị. Cảm ơn ${name}!`);
        if (ADMIN_ZALO_ID) bot.sendMessage(ADMIN_ZALO_ID, `🔔 ĐƠN MỚI TỪ ZALO!\nKhách: ${order.customer}\nSĐT: ${order.phone}\nMón: ${order.items}`);
        userStates[zaloId] = null;
        delete pendingOrders[zaloId];
        return;
    }

    // 5. NHẬN DIỆN MÓN ĂN TỰ ĐỘNG
    const detected = parseOrder(text);
    if (detected) {
        pendingOrders[zaloId] = { customer: name, items: detected.items, total: detected.total, zaloId };
        const userQuery = await db.collection('users').where("zaloId", "==", zaloId).limit(1).get();
        if (!userQuery.empty) {
            const userData = userQuery.docs[0].data();
            pendingOrders[zaloId].phone = userQuery.docs[0].id;
            pendingOrders[zaloId].address = userData.address;
            userStates[zaloId] = 'WAITING_CONFIRM';
            return bot.sendMessage(zaloId, `Dạ, đơn hàng của mình là: ${pendingOrders[zaloId].items}.\nGiao đến: ${userData.address}.\n\nNhắn "Ok" để Xác nhận đơn hàng.`);
        } else {
            userStates[zaloId] = 'WAITING_PHONE';
            return bot.sendMessage(zaloId, `Dạ, mình thấy bạn muốn đặt: ${pendingOrders[zaloId].items}.\nBạn vui lòng cho mình xin SĐT để lên đơn nhé!`);
        }
    }
});

/**
 * --- TIỆN ÍCH & SERVER ---
 */
bot.onText(/\/id/, (msg) => bot.sendMessage(msg.chat.id, `🆔 ID của bạn: ${msg.chat.id}`));

app.post('/webhook', (req, res) => {
    if (req.headers['x-bot-api-secret-token'] !== process.env.WEBHOOK_SECRET_TOKEN) return res.sendStatus(403);
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

app.get('/', (req, res) => res.send("🚀 Bot PlantG is Running!"));
app.listen(process.env.PORT || 3000, () => {
    if (process.env.WEBHOOK_URL) bot.setWebHook(process.env.WEBHOOK_URL, { secret_token: process.env.WEBHOOK_SECRET_TOKEN });
});