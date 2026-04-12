import React, { useState } from 'react';

// Dữ liệu khách hàng giả lập (Mock Data)
const initialUsers = [
  { id: 'U001', username: '0901234567', fullName: 'Nguyễn Văn A', deliveryPhone: '0901234567', address: 'S1.01 Origami, Vinhomes', joinDate: '10/05/2026', totalOrders: 15, status: 'ACTIVE' },
  { id: 'U002', username: '0912345678', fullName: 'Trần Thị B', deliveryPhone: '0988888888', address: 'S2.02 Rainbow, Vinhomes', joinDate: '12/05/2026', totalOrders: 3, status: 'ACTIVE' },
  { id: 'U003', username: '0987654321', fullName: 'Lê Văn C', deliveryPhone: '0987654321', address: 'S3.03 Beverly, Vinhomes', joinDate: '14/05/2026', totalOrders: 1, status: 'ACTIVE' },
  { id: 'U004', username: '0909090909', fullName: 'Phạm D (Boom hàng)', deliveryPhone: '0909090909', address: 'S1.05 Origami, Vinhomes', joinDate: '01/05/2026', totalOrders: 4, status: 'BLOCKED' },
];

const ManageUsers = () => {
  const [users, setUsers] = useState(initialUsers);
  const [searchQuery, setSearchQuery] = useState('');

  // Lọc danh sách khách hàng theo SĐT hoặc Tên
  const filteredUsers = users.filter(user => 
    user.username.includes(searchQuery) || 
    user.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Hàm khoá/mở khoá tài khoản (Mô phỏng chặn khách hay boom hàng)
  const toggleUserStatus = (userId) => {
    setUsers(users.map(user => {
      if (user.id === userId) {
        return { ...user, status: user.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE' };
      }
      return user;
    }));
  };

  return (
    <div className="space-y-6 relative">
      
      {/* Header và Thanh tìm kiếm */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Danh sách Khách hàng</h2>
          <p className="text-sm text-gray-500">Tổng cộng: {users.length} tài khoản đã đăng ký</p>
        </div>
        
        <div className="relative w-full sm:w-72">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input 
            type="text" 
            placeholder="Tìm theo Tên hoặc SĐT..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 bg-gray-50/50 transition-colors"
          />
        </div>
      </div>

      {/* Bảng Danh sách Khách hàng */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-sm border-b border-gray-100">
                <th className="px-6 py-4 font-medium">Khách hàng</th>
                <th className="px-6 py-4 font-medium">Liên hệ nhận hàng</th>
                <th className="px-6 py-4 font-medium">Địa chỉ mặc định</th>
                <th className="px-6 py-4 font-medium text-center">Thống kê</th>
                <th className="px-6 py-4 font-medium text-center">Trạng thái</th>
                <th className="px-6 py-4 font-medium text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-10 text-center text-gray-500">
                    Không tìm thấy khách hàng nào phù hợp.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-800">{user.fullName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Username: <span className="font-medium text-blue-600">{user.username}</span></p>
                    </td>
                    
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-800">{user.deliveryPhone}</p>
                      {user.deliveryPhone !== user.username && (
                         <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded mt-1 inline-block">SĐT khác</span>
                      )}
                    </td>
                    
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-800 line-clamp-2">{user.address}</p>
                    </td>
                    
                    <td className="px-6 py-4 text-center">
                      <p className="text-sm font-bold text-gray-800">{user.totalOrders}</p>
                      <p className="text-[11px] text-gray-500 uppercase tracking-wide mt-0.5">Đơn hàng</p>
                    </td>

                    <td className="px-6 py-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border inline-block ${
                        user.status === 'ACTIVE' 
                          ? 'bg-green-50 text-green-700 border-green-200' 
                          : 'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        {user.status === 'ACTIVE' ? 'Đang hoạt động' : 'Bị chặn'}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => toggleUserStatus(user.id)}
                        className={`text-sm px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                          user.status === 'ACTIVE'
                            ? 'text-red-600 border-red-200 hover:bg-red-50'
                            : 'text-green-600 border-green-200 hover:bg-green-50'
                        }`}
                      >
                        {user.status === 'ACTIVE' ? 'Chặn' : 'Bỏ chặn'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default ManageUsers;