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

// 2. CẤU HÌNH THỰC ĐƠN
const MENU = {
    PRIMARY: { keywords: ['sườn trứng', 'suon trung', 'đầy đủ', '30k', '35k', 'phần cơm', 'p cơm', 'hộp cơm', 'cơm tấm', 'phần', 'hộp', 'suất', '1p', '2p', '3p', '4p', '5p'], name: 'Cơm tấm sườn trứng', price: 35000 },
    SIDE_DISHES: [
        { keywords: ['cơm thêm', 'thêm cơm', 'cơm k sườn'], name: 'Cơm thêm', price: 5000 },
        { keywords: ['sườn thêm', 'miếng sườn', 'thêm sườn'], name: 'Sườn thêm', price: 10000 },
        { keywords: ['trứng thêm', 'thêm trứng', '2 trứng', 'lòng đào'], name: 'Trứng thêm', price: 5000 },
        { keywords: ['canh thêm'], name: 'Canh thêm', price: 0 },
        { keywords: ['nước mắm thêm', 'nc mắm', 'bịch nước mắm'], name: 'Nước mắm thêm', price: 0 }
    ]
};

const CANCEL_KEYWORDS = ['hủy', 'huy', 'hủy đơn', 'huy don', 'không đặt nữa'];
const GREETING_KEYWORDS = ['hi', 'hello', 'xin chào', 'chào', 'bắt đầu', 'alo', 'ê'];

const app = express();
app.use(express.json());
const bot = new ZaloBot(process.env.BOT_TOKEN, { polling: false });
const ADMIN_ZALO_ID = process.env.ZALO_BOT_ADMIN_ID;

/**
 * --- HÀM NHẬN DIỆN THÔNG MINH (ADVANCED PARSER) ---
 */
