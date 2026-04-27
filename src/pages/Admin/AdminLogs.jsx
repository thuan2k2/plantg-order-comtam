import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { db } from '../../firebase/config'; // Lưu ý đường dẫn import tùy vào cấu trúc thư mục của bạn

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
      const collectionName = activeTab === 'BALANCE' ? 'balance_history' : 'security_logs';
      const startDate = getStartDate(timeFilter);

      // Query cơ bản: Lọc theo thời gian và lấy 150 log mới nhất
      // (Không dùng where 'phone' kết hợp orderBy ở đây để tránh lỗi thiếu Index trên Firebase)
      const q = query(
        collection(db, collectionName),
        where('timestamp', '>=', startDate),
        orderBy('timestamp', 'desc'),
        limit(150)
      );

      const snapshot = await getDocs(q);
      let fetchedLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Lọc theo SĐT (Filter phía Client để nhẹ Database)
      if (searchPhone.trim()) {
        fetchedLogs = fetchedLogs.filter(log => 
          (log.userId && log.userId.includes(searchPhone.trim())) || 
          (log.phone && log.phone.includes(searchPhone.trim()))
        );
      }

      setLogs(fetchedLogs);

      // YÊU CẦU ĐẶC BIỆT: Lấy 6 giá trị (1 Hiện tại + 5 Lịch sử) nếu đang tìm 1 SĐT cụ thể
      if (activeTab === 'BALANCE' && searchPhone.trim().length >= 10) {
        const historyQuery = query(
          collection(db, 'balance_history'),
          where('userId', '==', searchPhone.trim()),
          orderBy('timestamp', 'desc'),
          limit(6)
        );
        const historySnap = await getDocs(historyQuery);
        setUserHistory(historySnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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
    }, 500); // Đợi 0.5s sau khi gõ phím mới query để tránh spam DB

    return () => clearTimeout(delayDebounceFn);
  }, [activeTab, timeFilter, searchPhone]);

  // Map màu sắc cho các nguồn cộng Xu/Ví
  const sourceColors = {
    'admin': 'bg-purple-100 text-purple-700 border-purple-200',
    'refund': 'bg-blue-100 text-blue-700 border-blue-200',
    'order_payment': 'bg-gray-100 text-gray-700 border-gray-200',
    'checkin': 'bg-green-100 text-green-700 border-green-200',
    'pet': 'bg-pink-100 text-pink-700 border-pink-200',
    'gift': 'bg-yellow-100 text-yellow-700 border-yellow-200',
    'lucky': 'bg-red-100 text-red-700 border-red-200',
    'new_user': 'bg-teal-100 text-teal-700 border-teal-200',
    'mail': 'bg-indigo-100 text-indigo-700 border-indigo-200',
    'unknown': 'bg-gray-100 text-gray-500 border-gray-200'
  };

  const translateSource = (source) => {
    const dict = {
      'admin': 'Quản trị viên', 'refund': 'Hoàn tiền', 'order_payment': 'Thanh toán/Mua hàng',
      'checkin': 'Điểm danh', 'pet': 'Thú cưng', 'gift': 'Hộp quà', 'lucky': 'Lì xì',
      'new_user': 'Đăng ký mới', 'mail': 'Quà từ thư'
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

      {/* KHỐI LỊCH SỬ 6 BƯỚC (Chỉ hiện khi tìm chính xác 1 SĐT ở tab Balance) */}
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
                    {index === 0 ? 'HIỆN TẠI' : `TRƯỚC ĐÓ ${index}`}
                  </span>
                  <div className="mt-3">
                    <p className={`text-xs font-bold ${index === 0 ? 'text-blue-100' : 'text-gray-500'}`}>Tổng Xu</p>
                    <p className="text-lg font-black">{history.totalXu?.toLocaleString()}</p>
                  </div>
                  <div className="mt-1">
                    <p className={`text-xs font-bold ${index === 0 ? 'text-blue-100' : 'text-gray-500'}`}>Ví tiền</p>
                    <p className="text-lg font-black">{history.walletBalance?.toLocaleString()}đ</p>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-dashed border-gray-300 border-opacity-30">
                  <p className={`text-[10px] font-bold ${index === 0 ? 'text-blue-200' : 'text-gray-400'}`}>
                    {history.timestamp?.toDate().toLocaleString('vi-VN')}
                  </p>
                  <p className={`text-[10px] font-black uppercase truncate mt-0.5 ${index === 0 ? 'text-white' : 'text-blue-600'}`}>
                    Nguồn: {translateSource(history.source)}
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
                      <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">Mã Vi Phạm</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">Chi tiết / Lý do cấm</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-xs font-bold text-gray-800">{log.timestamp?.toDate().toLocaleDateString('vi-VN')}</p>
                      <p className="text-[10px] font-black text-gray-400 uppercase">{log.timestamp?.toDate().toLocaleTimeString('vi-VN')}</p>
                    </td>
                    
                    <td className="px-6 py-4">
                      <span className="text-sm font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">
                        {log.userId || log.phone || 'Ẩn danh'}
                      </span>
                    </td>

                    {activeTab === 'BALANCE' ? (
                      <>
                        <td className="px-6 py-4 text-right">
                          <span className={`text-sm font-black ${log.xuChange > 0 ? 'text-green-600' : log.xuChange < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                            {log.xuChange > 0 ? '+' : ''}{log.xuChange || 0}
                          </span>
                          <p className="text-[9px] font-bold text-gray-400">Hiện tại: {log.totalXu}</p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`text-sm font-black ${log.walletChange > 0 ? 'text-green-600' : log.walletChange < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                            {log.walletChange > 0 ? '+' : ''}{log.walletChange?.toLocaleString() || 0}đ
                          </span>
                          <p className="text-[9px] font-bold text-gray-400">Hiện tại: {log.walletBalance?.toLocaleString()}đ</p>
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