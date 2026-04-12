import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import MenuItem from '../components/MenuItem';
import { createOrder } from '../services/orderService';
import { getUserByPhone } from '../services/authService'; 
import { getMenu } from '../services/menuService';       

const Order = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const initialUser = searchParams.get('user') || '';

  const [username, setUsername] = useState(initialUser);
  const [customerInfo, setCustomerInfo] = useState(null);
  const [menu, setMenu] = useState([]); 
  const [cart, setCart] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  // BỔ SUNG: State cho ghi chú và danh sách SĐT đã dùng
  const [note, setNote] = useState('');
  const [recentPhones, setRecentPhones] = useState([]);

  // 1. Lấy thực đơn & Danh sách SĐT cũ từ LocalStorage
  useEffect(() => {
    const fetchMenu = async () => {
      const data = await getMenu();
      setMenu(data);
      setIsLoading(false);
    };
    fetchMenu();

    // Lấy danh sách SĐT cũ để gợi ý
    const savedPhones = JSON.parse(localStorage.getItem('recentPhones') || '[]');
    setRecentPhones(savedPhones);
  }, []);

  // 2. Tự động tìm thông tin khách
  useEffect(() => {
    const fetchUser = async () => {
      if (username && username.length >= 10) {
        const userData = await getUserByPhone(username);
        if (userData) {
          setCustomerInfo({
            name: userData.fullName,
            phone: userData.username,
            address: userData.address
          });
        } else {
          setCustomerInfo(null);
        }
      } else {
        setCustomerInfo(null);
      }
    };

    const timer = setTimeout(() => {
      fetchUser();
    }, 500);

    return () => clearTimeout(timer);
  }, [username]);

  const handleAddToCart = (item) => {
    setCart([...cart, item]);
  };

  const handleOrderSubmit = async () => {
    if (!username || username.length < 10) {
      alert('Vui lòng nhập Username (Số điện thoại) hợp lệ!');
      return;
    }

    if (!customerInfo) {
      alert('Không tìm thấy thông tin thành viên. Vui lòng đăng ký trước khi đặt hàng!');
      navigate('/dangky');
      return;
    }

    if (cart.length === 0) {
      alert('Giỏ hàng của bạn đang trống!');
      return;
    }

    const groupedItems = cart.reduce((acc, item) => {
      acc[item.name] = (acc[item.name] || 0) + 1;
      return acc;
    }, {});
    
    const itemsString = Object.entries(groupedItems)
      .map(([name, qty]) => `${qty}x ${name}`)
      .join(', ');

    const calculateTotal = () => {
      const totalNum = cart.reduce((total, item) => {
        if (item.price === '2 giá') return total; 
        const numericPrice = parseInt(item.price.replace(/\D/g, ''), 10) || 0;
        return total + numericPrice;
      }, 0);
      return totalNum > 0 ? totalNum.toLocaleString('vi-VN') + 'đ' : 'Sẽ báo giá sau';
    };

    const orderData = {
      phone: username,
      customer: customerInfo.name, 
      address: customerInfo.address,
      items: itemsString,
      total: calculateTotal(),
      note: note.trim(), // BỔ SUNG: Gửi ghi chú lên Firebase
    };

    try {
      const result = await createOrder(orderData);

      if (result.success) {
        // BỔ SUNG: Lưu SĐT vào bộ nhớ tạm máy khách (tối đa 3 số gần nhất)
        const updatedPhones = [username, ...recentPhones.filter(p => p !== username)].slice(0, 3);
        localStorage.setItem('recentPhones', JSON.stringify(updatedPhones));

        setCart([]);
        alert('Đặt hàng thành công! Đơn hàng đã được gửi tới bếp.');
        navigate(`/checkorder?user=${username}`);
      } else {
        alert('Lỗi: ' + result.error);
      }
    } catch (error) {
      console.error("Lỗi submit đơn: ", error);
      alert('Lỗi kết nối Firebase.');
    }
  };

  const filteredMenu = menu.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Header */}
      <div className="bg-white px-4 py-3 border-b flex items-center justify-between sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="text-gray-600 hover:bg-gray-100 p-1 rounded">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <h1 className="text-[16px] font-bold text-gray-800">Thực đơn nhà Plant G</h1>
        <div className="w-8"></div>
      </div>

      {/* Tìm kiếm */}
      <div className="bg-white p-3 border-b border-gray-100">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input 
            type="text" 
            placeholder="Tìm món ngon..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 bg-gray-50/50"
          />
        </div>
      </div>

      {/* Thông tin khách & Gợi ý SĐT */}
      <div className="bg-white p-4 border-b border-gray-100">
        <label className="block text-sm font-semibold text-gray-800 mb-2">
          Username (Số điện thoại) <span className="text-red-500">*</span>
        </label>
        <input
          type="tel"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Nhập SĐT để nhận diện..."
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-800 focus:outline-none focus:border-[#007BFF] focus:ring-1 focus:ring-[#007BFF] transition-colors"
        />

        {/* BỔ SUNG: Gợi ý SĐT cũ */}
        {recentPhones.length > 0 && !customerInfo && (
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="text-[11px] text-gray-400 w-full font-bold uppercase tracking-widest">SĐT bạn đã dùng:</span>
            {recentPhones.map(p => (
              <button 
                key={p} 
                onClick={() => setUsername(p)}
                className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-full border border-blue-100 font-bold active:scale-95 transition-all"
              >
                {p}
              </button>
            ))}
          </div>
        )}
        
        {customerInfo ? (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800 font-bold">Chào {customerInfo.name}!</p>
            <p className="text-[13px] text-green-700 mt-1 italic">Địa chỉ: {customerInfo.address}</p>
          </div>
        ) : username.length >= 10 ? (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-700 font-medium">Bạn chưa đăng ký thành viên?</p>
            <button 
              onClick={() => navigate('/dangky')} 
              className="mt-1 text-sm text-blue-600 font-bold underline"
            >
              Đăng ký tài khoản ngay để đặt hàng
            </button>
          </div>
        ) : null}
      </div>

      {/* BỔ SUNG: Phần nhập Ghi chú */}
      <div className="bg-white p-4 border-b border-gray-100">
        <label className="block text-sm font-semibold text-gray-800 mb-2">Ghi chú cho quán (nếu có)</label>
        <textarea 
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ví dụ: Ít cơm, không lấy rau, thêm ớt..."
          className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500 bg-gray-50/30"
          rows="2"
        />
      </div>

      {/* Danh sách Thực Đơn */}
      <div className="bg-white">
        <div className="px-4 py-3 bg-[#F8F9FA] border-b border-gray-200 flex justify-between">
          <h2 className="text-[14px] font-bold text-gray-800 uppercase tracking-tight">Thực đơn hôm nay</h2>
          {isLoading && <span className="text-xs text-blue-500 animate-pulse">Đang tải...</span>}
        </div>
        
        <div className="flex flex-col">
          {filteredMenu.map(item => (
            <MenuItem 
              key={item.id}
              name={item.name}
              price={item.price}
              description={item.description}
              image={item.image}
              onAdd={() => handleAddToCart(item)}
            />
          ))}
          {!isLoading && filteredMenu.length === 0 && (
            <div className="py-20 text-center">
               <p className="text-gray-400 text-sm">Chưa có món ăn nào trong thực đơn.</p>
            </div>
          )}
        </div>
      </div>

      {/* Thanh Giỏ hàng nổi */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-[0_-4px_15px_-5px_rgba(0,0,0,0.1)] z-20">
          <button 
            onClick={handleOrderSubmit}
            className="w-full bg-[#007BFF] hover:bg-blue-600 text-white font-bold py-3.5 px-6 rounded-xl flex items-center justify-between transition-all transform active:scale-95"
          >
            <span className="bg-white/20 px-3 py-1 rounded-lg text-sm">{cart.length} món</span>
            <span>GỬI ĐƠN HÀNG</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

export default Order;