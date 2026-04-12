import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge'; 
import { getOrdersByPhone, updateOrderStatus } from '../services/orderService'; 

const CheckOrder = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Lấy SĐT từ URL (ví dụ: ?user=0901234567)
  const userPhoneParam = searchParams.get('user') || '';
  
  const [phoneInput, setPhoneInput] = useState(userPhoneParam);
  const [orders, setOrders] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Gọi API Firebase mỗi khi tham số 'user' trên URL thay đổi
  useEffect(() => {
    const fetchOrders = async () => {
      // Chỉ tìm kiếm khi SĐT có ít nhất 10 ký tự để tiết kiệm tài nguyên Firebase
      if (userPhoneParam && userPhoneParam.length >= 10) {
        setIsSearching(true);
        try {
          const userOrders = await getOrdersByPhone(userPhoneParam);
          setOrders(userOrders);
        } catch (error) {
          console.error("Lỗi tải đơn hàng:", error);
          alert("Không thể kết nối với máy chủ. Vui lòng kiểm tra lại mạng.");
        } finally {
          setIsSearching(false);
        }
      } else {
        setOrders([]);
      }
    };

    fetchOrders();
  }, [userPhoneParam]);

  const handleSearch = (e) => {
    e.preventDefault();
    const cleanPhone = phoneInput.trim();
    if (!cleanPhone) {
      alert("Vui lòng nhập số điện thoại để tra cứu.");
      return;
    }
    // Cập nhật URL, từ đó kích hoạt useEffect ở trên
    setSearchParams({ user: cleanPhone });
  };

  const handleCancelOrder = async (orderId, currentStatus) => {
    // 1. Huỷ trực tiếp (Khi đơn mới hoặc đã xác nhận nhưng chưa nấu)
    if (['PENDING', 'CONFIRMED', 'SCHEDULED'].includes(currentStatus)) {
      if (window.confirm('Bạn có chắc chắn muốn huỷ đơn hàng này không?')) {
        const result = await updateOrderStatus(orderId, 'CANCEL_REQUESTED'); // Chuyển sang yêu cầu huỷ để Admin duyệt
        if (result.success) {
          setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'CANCEL_REQUESTED' } : o));
          alert('Đã gửi yêu cầu huỷ đơn thành công.');
        }
      }
    } 
    // 2. Yêu cầu huỷ (Khi bếp đã bắt đầu làm hoặc đang giao)
    else if (['PREPARING', 'DELIVERING'].includes(currentStatus)) {
      if (window.confirm('Đơn hàng đang được xử lý. Bạn muốn gửi yêu cầu huỷ gấp đến cửa hàng?')) {
        const result = await updateOrderStatus(orderId, 'CANCEL_REQUESTED');
        if (result.success) {
          setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'CANCEL_REQUESTED' } : o));
          alert('Yêu cầu huỷ đã được gửi. Vui lòng đợi xác nhận từ cửa hàng.');
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Header cố định */}
      <div className="bg-white px-4 py-3 border-b flex items-center shadow-sm sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="text-gray-600 hover:bg-gray-100 p-1 rounded mr-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <h1 className="text-[16px] font-bold text-gray-800 tracking-tight">Lịch sử đơn hàng</h1>
      </div>

      <div className="p-4 max-w-lg mx-auto">
        {/* Form tìm kiếm */}
        <form onSubmit={handleSearch} className="mb-6 bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Số điện thoại tra cứu</label>
          <div className="flex gap-2">
            <input
              type="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="Nhập SĐT (ví dụ: 090...)"
              className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            <button 
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md active:scale-95 whitespace-nowrap"
            >
              Tìm kiếm
            </button>
          </div>
        </form>

        {/* Trạng thái Loading */}
        {isSearching ? (
          <div className="text-center py-16 text-gray-400">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-sm font-medium">Đang tìm đơn hàng của bạn...</p>
          </div>
        ) : userPhoneParam && orders.length === 0 ? (
          /* Trạng thái không có đơn */
          <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-gray-100 px-6">
            <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
               </svg>
            </div>
            <p className="text-gray-500 text-sm">Không tìm thấy đơn hàng nào cho SĐT này.</p>
            <button 
              onClick={() => navigate('/order')} 
              className="mt-6 w-full bg-gray-800 text-white py-3 rounded-xl font-bold text-sm hover:bg-black transition-colors"
            >
              Đặt món ngay
            </button>
          </div>
        ) : (
          /* Danh sách đơn hàng từ Firebase */
          <div className="space-y-4">
            {orders.map((order) => {
              const canCancel = ['PENDING', 'CONFIRMED', 'PREPARING', 'DELIVERING'].includes(order.status);

              return (
                <div key={order.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transform transition-all active:scale-[0.99]">
                  <div className="px-5 py-3.5 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
                    <span className="font-mono text-xs font-black text-gray-400 uppercase tracking-widest">
                      Mã: #{order.id.slice(-6)}
                    </span>
                    <span className="text-[11px] font-medium text-gray-400 bg-white border border-gray-100 px-2 py-0.5 rounded-full">
                      {order.time}
                    </span>
                  </div>
                  
                  <div className="p-5">
                    <div className="mb-4">
                      <StatusBadge status={order.status} />
                    </div>
                    
                    <div className="space-y-2 mb-5">
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-bold text-gray-400 uppercase mt-0.5 w-16">Chi tiết:</span>
                        <p className="text-[14px] text-gray-800 font-medium leading-relaxed">{order.items}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-400 uppercase w-16">Tổng:</span>
                        <p className="text-lg font-black text-red-500">{order.total}</p>
                      </div>
                    </div>

                    {canCancel && order.status !== 'CANCEL_REQUESTED' && order.status !== 'CANCELLED' && (
                      <div className="pt-4 border-t border-gray-100">
                        <button
                          onClick={() => handleCancelOrder(order.id, order.status)}
                          className="w-full text-xs font-bold text-red-500 py-2.5 rounded-xl border border-red-100 bg-red-50/50 hover:bg-red-50 transition-colors uppercase tracking-wider"
                        >
                          Huỷ đơn / Thay đổi
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