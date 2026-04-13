import React, { useState, useEffect } from 'react';
import { getAllUsers, updateUserProfile } from '../../services/authService';
import { createVoucher, deleteVoucher, getAllVouchers } from '../../services/orderService';
import { doc, updateDoc, serverTimestamp } from 'firebase/timestamp';
import { db } from '../../firebase/config';

const ManageUsers = () => {
  const [users, setUsers] = useState([]);
  const [allVouchers, setAllVouchers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // State dành cho Modal chỉnh sửa thông tin
  const [editingUser, setEditingUser] = useState(null);
  
  // State dành cho Modal quản lý Voucher khách
  const [voucherModalUser, setVoucherModalUser] = useState(null);
  const [newVoucher, setNewVoucher] = useState({ code: '', value: 0, type: 'CASH', usageLimit: 1 });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setIsLoading(true);
    const [userData, voucherData] = await Promise.all([getAllUsers(), getAllVouchers()]);
    setUsers(userData);
    setAllVouchers(voucherData);
    setIsLoading(false);
  };

  const filteredUsers = users.filter(user => 
    (user.username && user.username.includes(searchQuery)) || 
    (user.fullName && user.fullName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // --- HÀM CẬP NHẬT THÔNG TIN KHÁCH HÀNG ---
  const handleSaveUserInfo = async () => {
    if (!editingUser.fullName || !editingUser.address) {
      alert("Vui lòng điền đầy đủ thông tin!");
      return;
    }
    try {
      const userRef = doc(db, 'users', editingUser.id);
      await updateDoc(userRef, {
        fullName: editingUser.fullName,
        deliveryPhone: editingUser.deliveryPhone || editingUser.username,
        address: editingUser.address,
        updatedAt: serverTimestamp()
      });
      setUsers(prev => prev.map(u => u.id === editingUser.id ? editingUser : u));
      setEditingUser(null);
      alert("Cập nhật thông tin thành công!");
    } catch (error) {
      alert("Lỗi: " + error.message);
    }
  };

  // --- HÀM QUẢN LÝ VOUCHER RIÊNG CHO KHÁCH ---
  const handleAddVoucherToUser = async () => {
    if (!newVoucher.code) return;
    const vData = {
      ...newVoucher,
      assignedPhone: voucherModalUser.username, // Gán trực tiếp cho SĐT khách
      expiry: null // Có thể thêm date picker nếu cần
    };
    const res = await createVoucher(vData);
    if (res.success) {
      const updatedV = await getAllVouchers();
      setAllVouchers(updatedV);
      setNewVoucher({ code: '', value: 0, type: 'CASH', usageLimit: 1 });
      alert(`Đã tặng Voucher cho ${voucherModalUser.fullName}`);
    }
  };

  const handleDeleteUserVoucher = async (vId) => {
    if (window.confirm("Xóa Voucher này của khách?")) {
      await deleteVoucher(vId);
      setAllVouchers(prev => prev.filter(v => v.id !== vId));
    }
  };

  if (isLoading) return <div className="p-20 text-center animate-pulse font-black text-blue-600">ĐANG TẢI DỮ LIỆU...</div>;

  return (
    <div className="space-y-6">
      {/* Header & Search */}
      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Cơ sở dữ liệu khách hàng</h2>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Quản lý tài khoản & Voucher ưu đãi</p>
        </div>
        <input 
          type="text" placeholder="Tìm tên hoặc SĐT..." value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full md:w-80 px-6 py-3 bg-gray-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none"
        />
      </div>

      {/* Danh sách Table */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 text-gray-400 text-[10px] font-black uppercase tracking-widest border-b">
                <th className="px-8 py-5">Khách hàng</th>
                <th className="px-8 py-5">SĐT & Địa chỉ</th>
                <th className="px-8 py-5 text-center">Voucher</th>
                <th className="px-8 py-5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-blue-50/20 transition-all group">
                  <td className="px-8 py-5">
                    <p className="font-black text-gray-800 text-sm uppercase">{user.fullName}</p>
                    <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded-md font-bold text-gray-400 mt-1 inline-block">ID: {user.username}</span>
                  </td>
                  <td className="px-8 py-5">
                    <p className="text-xs font-black text-blue-600">{user.deliveryPhone || user.username}</p>
                    <p className="text-[10px] text-gray-500 font-medium line-clamp-1 mt-1">{user.address}</p>
                  </td>
                  <td className="px-8 py-5 text-center">
                    <button 
                      onClick={() => setVoucherModalUser(user)}
                      className="bg-orange-50 text-orange-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-600 hover:text-white transition-all"
                    >
                      🎁 {allVouchers.filter(v => v.assignedPhone === user.username).length} Mã
                    </button>
                  </td>
                  <td className="px-8 py-5 text-right space-x-2">
                    <button 
                      onClick={() => setEditingUser(user)}
                      className="p-3 bg-gray-50 text-gray-400 hover:text-blue-600 rounded-xl transition-all"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                    <button className={`p-3 rounded-xl transition-all ${user.status === 'ACTIVE' ? 'text-red-300 hover:text-red-600' : 'text-green-500'}`}>
                       {/* Nút block giữ như cũ */}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MODAL CHỈNH SỬA THÔNG TIN --- */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in">
            <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter mb-6">Sửa hồ sơ khách</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Họ và Tên</label>
                <input type="text" value={editingUser.fullName} onChange={e => setEditingUser({...editingUser, fullName: e.target.value})} className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm font-bold" />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">SĐT Nhận hàng</label>
                <input type="tel" value={editingUser.deliveryPhone || editingUser.username} onChange={e => setEditingUser({...editingUser, deliveryPhone: e.target.value})} className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm font-bold" />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Địa chỉ mặc định</label>
                <textarea value={editingUser.address} onChange={e => setEditingUser({...editingUser, address: e.target.value})} className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm font-bold" rows="2" />
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setEditingUser(null)} className="flex-1 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Hủy</button>
                <button onClick={handleSaveUserInfo} className="flex-[2] bg-blue-600 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-100">Cập nhật ngay</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL QUẢN LÝ VOUCHER RIÊNG --- */}
      {voucherModalUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom-10 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Voucher: {voucherModalUser.fullName}</h3>
                <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mt-1">SĐT: {voucherModalUser.username}</p>
              </div>
              <button onClick={() => setVoucherModalUser(null)} className="text-gray-400 hover:text-black font-black text-2xl">&times;</button>
            </div>

            {/* Form tạo mới voucher cho khách này */}
            <div className="bg-gray-50 p-6 rounded-3xl mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="md:col-span-2"><p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mb-4">Tặng Voucher mới cho khách</p></div>
               <input type="text" placeholder="Mã Code (VD: TRIAN50)" value={newVoucher.code} onChange={e => setNewVoucher({...newVoucher, code: e.target.value.toUpperCase()})} className="w-full bg-white border-none rounded-xl px-4 py-3 text-sm font-bold" />
               <select value={newVoucher.type} onChange={e => setNewVoucher({...newVoucher, type: e.target.value})} className="w-full bg-white border-none rounded-xl px-4 py-3 text-sm font-bold">
                  <option value="CASH">Giảm tiền mặt (đ)</option>
                  <option value="FREESHIP">Freeship vận chuyển</option>
               </select>
               {newVoucher.type === 'CASH' && (
                 <input type="number" placeholder="Số tiền giảm (đ)" value={newVoucher.value} onChange={e => setNewVoucher({...newVoucher, value: parseInt(e.target.value)})} className="w-full bg-white border-none rounded-xl px-4 py-3 text-sm font-bold" />
               )}
               <button onClick={handleAddVoucherToUser} className="bg-blue-600 text-white font-black text-[10px] uppercase rounded-xl shadow-lg shadow-blue-100">Thêm Mã</button>
            </div>

            {/* Danh sách voucher hiện có của khách này */}
            <div className="space-y-3">
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Voucher đang sở hữu</p>
               {allVouchers.filter(v => v.assignedPhone === voucherModalUser.username).length === 0 ? (
                 <p className="text-xs text-gray-400 italic">Khách hàng chưa có mã ưu đãi nào.</p>
               ) : (
                 allVouchers.filter(v => v.assignedPhone === voucherModalUser.username).map(v => (
                   <div key={v.id} className="flex justify-between items-center bg-white border border-gray-100 p-4 rounded-2xl shadow-sm">
                      <div>
                        <p className="font-black text-gray-800 text-sm tracking-tight">{v.code}</p>
                        <p className="text-[10px] text-green-600 font-bold uppercase">{v.type === 'FREESHIP' ? 'Miễn phí ship' : `Giảm -${v.value.toLocaleString()}đ`}</p>
                      </div>
                      <button onClick={() => handleDeleteUserVoucher(v.id)} className="text-red-400 hover:text-red-600 transition-colors p-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                   </div>
                 ))
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageUsers;