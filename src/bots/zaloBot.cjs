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
const SUPPORT_KEYWORDS = ['hỗ trợ', 'ho tro', 'cần hỗ trợ', 'nhân viên', 'tư vấn', 'shop ơi', 'ad ơi'];
const GREETING_KEYWORDS = ['nay có bán không ạ','đặt cơm ạ','shop ơi','hello','hi','xin chào', 'chào', 'bắt đầu', 'alo shop', 'alo sốp', 'alo'];
const RESET_KEYWORDS = ['reset', 'xóa hết', 'làm lại'];
const CHANGE_INFO_KEYWORDS = ['thay đổi thông tin', 'đổi địa chỉ', 'đổi sđt', 'cập nhật thông tin'];
const MENU_KEYWORDS = ['menu', 'thực đơn', 'món ăn', 'xin menu', 'có món gì'];
const PAYMENT_BANK_KEYWORDS = ['chuyển khoản', 'ck', 'banking', 'qr'];

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
    const primaryQtyMatch = lowerText.match(/(\d+)\s*(p|phần|hộp|cơm|suất)/);
    let primaryQty = primaryQtyMatch ? parseInt(primaryQtyMatch[1]) : 0;
    if (primaryQty === 0 && (lowerText.includes('phần') || lowerText.includes('hộp') || lowerText.includes('cơm'))) primaryQty = 1;

    if (primaryQty > 0) {
        let itemName = MENU.PRIMARY.name;
        if (lowerText.includes('cơm sườn') && !lowerText.includes('trứng')) itemName = 'Cơm tấm sườn';
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
    return { items: items.join(', '), total, note: text };
};

const formatConfirmMsg = (order) => {
    return `📝 XÁC NHẬN THÔNG TIN\n--------------------------\n👤 Khách hàng: ${order.customer}\n📍 Địa chỉ: ${order.address}\n📞 SĐT nhận hàng: ${order.phone}\n🍱 Đơn hàng: ${order.items || 'Chưa chọn món'}\n📝 Ghi chú: ${order.note}\n💰 Tổng cộng: ${order.total.toLocaleString()}đ\n--------------------------\n👉 Nhắn "Ok" để chốt đơn.`;
};

/**
 * --- XỬ LÝ TIN NHẮN TỪ KHÁCH (ZALO -> WEB ADMIN) ---
 */
