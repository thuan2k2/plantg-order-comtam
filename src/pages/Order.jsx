import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore'; // Import để đọc cấu hình Admin
import { db } from '../firebase/config';
import { createOrder, validateVoucher, getMyVouchers } from '../services/orderService';
import { getUserByPhone } from '../services/authService'; 
import { subscribeToMenu } from '../services/menuService';

const Order = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const userPhoneParam = searchParams.get('user') || '';

  const [username, setUsername] = useState(userPhoneParam);
  const [customerInfo, setCustomerInfo] = useState(null);
  const [menu, setMenu] = useState([]); 
  const [cart, setCart] = useState({}); 
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('MAIN'); 
  const [showConfirm, setShowConfirm] = useState(false); 
  const [note, setNote] = useState('');
  const [recentPhones, setRecentPhones] = useState([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [appliedFreeship, setAppliedFreeship] = useState(null);
  const [shippingFee, setShippingFee] = useState(5000);
  const [myVouchers, setMyVouchers] = useState([]); 
  const [showVoucherList, setShowVoucherList] = useState(false); 

  // STATE lưu trữ cấu hình hệ thống từ Admin
  const [sysConfig, setSysConfig] = useState({ isOpen: true, minOrder: 0 });

  useEffect(() => {
    // Tải cấu hình hệ thống
    const fetchSystemConfig = async () => {
      try {
        const snap = await getDoc(doc(db, 'system', 'config'));
        if (snap.exists()) setSysConfig(snap.data());
      } catch (error) {
        console.error("Lỗi lấy cấu hình:", error);
      }
    };
    fetchSystemConfig();

    const unsubscribe = subscribeToMenu((data) => {
      setMenu(data);
      setIsLoading(false);
    });
    
    const savedPhones = JSON.parse(localStorage.getItem('recentPhones') || '[]');
    setRecentPhones(savedPhones);
    if (!userPhoneParam && savedPhones.length > 0) {
      setUsername(savedPhones[0]);
    }
    
    return () => unsubscribe();
  }, [userPhoneParam]);

  useEffect(() => {
    const syncData = async () => {
      const cleanPhone = username.trim();
      
      const vouchers = await getMyVouchers(cleanPhone);
      setMyVouchers(vouchers);
      
      if (cleanPhone.length >= 10) {
        try {
          const userData = await getUserByPhone(cleanPhone);
          setCustomerInfo(userData ? { name: userData.fullName, phone: userData.username, address: userData.address } : null);

          const autoFs = vouchers.find(v => v.code.trim().toUpperCase() === 'FREESHIP5K');
          if (autoFs) {
            setAppliedFreeship(autoFs);
            setShippingFee(0);
          } else {
            setAppliedFreeship(null);
            setShippingFee(5000);
          }
        } catch (error) {
          alert(error.message);
          setCustomerInfo(null);
          setUsername(''); 
        }
      } else {
        setCustomerInfo(null);
        setAppliedFreeship(null);
        setShippingFee(5000);
      }
    };

    const timer = setTimeout(syncData, 500);
    return () => clearTimeout(timer);
  }, [username]);

  const updateQuantity = (item, delta) => {
    setCart(prev => {
      const currentItem = prev[item.id];
      const currentQty = currentItem ? currentItem.qty : 0;
      const maxAllowed = item.maxQty || 10;
      
      if (delta > 0 && currentQty >= maxAllowed) {
        alert(`Món này chỉ được mua tối đa ${maxAllowed} phần!`);
        return prev;
      }
      
      const newQty = currentQty + delta;
      if (newQty <= 0) { 
        const { [item.id]: removed, ...rest } = prev; 
        return rest; 
      }
      return { ...prev, [item.id]: { ...item, qty: newQty } };
    });
  };

  const getSubTotal = () => Object.values(cart).reduce((t, i) => t + (parseInt(i.price.replace(/\D/g, '')) * i.qty), 0);
  
  const getFinalTotal = () => {
    const total = getSubTotal() + shippingFee - (appliedVoucher?.value || 0);
    return total > 0 ? total : 0;
  };

  const handleApplyVoucher = async (codeOverride = null) => {
    const targetCode = (codeOverride || voucherCode).trim().toUpperCase();
    if (!targetCode) return;

    const res = await validateVoucher(targetCode, username);
    if (res.valid) {
      if (res.voucher.type === 'FREESHIP') {
        setAppliedFreeship(res.voucher);
        setShippingFee(0);
      } else {
        setAppliedVoucher(res.voucher);
      }
      if (!codeOverride) alert(`Đã áp dụng mã: ${res.voucher.code}`);
      setVoucherCode('');
      setShowVoucherList(false);
    } else {
      alert(res.msg);
    }
  };

  const toggleVoucher = (v, isApplied) => {
    if (isApplied) {
      if (appliedVoucher?.id === v.id) {
        setAppliedVoucher(null);
      }
      if (appliedFreeship?.id === v.id) {
        setAppliedFreeship(null);
        setShippingFee(5000); 
      }
    } else {
      handleApplyVoucher(v.code);
    }
  };

  const handleOpenConfirm = () => {
    if (!sysConfig.isOpen) {
      return alert("Quán hiện đang đóng cửa, bạn vui lòng quay lại sau nhé!");
    }
    if (getSubTotal() < sysConfig.minOrder) {
      return alert(`Đơn hàng tối thiểu phải từ ${sysConfig.minOrder.toLocaleString()}đ trở lên. Vui lòng chọn thêm món!`);
    }
    setShowConfirm(true);
  };

  const handleOrderSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    const usedVouchers = [];
    if (appliedVoucher) usedVouchers.push({ id: appliedVoucher.id, type: appliedVoucher.type });
    if (appliedFreeship) usedVouchers.push({ id: appliedFreeship.id, type: appliedFreeship.type });
    
    const cleanPhone = username.trim();

    const orderData = {
      phone: cleanPhone,
      customer: customerInfo?.name || "Khách vãng lai", 
      address: customerInfo?.address || "Nhận tại quán", 
      items: Object.values(cart).map(item => `${item.qty}x ${item.name}`).join(', '),
      subTotal: getSubTotal(),
      shippingFee,
      discount: appliedVoucher?.value || 0,
      total: getFinalTotal().toLocaleString('vi-VN') + 'đ',
      note: note.trim(),
      usedVouchers 
    };

    try {
      const result = await createOrder(orderData);
      if (result.success) {
        const currentPhones = JSON.parse(localStorage.getItem('recentPhones') || '[]');
        if (!currentPhones.includes(cleanPhone)) {
          localStorage.setItem('recentPhones', JSON.stringify([cleanPhone, ...currentPhones].slice(0, 3)));
        }
        localStorage.removeItem('reorder_items');
        navigate(`/checkorder?user=${cleanPhone}`);
      } else {
         alert(`Lỗi: ${result.error}`);
      }
    } catch (error) {
      alert('Lỗi kết nối Firebase!');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredMenu = menu.filter(item => item.category === activeTab);

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors">
       <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
    </div>
  );

  // MÀN HÌNH CHẶN NẾU QUÁN ĐÓNG CỬA
  if (!sysConfig.isOpen) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-6 text-center">
      <div className="w-24 h-24 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center text-4xl mb-6">😴</div>
      <h2 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tighter mb-2">Quán đang đóng cửa</h2>
      <p className="text-sm font-bold text-gray-400 dark:text-gray-500 max-w-xs leading-relaxed mb-8">
        Chúng tôi hiện đang nghỉ ngơi hoặc đã hết giờ phục vụ. Bạn vui lòng quay lại vào ngày mai nhé!
      </p>
      <button onClick={() => navigate('/')} className="bg-blue-600 text-white px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl">
        Quay về trang chủ
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-44 font-sans transition-colors duration-300">
      
      {/* HEADER TABS */}
      <div className="bg-white dark:bg-gray-800 sticky top-0 z-30 shadow-sm border-b dark:border-gray-700 transition-colors">
        <div className="px-6 py-5 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="p-2 bg-gray-50 dark:bg-gray-700 rounded-2xl active:scale-90 transition-all text-gray-800 dark:text-gray-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h1 className="text-lg font-black text-gray-800 dark:text-gray-100 uppercase tracking-tighter transition-colors">
            Đặt cơm Plant G
          </h1>
          <div className="w-9"></div>
        </div>
        <div className="flex px-4 gap-2 pb-3">
          {['MAIN', 'SIDE', 'EXTRA'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-2xl transition-all ${activeTab === tab ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 bg-gray-50 dark:bg-gray-700 dark:text-gray-400'}`}>
              {tab === 'MAIN' ? 'Món chính' : tab === 'SIDE' ? 'Món phụ' : 'Ăn kèm'}
            </button>
          ))}
        </div>
      </div>

      {/* THÔNG BÁO TỪ ADMIN & ĐƠN TỐI THIỂU */}
      <div className="px-6 pt-4">
        {sysConfig.minOrder > 0 && (
          <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest text-center mb-2">
            * Đơn hàng tối thiểu: {sysConfig.minOrder.toLocaleString()}đ
          </p>
        )}
      </div>

      {/* USER INFO */}
      <div className="bg-white dark:bg-gray-800 p-6 mb-4 rounded-b-[2.5rem] shadow-sm transition-colors">
        <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 block">
          SĐT đặt hàng *
        </label>
        <input 
          type="tel" 
          value={username} 
          onChange={(e) => setUsername(e.target.value)} 
          placeholder="0333 xxx xxx" 
          className="w-full bg-gray-50 dark:bg-gray-700 dark:text-gray-100 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none transition-all placeholder:text-gray-300 dark:placeholder:text-gray-500" 
        />
        {customerInfo && (
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-2xl border border-blue-100 dark:border-blue-900/50 animate-in fade-in transition-colors">
            <div className="text-xs font-black text-blue-700 dark:text-blue-400 uppercase">
              Chào {customerInfo.name}!
            </div>
            <div className="text-[9px] text-blue-500 dark:text-blue-300 font-bold mt-1 opacity-70 italic tracking-tighter">
              📍 {customerInfo.address}
            </div>
          </div>
        )}
      </div>

      {/* VOUCHER UI */}
      <div className="px-4 mb-6">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
           <div className="flex justify-between items-center mb-3 ml-1">
              <p className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                Ưu đãi giảm giá
              </p>
           </div>
           <div className="flex gap-2 items-center">
              <input 
                type="text" 
                value={voucherCode} 
                onChange={e => setVoucherCode(e.target.value.toUpperCase())} 
                placeholder="Nhập mã..." 
                className="flex-1 bg-gray-50 dark:bg-gray-700 dark:text-white border-none rounded-xl px-4 py-3.5 text-xs font-bold outline-none min-w-0 transition-colors placeholder:text-gray-300 dark:placeholder:text-gray-500" 
              />
              {myVouchers.length > 0 && (
                <button 
                  onClick={() => setShowVoucherList(true)} 
                  className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-3 py-3.5 rounded-xl text-[10px] font-black uppercase whitespace-nowrap border border-blue-100 dark:border-blue-900/50 active:scale-95 transition-all shadow-sm"
                >
                  🎁 Kho mã ({myVouchers.length})
                </button>
              )}
              <button 
                onClick={() => handleApplyVoucher()} 
                className="bg-gray-800 dark:bg-gray-600 text-white px-4 py-3.5 rounded-xl text-[10px] font-black uppercase whitespace-nowrap active:scale-95 transition-all shadow-sm"
              >
                Áp dụng
              </button>
           </div>
           
           {(appliedVoucher || appliedFreeship) && (
              <div className="mt-3 flex flex-wrap gap-2 animate-in zoom-in duration-300">
                 {appliedFreeship && <span className="bg-green-500 dark:bg-green-600 text-white text-[8px] font-black px-3 py-1.5 rounded-lg uppercase shadow-sm">✓ FREE SHIP TỰ ĐỘNG</span>}
                 {appliedVoucher && <span className="bg-blue-600 text-white text-[8px] font-black px-3 py-1.5 rounded-lg uppercase shadow-sm">✓ GIẢM {appliedVoucher.value.toLocaleString()}đ</span>}
              </div>
           )}
        </div>
      </div>

      {/* MENU LIST */}
      <div className="px-4 space-y-4">
        {filteredMenu.map(item => (
          <div key={item.id} className="bg-white dark:bg-gray-800 p-4 rounded-[2rem] flex items-center gap-4 shadow-sm border border-gray-50 dark:border-gray-700 transition-colors">
            <img src={item.image || 'https://via.placeholder.com/150'} className="w-24 h-24 rounded-[1.5rem] object-cover" />
            <div className="flex-1">
              <h3 className="text-sm font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight leading-tight">{item.name}</h3>
              <p className="text-[9px] text-gray-400 dark:text-gray-400 font-bold mt-1 line-clamp-1 italic">{item.description}</p>
              {item.maxQty && <span className="text-[8px] bg-orange-50 dark:bg-orange-900/30 text-orange-500 dark:text-orange-400 px-2 py-0.5 rounded-full font-black uppercase mt-1 inline-block border border-orange-100 dark:border-orange-900/50">Tối đa {item.maxQty}</span>}
              <p className="text-base font-black text-red-500 dark:text-red-400 mt-2">{item.price}</p>
            </div>
            <div className="flex flex-col items-center gap-1 bg-gray-50 dark:bg-gray-700 p-1.5 rounded-2xl transition-colors">
              <button onClick={() => updateQuantity(item, 1)} className="w-9 h-9 bg-blue-600 rounded-xl text-white font-black shadow-md shadow-blue-100 dark:shadow-none">+</button>
              <span className="text-xs font-black py-1 dark:text-white">{cart[item.id]?.qty || 0}</span>
              <button onClick={() => updateQuantity(item, -1)} className="w-9 h-9 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-xl text-gray-400 dark:text-gray-300 font-black transition-colors">-</button>
            </div>
          </div>
        ))}
      </div>

      {/* FLOATING CART BUTTON */}
      {Object.values(cart).length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border-t dark:border-gray-800 z-40 shadow-2xl rounded-t-[2.5rem] transition-colors">
          <button 
            onClick={handleOpenConfirm} 
            disabled={isSubmitting} 
            className={`w-full ${isSubmitting ? 'bg-gray-400 dark:bg-gray-600' : 'bg-blue-600'} text-white font-black py-5 rounded-[2rem] flex items-center justify-between px-8 shadow-xl shadow-blue-200 dark:shadow-none active:scale-95 transition-all`}
          >
            <span className="text-[10px] uppercase tracking-widest">{Object.values(cart).reduce((s,i)=>s+i.qty,0)} món • {getFinalTotal().toLocaleString()}đ</span>
            <span className="text-xs font-black uppercase tracking-widest">{isSubmitting ? 'ĐANG LÀM...' : 'XÁC NHẬN →'}</span>
          </button>
        </div>
      )}

      {/* MODAL: VOUCHER LIST */}
      {showVoucherList && (
        <div className="fixed inset-0 z-[60] bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-end justify-center p-4">
          <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom-10 transition-colors">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-sm font-black uppercase text-gray-800 dark:text-white tracking-widest">Ưu đãi của bạn</h3>
                <p className="text-[9px] text-gray-400 dark:text-gray-500 uppercase font-bold mt-1">Gồm mã cá nhân & công khai</p>
              </div>
              <button onClick={() => setShowVoucherList(false)} className="w-10 h-10 flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded-full text-gray-400 dark:text-gray-300 transition-colors">&times;</button>
            </div>
            <div className="space-y-3 max-h-80 overflow-y-auto pr-2 no-scrollbar">
              {myVouchers.map(v => {
                const isApplied = appliedVoucher?.id === v.id || appliedFreeship?.id === v.id;

                return (
                  <button 
                    key={v.id}
                    onClick={() => toggleVoucher(v, isApplied)}
                    className={`w-full flex justify-between items-center p-5 rounded-2xl border-2 transition-all text-left ${isApplied ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-400 dark:border-blue-500' : 'bg-gray-50 dark:bg-gray-700/50 border-dashed border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-gray-700'}`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                         <p className="font-black text-gray-800 dark:text-gray-100 text-sm tracking-widest uppercase">{v.code}</p>
                         {(!v.assignedPhone || v.assignedPhone.trim() === "") && (
                           <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded text-[8px] font-black tracking-widest uppercase">Công khai</span>
                         )}
                      </div>
                      <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase mt-1">
                        {v.type === 'FREESHIP' ? 'Miễn phí vận chuyển' : `Giảm giá -${v.value.toLocaleString()}đ`}
                      </p>
                      <p className="text-[9px] text-gray-400 dark:text-gray-500 mt-1 font-medium italic">Bạn còn {v.usageLimit} lần dùng</p>
                    </div>
                    <div className={`${isApplied ? 'bg-red-500' : 'bg-blue-600'} text-white px-3 py-2 rounded-xl text-[9px] font-black uppercase shadow-md ${isApplied ? 'shadow-red-100 dark:shadow-none' : 'shadow-blue-100 dark:shadow-none'}`}>
                      {isApplied ? 'HỦY DÙNG' : 'DÙNG'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CHECKOUT CONFIRM */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom-10 transition-colors">
            <h2 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-tighter mb-4">Chi tiết thanh toán</h2>
            <div className="space-y-2 mb-6 border-b border-dashed dark:border-gray-700 pb-5">
              <div className="flex justify-between text-[11px] font-bold text-gray-400 uppercase tracking-widest"><span>Tiền cơm:</span><span>{getSubTotal().toLocaleString()}đ</span></div>
              <div className="flex justify-between text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                <span>Phí vận chuyển:</span>
                <span className={shippingFee === 0 ? "text-green-500 dark:text-green-400 font-black" : ""}>{shippingFee === 0 ? "MIỄN PHÍ" : "5,000đ"}</span>
              </div>
              {appliedVoucher && (
                <div className="flex justify-between text-[11px] font-black text-green-600 dark:text-green-400 uppercase tracking-widest"><span>Giảm giá:</span><span>-{appliedVoucher.value.toLocaleString()}đ</span></div>
              )}
              <div className="flex justify-between items-center pt-3 border-t border-gray-100 dark:border-gray-700 mt-2">
                <span className="text-xs font-black text-gray-800 dark:text-gray-100 uppercase tracking-widest">Thành tiền:</span>
                <span className="text-3xl font-black text-red-500 dark:text-red-400 tracking-tighter">{getFinalTotal().toLocaleString()}đ</span>
              </div>
            </div>
            <textarea 
              value={note} 
              onChange={e => setNote(e.target.value)} 
              placeholder="Ghi chú (VD: Không hành, nhiều ớt...)" 
              className="w-full p-4 bg-gray-50 dark:bg-gray-700 dark:text-white border-none rounded-2xl text-xs mb-6 outline-none font-bold h-20 transition-colors placeholder:text-gray-300 dark:placeholder:text-gray-500" 
            />
            <div className="flex gap-4">
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-5 text-[10px] font-black text-gray-400 dark:text-gray-300 uppercase tracking-widest bg-gray-50 dark:bg-gray-700 rounded-2xl active:scale-95 transition-all">Quay lại</button>
              <button onClick={handleOrderSubmit} disabled={isSubmitting} className="flex-[2] bg-blue-600 text-white text-[10px] font-black rounded-2xl shadow-xl shadow-blue-100 dark:shadow-none uppercase tracking-[0.2em] active:scale-95 transition-all">
                {isSubmitting ? 'ĐANG XỬ LÝ...' : 'ĐẶT CƠM NGAY'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Order;