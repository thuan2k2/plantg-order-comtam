import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createOrder } from '../services/orderService';
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

  // 1. Lắng nghe Thực đơn Real-time và LocalStorage
  useEffect(() => {
    const unsubscribe = subscribeToMenu((data) => {
      setMenu(data);
      setIsLoading(false);
    });

    const savedPhones = JSON.parse(localStorage.getItem('recentPhones') || '[]');
    setRecentPhones(savedPhones);

    // Nếu không có user trên URL, tự lấy SĐT gần nhất
    if (!userPhoneParam && savedPhones.length > 0) {
      setUsername(savedPhones[0]);
    }

    return () => unsubscribe();
  }, [userPhoneParam]);

  // 2. XỬ LÝ ĐẶT LẠI ĐƠN HÀNG (REORDER LOGIC)
  useEffect(() => {
    if (menu.length > 0) {
      const reorderData = localStorage.getItem('reorder_items');
      if (reorderData) {
        const newCart = {};
        // Tách chuỗi: "2x Cơm sườn, 1x Trà đá"
        const itemsArray = reorderData.split(', ');
        
        itemsArray.forEach(itemStr => {
          const match = itemStr.match(/(\d+)x\s+(.+)/);
          if (match) {
            const qty = parseInt(match[1]);
            const itemName = match[2].trim();
            // Tìm món trong menu theo tên
            const menuItem = menu.find(m => m.name === itemName);
            if (menuItem) {
              newCart[menuItem.id] = { ...menuItem, qty: qty };
            }
          }
        });

        if (Object.keys(newCart).length > 0) {
          setCart(newCart);
          // Xóa sau khi đã xử lý xong
          localStorage.removeItem('reorder_items');
        }
      }
    }
  }, [menu]);

  // 3. Tự động tìm thông tin khách hàng
  useEffect(() => {
    const fetchUser = async () => {
      if (username && username.trim().length >= 10) {
        const userData = await getUserByPhone(username.trim());
        if (userData) {
          setCustomerInfo({
            name: userData.fullName,
            phone: userData.username,
            address: userData.address
          });
        } else { setCustomerInfo(null); }
      } else { setCustomerInfo(null); }
    };
    const timer = setTimeout(() => fetchUser(), 500);
    return () => clearTimeout(timer);
  }, [username]);

  const updateQuantity = (item, delta) => {
    setCart(prev => {
      const currentItem = prev[item.id];
      const newQty = (currentItem ? currentItem.qty : 0) + delta;
      if (newQty <= 0) {
        const { [item.id]: removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [item.id]: { ...item, qty: newQty } };
    });
  };

  const cartArray = Object.values(cart);
  const totalItems = cartArray.reduce((sum, item) => sum + item.qty, 0);

  const calculateTotal = () => {
    const totalNum = cartArray.reduce((total, item) => {
      const numericPrice = parseInt(item.price.replace(/\D/g, ''), 10) || 0;
      return total + (numericPrice * item.qty);
    }, 0);
    return totalNum > 0 ? totalNum.toLocaleString('vi-VN') + 'đ' : '0đ';
  };

  const handleProcessToConfirm = () => {
    if (!username || username.trim().length < 10) {
      alert('Vui lòng nhập Số điện thoại đặt hàng!');
      return;
    }
    if (!customerInfo) {
      alert('Số điện thoại chưa đăng ký thành viên!');
      return;
    }
    setShowConfirm(true);
  };

  const handleOrderSubmit = async () => {
    const itemsString = cartArray.map(item => `${item.qty}x ${item.name}`).join(', ');
    const orderData = {
      phone: username.trim(),
      customer: customerInfo.name, 
      address: customerInfo.address || "Địa chỉ mặc định",
      items: itemsString,
      total: calculateTotal(),
      note: note.trim(),
    };

    try {
      const result = await createOrder(orderData);
      if (result.success) {
        // Cập nhật localStorage
        const updatedPhones = [username.trim(), ...recentPhones.filter(p => p !== username.trim())].slice(0, 3);
        localStorage.setItem('recentPhones', JSON.stringify(updatedPhones));
        localStorage.setItem('userProfile', JSON.stringify({
          fullName: customerInfo.name,
          address: customerInfo.address,
          phone: username.trim()
        }));

        setCart({});
        setShowConfirm(false);
        navigate(`/checkorder?user=${username.trim()}`);
      }
    } catch (error) {
      alert('Lỗi đặt hàng. Vui lòng thử lại!');
    }
  };

  const filteredMenu = menu.filter(item => item.category === activeTab);

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-blue-600"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-40 font-sans">
      {/* Header Tabs */}
      <div className="bg-white sticky top-0 z-30 shadow-sm border-b border-gray-100">
        <div className="px-6 py-5 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="p-2 bg-gray-50 rounded-2xl active:scale-90 transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h1 className="text-lg font-black text-gray-800 uppercase tracking-tighter">Thực đơn</h1>
          <div className="w-9"></div>
        </div>
        
        <div className="flex px-4 gap-2 pb-2">
          {[
            { id: 'MAIN', label: 'Món chính' },
            { id: 'SIDE', label: 'Món phụ' },
            { id: 'EXTRA', label: 'Ăn kèm' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-gray-400 bg-gray-50'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Thông tin khách hàng */}
      <div className="bg-white p-6 mb-4 rounded-b-[2.5rem] shadow-sm border-b border-gray-100">
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1 mb-3 block">Số điện thoại đặt hàng *</label>
        <input 
          type="tel" 
          value={username} 
          onChange={(e) => setUsername(e.target.value)} 
          placeholder="0333 xxx xxx" 
          className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none transition-all" 
        />
        
        {customerInfo && (
          <div className="mt-4 p-4 bg-blue-50 rounded-[1.5rem] border border-blue-100 animate-in fade-in duration-500">
            <div className="text-xs font-black text-blue-700 uppercase tracking-tight">Chào {customerInfo.name}!</div>
            <div className="text-[10px] text-blue-500 font-bold mt-1 uppercase italic tracking-tighter opacity-70">📍 {customerInfo.address}</div>
          </div>
        )}
      </div>

      {/* Danh sách món ăn */}
      <div className="px-4 space-y-4">
        {filteredMenu.map(item => (
          <div key={item.id} className="bg-white p-4 rounded-[2rem] flex items-center gap-4 shadow-sm border border-gray-50 transition-all active:scale-[0.98]">
            <img src={item.image || 'https://via.placeholder.com/150'} className="w-24 h-24 rounded-[1.5rem] object-cover shadow-md" alt={item.name} />
            <div className="flex-1">
              <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight leading-tight">{item.name}</h3>
              <p className="text-[10px] text-gray-400 font-bold mt-1 line-clamp-2">{item.description}</p>
              <p className="text-base font-black text-red-500 mt-2 tracking-tighter">{item.price}</p>
            </div>
            
            <div className="flex flex-col items-center gap-2 bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
              <button onClick={() => updateQuantity(item, 1)} className="w-10 h-10 flex items-center justify-center bg-blue-600 rounded-xl text-white text-xl font-black shadow-lg">+</button>
              <span className="text-xs font-black py-1">{cart[item.id]?.qty || 0}</span>
              <button onClick={() => updateQuantity(item, -1)} className="w-10 h-10 flex items-center justify-center bg-white rounded-xl text-gray-400 text-xl font-black border border-gray-200">-</button>
            </div>
          </div>
        ))}
      </div>

      {/* Thanh Giỏ hàng nổi */}
      {totalItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/90 backdrop-blur-xl border-t border-gray-100 z-40 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] rounded-t-[2.5rem] animate-in slide-in-from-bottom-10">
          <div className="mb-4">
             <textarea 
               value={note} 
               onChange={(e) => setNote(e.target.value)} 
               placeholder="Ghi chú (VD: Không hành, nhiều ớt...)" 
               className="w-full p-4 text-xs bg-gray-50 border-none rounded-2xl focus:ring-1 focus:ring-blue-500 outline-none font-bold" 
               rows="1" 
             />
          </div>
          <button 
            onClick={handleProcessToConfirm} 
            className="w-full bg-blue-600 text-white font-black py-5 rounded-[2rem] flex items-center justify-between px-8 active:scale-95 transition-all shadow-2xl shadow-blue-200"
          >
            <span className="text-[10px] uppercase tracking-[0.2em]">{totalItems} món đã chọn</span>
            <span className="text-xs font-black uppercase tracking-widest">Tiếp tục →</span>
          </button>
        </div>
      )}

      {/* POPUP XÁC NHẬN */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in fade-in slide-in-from-bottom-10">
            <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter mb-1">Xác nhận món</h2>
            <p className="text-[10px] text-gray-400 mb-6 font-black uppercase tracking-widest">Kiểm tra kỹ trước khi báo bếp</p>
            
            <div className="max-h-60 overflow-y-auto space-y-3 mb-6 pr-2 border-b border-dashed pb-6">
              {cartArray.map(item => (
                <div key={item.id} className="flex justify-between items-center text-sm">
                  <span className="font-bold text-gray-600"><span className="text-blue-600 font-black">{item.qty}x</span> {item.name}</span>
                  <span className="font-black text-gray-800">{item.price}</span>
                </div>
              ))}
            </div>

            <div className="py-2 mb-8 flex justify-between items-center">
              <span className="text-[10px] font-black text-gray-300 uppercase tracking-[0.3em]">Tổng tiền:</span>
              <span className="text-3xl font-black text-red-500 tracking-tighter">{calculateTotal()}</span>
            </div>

            <div className="flex gap-4">
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 rounded-2xl hover:bg-gray-100">Quay lại</button>
              <button onClick={handleOrderSubmit} className="flex-[2] py-5 bg-blue-600 text-white text-[10px] font-black rounded-2xl shadow-xl shadow-blue-100 active:scale-95 transition-all uppercase tracking-[0.2em]">Đặt ngay</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Order;