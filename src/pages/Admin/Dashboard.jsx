import React from 'react';

// Dữ liệu giả lập (Sau này sẽ fetch từ Firebase/orderService)
const recentOrders = [
  { id: 'DH005', customer: 'Nguyễn Văn A', phone: '0901234567', total: '197,000đ', status: 'PENDING', time: '10:45 15/05/2026' },
  { id: 'DH004', customer: 'Trần Thị B', phone: '0912345678', total: '60,000đ', status: 'PREPARING', time: '10:30 15/05/2026' },
  { id: 'DH003', customer: 'Lê Văn C', phone: '0987654321', total: '120,000đ', status: 'DELIVERING', time: '09:15 15/05/2026' },
  { id: 'DH002', customer: 'Phạm D', phone: '0909090909', total: '70,000đ', status: 'CANCEL_REQUESTED', time: '08:50 15/05/2026' },
];

const Dashboard = () => {
  return (
    <div className="space-y-6">
      
      {/* Khối Thẻ Thống kê (Metric Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Đơn mới chờ duyệt</p>
            <p className="text-2xl font-bold text-gray-800">12</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-orange-100 text-orange-600 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Đang chuẩn bị / Giao</p>
            <p className="text-2xl font-bold text-gray-800">5</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-100 text-red-600 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Yêu cầu huỷ đơn</p>
            <p className="text-2xl font-bold text-red-600">1</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-green-100 text-green-600 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Doanh thu hôm nay</p>
            <p className="text-2xl font-bold text-gray-800">1.450k</p>
          </div>
        </div>
      </div>

      {/* Bảng Danh sách đơn hàng mới nhất */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-lg font-semibold text-gray-800">Đơn hàng mới nhận</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-sm border-b border-gray-100">
                <th className="px-6 py-3 font-medium">Mã Đơn</th>
                <th className="px-6 py-3 font-medium">Khách Hàng</th>
                <th className="px-6 py-3 font-medium">Tổng Tiền</th>
                <th className="px-6 py-3 font-medium">Trạng Thái</th>
                <th className="px-6 py-3 font-medium">Thời Gian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-mono text-sm text-gray-800 font-medium">{order.id}</td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-800">{order.customer}</p>
                    <p className="text-xs text-gray-500">{order.phone}</p>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-800">{order.total}</td>
                  <td className="px-6 py-4">
                    {order.status === 'PENDING' && <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium border border-gray-200">Đã gửi đơn</span>}
                    {order.status === 'PREPARING' && <span className="px-2.5 py-1 bg-orange-100 text-orange-700 rounded-md text-xs font-medium border border-orange-200">Đang chuẩn bị</span>}
                    {order.status === 'DELIVERING' && <span className="px-2.5 py-1 bg-purple-100 text-purple-700 rounded-md text-xs font-medium border border-purple-200">Đang giao</span>}
                    {order.status === 'CANCEL_REQUESTED' && <span className="px-2.5 py-1 bg-yellow-100 text-yellow-800 rounded-md text-xs font-medium border border-yellow-300">Yêu cầu huỷ</span>}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{order.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default Dashboard;