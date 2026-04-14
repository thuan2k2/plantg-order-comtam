import React, { useState, useEffect, useRef } from 'react';
import { getAuth } from 'firebase/auth'; 
import { doc, updateDoc } from 'firebase/firestore'; 
import { db } from '../../firebase/config'; 
import { 
  subscribeToOrdersByDate, 
  updateOrderStatus, 
  confirmPaymentStatus,
  deleteOrderSoft,
  completeOrderWithBonus,
  awardLateVoucher 
} from '../../services/orderService';
import StatusBadge from '../../components/StatusBadge';
import CountdownBorder from '../../components/CountdownBorder'; 

const ORDER_STATUSES = {
  PENDING: { label: 'Chờ xác nhận', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  PREPARING: { label: 'Bếp đang làm', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  DELIVERING: { label: 'Đang giao hàng', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  COMPLETED: { label: 'Hoàn thành', color: 'bg-green-100 text-green-700 border-green-200' },
  CANCELLED: { label: 'Đã huỷ', color: 'bg-red-100 text-red-700 border-red-200' },
  CANCEL_REQUESTED: { label: 'Yêu cầu huỷ', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' }
};

const ManageOrders = () => {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [now, setNow] = useState(new Date().getTime()); 
  const auth = getAuth(); 
  
  // Ref để theo dõi số lượng đơn PENDING cũ (dùng cho âm thanh)
  const prevPendingCount = useRef(0);
  const isInitialLoad = useRef(true);

  // TABS
  const [activeTab, setActiveTab] = useState('ALL');
  const tabs = [
    { id: 'ALL', label: 'Tất cả' },
    { id: 'PENDING', label: 'Chờ xác nhận' },
    { id: 'PREPARING', label: 'Bếp đang làm' },
    { id: 'DELIVERING', label: 'Đang giao hàng' },
    { id: 'COMPLETED', label: 'Hoàn thành' },
    { id: 'CANCEL_REQUESTED', label: 'Yêu cầu hủy' }
  ];

  // STATE CHO MODAL XÓA ĐƠN BẢO MẬT
  const [deleteModal, setDeleteModal] = useState({ show: false, orderId: null });
  const [deleteData, setDeleteData] = useState({ reason: '', confirmEmail: '' }); 

  // Lấy dữ liệu & Cập nhật biến Now mỗi phút
  useEffect(() => {
    setIsLoading(true);
    const todayStr = new Date().toLocaleDateString('vi-VN');
    
    const unsubscribe = subscribeToOrdersByDate(todayStr, (data) => {
      // 1. TÍNH TOÁN SỐ LƯỢNG ĐƠN ĐANG CHỜ
      const currentPendingCount = data.filter(o => o.status === 'PENDING').length;

      // 2. LOGIC PHÁT ÂM THANH
      if (!isInitialLoad.current && currentPendingCount > prevPendingCount.current) {
        try {
          const audio = new Audio('/new-order.mp3');
          audio.play().catch(e => console.warn("Trình duyệt chặn autoplay âm thanh:", e));
        } catch (error) {
          console.error("Lỗi phát âm thanh:", error);
        }
      }

      // Cập nhật ref và state
      prevPendingCount.current = currentPendingCount;
      if (isInitialLoad.current) isInitialLoad.current = false;
      
      setOrders(data);
      setIsLoading(false);
    });

    const timer = setInterval(() => setNow(new Date().getTime()), 60000); 
    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, []);

  const handleUpdateStatus = async (orderId, newStatus) => {
    await updateOrderStatus(orderId, newStatus);
  };

  const handleFinishOrder = async (order) => {
    if (window.confirm("Xác nhận đơn hàng đã giao thành công?")) {
      const res = await completeOrderWithBonus(order);
      if (res.success) {
        // Thông báo chi tiết hơn nếu có nhận Xu
        if (res.earnedXu > 0) {
          alert(`✅ Đơn hàng hoàn thành!\nKhách hàng đã được tích thêm +${res.earnedXu} Xu.`);
        } else {
          alert("✅ Đơn hàng đã hoàn thành thành công!");
        }
      } else {
        alert("❌ Lỗi: " + res.error);
      }
    }
  };

  const handleConfirmPayment = async (orderId, isPaid) => {
    try {
      await confirmPaymentStatus(orderId, isPaid);
    } catch (error) {
      console.error("Lỗi cập nhật thanh toán:", error);
    }
  };

  // MỞ MODAL XÓA ĐƠN
  const openDeleteModal = (orderId) => {
    setDeleteModal({ show: true, orderId });
    setDeleteData({ reason: '', confirmEmail: '' });
  };

  // XÁC NHẬN XÓA ĐƠN VỚI AUTH
  const confirmDelete = async (e) => {
    e.preventDefault();
    const currentAdminEmail = auth.currentUser?.email;

    if (deleteData.confirmEmail !== currentAdminEmail) {
      return alert("Email xác nhận không khớp với tài khoản Admin đang đăng nhập!");
    }

    if (!deleteData.reason.trim()) {
      return alert("Vui lòng điền lý do xóa!");
    }
    
    const result = await deleteOrderSoft(deleteModal.orderId, deleteData.reason.trim(), currentAdminEmail);
    
    if (result.success) {
      setDeleteModal({ show: false, orderId: null });
    } else {
      alert("Lỗi kết nối khi xóa đơn.");
    }
  };

  // --- MỚI: HÀM COPY SỐ ĐIỆN THOẠI ---
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      alert("✅ Đã sao chép SĐT: " + text);
    }).catch(err => {
      console.error("Lỗi khi sao chép: ", err);
      alert("❌ Trình duyệt không hỗ trợ tự động sao chép.");
    });
  };

  const filteredOrders = orders.filter(order => {
    if (activeTab === 'ALL') return true;
    return order.status === activeTab;
  });

  if (isLoading) return (
    <div className="p-20 text-center">
       <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
       <p className="text-[10px] font-black uppercase text-blue-500 tracking-[0.2em]">Đang đồng bộ đơn bếp...</p>
    </div>
  );

  return (
    <div className="space-y-6 pb-20">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
        <h2 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-tighter">Bếp hôm nay</h2>
        <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-widest">{orders.length} Đơn hàng trong ngày</p>
        
        {/* TABS LỌC TRẠNG THÁI NÂNG CẤP */}
        <div className="flex gap-2 overflow-x-auto pb-2 mt-6 no-scrollbar">
          {tabs.map(tab => (
            <button 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id)} 
              className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all flex items-center gap-2 border-2 ${
                activeTab === tab.id 
                  ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100 dark:shadow-none' 
                  : 'bg-gray-50 border-transparent text-gray-400 dark:bg-gray-700 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
            >
              {tab.label}
              <span className={`${activeTab === tab.id ? 'bg-white/20' : 'bg-white dark:bg-gray-800'} px-2 py-0.5 rounded-lg text-[9px]`}>
                {orders.filter(o => tab.id === 'ALL' || o.status === tab.id).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* DANH SÁCH ĐƠN HÀNG */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
        {filteredOrders.map(order => {
          const statusConfig = ORDER_STATUSES[order.status] || ORDER_STATUSES.PENDING;
          
          // Logic xác định đơn có bị trễ hay không
          const isProcessing = order.status === 'PREPARING' || order.status === 'DELIVERING';
          const isLate = isProcessing && order.confirmedAt && (now > (order.confirmedAt.toDate().getTime() + 30 * 60 * 1000));
          
          // Kiểm tra xem đơn này có thanh toán bằng ví không
          const isWalletPayment = order.paymentMethod === 'WALLET';
          
          // Kiểm tra đơn hẹn giờ
          const isScheduled = order.deliveryType === 'SCHEDULED';

          return (
            <div key={order.id} className={`bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-sm border ${isScheduled && order.status === 'PENDING' ? 'border-orange-300 dark:border-orange-700 shadow-orange-100' : 'border-gray-100 dark:border-gray-700'} overflow-hidden flex flex-col relative group transition-colors`}>
              
              {/* 1. VÒNG ĐẾM NGƯỢC CHẠY QUANH RÌA */}
              <CountdownBorder 
                startTime={order.confirmedAt} 
                isActive={isProcessing} 
              />

              {/* Lớp bọc nội dung */}
              <div className="relative z-10 flex flex-col h-full">
                
                {/* Vạch màu trạng thái bên trái */}
                <div className={`absolute left-0 top-0 bottom-0 w-2 ${
                  order.status === 'PENDING' ? (isScheduled ? 'bg-orange-500' : 'bg-yellow-400') : 
                  order.status === 'PREPARING' ? 'bg-orange-400' : 
                  order.status === 'DELIVERING' ? 'bg-purple-500' : 
                  order.status === 'COMPLETED' ? 'bg-green-500' : 'bg-red-500'
                }`}></div>

                {/* Top Bar */}
                <div className="pl-6 px-4 py-4 bg-gray-50/50 dark:bg-gray-700/30 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center rounded-t-[2.5rem] transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-black text-gray-800 dark:text-white text-lg">#{order.id.slice(-6).toUpperCase()}</span>
                    <span className={`px-3 py-1 rounded-xl text-[9px] uppercase font-black border ${statusConfig.color} dark:bg-opacity-20`}>
                      {statusConfig.label}
                    </span>
                  </div>
                  {/* NÚT XÓA MỞ MODAL */}
                  <button onClick={() => openDeleteModal(order.id)} className="p-2 text-gray-300 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors" title="Xóa đơn hàng">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>

                <div className="p-6 pl-8 space-y-4 flex-1">
                  
                  {/* --- HIỂN THỊ ĐƠN HẸN GIỜ GIAO SAU --- */}
                  {isScheduled && (
                    <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-2xl border border-orange-200 dark:border-orange-800 flex items-center justify-between animate-in fade-in">
                      <p className="text-[10px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-widest flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Giao lúc:
                      </p>
                      <p className="font-black text-orange-700 dark:text-orange-300 text-sm tracking-tighter">{order.scheduledTime}</p>
                    </div>
                  )}

                  {/* Khối Thanh toán */}
                  {order.status !== 'CANCELLED' && (
                    <div className={`p-4 rounded-2xl border flex items-center justify-between transition-colors
                      ${isWalletPayment 
                        ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' 
                        : (order.paymentStatus === 'WAITING_CONFIRM' ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 animate-pulse' : 'bg-gray-50 border-gray-100 dark:bg-gray-700/50 dark:border-gray-600')}
                    `}>
                      <div>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Thanh toán</p>
                        <p className={`text-xs font-black uppercase ${isWalletPayment ? 'text-green-600 dark:text-green-400' : 'text-gray-800 dark:text-gray-200'}`}>
                          {isWalletPayment ? '💳 Ví Plant G' : (order.paymentMethod === 'TRANSFER' ? '🏦 Chuyển khoản' : '💵 Tiền mặt')}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {isWalletPayment ? (
                           <span className="text-green-600 dark:text-green-400 font-black text-[10px] uppercase flex items-center gap-1">✓ Đã trừ ví</span>
                        ) : order.paymentStatus !== 'PAID' ? (
                          <div className="flex flex-col gap-1">
                            <button onClick={() => handleConfirmPayment(order.id, true)} className="bg-green-600 text-white px-2 py-1 rounded-lg text-[8px] font-black uppercase shadow-md hover:bg-green-700 active:scale-95 transition-all">Nhận tiền</button>
                            <button onClick={() => handleConfirmPayment(order.id, false)} className="bg-white dark:bg-gray-800 text-red-500 border border-red-100 dark:border-red-900/50 px-2 py-1 rounded-lg text-[8px] font-black uppercase hover:bg-red-50 dark:hover:bg-red-900/20 active:scale-95 transition-all">Chưa nhận</button>
                          </div>
                        ) : (
                          <span className="text-green-600 dark:text-green-400 font-black text-[10px] uppercase flex items-center gap-1">✓ Đã thu</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Khách xin hủy */}
                  {order.status === 'CANCEL_REQUESTED' && (
                    <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-2xl border border-red-200 dark:border-red-800 animate-in fade-in transition-colors">
                      <p className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase mb-1">Lý do hủy từ khách:</p>
                      <p className="text-xs font-bold text-red-900 dark:text-red-200 italic">"{order.cancelReason || 'Không có lý do'}"</p>
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => handleUpdateStatus(order.id, 'CANCELLED')} className="flex-1 bg-red-600 text-white py-2.5 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-red-200 dark:shadow-none hover:bg-red-700 transition-all active:scale-95">Đồng ý</button>
                        <button onClick={() => handleUpdateStatus(order.id, 'PREPARING')} className="flex-1 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 py-2.5 rounded-xl text-[10px] font-black uppercase hover:bg-gray-100 dark:hover:bg-gray-700 transition-all active:scale-95">Từ chối</button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[9px] font-black text-gray-400 uppercase mb-1 tracking-widest">Khách hàng</p>
                      <p className="font-black text-gray-800 dark:text-white leading-none truncate">{order.customer}</p>
                      
                      {/* --- MỚI: NÚT COPY SĐT --- */}
                      <div className="flex items-center gap-1 mt-1">
                        <p className="text-blue-600 dark:text-blue-400 font-bold text-[10px]">{order.phone}</p>
                        <button 
                          onClick={() => copyToClipboard(order.phone)}
                          className="p-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                          title="Sao chép SĐT"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        </button>
                      </div>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-gray-400 uppercase mb-1 tracking-widest">Thời gian đặt</p>
                      <p className="font-medium text-gray-600 dark:text-gray-300 leading-tight text-xs">{order.time}</p>
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 transition-colors">
                    <p className="text-[9px] font-black text-gray-400 uppercase mb-2 tracking-widest">Chi tiết món</p>
                    <p className="text-sm font-black text-gray-800 dark:text-gray-100 leading-relaxed">{order.items}</p>
                    {order.note && (
                      <div className="mt-3 pt-3 border-t border-dashed border-gray-200 dark:border-gray-600">
                         <p className="text-[10px] text-orange-600 dark:text-orange-400 font-bold uppercase">Ghi chú: <span className="italic text-gray-600 dark:text-gray-300 normal-case font-medium">"{order.note}"</span></p>
                      </div>
                    )}
                    {order.address && (
                      <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 mt-2 uppercase tracking-wide">📍 Giao tới: <span className="text-gray-700 dark:text-gray-200 normal-case block line-clamp-2">{order.address}</span></p>
                    )}
                  </div>
                </div>

                {/* KHỐI XỬ LÝ BỒI THƯỜNG KHI ĐƠN TRỄ */}
                { isLate && !order.lateVoucherStatus && (
                  <div className="mx-6 mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl animate-pulse transition-colors">
                    <p className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase text-center mb-3">
                      ⚠️ ĐƠN TRỄ 30P! TẶNG VOUCHER 5K?
                    </p>
                    <div className="flex gap-2">
                      <button 
                        onClick={async () => {
                          if (window.confirm("Đồng ý tặng khách 5.000đ bồi thường?")) {
                            await awardLateVoucher(order.phone, order.id);
                            alert("Đã tặng mã thành công!");
                          }
                        }}
                        className="flex-1 bg-green-600 text-white py-2 rounded-xl text-[9px] font-black uppercase shadow-md hover:bg-green-700 transition-colors"
                      >
                        Đồng ý tặng
                      </button>
                      <button 
                        onClick={async () => {
                          if (window.confirm("Từ chối bồi thường đơn này?")) {
                            const ref = doc(db, 'orders', order.id);
                            await updateDoc(ref, { lateVoucherStatus: 'DECLINED' });
                          }
                        }}
                        className="flex-1 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600 py-2 rounded-xl text-[9px] font-black uppercase hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        Từ chối
                      </button>
                    </div>
                  </div>
                )}

                {order.lateVoucherStatus === 'AWARDED' && (
                  <p className="mx-6 mb-4 text-[9px] font-black text-green-600 dark:text-green-400 uppercase text-center bg-green-50 dark:bg-green-900/20 py-2 rounded-xl border border-green-100 dark:border-green-800 transition-colors">
                    ✓ Đã gửi Voucher bồi thường
                  </p>
                )}
                {order.lateVoucherStatus === 'DECLINED' && (
                  <p className="mx-6 mb-4 text-[9px] font-black text-gray-400 uppercase text-center bg-gray-50 dark:bg-gray-700/50 py-2 rounded-xl border border-gray-200 dark:border-gray-700 transition-colors">
                    ✕ Đã từ chối bồi thường
                  </p>
                )}

                {/* Footer Actions */}
                <div className="pl-6 px-4 py-4 bg-gray-50/30 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 flex flex-wrap justify-between items-center gap-3 rounded-b-[2.5rem] transition-colors">
                  
                  {/* HIỂN THỊ TỔNG TIỀN THEO HÌNH THỨC */}
                  <div className="flex flex-col">
                    <span className={`text-xl font-black tracking-tighter ${isWalletPayment ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-red-500 dark:text-red-400'}`}>
                      {order.total}
                    </span>
                    {isWalletPayment && (
                      <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-md uppercase mt-1">
                        Thu 0đ
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {!['COMPLETED', 'CANCELLED', 'CANCEL_REQUESTED'].includes(order.status) && (
                      <button 
                        onClick={() => { if(window.confirm("Xác nhận hủy đơn của khách?")) handleUpdateStatus(order.id, 'CANCELLED') }}
                        className="bg-white dark:bg-gray-800 border border-red-200 dark:border-red-900/50 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-2.5 rounded-xl text-[9px] font-black uppercase transition-colors"
                      >
                        Hủy
                      </button>
                    )}

                    {order.status === 'PENDING' && (
                      <button onClick={() => handleUpdateStatus(order.id, 'PREPARING')} className="bg-blue-600 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-blue-100 dark:shadow-none active:scale-95 hover:bg-blue-700 transition-all">Nhận đơn</button>
                    )}
                    {order.status === 'PREPARING' && (
                      <button onClick={() => handleUpdateStatus(order.id, 'DELIVERING')} className="bg-orange-500 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-orange-100 dark:shadow-none active:scale-95 hover:bg-orange-600 transition-all">Giao ship</button>
                    )}
                    {order.status === 'DELIVERING' && (
                      <button onClick={() => handleFinishOrder(order)} className="bg-green-600 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-green-100 dark:shadow-none active:scale-95 hover:bg-green-700 transition-all">Hoàn thành</button>
                    )}
                  </div>
                </div>

              </div>
            </div>
          );
        })}
        
        {filteredOrders.length === 0 && (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-[2.5rem] transition-colors">
            <p className="text-[10px] font-black text-gray-300 dark:text-gray-500 uppercase tracking-widest">Không có đơn hàng nào trong mục này</p>
          </div>
        )}
      </div>

      {/* MODAL NHẬP LÝ DO XÓA ĐƠN BẢO MẬT */}
      {deleteModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200 transition-colors">
            <h2 className="text-lg font-black text-red-600 dark:text-red-500 uppercase tracking-tighter mb-2">Bảo mật Xóa Đơn</h2>
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-400 uppercase tracking-widest mb-6 leading-relaxed">
              Yêu cầu xác nhận quyền Admin để thực hiện thao tác xóa và hoàn voucher.
            </p>
            
            <form onSubmit={confirmDelete} className="space-y-4">
              <div>
                <label className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1 block mb-2">Tài khoản Admin hiện tại</label>
                <input 
                  type="text" disabled 
                  value={auth.currentUser?.email || "Chưa đăng nhập"} 
                  className="w-full bg-gray-100 dark:bg-gray-700 border-none rounded-xl px-5 py-4 text-sm font-bold text-gray-500 dark:text-gray-400 outline-none cursor-not-allowed transition-colors" 
                />
              </div>
              <div>
                <label className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest ml-1 block mb-2">Nhập lại Email để xác nhận *</label>
                <input 
                  type="email" required 
                  value={deleteData.confirmEmail} 
                  onChange={e => setDeleteData({...deleteData, confirmEmail: e.target.value})} 
                  placeholder="Nhập email admin..." 
                  className="w-full bg-blue-50 dark:bg-gray-700 dark:text-white border-none rounded-xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-colors placeholder:text-gray-400" 
                />
              </div>
              <div>
                <label className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1 block mb-2">Lý do xóa đơn *</label>
                <textarea 
                  required rows="2"
                  value={deleteData.reason} 
                  onChange={e => setDeleteData({...deleteData, reason: e.target.value})} 
                  placeholder="Ghi rõ lý do..." 
                  className="w-full bg-gray-50 dark:bg-gray-700 dark:text-white border-none rounded-xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-red-500 outline-none resize-none transition-colors placeholder:text-gray-400" 
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setDeleteModal({show: false, orderId: null})} className="flex-1 py-4 text-[10px] font-black text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-2xl uppercase tracking-widest transition-colors">Hủy bỏ</button>
                <button type="submit" className="flex-[1.5] py-4 text-[10px] font-black text-white bg-red-600 rounded-2xl uppercase tracking-widest shadow-lg shadow-red-200 dark:shadow-none active:scale-95 transition-all hover:bg-red-700">Xóa vĩnh viễn</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageOrders;