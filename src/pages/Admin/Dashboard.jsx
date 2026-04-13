import React, { useState, useEffect } from 'react';
import { subscribeToAllOrders, getAllVouchers } from '../../services/orderService';
import StatusBadge from '../../components/StatusBadge';

const Dashboard = () => {
  const [orders, setOrders] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    pending: 0,
    active: 0,
    cancelReq: 0,
    revenue: 0,
    voucherCount: 0
  });

  useEffect(() => {
    setIsLoading(true);

    // 1. LẮNG NGHE ĐƠN HÀNG REAL-TIME
    const unsubscribeOrders = subscribeToAllOrders((allOrders) => {
      setOrders(allOrders);

      const today = new Date().toLocaleDateString('vi-VN');
      
      const newStats = allOrders.reduce((acc, order) => {
        // Đếm đơn mới
        if (order.status === 'PENDING') acc.pending++;
        
        // Đếm đơn đang xử lý (Bao gồm cả trạng thái chuẩn bị và giao hàng)
        if (['PREPARING', 'DELIVERING'].includes(order.status)) acc.active++;
        
        // Đếm yêu cầu hủy
        if (order.status === 'CANCEL_REQUESTED') acc.cancelReq++;
        
        // Tính doanh thu thực tế hôm nay (Đã bao gồm phí ship và trừ giảm giá)
        if (order.status === 'COMPLETED' && order.time && order.time.includes(today)) {
          // Lấy số tiền cuối cùng khách phải trả
          const finalPrice = parseInt(order.total?.replace(/\D/g, '')) || 0;
          acc.revenue += finalPrice;
        }
        
        return acc;
      }, { pending: 0, active: 0, cancelReq: 0, revenue: 0 });

      setStats(prev => ({ ...prev, ...newStats }));
      setIsLoading(false);
    });

    // 2. LẤY THÔNG TIN VOUCHER ĐANG HOẠT ĐỘNG
    const fetchVouchers = async () => {
      const data = await getAllVouchers();
      setVouchers(data);
      setStats(prev => ({ ...prev, voucherCount: data.length }));
    };
    fetchVouchers();

    return () => unsubscribeOrders();
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-[10px] font-black tracking-widest uppercase">Đang đồng bộ hệ thống...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Khối Thẻ Thống kê Hệ thống */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Thẻ Doanh thu - Ưu tiên hiển thị to nhất */}
        <div className="lg:col-span-2 bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-[2.5rem] shadow-xl shadow-blue-200 flex justify-between items-center text-white relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] opacity-80">Doanh thu hôm nay (Thực nhận)</p>
            <p className="text-4xl font-black mt-2 tracking-tighter">
              {stats.revenue.toLocaleString('vi-VN')}đ
            </p>
            <div className="flex gap-4 mt-4">
               <div className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase">
                 ⚡ {stats.active} Đang làm
               </div>
               <div className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase">
                 🎁 {stats.voucherCount} Voucher
               </div>
            </div>
          </div>
          <svg className="w-32 h-32 absolute -right-8 -bottom-8 opacity-10" fill="currentColor" viewBox="0 0 20 20"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" /></svg>
        </div>

        {/* Đơn hàng mới */}
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col justify-between transition-all hover:shadow-md">
          <div className="flex justify-between items-start">
             <div className="p-3 bg-red-50 text-red-500 rounded-2xl">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
             </div>
             <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cần xử lý</span>
          </div>
          <div className="mt-4">
             <p className="text-3xl font-black text-gray-800">{stats.pending}</p>
             <p className="text-[10px] font-bold text-red-400 uppercase mt-1">Đơn hàng mới chưa duyệt</p>
          </div>
        </div>

        {/* Yêu cầu hủy */}
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col justify-between transition-all hover:shadow-md">
          <div className="flex justify-between items-start">
             <div className="p-3 bg-orange-50 text-orange-500 rounded-2xl">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
             </div>
             <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Yêu cầu hủy</span>
          </div>
          <div className="mt-4">
             <p className="text-3xl font-black text-orange-600">{stats.cancelReq}</p>
             <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">Khách đang xin hủy đơn</p>
          </div>
        </div>
      </div>

      {/* Bảng đơn hàng mới nhất và Phím tắt Voucher */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Danh sách Đơn hàng */}
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
            <h2 className="text-xs font-black uppercase text-gray-800 tracking-[0.2em]">Dòng đơn hàng mới nhất</h2>
            <button onClick={() => window.location.href='/admin/orders'} className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline">Xem bếp →</button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <tbody className="divide-y divide-gray-50">
                {orders.slice(0, 6).map((order) => (
                  <tr key={order.id} className="hover:bg-blue-50/20 transition-all group">
                    <td className="px-8 py-5 font-mono text-[10px] text-gray-300 font-bold uppercase">#{order.id.slice(-6)}</td>
                    <td className="px-4 py-5">
                      <p className="text-sm font-black text-gray-800 group-hover:text-blue-600 transition-colors uppercase tracking-tighter">{order.customer}</p>
                      <p className="text-[10px] text-gray-400 font-bold">{order.phone}</p>
                    </td>
                    <td className="px-4 py-5 text-sm font-black text-red-500 tracking-tighter">{order.total}</td>
                    <td className="px-4 py-5 text-center">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-8 py-5 text-right text-[10px] text-gray-400 font-bold uppercase tracking-tighter">{order.time?.split(' ')[1]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quản lý Voucher Nhanh */}
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 p-8 flex flex-col">
          <div className="flex justify-between items-center mb-6">
             <h2 className="text-xs font-black uppercase text-gray-800 tracking-[0.2em]">Khuyến mãi</h2>
             <button onClick={() => window.location.href='/admin/users'} className="text-[10px] font-black text-orange-500 uppercase tracking-widest">+ Tặng quà</button>
          </div>
          
          <div className="space-y-4 flex-1 overflow-y-auto max-h-[400px] no-scrollbar">
            {vouchers.slice(0, 5).map(v => (
              <div key={v.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex justify-between items-center">
                <div>
                  <p className="font-black text-gray-800 text-xs tracking-widest">{v.code}</p>
                  <p className="text-[9px] text-blue-500 font-bold mt-1 uppercase">
                    {v.type === 'FREESHIP' ? 'Miễn phí vận chuyển' : `Giảm -${v.value.toLocaleString()}đ`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-gray-800">{v.usageLimit}</p>
                  <p className="text-[8px] text-gray-400 font-bold uppercase">Lượt</p>
                </div>
              </div>
            ))}
            {vouchers.length === 0 && (
              <div className="text-center py-10 opacity-30">
                <p className="text-[10px] font-black uppercase tracking-widest">Chưa có mã giảm giá</p>
              </div>
            )}
          </div>

          <button 
            onClick={() => window.location.href='/admin/statistics'} 
            className="mt-6 w-full py-4 bg-gray-800 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-gray-200"
          >
            Xem lịch sử doanh thu
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;