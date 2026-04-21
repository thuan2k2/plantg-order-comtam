import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore'; 
import { db } from '../firebase/config';
import StatusBadge from '../components/StatusBadge'; 
import CountdownBorder from '../components/CountdownBorder'; 
import { 
  subscribeToOrdersByPhone, 
  updateOrderStatus, 
  updatePaymentMethod,
  requestCancelOrder 
} from '../services/orderService'; 

// IMPORT COMPONENT & UTILS MỚI
import { getRankInfo } from '../utils/rankUtils';
import VipBadge from '../components/VipBadge';
import PetEntity from '../components/PetEntity';

// --- CẤU HÌNH TABS TRẠNG THÁI ---
const ORDER_TABS = [
  { id: 'ALL', label: 'Tất cả' },
  { id: 'PENDING', label: 'Chờ nhận' },
  { id: 'PREPARING', label: 'Bếp làm' },
  { id: 'DELIVERING', label: 'Đang giao' },
  { id: 'COMPLETED', label: 'Hoàn thành' },
  { id: 'CANCEL_REQUESTED', label: 'Yêu cầu Hủy' },
  { id: 'CANCELLED', label: 'Đã Hủy' }
];

// --- COMPONENT CARD ĐƠN HÀNG ---
const OrderCard = ({ order, isHighlighted }) => {
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState(0);
  const [showCancelReason, setShowCancelReason] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showPaymentSelection, setShowPaymentSelection] = useState(false);

  const [ratingStars, setRatingStars] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

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
        await requestCancelOrder(order.id, 'PENDING');
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

  const handleSubmitRating = async (e) => {
    e.preventDefault();
    if (isSubmittingRating) return;
    setIsSubmittingRating(true);

    try {
      await updateDoc(doc(db, 'orders', order.id), {
        rating: {
          stars: ratingStars,
          comment: ratingComment.trim(),
          createdAt: serverTimestamp(),
          adminReply: "" 
        }
      });
      alert("Cảm ơn bạn đã đánh giá món ăn!");
    } catch (error) {
      console.error("Lỗi gửi đánh giá:", error);
      alert("Có lỗi xảy ra, vui lòng thử lại.");
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const isProcessing = order.status === 'PREPARING' || order.status === 'DELIVERING';
  const isWalletPayment = order.paymentMethod === 'WALLET';

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-xl dark:shadow-none border p-6 overflow-hidden transition-all duration-700 animate-in slide-in-from-bottom-4 relative group flex flex-col h-full
      ${isHighlighted ? 'border-blue-400 dark:border-blue-500 shadow-blue-200/50 ring-4 ring-blue-100 dark:ring-blue-900/30' : 'border-gray-100 dark:border-gray-700 shadow-gray-200/50'}
    `}>
      
      {isHighlighted && (
        <div className="absolute top-0 right-0 bg-blue-500 text-white text-[9px] font-black uppercase px-3 py-1 rounded-bl-2xl shadow-sm z-20 animate-pulse">
          Đơn mới nhất
        </div>
      )}

      <CountdownBorder 
        startTime={order.confirmedAt} 
        isActive={isProcessing} 
      />

      <div className="relative z-10 flex-1 flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <div>
            <span className="font-mono text-[10px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-lg uppercase tracking-widest transition-colors">
              #{order.id.slice(-6).toUpperCase()}
            </span>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold mt-1 uppercase italic transition-colors">{order.time}</p>
          </div>
          <StatusBadge status={order.status} />
        </div>

        <div className="space-y-3 mb-6 flex-1">
          <p className="text-[15px] text-gray-800 dark:text-gray-100 font-black leading-tight transition-colors">{order.items}</p>
          
          {order.note && (
             <p className="text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 p-2 rounded-xl font-bold">Ghi chú: <span className="font-medium italic">{order.note}</span></p>
          )}
          {order.address && (
             <p className="text-xs text-gray-600 dark:text-gray-300 font-medium">📍 {order.address}</p>
          )}

          <div className="flex justify-between items-end border-t border-dashed dark:border-gray-700 pt-3 mt-3 transition-colors">
            <span className="text-[10px] text-gray-400 dark:text-gray-500 font-black uppercase">Thành tiền:</span>
            <div className="text-right">
               <p className={`text-xl font-black tracking-tighter transition-colors ${isWalletPayment ? 'text-gray-400 line-through' : 'text-red-500 dark:text-red-400'}`}>
                 {order.total}
               </p>
               {isWalletPayment && <p className="text-[9px] font-black text-green-500 uppercase mt-0.5">Đã thanh toán Ví</p>}
            </div>
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
            
            {order.paymentStatus !== 'PAID' && !isWalletPayment && (
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

        {/* KHU VỰC ĐÁNH GIÁ */}
        {order.status === 'COMPLETED' && (
          <div className="mb-4">
            {!order.rating ? (
              <form onSubmit={handleSubmitRating} className="bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-3xl border border-yellow-100 dark:border-yellow-900/30">
                <p className="text-[10px] font-black text-yellow-600 dark:text-yellow-500 uppercase tracking-widest mb-2 text-center">Đánh giá món ăn</p>
                <div className="flex justify-center gap-1 mb-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button 
                      key={star} 
                      type="button" 
                      onClick={() => setRatingStars(star)}
                      className={`text-2xl transition-all ${star <= ratingStars ? 'text-yellow-400 scale-110' : 'text-gray-300 dark:text-gray-600 grayscale'}`}
                    >
                      ⭐
                    </button>
                  ))}
                </div>
                <textarea 
                  placeholder="Chia sẻ cảm nhận của bạn (tùy chọn)..." 
                  value={ratingComment} 
                  onChange={(e) => setRatingComment(e.target.value)} 
                  className="w-full p-3 text-xs bg-white dark:bg-gray-800 dark:text-white rounded-xl mb-3 outline-none transition-colors border border-yellow-200 dark:border-gray-700 focus:ring-2 focus:ring-yellow-400 resize-none" 
                  rows="2" 
                />
                <button 
                  type="submit" 
                  disabled={isSubmittingRating}
                  className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isSubmittingRating ? 'bg-gray-400 text-white' : 'bg-yellow-400 text-yellow-900 hover:bg-yellow-500 shadow-md shadow-yellow-200 dark:shadow-none active:scale-95'}`}
                >
                  {isSubmittingRating ? 'Đang gửi...' : 'Gửi đánh giá'}
                </button>
              </form>
            ) : (
              <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-3xl border border-gray-100 dark:border-gray-700">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Đánh giá của bạn</span>
                  <div className="flex text-yellow-400 text-sm">
                    {"★".repeat(order.rating.stars)}{"☆".repeat(5-order.rating.stars)}
                  </div>
                </div>
                {order.rating.comment && (
                  <p className="text-xs text-gray-600 dark:text-gray-300 italic mb-2">"{order.rating.comment}"</p>
                )}
                {/* HIỂN THỊ PHẢN HỒI CỦA ADMIN */}
                {order.rating.adminReply && (
                  <div className="mt-3 pt-3 border-t border-dashed border-gray-200 dark:border-gray-700">
                    <p className="text-[9px] font-black text-blue-500 dark:text-blue-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                      Phản hồi từ Quán
                    </p>
                    <p className="text-xs text-gray-800 dark:text-gray-200 font-medium">"{order.rating.adminReply}"</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <button onClick={handleReOrder} className="w-full py-4 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-orange-100 dark:border-orange-900/30 flex items-center justify-center gap-2 mb-4 transition-all active:scale-95 hover:bg-orange-100 dark:hover:bg-orange-900/40 mt-auto">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Đặt lại đơn này
        </button>

        {/* THÔNG BÁO VOUCHER KHI ĐƯỢC TẶNG */}
        {order.lateVoucherStatus === 'AWARDED' && (
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-3xl border border-green-100 dark:border-green-900/30 mb-4 animate-in fade-in transition-colors">
            <p className="text-[10px] font-black text-green-600 dark:text-green-400 uppercase text-center tracking-widest">
              🎁 Quán xin lỗi vì giao trễ!
            </p>
            <p className="text-xs font-bold text-green-700 dark:text-green-500 text-center mt-1">
              Bạn đã nhận được 1 Voucher giảm giá 5.000đ. Kiểm tra trong "Kho mã" ở lần đặt sau nhé.
            </p>
          </div>
        )}

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
                  <textarea placeholder="Lý do hủy..." value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className="w-full p-3 text-xs bg-white dark:bg-gray-700 dark:text-white rounded-xl mb-3 outline-none transition-colors focus:ring-2 focus:ring-red-200" rows="2" />
                  <div className="flex gap-2">
                    <button onClick={() => setShowCancelReason(false)} className="flex-1 py-2 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-colors">Đóng</button>
                    <button onClick={submitCancelRequest} className="flex-[2] py-2 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase active:scale-95 transition-all shadow-md shadow-red-200 dark:shadow-none hover:bg-red-600">Gửi lý do</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// --- COMPONENT CHÍNH ---
const CheckOrder = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const userPhoneParam = searchParams.get('user') || '';
  
  const [phoneInput, setPhoneInput] = useState(userPhoneParam);
  const [orders, setOrders] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [visibleCount, setVisibleCount] = useState(5);
  
  const [activeTab, setActiveTab] = useState('ALL');

  const prevStatuses = useRef({});
  const isInitialLoad = useRef(true);

  const [userData, setUserData] = useState(null); // MỚI LƯU USER DATA
  const [userRankInfo, setUserRankInfo] = useState(null);

  const [highlightOrderId, setHighlightOrderId] = useState(null);

  useEffect(() => {
    if (userPhoneParam) setPhoneInput(userPhoneParam);
  }, [userPhoneParam]);

  useEffect(() => {
    let unsubscribe = () => {};
    if (userPhoneParam && userPhoneParam.length >= 10) {
      setIsSearching(true);
      
      const fetchUserData = async () => {
        const userDoc = await getDoc(doc(db, 'users', userPhoneParam.trim()));
        if (userDoc.exists()) {
           const data = userDoc.data();
           setUserData(data);
           setUserRankInfo(getRankInfo(data.totalSpend || 0, data.manualRankId));
        }
      };
      fetchUserData();

      unsubscribe = subscribeToOrdersByPhone(userPhoneParam, (updatedOrders) => {
        
        // ĐỒNG BỘ REAL-TIME VỚI TELEGRAM
        updatedOrders.forEach(order => {
          const oldStatus = prevStatuses.current[order.id];
          
          if (oldStatus && oldStatus !== order.status) {
            if (!isInitialLoad.current) {
              try {
                let audioPath = '/status-update.mp3';
                if (order.status === 'PREPARING' || order.status === 'DELIVERING') {
                   audioPath = '/status-update.mp3'; 
                }
                const audio = new Audio(audioPath);
                audio.play().catch(e => console.warn("Trình duyệt chặn autoplay âm thanh:", e));
              } catch (error) {
                console.error("Lỗi phát âm thanh:", error);
              }
            }
          }
          prevStatuses.current[order.id] = order.status;
        });

        if (isInitialLoad.current && updatedOrders.length > 0) {
          const newestOrder = updatedOrders[0];
          
          if (newestOrder.createdAt && (new Date().getTime() - newestOrder.createdAt.toDate().getTime()) < 5 * 60 * 1000) {
            setHighlightOrderId(newestOrder.id);
            setTimeout(() => setHighlightOrderId(null), 5000);
          }
          isInitialLoad.current = false;
        }

        setOrders(updatedOrders);
        setIsSearching(false);
      });
    } else {
      setOrders([]);
      setIsSearching(false);
    }
    return () => unsubscribe();
  }, [userPhoneParam]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (phoneInput.trim().length < 10) {
      alert("SĐT không hợp lệ.");
      return;
    }
    navigate(`/checkorder?user=${phoneInput.trim()}`);
  };

  const filteredOrders = useMemo(() => {
    if (activeTab === 'ALL') return orders;
    return orders.filter(o => o.status === activeTab);
  }, [orders, activeTab]);

  return (
    <div className="min-h-screen pb-20 font-sans transition-colors duration-300 relative">
      
      {/* ĐÃ FIX BACKGROUND IMAGE */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <img src="/background/background.jpg" alt="bg" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-orange-50/80 dark:bg-gray-900/90 backdrop-blur-[2px]"></div>
      </div>

      {/* HEADER & RANK */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md px-6 py-5 border-b dark:border-gray-700 flex items-center justify-between transition-colors relative z-40">
        
        {/* ĐÃ FIX LAYOUT HEADER VIP BADGE ĐỂ KHÔNG BỊ XUỐNG DÒNG LỖI */}
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => navigate(-1)} className="flex-shrink-0 text-gray-800 dark:text-gray-100 p-2 mr-1 bg-gray-50/50 dark:bg-gray-700/50 rounded-2xl active:scale-90 transition-all shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <h1 className="text-lg font-black text-gray-800 dark:text-white uppercase tracking-tighter transition-colors whitespace-nowrap">
            LỊCH SỬ ĐƠN
          </h1>
          {userRankInfo && <VipBadge rankInfo={userRankInfo} size="w-5 h-5 flex-shrink-0" />}
        </div>

        {/* WIDGET RANK */}
        {userPhoneParam && userRankInfo && (
          <div className="flex flex-col items-end flex-shrink-0 ml-2">
            <div className={`bg-gradient-to-r ${userRankInfo.current.color} px-4 py-1.5 rounded-2xl shadow-lg border-2 border-white dark:border-gray-700 flex items-center gap-2 animate-in slide-in-from-right-4 duration-500`}>
              <span className="text-sm">{userRankInfo.current.icon}</span>
              <span className="text-[10px] font-black text-white uppercase tracking-widest">{userRankInfo.current.name}</span>
            </div>
            <div className="w-24 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mt-2 overflow-hidden border border-white dark:border-gray-800 transition-colors">
              <div 
                className={`h-full bg-gradient-to-r ${userRankInfo.current.color} transition-all duration-1000`} 
                style={{ width: `${userRankInfo.progress}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>

      {/* STICKY TAB BAR (BỘ LỌC TRẠNG THÁI) */}
      {userPhoneParam && orders.length > 0 && (
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border-b dark:border-gray-700 shadow-sm sticky top-0 z-30 transition-colors">
          <div className="max-w-2xl mx-auto flex px-4 py-3 gap-2 overflow-x-auto no-scrollbar scroll-smooth">
            {ORDER_TABS.map(tab => {
              const count = orders.filter(o => tab.id === 'ALL' ? true : o.status === tab.id).length;
              const isActive = activeTab === tab.id;

              return (
                <button 
                  key={tab.id} 
                  onClick={() => setActiveTab(tab.id)} 
                  className={`flex-shrink-0 px-5 py-2.5 text-[10px] font-black uppercase rounded-2xl transition-all whitespace-nowrap flex items-center gap-2 border-2 
                    ${isActive 
                      ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200 dark:shadow-none' 
                      : 'text-gray-500 dark:text-gray-400 bg-white/50 dark:bg-gray-700/50 border-transparent hover:bg-gray-100 dark:hover:bg-gray-600'}`}
                >
                  {tab.label}
                  {count > 0 && tab.id !== 'ALL' && (
                    <span className={`px-2 py-0.5 rounded-full text-[9px] ${isActive ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="p-4 sm:p-6 max-w-7xl mx-auto mt-2 relative z-10">
        {/* SEARCH FORM */}
        <form onSubmit={handleSearch} className="mb-8 max-w-lg mx-auto bg-white/90 dark:bg-gray-800/90 backdrop-blur-md p-6 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
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

        {/* DANH SÁCH ĐƠN HÀNG (GRID RESPONSIVE) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOrders.slice(0, visibleCount).map((order) => (
            <OrderCard 
              key={order.id} 
              order={order} 
              isHighlighted={order.id === highlightOrderId} // Truyền prop highlight vào card
            />
          ))}
        </div>

        {/* NÚT XEM THÊM (NẰM DƯỚI GRID) */}
        <div className="max-w-lg mx-auto mt-6 space-y-4">
          {filteredOrders.length > visibleCount && visibleCount < 30 && (
            <button 
              onClick={() => setVisibleCount(prev => Math.min(prev + 10, 30))}
              className="w-full py-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md border-2 border-gray-100 dark:border-gray-700 rounded-[2rem] text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em] hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm active:scale-95"
            >
              Xem thêm đơn cũ ({filteredOrders.length - visibleCount})
            </button>
          )}

          {visibleCount >= 30 && filteredOrders.length > 30 && (
            <p className="text-center text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest italic animate-pulse transition-colors drop-shadow-sm">
              * Hệ thống chỉ hiển thị 30 đơn gần nhất
            </p>
          )}

          {/* TRẠNG THÁI TRỐNG */}
          {userPhoneParam && filteredOrders.length === 0 && !isSearching && (
            <div className="text-center py-20 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-[2.5rem] border border-dashed border-gray-200 dark:border-gray-700 animate-in fade-in zoom-in-95">
               <p className="text-5xl mb-4 grayscale opacity-50">🏜️</p>
               <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest transition-colors">
                 {activeTab === 'ALL' ? 'Chưa có đơn hàng nào' : `Không có đơn ở trạng thái này`}
               </p>
            </div>
          )}
        </div>
      </div>

      {/* MỚI: HỆ THỐNG THÚ CƯNG (PET) CHỈ HIỆN KHI ĐÃ TÌM THẤY USER */}
      {userRankInfo && userRankInfo.current.id === 'CHALLENGER' && userData?.showPet && (
        <PetEntity phone={userPhoneParam} />
      )}
    </div>
  );
};

export default CheckOrder;