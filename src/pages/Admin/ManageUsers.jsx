import React, { useState, useEffect } from 'react';
import { getAllUsers, updateUserProfile } from '../../services/authService';

const ManageUsers = () => {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Tải danh sách người dùng thực tế từ Firebase
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    const data = await getAllUsers();
    setUsers(data);
    setIsLoading(false);
  };

  // 2. Hàm lọc khách hàng theo Tên hoặc SĐT
  const filteredUsers = users.filter(user => 
    (user.username && user.username.includes(searchQuery)) || 
    (user.fullName && user.fullName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // 3. Hàm khoá/mở khoá tài khoản trên Firebase
  const toggleUserStatus = async (user) => {
    const newStatus = user.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';
    const confirmMsg = newStatus === 'BLOCKED' 
      ? `Bạn có chắc muốn CHẶN khách hàng ${user.fullName}?` 
      : `Mở khoá cho khách hàng ${user.fullName}?`;

    if (window.confirm(confirmMsg)) {
      const result = await updateUserProfile(user.id, { status: newStatus });
      if (result.success) {
        // Cập nhật state cục bộ để UI thay đổi ngay lập tức
        setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: newStatus } : u));
      } else {
        alert("Lỗi cập nhật: " + result.error);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="p-20 text-center text-gray-400">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-sm font-bold uppercase tracking-widest">Đang tải danh sách thành viên...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      
      {/* Header và Thanh tìm kiếm */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-black text-gray-800 uppercase tracking-tight">Danh sách Khách hàng</h2>
          <p className="text-sm text-gray-500 font-medium">Tổng cộng: {users.length} tài khoản thực tế</p>
        </div>
        
        <div className="relative w-full sm:w-72">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input 
            type="text" 
            placeholder="Tìm tên hoặc số điện thoại..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 bg-gray-50/50 transition-all focus:ring-4 focus:ring-blue-500/5"
          />
        </div>
      </div>

      {/* Bảng Danh sách Khách hàng */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 text-gray-400 text-[11px] uppercase tracking-widest border-b border-gray-100">
                <th className="px-6 py-4 font-black">Khách hàng</th>
                <th className="px-6 py-4 font-black">SĐT Nhận hàng</th>
                <th className="px-6 py-4 font-black">Địa chỉ</th>
                <th className="px-6 py-4 font-black text-center">Đơn hàng</th>
                <th className="px-6 py-4 font-black text-center">Trạng thái</th>
                <th className="px-6 py-4 font-black text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-20 text-center text-gray-400 italic">
                    Không tìm thấy dữ liệu khách hàng phù hợp.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="font-bold text-gray-800 group-hover:text-blue-600 transition-colors">{user.fullName}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">ID: {user.username}</p>
                    </td>
                    
                    <td className="px-6 py-4 text-sm font-bold text-gray-600">
                      {user.deliveryPhone || user.username}
                    </td>
                    
                    <td className="px-6 py-4">
                      <p className="text-xs text-gray-500 line-clamp-2 max-w-[200px] leading-relaxed">{user.address}</p>
                    </td>
                    
                    <td className="px-6 py-4 text-center">
                      <p className="text-sm font-black text-gray-800">{user.totalOrders || 0}</p>
                    </td>

                    <td className="px-6 py-4 text-center">
                      <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter border ${
                        user.status === 'ACTIVE' 
                          ? 'bg-green-50 text-green-600 border-green-100' 
                          : 'bg-red-50 text-red-600 border-red-100'
                      }`}>
                        {user.status === 'ACTIVE' ? 'Hoạt động' : 'Đã chặn'}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => toggleUserStatus(user)}
                        className={`text-[11px] px-4 py-2 rounded-xl font-bold uppercase transition-all shadow-sm active:scale-95 ${
                          user.status === 'ACTIVE'
                            ? 'bg-red-50 text-red-500 hover:bg-red-500 hover:text-white'
                            : 'bg-green-50 text-green-600 hover:bg-green-600 hover:text-white'
                        }`}
                      >
                        {user.status === 'ACTIVE' ? 'Chặn khách' : 'Bỏ chặn'}
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