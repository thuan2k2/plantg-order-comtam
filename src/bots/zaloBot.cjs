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
const serverStartTime = Date.now();

// 2. CẤU HÌNH THỰC ĐƠN
const MENU = {
    MAIN: [
        { keywords: ['sườn trứng', 'suon trung', 'đầy đủ', 'st'], name: 'Cơm tấm sườn trứng', price: 35000 },
        { keywords: ['cơm sườn', 'com suon', 'suon nướng', 's'], name: 'Cơm tấm sườn', price: 35000 }
    ],
    EXTRA: [
        { keywords: ['cơm thêm', 'thêm cơm'], name: 'Cơm thêm', price: 5000 },
        { keywords: ['sườn thêm', 'thêm sườn'], name: 'Sườn thêm', price: 10000 },
        { keywords: ['trứng thêm', 'thêm trứng'], name: 'Trứng thêm', price: 5000 },
        { keywords: ['canh thêm'], name: 'Canh thêm', price: 0 },
        { keywords: ['cà chua thêm'], name: 'Cà chua thêm', price: 0 },
        { keywords: ['dưa chua thêm'], name: 'Dưa chua thêm', price: 0 },
        { keywords: ['dưa leo thêm'], name: 'Dưa leo thêm', price: 0 },
        { keywords: ['nước mắm thêm'], name: 'Nước mắm thêm', price: 0 }
    ]
};

const RESET_KEYWORDS = ['reset', 'xóa hết', 'làm lại'];
const CHANGE_INFO_KEYWORDS = ['chỉnh sửa thông tin', 'thay đổi thông tin', 'đổi địa chỉ', 'đổi sđt', 'cập nhật thông tin'];
const SUPPORT_KEYWORDS = ['hỗ trợ', 'ho tro', 'cần hỗ trợ', 'nhân viên', 'tư vấn', 'shop ơi', 'ad ơi', 'sốp ơi'];
const MENU_KEYWORDS = ['menu', 'thực đơn', 'món ăn', 'xin menu', 'có món gì', 'xem menu'];
const GREETING_KEYWORDS = ['hello', 'hi', 'xin chào', 'chào', 'bắt đầu', 'alo', 'đặt cơm', 'dạ chào'];

const app = express();
app.use(express.json());
const bot = new ZaloBot(process.env.BOT_TOKEN, { polling: false });
const ADMIN_ZALO_ID = String(process.env.ZALO_BOT_ADMIN_ID || 'a65dc2194697d372478').trim();

/**
 * --- HÀM TRỢ GIÚP ---
 */
const getPhoneByZaloId = async (zaloId) => {
    const userQuery = await db.collection('users').where("zaloId", "==", zaloId).limit(1).get();
    if (!userQuery.empty) return userQuery.docs[0].id;
    return null;
};

const advancedParse = (text) => {
    let items = [];
    let total = 0;
    const lowerText = text.toLowerCase();
    const qtyMatch = lowerText.match(/(\d+)\s*(p|phần|hộp|cơm|suất)/);
    let qty = qtyMatch ? parseInt(qtyMatch[1]) : 0;
    if (qty === 0 && (lowerText.includes('phần') || lowerText.includes('hộp') || lowerText.includes('cơm'))) qty = 1;

    if (qty > 0) {
        const isEgg = lowerText.includes('trứng') || lowerText.includes('đầy đủ') || lowerText.includes('st');
        const dish = isEgg ? MENU.MAIN[0] : MENU.MAIN[1];
        items.push(`${qty}x ${dish.name}`);
        total += dish.price * qty;
    }

    MENU.EXTRA.forEach(extra => {
        if (extra.keywords.some(k => lowerText.includes(k))) {
            const extraQtyMatch = lowerText.match(new RegExp(`(\\d+)\\s*(${extra.keywords.join('|')})`));
            const eQty = extraQtyMatch ? parseInt(extraQtyMatch[1]) : 1;
            items.push(`${eQty}x ${extra.name}`);
            total += extra.price * eQty;
        }
    });
    return { items: items.join(', '), total, note: text };
};

/**
 * --- XỬ LÝ TIN NHẮN CHÍNH ---
 */
bot.on('message', async (msg) => {
    const zaloId = String(msg.chat.id);
    const text = msg.text?.trim() || "";
    const name = msg.from?.display_name || "Khách hàng";
    const lowerText = text.toLowerCase();

    if (!text || text.startsWith('/') || zaloId === ADMIN_ZALO_ID) return;

    try {
        const userPhone = await getPhoneByZaloId(zaloId);
        const chatIdentifier = userPhone || zaloId;

        // 1. ĐỒNG BỘ TIN NHẮN LÊN WEB ADMIN
        await db.collection('support_chats').doc(chatIdentifier).set({
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
            unreadAdmin: true, unreadUser: false, userName: name, userPhone: userPhone || ""
        }, { merge: true });

        await db.collection('support_chats').doc(chatIdentifier).collection('messages').add({
            sender: 'USER', message: text, timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        // 2. THÔNG BÁO CHO ADMIN ZALO
        if (ADMIN_ZALO_ID) {
            await bot.sendMessage(ADMIN_ZALO_ID, `💬 TIN NHẮN: ${name} (${userPhone || 'Mới'})\n🆔: ${zaloId}\n💌: ${text}`);
        }

        const sessionRef = db.collection('bot_sessions').doc(zaloId);
        const sessionSnap = await sessionRef.get();
        let session = sessionSnap.exists ? sessionSnap.data() : { state: null, pendingOrder: null, tempPhone: null };

        // --- 3. ƯU TIÊN KIỂM TRA LỆNH HỆ THỐNG ---
        if (RESET_KEYWORDS.includes(lowerText)) {
            await sessionRef.delete();
            return bot.sendMessage(zaloId, "🔄 Đã xóa thông tin phiên chat. Bạn có thể bắt đầu lại.");
        }

        if (CHANGE_INFO_KEYWORDS.some(k => lowerText.includes(k))) {
            session.state = 'WAITING_REG_PHONE';
            await sessionRef.set(session);
            return bot.sendMessage(zaloId, "📝 Vui lòng nhập Số điện thoại mới để quán cập nhật.");
        }

        if (MENU_KEYWORDS.some(k => lowerText.includes(k))) {
            const menuMsg = `🍱 THỰC ĐƠN PLANTG\n1. Cơm sườn trứng: 35.000đ\n2. Cơm sườn (không trứng): 35.000đ\n3. Cơm thêm: 5k | Sườn: 10k | Trứng: 5k\n(Canh, rau, mắm: Miễn phí)`;
            return bot.sendMessage(zaloId, menuMsg);
        }

        if (SUPPORT_KEYWORDS.some(k => lowerText.includes(k))) {
            return bot.sendMessage(zaloId, "🤖 Shop đã nhận yêu cầu! Nhân viên sẽ chat với bạn qua đây ngay.");
        }

        if (GREETING_KEYWORDS.some(k => lowerText.includes(k))) {
            return bot.sendMessage(zaloId, `Chào ${name}! Shop PlantG nghe ạ. Bạn muốn đặt món hay hỗ trợ gì không?`);
        }

        // --- 4. LUỒNG ĐĂNG KÝ (Nếu chưa có SĐT) ---
        if (!userPhone && !['WAITING_REG_PHONE', 'WAITING_REG_ADDRESS'].includes(session.state)) {
            session.state = 'WAITING_REG_PHONE';
            await sessionRef.set(session);
            return bot.sendMessage(zaloId, `Chào mừng ${name}! Vui lòng nhập SĐT để Shop hỗ trợ bạn nhé.`);
        }

        if (session.state === 'WAITING_REG_PHONE') {
            const phone = text.replace(/\D/g, '');
            if (phone.length < 10) return bot.sendMessage(zaloId, "⚠️ SĐT không hợp lệ.");
            const userSnap = await db.collection('users').doc(phone).get();
            if (userSnap.exists) {
                await db.collection('users').doc(phone).update({ zaloId });
                session.state = null; await sessionRef.set(session);
                return bot.sendMessage(zaloId, `✅ Đã nhận diện tài khoản ${phone}!`);
            } else {
                session.tempPhone = phone; session.state = 'WAITING_REG_ADDRESS';
                await sessionRef.set(session);
                return bot.sendMessage(zaloId, `Cho quán xin ĐỊA CHỈ GIAO HÀNG để tạo tài khoản mới nhé!`);
            }
        }

        if (session.state === 'WAITING_REG_ADDRESS') {
            const phone = session.tempPhone;
            await db.collection('users').doc(phone).set({
                fullName: name, address: text, zaloId: zaloId, username: phone, passcode: "12345", createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            session.state = null; session.tempPhone = null; await sessionRef.set(session);
            return bot.sendMessage(zaloId, `🎉 Đăng ký thành công tài khoản ${phone}!`);
        }

        // --- 5. NHẬN DIỆN ĐƠN HÀNG ---
        const detected = advancedParse(text);
        if (detected.items) {
            const userDoc = await db.collection('users').doc(userPhone).get();
            const userData = userDoc.data();
            session.pendingOrder = { customer: name, items: detected.items, total: detected.total, note: text, zaloId, phone: userPhone, address: userData.address };
            session.state = 'WAITING_CONFIRM';
            await sessionRef.set(session);
            return bot.sendMessage(zaloId, `📝 XÁC NHẬN: ${detected.items}\n📍 Giao: ${userData.address}\n💰 Tổng: ${detected.total.toLocaleString()}đ\n👉 Nhắn "Ok" để chốt.`);
        }

        if (lowerText === 'ok' && session.state === 'WAITING_CONFIRM') {
            const order = session.pendingOrder;
            await db.collection('orders').add({ ...order, status: 'PENDING', total: order.total.toLocaleString() + 'đ', createdAt: admin.firestore.FieldValue.serverTimestamp() });
            await sessionRef.delete();
            return bot.sendMessage(zaloId, `✅ Đã chốt đơn! Cảm ơn bạn.`);
        }

    } catch (error) { console.error("❌ Lỗi:", error); }
});

/**
 * --- CHAT WEB -> ZALO ---
 */
db.collectionGroup('messages').onSnapshot((snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
            const msgData = change.doc.data();
            const isNew = msgData.timestamp && msgData.timestamp.toMillis() > serverStartTime;
            if (msgData.sender === 'ADMIN' && isNew) {
                const messageContent = msgData.message || msgData.text; 
                if (!messageContent) return;
                const pathSegments = change.doc.ref.path.split('/');
                const clientIdentifier = pathSegments[1]; 
                try {
                    const userSnap = await db.collection('users').doc(clientIdentifier).get();
                    const targetZaloId = userSnap.exists ? userSnap.data().zaloId : clientIdentifier;
                    if (targetZaloId && targetZaloId !== ADMIN_ZALO_ID) {
                        await bot.sendMessage(targetZaloId, `💬 Shop phản hồi: ${messageContent}`);
                    }
                } catch (err) { console.error("❌ Lỗi Admin Chat:", err.message); }
            }
        }
    });
});

app.get('/', (req, res) => res.status(200).send("🚀 Bot Online!"));
app.post('/webhook', (req, res) => {
    if (req.headers['x-bot-api-secret-token'] !== process.env.WEBHOOK_SECRET_TOKEN) return res.sendStatus(403);
    bot.processUpdate(req.body);
    res.sendStatus(200);
});
app.listen(process.env.PORT || 10000, () => {
    if (process.env.WEBHOOK_URL) bot.setWebHook(process.env.WEBHOOK_URL, { secret_token: process.env.WEBHOOK_SECRET_TOKEN });
});