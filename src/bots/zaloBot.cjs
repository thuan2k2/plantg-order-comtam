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

// HỆ THỐNG PHÂN HẠNG TÀI KHOẢN (RANK)
const RANK_TIERS = [
    { id: 'CHALLENGER', name: 'Thách Đấu', min: 2400000 },
    { id: 'WARLORD', name: 'Chiến Tướng', min: 2100000 },
    { id: 'MASTER', name: 'Cao Thủ', min: 1800000 },
    { id: 'VETERAN', name: 'Tinh Anh', min: 1500000 },
    { id: 'DIAMOND', name: 'Kim Cương', min: 1200000 },
    { id: 'PLATINUM', name: 'Bạch Kim', min: 900000 },
    { id: 'GOLD', name: 'Vàng', min: 600000 },
    { id: 'SILVER', name: 'Bạc', min: 300000 },
    { id: 'BRONZE', name: 'Đồng', min: 0 }
];

const getUserRank = (userData) => {
    if (userData.manualRankId) {
        const rank = RANK_TIERS.find(r => r.id === userData.manualRankId);
        if (rank) return rank.name;
    }
    const totalSpend = Number(userData.totalSpend || 0);
    const rank = RANK_TIERS.find(r => totalSpend >= r.min);
    return rank ? rank.name : 'Đồng';
};

// 2. CẤU HÌNH THỰC ĐƠN & TỪ KHÓA
const MENU = {
    MAIN: [
        { keywords: ['cơm thêm', 'thêm cơm', 'cơm không', 'cơm riêng', 'com khong', 'cơm ko'], name: 'Cơm thêm', price: 5000 },
        { keywords: ['sườn trứng', 'suon trung', 'đầy đủ', 'cơm sườn trứng', 's trứng', 'st', 'com st', 'cơm st',], name: 'Cơm tấm sườn trứng', price: 35000 },
        { keywords: ['cơm sườn', 'com suon', 'cơm tấm sườn', 'sườn chả', 'sườn nướng', 'sườn', 'suon', 's'], name: 'Cơm tấm sườn', price: 35000 },
        { keywords: ['phần cơm', 'p cơm', 'hộp cơm', 'cơm tấm', 'phần', 'hộp', 'suất', 'cơm'], name: 'Cơm tấm sườn trứng', price: 35000 } 
    ],
    SIDES: [
        { keywords: ['sườn thêm', 'miếng sườn', 'thêm sườn'], name: 'Sườn thêm', price: 10000 },
        { keywords: ['trứng thêm', 'thêm trứng'], name: 'Trứng thêm', price: 5000 },
        { keywords: ['canh thêm', 'thêm canh'], name: 'Canh thêm', price: 0 },
        { keywords: ['cà chua thêm', 'ca chua them', 'cà chua'], name: 'Cà chua thêm', price: 0 },
        { keywords: ['dưa chua thêm', 'dua chua them', 'đồ chua thêm'], name: 'Dưa chua thêm', price: 0 },
        { keywords: ['dưa leo thêm', 'dua leo them', 'thêm dưa chuột'], name: 'Dưa leo thêm', price: 0 },
        { keywords: ['nước mắm thêm', 'nuoc mam them', 'mắm thêm', 'thêm mắm'], name: 'Nước mắm thêm', price: 0 }
    ]
};

const CANCEL_KEYWORDS = ['hủy', 'huy', 'hủy đơn', 'huy don', 'không đặt nữa'];
const SUPPORT_KEYWORDS = ['hỗ trợ', 'ho tro', 'cần hỗ trợ', 'nhân viên', 'tư vấn', 'shop ơi', 'ad ơi', 'chủ quán'];
const CLOSE_SUPPORT_KEYWORDS = ['đóng chat', 'dong chat', 'đóng hỗ trợ', 'dong ho tro', 'kết thúc', 'ket thuc'];
const GREETING_KEYWORDS = ['nay có bán không ạ','đặt cơm ạ','shop ơi','hello','hi','xin chào', 'chào', 'bắt đầu', 'alo shop', 'alo sốp', 'alo'];

// Tách cơ chế Reset
const LOGOUT_KEYWORDS = ['reset', 'xóa', 'xoa', 'đăng xuất', 'dang xuat'];
const DELETE_ALL_KEYWORDS = ['reset all', 'xóa all', 'xoa all', 'delete all'];

const CHANGE_INFO_KEYWORDS = ['thay đổi thông tin', 'đổi địa chỉ', 'đổi sđt', 'cập nhật thông tin'];
const MENU_KEYWORDS = ['menu', 'thực đơn', 'món ăn', 'xin menu', 'có món gì'];
const PAYMENT_BANK_KEYWORDS = ['chuyển khoản', 'ck', 'banking', 'qr'];
const PAYMENT_CASH_KEYWORDS = ['tiền mặt', 'ship cod', 'cod'];
const ORDER_INTENT_KEYWORDS = ['đặt', 'cho', 'mua', 'ship', 'giao', 'lấy', 'order'];

