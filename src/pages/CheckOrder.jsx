import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge'; 
import { getOrdersByPhone, updateOrderStatus } from '../services/orderService'; 

const CheckOrder = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Lấy SĐT từ URL (?user=...)
  const userPhoneParam = searchParams.get('user') || '';
  
  const [phoneInput, setPhoneInput] = useState(userPhoneParam);
  const [orders, setOrders] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Cập nhật input khi URL thay đổi (trường hợp khách nhấn quay lại hoặc link trực tiếp)
  useEffect(() => {
    if (userPhoneParam) {
      setPhoneInput(userPhoneParam);
    }
  }, [userPhoneParam]);

  // Hàm gọi API tra cứu đơn hàng
  useEffect(() => {
    const fetchOrders = async () => {
      // Chỉ thực hiện truy vấn nếu SĐT hợp lệ (từ 10 số trở lên)
      if (userPhoneParam && userPhoneParam.length >= 10) {
        setIsSearching(true);
        try {
          // Gọi service đã được fix lỗi Index và Timestamp
          const userOrders = await getOrdersByPhone(userPhoneParam);
          setOrders(userOrders);
        } catch (error) {
          console.error("Lỗi tra cứu:", error);
          // Thông báo này thường xuất hiện nếu chưa tạo Index trên Firebase
          alert("Có lỗi xảy ra khi tải dữ liệu. Vui lòng thử lại sau.");
        } finally {
          setIsSearching(false);
        }
      } else {
        setOrders([]);
      }
    };

    fetchOrders();
  }, [userPhoneParam]); // Chạy lại khi tham số 'user' trên URL thay đổi

  const handleSearch = (e) => {
    e.preventDefault();
    const cleanPhone = phoneInput.trim();
    if (cleanPhone.length < 10) {
      alert("Vui lòng nhập số điện thoại hợp lệ (10 chữ số).");
      return;
    }
    // Đẩy SĐT lên URL để trigger useEffect fetch dữ liệu
    setSearchParams({ user: cleanPhone });
  };

  const handleCancelOrder = async (orderId, currentStatus) => {
    // Chỉ cho phép gửi yêu cầu huỷ nếu đơn chưa bị huỷ hoặc chưa hoàn thành
    const cancellableStatuses = ['PENDING', 'CONFIRMED', 'PREPARING', 'DELIVERING'];
    
    if (cancellableStatuses.includes(currentStatus)) {
      const confirmMsg = currentStatus === 'PENDING' 
        ? 'Bạn có chắc chắn muốn huỷ đơn hàng này không?' 
        : 'Đơn hàng đang được thực hiện, bạn có muốn gửi yêu cầu huỷ đến cửa hàng không?';

      if (window.confirm(confirmMsg)) {
        // Cập nhật trạng thái thành yêu cầu huỷ để Admin duyệt
        const result = await updateOrderStatus(orderId, 'CANCEL_REQUESTED');
        if (result.success) {
          // Cập nhật state cục bộ để UI thay đổi ngay lập tức
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
        <button onClick={() => navigate(-1)} className="text-gray-600 hover:bg-gray-100 p-1 rounded mr-3">
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
              className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            <button 
              type="submit"
              disabled={isSearching}
              className={`bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md active:scale-95 whitespace-nowrap ${isSearching ? 'opacity-50' : ''}`}
            >
              {isSearching ? 'Đang tìm...' : 'Tìm kiếm'}
            </button>
          </div>
        </form>

        {/* Kết quả */}
        {isSearching ? (
          <div className="text-center py-16 text-gray-400">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-sm font-medium">Đang tải danh sách đơn hàng...</p>
          </div>
        ) : userPhoneParam && orders.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-gray-100 px-6">
            <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
               </svg>
            </div>
            <p className="text-gray-500 text-sm">Chưa tìm thấy đơn hàng nào cho SĐT này.</p>
            <button 
              onClick={() => navigate('/order')} 
              className="mt-6 w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors"
            >
              Đặt món ngay
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const cancellable = ['PENDING', 'CONFIRMED', 'PREPARING', 'DELIVERING'].includes(order.status);

              return (
                <div key={order.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-all">
                  <div className="px-5 py-3.5 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
                    <span className="font-mono text-xs font-black text-gray-500 uppercase tracking-widest">
                      Mã: #{order.id.slice(-6)}
                    </span>
                    <span className="text-[11px] font-medium text-gray-400">
                      {order.time}
                    </span>
                  </div>
                  
                  <div className="p-5">
                    <div className="mb-4">
                      <StatusBadge status={order.status} />
                    </div>
                    
                    <div className="space-y-3 mb-5">
                      <div className="flex items-start gap-2">
                        <span className="text-[11px] font-bold text-gray-400 uppercase mt-1 w-16 flex-shrink-0">Đơn hàng:</span>
                        <p className="text-[14px] text-gray-800 font-medium leading-relaxed">{order.items}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-gray-400 uppercase w-16">Tổng tiền:</span>
                        <p className="text-lg font-black text-red-500">{order.total}</p>
                      </div>
                    </div>

                    {cancellable && (
                      <div className="pt-4 border-t border-gray-50">
                        <button
                          disabled={order.status === 'CANCEL_REQUESTED'}
                          onClick={() => handleCancelOrder(order.id, order.status)}
                          className={`w-full text-[11px] font-black py-2.5 rounded-xl border transition-all uppercase tracking-widest ${
                            order.status === 'CANCEL_REQUESTED'
                            ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                            : 'text-red-500 border-red-100 bg-red-50/30 hover:bg-red-50'
                          }`}
                        >
                          {order.status === 'CANCEL_REQUESTED' ? 'Đã gửi yêu cầu huỷ' : 'Huỷ / Thay đổi đơn'}
                        </button>
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