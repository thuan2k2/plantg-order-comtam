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

// 2. CẤU HÌNH THỰC ĐƠN HOÀN CHỈNH (Theo hình ảnh)
const MENU = {
    MAIN: [
        { keywords: ['sườn trứng', 'suon trung', 'đầy đủ', 'đầy đủ sườn trứng', 'st', 'đầy đủ'], name: 'Cơm tấm sườn trứng', price: 35000 },
        { keywords: ['cơm sườn', 'com suon', 'suon nướng', 's'], name: 'Cơm tấm sườn', price: 35000 }
    ],
    EXTRA: [
        { keywords: ['cơm thêm', 'thêm cơm', 'thêm 1 phần cơm','thêm 1 hộp cơm','thêm 1 suất cơm','thêm 1 bịch cơm'], name: 'Cơm thêm', price: 5000 },
        { keywords: ['sườn thêm', 'thêm sườn', 'thêm 1 phần sườn','thêm sườn 1 phần'], name: 'Sườn thêm', price: 10000 },
        { keywords: ['trứng thêm', 'thêm trứng', 'trứng ốp', 'thêm 1 phần trứng', 'thêm trứng 1 phần'], name: 'Trứng thêm', price: 5000 },
        { keywords: ['canh thêm', 'thêm canh', 'thêm 1 phần canh', 'thêm canh 1 phần', 'thêm 1 bịch canh', 'thêm canh 1 bịch'], name: 'Canh thêm', price: 0 },
        { keywords: ['cà chua thêm', 'ca chua', 'thêm 1 phần cà chua', 'thêm cà chua 1 phần', 'thêm 1 cái cà chua', 'thêm cà chua 1 cái'], name: 'Cà chua thêm', price: 0 },
        { keywords: ['dưa chua thêm', 'dua chua', 'thêm 1 phần dưa chua', 'thêm dưa chua 1 phần'], name: 'Dưa chua thêm', price: 0 },
        { keywords: ['dưa leo thêm', 'dua leo', 'thêm 1 phần dưa leo', 'thêm dưa leo 1 phần'], name: 'Dưa leo thêm', price: 0 },
        { keywords: ['nước mắm thêm', 'thêm nc mắm', 'nước mắm thêm', 'thêm 1 bịch nước mắm'], name: 'Nước mắm thêm', price: 0 }
    ]
};

const SUPPORT_KEYWORDS = ['hỗ trợ', 'ho tro', 'cần hỗ trợ', 'nhân viên', 'tư vấn', 'shop ơi', 'ad ơi', 'sốp ơi', 'shop oi', 'sốp oi', 'dạ shop ơi', 'dạ sốp ơi', 'dạ shop oi', 'dạ sốp oi', 'help', 'support', 'customer service', 'cs', 'tư vấn giúp', 'hỗ trợ giúp', 'gặp nhân viên', 'gặp shop', 'gặp sốp', 'gặp ad', 'gặp nhân viên tư vấn', 'gặp shop tư vấn', 'gặp sốp tư vấn', 'gặp ad tư vấn'];
const MENU_KEYWORDS = ['menu', 'thực đơn', 'món ăn', 'xin menu', 'có món gì', 'gửi menu', 'cho menu', 'xem menu', 'menu hôm nay', 'menu mới', 'thực đơn hôm nay', 'thực đơn mới', 'gửi thực đơn', 'cho thực đơn', 'xem thực đơn', 'thực đơn của quán', 'menu của quán', 'thực đơn của shop', 'menu của shop', 'thực đơn của sốp', 'menu của sốp', 'thực đơn của ad', 'menu của ad', 'gửi thực đơn của quán', 'gửi menu của quán', 'gửi thực đơn của shop', 'gửi menu của shop', 'gửi thực đơn của sốp', 'gửi menu của sốp', 'gửi thực đơn của ad', 'gửi menu của ad', 'thực đơn mới nhất', 'menu mới nhất', 'thực đơn cập nhật', 'menu cập nhật', 'thực đơn hôm nay', 'menu hôm nay', 'thực đơn mới hôm nay', 'menu mới hôm nay'];
const GREETING_KEYWORDS = ['hello', 'hi', 'xin chào', 'chào', 'bắt đầu', 'alo', 'đặt cơm', 'shop ơi', 'sốp ơi', 'shop oi', 'sốp oi', 'dạ alo', 'dạ chào', 'dạ bắt đầu', 'Dạ shop ơi', 'Dạ sốp ơi', 'Dạ shop oi', 'Dạ sốp oi'];

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

// Phân tích logic món ăn (Phân biệt Sườn và Sườn Trứng)
const advancedParse = (text) => {
    let items = [];
    let total = 0;
    const lowerText = text.toLowerCase();

    // 1. Nhận diện số lượng phần cơm chính
    const qtyMatch = lowerText.match(/(\d+)\s*(p|phần|hộp|cơm|suất)/);
    let qty = qtyMatch ? parseInt(qtyMatch[1]) : 0;
    if (qty === 0 && (lowerText.includes('phần') || lowerText.includes('hộp') || lowerText.includes('cơm'))) qty = 1;

    if (qty > 0) {
        // Logic phân biệt: Nếu có "trứng", "st" hoặc "đầy đủ" thì là Sườn trứng
        const isEgg = lowerText.includes('trứng') || lowerText.includes('đầy đủ') || lowerText.includes('st');
        const dish = isEgg ? MENU.MAIN[0] : MENU.MAIN[1];
        
        items.push(`${qty}x ${dish.name}`);
        total += dish.price * qty;
    }

    // 2. Nhận diện các món thêm/kèm
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
 * --- XỬ LÝ TIN NHẮN TỪ KHÁCH ---
 */
bot.on('message', async (msg) => {
    const zaloId = String(msg.chat.id);
    const text = msg.text?.trim() || "";
    const name = msg.from?.display_name || "Khách hàng";

    if (!text || text.startsWith('/')) return;

    // Không xử lý reply bằng quote trên Zalo
    if (zaloId === ADMIN_ZALO_ID) return;

    try {
        const userPhone = await getPhoneByZaloId(zaloId);
        const chatIdentifier = userPhone || zaloId;

        // 1. Đồng bộ Fields lên support_chats (Mess Web Admin)
        await db.collection('support_chats').doc(chatIdentifier).set({
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
            orderId: null,
            unreadAdmin: true,
            unreadUser: false,
            userAvatar: "",
            userName: name,
            userPhone: userPhone || ""
        }, { merge: true });

        // 2. Lưu tin nhắn vào sub-collection (Trường 'message')
        await db.collection('support_chats').doc(chatIdentifier).collection('messages').add({
            sender: 'USER',
            message: text,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        // 3. Thông báo cho Admin (Sửa lỗi undefined)
        if (ADMIN_ZALO_ID) {
            const adminNotify = `💬 TIN NHẮN MỚI\n━━━━━━━━━━━━━━━━\n👤 Khách: ${name}\n📞 SĐT: (${userPhone || 'Chưa có'})\n🆔: ${zaloId}\n💌 Nội dung:\n「 ${text} 」\n━━━━━━━━━━━━━━━━`;
            await bot.sendMessage(ADMIN_ZALO_ID, adminNotify);
        }

        const sessionRef = db.collection('bot_sessions').doc(zaloId);
        const sessionSnap = await sessionRef.get();
        let session = sessionSnap.exists ? sessionSnap.data() : { state: null, pendingOrder: null, tempPhone: null };
        const lowerText = text.toLowerCase();

        // 4. Luồng đăng ký bắt buộc
        if (!userPhone && !['WAITING_REG_PHONE', 'WAITING_REG_ADDRESS'].includes(session.state)) {
            session.state = 'WAITING_REG_PHONE';
            await sessionRef.set(session);
            return bot.sendMessage(zaloId, `Chào mừng ${name}! 👋\nVui lòng nhập Số điện thoại để Shop hỗ trợ bạn nhé.`);
        }

        if (session.state === 'WAITING_REG_PHONE') {
            const phone = text.replace(/\D/g, '');
            if (phone.length < 10) return bot.sendMessage(zaloId, "⚠️ SĐT không hợp lệ.");
            const userSnap = await db.collection('users').doc(phone).get();
            if (userSnap.exists) {
                await db.collection('users').doc(phone).update({ zaloId });
                session.state = null;
                await sessionRef.set(session);
                return bot.sendMessage(zaloId, `✅ Đã nhận diện tài khoản ${phone}!`);
            } else {
                session.tempPhone = phone;
                session.state = 'WAITING_REG_ADDRESS';
                await sessionRef.set(session);
                return bot.sendMessage(zaloId, `Cho quán xin ĐỊA CHỈ GIAO HÀNG để tạo tài khoản mới nhé!`);
            }
        }

        if (session.state === 'WAITING_REG_ADDRESS') {
            const newPhone = session.tempPhone;
            await db.collection('users').doc(newPhone).set({
                fullName: name, address: text, zaloId: zaloId, username: newPhone, passcode: "12345", createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            session.state = null;
            session.tempPhone = null;
            await sessionRef.set(session);
            return bot.sendMessage(zaloId, `🎉 Đăng ký thành công tài khoản ${newPhone}!`);
        }

        // Xử lý đơn hàng
        const detected = advancedParse(text);
        if (detected.items) {
            const userData = (await db.collection('users').doc(userPhone).get()).data();
            session.pendingOrder = { customer: name, items: detected.items, total: detected.total, note: text, zaloId, phone: userPhone, address: userData.address };
            session.state = 'WAITING_CONFIRM';
            await sessionRef.set(session);
            return bot.sendMessage(zaloId, `📝 XÁC NHẬN: ${detected.items}\n📍 Giao: ${userData.address}\n💰 Tổng: ${detected.total.toLocaleString()}đ\n👉 Nhắn "Ok" để chốt.`);
        }

        if (lowerText === 'ok' && session.state === 'WAITING_CONFIRM') {
            const order = session.pendingOrder;
            await db.collection('orders').add({ ...order, status: 'PENDING', total: order.total.toLocaleString() + 'đ', createdAt: admin.firestore.FieldValue.serverTimestamp() });
            await sessionRef.delete();
            return bot.sendMessage(zaloId, `✅ Đã chốt đơn thành công!`);
        }

        if (MENU_KEYWORDS.some(k => lowerText.includes(k))) {
            return bot.sendMessage(zaloId, "🍱 Nhắn món bạn muốn đặt ngay nhé!");
        }

    } catch (error) { console.error("❌ Lỗi:", error); }
});

/**
 * --- LẮNG NGHE CHAT TỪ WEB ADMIN (Gửi tin nhắn qua Zalo) ---
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