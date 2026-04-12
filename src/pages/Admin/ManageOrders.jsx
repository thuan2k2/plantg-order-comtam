import React, { useState } from 'react';

// Từ điển trạng thái đồng bộ với CheckOrder.jsx
const ORDER_STATUSES = {
  PENDING: { label: 'Chờ xác nhận', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  CONFIRMED: { label: 'Đã xác nhận', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  PREPARING: { label: 'Đang chuẩn bị', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  DELIVERING: { label: 'Đang giao hàng', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  COMPLETED: { label: 'Đã hoàn thành', color: 'bg-green-100 text-green-700 border-green-200' },
  CANCELLED: { label: 'Đã huỷ', color: 'bg-red-100 text-red-700 border-red-200' },
  CANCEL_REQUESTED: { label: 'Yêu cầu huỷ', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' }
};

// Dữ liệu mock ban đầu
const initialOrders = [
  { id: 'DH005', customer: 'Nguyễn Văn A', phone: '0901234567', address: 'S1.01 Origami, Vinhomes', items: '1x Cơm Gà KATSU Phủ Trứng, 1x Sakura Hồng Sữa', total: '127,000đ', status: 'PENDING', time: '10:45 15/05' },
  { id: 'DH004', customer: 'Trần Thị B', phone: '0912345678', address: 'S2.02 Rainbow, Vinhomes', items: '2x Cơm Gà KATSUDON', total: '120,000đ', status: 'PREPARING', time: '10:30 15/05' },
  { id: 'DH003', customer: 'Lê Văn C', phone: '0987654321', address: 'S3.03 Beverly, Vinhomes', items: '1x Hương Nhài Dẻ Cười, 1x Sakura Cream Frappe', total: '114,000đ', status: 'DELIVERING', time: '09:15 15/05' },
  { id: 'DH002', customer: 'Phạm D', phone: '0909090909', address: 'S1.05 Origami, Vinhomes', items: '1x Cơm Gà KATSU Phủ Trứng', total: '70,000đ', status: 'CANCEL_REQUESTED', time: '08:50 15/05' },
  { id: 'DH001', customer: 'Hoàng E', phone: '0908080808', address: 'S5.01 Rainbow, Vinhomes', items: '3x Cơm Gà KATSUDON', total: '180,000đ', status: 'COMPLETED', time: '08:00 15/05' },
];

const ManageOrders = () => {
  const [orders, setOrders] = useState(initialOrders);
  const [activeTab, setActiveTab] = useState('ALL'); // ALL, PENDING, ACTIVE, CANCEL_REQ

  // Hàm chuyển trạng thái thông thường
  const updateOrderStatus = (orderId, newStatus) => {
    // TODO: Gọi API cập nhật Firebase ở đây
    setOrders(prevOrders => 
      prevOrders.map(order => 
        order.id === orderId ? { ...order, status: newStatus } : order
      )
    );
  };

  // Hàm xử lý riêng cho Yêu cầu huỷ đơn
  const handleCancelRequest = (orderId, isApproved) => {
    if (isApproved) {
      updateOrderStatus(orderId, 'CANCELLED');
      alert(`Đã ĐỒNG Ý huỷ đơn ${orderId}`);
    } else {
      // Nếu từ chối huỷ, chuyển đơn về trạng thái đang chuẩn bị (hoặc trạng thái cũ)
      updateOrderStatus(orderId, 'PREPARING'); 
      alert(`Đã TỪ CHỐI huỷ đơn ${orderId}, đơn tiếp tục được chuẩn bị.`);
    }
  };

  // Lọc đơn hàng theo tab
  const filteredOrders = orders.filter(order => {
    if (activeTab === 'ALL') return true;
    if (activeTab === 'PENDING') return order.status === 'PENDING';
    if (activeTab === 'ACTIVE') return ['CONFIRMED', 'PREPARING', 'DELIVERING'].includes(order.status);
    if (activeTab === 'CANCEL_REQ') return order.status === 'CANCEL_REQUESTED';
    return true;
  });

  return (
    <div className="space-y-6">
      
      {/* Thanh điều hướng Tabs */}
      <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100 flex gap-2 overflow-x-auto">
        <button 
          onClick={() => setActiveTab('ALL')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'ALL' ? 'bg-gray-800 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          Tất cả đơn
        </button>
        <button 
          onClick={() => setActiveTab('PENDING')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'PENDING' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          Đơn mới chờ duyệt 
          {orders.filter(o => o.status === 'PENDING').length > 0 && 
            <span className="ml-2 bg-red-500 text-white px-2 py-0.5 rounded-full text-xs">
              {orders.filter(o => o.status === 'PENDING').length}
            </span>
          }
        </button>
        <button 
          onClick={() => setActiveTab('ACTIVE')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'ACTIVE' ? 'bg-orange-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          Đang thực hiện
        </button>
        <button 
          onClick={() => setActiveTab('CANCEL_REQ')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'CANCEL_REQ' ? 'bg-yellow-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          Yêu cầu huỷ
          {orders.filter(o => o.status === 'CANCEL_REQUESTED').length > 0 && 
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
          }
        </button>
      </div>

      {/* Danh sách các thẻ đơn hàng */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {filteredOrders.length === 0 ? (
          <div className="col-span-full bg-white p-10 rounded-xl border border-gray-100 text-center text-gray-500 shadow-sm">
            Không có đơn hàng nào trong mục này.
          </div>
        ) : (
          filteredOrders.map(order => {
            const statusConfig = ORDER_STATUSES[order.status] || ORDER_STATUSES.PENDING;

            return (
              <div key={order.id} className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
                {/* Header thẻ đơn hàng */}
                <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-gray-800 text-lg">#{order.id}</span>
                    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${statusConfig.color}`}>
                      {statusConfig.label}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">{order.time}</span>
                </div>

                {/* Nội dung thông tin đơn */}
                <div className="p-5 flex-1">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Khách hàng</p>
                      <p className="text-sm font-medium text-gray-800">{order.customer}</p>
                      <p className="text-sm text-blue-600">{order.phone}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Giao đến</p>
                      <p className="text-sm text-gray-800">{order.address}</p>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Món ăn</p>
                    <p className="text-sm text-gray-800 leading-relaxed">{order.items}</p>
                  </div>
                  
                  <div className="mt-4 flex justify-between items-center">
                    <span className="text-gray-600 text-sm font-medium">Tổng thu:</span>
                    <span className="text-xl font-bold text-red-500">{order.total}</span>
                  </div>
                </div>

                {/* Khu vực Nút thao tác (Thay đổi theo trạng thái) */}
                <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 flex gap-3 justify-end">
                  
                  {/* Nếu là Đơn Mới */}
                  {order.status === 'PENDING' && (
                    <button 
                      onClick={() => updateOrderStatus(order.id, 'PREPARING')}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
                    >
                      Bếp xác nhận & Chuẩn bị
                    </button>
                  )}

                  {/* Nếu Đang Chuẩn Bị */}
                  {order.status === 'PREPARING' && (
                    <button 
                      onClick={() => updateOrderStatus(order.id, 'DELIVERING')}
                      className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
                    >
                      Giao cho Shipper
                    </button>
                  )}

                  {/* Nếu Đang Giao */}
                  {order.status === 'DELIVERING' && (
                    <button 
                      onClick={() => updateOrderStatus(order.id, 'COMPLETED')}
                      className="bg-green-500 hover:bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
                    >
                      Xác nhận Đã giao
                    </button>
                  )}

                  {/* Nếu Khách Yêu Cầu Huỷ */}
                  {order.status === 'CANCEL_REQUESTED' && (
                    <div className="flex gap-3 w-full">
                      <button 
                        onClick={() => handleCancelRequest(order.id, false)}
                        className="flex-1 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
                      >
                        Từ chối huỷ (Vẫn làm)
                      </button>
                      <button 
                        onClick={() => handleCancelRequest(order.id, true)}
                        className="flex-1 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
                      >
                        Đồng ý Huỷ đơn
                      </button>
                    </div>
                  )}

                  {/* Nếu đơn đã Hoàn thành hoặc Huỷ (Chỉ xem) */}
                  {['COMPLETED', 'CANCELLED'].includes(order.status) && (
                    <span className="text-sm text-gray-500 italic">Không có thao tác khả dụng</span>
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