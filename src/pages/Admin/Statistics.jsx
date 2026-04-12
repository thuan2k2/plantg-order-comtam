import React, { useState, useEffect } from 'react';
import { subscribeToAllOrders } from '../../services/orderService';
import StatusBadge from '../../components/StatusBadge';

const Statistics = () => {
  const [allOrders, setAllOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // States dành cho bộ lọc
  const [searchKey, setSearchKey] = useState(''); // Tìm Tên/SĐT
  const [dateFilter, setDateFilter] = useState(''); // Tìm theo ngày

  useEffect(() => {
    setIsLoading(true);
    // Lắng nghe toàn bộ lịch sử đơn hàng
    const unsubscribe = subscribeToAllOrders((data) => {
      setAllOrders(data);
      setFilteredOrders(data);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Logic lọc dữ liệu mỗi khi searchKey hoặc dateFilter thay đổi
  useEffect(() => {
    let result = allOrders;

    // 1. Lọc theo Tên hoặc Số điện thoại
    if (searchKey) {
      const key = searchKey.toLowerCase();
      result = result.filter(o => 
        o.customer?.toLowerCase().includes(key) || 
        o.phone?.includes(key) ||
        o.id?.toLowerCase().includes(key)
      );
    }

    // 2. Lọc theo Ngày (So khớp chuỗi ngày vi-VN: "dd/mm/yyyy")
    if (dateFilter) {
      // Chuyển format input date (yyyy-mm-dd) sang format lưu trữ (dd/mm/yyyy)
      const [y, m, d] = dateFilter.split('-');
      const formattedDate = `${d}/${m}/${y}`;
      result = result.filter(o => o.time && o.time.includes(formattedDate));
    }

    setFilteredOrders(result);
  }, [searchKey, dateFilter, allOrders]);

  if (isLoading) return <div className="p-20 text-center text-gray-400 animate-pulse uppercase font-black text-xs">Đang tải dữ liệu lịch sử...</div>;

  return (
    <div className="space-y-6">
      {/* Thanh công cụ tìm kiếm */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Tìm kiếm khách hàng</label>
          <input 
            type="text"
            placeholder="Nhập tên, SĐT hoặc mã đơn..."
            value={searchKey}
            onChange={(e) => setSearchKey(e.target.value)}
            className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Lọc theo ngày đặt</label>
          <input 
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3.5 text-sm font-bold text-gray-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          />
        </div>
      </div>

      {/* Bảng kết quả */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-8 py-5 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
          <h2 className="text-xs font-black uppercase text-gray-400 tracking-widest">Kết quả tra cứu ({filteredOrders.length})</h2>
          { (searchKey || dateFilter) && (
            <button 
              onClick={() => {setSearchKey(''); setDateFilter('');}}
              className="text-[10px] font-black text-red-500 uppercase hover:underline"
            >
              Xóa lọc
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-gray-400 text-[10px] font-black uppercase tracking-widest border-b border-gray-50">
                <th className="px-8 py-4">Đơn hàng</th>
                <th className="px-8 py-4">Khách hàng</th>
                <th className="px-8 py-4">Tổng tiền</th>
                <th className="px-8 py-4 text-center">Trạng thái</th>
                <th className="px-8 py-4 text-right">Thời gian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-blue-50/20 transition-colors group">
                  <td className="px-8 py-5">
                    <p className="font-mono text-xs font-black text-gray-800 uppercase tracking-tighter">#{order.id.slice(-6)}</p>
                    <p className="text-[10px] text-gray-400 font-medium mt-1 line-clamp-1 max-w-[150px]">{order.items}</p>
                  </td>
                  <td className="px-8 py-5">
                    <p className="text-sm font-black text-gray-700">{order.customer}</p>
                    <p className="text-xs text-blue-500 font-bold">{order.phone}</p>
                  </td>
                  <td className="px-8 py-5 text-sm font-black text-red-500">{order.total}</td>
                  <td className="px-8 py-5 text-center">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="px-8 py-5 text-right">
                    <p className="text-xs font-black text-gray-800 italic">{order.time.split(',')[1]}</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">{order.time.split(',')[0]}</p>
                  </td>
                </tr>
              ))}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-8 py-20 text-center text-gray-400 font-bold italic">
                    Không tìm thấy dữ liệu phù hợp với yêu cầu.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// CỰC KỲ QUAN TRỌNG: Dòng này giúp fix lỗi Build [MISSING_EXPORT]
export default Statistics;