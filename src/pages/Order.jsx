import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MenuItem from '../components/MenuItem';
import { createOrder } from '../services/orderService';

// Dữ liệu mẫu trích xuất trực tiếp từ hình ảnh thực đơn của bạn
const mockMenu = [
  { id: 1, name: 'Cơm Gà KATSU Phủ Trứng (sốt STAMINA)', price: '70,000đ', description: 'Gà giòn tan - mọng nước. Cơm phủ trứng béo ngậy. Sốt STAMINA thơmmm ngon.' },
  { id: 2, name: 'Cơm Gà KATSUDON (sốt STAMINA)', price: '60,000đ', description: 'Gà giòn tan - mọng nước. Sốt STAMINA - Sốt Tokyo Garlic BBQ thơmmm.' },
  { id: 3, name: 'Hương Nhài Dẻ Cười', price: '2 giá', description: 'Trà thanh – kem bùi – vị dịu dàng khó quên.' },
  { id: 4, name: 'Sakura Hồng Sữa Dẻ Cười', price: '2 giá', description: '' },
  { id: 5, name: 'Sakura Hồng Sữa', price: '2 giá', description: 'Hồng trà sữa Sakura (hoa anh đào)' },
  { id: 6, name: 'Sakura Cream Frappe', price: '57,000đ', description: 'Hương hoa anh đào thanh ngọt, mát lạnh và nhẹ nhàng – như một mùa xuân Nhật Bản trong từng ngụm.' }
];

