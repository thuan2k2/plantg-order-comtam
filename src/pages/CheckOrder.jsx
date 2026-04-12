import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge'; 
import { 
  subscribeToOrdersByPhone, 
  updateOrderStatus, 
  updatePaymentMethod,
  requestCancelOrder 
} from '../services/orderService'; 

const OrderCard = ({ order }) => {
  const [timeLeft, setTimeLeft] = useState(0);
  const [showCancelReason, setShowCancelReason] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showPaymentSelection, setShowPaymentSelection] = useState(false);

  // Logic đếm ngược 10 phút để tự hủy
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
    // Nếu đơn đang chờ và còn trong 10 phút thì cho phép hủy trực tiếp
    if (order.status === 'PENDING' && timeLeft > 0) {
      if (window.confirm('Bạn muốn hủy đơn hàng này?')) {
        await updateOrderStatus(order.id, 'CANCELLED');
      }
    } else {
      // Nếu đã quá 10 phút hoặc bếp đã nhận đơn, yêu cầu nhập lý do
      setShowCancelReason(true);
    }
  };

  const submitCancelRequest = async () => {
    if (!cancelReason.trim()) {
      alert("Vui lòng nhập lý do hủy để Bếp xem xét.");
      return;
    }
    const result = await requestCancelOrder(order.id, order.status, cancelReason);
    if (result.success) {
      setShowCancelReason(false);
      alert("Đã gửi yêu cầu hủy tới Bếp.");
    }
  };

  const handlePaymentSelect = async (method) => {
    await updatePaymentMethod(order.id, method);
    if (method === 'CASH') setShowPaymentSelection(false);
  };

  return (
    <div className="bg-white rounded-[2.5rem] shadow-xl shadow-gray-200/50 border border-gray-100 p-6 overflow-hidden transition-all animate-in slide-in-from-bottom-4">
      <div className="flex justify-between items-center mb-4">
        <div>
          <span className="font-mono text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg uppercase tracking-widest">
            #{order.id.slice(-6).toUpperCase()}
          </span>
          <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase italic">{order.time}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="space-y-3 mb-6">
        <p className="text-[15px] text-gray-800 font-black leading-tight">{order.items}</p>
        <div className="flex justify-between items-end border-t border-dashed pt-3">
          <span className="text-[10px] text-gray-400 font-black uppercase">Thành tiền:</span>
          <p className="text-xl font-black text-red-500 tracking-tighter">{order.total}</p>
        </div>
      </div>

      {/* PHẦN THANH TOÁN */}
      <div className="bg-gray-50 rounded-3xl p-4 mb-4 border border-gray-100">
        <div className="flex justify-between items-center mb-3">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Thanh toán</span>
          <span className={`text-[10px] font-black uppercase ${order.paymentStatus === 'PAID' ? 'text-green-500' : 'text-orange-500'}`}>
            {order.paymentStatus === 'PAID' ? '✓ Đã thanh toán' : 
             order.paymentStatus === 'WAITING_CONFIRM' ? '⏳ Đang chờ xác nhận' : 'Chưa thanh toán'}
          </span>
        </div>

        {order.paymentStatus !== 'PAID' && (
          <div className="space-y-3">
            {(!order.paymentMethod || showPaymentSelection || order.paymentMethod === 'CASH') ? (
              <div className="flex gap-2">
                <button 
                  onClick={() => handlePaymentSelect('CASH')}
                  className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${order.paymentMethod === 'CASH' ? 'bg-gray-800 text-white' : 'bg-white text-gray-400 border border-gray-100'}`}
                >
                  💵 Tiền mặt
                </button>
                <button 
                  onClick={() => handlePaymentSelect('TRANSFER')}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-blue-100"
                >
                  🏦 Chuyển khoản
                </button>
              </div>
            ) : (
              <div className="text-center animate-in zoom-in duration-300">
                <img 
                  src={`https://api.vietqr.io/image/970423-00006464313-compact.jpg?amount=${parseInt(order.total.replace(/\D/g,''))}&addInfo=TT ${order.id.slice(-6).toUpperCase()}`} 
                  className="w-40 h-40 mx-auto rounded-2xl shadow-sm border-2 border-white mb-3"
                  alt="QR Thanh toán"
                />
                <p className="text-[9px] text-blue-500 font-bold italic mb-3 px-2 leading-tight">
                  * Vui lòng chuyển khoản đúng số tiền và nội dung mã đơn để được xác nhận tự động.
                </p>
                <button 
                  onClick={() => updatePaymentMethod(order.id, 'TRANSFER', true)}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase shadow-md mb-2"
                >
                  Tôi đã chuyển khoản
                </button>
                <button 
                  onClick={() => setShowPaymentSelection(true)}
                  className="text-[9px] font-black text-gray-400 uppercase tracking-widest"
                >
                  Đổi phương thức thanh toán
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* PHẦN HỦY ĐƠN */}
      <div className="space-y-2">
        {order.status === 'CANCEL_REQUESTED' ? (
          <div className="bg-yellow-50 text-yellow-700 text-[10px] font-black p-3 rounded-2xl text-center uppercase border border-yellow-100">
            Đang chờ Bếp xác nhận hủy đơn...
          </div>
        ) : !['COMPLETED', 'CANCELLED'].includes(order.status) && (
          <>
            {!showCancelReason ? (
              <button 
                onClick={handleCancelClick}
                className="w-full py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-red-400 border border-red-100 hover:bg-red-50 transition-all"
              >
                {order.status === 'PENDING' && timeLeft > 0 
                  ? `Hủy đơn nhanh (${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')})`
                  : 'Yêu cầu hủy đơn'}
              </button>
            ) : (
              <div className="bg-red-50 p-4 rounded-3xl border border-red-100 animate-in fade-in">
                <textarea 
                  placeholder="Lý do hủy đơn..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full p-3 text-xs bg-white rounded-xl outline-none mb-3 border-none focus:ring-1 focus:ring-red-200"
                  rows="2"
                />
                <div className="flex gap-2">
                  <button onClick={() => setShowCancelReason(false)} className="flex-1 py-2 text-[10px] font-black text-gray-400 uppercase">Hủy</button>
                  <button onClick={submitCancelRequest} className="flex-1 py-2 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase">Gửi lý do</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const CheckOrder = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const userPhoneParam = searchParams.get('user') || '';
  
  const [phoneInput, setPhoneInput] = useState(userPhoneParam);
  const [orders, setOrders] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

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

  const handleSearch = (e) => {
    e.preventDefault();
    if (phoneInput.trim().length < 10) {
      alert("Vui lòng nhập số điện thoại hợp lệ.");
      return;
    }
    setSearchParams({ user: phoneInput.trim() });
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans">
      <div className="bg-white px-6 py-5 border-b flex items-center shadow-sm sticky top-0 z-30">
        <button onClick={() => navigate(-1)} className="text-gray-800 p-2 mr-2 bg-gray-50 rounded-2xl active:scale-90 transition-all">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-black text-gray-800 uppercase tracking-tighter">Lịch sử đơn hàng</h1>
      </div>

      <div className="p-6 max-w-lg mx-auto">
        <form onSubmit={handleSearch} className="mb-10 bg-white p-6 rounded-[2.5rem] shadow-xl shadow-gray-200/50 border border-gray-100">
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Nhập Số điện thoại của bạn</label>
          <div className="flex gap-2">
            <input
              type="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="0333 xxx xxx"
              className="flex-1 bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none transition-all"
            />
            <button type="submit" className="bg-blue-600 text-white px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-100 active:scale-95 transition-all">
              {isSearching ? '...' : 'Tìm'}
            </button>
          </div>
        </form>

        {isSearching ? (
          <div className="text-center py-20">
             <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-blue-600 mx-auto mb-4"></div>
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Đang tìm kiếm dữ liệu...</p>
          </div>
        ) : userPhoneParam && orders.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-gray-200">
            <p className="text-sm font-bold text-gray-400 italic">Chưa có đơn hàng nào cho SĐT này.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CheckOrder;