// TỪ KHÓA CHO CÁC TÍNH NĂNG MỚI
const INFO_KEYWORDS = ['thông tin', 'thong tin'];
const GUIDE_KEYWORDS = ['hướng dẫn', 'huong dan', 'help'];
const SHORTCUT_KEYWORDS = ['viết tắt', 'viet tat', 'từ khóa', 'tu khoa'];
const REORDER_KEYWORDS = ['đặt lại', 'dat lai', 'mua lại', 'mua lai'];
const BALANCE_KEYWORDS = ['số dư', 'so du', 'ví', 'xu'];
const HISTORY_KEYWORDS = ['lịch sử', 'lich su'];

const app = express();
app.use(express.json());
const bot = new ZaloBot(process.env.BOT_TOKEN, { polling: false });
const ADMIN_ZALO_ID = String(process.env.ZALO_BOT_ADMIN_ID || 'a65dc2194697d372478').trim();

// THÔNG ĐIỆP BẢNG THÔNG TIN
const infoMsgText = `Bạn có thể nhắn các nội dung sau đây:\n` +
                    `- 📖 "Menu" để xem Menu món ăn\n` +
                    `- ⚡ "Viết tắt" để xem danh sách từ khóa gọi món nhanh\n` +
                    `- 📘 "Hướng dẫn" để xem chi tiết cách dùng BOT\n` +
                    `- 📱 "Ck" để lấy thông tin hoặc mã chuyển khoản\n` +
                    `- 🏦 "Số dư" để kiểm tra số tiền Ví và số Xu hiện có\n` +
                    `- 🕒 "Lịch sử" để tra cứu lịch sử đơn hàng đã đặt\n` +
                    `- 🆘 "Hỗ trợ" để nhắn tin với Shop hoặc "Đóng hỗ trợ" để kết thúc\n` +
                    `- 🗑️ "Hủy" nếu muốn xóa đơn hàng đang tạo dở\n` +
                    `- 📝 "Thay đổi thông tin" nếu muốn đổi SĐT/Địa chỉ (chỉ có thể thay đổi trên website)\n` +
                    `- 🔄 "Reset" để Đăng xuất hoặc "Reset All" để Xóa toàn bộ tài khoản.`;

const shortcutMsgText = `📋 DANH SÁCH TỪ KHÓA VIẾT TẮT:\n\n` +
                        `🍛 Món chính:\n` +
                        `- Cơm sườn trứng: sườn trứng, s trứng, st\n` +
                        `- Cơm sườn: sườn, s\n\n` +
                        `🍲 Món thêm:\n` +
                        `- Sườn thêm: sườn thêm\n` +
                        `- Trứng thêm: trứng thêm\n` +
                        `- Canh / Cà chua / Dưa leo / Mắm: thêm canh, cà chua, dưa leo, mắm\n\n` +
                        `💡 3 VÍ DỤ CÁCH GỌI NHANH:\n` +
                        `1. "1 st" -> Lên đơn 1 Cơm sườn trứng.\n` +
                        `2. "2 s 1 sườn thêm" -> Lên đơn 2 Cơm sườn + 1 sườn thêm.\n` +
                        `3. "1p thêm canh mắm" -> Lên đơn 1 Cơm sườn trứng (mặc định) + canh + mắm.`;

const guideMsgText = `📖 HƯỚNG DẪN SỬ DỤNG BOT PLANTG 📖\n` +
                     `--------------\n` +
                     `🔑 ĐĂNG NHẬP:\n` +
                     `- Gõ Số điện thoại của bạn có kèm dấu chấm ở cuối (VD: 0987654321.) để hệ thống nhận diện nhanh và tự động liên kết.\n` +
                     `--------------\n` +
                     `🛒 CÁCH ĐẶT ĐƠN:\n` +
                     `- Nhắn số lượng + tên món (VD: "2 sườn trứng 1 canh"). \n` +
                     `- Có thể gõ "Viết tắt" để biết cách đặt siêu nhanh.\n` +
                     `--------------\n` +
                     `🔄 ĐẶT LẠI ĐƠN CŨ:\n` +
                     `- Bạn lười chọn món? Nhắn "Đặt lại" để BOT lên lại đơn hàng vừa giao gần nhất.\n` +
                     `- Hoặc nhắn cụ thể: "Đặt lại đơn 2", "Đặt lại đơn 3".\n` +
                     `--------------\n` +
                     `🆘 KHI CẦN GẶP NHÂN VIÊN:\n` +
                     `- Nhắn "Hỗ trợ" để kết nối chat trực tiếp với quán.\n` +
                     `- Sau khi xong việc, bắt buộc nhắn "Đóng chat" để BOT trở lại trạng thái Tự động nhận đơn nhé!`;

/**
 * --- HÀM TRỢ GIÚP ---
 */
const getPhoneByZaloId = async (zaloId) => {
    const userQuery = await db.collection('users').where("zaloId", "==", zaloId).limit(1).get();
    if (!userQuery.empty) {
        return userQuery.docs[0].id;
    }
    return null;
};

