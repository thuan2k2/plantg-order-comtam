import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge'; 
import { getOrdersByPhone, updateOrderStatus } from '../services/orderService'; 

const CheckOrder = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Lấy SĐT từ URL (?user=0333...) để tự động tra cứu nếu khách vừa đặt hàng xong
  const userPhoneParam = searchParams.get('user') || '';
  
  const [phoneInput, setPhoneInput] = useState(userPhoneParam);
  const [orders, setOrders] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // 1. Tự động đồng bộ input khi URL thay đổi
  useEffect(() => {
    if (userPhoneParam) {
      setPhoneInput(userPhoneParam);
    }
  }, [userPhoneParam]);

  // 2. Gọi API tra cứu đơn hàng từ Firebase mỗi khi tham số 'user' thay đổi
  useEffect(() => {
    const fetchOrders = async () => {
      if (userPhoneParam && userPhoneParam.length >= 10) {
        setIsSearching(true);
        try {
          const userOrders = await getOrdersByPhone(userPhoneParam);
          setOrders(userOrders);
        } catch (error) {
          console.error("Lỗi tra cứu đơn hàng:", error);
        } finally {
          setIsSearching(false);
        }
      } else {
        setOrders([]);
      }
    };
    fetchOrders();
  }, [userPhoneParam]);

  // Xử lý khi khách nhấn nút "Tìm kiếm" thủ công
  const handleSearch = (e) => {
    e.preventDefault();
    const cleanPhone = phoneInput.trim();
    if (cleanPhone.length < 10) {
      alert("Vui lòng nhập số điện thoại hợp lệ.");
      return;
    }
    // Đẩy SĐT lên URL để kích hoạt useEffect tải dữ liệu
    setSearchParams({ user: cleanPhone });
  };

  // Khách gửi yêu cầu hủy đơn
  const handleCancelOrder = async (orderId, currentStatus) => {
    const cancellableStatuses = ['PENDING', 'CONFIRMED', 'PREPARING', 'DELIVERING'];
    
    if (cancellableStatuses.includes(currentStatus)) {
      const confirmMsg = currentStatus === 'PENDING' 
        ? 'Bạn có chắc chắn muốn huỷ đơn hàng này không?' 
        : 'Đơn hàng đang được thực hiện, bạn có muốn gửi yêu cầu huỷ đến cửa hàng không?';

      if (window.confirm(confirmMsg)) {
        const result = await updateOrderStatus(orderId, 'CANCEL_REQUESTED');
        if (result.success) {
          // Cập nhật trạng thái ngay lập tức trên giao diện
          setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'CANCEL_REQUESTED' } : o));
          alert('Yêu cầu huỷ đơn đã được gửi đi thành công.');
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <div className="bg-white px-4 py-3 border-b flex items-center shadow-sm sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="text-gray-600 p-1 mr-3 hover:bg-gray-100 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <h1 className="text-[16px] font-bold text-gray-800 tracking-tight">Tra cứu đơn hàng</h1>
      </div>

      <div className="p-4 max-w-lg mx-auto">
        {/* Form tìm kiếm */}
        <form onSubmit={handleSearch} className="mb-6 bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Số điện thoại của bạn</label>
          <div className="flex gap-2">
            <input
              type="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="Nhập SĐT để xem lịch sử..."
              className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-all"
            />
            <button 
              type="submit" 
              disabled={isSearching}
              className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md active:scale-95 transition-all"
            >
              {isSearching ? '...' : 'Tìm'}
            </button>
          </div>
        </form>

        {/* Danh sách đơn hàng */}
        {isSearching ? (
          <div className="text-center py-20 text-gray-400">
             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
             <p className="text-xs font-bold uppercase tracking-widest">Đang tìm đơn hàng...</p>
          </div>
        ) : userPhoneParam && orders.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200 text-gray-400">
            Không tìm thấy đơn hàng nào cho SĐT này.
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const statusConfig = order.status;

              return (
                <div key={order.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
                    <span className="font-mono text-xs font-black text-gray-400 uppercase">
                      #{order.id.slice(-6).toUpperCase()}
                    </span>
                    <span className="text-[11px] font-medium text-gray-400">{order.time}</span>
                  </div>
                  
                  <div className="p-5">
                    <div className="mb-4">
                      <StatusBadge status={order.status} />
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      <p className="text-[14px] text-gray-800 font-medium leading-relaxed">{order.items}</p>
                      <div className="flex justify-between items-center pt-2">
                        <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Tổng tiền:</span>
                        <span className="text-lg font-black text-red-500">{order.total}</span>
                      </div>
                    </div>

                    {/* Nút hủy dành cho khách */}
                    {['PENDING', 'CONFIRMED', 'PREPARING', 'DELIVERING'].includes(order.status) && order.status !== 'CANCEL_REQUESTED' && (
                      <button
                        onClick={() => handleCancelOrder(order.id, order.status)}
                        className="w-full text-[11px] font-black py-3 rounded-xl border border-red-100 text-red-500 bg-red-50/30 hover:bg-red-50 transition-all uppercase tracking-widest"
                      >
                        Huỷ đơn / Thay đổi
                      </button>
                    )}
                    
                    {order.status === 'CANCEL_REQUESTED' && (
                      <div className="w-full text-center py-2.5 bg-yellow-50 text-yellow-700 text-[10px] font-bold uppercase rounded-lg border border-yellow-100">
                        Đã gửi yêu cầu huỷ - Đang chờ xử lý
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CheckOrder;