import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge'; 
import { 
  subscribeToOrdersByPhone, 
  updateOrderStatus, 
  updatePaymentMethod,
  requestCancelOrder 
} from '../services/orderService'; 
// Import Hook Cài đặt
import { useSettings } from '../contexts/SettingsContext';

// --- CẤU HÌNH HỆ THỐNG XẾP HẠNG ---
const RANK_TIERS = [
  { name: 'Đồng', min: 0, color: 'from-amber-700 to-amber-500', icon: '🥉' },
  { name: 'Bạc', min: 300000, color: 'from-slate-400 to-slate-200', icon: '🥈' },
  { name: 'Vàng', min: 600000, color: 'from-yellow-600 to-yellow-300', icon: '🥇' },
  { name: 'Bạch Kim', min: 900000, color: 'from-cyan-400 to-blue-300', icon: '💎' },
  { name: 'Kim Cương', min: 1200000, color: 'from-blue-600 to-indigo-400', icon: '💠' },
  { name: 'Tinh Anh', min: 1500000, color: 'from-purple-600 to-pink-400', icon: '🔮' },
  { name: 'Cao Thủ', min: 1800000, color: 'from-red-600 to-orange-500', icon: '🔥' },
  { name: 'Chiến Tướng', min: 2100000, color: 'from-red-800 to-red-600', icon: '👑' },
  { name: 'Thách Đấu', min: 2400000, color: 'from-gray-900 via-purple-900 to-violet-600', icon: '🌌' }
];

const getRankInfo = (totalSpend) => {
  let current = RANK_TIERS[0];
  let next = RANK_TIERS[1];
  for (let i = 0; i < RANK_TIERS.length; i++) {
    if (totalSpend >= RANK_TIERS[i].min) {
      current = RANK_TIERS[i];
      next = RANK_TIERS[i + 1] || null;
    }
  }
  let progress = 100;
  if (next) {
    const range = next.min - current.min;
    const earned = totalSpend - current.min;
    progress = Math.min(Math.floor((earned / range) * 100), 100);
  }
  return { current, next, progress };
};

// --- COMPONENT CARD ĐƠN HÀNG ---
const OrderCard = ({ order }) => {
  const navigate = useNavigate();
  const { t } = useSettings(); // Hook dịch thuật
  const [timeLeft, setTimeLeft] = useState(0);
  const [showCancelReason, setShowCancelReason] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showPaymentSelection, setShowPaymentSelection] = useState(false);

  useEffect(() => {
    if (order.status === 'PENDING' && order.createdAt) {
      const calculateTime = () => {
        const orderTime = order.createdAt.toDate().getTime();
        const now = new Date().getTime();
        const diff = Math.floor((orderTime + 10 * 60 * 1000 - now) / 1000);
        return diff > 0 ? diff : 0;
      };
      setTimeLeft(calculateTime());
      const timer = setInterval(() => {
        const diff = calculateTime();
        setTimeLeft(diff);
        if (diff <= 0) clearInterval(timer);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [order]);

  const handleCancelClick = async () => {
    if (order.status === 'PENDING' && timeLeft > 0) {
      if (window.confirm('Bạn muốn hủy đơn hàng này?')) {
        await updateOrderStatus(order.id, 'CANCELLED');
      }
    } else {
      setShowCancelReason(true);
    }
  };

  const submitCancelRequest = async () => {
    if (!cancelReason.trim()) {
      alert("Vui lòng nhập lý do hủy.");
      return;
    }
    const result = await requestCancelOrder(order.id, order.status, cancelReason);
    if (result.success) setShowCancelReason(false);
  };

  const handlePaymentSelect = async (method) => {
    await updatePaymentMethod(order.id, method);
    setShowPaymentSelection(false);
  };

  const handleReOrder = () => {
    if (window.confirm("Thêm các món từ đơn này vào giỏ hàng mới?")) {
      localStorage.setItem('reorder_items', order.items);
      navigate(`/order?user=${order.phone}`);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700 p-6 overflow-hidden transition-all animate-in slide-in-from-bottom-4">
      <div className="flex justify-between items-center mb-4">
        <div>
          <span className="font-mono text-[10px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-lg uppercase tracking-widest transition-colors">
            #{order.id.slice(-6).toUpperCase()}
          </span>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold mt-1 uppercase italic transition-colors">{order.time}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="space-y-3 mb-6">
        <p className="text-[15px] text-gray-800 dark:text-gray-100 font-black leading-tight transition-colors">{order.items}</p>
        <div className="flex justify-between items-end border-t border-dashed dark:border-gray-700 pt-3 transition-colors">
          <span className="text-[10px] text-gray-400 dark:text-gray-500 font-black uppercase">Thành tiền:</span>
          <p className="text-xl font-black text-red-500 dark:text-red-400 tracking-tighter transition-colors">{order.total}</p>
        </div>
      </div>

      {order.status !== 'CANCELLED' && (
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-3xl p-4 mb-4 border border-gray-100 dark:border-gray-700 transition-colors">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Thanh toán</span>
            <span className={`text-[10px] font-black uppercase ${order.paymentStatus === 'PAID' ? 'text-green-500' : 'text-orange-500'}`}>
              {order.paymentStatus === 'PAID' ? '✓ Đã thanh toán' : 
               order.paymentStatus === 'WAITING_CONFIRM' ? '⏳ Đang chờ xác nhận' : 
               order.paymentMethod === 'CASH' ? 'Tiền mặt' : 'Chưa thanh toán'}
            </span>
          </div>
          {order.paymentMethod === 'CASH' && order.paymentStatus === 'UNPAID' && order.updatedAt && (
             <p className="text-[9px] text-red-500 dark:text-red-400 font-black mb-3 italic bg-red-50 dark:bg-red-900/20 p-2 rounded-xl border border-red-100 dark:border-red-900/30 transition-colors">
               * Hệ thống chưa ghi nhận giao dịch, phương thức tự động chuyển sang Tiền mặt!
             </p>
          )}
          {order.paymentStatus !== 'PAID' && (
            <div className="space-y-3">
              {order.paymentMethod === 'CASH' && !showPaymentSelection ? (
                <button onClick={() => setShowPaymentSelection(true)} className="w-full py-2 text-[10px] font-black text-blue-500 dark:text-blue-400 uppercase tracking-widest underline">Đổi sang Chuyển khoản</button>
              ) : order.paymentMethod === 'TRANSFER' && !showPaymentSelection ? (
                <div className="text-center">
                  <img src={`https://api.vietqr.io/image/970423-00006464313-compact.jpg?amount=${parseInt(order.total.replace(/\D/g,''))}&addInfo=TT ${order.id.slice(-6).toUpperCase()}`} className="w-40 h-40 mx-auto rounded-2xl mb-3 shadow-md border-4 border-white dark:border-gray-700" alt="QR" />
                  <button onClick={() => updatePaymentMethod(order.id, 'TRANSFER', true)} className="w-full py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase active:scale-95 transition-all">Tôi đã chuyển khoản</button>
                  <button onClick={() => setShowPaymentSelection(true)} className="text-[9px] font-black text-gray-400 dark:text-gray-500 mt-2 uppercase transition-colors">Đổi phương thức</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => handlePaymentSelect('CASH')} className="flex-1 py-3 bg-gray-800 dark:bg-gray-700 text-white rounded-2xl text-[10px] font-black uppercase active:scale-95 transition-all">💵 Tiền mặt</button>
                  <button onClick={() => handlePaymentSelect('TRANSFER')} className="flex-1 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase active:scale-95 transition-all">🏦 Chuyển khoản</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <button onClick={handleReOrder} className="w-full py-4 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-orange-100 dark:border-orange-900/30 flex items-center justify-center gap-2 mb-4 transition-all active:scale-95">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        Đặt lại đơn này
      </button>

      <div className="space-y-2">
        {order.status === 'CANCEL_REQUESTED' ? (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 text-[10px] font-black p-3 rounded-2xl text-center border border-yellow-100 dark:border-yellow-900/30 transition-colors">Đang chờ Bếp xác nhận hủy...</div>
        ) : !['COMPLETED', 'CANCELLED'].includes(order.status) && (
          <>
            {!showCancelReason ? (
              <button onClick={handleCancelClick} className="w-full py-3 rounded-2xl text-[10px] font-black uppercase text-red-400 dark:text-red-500 border border-red-50 dark:border-red-900/30 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
                {order.status === 'PENDING' && timeLeft > 0 ? `Hủy đơn nhanh (${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')})` : 'Yêu cầu hủy đơn'}
              </button>
            ) : (
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-3xl border border-red-100 dark:border-red-900/30 animate-in fade-in transition-colors">
                <textarea placeholder="Lý do hủy..." value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className="w-full p-3 text-xs bg-white dark:bg-gray-700 dark:text-white rounded-xl mb-3 outline-none transition-colors" rows="2" />
                <div className="flex gap-2">
                  <button onClick={() => setShowCancelReason(false)} className="flex-1 py-2 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase">Đóng</button>
                  <button onClick={submitCancelRequest} className="flex-1 py-2 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase active:scale-95 transition-all">Gửi lý do</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// --- COMPONENT CHÍNH ---
const CheckOrder = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const userPhoneParam = searchParams.get('user') || '';
  
  // Hook Cài đặt
  const { t } = useSettings();

  const [phoneInput, setPhoneInput] = useState(userPhoneParam);
  const [orders, setOrders] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [visibleCount, setVisibleCount] = useState(5);

  useEffect(() => {
    if (userPhoneParam) setPhoneInput(userPhoneParam);
  }, [userPhoneParam]);

  useEffect(() => {
    let unsubscribe = () => {};
    if (userPhoneParam && userPhoneParam.length >= 10) {
      setIsSearching(true);
      unsubscribe = subscribeToOrdersByPhone(userPhoneParam, (updatedOrders) => {
        setOrders(updatedOrders);
        setIsSearching(false);
      });
    } else {
      setOrders([]);
      setIsSearching(false);
    }
    return () => unsubscribe();
  }, [userPhoneParam]);

  // TÍNH RANK
  const rankData = useMemo(() => {
    const totalSpend = orders
      .filter(o => o.status === 'COMPLETED')
      .reduce((sum, o) => sum + parseInt(o.total?.replace(/\D/g, '') || 0), 0);
    return getRankInfo(totalSpend);
  }, [orders]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (phoneInput.trim().length < 10) {
      alert("SĐT không hợp lệ.");
      return;
    }
    navigate(`/checkorder?user=${phoneInput.trim()}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20 font-sans transition-colors duration-300">
      
      {/* HEADER */}
      <div className="bg-white dark:bg-gray-800 px-6 py-5 border-b dark:border-gray-700 flex items-center justify-between shadow-sm sticky top-0 z-30 transition-colors">
        <div className="flex items-center">
          <button onClick={() => navigate(-1)} className="text-gray-800 dark:text-gray-100 p-2 mr-2 bg-gray-50 dark:bg-gray-700 rounded-2xl active:scale-90 transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-black text-gray-800 dark:text-white uppercase tracking-tighter transition-colors">
            {t('checkOrder')}
          </h1>
        </div>

        {/* WIDGET RANK */}
        {userPhoneParam && orders.length > 0 && (
          <div className="flex flex-col items-end">
            <div className={`bg-gradient-to-r ${rankData.current.color} px-4 py-1 rounded-2xl shadow-lg border-2 border-white dark:border-gray-700 flex items-center gap-2 animate-in slide-in-from-right-4 duration-500`}>
              <span className="text-sm">{rankData.current.icon}</span>
              <span className="text-[10px] font-black text-white uppercase tracking-widest">{rankData.current.name}</span>
            </div>
            <div className="w-24 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mt-2 overflow-hidden border border-white dark:border-gray-800 transition-colors">
              <div 
                className={`h-full bg-gradient-to-r ${rankData.current.color} transition-all duration-1000`} 
                style={{ width: `${rankData.progress}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>

      <div className="p-6 max-w-lg mx-auto">
        {/* SEARCH FORM */}
        <form onSubmit={handleSearch} className="mb-10 bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700 transition-colors">
          <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 ml-1 text-center transition-colors">Nhập SĐT của bạn</label>
          <div className="flex gap-2">
            <input
              type="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="0333 xxx xxx"
              className="flex-1 bg-gray-50 dark:bg-gray-700 dark:text-white border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none transition-all placeholder:text-gray-300 dark:placeholder:text-gray-500"
            />
            <button type="submit" className="bg-blue-600 text-white px-6 py-4 rounded-2xl text-xs font-black uppercase shadow-lg shadow-blue-100 dark:shadow-none active:scale-95 transition-all">Tìm</button>
          </div>
        </form>

        {/* LIST ORDERS */}
        <div className="space-y-6">
          {orders.slice(0, visibleCount).map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}

          {orders.length > visibleCount && visibleCount < 30 && (
            <button 
              onClick={() => setVisibleCount(prev => Math.min(prev + 10, 30))}
              className="w-full py-4 bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-[2rem] text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em] hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm"
            >
              Xem thêm đơn cũ ({orders.length - visibleCount})
            </button>
          )}

          {visibleCount >= 30 && orders.length > 30 && (
            <p className="text-center text-[9px] font-bold text-gray-300 dark:text-gray-600 uppercase tracking-widest italic animate-pulse transition-colors">
              * Hệ thống chỉ hiển thị 30 đơn gần nhất
            </p>
          )}

          {userPhoneParam && orders.length === 0 && !isSearching && (
            <div className="text-center py-20 animate-in fade-in">
               <p className="text-4xl mb-4">🏜️</p>
               <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest transition-colors">Chưa tìm thấy dữ liệu đơn hàng</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CheckOrder;