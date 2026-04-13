import React, { useState, useEffect } from 'react';
import { 
  subscribeToAllUsers, 
  updateUserProfile, 
  deleteUser, 
  updateUserBanStatus,
  resetPasscodeByAdmin, 
  topUpUserWallet // Bổ sung hàm Nạp tiền từ authService
} from '../../services/authService';
import { createVoucher, deleteVoucher, getAllVouchers } from '../../services/orderService';

const ManageUsers = () => {
  const [users, setUsers] = useState([]);
  const [allVouchers, setAllVouchers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // States cho các Modals
  const [editingUser, setEditingUser] = useState(null);
  const [voucherModalUser, setVoucherModalUser] = useState(null);
  const [newVoucher, setNewVoucher] = useState({ code: '', value: 0, type: 'CASH', usageLimit: 1 });
  
  // States cho Modal Cấm User
  const [showBanModal, setShowBanModal] = useState(false);
  const [banUserTarget, setBanUserTarget] = useState(null);
  const [banDuration, setBanDuration] = useState('7'); 
  const [customBanDate, setCustomBanDate] = useState('');

  // SỬ DỤNG REAL-TIME LISTENER THAY VÌ LẤY 1 LẦN
  useEffect(() => {
    setIsLoading(true);
    const unsubscribeUsers = subscribeToAllUsers((userData) => {
      setUsers(userData);
      setIsLoading(false);
    });

    const fetchVouchers = async () => {
      const voucherData = await getAllVouchers();
      setAllVouchers(voucherData);
    };
    fetchVouchers();

    return () => unsubscribeUsers();
  }, []);

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
      const result = await updateUserProfile(editingUser.id, {
        fullName: editingUser.fullName,
        deliveryPhone: editingUser.deliveryPhone || editingUser.username,
        address: editingUser.address
      });
      
      if (result.success) {
        setEditingUser(null);
        alert("Cập nhật thông tin thành công!");
      } else {
        alert("Lỗi: " + result.error);
      }
    } catch (error) {
      alert("Lỗi: " + error.message);
    }
  };

  // --- HÀM NẠP TIỀN VÀO VÍ KHÁCH HÀNG ---
  const handleTopUpWallet = async (user) => {
    const currentBalance = user.walletBalance || 0;
    const amountStr = prompt(
      `NẠP TIỀN VÀO VÍ KHÁCH HÀNG:\n\nTên: ${user.fullName}\nSĐT: ${user.username}\nSố dư hiện tại: ${currentBalance.toLocaleString()}đ\n\nNhập số tiền muốn NẠP THÊM (VNĐ):`,
      "50000"
    );

    if (amountStr !== null) {
      const amount = parseInt(amountStr.replace(/\D/g, '')); // Lọc bỏ ký tự thừa, chỉ lấy số
      
      if (isNaN(amount) || amount <= 0) {
        return alert("Số tiền không hợp lệ! Vui lòng nhập một số lớn hơn 0.");
      }

      if (window.confirm(`Bạn có chắc chắn muốn nạp ${amount.toLocaleString()}đ vào ví của ${user.fullName}?`)) {
        const result = await topUpUserWallet(user.id, amount);
        if (result.success) {
          alert(`✅ Nạp tiền thành công!\nSố dư mới: ${result.newBalance.toLocaleString()}đ`);
        } else {
          alert("Lỗi khi nạp tiền: " + result.error);
        }
      }
    }
  };

  // --- HÀM RESET PASSCODE CHO KHÁCH HÀNG ---
  const handleResetPasscode = async (user) => {
    const newPasscode = prompt(
      `ĐẶT LẠI PASSCODE CHO KHÁCH:\n\nSĐT: ${user.username}\nTên: ${user.fullName}\n\nNhập Passcode mới (Mặc định: 123456):`, 
      "123456"
    );

    if (newPasscode) {
      if (newPasscode.length < 6) {
        return alert("Passcode phải có ít nhất 6 ký tự!");
      }
      
      if (window.confirm(`Xác nhận đặt lại Passcode của khách này thành "${newPasscode}"?`)) {
        const result = await resetPasscodeByAdmin(user.id, newPasscode);
        if (result.success) {
          alert(`Đã đặt lại Passcode thành công cho khách ${user.fullName}. Hãy báo cho khách biết!`);
        } else {
          alert("Lỗi cấp lại Passcode: " + result.error);
        }
      }
    }
  };

  // --- HÀM XÓA USER VĨNH VIỄN ---
  const handleDeleteUser = async (user) => {
    if (window.confirm(`⚠️ NGUY HIỂM: Bạn có chắc chắn muốn XÓA VĨNH VIỄN khách hàng ${user.fullName} (${user.username}) không?\n\nHành động này không thể hoàn tác và sẽ xóa toàn bộ dữ liệu của họ khỏi hệ thống!`)) {
      const result = await deleteUser(user.id);
      if (result.success) {
        alert(`Đã xóa thành công người dùng: ${user.fullName}`);
      } else {
        alert("Lỗi khi xóa: " + result.error);
      }
    }
  };

  // --- HÀM QUẢN LÝ CẤM (BAN) USER ---
  const openBanModal = (user) => {
    setBanUserTarget(user);
    setShowBanModal(true);
  };

  const handleUnbanUser = async (user) => {
    if (window.confirm(`Xác nhận GỠ LỆNH CẤM cho khách hàng ${user.fullName}?`)) {
      const result = await updateUserBanStatus(user.id, { isBanned: false, banUntil: null });
      if (result.success) {
        alert(`Đã gỡ cấm cho ${user.fullName}. Họ có thể đặt hàng trở lại.`);
      }
    }
  };

  const submitBanUser = async () => {
    let banUntil = null;
    
    if (banDuration === 'permanent') {
      banUntil = 'permanent';
    } else if (banDuration === 'custom') {
      if (!customBanDate) {
        alert("Vui lòng chọn ngày hết hạn cấm.");
        return;
      }
      banUntil = new Date(customBanDate).getTime();
    } else {
      const days = parseInt(banDuration);
      banUntil = new Date().getTime() + (days * 24 * 60 * 60 * 1000);
    }

    const result = await updateUserBanStatus(banUserTarget.id, { 
      isBanned: true, 
      banUntil: banUntil 
    });

    if (result.success) {
      setShowBanModal(false);
      setBanUserTarget(null);
      alert(`Đã CẤM tài khoản ${banUserTarget.fullName} thành công.`);
    } else {
      alert("Lỗi khi áp dụng lệnh cấm: " + result.error);
    }
  };

  const formatBanTime = (banUntil) => {
    if (!banUntil) return '';
    if (banUntil === 'permanent') return 'Cấm Vĩnh Viễn';
    
    const date = new Date(banUntil);
    const now = new Date().getTime();
    
    if (banUntil < now) return 'Đã hết hạn cấm (Đang gỡ...)';
    
    return `Đến: ${date.toLocaleDateString('vi-VN')} ${date.toLocaleTimeString('vi-VN')}`;
  };

  // --- HÀM QUẢN LÝ VOUCHER RIÊNG CHO KHÁCH ---
  const handleAddVoucherToUser = async () => {
    if (!newVoucher.code) return;
    const vData = {
      ...newVoucher,
      assignedPhone: voucherModalUser.username, 
      expiry: null 
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
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Quản lý tài khoản & Quyền truy cập</p>
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
                <th className="px-8 py-5">Ví Plant G</th>
                <th className="px-8 py-5 text-center">Trạng thái</th>
                <th className="px-8 py-5 text-center">Voucher</th>
                <th className="px-8 py-5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredUsers.map((user) => (
                <tr key={user.id} className={`transition-all group ${user.isBanned ? 'bg-red-50/30' : 'hover:bg-blue-50/20'}`}>
                  
                  {/* CỘT KHÁCH HÀNG */}
                  <td className="px-8 py-5">
                    <p className="font-black text-gray-800 text-sm uppercase">{user.fullName}</p>
                    <p className="text-xs font-black text-blue-600 mt-1">{user.deliveryPhone || user.username}</p>
                  </td>

                  {/* CỘT VÍ TIỀN */}
                  <td className="px-8 py-5">
                    <p className="text-sm font-black text-green-600 tracking-tighter">
                      {(user.walletBalance || 0).toLocaleString()}đ
                    </p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Số dư</p>
                  </td>
                  
                  {/* CỘT TRẠNG THÁI */}
                  <td className="px-8 py-5 text-center">
                    {user.isBanned ? (
                      <div className="flex flex-col items-center">
                        <span className="bg-red-100 text-red-600 px-3 py-1 rounded-xl text-[9px] font-black uppercase shadow-sm">Đang bị cấm</span>
                        <span className="text-[9px] text-red-400 font-bold mt-1 italic">{formatBanTime(user.banUntil)}</span>
                      </div>
                    ) : (
                      <span className="bg-green-100 text-green-600 px-3 py-1 rounded-xl text-[9px] font-black uppercase shadow-sm">Bình thường</span>
                    )}
                  </td>

                  {/* CỘT VOUCHER */}
                  <td className="px-8 py-5 text-center">
                    <button 
                      onClick={() => setVoucherModalUser(user)}
                      className="bg-orange-50 text-orange-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-600 hover:text-white transition-all"
                    >
                      🎁 {allVouchers.filter(v => v.assignedPhone === user.username).length} Mã
                    </button>
                  </td>
                  
                  {/* CỘT THAO TÁC */}
                  <td className="px-8 py-5 text-right space-x-2 whitespace-nowrap">
                    
                    {/* Nạp tiền ví */}
                    <button 
                      onClick={() => handleTopUpWallet(user)} 
                      title="Nạp tiền vào ví" 
                      className="p-3 bg-green-50 text-green-600 hover:bg-green-100 hover:scale-110 rounded-xl transition-all inline-flex shadow-sm"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </button>

                    {/* Cấp lại Passcode */}
                    <button 
                      onClick={() => handleResetPasscode(user)} 
                      title="Cấp lại Passcode" 
                      className="p-3 bg-yellow-50 text-yellow-600 hover:bg-yellow-100 hover:scale-110 rounded-xl transition-all inline-flex shadow-sm"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                    </button>

                    {/* Sửa thông tin */}
                    <button onClick={() => setEditingUser(user)} title="Sửa thông tin" className="p-3 bg-gray-50 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all inline-flex">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                    
                    {/* Cấm / Gỡ Cấm */}
                    {user.isBanned ? (
                       <button onClick={() => handleUnbanUser(user)} title="Gỡ cấm" className="p-3 bg-red-100 text-red-500 hover:bg-green-100 hover:text-green-600 rounded-xl transition-all inline-flex">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
                       </button>
                    ) : (
                       <button onClick={() => openBanModal(user)} title="Cấm người dùng" className="p-3 bg-gray-50 text-gray-400 hover:bg-orange-100 hover:text-orange-600 rounded-xl transition-all inline-flex">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                       </button>
                    )}

                    {/* Xóa User */}
                    <button onClick={() => handleDeleteUser(user)} title="Xóa khách hàng" className="p-3 bg-gray-50 text-gray-400 hover:bg-red-100 hover:text-red-600 rounded-xl transition-all inline-flex">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CÁC MODAL KHÁC (GIỮ NGUYÊN) */}
      
      {/* --- MODAL CẤM (BAN) USER --- */}
      {showBanModal && banUserTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in">
            <h3 className="text-xl font-black text-red-600 uppercase tracking-tighter mb-2">Đình chỉ tài khoản</h3>
            <p className="text-xs font-bold text-gray-500 mb-6">Khách hàng <span className="text-gray-800">[{banUserTarget.fullName}]</span> sẽ không thể đặt đơn mới.</p>
            
            <div className="space-y-4 mb-8 bg-gray-50 p-5 rounded-3xl border border-gray-100">
              <label className="flex items-center gap-3 p-2 cursor-pointer">
                <input type="radio" name="banDuration" value="1" checked={banDuration === '1'} onChange={(e) => setBanDuration(e.target.value)} className="w-4 h-4 text-red-600" />
                <span className="text-sm font-black text-gray-700">Khóa 1 ngày (Cảnh cáo)</span>
              </label>
              <label className="flex items-center gap-3 p-2 cursor-pointer">
                <input type="radio" name="banDuration" value="3" checked={banDuration === '3'} onChange={(e) => setBanDuration(e.target.value)} className="w-4 h-4 text-red-600" />
                <span className="text-sm font-black text-gray-700">Khóa 3 ngày</span>
              </label>
              <label className="flex items-center gap-3 p-2 cursor-pointer border-t border-gray-200 pt-4">
                <input type="radio" name="banDuration" value="7" checked={banDuration === '7'} onChange={(e) => setBanDuration(e.target.value)} className="w-4 h-4 text-red-600" />
                <span className="text-sm font-black text-gray-700">Khóa 7 ngày</span>
              </label>
              <label className="flex items-center gap-3 p-2 cursor-pointer">
                <input type="radio" name="banDuration" value="custom" checked={banDuration === 'custom'} onChange={(e) => setBanDuration(e.target.value)} className="w-4 h-4 text-red-600" />
                <span className="text-sm font-black text-gray-700">Tùy chọn ngày mở lại:</span>
              </label>
              {banDuration === 'custom' && (
                <input 
                  type="datetime-local" 
                  value={customBanDate} 
                  onChange={(e) => setCustomBanDate(e.target.value)}
                  className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm ml-7 w-[calc(100%-28px)] font-bold outline-none"
                />
              )}
              <label className="flex items-center gap-3 p-2 cursor-pointer bg-red-100/50 rounded-xl mt-2">
                <input type="radio" name="banDuration" value="permanent" checked={banDuration === 'permanent'} onChange={(e) => setBanDuration(e.target.value)} className="w-4 h-4 text-red-600" />
                <span className="text-sm font-black text-red-600">Khóa Vĩnh Viễn</span>
              </label>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowBanModal(false)} className="flex-1 py-4 text-xs font-black text-gray-400 uppercase tracking-widest bg-gray-50 rounded-2xl">Hủy</button>
              <button onClick={submitBanUser} className="flex-[2] bg-red-600 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-red-200 active:scale-95 transition-all">Thiết lập cấm</button>
            </div>
          </div>
        </div>
      )}

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
                <button onClick={handleSaveUserInfo} className="flex-[2] bg-blue-600 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-100 active:scale-95 transition-all">Cập nhật ngay</button>
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
               <button onClick={handleAddVoucherToUser} className="bg-blue-600 text-white font-black text-[10px] uppercase rounded-xl shadow-lg shadow-blue-100 active:scale-95 transition-all">Thêm Mã</button>
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