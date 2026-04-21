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
  
  // Lấy thông tin user từ localStorage khi load trang
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('userProfile');
    return saved ? JSON.parse(saved) : {};
  });

  // State cho Form thông tin cơ bản
  const [formData, setFormData] = useState({ 
    fullName: user.fullName || '', 
    avatarUrl: user.avatarUrl || ''
  });

  // State cho Sổ địa chỉ
  const [addresses, setAddresses] = useState(() => {
    if (user.addresses && Array.isArray(user.addresses)) {
      return user.addresses;
    }
    if (user.address) {
      return [{ id: Date.now(), detail: user.address, isDefault: true }];
    }
    return [];
  });

  const [isVerifying, setIsVerifying] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [showAvatarInput, setShowAvatarInput] = useState(false); 

  // Dữ liệu hạng và đặc quyền Auto
  const [rankInfo, setRankInfo] = useState(null);
  const [activeAutoPerk, setActiveAutoPerk] = useState('NONE');
  
  // MỚI: State cho tính năng Bật/Tắt Pet (Thú cưng)
  const [showPet, setShowPet] = useState(false);

  // Lấy dữ liệu Real-time từ Firestore để tính Rank và lấy đặc quyền đang bật
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
          // Khởi tạo state Pet từ database
          setShowPet(data.showPet || false);
        }
      } catch (error) {
        console.error("Lỗi lấy dữ liệu hạng:", error);
      } finally {
        setIsLoadingRank(false);
      }
    };

    fetchUserRankData();
  }, [user.username]);

  // --- LOGIC XỬ LÝ ĐỊA CHỈ ĐÃ ĐƯỢC GIỮ NGUYÊN ---
  const handleAddAddress = () => {
    if (addresses.length >= 3) return alert("Bạn chỉ được lưu tối đa 3 địa chỉ.");
    const newAddr = { id: Date.now(), detail: '', isDefault: addresses.length === 0 };
    setAddresses([...addresses, newAddr]);
  };

  const handleSetDefault = (id) => {
    const updated = addresses.map(addr => ({
      ...addr,
      isDefault: addr.id === id
    }));
    setAddresses(updated);
  };

  const handleRemoveAddress = (id) => {
    const addrToRemove = addresses.find(a => a.id === id);
    if (addrToRemove?.isDefault) {
      return alert("Không thể xóa địa chỉ đang là Mặc định. Hãy chọn địa chỉ khác làm mặc định trước.");
    }
    setAddresses(addresses.filter(a => a.id !== id));
  };
  // -------------------------

  // HÀM CHỌN ĐẶC QUYỀN TRÁNH ĐƠ GIAO DIỆN
  const handleSelectPerk = (perkId, isAllowed) => {
    if (!isAllowed) return; 
    setActiveAutoPerk(perkId);
  };

  const handleSave = async () => {
    if (addresses.some(a => !a.detail.trim())) {
      alert("Vui lòng điền đầy đủ thông tin cho các địa chỉ đã tạo, hoặc xóa bớt.");
      setIsVerifying(false);
      return;
    }

    // 1. Lưu thông tin cá nhân (Tên, Avatar)
    const resProfile = await updateCustomerSecure(user.username, formData, passcode);
    if (!resProfile.success) {
      alert("❌ Lỗi hồ sơ: " + resProfile.error);
      setIsVerifying(false);
      return;
    }

    // 2. Lưu sổ địa chỉ
    const resAddress = await updateCustomerAddresses(user.username, addresses, passcode);
    if (!resAddress.success) {
      alert("❌ Lỗi địa chỉ: " + resAddress.error);
      setIsVerifying(false);
      return;
    }

    // 3. Lưu Đặc quyền Auto & Trạng thái Pet (Lưu trực tiếp vào Firestore)
    try {
      await updateDoc(doc(db, 'users', user.username), {
        activeAutoPerk: activeAutoPerk,
        showPet: showPet // Bổ sung lưu Pet
      });
    } catch (e) {
      console.error("Lỗi lưu đặc quyền/pet:", e);
    }
    
    // Thành công -> Cập nhật lại bộ nhớ cục bộ
    const updatedUser = { 
      ...user, 
      ...formData, 
      addresses, 
      address: addresses.find(a => a.isDefault)?.detail || '',
      showPet: showPet // Bổ sung update Pet vào local
    };
    
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
        <div className="flex justify-between items-center">
          <button 
            onClick={() => navigate(-1)} 
            className="w-10 h-10 flex items-center justify-center bg-white dark:bg-gray-800 rounded-full text-gray-400 hover:text-gray-600 shadow-sm transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </button>
          <h2 className="text-xl font-black uppercase text-center flex-1 tracking-tighter text-gray-800 dark:text-white">Cài đặt hồ sơ</h2>
          <div className="w-10"></div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 shadow-xl border border-gray-100 dark:border-gray-700 animate-in fade-in duration-500">
          
          {/* AVATAR SECTION SỬ DỤNG COMPONENT USERAVATAR */}
          <div className="flex flex-col items-center mb-10 relative">
            {rankInfo && (
              <div className={`absolute top-[-30px] w-[150%] h-32 bg-gradient-to-b ${rankInfo.current.color} opacity-10 blur-2xl rounded-full z-0`}></div>
            )}

            <div className="relative group z-10">
                <div onClick={() => setShowAvatarInput(!showAvatarInput)} className="cursor-pointer hover:scale-105 transition-transform">
                  <UserAvatar 
                    avatarUrl={formData.avatarUrl || user.avatarUrl} 
                    totalSpend={rankInfo?.current?.min || 0} // Fake spend để lồng đúng khung hiện tại
                    manualRankId={rankInfo?.current?.id}
                    size="w-28 h-28"
                  />
                </div>
              
              <button 
                onClick={() => setShowAvatarInput(!showAvatarInput)}
                className="absolute bottom-0 right-0 bg-blue-600 text-white p-2.5 rounded-full shadow-lg hover:bg-blue-700 transition-all border-2 border-white dark:border-gray-800 z-20"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
              </button>
            </div>
            
            <p className="mt-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Ảnh đại diện của bạn</p>
            {rankInfo && (
              <div className="flex items-center gap-1 mt-2">
                <span className={`text-[10px] font-black text-white px-3 py-1 rounded-full uppercase tracking-widest bg-gradient-to-r ${rankInfo.current.color} shadow-md`}>
                  {rankInfo.current.icon} Hạng {rankInfo.current.name}
                </span>
              </div>
            )}

            {showAvatarInput && (
              <div className="mt-5 w-full animate-in slide-in-from-top-2 duration-300 z-20 relative">
                <label className="text-[9px] font-black text-blue-500 uppercase ml-1 block mb-1 tracking-widest">Dán Link ảnh (URL)</label>
                <input 
                  type="text"
                  placeholder="https://example.com/photo.jpg"
                  value={formData.avatarUrl}
                  onChange={e => setFormData({...formData, avatarUrl: e.target.value})}
                  className="w-full p-3.5 bg-gray-50 dark:bg-gray-700 dark:text-white border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-inner"
                />
              </div>
            )}
          </div>

          {/* KHỐI ĐẶC QUYỀN AUTO (GAMIFICATION) */}
          {rankInfo && (
            <div className="mb-10 p-5 bg-gray-50 dark:bg-gray-700/30 rounded-3xl border border-gray-100 dark:border-gray-700">
              <h3 className="font-black uppercase text-xs text-gray-800 dark:text-white mb-1 flex items-center gap-2 tracking-tighter">
                <span className="text-lg">⚡</span> Đặc quyền Tự động
              </h3>
              <p className="text-[9px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mb-4">
                Chọn 1 tính năng auto duy nhất theo hạng.
              </p>

              <div className="space-y-2">
                <div 
                  onClick={() => setActiveAutoPerk('NONE')}
                  className={`flex items-center p-4 rounded-2xl border-2 transition-all cursor-pointer ${activeAutoPerk === 'NONE' ? 'border-gray-800 dark:border-white bg-white dark:bg-gray-600 shadow-md' : 'border-transparent hover:bg-white dark:hover:bg-gray-800'}`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-3 flex-shrink-0 ${activeAutoPerk === 'NONE' ? 'border-gray-800 dark:border-white' : 'border-gray-300'}`}>
                    {activeAutoPerk === 'NONE' && <div className="w-2.5 h-2.5 bg-gray-800 dark:bg-white rounded-full"></div>}
                  </div>
                  <span className="font-bold text-sm text-gray-700 dark:text-gray-200">Tắt Auto</span>
                </div>

                {(() => {
                  const isAllowed = rankInfo.current.autoPerks.includes('GIFT') || rankInfo.current.autoPerks.includes('ALL');
                  return (
                    <div 
                      onClick={() => handleSelectPerk('GIFT', isAllowed)}
                      className={`flex items-center p-4 rounded-2xl border-2 transition-all ${isAllowed ? 'cursor-pointer' : 'opacity-40 grayscale cursor-not-allowed'} ${activeAutoPerk === 'GIFT' ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/30 shadow-md' : 'border-transparent hover:bg-white dark:hover:bg-gray-800'}`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-3 flex-shrink-0 ${activeAutoPerk === 'GIFT' ? 'border-orange-500' : 'border-gray-300'}`}>
                        {activeAutoPerk === 'GIFT' && <div className="w-2.5 h-2.5 bg-orange-500 rounded-full"></div>}
                      </div>
                      <div className="flex-1 flex justify-between items-center">
                        <span className="font-bold text-sm text-gray-800 dark:text-gray-200">Tự nhận Hộp Quà 🎁</span>
                        {!isAllowed && <span className="text-[8px] font-black text-gray-400 bg-gray-200 px-2 py-1 rounded ml-2">TỪ HẠNG BẠC</span>}
                      </div>
                    </div>
                  )
                })()}

                {(() => {
                  const isAllowed = rankInfo.current.autoPerks.includes('CHECKIN') || rankInfo.current.autoPerks.includes('ALL');
                  return (
                    <div 
                      onClick={() => handleSelectPerk('CHECKIN', isAllowed)}
                      className={`flex items-center p-4 rounded-2xl border-2 transition-all ${isAllowed ? 'cursor-pointer' : 'opacity-40 grayscale cursor-not-allowed'} ${activeAutoPerk === 'CHECKIN' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 shadow-md' : 'border-transparent hover:bg-white dark:hover:bg-gray-800'}`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-3 flex-shrink-0 ${activeAutoPerk === 'CHECKIN' ? 'border-blue-500' : 'border-gray-300'}`}>
                        {activeAutoPerk === 'CHECKIN' && <div className="w-2.5 h-2.5 bg-blue-500 rounded-full"></div>}
                      </div>
                      <div className="flex-1 flex justify-between items-center">
                        <span className="font-bold text-sm text-gray-800 dark:text-gray-200">Tự Điểm danh 📅</span>
                        {!isAllowed && <span className="text-[8px] font-black text-gray-400 bg-gray-200 px-2 py-1 rounded ml-2 whitespace-nowrap">TỪ BẠCH KIM</span>}
                      </div>
                    </div>
                  )
                })()}

                {(() => {
                  const isAllowed = rankInfo.current.autoPerks.includes('LUCKY') || rankInfo.current.autoPerks.includes('ALL');
                  return (
                    <div 
                      onClick={() => handleSelectPerk('LUCKY', isAllowed)}
                      className={`flex items-center p-4 rounded-2xl border-2 transition-all ${isAllowed ? 'cursor-pointer' : 'opacity-40 grayscale cursor-not-allowed'} ${activeAutoPerk === 'LUCKY' ? 'border-red-500 bg-red-50 dark:bg-red-900/30 shadow-md' : 'border-transparent hover:bg-white dark:hover:bg-gray-800'}`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-3 flex-shrink-0 ${activeAutoPerk === 'LUCKY' ? 'border-red-500' : 'border-gray-300'}`}>
                        {activeAutoPerk === 'LUCKY' && <div className="w-2.5 h-2.5 bg-red-500 rounded-full"></div>}
                      </div>
                      <div className="flex-1 flex justify-between items-center">
                        <span className="font-bold text-sm text-gray-800 dark:text-gray-200">Tự mở Lì xì 🧧</span>
                        {!isAllowed && <span className="text-[8px] font-black text-gray-400 bg-gray-200 px-2 py-1 rounded ml-2 whitespace-nowrap">TỪ TINH ANH</span>}
                      </div>
                    </div>
                  )
                })()}

                {rankInfo.current.autoPerks.includes('ALL') && (
                  <div 
                    onClick={() => setActiveAutoPerk('ALL')}
                    className={`flex items-center p-4 rounded-2xl border-2 transition-all cursor-pointer ${activeAutoPerk === 'ALL' ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 shadow-md shadow-purple-200 dark:shadow-none' : 'border-transparent hover:bg-white dark:hover:bg-gray-800'}`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-3 flex-shrink-0 ${activeAutoPerk === 'ALL' ? 'border-purple-500' : 'border-gray-300'}`}>
                      {activeAutoPerk === 'ALL' && <div className="w-2.5 h-2.5 bg-purple-500 rounded-full"></div>}
                    </div>
                    <div className="flex-1">
                      <p className="font-black text-sm text-purple-600 dark:text-purple-400">Vua Trò Chơi (Bật ALL) 👑</p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* MỚI: TÙY CHỌN BẬT/TẮT PET CHO HẠNG THÁCH ĐẤU */}
              {rankInfo.current.id === 'CHALLENGER' && (
                <div className="mt-6 pt-6 border-t border-dashed border-gray-200 dark:border-gray-600">
                  <h4 className="font-black uppercase text-xs text-gray-800 dark:text-white mb-2 flex items-center gap-2">
                    <span className="text-lg">🐉</span> Thú Cưng Trợ Lý
                  </h4>
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-4">
                    Độc quyền Thách Đấu: Bật để thú cưng bay lượn và nhặt xu giúp bạn
                  </p>
                  
                  <label className={`flex items-center p-4 rounded-2xl border-2 transition-all cursor-pointer select-none ${showPet ? 'border-green-500 bg-green-50 dark:bg-green-900/30 shadow-md' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'}`}>
                    <div className={`w-10 h-6 rounded-full transition-colors relative mr-3 flex-shrink-0 ${showPet ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${showPet ? 'left-5' : 'left-1'}`}></div>
                    </div>
                    <input 
                      type="checkbox" 
                      className="hidden" 
                      checked={showPet} 
                      onChange={(e) => setShowPet(e.target.checked)} 
                    />
                    <div className="flex-1">
                      <span className={`font-bold text-sm ${showPet ? 'text-green-700 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                        {showPet ? 'Đang bật Thú cưng' : 'Đang tắt Thú cưng'}
                      </span>
                    </div>
                  </label>
                </div>
              )}

            </div>
          )}

          {/* THÔNG TIN CƠ BẢN */}
          <div className="space-y-5 mb-8">
            <div>
              <label className="text-[9px] font-black text-gray-400 uppercase ml-1 block mb-1 tracking-widest">Số điện thoại (Định danh)</label>
              <input 
                disabled 
                value={user.username || ''} 
                className="w-full p-4 bg-gray-100 dark:bg-gray-700/50 dark:text-gray-400 rounded-2xl opacity-60 font-black cursor-not-allowed border-none" 
              />
            </div>
            
            <div>
              <label className="text-[9px] font-black text-blue-500 uppercase ml-1 block mb-1 tracking-widest">Họ và tên</label>
              <input 
                value={formData.fullName} 
                onChange={e => setFormData({...formData, fullName: e.target.value})}
                placeholder="Nhập họ tên..."
                className="w-full p-4 bg-gray-50 dark:bg-gray-700 dark:text-white rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold border-none shadow-inner" 
              />
            </div>
          </div>

          {/* SỔ ĐỊA CHỈ */}
          <div className="space-y-4 mb-8 pt-6 border-t border-dashed border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center px-1">
              <label className="text-[10px] font-black text-gray-800 dark:text-gray-200 uppercase tracking-widest">
                Sổ địa chỉ ({addresses.length}/3)
              </label>
              {addresses.length < 3 && (
                <button 
                  onClick={handleAddAddress} 
                  className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-1 active:scale-95"
                >
                  <span className="text-lg leading-none">+</span> Thêm
                </button>
              )}
            </div>
            
            {addresses.length === 0 && (
                <p className="text-xs text-gray-400 italic text-center py-4">Bạn chưa lưu địa chỉ nào.</p>
            )}

            {addresses.map((addr, index) => (
              <div key={addr.id} className={`p-4 rounded-[1.5rem] border-2 transition-all animate-in slide-in-from-right-4 
                ${addr.isDefault ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10' : 'border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'}`}>
                <textarea 
                  value={addr.detail}
                  onChange={(e) => {
                    const updated = [...addresses];
                    updated[index].detail = e.target.value;
                    setAddresses(updated);
                  }}
                  placeholder="Nhập địa chỉ cụ thể (Tòa nhà, số nhà, đường...)"
                  className="w-full bg-transparent dark:text-white border-none outline-none text-xs font-bold resize-none h-14 mb-2"
                />
                <div className="flex justify-between items-center border-t border-gray-200 dark:border-gray-600 pt-3">
                  <button 
                    onClick={() => handleSetDefault(addr.id)}
                    className={`text-[9px] font-black uppercase flex items-center gap-1 transition-colors
                      ${addr.isDefault ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600'}`}
                  >
                    <span className="text-sm leading-none">{addr.isDefault ? '★' : '☆'}</span> 
                    {addr.isDefault ? 'Mặc định' : 'Đặt làm mặc định'}
                  </button>
                  
                  {!addr.isDefault && (
                    <button 
                      onClick={() => handleRemoveAddress(addr.id)} 
                      className="text-[9px] font-black text-red-400 hover:text-red-600 uppercase"
                    >
                      Xóa
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button 
            onClick={() => setIsVerifying(true)}
            className="w-full bg-gray-800 dark:bg-blue-600 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl hover:bg-black dark:hover:bg-blue-700 active:scale-95 transition-all"
          >
            Lưu thiết lập
          </button>
        </div>

        {/* MODAL NHẬP PASSCODE BẢO MẬT */}
        {isVerifying && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-6 z-[100] animate-in fade-in duration-300">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] w-full max-w-xs shadow-2xl animate-in zoom-in-95 duration-300">
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <p className="font-black uppercase text-xs text-gray-800 dark:text-white tracking-widest">Xác nhận Passcode</p>
                <p className="text-[9px] text-gray-400 uppercase mt-1 font-bold">Để bảo vệ thông tin của bạn</p>
              </div>

              <input 
                type="password" 
                maxLength="6" 
                placeholder="••••••"
                className="w-full text-center text-3xl tracking-[0.5em] p-4 bg-gray-100 dark:bg-gray-700 dark:text-white rounded-2xl mb-6 outline-none border-none font-black"
                onChange={(e) => setPasscode(e.target.value)}
                autoFocus
              />

              <div className="flex gap-3">
                <button 
                  onClick={() => {setIsVerifying(false); setPasscode('');}} 
                  className="flex-1 py-4 text-gray-400 dark:text-gray-500 font-black uppercase text-[10px] tracking-widest hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors"
                >
                  Hủy
                </button>
                <button 
                  onClick={handleSave} 
                  className="flex-[2] py-4 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-200 dark:shadow-none active:scale-95 transition-all"
                >
                  Xác nhận
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserSettings;