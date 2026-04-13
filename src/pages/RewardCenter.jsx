import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, increment, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

const RewardCenter = () => {
  const navigate = useNavigate();
  const [customerInfo, setCustomerInfo] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Lấy SĐT từ localStorage
  const savedPhones = JSON.parse(localStorage.getItem('recentPhones') || '[]');
  const phone = savedPhones[0];

  // Danh sách quà tặng (Bạn có thể đưa lên Firebase nếu muốn quản lý động)
  const rewards = [
    { id: 'R1', name: 'Voucher 5.000đ', cost: 5000, value: 5000, type: 'CASH', icon: '🎟️' },
    { id: 'R2', name: 'Voucher 10.000đ', cost: 9500, value: 10000, type: 'CASH', icon: '🧧' }, // Giảm giá Xu khi đổi nhiều
    { id: 'R3', name: 'Miễn phí vận chuyển', cost: 3000, value: 5000, type: 'FREESHIP', icon: '🚚' },
    { id: 'R4', name: 'Voucher 20.000đ', cost: 18000, value: 20000, type: 'CASH', icon: '💎' },
  ];

  useEffect(() => {
    if (!phone) {
      navigate('/');
      return;
    }

    // Lắng nghe số dư Xu Real-time
    const unsub = onSnapshot(doc(db, 'users', phone), (snap) => {
      if (snap.exists()) {
        setCustomerInfo({ id: snap.id, ...snap.data() });
      }
    });

    return () => unsub();
  }, [phone, navigate]);

  const handleExchange = async (reward) => {
    if (isProcessing) return;
    if ((customerInfo?.totalXu || 0) < reward.cost) {
      alert("Bạn không đủ Xu để đổi quà này! Tích cực đặt đơn nhé.");
      return;
    }

    if (window.confirm(`Xác nhận dùng ${reward.cost.toLocaleString()} Xu để đổi lấy ${reward.name}?`)) {
      setIsProcessing(true);
      try {
        const userRef = doc(db, 'users', phone);

        // 1. Trừ Xu của User
        await updateDoc(userRef, {
          totalXu: increment(-reward.cost)
        });

        // 2. Tạo Voucher mới gán cho SĐT này
        const voucherCode = `DOI-${Math.random().toString(36).toUpperCase().slice(2, 7)}`;
        await addDoc(collection(db, 'vouchers'), {
          code: voucherCode,
          value: reward.value,
          type: reward.type,
          assignedPhone: phone,
          usageLimit: 1,
          createdAt: serverTimestamp(),
          description: `Đổi từ ${reward.cost} Xu`
        });

        alert(`🎉 Chúc mừng! Bạn đã đổi thành công mã: ${voucherCode}. Hãy dùng nó ở đơn hàng tiếp theo.`);
      } catch (error) {
        console.error("Lỗi đổi quà:", error);
        alert("Có lỗi xảy ra, vui lòng thử lại sau.");
      } finally {
        setIsProcessing(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-orange-50/50 dark:bg-gray-900 font-sans pb-10 transition-colors">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 px-6 py-5 flex items-center shadow-sm sticky top-0 z-30">
        <button onClick={() => navigate(-1)} className="p-2 bg-gray-50 dark:bg-gray-700 rounded-2xl mr-4">
           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="text-lg font-black uppercase tracking-tighter">Đổi quà tích điểm</h1>
      </div>

      <div className="p-6 max-w-md mx-auto">
        {/* Card Số dư Xu */}
        <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-orange-200 dark:shadow-none mb-8 relative overflow-hidden">
          <div className="absolute top-[-20%] right-[-10%] text-9xl opacity-10 rotate-12">🪙</div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80">Xu Plant G hiện có</p>
          <div className="flex items-end gap-2 mt-2">
            <h2 className="text-5xl font-black">{(customerInfo?.totalXu || 0).toLocaleString()}</h2>
            <span className="text-sm font-bold mb-2 opacity-80 uppercase">Xu</span>
          </div>
          <p className="text-[10px] mt-4 font-bold bg-white/20 inline-block px-3 py-1 rounded-full backdrop-blur-md">
            Tỉ lệ tích điểm: 1,000đ = 10 Xu
          </p>
        </div>

        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 ml-1">Danh sách quà tặng</h3>

        {/* List Rewards */}
        <div className="space-y-4">
          {rewards.map((r) => (
            <div key={r.id} className="bg-white dark:bg-gray-800 p-5 rounded-[2rem] shadow-sm border border-orange-100 dark:border-gray-700 flex items-center gap-4 transition-all hover:scale-[1.02]">
              <div className="w-14 h-14 bg-orange-50 dark:bg-gray-700 rounded-2xl flex items-center justify-center text-3xl shadow-inner">
                {r.icon}
              </div>
              <div className="flex-1">
                <p className="font-black text-gray-800 dark:text-white uppercase text-sm leading-tight">{r.name}</p>
                <p className="text-xs font-bold text-orange-500 mt-1">
                   🪙 {r.cost.toLocaleString()} Xu
                </p>
              </div>
              <button 
                onClick={() => handleExchange(r)}
                disabled={isProcessing || (customerInfo?.totalXu || 0) < r.cost}
                className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md active:scale-90
                  ${(customerInfo?.totalXu || 0) >= r.cost 
                    ? 'bg-gray-900 text-white shadow-gray-200' 
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'}`}
              >
                {isProcessing ? '...' : 'Đổi'}
              </button>
            </div>
          ))}
        </div>

        {/* Hướng dẫn */}
        <div className="mt-10 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-[2rem] border border-blue-100 dark:border-blue-900/30">
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">Lưu ý</p>
          <ul className="text-[11px] text-blue-800 dark:text-blue-300 space-y-2 font-medium">
            <li>• Xu được tự động cộng khi đơn hàng chuyển sang trạng thái "Hoàn thành".</li>
            <li>• Voucher sau khi đổi sẽ nằm trong "Kho mã" ở màn hình đặt hàng.</li>
            <li>• Xu không có giá trị quy đổi thành tiền mặt.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default RewardCenter;