// CẬP NHẬT: Phân tách món ăn bằng dấu "," hoặc "."
const advancedParse = (text) => {
    let itemsMap = {};
    let total = 0;
    let hasValidItem = false;
    
    // Tách chuỗi thành mảng các phần tử dựa trên dấu phẩy hoặc dấu chấm
    const parts = text.split(/[.,\n]/).map(p => p.trim()).filter(p => p.length > 0);

    for (let part of parts) {
        let lowerPart = part.toLowerCase();
        lowerPart = lowerPart.replace(/(\d+)([a-zA-Zà-ỹ]+)/g, '$1 $2');
        
        let primaryQty = 1; 
        
        const qtyMatch = lowerPart.match(/(?:^|\s)(\d{1,2})\s*(p|phần|hộp|suất|cơm|c)?(?:$|\s)/);
        if (qtyMatch) {
            primaryQty = parseInt(qtyMatch[1]);
            if(primaryQty > 50) primaryQty = 1; 
        }

        let foundMain = false;

        // Quét Món Chính cho phần cắt này
        for (const main of MENU.MAIN) {
            if (main.keywords.some(k => new RegExp(`(^|\\s)${k}($|\\s)`).test(lowerPart))) {
                itemsMap[main.name] = (itemsMap[main.name] || 0) + primaryQty;
                total += main.price * primaryQty;
                foundMain = true;
                hasValidItem = true;
                break; 
            }
        }

        // Nếu không có tên món cụ thể nhưng có "1p", "1 hộp" -> Mặc định Cơm Sườn Trứng
        if (!foundMain && qtyMatch && qtyMatch[2]) {
            itemsMap['Cơm tấm sườn trứng'] = (itemsMap['Cơm tấm sườn trứng'] || 0) + primaryQty;
            total += 35000 * primaryQty;
            hasValidItem = true;
        }

        // Quét Món Phụ cho phần cắt này
        MENU.SIDES.forEach(side => {
            const sideKeywordsRegex = new RegExp(`(?:^|\\s)(\\d{1,2})?\\s*(${side.keywords.join('|')})(?:$|\\s)`, 'i');
            const match = lowerPart.match(sideKeywordsRegex);
            if (match) {
                let qty = match[1] ? parseInt(match[1]) : 1;
                if(qty > 50) qty = 1; 
                itemsMap[side.name] = (itemsMap[side.name] || 0) + qty;
                total += side.price * qty;
                hasValidItem = true;
            }
        });
    }

    if (!hasValidItem) {
        const lowerText = text.toLowerCase();
        const hasOrderIntent = ORDER_INTENT_KEYWORDS.some(k => new RegExp(`(^|\\s)${k}($|\\s)`).test(lowerText));
        const isJustShortNumber = /^\s*\d{1,2}\s*$/.test(lowerText); 
        const hasNumberWithUnit = lowerText.match(/(?:^|\s)(\d{1,2})\s*(p|phần|hộp|suất|cơm|c)(?:$|\s)/);

        if (hasOrderIntent || isJustShortNumber || hasNumberWithUnit) {
            return { items: "Giống Ghi chú", total: "Thanh toán sau", note: text };
        }
        return { items: null }; 
    }

    // Gộp các món đã gom lại thành 1 chuỗi hoàn chỉnh
    const itemsArr = Object.keys(itemsMap).map(key => `${itemsMap[key]}x ${key}`);

    return { items: itemsArr.join(', '), total, note: text };
};

const formatConfirmMsg = (order) => {
    const displayTotal = order.total === "Thanh toán sau" ? "Thanh toán sau" : `${order.total.toLocaleString()}đ`;
    return `📝 XÁC NHẬN THÔNG TIN\n` +
           `--------------------------\n` +
           `👤 Khách hàng: ${order.customer}\n` +
           `📍 Địa chỉ: ${order.address}\n` +
           `📞 SĐT nhận hàng: ${order.phone}\n` +
           `🍱 Đơn hàng: ${order.items || 'Chưa chọn món'}\n` +
           `📝 Ghi chú: ${order.note}\n` +
           `💰 Tổng cộng: ${displayTotal}\n` +
           `--------------------------\n` +
           `👉 Nhắn "Ok" để chốt đơn.\n` +
           `👉 Nhắn món mới nếu bạn muốn ghi đè đơn.\n` +
           `👉 Nhắn "Hủy" nếu muốn xóa thao tác này.`;
};

/**
 * --- XỬ LÝ TIN NHẮN CHÍNH ---
 */
