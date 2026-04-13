import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createOrder, validateVoucher } from '../services/orderService';
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

  // --- TRẠNG THÁI MỚI: VOUCHER & PHÍ SHIP ---
  const [isSubmitting, setIsSubmitting] = useState(false); // Chống spam
  const [voucherCode, setVoucherCode] = useState(''); // Mã nhập tay
  const [appliedVoucher, setAppliedVoucher] = useState(null); // Voucher giảm giá
  const [appliedFreeship, setAppliedFreeship] = useState(null); // Voucher freeship
  const [shippingFee, setShippingFee] = useState(5000); // Mặc định 5,000đ

  // 1. Lắng nghe Thực đơn Real-time
  useEffect(() => {
    const unsubscribe = subscribeToMenu((data) => {
      setMenu(data);
      setIsLoading(false);
    });
    const savedPhones = JSON.parse(localStorage.getItem('recentPhones') || '[]');
    setRecentPhones(savedPhones);
    if (!userPhoneParam && savedPhones.length > 0) setUsername(savedPhones[0]);
    return () => unsubscribe();
  }, [userPhoneParam]);

  // 2. Logic Xử lý Đặt lại đơn và Tự động áp Voucher khi có SĐT
  useEffect(() => {
    const handleAutoVoucher = async () => {
      if (customerInfo?.phone) {
        // Tự động kiểm tra Voucher Freeship gán cho SĐT này
        const resFs = await validateVoucher('FREESHIP', customerInfo.phone);
        if (resFs.valid) {
          setAppliedFreeship(resFs.voucher);
          setShippingFee(0);
        } else {
          setShippingFee(5000);
        }
      }
    };
    handleAutoVoucher();
  }, [customerInfo]);

  // 3. Tự động tìm thông tin khách hàng
  useEffect(() => {
    const fetchUser = async () => {
      if (username && username.trim().length >= 10) {
        const userData = await getUserByPhone(username.trim());
        if (userData) {
          setCustomerInfo({ name: userData.fullName, phone: userData.username, address: userData.address });
        } else { setCustomerInfo(null); }
      } else { setCustomerInfo(null); }
    };
    const timer = setTimeout(fetchUser, 500);
    return () => clearTimeout(timer);
  }, [username]);

  // --- LOGIC CẬP NHẬT GIỎ HÀNG + GIỚI HẠN SỐ LƯỢNG ---
  const updateQuantity = (item, delta) => {
    setCart(prev => {
      const currentItem = prev[item.id];
      const currentQty = currentItem ? currentItem.qty : 0;
      
      // Kiểm tra giới hạn mua tối đa từ Admin
      const maxAllowed = item.maxQty || 10; // Mặc định 10 nếu admin không set
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

  const cartArray = Object.values(cart);
  const totalItems = cartArray.reduce((sum, item) => sum + item.qty, 0);

  // --- TÍNH TOÁN TỔNG TIỀN PHỨC TẠP ---
  const getSubTotal = () => {
    return cartArray.reduce((total, item) => {
      const price = parseInt(item.price.replace(/\D/g, '')) || 0;
      return total + (price * item.qty);
    }, 0);
  };

  const getFinalTotal = () => {
    const subTotal = getSubTotal();
    const discount = appliedVoucher ? appliedVoucher.value : 0;
    return subTotal + shippingFee - discount;
  };

  // Hàm áp dụng mã voucher thủ công
  const handleApplyVoucher = async () => {
    if (!voucherCode.trim()) return;
    const res = await validateVoucher(voucherCode, username);
    if (res.valid) {
      if (res.voucher.type === 'FREESHIP') {
        setAppliedFreeship(res.voucher);
        setShippingFee(0);
      } else {
        setAppliedVoucher(res.voucher);
      }
      alert("Áp dụng mã thành công!");
    } else {
      alert(res.msg);
    }
  };

  const handleOrderSubmit = async () => {
    if (isSubmitting) return; // CHỐNG SPAM
    
    setIsSubmitting(true);
    const itemsString = cartArray.map(item => `${item.qty}x ${item.name}`).join(', ');
    
    const orderData = {
      phone: username.trim(),
      customer: customerInfo.name, 
      address: customerInfo.address || "Vinhomes",
      items: itemsString,
      subTotal: getSubTotal(),
      shippingFee: shippingFee,
      discount: appliedVoucher ? appliedVoucher.value : 0,
      total: getFinalTotal().toLocaleString('vi-VN') + 'đ',
      note: note.trim(),
      // Gửi kèm ID voucher để service trừ lượt dùng
      appliedVoucherId: appliedVoucher?.id || appliedFreeship?.id || null,
      currentUsageLimit: appliedVoucher?.usageLimit || appliedFreeship?.usageLimit || 0
    };

    try {
      const result = await createOrder(orderData);
      if (result.success) {
        localStorage.removeItem('reorder_items');
        navigate(`/checkorder?user=${username.trim()}`);
      }
    } catch (error) {
      alert('Lỗi kết nối. Vui lòng thử lại!');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredMenu = menu.filter(item => item.category === activeTab);

  return (
    <div className="min-h-screen bg-gray-50 pb-44 font-sans">
      {/* Header Tabs */}
      <div className="bg-white sticky top-0 z-30 shadow-sm border-b border-gray-100">
        <div className="px-6 py-5 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="p-2 bg-gray-50 rounded-2xl active:scale-90 transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h1 className="text-lg font-black text-gray-800 uppercase tracking-tighter">Thực đơn Plant G</h1>
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

      {/* Nhận diện khách hàng */}
      <div className="bg-white p-6 mb-4 rounded-b-[2.5rem] shadow-sm">
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block">SĐT đặt hàng *</label>
        <input type="tel" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="0333 xxx xxx" className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none transition-all" />
        {customerInfo && (
          <div className="mt-4 p-4 bg-blue-50 rounded-2xl border border-blue-100 animate-in fade-in">
            <div className="text-xs font-black text-blue-700 uppercase">Chào {customerInfo.name}!</div>
            <div className="text-[9px] text-blue-500 font-bold mt-1 opacity-70 italic">📍 {customerInfo.address}</div>
          </div>
        )}
      </div>

      {/* Menu List */}
      <div className="px-4 space-y-4">
        {filteredMenu.map(item => (
          <div key={item.id} className="bg-white p-4 rounded-[2rem] flex items-center gap-4 shadow-sm border border-gray-50">
            <img src={item.image || 'https://via.placeholder.com/150'} className="w-24 h-24 rounded-[1.5rem] object-cover" alt={item.name} />
            <div className="flex-1">
              <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight">{item.name}</h3>
              <p className="text-[9px] text-gray-400 font-bold mt-1 line-clamp-1">{item.description}</p>
              {item.maxQty && <span className="text-[8px] bg-orange-50 text-orange-500 px-2 py-0.5 rounded-full font-black uppercase mt-1 inline-block">Tối đa {item.maxQty} phần</span>}
              <p className="text-base font-black text-red-500 mt-2">{item.price}</p>
            </div>
            <div className="flex flex-col items-center gap-1 bg-gray-50 p-1.5 rounded-2xl">
              <button onClick={() => updateQuantity(item, 1)} className="w-9 h-9 bg-blue-600 rounded-xl text-white font-black">+</button>
              <span className="text-xs font-black">{cart[item.id]?.qty || 0}</span>
              <button onClick={() => updateQuantity(item, -1)} className="w-9 h-9 bg-white border border-gray-200 rounded-xl text-gray-400 font-black">-</button>
            </div>
          </div>
        ))}
      </div>

      {/* Thanh toán & Voucher */}
      {totalItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/90 backdrop-blur-xl border-t border-gray-100 z-40 shadow-2xl rounded-t-[2.5rem]">
          <div className="flex gap-2 mb-4">
            <input 
              type="text" 
              value={voucherCode} 
              onChange={e => setVoucherCode(e.target.value)} 
              placeholder="Nhập mã giảm giá..." 
              className="flex-1 bg-gray-50 border-none rounded-xl px-4 py-3 text-xs font-bold outline-none" 
            />
            <button onClick={handleApplyVoucher} className="bg-gray-800 text-white px-4 py-3 rounded-xl text-[10px] font-black uppercase">Áp dụng</button>
          </div>
          <button onClick={() => setShowConfirm(true)} disabled={isSubmitting} className={`w-full ${isSubmitting ? 'bg-gray-400' : 'bg-blue-600'} text-white font-black py-5 rounded-[2rem] flex items-center justify-between px-8 shadow-xl shadow-blue-200`}>
            <span className="text-[10px] uppercase tracking-widest">{totalItems} món • {getFinalTotal().toLocaleString()}đ</span>
            <span className="text-xs font-black uppercase uppercase tracking-widest">{isSubmitting ? 'ĐANG XỬ LÝ...' : 'TIẾP TỤC →'}</span>
          </button>
        </div>
      )}

      {/* POPUP XÁC NHẬN CHUYÊN SÂU */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom-10">
            <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter mb-4">Xác nhận đơn hàng</h2>
            
            <div className="space-y-3 mb-6 max-h-40 overflow-y-auto pr-2 border-b border-dashed pb-4">
              {cartArray.map(item => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="font-bold text-gray-600">{item.qty}x {item.name}</span>
                  <span className="font-black text-gray-800">{item.price}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2 mb-6">
              <div className="flex justify-between text-[11px] font-bold text-gray-400 uppercase">
                <span>Tiền cơm:</span><span>{getSubTotal().toLocaleString()}đ</span>
              </div>
              <div className="flex justify-between text-[11px] font-bold text-gray-400 uppercase">
                <span>Phí vận chuyển:</span>
                <span className={shippingFee === 0 ? "text-green-500" : ""}>{shippingFee === 0 ? "MIỄN PHÍ" : "5,000đ"}</span>
              </div>
              {appliedVoucher && (
                <div className="flex justify-between text-[11px] font-black text-green-600 uppercase">
                  <span>Voucher giảm giá:</span><span>-{appliedVoucher.value.toLocaleString()}đ</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t mt-2">
                <span className="text-xs font-black text-gray-800 uppercase">Tổng cộng:</span>
                <span className="text-2xl font-black text-red-500 tracking-tighter">{getFinalTotal().toLocaleString()}đ</span>
              </div>
            </div>

            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Ghi chú thêm cho bếp..." className="w-full p-4 bg-gray-50 rounded-2xl text-xs mb-6 outline-none" rows="2" />

            <div className="flex gap-4">
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-5 text-[10px] font-black text-gray-400 uppercase bg-gray-50 rounded-2xl">Quay lại</button>
              <button onClick={handleOrderSubmit} disabled={isSubmitting} className="flex-[2] py-5 bg-blue-600 text-white text-[10px] font-black rounded-2xl shadow-xl shadow-blue-100 uppercase tracking-widest">
                {isSubmitting ? 'ĐANG ĐẶT...' : 'XÁC NHẬN ĐẶT'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Order;