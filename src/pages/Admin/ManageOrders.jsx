import React, { useState, useEffect } from 'react';
import { 
  subscribeToOrdersByDate, 
  updateOrderStatus, 
  confirmPaymentStatus,
  deleteOrderSoft 
} from '../../services/orderService';
import StatusBadge from '../../components/StatusBadge';

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
  const [activeTab, setActiveTab] = useState('ALL');

  useEffect(() => {
    setIsLoading(true);
    const todayStr = new Date().toLocaleDateString('vi-VN');

    // Lắng nghe đơn hàng trong ngày (Hàm này đã được sửa ở orderService để lọc bỏ DELETED)
    const unsubscribe = subscribeToOrdersByDate(todayStr, (data) => {
      setOrders(data);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleUpdateStatus = async (orderId, newStatus) => {
    await updateOrderStatus(orderId, newStatus);
  };

  // Hàm xử lý Xóa đơn (Soft Delete)
  const handleDeleteOrder = async (orderId) => {
    if (window.confirm("Xóa đơn này khỏi danh sách hôm nay? (Vẫn lưu trong lịch sử nhưng không tính thu nhập)")) {
      await deleteOrderSoft(orderId);
    }
  };

  const filteredOrders = orders.filter(order => {
    if (activeTab === 'ALL') return true;
    if (activeTab === 'PENDING') return order.status === 'PENDING';
    if (activeTab === 'TRANSFER') return order.paymentStatus === 'WAITING_CONFIRM';
    if (activeTab === 'CANCEL_REQ') return order.status === 'CANCEL_REQUESTED';
    return true;
  });

  if (isLoading) return (
    <div className="p-20 text-center">
       <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
       <p className="text-xs font-black uppercase text-blue-500 tracking-widest">Đang tải đơn bếp...</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header Tabs */}
      <div className="bg-white p-2 rounded-3xl shadow-sm border border-gray-100 flex gap-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'ALL', label: `Tất cả`, color: 'bg-gray-800' },
          { id: 'PENDING', label: 'Đơn mới', color: 'bg-blue-600', count: orders.filter(o => o.status === 'PENDING').length },
          { id: 'TRANSFER', label: 'Tiền về', color: 'bg-green-600', count: orders.filter(o => o.paymentStatus === 'WAITING_CONFIRM').length },
          { id: 'CANCEL_REQ', label: 'Yêu cầu huỷ', color: 'bg-red-500', count: orders.filter(o => o.status === 'CANCEL_REQUESTED').length }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
              activeTab === tab.id ? `${tab.color} text-white shadow-lg` : 'text-gray-400 hover:bg-gray-50'
            }`}
          >
            {tab.label}
            {tab.count > 0 && <span className="bg-white text-gray-900 px-2 py-0.5 rounded-lg text-[9px]">{tab.count}</span>}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {filteredOrders.map(order => {
          const statusConfig = ORDER_STATUSES[order.status] || ORDER_STATUSES.PENDING;

          return (
            <div key={order.id} className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden flex flex-col">
              {/* Top Bar */}
              <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-100 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-black text-gray-800 text-lg">#{order.id.slice(-6)}</span>
                  <span className={`px-3 py-1 rounded-xl text-[9px] uppercase font-black border ${statusConfig.color}`}>
                    {statusConfig.label}
                  </span>
                </div>
                <button onClick={() => handleDeleteOrder(order.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>

              <div className="p-6 space-y-4 flex-1">
                {/* Khối Thanh Toán - Mới */}
                <div className={`p-4 rounded-2xl border flex items-center justify-between ${order.paymentStatus === 'WAITING_CONFIRM' ? 'bg-blue-50 border-blue-200 animate-pulse' : 'bg-gray-50 border-gray-100'}`}>
                  <div>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Thanh toán</p>
                    <p className="text-xs font-black text-gray-800 uppercase">
                      {order.paymentMethod === 'TRANSFER' ? '🏦 Chuyển khoản' : '💵 Tiền mặt'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {order.paymentStatus !== 'PAID' ? (
                      <>
                        <button onClick={() => confirmPaymentStatus(order.id, true)} className="bg-green-600 text-white px-3 py-2 rounded-xl text-[9px] font-black uppercase shadow-md shadow-green-100">Đã nhận tiền</button>
                        <button onClick={() => confirmPaymentStatus(order.id, false)} className="bg-white text-red-500 border border-red-100 px-3 py-2 rounded-xl text-[9px] font-black uppercase">Chưa nhận</button>
                      </>
                    ) : (
                      <span className="text-green-600 font-black text-[10px] uppercase flex items-center gap-1">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                        Đã thu tiền
                      </span>
                    )}
                  </div>
                </div>

                {/* Yêu cầu hủy đơn - Mới */}
                {order.status === 'CANCEL_REQUESTED' && (
                  <div className="bg-red-50 p-4 rounded-2xl border border-red-200">
                    <p className="text-[10px] font-black text-red-600 uppercase mb-1">Yêu cầu hủy từ khách:</p>
                    <p className="text-xs font-bold text-red-900 italic">"{order.cancelReason || 'Không có lý do'}"</p>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => handleUpdateStatus(order.id, 'CANCELLED')} className="flex-1 bg-red-600 text-white py-2 rounded-xl text-[10px] font-black uppercase">Đồng ý hủy</button>
                      <button onClick={() => handleUpdateStatus(order.id, 'PREPARING')} className="flex-1 bg-white text-gray-600 border border-gray-200 py-2 rounded-xl text-[10px] font-black uppercase">Từ chối</button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-[9px] font-black text-gray-400 uppercase mb-1 tracking-widest">Khách hàng</p>
                    <p className="font-black text-gray-800">{order.customer}</p>
                    <p className="text-blue-600 font-bold">{order.phone}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-gray-400 uppercase mb-1 tracking-widest">Địa chỉ</p>
                    <p className="font-medium text-gray-600 leading-tight">{order.address}</p>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-2xl">
                  <p className="text-[9px] font-black text-gray-400 uppercase mb-2 tracking-widest">Món ăn</p>
                  <p className="text-sm font-black text-gray-800 leading-relaxed">{order.items}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="px-6 py-5 bg-gray-50/30 border-t border-gray-100 flex justify-between items-center">
                <span className="text-2xl font-black text-red-500 tracking-tighter">{order.total}</span>
                <div className="flex gap-2">
                  {order.status === 'PENDING' && (
                    <button onClick={() => handleUpdateStatus(order.id, 'PREPARING')} className="bg-blue-600 text-white px-6 py-3 rounded-2xl text-[11px] font-black uppercase shadow-lg shadow-blue-100 active:scale-95 transition-all">Nhận đơn & Làm</button>
                  )}
                  {order.status === 'PREPARING' && (
                    <button onClick={() => handleUpdateStatus(order.id, 'DELIVERING')} className="bg-orange-500 text-white px-6 py-3 rounded-2xl text-[11px] font-black uppercase shadow-lg shadow-orange-100 active:scale-95 transition-all">Giao cho shipper</button>
                  )}
                  {order.status === 'DELIVERING' && (
                    <button onClick={() => handleUpdateStatus(order.id, 'COMPLETED')} className="bg-green-600 text-white px-6 py-3 rounded-2xl text-[11px] font-black uppercase shadow-lg shadow-green-100 active:scale-95 transition-all">Giao thành công</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ManageOrders;