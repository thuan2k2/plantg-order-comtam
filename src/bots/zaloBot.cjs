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
    if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} catch (error) { process.exit(1); }
const db = admin.firestore();

// 2. CẤU HÌNH THỰC ĐƠN & TRẠNG THÁI
const MENU = [
    { keywords: ['sườn trứng', 'suon trung'], name: 'Cơm tấm sườn trứng', price: 35000 },
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

const CANCEL_KEYWORDS = ['hủy', 'huy', 'hủy đơn', 'huy don', 'không đặt nữa'];

const userStates = {}; 
const pendingOrders = {};

const app = express();
app.use(express.json());
const bot = new ZaloBot(process.env.BOT_TOKEN, { polling: false });
const ADMIN_ZALO_ID = process.env.ZALO_BOT_ADMIN_ID;

// Hàm bóc tách đơn hàng
const parseOrderWithNotes = (text) => {
    let items = [];
    let total = 0;
    let unrecognizedParts = [];
    const lines = text.toLowerCase().split(/[,|\n]/);

    lines.forEach(line => {
        let matched = false;
        const cleanLine = line.trim();
        if (!cleanLine) return;
        MENU.forEach(m => {
            if (m.keywords.some(k => cleanLine.includes(k))) {
                const qtyMatch = cleanLine.match(/\d+/);
                const qty = qtyMatch ? parseInt(qtyMatch[0]) : 1;
                items.push(`${qty}x ${m.name}`);
                total += m.price * qty;
                matched = true;
            }
        });
        if (!matched) unrecognizedParts.push(cleanLine);
    });
    return { items: items.join(', '), total, note: unrecognizedParts.join(', ') };
};

/**
 * --- XỬ LÝ TIN NHẮN TỰ ĐỘNG ---
 */
bot.on('message', async (msg) => {
    const zaloId = msg.chat.id;
    const text = msg.text?.trim();
    const name = msg.from?.display_name || "bạn";

    if (!text || text.startsWith('/')) return;

    // A. XỬ LÝ LỆNH HỦY (ƯU TIÊN CAO NHẤT)
    if (CANCEL_KEYWORDS.some(k => text.toLowerCase() === k)) {
        // 1. Xóa đơn nháp đang dở nếu khách đang trong luồng đặt
        if (pendingOrders[zaloId]) {
            delete pendingOrders[zaloId];
            userStates[zaloId] = null;
            return bot.sendMessage(zaloId, `✅ Đã hủy quá trình đặt đơn hiện tại. Bạn cần món gì cứ nhắn quán nhé!`);
        }

        // 2. Tìm đơn hàng mới nhất của Zalo ID này để hủy
        const orderQuery = await db.collection('orders')
            .where("zaloId", "==", zaloId)
            .orderBy("createdAt", "desc").limit(1).get();

        if (!orderQuery.empty) {
            const lastOrder = orderQuery.docs[0];
            const status = lastOrder.data().status;

            // Không được hủy nếu trạng thái là Bếp đang làm, Đang giao hoặc Đã xong
            const blockCancel = ['PREPARING', 'SHIPPING', 'COMPLETED'];
            if (blockCancel.includes(status)) {
                const statusMap = { 'PREPARING': 'Bếp đang làm', 'SHIPPING': 'Đang giao hàng', 'COMPLETED': 'Đã hoàn thành' };
                return bot.sendMessage(zaloId, `❌ Rất tiếc, đơn #${lastOrder.id.slice(-6).toUpperCase()} đang ở trạng thái "${statusMap[status]}" nên không thể hủy được ạ!`);
            }
            
            await lastOrder.ref.update({ status: 'CANCELLED' });
            return bot.sendMessage(zaloId, `✅ Đã hủy đơn hàng #${lastOrder.id.slice(-6).toUpperCase()} thành công theo yêu cầu của ${name}.`);
        }
        return bot.sendMessage(zaloId, `Dạ hiện bạn không có đơn hàng nào chờ xử lý để hủy ạ.`);
    }

    // B. NHẬN DIỆN MÓN ĂN (ƯU TIÊN NHẬN DIỆN MỚI)
    // Nếu tin nhắn chứa món ăn, ta ưu tiên nhận diện đơn mới và ghi đè trạng thái cũ
    const detected = parseOrderWithNotes(text);
    if (detected.items) {
        pendingOrders[zaloId] = { customer: name, items: detected.items, total: detected.total, note: detected.note, zaloId };

        const userQuery = await db.collection('users').where("zaloId", "==", zaloId).limit(1).get();
        if (!userQuery.empty) {
            const userData = userQuery.docs[0].data();
            pendingOrders[zaloId].phone = userQuery.docs[0].id;
            pendingOrders[zaloId].address = userData.address;
            userStates[zaloId] = 'WAITING_CONFIRM';
            return bot.sendMessage(zaloId, `Dạ, đơn hàng mới của mình là: ${pendingOrders[zaloId].items}.\n🏠 Giao đến: ${userData.address}.\n\nNhắn "Ok" để Xác nhận đơn hàng.`);
        } else {
            userStates[zaloId] = 'WAITING_PHONE';
            return bot.sendMessage(zaloId, `Dạ, mình nhận đơn món: ${pendingOrders[zaloId].items}.\nBạn cho quán xin SĐT nhận hàng nhé!`);
        }
    }

    // C. XỬ LÝ CHÀO HỎI
    if (['hi', 'hello', 'xin chào', 'chào', 'bắt đầu'].includes(text.toLowerCase())) {
        userStates[zaloId] = null; 
        return bot.sendMessage(zaloId, `Xin chào ${name}. Cảm ơn bạn đã liên hệ với Shop PlantG. Bạn cần đặt món hay hỗ trợ gì ạ?`);
    }

    // D. TIẾP TỤC CÁC TRẠNG THÁI KHÁC (Nếu không phải món mới)
    if (userStates[zaloId] === 'WAITING_PHONE') {
        const phone = text.replace(/\D/g, '');
        if (phone.length < 10) return bot.sendMessage(zaloId, "⚠️ Số điện thoại không hợp lệ, vui lòng nhập lại.");
        pendingOrders[zaloId].phone = phone;
        const userSnap = await db.collection('users').doc(phone).get();
        if (userSnap.exists) {
            const userData = userSnap.data();
            await db.collection('users').doc(phone).update({ zaloId });
            pendingOrders[zaloId].address = userData.address;
            userStates[zaloId] = 'WAITING_CONFIRM';
            return bot.sendMessage(zaloId, `Hệ thống nhận ra khách quen!\n📍 Địa chỉ: ${userData.address}.\n\nNhắn "Ok" để chốt đơn.`);
        } else {
            userStates[zaloId] = 'WAITING_ADDRESS';
            return bot.sendMessage(zaloId, `Dạ, quán chưa có thông tin của mình. Cho mình xin địa chỉ giao hàng cụ thể nhé.`);
        }
    }

    if (userStates[zaloId] === 'WAITING_ADDRESS') {
        pendingOrders[zaloId].address = text;
        await db.collection('users').doc(pendingOrders[zaloId].phone).set({
            fullName: name, address: text, zaloId: zaloId, username: pendingOrders[zaloId].phone, createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        userStates[zaloId] = 'WAITING_CONFIRM';
        return bot.sendMessage(zaloId, `Đã lưu! Đơn: ${pendingOrders[zaloId].items}.\n🏠 Giao đến: ${text}.\n\nNhắn "Ok" để chốt đơn.`);
    }

    if (text.toLowerCase() === 'ok' && userStates[zaloId] === 'WAITING_CONFIRM') {
        const order = pendingOrders[zaloId];
        const docRef = await db.collection('orders').add({
            ...order, status: 'PENDING', total: order.total.toLocaleString() + 'đ', createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        bot.sendMessage(zaloId, `✅ Đã chốt đơn #${docRef.id.slice(-6).toUpperCase()}!`);
        if (ADMIN_ZALO_ID) bot.sendMessage(ADMIN_ZALO_ID, `🔔 ĐƠN MỚI!\nKhách: ${order.customer}\nSĐT: ${order.phone}\nMón: ${order.items}`);
        userStates[zaloId] = null; delete pendingOrders[zaloId];
        return;
    }
});

/**
 * --- THÔNG BÁO TRẠNG THÁI ---
 */
db.collection('orders').onSnapshot((snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
        const order = change.doc.data();
        if (change.type === "modified" && order.zaloId) {
            const statusMap = { 'PREPARING': '👨‍🍳 Đang chuẩn bị', 'SHIPPING': '🚚 Đang giao', 'COMPLETED': '✅ Đã xong', 'CANCELLED': '❌ Đã hủy' };
            bot.sendMessage(order.zaloId, `🔔 CẬP NHẬT: Đơn #${change.doc.id.slice(-6).toUpperCase()} đã chuyển sang [${statusMap[order.status] || order.status}]`);
        }
    });
});

app.post('/webhook', (req, res) => {
    if (req.headers['x-bot-api-secret-token'] !== process.env.WEBHOOK_SECRET_TOKEN) return res.sendStatus(403);
    bot.processUpdate(req.body);
    res.sendStatus(200);
});
app.listen(process.env.PORT || 3000, () => {
    if (process.env.WEBHOOK_URL) bot.setWebHook(process.env.WEBHOOK_URL, { secret_token: process.env.WEBHOOK_SECRET_TOKEN });
});