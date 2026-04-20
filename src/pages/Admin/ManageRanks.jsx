import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { getRankInfo, RANK_TIERS } from '../../utils/rankUtils';
import UserAvatar from '../../components/UserAvatar';

const ManageRanks = () => {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchKey, setSearchKey] = useState('');

  // State cho Modal Chỉnh sửa Hạng
  const [editingUser, setEditingUser] = useState(null);
  const [selectedRankId, setSelectedRankId] = useState('AUTO');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sắp xếp người dùng theo Tổng chi tiêu giảm dần (Leaderboard)
      data.sort((a, b) => (b.totalSpend || 0) - (a.totalSpend || 0));
      setUsers(data);
      setIsLoading(false);
    });

    return () => unsub();
  }, []);

  // Lọc người dùng
  const filteredUsers = users.filter(u => {
    if (!searchKey) return true;
    const key = searchKey.toLowerCase();
    return (
      (u.fullName && u.fullName.toLowerCase().includes(key)) ||
      (u.phone && u.phone.includes(key))
    );
  });

  // Mở Modal Edit
  const handleOpenEdit = (user) => {
    setEditingUser(user);
    setSelectedRankId(user.manualRankId || 'AUTO');
  };

  // Lưu thiết lập Hạng
  const handleSaveRank = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const userRef = doc(db, 'users', editingUser.id);
      
      // Nếu chọn AUTO, ta sẽ set manualRankId thành null để hệ thống tự tính lại
      await updateDoc(userRef, {
        manualRankId: selectedRankId === 'AUTO' ? null : selectedRankId
      });
      
      setEditingUser(null);
      alert("✅ Đã cập nhật xếp hạng thành công!");
    } catch (error) {
      alert("❌ Lỗi khi cập nhật: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return (
    <div className="p-20 text-center">
       <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
       <p className="text-[10px] font-black uppercase text-blue-500 tracking-[0.2em]">Đang tải dữ liệu xếp hạng...</p>
    </div>
  );

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      
      {/* HEADER & THỐNG KÊ NHANH */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-700 transition-colors flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-tighter">Quản lý Xếp hạng</h2>
          <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-widest">
            Hệ thống Gamification & Đặc quyền
          </p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 px-5 py-3 rounded-2xl border border-blue-100 dark:border-blue-800 flex items-center gap-3">
          <span className="text-2xl">🏆</span>
          <div>
            <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Tổng thành viên</p>
            <p className="text-lg font-black text-blue-700 dark:text-blue-400 leading-none">{users.length}</p>
          </div>
        </div>
      </div>

      {/* THANH TÌM KIẾM */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
        <input 
          type="text" 
          placeholder="Tìm theo Tên hoặc Số điện thoại..." 
          value={searchKey}
          onChange={(e) => setSearchKey(e.target.value)}
          className="w-full bg-gray-50 dark:bg-gray-700 dark:text-white border-none rounded-xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-colors placeholder:text-gray-400"
        />
      </div>

      {/* DANH SÁCH THÀNH VIÊN (DẠNG LƯỚI CARD) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredUsers.map((user, index) => {
          const rankInfo = getRankInfo(user.totalSpend || 0, user.manualRankId);
          const isManual = !!user.manualRankId;

          return (
            <div key={user.id} className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center text-center relative overflow-hidden transition-colors group hover:border-blue-300 dark:hover:border-blue-600">
              
              {/* Lớp màu nền mờ theo màu của Rank */}
              <div className={`absolute top-0 w-full h-24 bg-gradient-to-b ${rankInfo.current.color} opacity-10 transition-opacity group-hover:opacity-20`}></div>

              {/* Tag Set Cứng (Nếu có) */}
              {isManual && (
                <div className="absolute top-4 right-4 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[8px] font-black uppercase px-2 py-1 rounded-md tracking-widest border border-red-200 dark:border-red-800 z-20">
                  Set Cứng
                </div>
              )}
              
              {/* Top 3 Badge */}
              {index < 3 && !searchKey && (
                <div className="absolute top-4 left-4 w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 to-yellow-200 text-yellow-900 font-black text-xs flex items-center justify-center shadow-md z-20 border-2 border-white">
                  #{index + 1}
                </div>
              )}

              {/* Avatar + Frame */}
              <div className="relative z-10 mt-4 mb-3">
                <UserAvatar 
                  avatarUrl={user.avatarUrl} 
                  totalSpend={user.totalSpend || 0} 
                  manualRankId={user.manualRankId}
                  size="w-20 h-20"
                />
              </div>

              <h3 className="font-black text-gray-800 dark:text-white text-base truncate w-full z-10">{user.fullName || 'Thành viên'}</h3>
              <p className="text-[10px] text-gray-400 font-bold tracking-widest mb-3 z-10">{user.phone}</p>

              {/* Tên Hạng */}
              <div className={`bg-gradient-to-r ${rankInfo.current.color} px-4 py-1.5 rounded-full shadow-md mb-4 z-10`}>
                <span className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-1">
                  {rankInfo.current.icon} {rankInfo.current.name}
                </span>
              </div>

              {/* Thông số Chi tiêu & Đặc quyền đang bật */}
              <div className="w-full bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-4 mb-4 z-10 border border-gray-100 dark:border-gray-600">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Tổng chi tiêu:</span>
                  <span className="font-black text-sm text-gray-800 dark:text-gray-100">{(user.totalSpend || 0).toLocaleString()}đ</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Auto đang bật:</span>
                  <span className={`text-[9px] font-black uppercase tracking-widest ${user.activeAutoPerk && user.activeAutoPerk !== 'NONE' ? 'text-green-500' : 'text-gray-400'}`}>
                    {user.activeAutoPerk === 'GIFT' ? 'Hộp Quà' : 
                     user.activeAutoPerk === 'CHECKIN' ? 'Điểm Danh' : 
                     user.activeAutoPerk === 'LUCKY' ? 'Săn Lì Xì' : 
                     user.activeAutoPerk === 'ALL' ? 'Tất Cả (VIP)' : 'Đang Tắt'}
                  </span>
                </div>
              </div>

              {/* Nút thao tác */}
              <button 
                onClick={() => handleOpenEdit(user)}
                className="w-full py-3 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-blue-500 hover:text-blue-600 dark:hover:border-blue-500 dark:hover:text-blue-400 transition-colors z-10"
              >
                Chỉnh sửa hạng
              </button>
            </div>
          );
        })}

        {filteredUsers.length === 0 && (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-[2.5rem]">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Không tìm thấy thành viên nào</p>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL CHỈNH SỬA HẠNG THỦ CÔNG */}
      {/* ========================================================= */}
      {editingUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative animate-in zoom-in-95">
            <button 
              onClick={() => setEditingUser(null)} 
              className="absolute top-6 right-6 w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >✕</button>

            <h2 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-tighter mb-2">Đặc quyền Hạng</h2>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-6">
              Điều chỉnh hạng cho {editingUser.fullName} ({editingUser.phone})
            </p>

            <form onSubmit={handleSaveRank} className="space-y-5">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-800 mb-4">
                <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">Lưu ý từ hệ thống</p>
                <p className="text-xs text-blue-800 dark:text-blue-200 font-medium leading-relaxed">
                  Nếu bạn "Set cứng" một hạng, khách hàng sẽ giữ nguyên hạng này (cùng toàn bộ đặc quyền và khung viền) bất kể họ chi tiêu bao nhiêu. Chọn "Tự động" để hoàn tác về cơ chế tích lũy tiền mặc định.
                </p>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest block mb-2">Chọn Xếp hạng</label>
                <select 
                  value={selectedRankId} 
                  onChange={e => setSelectedRankId(e.target.value)}
                  className="w-full p-4 bg-gray-50 dark:bg-gray-700 dark:text-white border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                >
                  <option value="AUTO" className="font-black text-blue-600">🔄 TỰ ĐỘNG (Dựa trên tổng chi tiêu)</option>
                  <option disabled>──────────</option>
                  {RANK_TIERS.map(tier => (
                    <option key={tier.id} value={tier.id}>
                      {tier.icon} Hạng {tier.name} (Mặc định cần {tier.min.toLocaleString()}đ)
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setEditingUser(null)}
                  className="flex-1 py-4 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Hủy
                </button>
                <button 
                  type="submit"
                  disabled={isSaving}
                  className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-200 dark:shadow-none active:scale-95 transition-all hover:bg-blue-700 flex justify-center items-center"
                >
                  {isSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Lưu Xếp Hạng'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default ManageRanks;