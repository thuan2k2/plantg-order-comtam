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
const PAYMENT_CASH_KEYWORDS = ['tiền mặt', 'ship cod', 'cod'];

const app = express();
app.use(express.json());
const bot = new ZaloBot(process.env.BOT_TOKEN, { polling: false });
const ADMIN_ZALO_ID = String(process.env.ZALO_BOT_ADMIN_ID || 'a65dc2194697d372478').trim();

/**
 * --- HÀM TRỢ GIÚP ---
 */
// Tìm SĐT dựa trên Zalo ID
const getPhoneByZaloId = async (zaloId) => {
    const userQuery = await db.collection('users').where("zaloId", "==", zaloId).limit(1).get();
    if (!userQuery.empty) return userQuery.docs[0].id; // ID chính là SĐT
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
 * --- XỬ LÝ TIN NHẮN CHÍNH ---
 */
bot.on('message', async (msg) => {
    const zaloId = String(msg.chat.id);
    const text = msg.text?.trim();
    const name = msg.from?.display_name || "bạn";

    if (!text || text.startsWith('/')) return;

    // A. XỬ LÝ ADMIN REPLY (Trả lời khách từ Zalo)
    if (zaloId === ADMIN_ZALO_ID && msg.quote) {
        const quotedMsg = msg.quote.text || "";
        const targetIdMatch = quotedMsg.match(/🆔:\s*([a-zA-Z0-9.\-_]+)/);
        if (targetIdMatch) {
            const targetZaloId = targetIdMatch[1];
            await bot.sendMessage(targetZaloId, `💬 Phản hồi từ Shop: ${text}`);
            
            const phone = await getPhoneByZaloId(targetZaloId);
            const identifier = phone || targetZaloId;

            await db.collection('support_chats').doc(identifier).collection('messages').add({
                zaloId: targetZaloId, sender: 'ADMIN', message: text, timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
            return;
        }
    }

    try {
        const userPhone = await getPhoneByZaloId(zaloId);
        const chatIdentifier = userPhone || zaloId;

        // Lưu tin nhắn vào support_chats (ID là SĐT hoặc Zalo ID ẩn danh tạm thời)
        await db.collection('support_chats').doc(chatIdentifier).collection('messages').add({
            zaloId, sender: 'USER', message: text, name: name, timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        const sessionRef = db.collection('bot_sessions').doc(zaloId);
        const sessionSnap = await sessionRef.get();
        let session = sessionSnap.exists ? sessionSnap.data() : { state: null, pendingOrder: null, tempPhone: null };
        const lowerText = text.toLowerCase();

        // B. KIỂM TRA ĐỊNH DANH BẮT BUỘC (LUỒNG MỚI)
        // Nếu chưa có SĐT gắn với Zalo ID và không đang trong quá trình đăng ký
        if (!userPhone && !['WAITING_REG_PHONE', 'WAITING_REG_ADDRESS'].includes(session.state)) {
            session.state = 'WAITING_REG_PHONE';
            await sessionRef.set(session);
            return bot.sendMessage(zaloId, `Chào mừng ${name} đến với Shop PlantG! 👋\n\nĐể bắt đầu, vui lòng cho Shop xin Số điện thoại của bạn nhé.`);
        }

        // C. XỬ LÝ ĐĂNG KÝ / LIÊN KẾT TÀI KHOẢN
        if (session.state === 'WAITING_REG_PHONE') {
            const phone = text.replace(/\D/g, '');
            if (phone.length < 10) return bot.sendMessage(zaloId, "⚠️ Số điện thoại không hợp lệ. Vui lòng nhập lại.");

            const userSnap = await db.collection('users').doc(phone).get();
            if (userSnap.exists) {
                // Đã có tài khoản -> Cập nhật zaloId để link
                await db.collection('users').doc(phone).update({ zaloId });
                session.state = null;
                await sessionRef.set(session);
                return bot.sendMessage(zaloId, `✅ Đã nhận diện tài khoản! Chào mừng bạn quay trở lại.\n\nBây giờ bạn có thể nhắn "Menu" hoặc đặt cơm trực tiếp nhé.`);
            } else {
                // Tài khoản mới -> Lưu SĐT vào session và hỏi địa chỉ
                session.tempPhone = phone;
                session.state = 'WAITING_REG_ADDRESS';
                await sessionRef.set(session);
                return bot.sendMessage(zaloId, `Dạ, quán chưa thấy thông tin của mình trên hệ thống. Cho quán xin ĐỊA CHỈ GIAO HÀNG để tạo tài khoản mới cho mình nhé! (Mật khẩu mặc định là 12345)`);
            }
        }

        if (session.state === 'WAITING_REG_ADDRESS') {
            const newPhone = session.tempPhone;
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
            return bot.sendMessage(zaloId, `🎉 Chúc mừng ${name} đã đăng ký thành công!\n👤 Tài khoản: ${newPhone}\n📍 Địa chỉ: ${text}\n\nBạn có thể nhắn món muốn đặt ngay bây giờ ạ.`);
        }

        // D. LỆNH ĐIỀU HƯỚNG & THANH TOÁN
        if (RESET_KEYWORDS.includes(lowerText)) {
            await sessionRef.delete();
            return bot.sendMessage(zaloId, "🔄 Đã xóa thông tin phiên đặt hàng.");
        }

        if (MENU_KEYWORDS.some(k => lowerText.includes(k))) {
            return bot.sendMessage(zaloId, `🍱 THỰC ĐƠN SHOP PLANTG\n--------------------------\n1. ${MENU.PRIMARY.name}: ${MENU.PRIMARY.price.toLocaleString()}đ\n2. Món thêm (Sườn/Trứng): 5k-10k\n--------------------------\n👉 Nhắn món bạn muốn đặt ngay nhé!`);
        }

        if (CHANGE_INFO_KEYWORDS.some(k => lowerText.includes(k))) {
            session.state = 'WAITING_REG_PHONE';
            await sessionRef.set(session);
            return bot.sendMessage(zaloId, "📝 Vui lòng nhập Số điện thoại mới để cập nhật thông tin.");
        }

        if (PAYMENT_BANK_KEYWORDS.some(k => lowerText.includes(k))) {
            await bot.sendMessage(zaloId, "💳 Quý khách chuyển khoản qua: Ngân hàng TPBank 00006464313 - PHẠM ĐỨC THUẬN");
            return bot.sendMessage(zaloId, "🔗 Mã QR: https://img.vietqr.io/image/TPB-00006464313-qr_only.png");
        }

        if (SUPPORT_KEYWORDS.some(k => lowerText.includes(k))) {
            bot.sendMessage(zaloId, "🤖 Shop đã nhận được yêu cầu hỗ trợ. Nhân viên sẽ phản hồi bạn ngay!");
            if (ADMIN_ZALO_ID) bot.sendMessage(ADMIN_ZALO_ID, `⚠️ YÊU CẦU HỖ TRỢ\n🆔: ${zaloId}\n👤: ${name}\n💬: ${text}`);
            return;
        }

        // E. NHẬN DIỆN ĐƠN HÀNG
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
            const docRef = await db.collection('orders').add({
                ...order, status: 'PENDING', total: order.total.toLocaleString() + 'đ', createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            await sessionRef.delete();
            bot.sendMessage(zaloId, `✅ ĐÃ CHỐT ĐƠN (#${docRef.id.slice(-6).toUpperCase()})\n🔔 Trạng thái: 🕒 Chờ xác nhận`);
            if (ADMIN_ZALO_ID) bot.sendMessage(ADMIN_ZALO_ID, `🔔 ĐƠN MỚI\n🆔: ${zaloId}\n👤 Khách: ${order.customer}\n🍱 Đơn: ${order.items}\n📝 Note: ${order.note}`);
            return;
        }

        if (GREETING_KEYWORDS.some(k => lowerText.includes(k))) {
            return bot.sendMessage(zaloId, `Chào ${name}! Shop PlantG nghe ạ. Bạn nhắn "Menu" để xem món nhé.`);
        }

    } catch (error) { console.error("❌ Lỗi:", error); }
});

/**
 * --- CƠ CHẾ KEEP-ALIVE & WEBHOOK ---
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

app.get('/', (req, res) => res.status(200).send("🚀 PlantG Bot Online!"));
app.post('/webhook', (req, res) => {
    if (req.headers['x-bot-api-secret-token'] !== process.env.WEBHOOK_SECRET_TOKEN) return res.sendStatus(403);
    bot.processUpdate(req.body);
    res.sendStatus(200);
});
app.listen(process.env.PORT || 10000, () => {
    if (process.env.WEBHOOK_URL) bot.setWebHook(process.env.WEBHOOK_URL, { secret_token: process.env.WEBHOOK_SECRET_TOKEN });
});