const Order = () => {
  const { username: routeUsername } = useParams();
  const navigate = useNavigate();
  
  // State quản lý dữ liệu
  const [username, setUsername] = useState(routeUsername || '');
  const [customerInfo, setCustomerInfo] = useState(null);
  const [cart, setCart] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Mô phỏng việc gọi API kiểm tra Username (SĐT)
  useEffect(() => {
    if (username && username.length >= 10) {
      // TODO: Thay thế bằng logic gọi Firebase lấy thông tin khách thật
      // Ví dụ giả lập: Nếu nhập đủ số, coi như khách cũ
      setCustomerInfo({ name: 'Khách Hàng', phone: username, address: 'Phân khu Origami, Vinhomes' });
    } else {
      setCustomerInfo(null);
    }
  }, [username]);

  const handleAddToCart = (item) => {
    setCart([...cart, item]);
  };

  const handleOrderSubmit = async () => {
    if (!username) {
      alert('Vui lòng nhập Username (SĐT) trước khi đặt hàng!');
      return;
    }

    if (cart.length === 0) {
      alert('Giỏ hàng của bạn đang trống!');
      return;
    }

    // 1. Chuyển đổi giỏ hàng thành chuỗi văn bản để dễ lưu trữ và hiển thị 
    // VD: "2x Cơm Gà KATSU, 1x Sakura Hồng Sữa"
    const groupedItems = cart.reduce((acc, item) => {
      acc[item.name] = (acc[item.name] || 0) + 1;
      return acc;
    }, {});
    const itemsString = Object.entries(groupedItems)
      .map(([name, qty]) => `${qty}x ${name}`)
      .join(', ');

    // 2. Tính tổng tiền
    const calculateTotal = () => {
      const totalNum = cart.reduce((total, item) => {
        if (item.price === '2 giá') return total; 
        const numericPrice = parseInt(item.price.replace(/\D/g, ''), 10) || 0;
        return total + numericPrice;
      }, 0);
      return totalNum > 0 ? totalNum.toLocaleString('vi-VN') + 'đ' : '2 giá';
    };

    // 3. Chuẩn bị dữ liệu để đẩy lên Firebase
    const orderData = {
      phone: username,
      customer: customerInfo?.name || 'Khách Vãng Lai', 
      address: customerInfo?.address || 'Chưa cập nhật địa chỉ',
      items: itemsString,
      total: calculateTotal(),
      // status và createdAt sẽ được service tự động thêm vào
    };

    try {
      // 4. Gọi API gửi đơn lên Firestore (Hàm này chạy bất đồng bộ)
      const result = await createOrder(orderData);

      if (result.success) {
        // Đặt hàng thành công: Xoá giỏ hàng và chuyển trang
        setCart([]);
        alert('Đặt hàng thành công!');
        navigate(`/checkorder?user=${username}`);
      } else {
        alert('Có lỗi xảy ra khi đặt hàng. Vui lòng thử lại sau.');
      }
    } catch (error) {
      console.error("Lỗi submit đơn: ", error);
      alert('Lỗi kết nối. Vui lòng kiểm tra lại mạng.');
    }
  };

  const filteredMenu = mockMenu.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Header thanh điều hướng */}
      <div className="bg-white px-4 py-3 border-b flex items-center justify-between sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="text-gray-600 hover:bg-gray-100 p-1 rounded">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <h1 className="text-[16px] font-medium text-gray-800">Thực đơn</h1>
        <button className="text-gray-600 hover:bg-gray-100 p-1 rounded border border-gray-200">
           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Thanh tìm kiếm món */}
      <div className="bg-white p-3 border-b border-gray-100">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input 
            type="text" 
            placeholder="Tìm tên món" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 bg-gray-50/50"
          />
        </div>
      </div>

      {/* Khối khai báo Username */}
      <div className="bg-white p-4 shadow-[0_2px_4px_rgba(0,0,0,0.02)] border-b border-gray-100">
        <label className="block text-sm font-semibold text-gray-800 mb-2">
          Username (Số điện thoại) <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Nhập SĐT của bạn..."
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-800 focus:outline-none focus:border-[#007BFF] focus:ring-1 focus:ring-[#007BFF] transition-colors"
        />
        
        {/* Hiển thị thông tin khách nếu SĐT hợp lệ */}
        {customerInfo && (
          <div className="mt-3 p-3 bg-[#E8F4FD] border border-[#B8DAFF] rounded-lg">
            <p className="text-sm text-[#004085] font-semibold">Tên người nhận: {customerInfo.name}</p>
            <p className="text-[13px] text-[#004085] mt-1">Giao đến: {customerInfo.address}</p>
          </div>
        )}
        
        {/* Gợi ý đăng ký nếu SĐT có độ dài nhất định nhưng chưa tìm thấy (hiện tại giả lập độ dài < 10) */}
        {!customerInfo && username.length > 0 && username.length < 10 && (
          <p className="text-[13px] text-amber-600 mt-2">
            Nếu chưa có tài khoản, vui lòng <span onClick={() => navigate('/dangky')} className="text-blue-500 underline cursor-pointer font-medium">Đăng ký tại đây</span>.
          </p>
        )}
      </div>

      {/* Danh sách Thực Đơn */}
      <div className="bg-white">
        <div className="px-4 py-3 bg-[#F8F9FA] border-b border-gray-200">
          <h2 className="text-[14px] font-bold text-gray-800">Món mới ({filteredMenu.length})</h2>
        </div>
        <div className="flex flex-col">
          {filteredMenu.map(item => (
            <MenuItem 
              key={item.id}
              name={item.name}
              price={item.price}
              description={item.description}
              onAdd={() => handleAddToCart(item)}
            />
          ))}
          {filteredMenu.length === 0 && (
            <p className="text-center text-gray-500 py-8 text-sm">Không tìm thấy món ăn phù hợp.</p>
          )}
        </div>
      </div>

      {/* Nút Đặt Hàng cố định ở dưới cùng (Chỉ hiện khi có món trong giỏ) */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-[0_-4px_15px_-5px_rgba(0,0,0,0.1)] z-20">
          <button 
            onClick={handleOrderSubmit}
            className="w-full bg-[#007BFF] hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-between transition-colors shadow-md"
          >
            <span className="bg-white/20 px-3 py-1 rounded-md text-sm">{cart.length} món</span>
            <span>Tiến hành Đặt hàng</span>
            <span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

export default Order;