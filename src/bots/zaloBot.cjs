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
// Hàm tra cứu SĐT từ Zalo ID để thống nhất Document ID
const getPhoneByZaloId = async (zaloId) => {
    const userQuery = await db.collection('users').where("zaloId", "==", zaloId).limit(1).get();
    if (!userQuery.empty) {
        return userQuery.docs[0].id; // ID của document trong collection users chính là SĐT
    }
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
    return `📝 XÁC NHẬN THÔNG TIN\n` +
           `--------------------------\n` +
           `👤 Khách hàng: ${order.customer}\n` +
           `📍 Địa chỉ: ${order.address}\n` +
           `📞 SĐT nhận hàng: ${order.phone}\n` +
           `🍱 Đơn hàng: ${order.items || 'Chưa chọn món'}\n` +
           `📝 Ghi chú: ${order.note}\n` +
           `💰 Tổng cộng: ${order.total.toLocaleString()}đ\n` +
           `--------------------------\n` +
           `👉 Nhắn "Ok" để chốt đơn.\n` +
           `👉 Nhắn "Thay đổi thông tin" nếu muốn đổi SĐT/Địa chỉ.`;
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

            // Tìm SĐT để thống nhất vị trí lưu trữ tin nhắn
            const phone = await getPhoneByZaloId(targetZaloId);
            const identifier = phone || targetZaloId;

            // Lưu phản hồi của Admin vào cùng luồng hội thoại với khách
            await db.collection('support_chats').doc(identifier).collection('messages').add({
                zaloId: targetZaloId,
                sender: 'ADMIN',
                message: text,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
            return;
        }
    }

    try {
        // THỐNG NHẤT ID: Tìm SĐT để làm Document ID cho support_chats
        const userPhone = await getPhoneByZaloId(zaloId);
        const chatIdentifier = userPhone || zaloId;

        // Lưu tin nhắn khách gửi vào sub-collection 'messages' dưới Document là SĐT (hoặc Zalo ID nếu chưa có SĐT)
        await db.collection('support_chats').doc(chatIdentifier).collection('messages').add({
            zaloId,
            sender: 'USER',
            message: text,
            name: name,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        await db.collection('learning_logs').add({ zaloId, text, name, timestamp: admin.firestore.FieldValue.serverTimestamp() });

        const sessionRef = db.collection('bot_sessions').doc(zaloId);
        const sessionSnap = await sessionRef.get();
        let session = sessionSnap.exists ? sessionSnap.data() : { state: null, pendingOrder: null };
        const lowerText = text.toLowerCase();

        // B. LỆNH ĐIỀU HƯỚNG
        if (RESET_KEYWORDS.includes(lowerText)) {
            await sessionRef.delete();
            return bot.sendMessage(zaloId, "🔄 Đã xóa thông tin phiên đặt hàng. Bạn có thể bắt đầu lại ngay.");
        }

        if (MENU_KEYWORDS.some(k => lowerText.includes(k))) {
            const menuMsg = `🍱 THỰC ĐƠN SHOP PLANTG\n--------------------------\n1. ${MENU.PRIMARY.name}: ${MENU.PRIMARY.price.toLocaleString()}đ\n2. Cơm thêm: 5.000đ\n3. Sườn thêm: 10.000đ\n4. Trứng thêm: 5.000đ\n--------------------------\n👉 Nhắn món bạn muốn đặt ngay nhé!`;
            return bot.sendMessage(zaloId, menuMsg);
        }

        if (CHANGE_INFO_KEYWORDS.some(k => lowerText.includes(k))) {
            session.state = 'WAITING_PHONE';
            await sessionRef.set(session);
            return bot.sendMessage(zaloId, "📝 Vui lòng nhập Số điện thoại mới để quán cập nhật.");
        }

        // C. THANH TOÁN (Tin nhắn text + Link ảnh QR)
        if (PAYMENT_BANK_KEYWORDS.some(k => lowerText.includes(k))) {
            await bot.sendMessage(zaloId, "💳 Bạn vui lòng chuyển khoản qua STK: Ngân hàng TPBank 00006464313 - PHẠM ĐỨC THUẬN");
            return bot.sendMessage(zaloId, "🔗 Hoặc quét mã QR tại đây: https://img.vietqr.io/image/TPB-00006464313-qr_only.png");
        }

        if (PAYMENT_CASH_KEYWORDS.some(k => lowerText.includes(k))) {
            return bot.sendMessage(zaloId, "💵 Đã ghi nhận hình thức thanh toán Tiền mặt (COD).");
        }

        // D. HỖ TRỢ TRỰC TIẾP
        if (SUPPORT_KEYWORDS.some(k => lowerText.includes(k))) {
            await sessionRef.delete();
            bot.sendMessage(zaloId, "🤖 Shop đã nhận được yêu cầu. Nhân viên sẽ hỗ trợ bạn ngay giây lát!");
            if (ADMIN_ZALO_ID) bot.sendMessage(ADMIN_ZALO_ID, `⚠️ KHÁCH CẦN HỖ TRỢ\n🆔: ${zaloId}\n👤: ${name}\n💬: ${text}`);
            return;
        }

        // E. NHẬN DIỆN ĐƠN HÀNG
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
                return bot.sendMessage(zaloId, `🤖 Nhận đơn: ${detected.items}. Cho quán xin SĐT nhé! (Nếu Zalo hiện gửi kèm thông tin, ấn nút X phía trên rồi dán SĐT vào nha)`);
            }
        }

        // F. LUỒNG NHẬP LIỆU
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
            return bot.sendMessage(zaloId, "Dạ khách mới, cho quán xin địa chỉ giao hàng cụ thể nhé.");
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

        if (lowerText === 'ok' && session.state === 'WAITING_CONFIRM') {
            const order = session.pendingOrder;
            const docRef = await db.collection('orders').add({
                ...order, status: 'PENDING', total: order.total.toLocaleString() + 'đ', createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            await sessionRef.delete();
            
            const finalMsg = `✅ ĐÃ CHỐT ĐƠN (#${docRef.id.slice(-6).toUpperCase()})\n🍱 Món: ${order.items}\n📍 Giao: ${order.address}\n🔔 Trạng thái: 🕒 Chờ xác nhận`;
            bot.sendMessage(zaloId, finalMsg);
            if (ADMIN_ZALO_ID) bot.sendMessage(ADMIN_ZALO_ID, `🔔 ĐƠN MỚI\n🆔: ${zaloId}\n👤 Khách: ${order.customer}\n🍱 Đơn: ${order.items}\n📝 Note: ${order.note}`);
            return;
        }

        if (GREETING_KEYWORDS.some(k => lowerText.includes(k))) {
            await sessionRef.delete();
            return bot.sendMessage(zaloId, `Xin chào ${name}. Shop PlantG nghe ạ! Bạn nhắn "Menu" để xem món nhé.`);
        }

    } catch (error) { console.error("❌ Lỗi:", error); }
});

/**
 * --- THÔNG BÁO TRẠNG THÁI ---
 */
db.collection('orders').onSnapshot((snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
        const order = change.doc.data();
        if (change.type === "modified" && order.zaloId) {
            const statusMap = { 'PREPARING': '👨‍🍳 Đang chuẩn bị', 'SHIPPING': '🚚 Đang giao', 'COMPLETED': '✅ Đã xong', 'CANCELLED': '❌ Đã hủy' };
            bot.sendMessage(order.zaloId, `🔔 Cập nhật đơn #${change.doc.id.slice(-6).toUpperCase()}: [${statusMap[order.status] || order.status}]`);
        }
    });
});

/**
 * --- CƠ CHẾ KEEP-ALIVE & WEBHOOK ---
 */
app.get('/', (req, res) => {
    res.status(200).send("🚀 PlantG Bot Server is Active and Healthy!");
});

app.post('/webhook', (req, res) => {
    if (req.headers['x-bot-api-secret-token'] !== process.env.WEBHOOK_SECRET_TOKEN) return res.sendStatus(403);
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

app.listen(process.env.PORT || 10000, () => {
    if (process.env.WEBHOOK_URL) bot.setWebHook(process.env.WEBHOOK_URL, { secret_token: process.env.WEBHOOK_SECRET_TOKEN });
});