const advancedParse = (text) => {
    let items = [];
    let total = 0;
    const lowerText = text.toLowerCase();

    const primaryQtyMatch = lowerText.match(/(\d+)\s*(p|phần|hộp|cơm|suất)/);
    let primaryQty = primaryQtyMatch ? parseInt(primaryQtyMatch[1]) : 0;

    const defaultKeywords = ['phần cơm', 'hộp cơm', 'đặt cơm', 'phần', 'hộp', 'suất', '1p'];
    if (primaryQty === 0 && defaultKeywords.some(k => lowerText.includes(k))) {
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

    MENU.SIDE_DISHES.forEach(side => {
        if (side.keywords.some(k => lowerText.includes(k))) {
            const qtyMatch = lowerText.match(new RegExp(`(\\d+)\\s*(${side.keywords.join('|')})`));
            const qty = qtyMatch ? parseInt(qtyMatch[1]) : 1;
            items.push(`${qty}x ${side.name}`);
            total += side.price * qty;
        }
    });

    const phoneMatch = lowerText.match(/(0[3|5|7|8|9][0-9]{8})/);
    const addressMatch = lowerText.match(/(đ\/c|địa chỉ|tới|đến|ở)\s+([^,.\n]+)/);

    return { 
        items: items.join(', '), 
        total, 
        note: text, 
        detectedPhone: phoneMatch ? phoneMatch[1] : null,
        detectedAddress: addressMatch ? addressMatch[2]?.trim() : null
    };
};

/**
 * --- XỬ LÝ TIN NHẮN CHÍNH ---
 */
bot.on('message', async (msg) => {
    const zaloId = msg.chat.id;
    const text = msg.text?.trim();
    const name = msg.from?.display_name || "bạn";

    if (!text || text.startsWith('/')) return;

    console.log(`📩 Nhận tin nhắn từ [${name}]: ${text}`);

    try {
        // 1. LƯU LOG ĐỂ HỌC TẬP
        await db.collection('learning_logs').add({
            zaloId, text, name, timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        // 2. LẤY SESSION TỪ FIRESTORE
        const sessionRef = db.collection('bot_sessions').doc(zaloId);
        const sessionSnap = await sessionRef.get();
        let session = sessionSnap.exists ? sessionSnap.data() : { state: null, pendingOrder: null };

        // A. XỬ LÝ LỆNH HỦY
        if (CANCEL_KEYWORDS.some(k => text.toLowerCase().includes(k))) {
            console.log("👉 Nhánh: Hủy đơn");
            await sessionRef.delete();
            const orderQuery = await db.collection('orders').where("zaloId", "==", zaloId).orderBy("createdAt", "desc").limit(1).get();
            if (!orderQuery.empty) {
                const lastOrder = orderQuery.docs[0];
                if (!['PREPARING', 'SHIPPING', 'COMPLETED'].includes(lastOrder.data().status)) {
                    await lastOrder.ref.update({ status: 'CANCELLED' });
                    return bot.sendMessage(zaloId, "✅ Đã hủy đơn hàng gần nhất của bạn.");
                }
            }
            return bot.sendMessage(zaloId, "✅ Đã xóa trạng thái đặt hàng hiện tại.");
        }

        // B. NHẬN DIỆN ĐƠN HÀNG MỚI
        const detected = advancedParse(text);
        if (detected.items) {
            console.log("👉 Nhánh: Nhận diện món ăn");
            session.pendingOrder = { customer: name, items: detected.items, total: detected.total, note: detected.note, zaloId };
            
            if (detected.detectedPhone) session.pendingOrder.phone = detected.detectedPhone;
            if (detected.detectedAddress) session.pendingOrder.address = detected.detectedAddress;

            const userQuery = await db.collection('users').where("zaloId", "==", zaloId).limit(1).get();
            if (!userQuery.empty) {
                const userData = userQuery.docs[0].data();
                session.pendingOrder.phone = session.pendingOrder.phone || userQuery.docs[0].id;
                session.pendingOrder.address = session.pendingOrder.address || userData.address;
            }

            if (session.pendingOrder.phone && session.pendingOrder.address) {
                session.state = 'WAITING_CONFIRM';
                await sessionRef.set(session);
                return bot.sendMessage(zaloId, `🤖 Nhận đơn: ${session.pendingOrder.items}\n📍 Giao: ${session.pendingOrder.address}\n\nNhắn "Ok" để chốt đơn nhé!`);
            } else if (!session.pendingOrder.phone) {
                session.state = 'WAITING_PHONE';
                await sessionRef.set(session);
                return bot.sendMessage(zaloId, `🤖 Shop nhận đơn: ${session.pendingOrder.items}. Cho quán xin SĐT nhận hàng nhé!`);
            } else {
                session.state = 'WAITING_ADDRESS';
                await sessionRef.set(session);
                return bot.sendMessage(zaloId, `🤖 Cho quán xin địa chỉ giao hàng cụ thể nhé.`);
            }
        }

        // C. XỬ LÝ THEO TRẠNG THÁI
        if (session.state === 'WAITING_PHONE') {
            console.log("👉 Nhánh: Đang đợi SĐT");
            const phone = text.replace(/\D/g, '');
            if (phone.length < 10) return bot.sendMessage(zaloId, "⚠️ SĐT không hợp lệ.");
            session.pendingOrder.phone = phone;
            const userSnap = await db.collection('users').doc(phone).get();
            if (userSnap.exists) {
                session.pendingOrder.address = userSnap.data().address;
                session.state = 'WAITING_CONFIRM';
                await sessionRef.set(session);
                return bot.sendMessage(zaloId, `Nhận ra khách quen! Giao tới: ${userSnap.data().address} đúng không ạ? Nhắn "Ok" để chốt.`);
            }
            session.state = 'WAITING_ADDRESS';
            await sessionRef.set(session);
            return bot.sendMessage(zaloId, "Dạ cho quán xin địa chỉ giao hàng với ạ.");
        }

        if (session.state === 'WAITING_ADDRESS') {
            console.log("👉 Nhánh: Đang đợi Địa chỉ");
            session.pendingOrder.address = text;
            session.state = 'WAITING_CONFIRM';
            await db.collection('users').doc(session.pendingOrder.phone).set({
                fullName: name, address: text, zaloId, username: session.pendingOrder.phone
            }, { merge: true });
            await sessionRef.set(session);
            return bot.sendMessage(zaloId, `Đã ghi nhận địa chỉ! Nhắn "Ok" để chốt đơn: ${session.pendingOrder.items}`);
        }

        if (text.toLowerCase() === 'ok' && session.state === 'WAITING_CONFIRM') {
            console.log("👉 Nhánh: Xác nhận OK");
            const order = session.pendingOrder;
            const docRef = await db.collection('orders').add({
                ...order, status: 'PENDING', total: order.total.toLocaleString() + 'đ', createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            await sessionRef.delete();
            bot.sendMessage(zaloId, `✅ Xong! Đơn #${docRef.id.slice(-6).toUpperCase()} đang được làm.`);
            if (ADMIN_ZALO_ID) bot.sendMessage(ADMIN_ZALO_ID, `🔔 ĐƠN MỚI: ${order.items}\n📞 SĐT: ${order.phone}`);
            return;
        }

        // D. XỬ LÝ CHÀO HỎI (QUAN TRỌNG: ĐÃ THÊM LẠI)
        if (GREETING_KEYWORDS.some(k => text.toLowerCase().includes(k))) {
            console.log("👉 Nhánh: Chào hỏi");
            await sessionRef.delete(); // Reset session khi chào lại
            return bot.sendMessage(zaloId, `Xin chào ${name}. Cảm ơn bạn đã liên hệ với Shop PlantG. Bạn cần đặt món hay hỗ trợ gì ạ?`);
        }

        // E. FALLBACK (NẾU KHÔNG HIỂU GÌ)
        console.log("👉 Nhánh: Không hiểu (Fallback)");
        return bot.sendMessage(zaloId, `🤖 Xin lỗi ${name}, Shop chưa hiểu ý bạn. Bạn muốn đặt cơm hay cần hỗ trợ gì ạ? (Gợi ý: Nhắn "Cho 1 phần cơm" để đặt hàng nhanh nhé)`);

    } catch (error) {
        console.error("❌ Lỗi xử lý tin nhắn:", error);
    }
});

/**
 * --- THÔNG BÁO TRẠNG THÁI & SERVER ---
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

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 Server đang lắng nghe tại cổng ${PORT}`);
    if (process.env.WEBHOOK_URL) {
        bot.setWebHook(process.env.WEBHOOK_URL, { secret_token: process.env.WEBHOOK_SECRET_TOKEN })
            .then(() => console.log("🔗 Webhook đã được đăng ký thành công với Zalo."))
            .catch(err => console.error("❌ Lỗi đăng ký Webhook:", err.message));
    }
});