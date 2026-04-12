import React, { useState, useEffect } from 'react';
// CẬP NHẬT: Sử dụng hàm subscribeToOrdersByDate để lọc đơn trong ngày
import { subscribeToOrdersByDate, updateOrderStatus } from '../../services/orderService';
import StatusBadge from '../../components/StatusBadge';

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

  useEffect(() => {
    setIsLoading(true);
    // Lấy chuỗi ngày hôm nay theo định dạng vi-VN (Ví dụ: 13/04/2026)
    const todayStr = new Date().toLocaleDateString('vi-VN');

    // Lắng nghe đơn hàng CHỈ TRONG NGÀY HÔM NAY
    const unsubscribe = subscribeToOrdersByDate(todayStr, (data) => {
      setOrders(data);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      const result = await updateOrderStatus(orderId, newStatus);
      if (!result.success) {
        alert("Lỗi cập nhật: " + result.error);
      }
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
       <p className="font-medium tracking-widest uppercase text-xs italic text-blue-500">Đang lọc đơn hàng hôm nay...</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex justify-between items-end px-2">
        <div>
          <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Đơn hàng hôm nay</h2>
          <p className="text-xs text-blue-500 font-bold">{new Date().toLocaleDateString('vi-VN')}</p>
        </div>
        <p className="text-[10px] text-gray-400 font-black uppercase bg-gray-100 px-2 py-1 rounded-md">
          {orders.length} Đơn
        </p>
      </div>

      {/* Tabs Menu */}
      <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-100 flex gap-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'ALL', label: `Tất cả`, color: 'bg-gray-800' },
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
            {tab.count > 0 && <span className="bg-red-500 text-white px-2 py-0.5 rounded-full text-[10px] font-black">{tab.count}</span>}
            {tab.dot && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>}
          </button>
        ))}
      </div>

      {/* Order Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {filteredOrders.length === 0 ? (
          <div className="col-span-full bg-white p-20 rounded-3xl border border-dashed border-gray-200 text-center text-gray-400 font-bold italic">
            Hôm nay chưa có đơn hàng nào trong mục này.
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
                  <span className="text-xs font-bold text-gray-400 italic">{order.time.split(',')[1] || order.time}</span>
                </div>

                <div className="p-6 flex-1 space-y-4">
                  {/* Ghi chú của khách */}
                  {order.note && (
                    <div className="bg-yellow-50 p-3 rounded-2xl border border-yellow-100 flex items-start gap-2">
                      <div className="mt-1 text-yellow-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] text-yellow-600 font-black uppercase tracking-wider">Ghi chú của khách:</p>
                        <p className="text-sm text-yellow-900 font-bold italic leading-tight">"{order.note}"</p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-black mb-1">Khách hàng</p>
                      <p className="text-sm font-bold text-gray-800">{order.customer}</p>
                      <p className="text-sm text-blue-600 font-bold">{order.phone}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-black mb-1">Địa chỉ</p>
                      <p className="text-sm text-gray-600 leading-snug font-medium">{order.address}</p>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <p className="text-[10px] text-gray-400 uppercase font-black mb-2">Chi tiết đơn</p>
                    <p className="text-sm text-gray-800 font-bold leading-relaxed">{order.items}</p>
                  </div>
                  
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-gray-400 text-xs font-bold uppercase">Tổng thu:</span>
                    <span className="text-2xl font-black text-red-500 tracking-tighter">{order.total}</span>
                  </div>
                </div>

                <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex gap-3 justify-end">
                  {order.status === 'PENDING' && (
                    <>
                      <button 
                        onClick={() => handleUpdateStatus(order.id, 'CANCELLED')}
                        className="flex-1 bg-white border border-red-200 text-red-500 py-3 rounded-2xl text-[11px] font-black uppercase hover:bg-red-50 transition-all"
                      >
                        Hủy đơn
                      </button>
                      <button 
                        onClick={() => handleUpdateStatus(order.id, 'PREPARING')}
                        className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-2xl text-[11px] font-black uppercase shadow-lg active:scale-95 transition-all"
                      >
                        Xác nhận & Báo bếp
                      </button>
                    </>
                  )}

                  {order.status === 'PREPARING' && (
                    <button 
                      onClick={() => handleUpdateStatus(order.id, 'DELIVERING')}
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3.5 rounded-2xl text-sm font-black shadow-lg active:scale-95 transition-all"
                    >
                      BÀN GIAO CHO SHIPPER
                    </button>
                  )}

                  {order.status === 'DELIVERING' && (
                    <button 
                      onClick={() => handleUpdateStatus(order.id, 'COMPLETED')}
                      className="w-full bg-green-600 hover:bg-green-700 text-white py-3.5 rounded-2xl text-sm font-black shadow-lg active:scale-95 transition-all"
                    >
                      XÁC NHẬN GIAO THÀNH CÔNG
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