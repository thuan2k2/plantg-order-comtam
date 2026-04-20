import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { updateCustomerSecure, updateCustomerAddresses } from '../services/authService';
import UserAvatar from '../components/UserAvatar'; 
import { getRankInfo } from '../utils/rankUtils'; 

const UserSettings = () => {
  const navigate = useNavigate();
  const [isLoadingRank, setIsLoadingRank] = useState(true);
  
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('userProfile');
    return saved ? JSON.parse(saved) : {};
  });

  const [formData, setFormData] = useState({ 
    fullName: user.fullName || '', 
    avatarUrl: user.avatarUrl || ''
  });

  const [addresses, setAddresses] = useState(() => {
    if (user.addresses && Array.isArray(user.addresses)) return user.addresses;
    if (user.address) return [{ id: Date.now(), detail: user.address, isDefault: true }];
    return [];
  });

  const [isVerifying, setIsVerifying] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [showAvatarInput, setShowAvatarInput] = useState(false); 

  // --- STATE QUAN TRỌNG ---
  const [rankInfo, setRankInfo] = useState(null);
  const [activeAutoPerk, setActiveAutoPerk] = useState('NONE');

  useEffect(() => {
    if (!user.username) {
      setIsLoadingRank(false);
      return;
    }

    const fetchUserRankData = async () => {
      try {
        const docRef = doc(db, 'users', user.username);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const info = getRankInfo(data.totalSpend || 0, data.manualRankId);
          setRankInfo(info);
          setActiveAutoPerk(data.activeAutoPerk || 'NONE');
        }
      } catch (error) {
        console.error("Lỗi lấy dữ liệu hạng:", error);
      } finally {
        setIsLoadingRank(false);
      }
    };

    fetchUserRankData();
  }, [user.username]);

  // --- HÀM FIX LỖI CHỌN ĐẶC QUYỀN ---
  const handleSelectPerk = (perkId, isAllowed) => {
    if (!isAllowed) return; 
    setActiveAutoPerk(perkId);
  };

  const handleSave = async () => {
    if (addresses.some(a => !a.detail.trim())) {
      alert("Vui lòng điền đầy đủ thông tin địa chỉ.");
      setIsVerifying(false);
      return;
    }

    const resProfile = await updateCustomerSecure(user.username, formData, passcode);
    if (!resProfile.success) {
      alert("❌ Lỗi hồ sơ: " + resProfile.error);
      setIsVerifying(false);
      return;
    }

    const resAddress = await updateCustomerAddresses(user.username, addresses, passcode);
    if (!resAddress.success) {
      alert("❌ Lỗi địa chỉ: " + resAddress.error);
      setIsVerifying(false);
      return;
    }

    try {
      await updateDoc(doc(db, 'users', user.username), {
        activeAutoPerk: activeAutoPerk
      });
    } catch (e) {
      console.error("Lỗi lưu đặc quyền:", e);
    }
    
    const updatedUser = { ...user, ...formData, addresses, address: addresses.find(a => a.isDefault)?.detail || '' };
    localStorage.setItem('userProfile', JSON.stringify(updatedUser));
    setUser(updatedUser);
    
    alert("✅ Cập nhật thông tin thành công!");
    setIsVerifying(false);
    setPasscode('');
    setShowAvatarInput(false);
  };

  if (isLoadingRank) return <div className="p-20 text-center animate-pulse text-blue-500 font-black">ĐANG KIỂM TRA HẠNG...</div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 font-sans transition-colors duration-300 pb-20">
      <div className="max-w-md mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-4">
          <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center bg-white dark:bg-gray-800 rounded-full shadow-sm"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg></button>
          <h2 className="text-xl font-black uppercase text-center flex-1 tracking-tighter text-gray-800 dark:text-white">Cài đặt hồ sơ</h2>
          <div className="w-10"></div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 shadow-xl border border-gray-100 dark:border-gray-700 transition-all">
          
          {/* AVATAR & RANK */}
          <div className="flex flex-col items-center mb-10">
            <UserAvatar avatarUrl={formData.avatarUrl} totalSpend={rankInfo?.current?.min || 0} manualRankId={rankInfo?.current?.id} size="w-28 h-28" />
            <div className="mt-4 flex flex-col items-center">
                <span className={`text-[10px] font-black text-white px-4 py-1.5 rounded-full uppercase tracking-widest bg-gradient-to-r ${rankInfo?.current?.color || 'from-gray-400 to-gray-500'} shadow-lg`}>
                  {rankInfo?.current?.icon} Hạng {rankInfo?.current?.name}
                </span>
            </div>
            
            <button 
                onClick={() => setShowAvatarInput(!showAvatarInput)}
                className="mt-4 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest"
              >
                Đổi Ảnh Đại Diện
            </button>

            {showAvatarInput && (
              <div className="mt-4 w-full animate-in slide-in-from-top-2 duration-300">
                <input 
                  type="text"
                  placeholder="Dán Link ảnh (URL)..."
                  value={formData.avatarUrl}
                  onChange={e => setFormData({...formData, avatarUrl: e.target.value})}
                  className="w-full p-3.5 bg-gray-50 dark:bg-gray-700 dark:text-white border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-inner"
                />
              </div>
            )}
          </div>

          {/* KHỐI ĐẶC QUYỀN AUTO */}
          <div className="mb-10 p-5 bg-blue-50/50 dark:bg-blue-900/10 rounded-3xl border border-blue-100 dark:border-blue-900/30">
            <h3 className="font-black uppercase text-xs text-blue-800 dark:text-blue-400 mb-1 flex items-center gap-2">
              <span className="text-lg">⚡</span> Đặc quyền Tự động
            </h3>
            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-4">Chọn 1 tính năng theo hạng đạt được</p>

            <div className="space-y-3">
              {/* Option: NONE */}
              <div 
                onClick={() => setActiveAutoPerk('NONE')}
                className={`flex items-center p-4 rounded-2xl border-2 transition-all cursor-pointer ${activeAutoPerk === 'NONE' ? 'border-blue-600 bg-white dark:bg-gray-700 shadow-md' : 'border-transparent bg-gray-50 dark:bg-gray-800/50'}`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-3 flex-shrink-0 ${activeAutoPerk === 'NONE' ? 'border-blue-600' : 'border-gray-300'}`}>
                  {activeAutoPerk === 'NONE' && <div className="w-2.5 h-2.5 bg-blue-600 rounded-full"></div>}
                </div>
                <span className="font-bold text-sm text-gray-700 dark:text-gray-200">Không sử dụng Auto</span>
              </div>

              {/* Option: GIFT (Bạc trở lên) */}
              {(() => {
                const isAllowed = rankInfo?.current?.autoPerks?.includes('GIFT') || rankInfo?.current?.autoPerks?.includes('ALL');
                return (
                  <div 
                    onClick={() => handleSelectPerk('GIFT', isAllowed)}
                    className={`flex items-center p-4 rounded-2xl border-2 transition-all ${isAllowed ? 'cursor-pointer' : 'opacity-40 grayscale cursor-not-allowed'} ${activeAutoPerk === 'GIFT' ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 shadow-md' : 'border-transparent bg-gray-50 dark:bg-gray-800/50'}`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-3 flex-shrink-0 ${activeAutoPerk === 'GIFT' ? 'border-orange-500' : 'border-gray-300'}`}>
                      {activeAutoPerk === 'GIFT' && <div className="w-2.5 h-2.5 bg-orange-500 rounded-full"></div>}
                    </div>
                    <div className="flex-1 flex justify-between items-center">
                      <span className="font-bold text-sm text-gray-700 dark:text-gray-200">Tự nhận Hộp Quà 🎁</span>
                      {!isAllowed && <span className="text-[8px] font-black text-gray-400 bg-gray-200 px-2 py-1 rounded ml-2">TỪ HẠNG BẠC</span>}
                    </div>
                  </div>
                )
              })()}

              {/* Option: CHECKIN (Bạch kim trở lên) */}
              {(() => {
                const isAllowed = rankInfo?.current?.autoPerks?.includes('CHECKIN') || rankInfo?.current?.autoPerks?.includes('ALL');
                return (
                  <div 
                    onClick={() => handleSelectPerk('CHECKIN', isAllowed)}
                    className={`flex items-center p-4 rounded-2xl border-2 transition-all ${isAllowed ? 'cursor-pointer' : 'opacity-40 grayscale cursor-not-allowed'} ${activeAutoPerk === 'CHECKIN' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md' : 'border-transparent bg-gray-50 dark:bg-gray-800/50'}`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-3 flex-shrink-0 ${activeAutoPerk === 'CHECKIN' ? 'border-blue-500' : 'border-gray-300'}`}>
                      {activeAutoPerk === 'CHECKIN' && <div className="w-2.5 h-2.5 bg-blue-500 rounded-full"></div>}
                    </div>
                    <div className="flex-1 flex justify-between items-center">
                      <span className="font-bold text-sm text-gray-700 dark:text-gray-200">Tự Điểm danh 📅</span>
                      {!isAllowed && <span className="text-[8px] font-black text-gray-400 bg-gray-200 px-2 py-1 rounded ml-2 whitespace-nowrap">TỪ BẠCH KIM</span>}
                    </div>
                  </div>
                )
              })()}

              {/* Option: LUCKY (Tinh anh trở lên) */}
              {(() => {
                const isAllowed = rankInfo?.current?.autoPerks?.includes('LUCKY') || rankInfo?.current?.autoPerks?.includes('ALL');
                return (
                  <div 
                    onClick={() => handleSelectPerk('LUCKY', isAllowed)}
                    className={`flex items-center p-4 rounded-2xl border-2 transition-all ${isAllowed ? 'cursor-pointer' : 'opacity-40 grayscale cursor-not-allowed'} ${activeAutoPerk === 'LUCKY' ? 'border-red-500 bg-red-50 dark:bg-red-900/20 shadow-md' : 'border-transparent bg-gray-50 dark:bg-gray-800/50'}`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-3 flex-shrink-0 ${activeAutoPerk === 'LUCKY' ? 'border-red-500' : 'border-gray-300'}`}>
                      {activeAutoPerk === 'LUCKY' && <div className="w-2.5 h-2.5 bg-red-500 rounded-full"></div>}
                    </div>
                    <div className="flex-1 flex justify-between items-center">
                      <span className="font-bold text-sm text-gray-700 dark:text-gray-200">Tự mở Lì xì (Lucky) 🧧</span>
                      {!isAllowed && <span className="text-[8px] font-black text-gray-400 bg-gray-200 px-2 py-1 rounded ml-2 whitespace-nowrap">TỪ TINH ANH</span>}
                    </div>
                  </div>
                )
              })()}

              {/* Option: ALL (Chiến tướng trở lên) */}
              {rankInfo?.current?.autoPerks?.includes('ALL') && (
                <div 
                  onClick={() => setActiveAutoPerk('ALL')}
                  className={`flex items-center p-4 rounded-2xl border-2 transition-all cursor-pointer ${activeAutoPerk === 'ALL' ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 shadow-md shadow-purple-200 dark:shadow-none' : 'border-transparent bg-gray-50 dark:bg-gray-800/50'}`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-3 flex-shrink-0 ${activeAutoPerk === 'ALL' ? 'border-purple-500' : 'border-gray-300'}`}>
                    {activeAutoPerk === 'ALL' && <div className="w-2.5 h-2.5 bg-purple-500 rounded-full"></div>}
                  </div>
                  <div className="flex-1">
                    <p className="font-black text-sm text-purple-600 dark:text-purple-400 uppercase tracking-tighter">Vua Trò Chơi (Bật ALL) 👑</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* THÔNG TIN CƠ BẢN */}
          <div className="space-y-5 mb-8">
            <div>
              <label className="text-[9px] font-black text-gray-400 uppercase ml-1 block mb-1 tracking-widest">Số điện thoại (Định danh)</label>
              <input disabled value={user.username || ''} className="w-full p-4 bg-gray-100 dark:bg-gray-700/50 dark:text-gray-400 rounded-2xl opacity-60 font-black cursor-not-allowed border-none" />
            </div>
            <div>
              <label className="text-[9px] font-black text-blue-500 uppercase ml-1 block mb-1 tracking-widest">Họ và tên</label>
              <input value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} placeholder="Nhập họ tên..." className="w-full p-4 bg-gray-50 dark:bg-gray-700 dark:text-white rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold border-none shadow-inner" />
            </div>
          </div>

          {/* SỔ ĐỊA CHỈ */}
          <div className="space-y-4 mb-8 pt-6 border-t border-dashed border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center px-1">
              <label className="text-[10px] font-black text-gray-800 dark:text-gray-200 uppercase tracking-widest">Sổ địa chỉ ({addresses.length}/3)</label>
              {addresses.length < 3 && (
                <button onClick={handleAddAddress} className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-1 active:scale-95"><span className="text-lg leading-none">+</span> Thêm</button>
              )}
            </div>
            
            {addresses.length === 0 && (
                <p className="text-xs text-gray-400 italic text-center py-4">Bạn chưa lưu địa chỉ nào.</p>
            )}

            {addresses.map((addr, index) => (
              <div key={addr.id} className={`p-4 rounded-[1.5rem] border-2 transition-all animate-in slide-in-from-right-4 ${addr.isDefault ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10' : 'border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'}`}>
                <textarea value={addr.detail} onChange={(e) => { const updated = [...addresses]; updated[index].detail = e.target.value; setAddresses(updated); }} placeholder="Nhập địa chỉ cụ thể..." className="w-full bg-transparent dark:text-white border-none outline-none text-xs font-bold resize-none h-14 mb-2" />
                <div className="flex justify-between items-center border-t border-gray-200 dark:border-gray-600 pt-3">
                  <button onClick={() => handleSetDefault(addr.id)} className={`text-[9px] font-black uppercase flex items-center gap-1 transition-colors ${addr.isDefault ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600'}`}>
                    <span className="text-sm leading-none">{addr.isDefault ? '★' : '☆'}</span> {addr.isDefault ? 'Mặc định' : 'Đặt làm mặc định'}
                  </button>
                  {!addr.isDefault && (
                    <button onClick={() => handleRemoveAddress(addr.id)} className="text-[9px] font-black text-red-400 hover:text-red-600 uppercase">Xóa</button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button onClick={() => setIsVerifying(true)} className="w-full bg-gray-900 dark:bg-blue-600 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">
            Lưu tất cả thay đổi
          </button>
        </div>
      </div>

      {/* MODAL PASSCODE */}
      {isVerifying && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-6 z-[100] animate-in fade-in">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] w-full max-w-xs shadow-2xl">
            <p className="text-center font-black uppercase text-xs mb-6 dark:text-white">Xác nhận Passcode</p>
            <input type="password" maxLength="6" placeholder="••••••" className="w-full text-center text-3xl tracking-[0.5em] p-4 bg-gray-100 dark:bg-gray-700 dark:text-white rounded-2xl mb-6 outline-none font-black" onChange={(e) => setPasscode(e.target.value)} autoFocus />
            <div className="flex gap-3">
              <button onClick={() => setIsVerifying(false)} className="flex-1 py-4 text-gray-400 text-[10px] font-black uppercase">Hủy</button>
              <button onClick={handleSave} className="flex-[2] py-4 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg">Xác nhận</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserSettings;