import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import MenuItem from '../components/MenuItem';
import { createOrder } from '../services/orderService';
import { getUserByPhone } from '../services/authService'; 
import { getMenu, subscribeToMenu } from '../services/menuService';       

const Order = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialUser = searchParams.get('user') || '';

  const [username, setUsername] = useState(initialUser);
  const [customerInfo, setCustomerInfo] = useState(null);
  const [menu, setMenu] = useState([]); 
  const [cart, setCart] = useState({}); // Quản lý giỏ hàng bằng Object { id: {item, qty} }
  const [searchQuery, setSearchQuery] = useState('');
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

    return () => unsubscribe();
  }, []);

  // 2. Tự động tìm thông tin khách
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

  // Logic cập nhật số lượng món
  const updateQuantity = (item, delta) => {
    setCart(prev => {
      const currentItem = prev[item.id];
      const newQty = (currentItem ? currentItem.qty : 0) + delta;

      if (newQty <= 0) {
        const { [item.id]: removed, ...rest } = prev;
        return rest;
      }

      return {
        ...prev,
        [item.id]: { ...item, qty: newQty }
      };
    });
  };

  const cartArray = Object.values(cart);
  const totalItems = cartArray.reduce((sum, item) => sum + item.qty, 0);

  const calculateTotal = () => {
    const totalNum = cartArray.reduce((total, item) => {
      const numericPrice = parseInt(item.price.replace(/\D/g, ''), 10) || 0;
      return total + (numericPrice * item.qty);
    }, 0);
    return totalNum > 0 ? totalNum.toLocaleString('vi-VN') + 'đ' : 'Sẽ báo giá sau';
  };

  // --- BỔ SUNG: Kiểm tra điều kiện trước khi hiện Popup xác nhận ---
  const handleProcessToConfirm = () => {
    if (!username || username.trim().length < 10) {
      alert('Vui lòng nhập Số điện thoại đặt hàng trước khi tiếp tục!');
      window.scrollTo({ top: 0, behavior: 'smooth' }); // Cuộn lên để khách thấy ô nhập SĐT
      return;
    }

    if (!customerInfo) {
      alert('Số điện thoại này chưa đăng ký thành viên hoặc không tồn tại. Vui lòng kiểm tra lại hoặc Đăng ký tài khoản mới!');
      return;
    }

    setShowConfirm(true);
  };

  const handleOrderSubmit = async () => {
    // Chống lỗi "name of null" - Phòng thủ lớp 2
    if (!customerInfo?.name) {
      alert('Lỗi dữ liệu khách hàng. Vui lòng kiểm tra lại SĐT!');
      setShowConfirm(false);
      return;
    }

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
        const updatedPhones = [username.trim(), ...recentPhones.filter(p => p !== username.trim())].slice(0, 3);
        localStorage.setItem('recentPhones', JSON.stringify(updatedPhones));
        
        // Cập nhật profile để các trang sau tự nhận diện
        localStorage.setItem('userProfile', JSON.stringify({
          fullName: customerInfo.name,
          address: customerInfo.address,
          phone: username.trim()
        }));

        setCart({});
        setShowConfirm(false);
        alert('Đặt hàng thành công!');
        navigate(`/checkorder?user=${username.trim()}`);
      }
    } catch (error) {
      alert('Lỗi kết nối Firebase. Vui lòng thử lại!');
    }
  };

  const filteredMenu = menu.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    item.category === activeTab
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header & Tìm kiếm */}
      <div className="bg-white sticky top-0 z-30 shadow-sm">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="p-1 text-gray-600"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg></button>
          <h1 className="text-sm font-black text-gray-800 uppercase">Thực đơn nhà Plant G</h1>
          <div className="w-8"></div>
        </div>
        
        <div className="flex border-b">
          {[
            { id: 'MAIN', label: 'Món chính' },
            { id: 'SIDE', label: 'Món phụ' },
            { id: 'EXTRA', label: 'Ăn kèm' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Thông tin khách */}
      <div className="bg-white p-4 mb-2">
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-2 block">Username (Số điện thoại) *</label>
        <input type="tel" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Nhập SĐT để nhận diện..." className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-blue-500 outline-none transition-all" />
        
        {recentPhones.length > 0 && !customerInfo && (
          <div className="flex flex-wrap gap-2 mt-2">
            {recentPhones.map(p => <button key={p} onClick={() => setUsername(p)} className="text-[10px] bg-blue-50 text-blue-600 px-3 py-1 rounded-full font-bold active:scale-95 transition-all">{p}</button>)}
          </div>
        )}
        
        {customerInfo && (
          <div className="mt-3 p-3 bg-green-50 rounded-xl border border-green-100">
            <div className="text-xs font-bold text-green-700">Chào {customerInfo.name}!</div>
            <div className="text-[10px] text-green-600 italic">Giao đến: {customerInfo.address}</div>
          </div>
        )}
      </div>

      {/* Danh sách món ăn */}
      <div className="space-y-1">
        {filteredMenu.map(item => (
          <div key={item.id} className="bg-white px-4 py-3 flex items-center gap-4 border-b border-gray-50">
            <img src={item.image || 'https://via.placeholder.com/150'} className="w-20 h-20 rounded-2xl object-cover shadow-sm" alt={item.name} />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-gray-800">{item.name}</h3>
              <p className="text-xs text-gray-400 line-clamp-1 mb-1">{item.description}</p>
              <p className="text-sm font-black text-red-500">{item.price}</p>
            </div>
            
            <div className="flex items-center gap-3 bg-gray-100 p-1 rounded-xl">
              <button onClick={() => updateQuantity(item, -1)} className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-lg font-bold">-</button>
              <span className="w-4 text-center text-sm font-black">{cart[item.id]?.qty || 0}</span>
              <button onClick={() => updateQuantity(item, 1)} className="w-8 h-8 flex items-center justify-center bg-blue-600 rounded-lg shadow-sm text-white text-lg font-bold">+</button>
            </div>
          </div>
        ))}
      </div>

      {/* Thanh Giỏ hàng nổi */}
      {totalItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-gray-100 z-40 shadow-2xl">
          <div className="mb-3 px-1">
             <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú yêu cầu món (VD: không hành, nhiều ớt...)" className="w-full p-3 text-xs bg-gray-50 border-none rounded-xl focus:ring-1 focus:ring-blue-500" rows="1" />
          </div>
          <button 
            onClick={handleProcessToConfirm} 
            className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl flex items-center justify-between px-6 active:scale-95 transition-all shadow-xl shadow-blue-200"
          >
            <span className="text-xs uppercase tracking-widest">{totalItems} món đã chọn</span>
            <span>TIẾP TỤC →</span>
          </button>
        </div>
      )}

      {/* POPUP XÁC NHẬN ĐƠN HÀNG */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl animate-in fade-in slide-in-from-bottom-10 duration-300">
            <h2 className="text-lg font-black text-gray-800 uppercase tracking-tighter mb-2">Kiểm tra lại đơn hàng</h2>
            <p className="text-xs text-gray-400 mb-6 font-medium">Bạn vui lòng kiểm tra kỹ danh sách món và địa chỉ giao hàng.</p>
            
            <div className="max-h-60 overflow-y-auto space-y-3 mb-6 pr-2 custom-scrollbar border-b border-dashed pb-4">
              {cartArray.map(item => (
                <div key={item.id} className="flex justify-between items-center text-sm">
                  <span className="font-medium text-gray-600"><span className="font-black text-blue-600">{item.qty}x</span> {item.name}</span>
                  <span className="font-bold text-gray-800">{item.price}</span>
                </div>
              ))}
              {note && (
                <div className="p-3 bg-yellow-50 rounded-xl text-[11px] italic text-yellow-700 border border-yellow-100 mt-2">
                  <span className="font-black not-italic uppercase text-[9px] block mb-1">Ghi chú của bạn:</span>
                  " {note} "
                </div>
              )}
            </div>

            <div className="py-4 mb-6 flex justify-between items-center">
              <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Tổng cộng:</span>
              <span className="text-2xl font-black text-red-500">{calculateTotal()}</span>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-4 text-sm font-bold text-gray-400 hover:bg-gray-50 rounded-2xl transition-all">QUAY LẠI</button>
              <button onClick={handleOrderSubmit} className="flex-[2] py-4 bg-blue-600 text-white text-sm font-black rounded-2xl shadow-lg shadow-blue-200 active:scale-95 transition-all uppercase tracking-widest">Xác nhận đặt ngay</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Order;