import React, { useState, useEffect } from 'react';
import { subscribeToAllOrders } from '../../services/orderService';
import StatusBadge from '../../components/StatusBadge';

const Dashboard = () => {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    pending: 0,
    active: 0,
    cancelReq: 0,
    revenue: 0
  });

  useEffect(() => {
    setIsLoading(true);

    // LẮNG NGHE DỮ LIỆU THỜI GIAN THỰC
    // Firebase sẽ tự động đẩy dữ liệu mới về mỗi khi có đơn hàng mới hoặc thay đổi trạng thái
    const unsubscribe = subscribeToAllOrders((allOrders) => {
      setOrders(allOrders);

      // Tính toán thống kê từ dữ liệu thực
      const today = new Date().toLocaleDateString('vi-VN');
      
      const newStats = allOrders.reduce((acc, order) => {
        // 1. Đếm đơn mới chờ duyệt
        if (order.status === 'PENDING') acc.pending++;
        
        // 2. Đếm đơn đang xử lý (Bếp/Giao hàng)
        if (['CONFIRMED', 'PREPARING', 'DELIVERING'].includes(order.status)) acc.active++;
        
        // 3. Đếm yêu cầu hủy
        if (order.status === 'CANCEL_REQUESTED') acc.cancelReq++;
        
        // 4. Tính doanh thu hôm nay
        // Logic so khớp ngày dựa trên trường "time" đã được format vi-VN trong orderService
        if (order.status === 'COMPLETED' && order.time && order.time.includes(today)) {
          const price = parseInt(order.total?.replace(/\D/g, '')) || 0;
          acc.revenue += price;
        }
        
        return acc;
      }, { pending: 0, active: 0, cancelReq: 0, revenue: 0 });

      setStats(newStats);
      setIsLoading(false);
    });

    // NGẮT KẾT NỐI KHI RỜI TRANG
    return () => unsubscribe();
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-sm font-medium tracking-widest uppercase">Đang đồng bộ dữ liệu...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Khối Thẻ Thống kê (Dữ liệu REAL-TIME) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <div>
            <p className="text-[11px] text-gray-400 font-black uppercase tracking-wider">Đơn mới</p>
            <p className="text-2xl font-black text-gray-800">{stats.pending}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
          <div className="p-3 bg-orange-100 text-orange-600 rounded-xl">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <p className="text-[11px] text-gray-400 font-black uppercase tracking-wider">Đang làm & Giao</p>
            <p className="text-2xl font-black text-gray-800">{stats.active}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
          <div className="p-3 bg-red-100 text-red-600 rounded-xl">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <p className="text-[11px] text-gray-400 font-black uppercase tracking-wider">Yêu cầu huỷ</p>
            <p className="text-2xl font-black text-red-600">{stats.cancelReq}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
          <div className="p-3 bg-green-100 text-green-600 rounded-xl">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-[11px] text-gray-400 font-black uppercase tracking-wider">Thu nhập hôm nay</p>
            <p className="text-2xl font-black text-green-600">
              {stats.revenue.toLocaleString('vi-VN')}đ
            </p>
          </div>
        </div>
      </div>

      {/* Danh sách 5 đơn hàng mới nhất */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
          <h2 className="text-sm font-black uppercase text-gray-800 tracking-tight">Đơn hàng mới nhất</h2>
          <button 
            onClick={() => window.location.href='/admin/orders'} 
            className="text-[11px] font-black text-blue-600 uppercase tracking-widest hover:text-blue-800"
          >
            Xem tất cả →
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 text-gray-400 text-[10px] font-black uppercase tracking-widest border-b border-gray-50">
                <th className="px-6 py-4">Mã Đơn</th>
                <th className="px-6 py-4">Khách Hàng</th>
                <th className="px-6 py-4">Tổng Tiền</th>
                <th className="px-6 py-4 text-center">Trạng Thái</th>
                <th className="px-6 py-4 text-right">Thời Gian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {orders.slice(0, 5).map((order) => (
                <tr key={order.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-6 py-4 font-mono text-[11px] text-gray-400 font-bold uppercase tracking-tighter">
                    #{order.id.slice(-6)}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-gray-800">{order.customer}</p>
                    <p className="text-[11px] text-blue-500 font-medium">{order.phone}</p>
                  </td>
                  <td className="px-6 py-4 text-sm font-black text-red-500">{order.total}</td>
                  <td className="px-6 py-4 text-center">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="px-6 py-4 text-right text-[11px] text-gray-400 font-medium italic">{order.time}</td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-20 text-center text-gray-400 font-medium italic">Chưa có dữ liệu đơn hàng nào được ghi nhận.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default Dashboard;