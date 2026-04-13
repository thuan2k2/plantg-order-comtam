import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore'; // Thêm collection, query, where
import { db } from '../firebase/config';
import { createOrder, validateVoucher, getMyVouchers } from '../services/orderService';
import { verifyPasscode } from '../services/authService'; 
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
  const [showClosingPopup, setShowClosingPopup] = useState(false); 

  // STATE MỚI: Quản lý Passcode Ví
  const [showWalletPasscode, setShowWalletPasscode] = useState(false);
  const [walletPasscode, setWalletPasscode] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('CASH'); 
  
  // STATE MỚI: Quản lý Địa chỉ giao hàng được chọn
  const [selectedAddress, setSelectedAddress] = useState('');

  useEffect(() => {
    // 1. Lắng nghe trạng thái Hệ thống liên tục
    const unsubConfig = onSnapshot(doc(db, 'system', 'config'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setSysConfig(data);

        // NẾU ADMIN ĐÓNG CỬA ĐỘT XUẤT KHI KHÁCH ĐANG Ở TRANG NÀY
        if (data.isOpen === false) {
          setShowClosingPopup(true);
          setShowConfirm(false); 
          setTimeout(() => {
            navigate('/');
          }, 3000);
        }
      }
    });

    // 2. Lắng nghe Menu
    const unsubscribeMenu = subscribeToMenu((data) => {
      setMenu(data);
      setIsLoading(false);
    });
    
    // 3. Xử lý số điện thoại
    const savedPhones = JSON.parse(localStorage.getItem('recentPhones') || '[]');
    setRecentPhones(savedPhones);
    if (!userPhoneParam && savedPhones.length > 0) {
      setUsername(savedPhones[0]);
    }
    
    // Hủy lắng nghe khi rời trang
    return () => {
      unsubConfig();
      unsubscribeMenu();
    };
  }, [userPhoneParam, navigate]);

  // ĐỒNG BỘ REAL-TIME THÔNG TIN USER (VÍ TIỀN, ĐỊA CHỈ)
  useEffect(() => {
    let unsubUser = () => {};

    const syncDataRealtime = async () => {
      const cleanPhone = username.trim();
      
      const vouchers = await getMyVouchers(cleanPhone);
      setMyVouchers(vouchers);
      
      if (cleanPhone.length >= 10) {
        // Lắng nghe dữ liệu khách hàng theo thời gian thực
        const q = query(collection(db, 'users'), where("username", "==", cleanPhone));
        
        unsubUser = onSnapshot(q, (snapshot) => {
          if (!snapshot.empty) {
            const userData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };

            // Kiểm tra lệnh cấm
            if (userData.isBanned) {
               alert("Tài khoản của bạn hiện đang bị khóa!");
               navigate('/');
               return;
            }

            setCustomerInfo({ 
              name: userData.fullName, 
              phone: userData.username, 
              address: userData.address,
              addresses: userData.addresses || [], 
              walletBalance: userData.walletBalance || 0 
            });

            // Tự động set địa chỉ được chọn (Chỉ set nếu khách chưa tự chọn)
            setSelectedAddress(prev => {
              if (prev) return prev; // Giữ nguyên địa chỉ khách đang chọn dở
              if (userData.addresses && userData.addresses.length > 0) {
                const def = userData.addresses.find(a => a.isDefault);
                return def ? def.detail : userData.addresses[0].detail;
              }
              return userData.address || '';
            });

          } else {
            setCustomerInfo(null);
          }
        });

        const autoFs = vouchers.find(v => v.code.trim().toUpperCase() === 'FREESHIP5K');
        if (autoFs) {
          setAppliedFreeship(autoFs);
          setShippingFee(0);
        } else {
          setAppliedFreeship(null);
          setShippingFee(5000);
        }
      } else {
        setCustomerInfo(null);
        setAppliedFreeship(null);
        setShippingFee(5000);
      }
    };

    const timer = setTimeout(syncDataRealtime, 500);
    
    return () => {
      clearTimeout(timer);
      unsubUser(); // Hủy lắng nghe dữ liệu User khi rời khỏi
    };
  }, [username, navigate]);

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

  // LOGIC XÁC THỰC VÍ
  const handleConfirmWalletPayment = async () => {
    if (walletPasscode.length !== 6) {
      return alert("Vui lòng nhập đủ 6 số Passcode!");
    }

    setIsSubmitting(true);
    const isValid = await verifyPasscode(username.trim(), walletPasscode);
    
    if (!isValid) {
      setIsSubmitting(false);
      return alert("Mã Passcode không chính xác!");
    }

    setShowWalletPasscode(false);
    setWalletPasscode('');
    await proceedOrderSubmit();
  };

  const handleOrderSubmit = async () => {
    if (isSubmitting) return;
    
    if (!selectedAddress || selectedAddress.trim() === '') {
       return alert("Vui lòng chọn hoặc nhập địa chỉ giao hàng!");
    }

    // Nếu chọn thanh toán bằng ví, phải kiểm tra số dư và hỏi Passcode
    if (selectedPaymentMethod === 'WALLET') {
      if (!customerInfo || customerInfo.walletBalance < getFinalTotal()) {
        return alert("Số dư ví không đủ để thanh toán đơn hàng này!");
      }
      setShowWalletPasscode(true); // Hiện bảng hỏi Passcode
      return;
    }

    // Nếu thanh toán thường, chạy luôn
    await proceedOrderSubmit();
  };

  // Tách hàm submit chính
  const proceedOrderSubmit = async () => {
    setIsSubmitting(true);
    
    const usedVouchers = [];
    if (appliedVoucher) usedVouchers.push({ id: appliedVoucher.id, type: appliedVoucher.type });
    if (appliedFreeship) usedVouchers.push({ id: appliedFreeship.id, type: appliedFreeship.type });
    
    const cleanPhone = username.trim();

    const orderData = {
      phone: cleanPhone,
      customer: customerInfo?.name || "Khách vãng lai", 
      address: selectedAddress.trim(), // Lưu địa chỉ đã chọn vào Database
      items: Object.values(cart).map(item => `${item.qty}x ${item.name}`).join(', '),
      subTotal: getSubTotal(),
      shippingFee,
      discount: appliedVoucher?.value || 0,
      total: getFinalTotal().toLocaleString('vi-VN') + 'đ',
      note: note.trim(),
      usedVouchers,
      paymentMethod: selectedPaymentMethod 
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-44 font-sans transition-colors duration-300 relative">
      
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
            * Xin lưu ý: Đơn hàng cần đạt tối tối thiểu: {sysConfig.minOrder.toLocaleString()}đ để được phục vụ. Cảm ơn bạn! *
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
            <div className="flex justify-between items-center mb-1">
              <div className="text-xs font-black text-blue-700 dark:text-blue-400 uppercase">
                Chào {customerInfo.name}!
              </div>
              <div className="text-[10px] font-black text-green-600 bg-green-100 px-2 py-1 rounded-lg transition-all">
                Ví: {(customerInfo.walletBalance || 0).toLocaleString()}đ
              </div>
            </div>
            {/* Hiển thị địa chỉ sẽ giao tới ở trang chủ đặt hàng */}
            <div className="text-[9px] text-blue-500 dark:text-blue-300 font-bold mt-1 opacity-70 italic tracking-tighter">
              📍 Giao tới: {selectedAddress || 'Chưa có địa chỉ'}
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

      {/* MODAL: CHECKOUT CONFIRM - TÍCH HỢP CHỌN ĐỊA CHỈ */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom-10 transition-colors overflow-y-auto max-h-[90vh]">
            <h2 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-tighter mb-4">Chi tiết thanh toán</h2>
            
            {/* LỰA CHỌN ĐỊA CHỈ NHẬN HÀNG */}
            <div className="mb-6">
              <p className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-3 border-b dark:border-gray-700 pb-2">
                1. Giao đến địa chỉ:
              </p>
              
              {customerInfo?.addresses && customerInfo.addresses.length > 0 ? (
                <div className="space-y-2">
                  {customerInfo.addresses.map((addr) => (
                    <button 
                      key={addr.id}
                      onClick={() => setSelectedAddress(addr.detail)}
                      className={`w-full text-left p-3.5 rounded-xl border-2 transition-all ${
                        selectedAddress === addr.detail 
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 text-gray-800 dark:text-white' 
                        : 'border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="truncate flex-1 text-[11px] font-bold mr-2 leading-tight">{addr.detail}</span>
                        {addr.isDefault && <span className="flex-shrink-0 text-[8px] bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 font-black px-1.5 py-0.5 rounded-md uppercase">Mặc định</span>}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <input 
                  type="text" 
                  value={selectedAddress} 
                  onChange={(e) => setSelectedAddress(e.target.value)}
                  placeholder="Nhập địa chỉ giao hàng..." 
                  className="w-full p-4 bg-gray-50 dark:bg-gray-700 dark:text-white border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-gray-300 dark:placeholder:text-gray-500" 
                />
              )}
            </div>

            <div className="space-y-2 mb-4 border-b border-dashed dark:border-gray-700 pb-5">
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

            {/* CHỌN PHƯƠNG THỨC THANH TOÁN */}
            <div className="mb-6 space-y-2">
               <p className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-3 border-b dark:border-gray-700 pb-2">
                 2. Phương thức thanh toán:
               </p>
               <div className="grid grid-cols-2 gap-2">
                 <button 
                   onClick={() => setSelectedPaymentMethod('CASH')}
                   className={`p-3 rounded-xl border-2 text-[10px] font-black uppercase transition-all ${selectedPaymentMethod === 'CASH' ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'border-gray-100 dark:border-gray-700 text-gray-400 dark:text-gray-500'}`}
                 >
                   💵 Tiền mặt
                 </button>
                 <button 
                   onClick={() => setSelectedPaymentMethod('TRANSFER')}
                   className={`p-3 rounded-xl border-2 text-[10px] font-black uppercase transition-all ${selectedPaymentMethod === 'TRANSFER' ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'border-gray-100 dark:border-gray-700 text-gray-400 dark:text-gray-500'}`}
                 >
                   🏦 Chuyển khoản
                 </button>
               </div>
               
               {customerInfo && (
                 <button 
                   onClick={() => setSelectedPaymentMethod('WALLET')}
                   className={`w-full p-3 mt-2 rounded-xl border-2 text-[10px] font-black uppercase transition-all ${selectedPaymentMethod === 'WALLET' ? 'border-green-500 bg-green-50/50 dark:bg-green-900/20 text-green-600 dark:text-green-400' : 'border-gray-100 dark:border-gray-700 text-gray-400 dark:text-gray-500'}`}
                 >
                   Thanh toán bằng Ví Plant G (Số dư: {(customerInfo.walletBalance || 0).toLocaleString()}đ)
                 </button>
               )}
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

      {/* MODAL: NHẬP PASSCODE VÍ */}
      {showWalletPasscode && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] w-full max-w-xs shadow-2xl animate-in zoom-in-95">
            <p className="text-center font-black uppercase text-xs mb-2 text-gray-800 dark:text-white">Bảo mật thanh toán</p>
            <p className="text-center text-[10px] text-gray-500 mb-6 font-bold">Nhập Passcode để trừ {getFinalTotal().toLocaleString()}đ từ ví của bạn.</p>
            
            <input 
              type="password" maxLength="6" placeholder="******"
              className="w-full text-center text-3xl tracking-[0.5em] p-4 bg-gray-100 dark:bg-gray-700 dark:text-white rounded-2xl mb-6 outline-none border-none font-black"
              onChange={(e) => setWalletPasscode(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => {setShowWalletPasscode(false); setIsSubmitting(false); setWalletPasscode('');}} className="flex-1 py-3 text-gray-400 font-black uppercase text-[10px] bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200">Hủy</button>
              <button onClick={handleConfirmWalletPayment} disabled={isSubmitting} className="flex-1 py-3 bg-green-600 text-white rounded-xl font-black uppercase text-[10px] shadow-md shadow-green-200">
                {isSubmitting ? '...' : 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP THÔNG BÁO ĐÓNG CỬA ĐỘT XUẤT */}
      {showClosingPopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
          <div className="bg-white dark:bg-gray-800 w-full max-w-xs rounded-[2.5rem] p-8 text-center shadow-2xl animate-in zoom-in-95">
            <div className="text-5xl mb-4">🙏</div>
            <h2 className="text-lg font-black uppercase text-gray-800 dark:text-white leading-tight mb-2">
              Thành thật xin lỗi!
            </h2>
            <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 leading-relaxed uppercase tracking-tighter">
              Bếp vừa mới đóng cửa để nghỉ ngơi. <br/>
              Hệ thống sẽ đưa bạn về trang chủ sau 3 giây...
            </p>
            <div className="mt-6 flex justify-center">
               <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Order;