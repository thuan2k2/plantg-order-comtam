import React, { useState, useEffect } from 'react';
// Import thêm hàm subscribeToAllOrders để lắng nghe thời gian thực
import { subscribeToAllOrders, updateOrderStatus } from '../../services/orderService';
import StatusBadge from '../../components/StatusBadge';

// Từ điển trạng thái đồng bộ với hệ thống
const ORDER_STATUSES = {
  PENDING: { label: 'Chờ xác nhận', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  CONFIRMED: { label: 'Đã xác nhận', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  PREPARING: { label: 'Đang chuẩn bị', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  DELIVERING: { label: 'Đang giao hàng', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  COMPLETED: { label: 'Đã hoàn thành', color: 'bg-green-100 text-green-700 border-green-200' },
  CANCELLED: { label: 'Đã huỷ', color: 'bg-red-100 text-red-700 border-red-200' },
  CANCEL_REQUESTED: { label: 'Yêu cầu huỷ', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' }
};

const ManageOrders = () => {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');

  // Lắng nghe dữ liệu thời gian thực từ Firebase
  useEffect(() => {
    setIsLoading(true);

    /** * Sử dụng subscribeToAllOrders thay vì getAllOrders.
     * Firebase sẽ tự động đẩy dữ liệu mới về đây mỗi khi:
     * 1. Có khách đặt đơn mới.
     * 2. Khách gửi yêu cầu hủy đơn.
     * 3. Bạn cập nhật trạng thái đơn hàng.
     */
    const unsubscribe = subscribeToAllOrders((data) => {
      setOrders(data);
      setIsLoading(false);
    });

    // Quan trọng: Ngắt kết nối khi thoát khỏi trang Admin để tránh tốn băng thông
    return () => unsubscribe();
  }, []);

  // Cập nhật trạng thái đơn hàng lên Firestore
  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      const result = await updateOrderStatus(orderId, newStatus);
      if (!result.success) {
        alert("Lỗi cập nhật: " + result.error);
      }
      // Lưu ý: Không cần setOrders thủ công vì onSnapshot (unsubscribe) sẽ tự cập nhật UI
    } catch (error) {
      console.error("Lỗi thao tác đơn hàng:", error);
    }
  };

  const handleCancelAction = async (orderId, isApproved) => {
    const nextStatus = isApproved ? 'CANCELLED' : 'PREPARING';
    const confirmMsg = isApproved 
      ? "Xác nhận ĐỒNG Ý huỷ đơn hàng này?" 
      : "Từ chối huỷ? Đơn hàng sẽ quay lại trạng thái 'Đang chuẩn bị'.";
    
    if (window.confirm(confirmMsg)) {
      await handleUpdateStatus(orderId, nextStatus);
    }
  };

  const filteredOrders = orders.filter(order => {
    if (activeTab === 'ALL') return true;
    if (activeTab === 'PENDING') return order.status === 'PENDING';
    if (activeTab === 'ACTIVE') return ['CONFIRMED', 'PREPARING', 'DELIVERING'].includes(order.status);
    if (activeTab === 'CANCEL_REQ') return order.status === 'CANCEL_REQUESTED';
    return true;
  });

  if (isLoading) return (
    <div className="p-20 text-center text-gray-400">
       <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
       <p className="font-medium tracking-widest uppercase text-xs italic">Đang kết nối luồng dữ liệu...</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Tabs Menu */}
      <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-100 flex gap-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'ALL', label: `Tất cả (${orders.length})`, color: 'bg-gray-800' },
          { id: 'PENDING', label: 'Đơn mới', color: 'bg-blue-600', count: orders.filter(o => o.status === 'PENDING').length },
          { id: 'ACTIVE', label: 'Đang làm/Giao', color: 'bg-orange-500' },
          { id: 'CANCEL_REQ', label: 'Yêu cầu huỷ', color: 'bg-yellow-500', dot: orders.filter(o => o.status === 'CANCEL_REQUESTED').length > 0 }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === tab.id ? `${tab.color} text-white shadow-lg scale-105` : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            {tab.label}
            {tab.count > 0 && <span className="bg-red-500 text-white px-2 py-0.5 rounded-full text-[10px]">{tab.count}</span>}
            {tab.dot && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {filteredOrders.length === 0 ? (
          <div className="col-span-full bg-white p-20 rounded-3xl border border-dashed border-gray-200 text-center text-gray-400">
            Không có dữ liệu trong mục này.
          </div>
        ) : (
          filteredOrders.map(order => {
            const statusConfig = ORDER_STATUSES[order.status] || ORDER_STATUSES.PENDING;

            return (
              <div key={order.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 flex flex-col overflow-hidden transition-all hover:shadow-md">
                <div className="px-6 py-4 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-black text-gray-800 text-lg uppercase">#{order.id.slice(-6)}</span>
                    <span className={`px-3 py-1 rounded-lg text-[10px] uppercase font-black border ${statusConfig.color}`}>
                      {statusConfig.label}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-gray-400 italic">{order.time}</span>
                </div>

                <div className="p-6 flex-1 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-black mb-1">Khách hàng</p>
                      <p className="text-sm font-bold text-gray-800">{order.customer}</p>
                      <p className="text-sm text-blue-600 font-bold">{order.phone}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-black mb-1">Địa chỉ</p>
                      <p className="text-sm text-gray-600 leading-snug">{order.address}</p>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <p className="text-[10px] text-gray-400 uppercase font-black mb-2">Chi tiết đơn</p>
                    <p className="text-sm text-gray-800 font-medium leading-relaxed">{order.items}</p>
                  </div>
                  
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-gray-400 text-xs font-bold uppercase">Tổng thu:</span>
                    <span className="text-2xl font-black text-red-500 tracking-tighter">{order.total}</span>
                  </div>
                </div>

                <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex gap-3 justify-end">
                  {order.status === 'PENDING' && (
                    <button 
                      onClick={() => handleUpdateStatus(order.id, 'PREPARING')}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-2xl text-sm font-black shadow-lg active:scale-95 transition-all"
                    >
                      XÁC NHẬN & BÁO BẾP
                    </button>
                  )}

                  {order.status === 'PREPARING' && (
                    <button 
                      onClick={() => handleUpdateStatus(order.id, 'DELIVERING')}
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3.5 rounded-2xl text-sm font-black shadow-lg active:scale-95 transition-all"
                    >
                      GIAO CHO SHIPPER
                    </button>
                  )}

                  {order.status === 'DELIVERING' && (
                    <button 
                      onClick={() => handleUpdateStatus(order.id, 'COMPLETED')}
                      className="w-full bg-green-600 hover:bg-green-700 text-white py-3.5 rounded-2xl text-sm font-black shadow-lg active:scale-95 transition-all"
                    >
                      HOÀN THÀNH ĐƠN
                    </button>
                  )}

                  {order.status === 'CANCEL_REQUESTED' && (
                    <div className="flex gap-3 w-full">
                      <button 
                        onClick={() => handleCancelAction(order.id, false)}
                        className="flex-1 bg-white border border-gray-300 text-gray-700 py-3 rounded-2xl text-sm font-bold hover:bg-gray-50"
                      >
                        Từ chối hủy
                      </button>
                      <button 
                        onClick={() => handleCancelAction(order.id, true)}
                        className="flex-1 bg-red-600 text-white py-3 rounded-2xl text-sm font-bold shadow-md active:scale-95"
                      >
                        Đồng ý hủy
                      </button>
                    </div>
                  )}

                  {['COMPLETED', 'CANCELLED'].includes(order.status) && (
                    <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest py-2">Hồ sơ đơn hàng đã đóng</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ManageOrders;