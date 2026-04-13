import React, { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth'; // Import để xác minh Admin
import { subscribeToAllOrders, undoDeleteOrder } from '../../services/orderService';
import StatusBadge from '../../components/StatusBadge';

const Statistics = () => {
  const [allOrders, setAllOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const auth = getAuth();

  // ĐIỀU HƯỚNG TABS
  const [activeTab, setActiveTab] = useState('REVENUE'); // REVENUE hoặc DELETED_ORDERS

  // BỘ LỌC TÌM KIẾM (Cho Tab Doanh Thu)
  const [searchKey, setSearchKey] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // STATE THỐNG KÊ
  const [stats, setStats] = useState({
    today: { total: 0, revenue: 0 },
    month: { total: 0, revenue: 0 },
    year: { total: 0, revenue: 0 }
  });

  // STATE MODAL HOÀN TÁC (Cho Tab Đơn Xóa)
  const [detailsModal, setDetailsModal] = useState(null);
  const [undoEmail, setUndoEmail] = useState('');

  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = subscribeToAllOrders((data) => {
      setAllOrders(data);
      calculateBusinessStats(data);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 1. Logic Tính Doanh Thu (Bỏ qua đơn Hủy/Xóa, chỉ tính đơn Hoàn thành + Đã thanh toán)
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
      // LOẠI BỎ CÁC ĐƠN KHÔNG TẠO RA DOANH THU
      if (o.status === 'DELETED' || o.status === 'CANCELLED' || o.status === 'CANCEL_REQUESTED') return;

      const orderDate = o.createdAt?.toDate() || new Date();
      const amount = parseInt(o.total?.replace(/\D/g, '') || 0);
      
      // Chỉ cộng tiền nếu đơn đã Hoàn thành và Đã thu tiền
      const isCountableRevenue = o.status === 'COMPLETED' && o.paymentStatus === 'PAID';

      // Ngày hôm nay
      if (orderDate.toLocaleDateString('vi-VN') === todayStr) {
        s.today.total++;
        if (isCountableRevenue) s.today.revenue += amount;
      }
      // Tháng này
      if (orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear) {
        s.month.total++;
        if (isCountableRevenue) s.month.revenue += amount;
      }
      // Năm nay
      if (orderDate.getFullYear() === currentYear) {
        s.year.total++;
        if (isCountableRevenue) s.year.revenue += amount;
      }
    });
    setStats(s);
  };

  // 2. Logic Bộ lọc (Cho Tab Doanh Thu)
  useEffect(() => {
    let result = allOrders.filter(o => o.status !== 'DELETED'); // Tab này không hiện đơn xóa

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

  // Lấy riêng danh sách đơn Đã Xóa Mềm
  const deletedOrders = allOrders.filter(o => o.status === 'DELETED');

  // 3. Logic Hoàn Tác (Bảo mật bằng Email Admin)
  const handleUndo = async (e) => {
    e.preventDefault();
    const currentAdminEmail = auth.currentUser?.email;

    if (undoEmail !== currentAdminEmail) {
      return alert("Email xác nhận không khớp với tài khoản Admin đang đăng nhập!");
    }

    const res = await undoDeleteOrder(detailsModal.id, detailsModal.usedVouchers);
    if (res.success) {
      alert("Khôi phục đơn hàng thành công!");
      setDetailsModal(null);
      setUndoEmail('');
    } else {
      alert("Lỗi khôi phục: " + res.error);
    }
  };


  if (isLoading) return <div className="p-20 text-center font-black text-blue-500 animate-pulse uppercase tracking-widest text-xs">Đang tải dữ liệu hệ thống...</div>;

  return (
    <div className="space-y-6">
      
      {/* HEADER & MENU TABS */}
      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100">
        <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Thống kê hệ thống</h2>
        <div className="flex gap-6 mt-6 border-b border-gray-100 pb-0">
          <button 
            onClick={() => setActiveTab('REVENUE')}
            className={`pb-4 px-2 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'REVENUE' ? 'text-blue-600 border-blue-600' : 'text-gray-400 border-transparent hover:text-gray-600'}`}
          >
            Doanh thu & Vận hành
          </button>
          <button 
            onClick={() => setActiveTab('DELETED_ORDERS')}
            className={`pb-4 px-2 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 flex items-center gap-2 ${activeTab === 'DELETED_ORDERS' ? 'text-red-600 border-red-600' : 'text-gray-400 border-transparent hover:text-gray-600'}`}
          >
            Lịch sử Xóa Đơn
            <span className={`px-2 py-0.5 rounded text-[8px] ${activeTab === 'DELETED_ORDERS' ? 'bg-red-100 text-red-600' : 'bg-gray-100'}`}>{deletedOrders.length}</span>
          </button>
        </div>
      </div>

      {/* ======================================= */}
      {/* TAB 1: THỐNG KÊ DOANH THU & LỊCH SỬ */}
      {/* ======================================= */}
      {activeTab === 'REVENUE' && (
        <div className="space-y-6 animate-in fade-in">
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
                className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none text-gray-600"
              />
            </div>
            {(searchKey || dateFilter) && (
              <div className="flex items-center pt-5">
                <button onClick={() => {setSearchKey(''); setDateFilter('');}} className="text-red-500 text-[10px] font-black uppercase tracking-widest hover:underline px-4">Xóa lọc</button>
              </div>
            )}
          </div>

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
                    <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
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
                        <StatusBadge status={order.status} />
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
      )}

      {/* ======================================= */}
      {/* TAB 2: ĐƠN HÀNG ĐÃ BỊ XÓA (CÓ HOÀN TÁC) */}
      {/* ======================================= */}
      {activeTab === 'DELETED_ORDERS' && (
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-red-100 overflow-hidden animate-in fade-in">
          {deletedOrders.length === 0 ? (
            <div className="p-20 text-center text-gray-300 font-bold uppercase tracking-widest text-xs">Chưa có đơn hàng nào bị xóa</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {deletedOrders.map(order => (
                <div key={order.id} className="p-6 px-8 flex justify-between items-center hover:bg-red-50/30 transition-colors">
                  <div>
                    <div className="flex items-center gap-3">
                       <span className="font-mono font-black text-gray-800 text-xs bg-gray-100 px-2 py-1 rounded">#{order.id.slice(-6).toUpperCase()}</span>
                       <h3 className="font-black text-gray-800 text-sm">{order.customer}</h3>
                    </div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase mt-2">
                       <span className="text-red-500">Xóa bởi: {order.deletedBy}</span> • {order.time}
                    </p>
                  </div>
                  <button 
                    onClick={() => setDetailsModal(order)}
                    className="bg-white border-2 border-red-100 text-red-500 hover:bg-red-50 hover:border-red-200 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors shadow-sm"
                  >
                    Xem & Khôi phục
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======================================= */}
      {/* MODAL: CHI TIẾT & BẢO MẬT HOÀN TÁC XÓA */}
      {/* ======================================= */}
      {detailsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter mb-4">Hồ sơ đơn xóa</h2>
            
            <div className="bg-red-50 p-4 rounded-2xl border border-red-100 mb-6">
              <p className="text-[9px] font-black text-red-400 uppercase tracking-widest mb-1">Quản trị viên xóa</p>
              <p className="text-xs font-black text-red-700 mb-3">{detailsModal.deletedBy}</p>
              
              <p className="text-[9px] font-black text-red-400 uppercase tracking-widest mb-1">Lý do lưu vết</p>
              <p className="text-sm font-bold text-red-900 italic">"{detailsModal.deleteReason}"</p>
            </div>

            <div className="space-y-3 mb-6 bg-gray-50 p-4 rounded-2xl">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-gray-400">Khách hàng:</span>
                <span className="font-black text-gray-800">{detailsModal.customer} - {detailsModal.phone}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="font-bold text-gray-400">Thời gian đặt:</span>
                <span className="font-black text-gray-800">{detailsModal.time}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="font-bold text-gray-400">Tổng tiền:</span>
                <span className="font-black text-red-500">{detailsModal.total}</span>
              </div>
            </div>

            <form onSubmit={handleUndo}>
               <div className="mb-6">
                 <label className="text-[9px] font-black text-blue-600 uppercase tracking-widest ml-1 block mb-2">Nhập Email Admin để xác nhận khôi phục *</label>
                 <input 
                   type="email" required 
                   value={undoEmail} 
                   onChange={e => setUndoEmail(e.target.value)} 
                   placeholder="Nhập email của bạn..." 
                   className="w-full bg-blue-50 border-none rounded-xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none text-blue-900 placeholder:text-blue-300" 
                 />
               </div>

               <div className="flex gap-3">
                 <button 
                   type="button"
                   onClick={() => {setDetailsModal(null); setUndoEmail('');}} 
                   className="flex-[1] py-4 text-[10px] font-black text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-2xl uppercase tracking-widest transition-colors"
                 >
                   Đóng
                 </button>
                 <button 
                   type="submit"
                   className="flex-[2] py-4 text-[10px] font-black text-white bg-blue-600 rounded-2xl uppercase tracking-widest shadow-lg shadow-blue-200 active:scale-95 transition-all"
                 >
                   Khôi phục vào bếp
                 </button>
               </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};

export default Statistics;