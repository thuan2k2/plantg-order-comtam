import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, increment, collection, addDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { db } from '../firebase/config';

// Hàm Ghi Log An Toàn (Đảm bảo lỗi Log không làm sập giao dịch đổi thưởng)
const safeLogAdmin = async (logData) => {
  try {
    await addDoc(collection(db, 'admin_logs'), { ...logData, createdAt: serverTimestamp() });
  } catch (error) {
    console.warn("Cảnh báo: Không thể ghi log nhưng giao dịch đổi voucher đã hoàn tất thành công", error);
  }
};

const RewardCenter = () => {
  const navigate = useNavigate();
  const [customerInfo, setCustomerInfo] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Lấy SĐT từ localStorage (Định danh duy nhất)
  const savedPhones = JSON.parse(localStorage.getItem('recentPhones') || '[]');
  const phone = savedPhones[0];

  // Danh sách quà tặng
  const rewards = [
    { id: 'R1', name: 'Voucher 5.000đ', cost: 5000, value: 5000, type: 'CASH', icon: '🎟️' },
    { id: 'R2', name: 'Voucher 10.000đ', cost: 9500, value: 10000, type: 'CASH', icon: '🧧' },
    { id: 'R3', name: 'Miễn phí vận chuyển', cost: 3000, value: 5000, type: 'FREESHIP', icon: '🚚' },
    { id: 'R4', name: 'Voucher 20.000đ', cost: 18000, value: 20000, type: 'CASH', icon: '💎' },
  ];

  useEffect(() => {
    if (!phone) {
      navigate('/');
      return;
    }

    // ĐỒNG BỘ REAL-TIME: Lắng nghe theo ID Document là Số điện thoại
    const userRef = doc(db, 'users', phone.trim());
    const unsub = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        setCustomerInfo({ id: snap.id, ...snap.data() });
      } else {
        console.error("Không tìm thấy dữ liệu người dùng trên Cloud.");
      }
    }, (error) => {
      console.error("Lỗi lắng nghe dữ liệu Xu:", error);
    });

    return () => unsub();
  }, [phone, navigate]);

  const handleExchange = async (reward) => {
    if (isProcessing) return;

    // Kiểm tra nhanh tại client
    const currentXu = customerInfo?.totalXu || 0;
    if (currentXu < reward.cost) {
      alert("Số dư Xu không đủ để thực hiện đổi quà này!");
      return;
    }

    if (window.confirm(`Xác nhận dùng ${reward.cost.toLocaleString()} Xu để đổi lấy ${reward.name}?`)) {
      setIsProcessing(true);
      let pendingLog = null; // Biến tạm lưu thông tin log
      
      try {
        const userRef = doc(db, 'users', phone.trim());
        const voucherRef = doc(collection(db, 'vouchers'));

        // SỬ DỤNG TRANSACTION: Đảm bảo trừ xu thành công thì mới sinh ra Voucher
        await runTransaction(db, async (transaction) => {
          const userDoc = await transaction.get(userRef);
          if (!userDoc.exists()) throw "Người dùng không tồn tại!";

          const totalXu = userDoc.data().totalXu || 0;
          if (totalXu < reward.cost) throw "Số dư Xu đã thay đổi, không đủ để đổi quà!";

          // 1. Trừ Xu của User
          transaction.update(userRef, {
            totalXu: increment(-reward.cost),
            updatedAt: serverTimestamp()
          });

          // 2. Tạo Voucher mới gán cho SĐT này
          const voucherCode = `DOI-${Math.random().toString(36).toUpperCase().slice(2, 7)}`;
          transaction.set(voucherRef, {
            code: voucherCode,
            value: reward.value,
            type: reward.type,
            assignedPhone: phone.trim(),
            usageLimit: 1,
            createdAt: serverTimestamp(),
            description: `Đổi từ ${reward.cost.toLocaleString()} Xu`
          });

          // Chuẩn bị Dữ liệu Ghi Log (Sẽ gọi sau khi transaction kết thúc an toàn)
          pendingLog = {
            type: 'BALANCE',
            source: 'exchange_voucher',
            targetPhone: phone.trim(),
            assetType: 'xu',
            walletChange: -reward.cost,
            walletBalance: totalXu - reward.cost,
            reason: `Đổi Xu lấy Voucher: ${reward.name}`
          };
        });

        // NẾU TRANSACTION THÀNH CÔNG -> GHI LOG
        if (pendingLog) {
          safeLogAdmin(pendingLog);
        }

        alert(`🎉 Đổi quà thành công! Mã Voucher của bạn là: DOI-... (Kiểm tra trong Kho mã khi đặt hàng)`);
      } catch (error) {
        console.error("Lỗi đổi quà:", error);
        alert(typeof error === 'string' ? error : "Có lỗi xảy ra trong quá trình giao dịch.");
      } finally {
        setIsProcessing(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-orange-50/50 dark:bg-gray-900 font-sans pb-10 transition-colors duration-300">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 px-6 py-5 flex items-center shadow-sm sticky top-0 z-30 border-b dark:border-gray-700">
        <button onClick={() => navigate(-1)} className="p-2 bg-gray-50 dark:bg-gray-700 rounded-2xl mr-4 active:scale-90 transition-all">
           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="text-lg font-black uppercase tracking-tighter text-gray-800 dark:text-white">Đổi quà tích điểm</h1>
      </div>

      <div className="p-6 max-w-md mx-auto">
        {/* Card Số dư Xu */}
        <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-orange-200 dark:shadow-none mb-8 relative overflow-hidden animate-in fade-in zoom-in duration-500">
          <div className="absolute top-[-20%] right-[-10%] text-9xl opacity-10 rotate-12 select-none">🪙</div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80">Số dư Xu hiện có</p>
          <div className="flex items-end gap-2 mt-2">
            <h2 className="text-5xl font-black tracking-tighter">{(customerInfo?.totalXu || 0).toLocaleString()}</h2>
            <span className="text-sm font-bold mb-2 opacity-80 uppercase">Xu</span>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <p className="text-[9px] font-black bg-white/20 px-3 py-1.5 rounded-full backdrop-blur-md uppercase tracking-wider">
              1,000đ = 10 Xu
            </p>
            <p className="text-[9px] font-black bg-black/10 px-3 py-1.5 rounded-full backdrop-blur-md uppercase tracking-wider">
              Hạng: {customerInfo?.role === 'user' ? 'Thành viên' : 'Vip'}
            </p>
          </div>
        </div>

        <h3 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4 ml-1">Quà tặng khả dụng</h3>

        {/* List Rewards */}
        <div className="space-y-4">
          {rewards.map((r) => {
            const canAfford = (customerInfo?.totalXu || 0) >= r.cost;
            return (
              <div key={r.id} className="bg-white dark:bg-gray-800 p-5 rounded-[2rem] shadow-sm border border-orange-100 dark:border-gray-700 flex items-center gap-4 transition-all hover:scale-[1.02] active:scale-95 group">
                <div className="w-14 h-14 bg-orange-50 dark:bg-gray-700 rounded-2xl flex items-center justify-center text-3xl shadow-inner group-hover:rotate-12 transition-transform">
                  {r.icon}
                </div>
                <div className="flex-1">
                  <p className="font-black text-gray-800 dark:text-white uppercase text-sm leading-tight tracking-tight">{r.name}</p>
                  <p className="text-xs font-bold text-orange-500 mt-1 flex items-center gap-1">
                     <span className="text-base">🪙</span> {r.cost.toLocaleString()} Xu
                  </p>
                </div>
                <button 
                  onClick={() => handleExchange(r)}
                  disabled={isProcessing || !canAfford}
                  className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md
                    ${canAfford 
                      ? 'bg-gray-900 dark:bg-orange-600 text-white shadow-gray-200 dark:shadow-none hover:bg-black' 
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed shadow-none'}`}
                >
                  {isProcessing ? '...' : 'Đổi'}
                </button>
              </div>
            );
          })}
        </div>

        {/* Hướng dẫn */}
        <div className="mt-10 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-[2rem] border border-blue-100 dark:border-blue-900/30 transition-colors">
          <div className="flex items-center gap-2 mb-3">
             <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-[10px] text-white font-bold">!</div>
             <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Quy định đổi thưởng</p>
          </div>
          <ul className="text-[11px] text-blue-800 dark:text-blue-300 space-y-2 font-bold leading-relaxed">
            <li className="flex gap-2"><span>•</span> <span>Xu được tự động cộng khi đơn hàng chuyển sang trạng thái "Hoàn thành".</span></li>
            <li className="flex gap-2"><span>•</span> <span>Voucher sau khi đổi sẽ có hiệu lực ngay lập tức trong "Kho mã" của bạn.</span></li>
            <li className="flex gap-2"><span>•</span> <span>Hệ thống sử dụng bảo mật Transaction để đảm bảo số dư Xu luôn chính xác.</span></li>
            <li className="flex gap-2 text-orange-600 dark:text-orange-400"><span>•</span> <span>Lưu ý: Xu không có giá trị quy đổi thành tiền mặt hoặc chuyển nhượng.</span></li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default RewardCenter;