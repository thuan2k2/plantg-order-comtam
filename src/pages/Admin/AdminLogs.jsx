import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config'; 

const AdminLogs = () => {
  const [activeTab, setActiveTab] = useState('BALANCE'); // 'BALANCE' hoặc 'SECURITY'
  const [timeFilter, setTimeFilter] = useState('TODAY'); // TODAY, WEEK, MONTH, YEAR, ALL
  const [searchPhone, setSearchPhone] = useState('');
  
  const [logs, setLogs] = useState([]);
  const [userHistory, setUserHistory] = useState([]); // Chứa 6 record gần nhất của 1 User
  const [isLoading, setIsLoading] = useState(false);

  // Hàm tính toán thời gian bắt đầu lọc
  const getStartDate = (filter) => {
    const now = new Date();
    if (filter === 'TODAY') return new Date(now.setHours(0, 0, 0, 0));
    if (filter === 'WEEK') {
      const d = new Date(now.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1))); // T2 đầu tuần
      return new Date(d.setHours(0, 0, 0, 0));
    }
    if (filter === 'MONTH') return new Date(now.getFullYear(), now.getMonth(), 1);
    if (filter === 'YEAR') return new Date(now.getFullYear(), 0, 1);
    return new Date(0); // ALL
  };

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const startDate = getStartDate(timeFilter);

      // TỐI ƯU HÓA: Query 500 logs mới nhất rồi filter bằng JS để tránh lỗi thiếu Composite Index trên Firebase
      const q = query(
        collection(db, 'admin_logs'),
        orderBy('createdAt', 'desc'),
        limit(500)
      );

      const snapshot = await getDocs(q);
      let fetchedLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // 1. Lọc theo Tab (BALANCE hoặc SECURITY) và Lọc theo Thời gian
      fetchedLogs = fetchedLogs.filter(log => 
        log.type === activeTab &&
        log.createdAt && log.createdAt.toDate() >= startDate
      );

      // 2. Lọc theo SĐT Khách hàng
      if (searchPhone.trim()) {
        fetchedLogs = fetchedLogs.filter(log => 
          log.targetPhone && log.targetPhone.includes(searchPhone.trim())
        );
      }

      setLogs(fetchedLogs);

      // 3. Tận dụng data đã lấy để hiển thị Lịch sử 6 bước nếu đang tìm 1 SĐT cụ thể
      if (activeTab === 'BALANCE' && searchPhone.trim().length >= 10) {
        setUserHistory(fetchedLogs.slice(0, 6));
      } else {
        setUserHistory([]);
      }

    } catch (error) {
      console.error("Lỗi lấy logs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Tự động load lại data khi đổi Tab, Thời gian hoặc gõ xong SĐT
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchLogs();
    }, 500); 

    return () => clearTimeout(delayDebounceFn);
  }, [activeTab, timeFilter, searchPhone]);

  // CẬP NHẬT: Map màu sắc cho các nguồn tracking mới
  const sourceColors = {
    'ADMIN_DEPOSIT': 'bg-purple-100 text-purple-700 border-purple-200',
    'ADMIN_DEDUCT': 'bg-orange-100 text-orange-700 border-orange-200',
    'ORDER_REFUND': 'bg-blue-100 text-blue-700 border-blue-200',
    'ORDER_PAYMENT': 'bg-gray-100 text-gray-700 border-gray-200',
    'ORDER_BONUS': 'bg-green-100 text-green-700 border-green-200',
    'PET_REWARD': 'bg-pink-100 text-pink-700 border-pink-200',
    'F12_HACK_DETECTED': 'bg-red-100 text-red-700 border-red-200',
    'unknown': 'bg-gray-100 text-gray-500 border-gray-200'
  };

  const translateSource = (source) => {
    const dict = {
      'ADMIN_DEPOSIT': 'Admin Nạp',
      'ADMIN_DEDUCT': 'Admin Trừ',
      'ORDER_REFUND': 'Hoàn tiền Hủy đơn',
      'ORDER_PAYMENT': 'Thanh toán Đơn',
      'ORDER_BONUS': 'Thưởng Đơn hàng',
      'PET_REWARD': 'Thú cưng',
      'F12_HACK_DETECTED': 'DevTools / Hack'
    };
    return dict[source] || source || 'Không rõ';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-gray-800 tracking-tighter">NHẬT KÝ HỆ THỐNG</h1>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
            Giám sát số dư và bảo mật
          </p>
        </div>

        {/* Tab Chuyển đổi */}
        <div className="flex bg-gray-100 p-1 rounded-2xl w-full md:w-auto">
          <button
            onClick={() => setActiveTab('BALANCE')}
            className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === 'BALANCE' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            💰 Biến động số dư
          </button>
          <button
            onClick={() => setActiveTab('SECURITY')}
            className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === 'SECURITY' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            🛡️ Cảnh báo Hack
          </button>
        </div>
      </div>

      {/* Bộ Lọc */}
      <div className="flex flex-col md:flex-row gap-4">
        <select 
          value={timeFilter}
          onChange={(e) => setTimeFilter(e.target.value)}
          className="px-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-bold text-gray-700 outline-none focus:border-blue-500 shadow-sm"
        >
          <option value="TODAY">Hôm nay</option>
          <option value="WEEK">Tuần này</option>
          <option value="MONTH">Tháng này</option>
          <option value="YEAR">Năm nay</option>
          <option value="ALL">Toàn thời gian</option>
        </select>

        <div className="flex-1 relative">
          <input 
            type="text" 
            placeholder="🔍 Nhập số điện thoại cần tra cứu..."
            value={searchPhone}
            onChange={(e) => setSearchPhone(e.target.value)}
            className="w-full px-5 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-bold text-gray-700 outline-none focus:border-blue-500 shadow-sm pr-10"
          />
          {searchPhone && (
            <button onClick={() => setSearchPhone('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 font-bold">✕</button>
          )}
        </div>
      </div>

      {/* KHỐI LỊCH SỬ 6 BƯỚC */}
      {activeTab === 'BALANCE' && userHistory.length > 0 && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 p-6 rounded-[2rem] shadow-sm">
          <h2 className="text-sm font-black text-blue-800 uppercase tracking-widest mb-4">
            🔍 Hồ sơ biến động: <span className="text-blue-600 bg-white px-3 py-1 rounded-lg shadow-sm ml-2">{searchPhone}</span>
          </h2>
          
          <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
            {userHistory.map((history, index) => (
              <div key={history.id} className={`min-w-[160px] p-4 rounded-2xl border flex flex-col justify-between shrink-0 ${index === 0 ? 'bg-blue-600 border-blue-700 shadow-lg text-white transform scale-105 mx-2' : 'bg-white border-gray-200'}`}>
                <div>
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${index === 0 ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                    {index === 0 ? 'MỚI NHẤT' : `TRƯỚC ĐÓ ${index}`}
                  </span>
                  
                  {/* Cập nhật hiển thị tài sản động theo assetType */}
                  <div className="mt-3">
                    <p className={`text-[10px] font-bold ${index === 0 ? 'text-blue-100' : 'text-gray-400'} uppercase tracking-widest`}>
                      {history.assetType === 'xu' ? 'Tổng Xu' : 'Số dư Ví'}
                    </p>
                    <p className="text-lg font-black">
                      {history.walletBalance?.toLocaleString()}{history.assetType === 'wallet' ? 'đ' : ''}
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-dashed border-gray-300 border-opacity-30">
                  <p className={`text-[10px] font-bold ${index === 0 ? 'text-blue-200' : 'text-gray-400'}`}>
                    {history.createdAt?.toDate().toLocaleString('vi-VN')}
                  </p>
                  <p className={`text-[10px] font-black uppercase truncate mt-0.5 ${index === 0 ? 'text-white' : 'text-blue-600'}`}>
                    {translateSource(history.source)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BẢNG LOGS */}
      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <span className="text-4xl mb-2">📭</span>
            <p className="text-[10px] font-black uppercase tracking-widest">Không có dữ liệu trong khoảng thời gian này</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">Thời gian</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">SĐT Khách hàng</th>
                  
                  {activeTab === 'BALANCE' ? (
                    <>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right whitespace-nowrap">Biến động Xu</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right whitespace-nowrap">Biến động Ví</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center whitespace-nowrap">Nguồn / Tác vụ</th>
                    </>
                  ) : (
                    <>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">Hành động của Bot</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">Chi tiết / Lý do cấm</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-xs font-bold text-gray-800">{log.createdAt?.toDate().toLocaleDateString('vi-VN')}</p>
                      <p className="text-[10px] font-black text-gray-400 uppercase">{log.createdAt?.toDate().toLocaleTimeString('vi-VN')}</p>
                    </td>
                    
                    <td className="px-6 py-4">
                      <span className="text-sm font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-lg tracking-wider">
                        {log.targetPhone || 'Ẩn danh'}
                      </span>
                    </td>

                    {activeTab === 'BALANCE' ? (
                      <>
                        <td className="px-6 py-4 text-right">
                          {log.assetType === 'xu' ? (
                            <>
                              <span className={`text-sm font-black ${log.walletChange > 0 ? 'text-green-600' : log.walletChange < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                {log.walletChange > 0 ? '+' : ''}{log.walletChange}
                              </span>
                              <p className="text-[9px] font-bold text-gray-400">Hiện tại: {log.walletBalance?.toLocaleString()}</p>
                            </>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {log.assetType === 'wallet' ? (
                            <>
                              <span className={`text-sm font-black ${log.walletChange > 0 ? 'text-green-600' : log.walletChange < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                {log.walletChange > 0 ? '+' : ''}{log.walletChange?.toLocaleString()}đ
                              </span>
                              <p className="text-[9px] font-bold text-gray-400">Hiện tại: {log.walletBalance?.toLocaleString()}đ</p>
                            </>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${sourceColors[log.source] || sourceColors['unknown']}`}>
                            {translateSource(log.source)}
                          </span>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4">
                          <span className="bg-red-100 text-red-600 border border-red-200 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs font-bold text-gray-800 line-clamp-2 max-w-md">{log.reason}</p>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminLogs;