import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [appliedFreeship, setAppliedFreeship] = useState(null);
  const [shippingFee, setShippingFee] = useState(5000);
  const [myVouchers, setMyVouchers] = useState([]); 
  const [showVoucherList, setShowVoucherList] = useState(false); 

  // 1. Subscribe to Menu
  useEffect(() => {
    const unsubscribe = subscribeToMenu((data) => {
      setMenu(data);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Fetch User & Auto-Apply Freeship (with Debounce)
  useEffect(() => {
    const syncData = async () => {
      const cleanPhone = username.trim();
      
      if (cleanPhone.length >= 10) {
        const userData = await getUserByPhone(cleanPhone);
        setCustomerInfo(userData ? { name: userData.fullName, phone: userData.username, address: userData.address } : null);

        const vouchers = await getMyVouchers(cleanPhone);
        setMyVouchers(vouchers);

        // Auto-apply FREESHIP5K if available and has uses left
        const autoFs = vouchers.find(v => v.code.trim().toUpperCase() === 'FREESHIP5K' && v.usageLimit > 0);
        
        if (autoFs) {
          setAppliedFreeship(autoFs);
          setShippingFee(0);
        } else {
          setAppliedFreeship(null);
          setShippingFee(5000);
        }
      } else {
        setCustomerInfo(null);
        setMyVouchers([]);
        setAppliedFreeship(null);
        setShippingFee(5000);
      }
    };

    const timer = setTimeout(syncData, 600);
    return () => clearTimeout(timer);
  }, [username]);

  // Cart Management
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

  // Voucher Application (Manual & Modal Selection)
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

  const handleOrderSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    // Determine which voucher ID to deduct from (prioritizes cash discount if both exist, 
    // but you may want to adapt your backend to accept an array of IDs if they use both simultaneously)
    const activeVoucherId = appliedVoucher ? appliedVoucher.id : (appliedFreeship ? appliedFreeship.id : null);
    const activeUsageLimit = appliedVoucher ? appliedVoucher.usageLimit : (appliedFreeship ? appliedFreeship.usageLimit : 0);

    const orderData = {
      phone: username.trim(),
      customer: customerInfo?.name || "Khách vãng lai", 
      address: customerInfo?.address || "Nhận tại quán", // Default if no address
      items: Object.values(cart).map(item => `${item.qty}x ${item.name}`).join(', '),
      subTotal: getSubTotal(),
      shippingFee,
      discount: appliedVoucher?.value || 0,
      total: getFinalTotal().toLocaleString('vi-VN') + 'đ',
      note: note.trim(),
      appliedVoucherId: activeVoucherId,
      currentUsageLimit: activeUsageLimit
    };

    try {
      const result = await createOrder(orderData);
      if (result.success) {
        localStorage.removeItem('reorder_items');
        navigate(`/checkorder?user=${username.trim()}`);
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
       <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-44 font-sans">
      {/* Header Tabs */}
      <div className="bg-white sticky top-0 z-30 shadow-sm border-b">
        <div className="px-6 py-5 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="p-2 bg-gray-50 rounded-2xl active:scale-90 transition-all"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M15 19l-7-7 7-7" /></svg></button>
          <h1 className="text-lg font-black text-gray-800 uppercase tracking-tighter">Đặt cơm Plant G</h1>
          <div className="w-9"></div>
        </div>
        <div className="flex px-4 gap-2 pb-3">
          {['MAIN', 'SIDE', 'EXTRA'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-2xl transition-all ${activeTab === tab ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 bg-gray-50'}`}>
              {tab === 'MAIN' ? 'Món chính' : tab === 'SIDE' ? 'Món phụ' : 'Ăn kèm'}
            </button>
          ))}
        </div>
      </div>

      {/* User Info */}
      <div className="bg-white p-6 mb-4 rounded-b-[2.5rem] shadow-sm">
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block">SĐT đặt hàng *</label>
        <input type="tel" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="0333 xxx xxx" className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none transition-all" />
        {customerInfo && (
          <div className="mt-4 p-4 bg-blue-50 rounded-2xl border border-blue-100 animate-in fade-in">
            <div className="text-xs font-black text-blue-700 uppercase">Chào {customerInfo.name}!</div>
            <div className="text-[9px] text-blue-500 font-bold mt-1 opacity-70 italic tracking-tighter">📍 {customerInfo.address}</div>
          </div>
        )}
      </div>

      {/* Voucher Input & Selection */}
      <div className="px-4 mb-6">
        <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-gray-100">
           <div className="flex justify-between items-center mb-3 ml-1">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Ưu đãi giảm giá</p>
              {myVouchers.length > 0 && (
                <button onClick={() => setShowVoucherList(true)} className="text-[10px] font-black text-blue-600 uppercase underline decoration-2 underline-offset-4 active:scale-95 transition-all">
                  Kho mã của tôi ({myVouchers.length})
                </button>
              )}
           </div>
           <div className="flex gap-2">
              <input 
                type="text" value={voucherCode} 
                onChange={e => setVoucherCode(e.target.value.toUpperCase())} 
                placeholder="Nhập mã ưu đãi..." 
                className="flex-1 bg-gray-50 border-none rounded-xl px-4 py-3 text-xs font-bold outline-none" 
              />
              <button onClick={() => handleApplyVoucher()} className="bg-gray-800 text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase active:scale-95 transition-all">Áp dụng</button>
           </div>
           
           {(appliedVoucher || appliedFreeship) && (
              <div className="mt-3 flex flex-wrap gap-2">
                 {appliedFreeship && <span className="bg-green-500 text-white text-[8px] font-black px-3 py-1.5 rounded-lg uppercase shadow-sm">✓ FREE SHIP TỰ ĐỘNG</span>}
                 {appliedVoucher && <span className="bg-blue-600 text-white text-[8px] font-black px-3 py-1.5 rounded-lg uppercase shadow-sm">✓ ĐÃ GIẢM {appliedVoucher.value.toLocaleString()}đ</span>}
              </div>
           )}
        </div>
      </div>

      {/* Menu List */}
      <div className="px-4 space-y-4">
        {filteredMenu.map(item => (
          <div key={item.id} className="bg-white p-4 rounded-[2rem] flex items-center gap-4 shadow-sm border border-gray-50">
            <img src={item.image || 'https://via.placeholder.com/150'} className="w-24 h-24 rounded-[1.5rem] object-cover" />
            <div className="flex-1">
              <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight leading-tight">{item.name}</h3>
              <p className="text-[9px] text-gray-400 font-bold mt-1 line-clamp-1 italic">{item.description}</p>
              {item.maxQty && <span className="text-[8px] bg-orange-50 text-orange-500 px-2 py-0.5 rounded-full font-black uppercase mt-1 inline-block border border-orange-100">Tối đa {item.maxQty}</span>}
              <p className="text-base font-black text-red-500 mt-2">{item.price}</p>
            </div>
            <div className="flex flex-col items-center gap-1 bg-gray-50 p-1.5 rounded-2xl">
              <button onClick={() => updateQuantity(item, 1)} className="w-9 h-9 bg-blue-600 rounded-xl text-white font-black shadow-md shadow-blue-100">+</button>
              <span className="text-xs font-black py-1">{cart[item.id]?.qty || 0}</span>
              <button onClick={() => updateQuantity(item, -1)} className="w-9 h-9 bg-white border border-gray-200 rounded-xl text-gray-400 font-black">-</button>
            </div>
          </div>
        ))}
      </div>

      {/* Floating Cart Button */}
      {Object.values(cart).length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/90 backdrop-blur-xl border-t z-40 shadow-2xl rounded-t-[2.5rem]">
          <button onClick={() => setShowConfirm(true)} disabled={isSubmitting} className={`w-full ${isSubmitting ? 'bg-gray-400' : 'bg-blue-600'} text-white font-black py-5 rounded-[2rem] flex items-center justify-between px-8 shadow-xl shadow-blue-200 active:scale-95 transition-all`}>
            <span className="text-[10px] uppercase tracking-widest">{Object.values(cart).reduce((s,i)=>s+i.qty,0)} món • {getFinalTotal().toLocaleString()}đ</span>
            <span className="text-xs font-black uppercase tracking-widest">{isSubmitting ? 'ĐANG LÀM...' : 'XÁC NHẬN →'}</span>
          </button>
        </div>
      )}

      {/* MODAL: Voucher Selection */}
      {showVoucherList && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom-10">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm font-black uppercase text-gray-800 tracking-widest">Ưu đãi của bạn</h3>
              <button onClick={() => setShowVoucherList(false)} className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-full text-gray-400">&times;</button>
            </div>
            <div className="space-y-3 max-h-80 overflow-y-auto pr-2 no-scrollbar">
              {myVouchers.filter(v => v.usageLimit > 0).map(v => (
                <button 
                  key={v.id}
                  onClick={() => handleApplyVoucher(v.code)}
                  className="w-full flex justify-between items-center p-5 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-left"
                >
                  <div>
                    <p className="font-black text-gray-800 text-sm tracking-widest uppercase">{v.code}</p>
                    <p className="text-[10px] text-blue-600 font-bold uppercase mt-1">
                      {v.type === 'FREESHIP' ? 'Miễn phí vận chuyển' : `Giảm giá -${v.value.toLocaleString()}đ`}
                    </p>
                    <p className="text-[9px] text-gray-400 mt-1 font-medium italic">Bạn còn {v.usageLimit} lần dùng</p>
                  </div>
                  <div className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase shadow-lg shadow-blue-100">DÙNG</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Final Confirmation */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom-10">
            <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter mb-4">Chi tiết thanh toán</h2>
            <div className="space-y-2 mb-6 border-b border-dashed pb-5">
              <div className="flex justify-between text-[11px] font-bold text-gray-400 uppercase tracking-widest"><span>Tiền cơm:</span><span>{getSubTotal().toLocaleString()}đ</span></div>
              <div className="flex justify-between text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                <span>Phí vận chuyển:</span>
                <span className={shippingFee === 0 ? "text-green-500 font-black" : ""}>{shippingFee === 0 ? "MIỄN PHÍ" : "5,000đ"}</span>
              </div>
              {appliedVoucher && (
                <div className="flex justify-between text-[11px] font-black text-green-600 uppercase tracking-widest"><span>Giảm giá:</span><span>-{appliedVoucher.value.toLocaleString()}đ</span></div>
              )}
              <div className="flex justify-between items-center pt-3 border-t border-gray-100 mt-2">
                <span className="text-xs font-black text-gray-800 uppercase tracking-widest">Thành tiền:</span>
                <span className="text-3xl font-black text-red-500 tracking-tighter">{getFinalTotal().toLocaleString()}đ</span>
              </div>
            </div>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Ghi chú (VD: Không hành, nhiều ớt...)" className="w-full p-4 bg-gray-50 rounded-2xl text-xs mb-6 outline-none font-bold h-20" />
            <div className="flex gap-4">
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 rounded-2xl active:scale-95 transition-all">Quay lại</button>
              <button onClick={handleOrderSubmit} disabled={isSubmitting} className="flex-[2] bg-blue-600 text-white text-[10px] font-black rounded-2xl shadow-xl shadow-blue-100 uppercase tracking-[0.2em] active:scale-95 transition-all">
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