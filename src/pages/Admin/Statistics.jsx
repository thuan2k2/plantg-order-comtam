import React, { useState, useEffect } from 'react';
import { subscribeToAllOrders } from '../../services/orderService';
import StatusBadge from '../../components/StatusBadge';

const Statistics = () => {
  const [allOrders, setAllOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Bộ lọc
  const [searchKey, setSearchKey] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Thống kê doanh thu
  const [stats, setStats] = useState({
    today: { total: 0, revenue: 0 },
    month: { total: 0, revenue: 0 },
    year: { total: 0, revenue: 0 }
  });

  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = subscribeToAllOrders((data) => {
      setAllOrders(data);
      // Khi dữ liệu Firebase thay đổi, tính toán lại thống kê
      calculateBusinessStats(data);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Hàm tính toán doanh thu & số đơn chuyên sâu
  const calculateBusinessStats = (orders) => {
    const now = new Date();
    const todayStr = now.toLocaleDateString('vi-VN');
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let s = {
      today: { total: 0, revenue: 0 },
      month: { total: 0, revenue: 0 },
      year: { total: 0, revenue: 0 }
    };

    orders.forEach(o => {
      // BỎ QUA ĐƠN ĐÃ XÓA MỀM (status: DELETED)
      if (o.status === 'DELETED') return;

      const orderDate = o.createdAt?.toDate() || new Date();
      const amount = parseInt(o.total?.replace(/\D/g, '') || 0);
      
      // CHỈ TÍNH DOANH THU CHO ĐƠN HOÀN THÀNH & ĐÃ THANH TOÁN
      const isCountableRevenue = o.status === 'COMPLETED' && o.paymentStatus === 'PAID';

      // 1. Thống kê Ngày
      if (orderDate.toLocaleDateString('vi-VN') === todayStr) {
        s.today.total++;
        if (isCountableRevenue) s.today.revenue += amount;
      }

      // 2. Thống kê Tháng
      if (orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear) {
        s.month.total++;
        if (isCountableRevenue) s.month.revenue += amount;
      }

      // 3. Thống kê Năm
      if (orderDate.getFullYear() === currentYear) {
        s.year.total++;
        if (isCountableRevenue) s.year.revenue += amount;
      }
    });
    setStats(s);
  };

  // Logic lọc dữ liệu bảng
  useEffect(() => {
    let result = [...allOrders];

    if (searchKey.trim()) {
      const key = searchKey.toLowerCase();
      result = result.filter(o => 
        (o.customer && o.customer.toLowerCase().includes(key)) || 
        (o.phone && o.phone.includes(key)) ||
        (o.id && o.id.toLowerCase().includes(key))
      );
    }

    if (dateFilter) {
      const [year, month, day] = dateFilter.split('-');
      const formattedDate = `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
      result = result.filter(o => o.time && o.time.includes(formattedDate));
    }

    setFilteredOrders(result);
  }, [searchKey, dateFilter, allOrders]);

  if (isLoading) return <div className="p-20 text-center font-black text-blue-500 animate-pulse uppercase tracking-widest text-xs">Đang tải dữ liệu vận hành...</div>;

  return (
    <div className="space-y-6">
      {/* 1. BẢNG THỐNG KÊ DOANH THU CHUYÊN SÂU */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Doanh thu hôm nay', data: stats.today, color: 'from-blue-600 to-blue-400' },
          { label: 'Doanh thu tháng này', data: stats.month, color: 'from-orange-600 to-orange-400' },
          { label: 'Doanh thu năm nay', data: stats.year, color: 'from-green-600 to-green-400' }
        ].map((item, idx) => (
          <div key={idx} className={`bg-gradient-to-tr ${item.color} p-8 rounded-[2.5rem] text-white shadow-xl shadow-gray-200`}>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">{item.label}</p>
            <h3 className="text-3xl font-black mt-2 tracking-tighter">{item.data.revenue.toLocaleString()}đ</h3>
            <div className="mt-4 pt-4 border-t border-white/20 flex justify-between items-center">
               <span className="text-[10px] font-bold uppercase">Số đơn vận hành</span>
               <span className="font-black text-sm">{item.data.total} đơn</span>
            </div>
          </div>
        ))}
      </div>

      {/* 2. BỘ LỌC TÌM KIẾM */}
      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-2 block">Tra cứu khách hàng</label>
          <input 
            type="text" 
            placeholder="Tên, SĐT hoặc Mã đơn..." 
            value={searchKey}
            onChange={(e) => setSearchKey(e.target.value)}
            className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none"
          />
        </div>
        <div className="w-full md:w-64">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-2 block">Lọc theo ngày</label>
          <input 
            type="date" 
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none"
          />
        </div>
        {(searchKey || dateFilter) && (
          <button onClick={() => {setSearchKey(''); setDateFilter('');}} className="md:mt-6 text-red-500 text-[10px] font-black uppercase tracking-widest hover:underline">Xóa lọc</button>
        )}
      </div>

      {/* 3. BẢNG LỊCH SỬ CHI TIẾT */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden mb-10">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 text-gray-400 text-[10px] font-black uppercase tracking-[0.2em]">
                <th className="px-8 py-5">Đơn hàng</th>
                <th className="px-8 py-5">Khách hàng</th>
                <th className="px-8 py-5">Thanh toán</th>
                <th className="px-8 py-5 text-right">Giá trị</th>
                <th className="px-8 py-5 text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredOrders.map(order => (
                <tr key={order.id} className={`hover:bg-gray-50/50 transition-colors ${order.status === 'DELETED' ? 'opacity-40 grayscale' : ''}`}>
                  <td className="px-8 py-5">
                    <span className="font-mono font-black text-blue-600 text-xs uppercase">#{order.id.slice(-6)}</span>
                    <p className="text-[10px] text-gray-400 font-bold mt-1 tracking-tight">{order.time}</p>
                  </td>
                  <td className="px-8 py-5">
                    <p className="text-sm font-black text-gray-800 leading-none">{order.customer}</p>
                    <p className="text-[10px] text-gray-400 font-bold mt-1">{order.phone}</p>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-tighter text-gray-500">
                        {order.paymentMethod === 'TRANSFER' ? '🏦 Chuyển khoản' : '💵 Tiền mặt'}
                      </span>
                      <span className={`text-[9px] font-black uppercase mt-1 ${order.paymentStatus === 'PAID' ? 'text-green-500' : 'text-red-400'}`}>
                        {order.paymentStatus === 'PAID' ? 'Đã thu tiền' : 'Chưa thu tiền'}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right font-black text-gray-800 text-sm">{order.total}</td>
                  <td className="px-8 py-5 text-center">
                    {order.status === 'DELETED' ? (
                      <span className="text-[10px] font-black text-gray-300 uppercase italic">Đã xóa mềm</span>
                    ) : (
                      <StatusBadge status={order.status} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredOrders.length === 0 && (
            <div className="p-20 text-center text-gray-300 italic font-bold text-sm">Không tìm thấy dữ liệu đơn hàng...</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Statistics;