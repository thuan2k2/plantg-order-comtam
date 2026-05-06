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
    MAIN: [
        { keywords: ['sườn trứng', 'suon trung', 'đầy đủ', 'cơm sườn trứng', 's trứng', 'st', 'com st', 'cơm st',], name: 'Cơm tấm sườn trứng', price: 35000 },
        { keywords: ['cơm sườn', 'com suon', 'cơm tấm sườn', 'sườn chả', 'sườn nướng', 'sườn', 'suon', 's'], name: 'Cơm tấm sườn', price: 35000 },
        { keywords: ['phần cơm', 'p cơm', 'hộp cơm', 'cơm tấm', 'phần', 'hộp', 'suất', 'cơm'], name: 'Cơm tấm sườn trứng', price: 35000 } 
    ],
    SIDES: [
        { keywords: ['cơm thêm', 'thêm cơm'], name: 'Cơm thêm', price: 5000 },
        { keywords: ['sườn thêm', 'miếng sườn', 'thêm sườn'], name: 'Sườn thêm', price: 10000 },
        { keywords: ['trứng thêm', 'thêm trứng'], name: 'Trứng thêm', price: 5000 },
        { keywords: ['canh thêm', 'thêm canh'], name: 'Canh thêm', price: 0 },
        { keywords: ['cà chua thêm', 'ca chua them'], name: 'Cà chua thêm', price: 0 },
        { keywords: ['dưa chua thêm', 'dua chua them', 'đồ chua thêm'], name: 'Dưa chua thêm', price: 0 },
        { keywords: ['dưa leo thêm', 'dua leo them', 'thêm dưa chuột'], name: 'Dưa leo thêm', price: 0 },
        { keywords: ['nước mắm thêm', 'nuoc mam them', 'mắm thêm', 'thêm mắm'], name: 'Nước mắm thêm', price: 0 }
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
const ORDER_INTENT_KEYWORDS = ['đặt', 'cho', 'mua', 'ship', 'giao', 'lấy', 'order'];
const CLOSE_SUPPORT_KEYWORDS = ['đóng chat', 'dong chat', 'đóng hỗ trợ', 'dong ho tro', 'kết thúc', 'ket thuc'];

const app = express();
app.use(express.json());
const bot = new ZaloBot(process.env.BOT_TOKEN, { polling: false });
const ADMIN_ZALO_ID = String(process.env.ZALO_BOT_ADMIN_ID || 'a65dc2194697d372478').trim();

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

const advancedParse = (text) => {
    let items = [];
    let total = 0;
    let foundMain = false;
    let hasValidItem = false;
    
    let lowerText = text.toLowerCase().trim();
    lowerText = lowerText.replace(/(\d+)([a-zA-Zà-ỹ]+)/g, '$1 $2');
    
    let primaryQty = 1; 
    
    const qtyMatch = lowerText.match(/(?:^|\s)(\d{1,2})\s*(p|phần|hộp|suất|cơm|c)?(?:$|\s)/);
    if (qtyMatch) {
        primaryQty = parseInt(qtyMatch[1]);
        if(primaryQty > 50) primaryQty = 1; 
    }

    for (const main of MENU.MAIN) {
        if (main.keywords.some(k => new RegExp(`(^|\\s)${k}($|\\s)`).test(lowerText))) {
            items.push(`${primaryQty}x ${main.name}`);
            total += main.price * primaryQty;
            foundMain = true;
            hasValidItem = true;
            break; 
        }
    }

    if (!foundMain && qtyMatch && qtyMatch[2]) {
        items.push(`${primaryQty}x Cơm tấm sườn trứng`);
        total += 35000 * primaryQty;
        hasValidItem = true;
    }

    MENU.SIDES.forEach(side => {
        const sideKeywordsRegex = new RegExp(`(?:^|\\s)(\\d{1,2})?\\s*(${side.keywords.join('|')})(?:$|\\s)`, 'i');
        const match = lowerText.match(sideKeywordsRegex);
        if (match) {
            let qty = match[1] ? parseInt(match[1]) : 1;
            if(qty > 50) qty = 1; 
            items.push(`${qty}x ${side.name}`);
            total += side.price * qty;
            hasValidItem = true;
        }
    });

    if (!hasValidItem) {
        const hasOrderIntent = ORDER_INTENT_KEYWORDS.some(k => new RegExp(`(^|\\s)${k}($|\\s)`).test(lowerText));
        const isJustShortNumber = /^\s*\d{1,2}\s*$/.test(lowerText); 
        const hasNumberWithUnit = qtyMatch && qtyMatch[2];

        if (hasOrderIntent || isJustShortNumber || hasNumberWithUnit) {
            return { items: "Giống Ghi chú", total: "Thanh toán sau", note: text };
        }
        return { items: null }; 
    }

    return { items: items.join(', '), total, note: text };
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
           `👉 Nhắn "Hủy" nếu muốn xóa thao tác này.\n` +
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

    // A. XỬ LÝ ADMIN REPLY
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

        await db.collection('learning_logs').add({ zaloId, text, name, timestamp: admin.firestore.FieldValue.serverTimestamp() });

        const sessionRef = db.collection('bot_sessions').doc(zaloId);
        const sessionSnap = await sessionRef.get();
        let session = sessionSnap.exists ? sessionSnap.data() : { state: null, pendingOrder: null, supportMode: false };
        const lowerText = text.toLowerCase();

        // ----------------------------------------------------------------
        // 1. LUỒNG XÁC NHẬN RESET TÀI KHOẢN
        // ----------------------------------------------------------------
        if (session.state === 'WAITING_RESET_CONFIRM') {
            if (lowerText === 'yes') {
                if (userPhone) {
                    await db.collection('users').doc(userPhone).delete(); 
                }
                await sessionRef.delete();
                await bot.sendMessage(zaloId, "✅ Toàn bộ thông tin đã được xóa khỏi hệ thống!");
                return bot.sendMessage(zaloId, `Xin chào ${name}. Shop PlantG nghe ạ! Bạn nhắn "Menu" để xem món nhé.`);
            } else if (lowerText === 'no') {
                await sessionRef.delete();
                return bot.sendMessage(zaloId, "❌ Đã hủy yêu cầu xóa tài khoản.");
            } else {
                return bot.sendMessage(zaloId, "⚠️ Vui lòng nhắn YES để xác nhận xóa, hoặc NO để hủy.");
            }
        }

        // ----------------------------------------------------------------
        // 2. YÊU CẦU CUNG CẤP SĐT CHO HỖ TRỢ TRỰC TUYẾN
        // ----------------------------------------------------------------
        if (session.state === 'WAITING_PHONE_SUPPORT') {
            const phone = text.replace(/\D/g, '');
            if (phone.length < 10) return bot.sendMessage(zaloId, "⚠️ SĐT không hợp lệ. Vui lòng nhập lại số chính xác.");
            
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
        // 3. THOÁT CHẾ ĐỘ HỖ TRỢ (NGƯỜI DÙNG CHỦ ĐỘNG ĐÓNG)
        // ----------------------------------------------------------------
        if (session.supportMode && CLOSE_SUPPORT_KEYWORDS.some(k => lowerText.includes(k))) {
            session.supportMode = false;
            await sessionRef.set(session);
            return bot.sendMessage(zaloId, "✅ Đã đóng hộp thoại Hỗ trợ. Bạn đã trở về trạng thái nhận đơn Bình thường!");
        }

        // ----------------------------------------------------------------
        // 4. KÍCH HOẠT CHẾ ĐỘ HỖ TRỢ
        // ----------------------------------------------------------------
        let isSupportReq = SUPPORT_KEYWORDS.some(k => lowerText.includes(k));

        if (isSupportReq && !session.supportMode) {
            if (!userPhone) {
                session.state = 'WAITING_PHONE_SUPPORT';
                await sessionRef.set(session);
                return bot.sendMessage(zaloId, "🤖 Để Shop hỗ trợ và đồng bộ thông tin tốt nhất, bạn vui lòng cung cấp Số Điện Thoại nhé!");
            }
            session.supportMode = true;
            await sessionRef.set(session);
            await bot.sendMessage(zaloId, "🤖 Shop đã nhận được yêu cầu. Nhân viên sẽ hỗ trợ bạn ngay giây lát!");
            await bot.sendMessage(zaloId, "Bạn đã vào hộp thoại Hỗ trợ với Quán");
            return bot.sendMessage(zaloId, 'Lưu ý : Khách vui lòng nhắn "Đóng chat" để ngưng nhận Hỗ trợ và trở về trạng thái nhận đơn Bình thường!');
        }

        // ----------------------------------------------------------------
        // 5. CÁCH LY LOGIC KHI ĐANG HỖ TRỢ (QUAN TRỌNG)
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
            
            // Return ngay tại đây. Các lệnh Đặt Hàng, Menu phía dưới SẼ BỊ BỎ QUA hoàn toàn.
            return; 
        }

        // ----------------------------------------------------------------
        // B. LỆNH ĐIỀU HƯỚNG CƠ BẢN (CHỈ CHẠY KHI KHÔNG Ở CHẾ ĐỘ HỖ TRỢ)
        // ----------------------------------------------------------------
        if (RESET_KEYWORDS.some(k => lowerText.includes(k))) {
            session.state = 'WAITING_RESET_CONFIRM';
            await sessionRef.set(session);
            return bot.sendMessage(zaloId, "⚠️ THÔNG BÁO: Bạn đang yêu cầu Xóa toàn bộ thông tin tài khoản.\n👉 Hãy nhắn \"YES\" để xác nhận hoặc \"NO\" để hủy yêu cầu Reset.\n\nSau khi xác nhận, thông tin của bạn sẽ KHÔNG CÒN lưu trên hệ thống!");
        }

        if (CANCEL_KEYWORDS.some(k => lowerText.includes(k))) {
            await sessionRef.delete();
            return bot.sendMessage(zaloId, "🚫 Đã hủy các thao tác đặt hàng trước đó. Bạn có thể bắt đầu lại từ đầu.");
        }

        if (MENU_KEYWORDS.some(k => lowerText.includes(k))) {
            const menuMsg = `🍱 THỰC ĐƠN SHOP PLANTG\n--------------------------\n1. ${MENU.MAIN[0].name}: ${MENU.MAIN[0].price.toLocaleString()}đ\n2. Cơm thêm: 5.000đ\n3. Sườn thêm: 10.000đ\n4. Trứng thêm: 5.000đ\n--------------------------\n👉 Nhắn món bạn muốn đặt ngay nhé!`;
            return bot.sendMessage(zaloId, menuMsg);
        }

        if (CHANGE_INFO_KEYWORDS.some(k => lowerText.includes(k))) {
            session.state = 'WAITING_PHONE';
            await sessionRef.set(session);
            return bot.sendMessage(zaloId, "📝 Vui lòng nhập Số điện thoại mới để quán cập nhật.");
        }

        // C. THANH TOÁN
        if (PAYMENT_BANK_KEYWORDS.some(k => lowerText.includes(k))) {
            await bot.sendMessage(zaloId, "💳 Bạn vui lòng chuyển khoản qua STK: Ngân hàng TPBank 00006464313 - PHẠM ĐỨC THUẬN");
            return bot.sendMessage(zaloId, "🔗 Hoặc quét mã QR tại đây: https://img.vietqr.io/image/TPB-00006464313-qr_only.png");
        }

        if (PAYMENT_CASH_KEYWORDS.some(k => lowerText.includes(k))) {
            return bot.sendMessage(zaloId, "💵 Đã ghi nhận hình thức thanh toán Tiền mặt (COD).");
        }

        // E. NHẬN DIỆN ĐƠN HÀNG THÔNG MINH
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

        // F. LUỒNG NHẬP LIỆU ĐƠN HÀNG
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

        // CHỐT ĐƠN VÀ LƯU DATABASE
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

        // LỜI CHÀO
        if (GREETING_KEYWORDS.some(k => lowerText.includes(k))) {
            await sessionRef.delete();
            return bot.sendMessage(zaloId, `Xin chào ${name}. Shop PlantG nghe ạ! Bạn nhắn "Menu" để xem món nhé.`);
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
            const statusMap = { 'PREPARING': '👨‍🍳 Đang chuẩn bị', 'DELIVERING': '🚚 Đang giao', 'COMPLETED': '✅ Đã xong', 'CANCELLED': '❌ Đã hủy' };
            if (statusMap[order.status]) {
                bot.sendMessage(order.zaloId, `🔔 Cập nhật đơn #${change.doc.id.slice(-6).toUpperCase()}: [${statusMap[order.status]}]`);
            }
        }
    });
});

// ĐỒNG BỘ TIN NHẮN TỪ ADMIN WEB -> ZALO BẰNG createdAt VÀ sendzaloId
db.collection('support_chats').onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
        const data = change.doc.data();
        
        if ((change.type === 'added' || change.type === 'modified') && data.unreadUser === true) {
            const phone = change.doc.id;
            let zaloId = data.zaloId;
            
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