bot.on('message', async (msg) => {
    const zaloId = String(msg.chat.id);
    const text = msg.text?.trim();
    const name = msg.from?.display_name || "bạn";

    if (!text || text.startsWith('/')) return;

    if (zaloId === ADMIN_ZALO_ID && msg.quote) {
        const quotedMsg = msg.quote.text || "";
        const targetIdMatch = quotedMsg.match(/🆔:\s*([a-zA-Z0-9.\-_]+)/);
        
        if (targetIdMatch) {
            const targetZaloId = targetIdMatch[1];
            await bot.sendMessage(targetZaloId, `💬 Phản hồi từ Shop: ${text}`);

            const phone = await getPhoneByZaloId(targetZaloId);
            const identifier = phone || targetZaloId;

            await db.collection('support_chats').doc(identifier).collection('messages').add({
                zaloId: targetZaloId,
                sender: 'ADMIN',
                text: text, 
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            return;
        }
    }

    try {
        const userPhone = await getPhoneByZaloId(zaloId);
        const chatIdentifier = userPhone || zaloId;

        const logQuery = await db.collection('learning_logs').where("zaloId", "==", zaloId).limit(1).get();
        const isFirstTime = logQuery.empty;

        await db.collection('learning_logs').add({ zaloId, text, name, timestamp: admin.firestore.FieldValue.serverTimestamp() });

        const sessionRef = db.collection('bot_sessions').doc(zaloId);
        const sessionSnap = await sessionRef.get();
        let session = sessionSnap.exists ? sessionSnap.data() : { state: null, pendingOrder: null, supportMode: false };
        const lowerText = text.toLowerCase();

        // ----------------------------------------------------------------
        // 0. NẾU LÀ KHÁCH HÀNG MỚI (LẦN ĐẦU NHẮN TIN)
        // ----------------------------------------------------------------
        if (isFirstTime) {
            if (sessionSnap.exists) await sessionRef.delete();
            await bot.sendMessage(zaloId, `🎉 Xin chào ${name}. Chào mừng bạn đến với Shop PlantG!\n\n👉 Nhắn "Menu" để xem thực đơn.\n👉 Nhắn SĐT (kèm dấu "." ở cuối, VD: 0987654321.) để Đăng nhập.\n👉 Nhắn "Viết tắt" để xem cách gọi món siêu tốc.`);
            await bot.sendMessage(zaloId, infoMsgText);
            return bot.sendMessage(zaloId, guideMsgText);
        }

        // ----------------------------------------------------------------
        // 1. LUỒNG XÁC NHẬN XÓA TÀI KHOẢN (RESET ALL)
        // ----------------------------------------------------------------
        if (session.state === 'WAITING_DELETE_ALL_CONFIRM') {
            if (lowerText === 'yes') {
                if (userPhone) {
                    await db.collection('users').doc(userPhone).delete(); 
                }
                await sessionRef.delete();
                await bot.sendMessage(zaloId, "✅ Toàn bộ thông tin tài khoản đã được xóa khỏi hệ thống!");
                return bot.sendMessage(zaloId, `Xin chào ${name}. Shop PlantG nghe ạ!\n\nBạn nhắn "Menu" để xem món, nhắn SĐT (kèm dấu "." ở cuối, VD: 0987654321.) để đăng nhập ngay hoặc nhắn "Thông tin" để hiển thị Menu Hỗ trợ nhé.`);
            } else if (lowerText === 'no') {
                await sessionRef.delete();
                return bot.sendMessage(zaloId, "❌ Đã hủy yêu cầu Xóa tài khoản toàn bộ.");
            } else {
                return bot.sendMessage(zaloId, "⚠️ Vui lòng nhắn YES để xác nhận Xóa toàn bộ, hoặc NO để hủy.");
            }
        }

        // ----------------------------------------------------------------
        // 2. LUỒNG XÁC NHẬN ĐĂNG XUẤT (RESET ĐĂNG NHẬP)
        // ----------------------------------------------------------------
        if (session.state === 'WAITING_LOGOUT_CONFIRM') {
            if (lowerText === 'yes') {
                if (userPhone) {
                    await db.collection('users').doc(userPhone).update({ zaloId: admin.firestore.FieldValue.delete() }); 
                }
                await sessionRef.delete();
                await bot.sendMessage(zaloId, "✅ Bạn đã Đăng xuất (Reset) thành công! Hiện tại bạn đang ở trạng thái khách vãng lai.");
                return bot.sendMessage(zaloId, `Xin chào ${name}. Shop PlantG nghe ạ! \n\nBạn nhắn "Menu" để xem món, nhắn SĐT (kèm dấu "." ở cuối, VD: 0987654321.) để đăng nhập lại hoặc nhắn "Thông tin" để hiển thị Menu Hỗ trợ nhé.`);
            } else if (lowerText === 'no') {
                await sessionRef.delete();
                return bot.sendMessage(zaloId, "❌ Đã hủy yêu cầu Đăng xuất.");
            } else {
                return bot.sendMessage(zaloId, "⚠️ Vui lòng nhắn YES để xác nhận Đăng xuất, hoặc NO để hủy.");
            }
        }

        // ----------------------------------------------------------------
        // 3. YÊU CẦU CUNG CẤP SĐT CHO HỖ TRỢ TRỰC TUYẾN
        // ----------------------------------------------------------------
        if (session.state === 'WAITING_PHONE_SUPPORT') {
            const phone = text.replace(/\D/g, '');
            if (phone.length < 10) return bot.sendMessage(zaloId, "⚠️ SĐT không hợp lệ. Vui lòng nhập lại số chính xác (Kèm dấu \".\" ở cuối để tránh lỗi Zalo nhận diện).");
            
            const userSnap = await db.collection('users').doc(phone).get();
            if (!userSnap.exists) {
                await db.collection('users').doc(phone).set({
                    fullName: name, 
                    zaloId, 
                    username: phone,
                    role: 'user',           
                    totalXu: 0,             
                    walletBalance: 0,       
                    lastUpdateSource: 'admin', 
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            } else {
                await db.collection('users').doc(phone).update({ zaloId });
            }

            session.state = null;
            session.supportMode = true;
            await sessionRef.set(session);
            
            await db.collection('support_chats').doc(phone).set({
                userPhone: phone,
                userName: name,
                zaloId: zaloId,
                unreadAdmin: true,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            return bot.sendMessage(zaloId, "✅ Đã đồng bộ tài khoản! Bộ phận hỗ trợ đã được kết nối, bạn cần Shop giúp gì ạ?");
        }

        // ----------------------------------------------------------------
        // 4. THOÁT CHẾ ĐỘ HỖ TRỢ (NGƯỜI DÙNG CHỦ ĐỘNG ĐÓNG)
        // ----------------------------------------------------------------
        if (session.supportMode && CLOSE_SUPPORT_KEYWORDS.some(k => lowerText.includes(k))) {
            session.supportMode = false;
            await sessionRef.set(session);
            return bot.sendMessage(zaloId, "✅ Đã đóng hộp thoại Hỗ trợ. Bạn đã trở về trạng thái nhận đơn Bình thường!");
        }

        // ----------------------------------------------------------------
        // 5. KÍCH HOẠT CHẾ ĐỘ HỖ TRỢ
        // ----------------------------------------------------------------
        let isSupportReq = SUPPORT_KEYWORDS.some(k => lowerText.includes(k));

        if (isSupportReq && !session.supportMode) {
            if (!userPhone) {
                session.state = 'WAITING_PHONE_SUPPORT';
                await sessionRef.set(session);
                return bot.sendMessage(zaloId, "🤖 Để Shop hỗ trợ và đồng bộ thông tin tốt nhất, bạn vui lòng cung cấp Số Điện Thoại nhé! (Kèm dấu \".\" ở cuối để tránh Zalo lỗi, VD: 0987654321.)");
            }
            session.supportMode = true;
            await sessionRef.set(session);
            await bot.sendMessage(zaloId, "🤖 Shop đã nhận được yêu cầu. Nhân viên sẽ hỗ trợ bạn ngay giây lát!");
            await bot.sendMessage(zaloId, "Bạn đã vào hộp thoại Hỗ trợ với Quán");
            return bot.sendMessage(zaloId, '⚠️ Lưu ý : Khách vui lòng nhắn "Đóng chat" để ngưng nhận Hỗ trợ và trở về trạng thái nhận đơn Bình thường!');
        }

        // ----------------------------------------------------------------
        // 6. CÁCH LY LOGIC KHI ĐANG HỖ TRỢ
        // ----------------------------------------------------------------
        if (session.supportMode && userPhone) {
            await db.collection('support_chats').doc(userPhone).set({
                userPhone: userPhone,
                userName: name,
                zaloId: zaloId,
                unreadAdmin: true,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            await db.collection('support_chats').doc(userPhone).collection('messages').add({
                zaloId,
                sender: 'USER',
                text: text, 
                name: name,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            return; 
        }

        // ----------------------------------------------------------------
        // 7. ĐĂNG NHẬP BẰNG SĐT (Chặn chữ cái để không trùng lặp lệnh)
        // ----------------------------------------------------------------
        if (!session.state && !session.supportMode) {
            const cleanPhone = text.replace(/\D/g, '');
            // Ràng buộc: Đoạn tin nhắn không chứa chữ cái nào, và sau khi bỏ ký tự đặc biệt thì còn lại đúng 10 số
            if (!/[\p{L}]/u.test(text) && /^(0\d{9}|\d{10})$/.test(cleanPhone)) {
                const userSnap = await db.collection('users').doc(cleanPhone).get();
                if (userSnap.exists) {
                    const userData = userSnap.data();
                    await db.collection('users').doc(cleanPhone).update({ zaloId: zaloId });
                    
                    const rankName = getUserRank(userData);
                    await bot.sendMessage(zaloId, "✅ Bạn đã đăng nhập thành công!");
                    await bot.sendMessage(zaloId, `🎉 Chào mừng ${userData.fullName || name} quay trở lại! Hạng hiện tại của bạn là: ${rankName}`);
                    return bot.sendMessage(zaloId, infoMsgText);
                }
            }
        }

        // ----------------------------------------------------------------
        // B. LỆNH ĐIỀU HƯỚNG CƠ BẢN (CHỈ CHẠY KHI KHÔNG Ở CHẾ ĐỘ HỖ TRỢ)
        // ----------------------------------------------------------------

        const isDeleteAll = DELETE_ALL_KEYWORDS.some(k => lowerText.includes(k));
        const isLogout = !isDeleteAll && LOGOUT_KEYWORDS.some(k => lowerText.includes(k));

        if (isDeleteAll) {
            session.state = 'WAITING_DELETE_ALL_CONFIRM';
            await sessionRef.set(session);
            return bot.sendMessage(zaloId, "⚠️ THÔNG BÁO: Bạn đang yêu cầu Xóa toàn bộ thông tin tài khoản.\n👉 Hãy nhắn \"YES\" để xác nhận hoặc \"NO\" để hủy yêu cầu.\n\nSau khi xác nhận, thông tin của bạn sẽ KHÔNG CÒN lưu trên hệ thống!");
        }

        if (isLogout) {
            session.state = 'WAITING_LOGOUT_CONFIRM';
            await sessionRef.set(session);
            return bot.sendMessage(zaloId, "⚠️ THÔNG BÁO: Bạn đang yêu cầu Đăng xuất (Gỡ liên kết SĐT khỏi Zalo này).\n👉 Hãy nhắn \"YES\" để xác nhận hoặc \"NO\" để hủy yêu cầu.");
        }

        if (INFO_KEYWORDS.some(k => lowerText.includes(k))) {
            return bot.sendMessage(zaloId, infoMsgText);
        }

        if (GUIDE_KEYWORDS.some(k => lowerText.includes(k))) {
            return bot.sendMessage(zaloId, guideMsgText);
        }

        if (SHORTCUT_KEYWORDS.some(k => lowerText.includes(k))) {
            return bot.sendMessage(zaloId, shortcutMsgText);
        }

        if (BALANCE_KEYWORDS.some(k => lowerText.includes(k))) {
            if (userPhone) {
                const uSnap = await db.collection('users').doc(userPhone).get();
                if (uSnap.exists) {
                    const uData = uSnap.data();
                    const wallet = uData.walletBalance ? uData.walletBalance.toLocaleString() : '0';
                    const xu = uData.totalXu ? uData.totalXu.toLocaleString() : '0';
                    return bot.sendMessage(zaloId, `💳 THÔNG TIN TÀI KHOẢN\n👤 Khách hàng: ${name}\n📞 SĐT: ${userPhone}\n------------------\n💰 Số dư ví: ${wallet}đ\n🪙 Số Xu: ${xu} Xu`);
                }
            }
            return bot.sendMessage(zaloId, "⚠️ Bạn chưa có thông tin trên hệ thống. Hãy bắt đầu bằng cách đặt 1 đơn hàng nhé!");
        }

        if (HISTORY_KEYWORDS.some(k => lowerText.includes(k))) {
            if (userPhone) {
                const ordersSnap = await db.collection('orders')
                    .where('phone', '==', userPhone)
                    .orderBy('createdAt', 'desc')
                    .limit(3)
                    .get();
                if (ordersSnap.empty) {
                    return bot.sendMessage(zaloId, "📭 Bạn chưa có đơn hàng nào.");
                }
                let histMsg = "🕒 LỊCH SỬ 3 ĐƠN GẦN NHẤT:\n--------------------------\n";
                ordersSnap.forEach(doc => {
                    const o = doc.data();
                    const statusMap = { 'PENDING': '🕒 Chờ xác nhận', 'PREPARING': '👨‍🍳 Đang chuẩn bị', 'DELIVERING': '🚚 Đang giao', 'COMPLETED': '✅ Đã xong', 'CANCELLED': '❌ Đã hủy' };
                    histMsg += `🆔 #${doc.id.slice(-6).toUpperCase()} | 💰 ${o.total}\n🍱 Món: ${o.items}\n🔔 Trạng thái: ${statusMap[o.status] || o.status}\n\n`;
                });
                return bot.sendMessage(zaloId, histMsg.trim());
            }
            return bot.sendMessage(zaloId, "⚠️ Bạn chưa có thông tin trên hệ thống.");
        }

        const isReorder = REORDER_KEYWORDS.some(k => lowerText.includes(k));
        if (isReorder) {
            if (!userPhone) return bot.sendMessage(zaloId, "⚠️ Bạn chưa đăng nhập. Vui lòng nhắn SĐT (kèm dấu \".\" ở cuối) để đăng nhập và xem lịch sử đơn hàng.");
            
            let orderIndex = 0; 
            const indexMatch = lowerText.match(/đơn (\d+)/i) || lowerText.match(/don (\d+)/i);
            if (indexMatch && parseInt(indexMatch[1]) > 0) {
                orderIndex = parseInt(indexMatch[1]) - 1;
            }

            const ordersSnap = await db.collection('orders')
                .where('phone', '==', userPhone)
                .orderBy('createdAt', 'desc')
                .limit(3)
                .get();

            if (ordersSnap.empty) {
                return bot.sendMessage(zaloId, "📭 Bạn chưa có đơn hàng nào để đặt lại.");
            }

            const ordersList = [];
            ordersSnap.forEach(doc => ordersList.push(doc.data()));

            if (orderIndex >= ordersList.length) {
                return bot.sendMessage(zaloId, `⚠️ Bạn chỉ có ${ordersList.length} đơn hàng gần đây. Vui lòng chọn lại.`);
            }

            const orderToReorder = ordersList[orderIndex];
            
            const numTotal = parseInt(String(orderToReorder.total).replace(/\D/g, '')) || 0;
            
            session.pendingOrder = { 
                customer: orderToReorder.customer || name, 
                items: orderToReorder.items, 
                total: numTotal > 0 ? numTotal : "Thanh toán sau", 
                note: orderToReorder.note || '', 
                phone: userPhone, 
                address: orderToReorder.address,
                zaloId 
            };
            session.state = 'WAITING_CONFIRM';
            await sessionRef.set(session);
            
            const displayTotal = orderToReorder.total;
            const reorderMsg = `❓ Bạn có muốn đặt lại đơn hàng này không?\n\n` +
                               `🍱 Món ăn: ${orderToReorder.items}\n` +
                               `📝 Ghi chú: ${orderToReorder.note || "Không"}\n` +
                               `💰 Tổng cộng: ${displayTotal}\n` +
                               `📍 Địa chỉ: ${orderToReorder.address}\n\n` +
                               `👉 Nhắn "Ok" để chốt đặt ngay.\n` +
                               `👉 Nhắn món mới nếu bạn muốn đổi sang món khác.`;
            return bot.sendMessage(zaloId, reorderMsg);
        }

        if (CANCEL_KEYWORDS.some(k => lowerText.includes(k))) {
            await sessionRef.delete();
            return bot.sendMessage(zaloId, "🚫 Đã hủy đơn hàng đang tạo. Bạn có thể nhắn lại món mới để BOT ghi nhận thay thế nhé!");
        }

        if (MENU_KEYWORDS.some(k => lowerText.includes(k))) {
            const menuMsg = `🍱 THỰC ĐƠN SHOP PLANTG\n--------------------------\n1. Cơm tấm sườn: 35.000đ\n2. Cơm tấm sườn trứng: 35.000đ\n3. Cơm thêm: 5.000đ\n4. Sườn thêm: 10.000đ\n5. Trứng thêm: 5.000đ\n6. Các món ăn kèm thêm: Miễn phí (Có giới hạn)\n--------------------------\n👉 Nhắn món bạn muốn đặt ngay nhé!\n *Hãy ghi cụ thể tên món bạn muốn đặt kèm số lượng để BOT hiểu ngay nhé <3 Cám ơn Khách yêu ạ!.*`;
            return bot.sendMessage(zaloId, menuMsg);
        }

        if (CHANGE_INFO_KEYWORDS.some(k => lowerText.includes(k))) {
            session.state = 'WAITING_PHONE';
            await sessionRef.set(session);
            return bot.sendMessage(zaloId, "📝 Vui lòng nhập Số điện thoại mới để quán cập nhật. (Nên thêm dấu \".\" ở cuối SĐT, VD: 0987654321.)");
        }

        if (PAYMENT_BANK_KEYWORDS.some(k => lowerText.includes(k))) {
            await bot.sendMessage(zaloId, "💳 Bạn vui lòng chuyển khoản qua STK: Ngân hàng TPBank 00006464313 - PHẠM ĐỨC THUẬN");
            return bot.sendMessage(zaloId, "🔗 Hoặc quét mã QR tại đây: https://img.vietqr.io/image/TPB-00006464313-qr_only.png");
        }

        if (PAYMENT_CASH_KEYWORDS.some(k => lowerText.includes(k))) {
            return bot.sendMessage(zaloId, "💵 Đã ghi nhận hình thức thanh toán Tiền mặt (COD).");
        }

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
                return bot.sendMessage(zaloId, `🤖 Nhận đơn: ${detected.items}. Cho quán xin SĐT nhé! (Thêm dấu "." ở cuối SĐT để tránh lỗi, VD: 0987654321.)`);
            }
        }

        if (session.state === 'WAITING_PHONE') {
            const phone = text.replace(/\D/g, '');
            if (phone.length < 10) return bot.sendMessage(zaloId, "⚠️ SĐT không hợp lệ. Vui lòng nhập lại chính xác (Kèm dấu \".\" ở cuối).");
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
                fullName: name, 
                address: text, 
                zaloId, 
                username: session.pendingOrder.phone,
                role: 'user',           
                totalXu: 0,             
                walletBalance: 0,       
                lastUpdateSource: 'admin', 
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            
            await sessionRef.set(session);
            return bot.sendMessage(zaloId, formatConfirmMsg(session.pendingOrder));
        }

        if (lowerText === 'ok' && session.state === 'WAITING_CONFIRM') {
            const order = session.pendingOrder;
            const dbTotal = order.total === "Thanh toán sau" ? "Thanh toán sau" : order.total.toLocaleString() + 'đ';
            
            const docRef = await db.collection('orders').add({
                ...order, 
                status: 'PENDING', 
                paymentMethod: 'CASH',          
                paymentStatus: 'UNPAID',        
                deliveryType: 'ASAP',           
                total: dbTotal, 
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            await sessionRef.delete();
            
            const finalMsg = `✅ ĐÃ CHỐT ĐƠN (#${docRef.id.slice(-6).toUpperCase()})\n🍱 Món: ${order.items}\n📍 Giao: ${order.address}\n🔔 Trạng thái: 🕒 Chờ xác nhận`;
            bot.sendMessage(zaloId, finalMsg);
            if (ADMIN_ZALO_ID) bot.sendMessage(ADMIN_ZALO_ID, `🔔 ĐƠN MỚI\n🆔: ${zaloId}\n👤 Khách: ${order.customer}\n🍱 Đơn: ${order.items}\n📝 Note: ${order.note}`);
            return;
        }

        if (GREETING_KEYWORDS.some(k => lowerText.includes(k))) {
            await sessionRef.delete();
            await bot.sendMessage(zaloId, `Xin chào ${name}. Shop PlantG nghe ạ! \n\n👉 Nhắn "Menu" để xem món.\n👉 Nhắn SĐT (kèm dấu "." ở cuối, VD: 0987654321.) để Đăng nhập.\n👉 Nhắn "Hướng dẫn" hoặc "Viết tắt" để xem cách dùng BOT nhanh nhất!`);
            return bot.sendMessage(zaloId, infoMsgText);
        }

    } catch (error) { console.error("❌ Lỗi:", error); }
});

/**
 * --- THÔNG BÁO TRẠNG THÁI TỪ WEB/HỆ THỐNG VỀ ZALO ---
 */

db.collection('orders').onSnapshot((snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
        const order = change.doc.data();
        if (change.type === "modified" && order.zaloId) {
            
            if (order.status === 'COMPLETED' && !order.xuRewarded) {
                try {
                    await db.runTransaction(async (t) => {
                        const orderRef = change.doc.ref;
                        const orderSnap = await t.get(orderRef);
                        if (!orderSnap.exists) return;
                        
                        const currentOrder = orderSnap.data();
                        
                        if (currentOrder.xuRewarded) return;
                        
                        const numTotal = parseInt(String(currentOrder.total).replace(/\D/g, ''));
                        let rewardXu = 0;
                        if (!isNaN(numTotal) && numTotal > 0) {
                            rewardXu = Math.floor(numTotal / 1000) * 10;
                        }

                        t.update(orderRef, { xuRewarded: true });
                        
                        if (rewardXu > 0 && currentOrder.phone) {
                            const userRef = db.collection('users').doc(currentOrder.phone);
                            t.update(userRef, {
                                totalXu: admin.firestore.FieldValue.increment(rewardXu),
                                lastUpdateSource: 'order_payment',
                                updatedAt: admin.firestore.FieldValue.serverTimestamp()
                            });
                            
                            const orderId = change.doc.id.slice(-6).toUpperCase();
                            const msg = `🔔 Cập nhật đơn #${orderId}: [✅ Đã xong]\n🎉 Đơn hàng #${orderId} đã Hoàn thành. Bạn đã được cộng: ${rewardXu} Xu vào tài khoản.`;
                            bot.sendMessage(currentOrder.zaloId, msg);
                        } else {
                            bot.sendMessage(currentOrder.zaloId, `🔔 Cập nhật đơn #${change.doc.id.slice(-6).toUpperCase()}: [✅ Đã xong]`);
                        }
                    });
                } catch (e) {
                    console.error("Lỗi transaction cộng xu ZaloBot:", e);
                }
            } 
            else if (order.status !== 'COMPLETED') {
                const statusMap = { 'PREPARING': '👨‍🍳 Đang chuẩn bị', 'DELIVERING': '🚚 Đang giao', 'CANCELLED': '❌ Đã hủy' };
                if (statusMap[order.status]) {
                    bot.sendMessage(order.zaloId, `🔔 Cập nhật đơn #${change.doc.id.slice(-6).toUpperCase()}: [${statusMap[order.status]}]`);
                }
            }
        }
    });
});

db.collection('support_chats').onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
        const data = change.doc.data();
        const phone = change.doc.id;
        let zaloId = data.zaloId;

        if (data.isClosed === true) {
            setTimeout(async () => {
                try {
                    if (!zaloId) {
                        const userSnap = await db.collection('users').doc(phone).get();
                        if (userSnap.exists) zaloId = userSnap.data().zaloId;
                    }
                    if (zaloId) {
                        const sessionRef = db.collection('bot_sessions').doc(zaloId);
                        const sessionSnap = await sessionRef.get();
                        
                        if (sessionSnap.exists && sessionSnap.data().supportMode) {
                            await sessionRef.update({ supportMode: false });
                            await bot.sendMessage(zaloId, "✅ Đã đóng hộp thoại Hỗ trợ. Bạn đã trở về trạng thái nhận đơn Bình thường!");
                        }
                    }
                    await change.doc.ref.update({ isClosed: admin.firestore.FieldValue.delete() });
                } catch (err) {
                    console.error("Lỗi xử lý đóng chat Zalo:", err);
                }
            }, 500);
        }

        if ((change.type === 'added' || change.type === 'modified') && data.unreadUser === true) {
            setTimeout(async () => {
                try {
                    if (!zaloId) {
                        const userSnap = await db.collection('users').doc(phone).get();
                        if (userSnap.exists) zaloId = userSnap.data().zaloId;
                    }
                    
                    if (zaloId) {
                        const userMsgsSnap = await db.collection('support_chats').doc(phone).collection('messages')
                            .where('sender', '==', 'USER')
                            .orderBy('createdAt', 'desc')
                            .limit(1)
                            .get();
                            
                        let lastUserTime = 0;
                        if (!userMsgsSnap.empty) {
                            const uData = userMsgsSnap.docs[0].data();
                            lastUserTime = uData.createdAt ? uData.createdAt.toMillis() : 0;
                        }

                        const msgsSnap = await db.collection('support_chats').doc(phone).collection('messages')
                            .where('sender', '==', 'ADMIN')
                            .orderBy('createdAt', 'desc')
                            .limit(5)
                            .get();
                            
                        if (!msgsSnap.empty) {
                            const batch = db.batch();
                            let sent = false;
                            const expectedFlag = `ok_${zaloId}`;
                            
                            const msgs = msgsSnap.docs.map(d => d).reverse();
                            
                            for (let msgDoc of msgs) {
                                const msgData = msgDoc.data();
                                const adminTime = msgData.createdAt ? msgData.createdAt.toMillis() : Date.now();
                                
                                if (adminTime >= lastUserTime && msgData.sendzaloId !== expectedFlag) {
                                    await bot.sendMessage(zaloId, `💬 Phản hồi từ Shop: ${msgData.text || msgData.message}`);
                                    batch.update(msgDoc.ref, { sendzaloId: expectedFlag });
                                    sent = true;
                                }
                            }
                            
                            if (sent) {
                                batch.update(change.doc.ref, { unreadUser: false });
                                await batch.commit();
                            }
                        }
                    }
                } catch (err) {
                    console.error("Lỗi đồng bộ phản hồi Admin:", err);
                }
            }, 1000); 
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