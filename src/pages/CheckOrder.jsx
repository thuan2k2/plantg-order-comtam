import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge'; // Tận dụng component đã viết
import { getOrdersByPhone, updateOrderStatus } from '../services/orderService'; // Import API thật

const CheckOrder = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Lấy SĐT từ URL
  const userPhoneParam = searchParams.get('user') || '';
  
  const [phoneInput, setPhoneInput] = useState(userPhoneParam);
  const [orders, setOrders] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Gọi API Firebase mỗi khi userPhoneParam trên URL thay đổi
  useEffect(() => {
    const fetchOrders = async () => {
      if (userPhoneParam) {
        setIsSearching(true);
        try {
          // Lấy dữ liệu thật từ Firestore
          const userOrders = await getOrdersByPhone(userPhoneParam);
          setOrders(userOrders);
        } catch (error) {
          console.error("Lỗi tải đơn hàng:", error);
          alert("Không thể tải đơn hàng, vui lòng thử lại sau.");
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
    if (!phoneInput.trim()) return;
    setSearchParams({ user: phoneInput });
  };

  // Cập nhật hàm huỷ đơn để bắn API lên Firebase
  const handleCancelOrder = async (orderId, currentStatus) => {
    if (['PENDING', 'CONFIRMED', 'SCHEDULED'].includes(currentStatus)) {
      const confirmDirectCancel = window.confirm('Bạn có chắc chắn muốn huỷ đơn hàng này không?');
      if (confirmDirectCancel) {
        // Gọi API cập nhật Firebase
        const result = await updateOrderStatus(orderId, 'CANCELLED');
        if (result.success) {
          // Cập nhật lại giao diện ngay lập tức mà không cần tải lại trang
          setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'CANCELLED' } : o));
          alert('Đã huỷ đơn hàng thành công.');
        }
      }
    } 
    else if (['PREPARING', 'DELIVERING'].includes(currentStatus)) {
      const confirmRequestCancel = window.confirm('Đơn hàng của bạn đang được chuẩn bị/giao. Bạn có muốn gửi yêu cầu huỷ đến bếp không?');
      if (confirmRequestCancel) {
        // Gọi API cập nhật Firebase
        const result = await updateOrderStatus(orderId, 'CANCEL_REQUESTED');
        if (result.success) {
          setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'CANCEL_REQUESTED' } : o));
          alert('Đã gửi yêu cầu huỷ đơn. Vui lòng chờ bếp phản hồi.');
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="bg-white px-4 py-3 border-b flex items-center shadow-sm sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="text-gray-600 hover:bg-gray-100 p-1 rounded mr-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <h1 className="text-[16px] font-semibold text-gray-800">Kiểm tra đơn hàng</h1>
      </div>

      <div className="p-4 max-w-lg mx-auto">
        <form onSubmit={handleSearch} className="mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <label className="block text-sm font-medium text-gray-700 mb-2">Tra cứu theo Username (SĐT)</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="Nhập số điện thoại..."
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
            <button 
              type="submit"
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
            >
              Tìm kiếm
            </button>
          </div>
        </form>

        {isSearching ? (
          <div className="text-center py-10 text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3"></div>
            Đang tải dữ liệu từ máy chủ...
          </div>
        ) : userPhoneParam && orders.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-xl shadow-sm border border-gray-100">
            <p className="text-gray-500">Không tìm thấy đơn hàng nào cho SĐT: <span className="font-semibold text-gray-700">{userPhoneParam}</span></p>
            <button onClick={() => navigate('/order')} className="mt-4 text-blue-500 hover:underline text-sm font-medium">
              Đi đến trang Đặt món
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const canDirectCancel = ['PENDING', 'CONFIRMED', 'SCHEDULED'].includes(order.status);
              const canRequestCancel = ['PREPARING', 'DELIVERING'].includes(order.status);
              const canTakeAction = canDirectCancel || canRequestCancel;

              return (
                <div key={order.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                    {/* ID đơn hàng thật từ Firebase thường khá dài, ta có thể cắt ngắn 6 ký tự cuối cho đẹp */}
                    <span className="font-mono text-sm font-semibold text-gray-700 uppercase">
                      #{order.id.slice(-6)}
                    </span>
                    <span className="text-[12px] text-gray-500">{order.time}</span>
                  </div>
                  
                  <div className="p-4">
                    <div className="mb-3">
                      <StatusBadge status={order.status} />
                    </div>
                    
                    <p className="text-sm text-gray-800 mb-2 leading-relaxed">
                      <span className="font-semibold">Món ăn:</span> {order.items}
                    </p>
                    <p className="text-sm text-gray-800 font-semibold mb-4">
                      Tổng cộng: <span className="text-red-500">{order.total}</span>
                    </p>

                    {canTakeAction && (
                      <div className="pt-3 border-t border-gray-100 flex justify-end">
                        <button
                          onClick={() => handleCancelOrder(order.id, order.status)}
                          className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors border ${
                            canDirectCancel 
                              ? 'text-red-600 border-red-200 bg-red-50 hover:bg-red-100' 
                              : 'text-orange-600 border-orange-200 bg-orange-50 hover:bg-orange-100'
                          }`}
                        >
                          {canDirectCancel ? 'Huỷ đơn hàng' : 'Gửi yêu cầu huỷ đơn'}
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