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
    console.log("✅ Firebase Admin SDK đã sẵn sàng.");
} catch (error) { 
    console.error("❌ Lỗi khởi tạo Firebase:", error.message);
    process.exit(1); 
}
const db = admin.firestore();

// 2. CẤU HÌNH THỰC ĐƠN & TỪ KHÓA
const MENU = {
    PRIMARY: { 
        keywords: ['sườn trứng', 'suon trung', 'đầy đủ', '30k', '35k', 'phần cơm', 'p cơm', 'hộp cơm', 'cơm tấm', 'phần', 'hộp', 'suất', 'cơm', '1p', '2p', '3p', '4p', '5p'], 
        name: 'Cơm tấm sườn trứng', 
        price: 35000 
    },
    SIDE_DISHES: [
        { keywords: ['cơm thêm', 'thêm cơm', 'cơm k sườn'], name: 'Cơm thêm', price: 5000 },
        { keywords: ['sườn thêm', 'miếng sườn', 'thêm sườn'], name: 'Sườn thêm', price: 10000 },
        { keywords: ['trứng thêm', 'thêm trứng', 'trứng', 'lòng đào'], name: 'Trứng thêm', price: 5000 },
        { keywords: ['canh thêm'], name: 'Canh thêm', price: 0 },
        { keywords: ['nước mắm thêm', 'nc mắm', 'bịch nước mắm', 'mắm'], name: 'Nước mắm thêm', price: 0 }
    ]
};

const CANCEL_KEYWORDS = ['hủy', 'huy', 'hủy đơn', 'huy don', 'không đặt nữa'];
const SUPPORT_KEYWORDS = ['hỗ trợ', 'ho tro', 'cần hỗ trợ', 'nhân viên', 'tư vấn', 'shop ơi', 'ad ơi', 'chủ quán'];
const GREETING_KEYWORDS = ['hi', 'hello', 'xin chào', 'chào', 'bắt đầu', 'alo shop', 'alo sốp'];

const app = express();
app.use(express.json());
const bot = new ZaloBot(process.env.BOT_TOKEN, { polling: false });
const ADMIN_ZALO_ID = process.env.ZALO_BOT_ADMIN_ID; // a65dc2194697d372478

/**
 * --- HÀM PHÂN TÍCH ĐƠN HÀNG ---
 */
const advancedParse = (text) => {
    let items = [];
    let total = 0;
    const lowerText = text.toLowerCase();

    // 1. Nhận diện món chính
    const primaryQtyMatch = lowerText.match(/(\d+)\s*(p|phần|hộp|cơm|suất)/);
    let primaryQty = primaryQtyMatch ? parseInt(primaryQtyMatch[1]) : 0;

    if (primaryQty === 0 && (lowerText.includes('phần') || lowerText.includes('hộp') || lowerText.includes('cơm'))) {
        primaryQty = 1;
    }

    if (primaryQty > 0) {
        let itemName = MENU.PRIMARY.name;
        if (lowerText.includes('cơm sườn') && !lowerText.includes('trứng')) {
            itemName = 'Cơm tấm sườn';
        }
        items.push(`${primaryQty}x ${itemName}`);
        total += MENU.PRIMARY.price * primaryQty;
    }

    // 2. Nhận diện món thêm
    MENU.SIDE_DISHES.forEach(side => {
        if (side.keywords.some(k => lowerText.includes(k))) {
            const qtyMatch = lowerText.match(new RegExp(`(\\d+)\\s*(${side.keywords.join('|')})`));
            const qty = qtyMatch ? parseInt(qtyMatch[1]) : 1;
            items.push(`${qty}x ${side.name}`);
            total += side.price * qty;
        }
    });

    return { 
        items: items.join(', '), 
        total, 
        note: text // QUAN TRỌNG: Ghi chú lưu TOÀN BỘ tin nhắn gốc
    };
};

/**
 * --- ĐỊNH DẠNG TIN NHẮN XÁC NHẬN ---
 */
const formatConfirmMsg = (order) => {
    return `📝 XÁC NHẬN ĐƠN HÀNG\n` +
           `--------------------------\n` +
           `👤 Khách hàng: ${order.customer}\n` +
           `📍 Địa chỉ: ${order.address}\n` +
           `📞 SĐT nhận hàng: ${order.phone}\n` +
           `🍱 Đơn hàng: ${order.items}\n` +
           `📝 Ghi chú: ${order.note}\n` +
           `💰 Tổng cộng: ${order.total.toLocaleString()}đ\n` +
           `--------------------------\n` +
           `👉 Nhắn "Ok" để chốt đơn.`;
};

/**
 * --- XỬ LÝ TIN NHẮN CHÍNH ---
 */
bot.on('message', async (msg) => {
    const zaloId = msg.chat.id;
    const text = msg.text?.trim();
    const name = msg.from?.display_name || "bạn";

    if (!text || text.startsWith('/')) return;

    // A. XỬ LÝ ADMIN REPLY (Chat ngược lại với khách)
    if (zaloId === ADMIN_ZALO_ID && msg.quote) {
        const quotedMsg = msg.quote.text;
        // Trích xuất ZaloID của khách từ tin nhắn báo đơn mà bot đã gửi cho Admin trước đó
        const targetIdMatch = quotedMsg.match(/🆔:\s*(\S+)/);
        
        if (targetIdMatch) {
            const targetZaloId = targetIdMatch[1];
            
            // Gửi tin nhắn cho khách
            await bot.sendMessage(targetZaloId, `💬 Phản hồi từ Shop: ${text}`);

            // Đồng bộ lên Firebase Support Chats để hiện trên web admin
            await db.collection('support_chats').add({
                zaloId: targetZaloId,
                sender: 'ADMIN',
                message: text,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`✅ Admin đã phản hồi cho khách ${targetZaloId}`);
            return;
        }
    }

    try {
        // Lưu log mọi tin nhắn để học tập
        await db.collection('learning_logs').add({
            zaloId, text, name, timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        const sessionRef = db.collection('bot_sessions').doc(zaloId);
        const sessionSnap = await sessionRef.get();
        let session = sessionSnap.exists ? sessionSnap.data() : { state: null, pendingOrder: null };

        // B. CHUYỂN CUỘC HỘI THOẠI ĐẾN SHOP
        if (SUPPORT_KEYWORDS.some(k => text.toLowerCase().includes(k))) {
            await sessionRef.delete();
            bot.sendMessage(zaloId, "🤖 Tôi không hiểu ý của bạn, tôi sẽ chuyển cuộc hội thoại đến Shop. Vui lòng chờ trong giây lát!");
            if (ADMIN_ZALO_ID) bot.sendMessage(ADMIN_ZALO_ID, `⚠️ CẦN HỖ TRỢ TRỰC TIẾP\n👤: ${name}\n🆔: ${zaloId}\n💬: ${text}`);
            return;
        }

        // C. XỬ LÝ HỦY ĐƠN
        if (CANCEL_KEYWORDS.some(k => text.toLowerCase().includes(k))) {
            await sessionRef.delete();
            const orderQuery = await db.collection('orders').where("zaloId", "==", zaloId).orderBy("createdAt", "desc").limit(1).get();
            if (!orderQuery.empty) {
                const lastOrder = orderQuery.docs[0];
                const s = lastOrder.data().status;
                if (!['PREPARING', 'SHIPPING', 'COMPLETED'].includes(s)) {
                    await lastOrder.ref.update({ status: 'CANCELLED' });
                    return bot.sendMessage(zaloId, "✅ Đã hủy đơn hàng gần nhất của bạn.");
                }
            }
            return bot.sendMessage(zaloId, "✅ Đã xóa trạng thái đặt hàng hiện tại.");
        }

        // D. NHẬN DIỆN ĐƠN HÀNG
        const detected = advancedParse(text);
        if (detected.items) {
            session.pendingOrder = { customer: name, items: detected.items, total: detected.total, note: detected.note, zaloId };
            
            const userQuery = await db.collection('users').where("zaloId", "==", zaloId).limit(1).get();
            if (!userQuery.empty) {
                const userData = userQuery.docs[0].data();
                session.pendingOrder.phone = userQuery.docs[0].id;
                session.pendingOrder.address = userData.address;
                session.state = 'WAITING_CONFIRM';
                await sessionRef.set(session);
                return bot.sendMessage(zaloId, formatConfirmMsg(session.pendingOrder));
            } else {
                session.state = 'WAITING_PHONE';
                await sessionRef.set(session);
                return bot.sendMessage(zaloId, `🤖 Nhận đơn: ${detected.items}. Cho quán xin SĐT nhận hàng nhé!`);
            }
        }

        // E. XỬ LÝ THEO TRẠNG THÁI (NHẬP SĐT/ĐỊA CHỈ)
        if (session.state === 'WAITING_PHONE') {
            const phone = text.replace(/\D/g, '');
            if (phone.length < 10) return bot.sendMessage(zaloId, "⚠️ SĐT không hợp lệ.");
            session.pendingOrder.phone = phone;
            const userSnap = await db.collection('users').doc(phone).get();
            if (userSnap.exists) {
                session.pendingOrder.address = userSnap.data().address;
                session.state = 'WAITING_CONFIRM';
                await sessionRef.set(session);
                return bot.sendMessage(zaloId, formatConfirmMsg(session.pendingOrder));
            }
            session.state = 'WAITING_ADDRESS';
            await sessionRef.set(session);
            return bot.sendMessage(zaloId, "Dạ cho quán xin địa chỉ giao hàng với ạ.");
        }

        if (session.state === 'WAITING_ADDRESS') {
            session.pendingOrder.address = text;
            session.state = 'WAITING_CONFIRM';
            await db.collection('users').doc(session.pendingOrder.phone).set({
                fullName: name, address: text, zaloId, username: session.pendingOrder.phone
            }, { merge: true });
            await sessionRef.set(session);
            return bot.sendMessage(zaloId, formatConfirmMsg(session.pendingOrder));
        }

        // F. XÁC NHẬN "OK"
        if (text.toLowerCase() === 'ok' && session.state === 'WAITING_CONFIRM') {
            const order = session.pendingOrder;
            const docRef = await db.collection('orders').add({
                ...order, status: 'PENDING', total: order.total.toLocaleString() + 'đ', createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            await sessionRef.delete();
            
            const finalMsg = `✅ ĐÃ CHỐT ĐƠN (#${docRef.id.slice(-6).toUpperCase()})\n` +
                             `🍱 Món: ${order.items}\n` +
                             `📍 Giao: ${order.address}\n` +
                             `🔔 Trạng thái: 🕒 Chờ xác nhận (Shop sẽ báo bạn ngay khi chuẩn bị xong)`;
            bot.sendMessage(zaloId, finalMsg);

            if (ADMIN_ZALO_ID) {
                bot.sendMessage(ADMIN_ZALO_ID, `🔔 ĐƠN MỚI\n🆔: ${zaloId}\n👤 Khách: ${order.customer}\n🍱 Đơn: ${order.items}\n📝 Note: ${order.note}`);
            }
            return;
        }

        // CHÀO HỎI
        if (GREETING_KEYWORDS.some(k => text.toLowerCase().includes(k))) {
            await sessionRef.delete();
            return bot.sendMessage(zaloId, `Xin chào ${name}. Cảm ơn bạn đã liên hệ Shop PlantG. Bạn muốn đặt món hay hỗ trợ gì ạ?`);
        }

    } catch (error) {
        console.error("❌ Lỗi xử lý tin nhắn:", error);
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
            bot.sendMessage(order.zaloId, `🔔 Đơn #${change.doc.id.slice(-6).toUpperCase()} chuyển sang: [${statusMap[order.status] || order.status}]`);
        }
    });
});

app.post('/webhook', (req, res) => {
    if (req.headers['x-bot-api-secret-token'] !== process.env.WEBHOOK_SECRET_TOKEN) return res.sendStatus(403);
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

app.listen(process.env.PORT || 10000, () => {
    if (process.env.WEBHOOK_URL) bot.setWebHook(process.env.WEBHOOK_URL, { secret_token: process.env.WEBHOOK_SECRET_TOKEN });
});