bot.on('message', async (msg) => {
    const zaloId = String(msg.chat.id);
    const text = msg.text?.trim();
    const name = msg.from?.display_name || "bạn";

    if (!text || text.startsWith('/') || zaloId === ADMIN_ZALO_ID) return;

    try {
        const userPhone = await getPhoneByZaloId(zaloId);
        const chatIdentifier = userPhone || zaloId;

        // CHỈ LƯU NỘI DUNG CHAT VÀO support_chats (Không lưu SĐT/Địa chỉ tại đây)
        await db.collection('support_chats').doc(chatIdentifier).collection('messages').add({
            sender: 'USER',
            message: text,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        const sessionRef = db.collection('bot_sessions').doc(zaloId);
        const sessionSnap = await sessionRef.get();
        let session = sessionSnap.exists ? sessionSnap.data() : { state: null, pendingOrder: null, tempPhone: null };
        const lowerText = text.toLowerCase();

        // LUỒNG ĐĂNG KÝ BẮT BUỘC (SĐT & Địa chỉ lưu tại collection 'users')
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
                return bot.sendMessage(zaloId, `Cho quán xin ĐỊA CHỈ GIAO HÀNG để tạo tài khoản mới nhé! (Pass: 12345)`);
            }
        }

        if (session.state === 'WAITING_REG_ADDRESS') {
            const newPhone = session.tempPhone;
            // LƯU THÔNG TIN CÁ NHÂN VÀO COLLECTION 'users'
            await db.collection('users').doc(newPhone).set({
                fullName: name,
                address: text,
                zaloId: zaloId,
                username: newPhone,
                passcode: "12345",
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            session.state = null;
            session.tempPhone = null;
            await sessionRef.set(session);
            return bot.sendMessage(zaloId, `🎉 Đăng ký thành công tài khoản ${newPhone}!`);
        }

        // LỆNH ĐIỀU HƯỚNG
        if (RESET_KEYWORDS.includes(lowerText)) { await sessionRef.delete(); return bot.sendMessage(zaloId, "🔄 Đã reset phiên."); }
        if (MENU_KEYWORDS.some(k => lowerText.includes(k))) return bot.sendMessage(zaloId, `🍱 THỰC ĐƠN: 1. Sườn trứng: 35k...`);
        if (PAYMENT_BANK_KEYWORDS.some(k => lowerText.includes(k))) return bot.sendMessage(zaloId, "💳 CK: TPBank 00006464313 - PHẠM ĐỨC THUẬN");

        // NHẬN DIỆN ĐƠN HÀNG (Sử dụng dữ liệu từ collection 'users')
        const detected = advancedParse(text);
        if (detected.items) {
            const userData = (await db.collection('users').doc(userPhone).get()).data();
            session.pendingOrder = { 
                customer: name, items: detected.items, total: detected.total, note: detected.note, 
                zaloId, phone: userPhone, address: userData.address 
            };
            session.state = 'WAITING_CONFIRM';
            await sessionRef.set(session);
            return bot.sendMessage(zaloId, formatConfirmMsg(session.pendingOrder));
        }

        if (lowerText === 'ok' && session.state === 'WAITING_CONFIRM') {
            const order = session.pendingOrder;
            await db.collection('orders').add({ ...order, status: 'PENDING', total: order.total.toLocaleString() + 'đ', createdAt: admin.firestore.FieldValue.serverTimestamp() });
            await sessionRef.delete();
            bot.sendMessage(zaloId, `✅ Đã chốt đơn!`);
            if (ADMIN_ZALO_ID) bot.sendMessage(ADMIN_ZALO_ID, `🔔 ĐƠN MỚI: ${userPhone} - ${order.items}`);
            return;
        }

    } catch (error) { console.error("❌ Lỗi:", error); }
});

/**
 * --- LẮNG NGHE CHAT TỪ WEB ADMIN (WEB -> ZALO) ---
 */
db.collectionGroup('messages').onSnapshot((snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
        // Chỉ xử lý tin nhắn MỚI do ADMIN gửi từ Web
        if (change.type === 'added' && change.doc.data().sender === 'ADMIN') {
            const msgData = change.doc.data();
            // Lấy ID khách (SĐT hoặc ZaloID) từ đường dẫn document
            const pathSegments = change.doc.ref.path.split('/');
            const clientIdentifier = pathSegments[1]; // support_chats/{clientIdentifier}/messages/...

            try {
                let targetZaloId = null;
                // 1. Kiểm tra xem clientIdentifier có phải là SĐT trong collection users không
                const userSnap = await db.collection('users').doc(clientIdentifier).get();
                if (userSnap.exists) {
                    targetZaloId = userSnap.data().zaloId;
                } else {
                    // 2. Nếu không phải SĐT, có thể nó là ID ẩn danh của Zalo
                    targetZaloId = clientIdentifier;
                }

                if (targetZaloId) {
                    await bot.sendMessage(targetZaloId, `💬 Shop phản hồi: ${msgData.message}`);
                    console.log(`✅ Đã chuyển tin nhắn Admin tới khách: ${clientIdentifier}`);
                }
            } catch (err) { console.error("❌ Lỗi gửi tin nhắn Admin:", err.message); }
        }
    });
});

/**
 * --- THÔNG BÁO TRẠNG THÁI ĐƠN HÀNG ---
 */
db.collection('orders').onSnapshot((snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
        const order = change.doc.data();
        if (change.type === "modified" && order.zaloId) {
            const statusMap = { 'PREPARING': '👨‍🍳 Đang chuẩn bị', 'SHIPPING': '🚚 Đang giao', 'COMPLETED': '✅ Đã xong', 'CANCELLED': '❌ Đã hủy' };
            bot.sendMessage(order.zaloId, `🔔 Cập nhật: [${statusMap[order.status] || order.status}]`);
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