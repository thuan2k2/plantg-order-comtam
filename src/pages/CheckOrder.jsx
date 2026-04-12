import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge'; 
import { subscribeToOrdersByPhone, updateOrderStatus } from '../services/orderService'; 

const CheckOrder = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const userPhoneParam = searchParams.get('user') || '';
  
  const [phoneInput, setPhoneInput] = useState(userPhoneParam);
  const [orders, setOrders] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Đồng bộ input khi URL thay đổi
  useEffect(() => {
    if (userPhoneParam) {
      setPhoneInput(userPhoneParam);
    }
  }, [userPhoneParam]);

  // LẮNG NGHE DỮ LIỆU THỜI GIAN THỰC
  useEffect(() => {
    let unsubscribe = () => {}; // Khởi tạo hàm xóa đăng ký trống

    const startListening = () => {
      if (userPhoneParam && userPhoneParam.length >= 10) {
        setIsSearching(true);
        
        // Gọi hàm subscribe từ orderService
        unsubscribe = subscribeToOrdersByPhone(userPhoneParam, (updatedOrders) => {
          setOrders(updatedOrders);
          setIsSearching(false);
        });
      } else {
        setOrders([]);
        setIsSearching(false);
      }
    };

    startListening();

    // Dọn dẹp kết nối khi component bị hủy hoặc userPhoneParam thay đổi
    return () => unsubscribe();
  }, [userPhoneParam]);

  const handleSearch = (e) => {
    e.preventDefault();
    const cleanPhone = phoneInput.trim();
    if (cleanPhone.length < 10) {
      alert("Vui lòng nhập số điện thoại hợp lệ.");
      return;
    }
    setSearchParams({ user: cleanPhone });
  };

  const handleCancelOrder = async (orderId, currentStatus) => {
    // Chỉ cho phép hủy khi đơn chưa quá trình giao/hoàn thành
    if (['PENDING', 'CONFIRMED', 'PREPARING'].includes(currentStatus)) {
      if (window.confirm('Bạn muốn gửi yêu cầu huỷ đơn hàng này?')) {
        const result = await updateOrderStatus(orderId, 'CANCEL_REQUESTED');
        if (result.success) {
          // Lưu ý: Không cần setOrders thủ công vì onSnapshot sẽ tự cập nhật UI
          alert('Đã gửi yêu cầu huỷ thành công.');
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="bg-white px-4 py-3 border-b flex items-center shadow-sm sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="text-gray-600 p-1 mr-3 hover:bg-gray-100 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <h1 className="text-[16px] font-bold text-gray-800 tracking-tight">Tra cứu đơn hàng</h1>
      </div>

      <div className="p-4 max-w-lg mx-auto">
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
            <button type="submit" className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md active:scale-95 transition-all">
              {isSearching ? '...' : 'Tìm'}
            </button>
          </div>
        </form>

        {isSearching ? (
          <div className="text-center py-20 text-gray-400">
             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
             <p className="text-xs font-bold uppercase tracking-widest">Đang kết nối dữ liệu...</p>
          </div>
        ) : userPhoneParam && orders.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200 text-gray-400 font-medium">
            Chưa tìm thấy đơn hàng nào cho SĐT này.
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 overflow-hidden transition-all">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-mono text-xs font-black text-gray-400 uppercase tracking-widest">#{order.id.slice(-6).toUpperCase()}</span>
                  <span className="text-[11px] font-medium text-gray-400 italic">{order.time}</span>
                </div>
                <div className="mb-4">
                  <StatusBadge status={order.status} />
                </div>
                <div className="space-y-1 mb-4">
                  <p className="text-[14px] text-gray-800 font-bold leading-relaxed">{order.items}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-gray-400 font-black uppercase">Tổng cộng:</span>
                    <p className="text-lg font-black text-red-500 tracking-tighter">{order.total}</p>
                  </div>
                </div>

                {['PENDING', 'CONFIRMED', 'PREPARING'].includes(order.status) && (
                  <button 
                    onClick={() => handleCancelOrder(order.id, order.status)}
                    className="w-full text-[11px] font-black text-red-500 py-3 rounded-xl border border-red-100 bg-red-50/30 hover:bg-red-50 transition-all uppercase tracking-widest"
                  >
                    Huỷ đơn / Thay đổi
                  </button>
                )}
                
                {order.status === 'CANCEL_REQUESTED' && (
                  <div className="w-full text-center py-2.5 bg-yellow-50 text-yellow-700 text-[10px] font-black uppercase rounded-lg border border-yellow-100 animate-pulse">
                    Đã gửi yêu cầu huỷ - Đang chờ xử lý
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CheckOrder;