import React, { useState, useEffect } from 'react';
import { subscribeToAllOrders } from '../../services/orderService';
import StatusBadge from '../../components/StatusBadge';

const Statistics = () => {
  const [allOrders, setAllOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Bộ lọc
  const [searchKey, setSearchKey] = useState('');
  const [dateFilter, setDateFilter] = useState(''); // Giá trị yyyy-mm-dd từ input date

  useEffect(() => {
    setIsLoading(true);
    // Lắng nghe toàn bộ đơn hàng lưu trên Firebase (không giới hạn ngày)
    const unsubscribe = subscribeToAllOrders((data) => {
      setAllOrders(data);
      setFilteredOrders(data);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Hàm xử lý lọc dữ liệu (Fix lỗi lọc ngày)
  useEffect(() => {
    let result = [...allOrders];

    // 1. Lọc theo Tên, SĐT hoặc Mã đơn
    if (searchKey.trim()) {
      const key = searchKey.toLowerCase();
      result = result.filter(o => 
        (o.customer && o.customer.toLowerCase().includes(key)) || 
        (o.phone && o.phone.includes(key)) ||
        (o.id && o.id.toLowerCase().includes(key))
      );
    }

    // 2. FIX LỖI LỌC NGÀY: Chuyển đổi format để so khớp
    if (dateFilter) {
      // dateFilter có dạng "2026-04-13"
      // Chúng ta cần chuyển nó về "13/04/2026" hoặc "13/4/2026" tùy vào cách toLocaleString hiển thị
      const [year, month, day] = dateFilter.split('-');
      const formattedDate = `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
      
      result = result.filter(o => {
        // So sánh chuỗi ngày trong trường 'time' của đơn hàng
        return o.time && o.time.includes(formattedDate);
      });
    }

    setFilteredOrders(result);
  }, [searchKey, dateFilter, allOrders]);

  if (isLoading) return <div className="p-20 text-center font-black text-blue-500 animate-pulse">ĐANG TẢI LỊCH SỬ ĐƠN HÀNG...</div>;

  return (
    <div className="space-y-6">
      {/* Bộ lọc nâng cao */}
      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-2 block">Tìm kiếm khách hàng</label>
          <input 
            type="text" 
            placeholder="Nhập tên, SĐT hoặc mã đơn..." 
            value={searchKey}
            onChange={(e) => setSearchKey(e.target.value)}
            className="w-full bg-gray-50 border-none rounded-xl px-5 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none"
          />
        </div>
        <div className="w-full md:w-64">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-2 block">Lọc theo ngày đặt</label>
          <input 
            type="date" 
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full bg-gray-50 border-none rounded-xl px-5 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none"
          />
        </div>
        { (searchKey || dateFilter) && (
          <button 
            onClick={() => {setSearchKey(''); setDateFilter('');}}
            className="md:mt-6 text-red-500 text-xs font-black uppercase hover:underline"
          >
            Xóa lọc
          </button>
        )}
      </div>

      {/* Danh sách kết quả */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 text-gray-400 text-[10px] font-black uppercase tracking-widest">
                <th className="px-6 py-4">Đơn hàng</th>
                <th className="px-6 py-4">Khách hàng</th>
                <th className="px-6 py-4">Món đã đặt</th>
                <th className="px-6 py-4">Tổng thu</th>
                <th className="px-6 py-4">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredOrders.map(order => (
                <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-mono font-black text-blue-600 text-xs uppercase">#{order.id.slice(-6)}</span>
                    <p className="text-[10px] text-gray-400 font-bold mt-1">{order.time}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-black text-gray-800">{order.customer}</p>
                    <p className="text-xs text-gray-500">{order.phone}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs text-gray-600 line-clamp-2 italic font-medium">"{order.items}"</p>
                  </td>
                  <td className="px-6 py-4 font-black text-red-500 text-sm">{order.total}</td>
                  <td className="px-6 py-4 text-center">
                    <StatusBadge status={order.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredOrders.length === 0 && (
            <div className="p-20 text-center text-gray-400 italic font-bold">Không tìm thấy đơn hàng phù hợp.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Statistics;