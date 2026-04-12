import React, { useMemo } from 'react';

const Cart = ({ isOpen, onClose, cartItems, onIncrease, onDecrease, onCheckout }) => {
  // Nhóm các món giống nhau lại và đếm số lượng
  const groupedItems = useMemo(() => {
    return cartItems.reduce((acc, item) => {
      const existingItem = acc.find(i => i.id === item.id);
      if (existingItem) {
        existingItem.quantity += 1;
      } else {
        acc.push({ ...item, quantity: 1 });
      }
      return acc;
    }, []);
  }, [cartItems]);

  // Tính tổng tiền (Loại bỏ các ký tự không phải số để tính toán)
  const calculateTotal = () => {
    return groupedItems.reduce((total, item) => {
      // Bỏ qua nếu giá là "2 giá" (hiện tại xử lý tạm là 0 hoặc cần logic riêng)
      if (item.price === '2 giá') return total; 
      const numericPrice = parseInt(item.price.replace(/\D/g, ''), 10) || 0;
      return total + (numericPrice * item.quantity);
    }, 0);
  };

  // Format số tiền thành chuỗi có dấu phẩy (VD: 140000 -> 140,000đ)
  const formatPrice = (price) => {
    return price.toLocaleString('vi-VN') + 'đ';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 transition-opacity">
      {/* Vùng nhấn bên ngoài để đóng giỏ hàng */}
      <div className="absolute inset-0" onClick={onClose}></div>

      {/* Bảng Giỏ hàng trượt từ dưới lên */}
      <div className="relative w-full max-w-lg bg-white rounded-t-2xl flex flex-col max-h-[85vh] animate-[slideUp_0.3s_ease-out]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">Giỏ hàng của bạn</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 bg-gray-50 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Danh sách món ăn (Có thể cuộn) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {groupedItems.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <p>Giỏ hàng đang trống.</p>
              <p className="text-sm mt-1">Hãy thêm vài món ngon nhé!</p>
            </div>
          ) : (
            groupedItems.map(item => (
              <div key={item.id} className="flex items-center justify-between">
                <div className="flex-1 pr-4">
                  <h3 className="text-sm font-semibold text-gray-800 leading-snug">{item.name}</h3>
                  <p className="text-sm text-blue-600 mt-0.5">{item.price}</p>
                </div>
                
                {/* Bộ điều khiển Số lượng (+ / -) */}
                <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-1 border border-gray-200">
                  <button 
                    onClick={() => onDecrease(item.id)}
                    className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-200 rounded-md transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
                    </svg>
                  </button>
                  <span className="text-sm font-semibold text-gray-800 w-4 text-center">
                    {item.quantity}
                  </span>
                  <button 
                    onClick={() => onIncrease(item)}
                    className="w-7 h-7 flex items-center justify-center text-blue-600 hover:bg-blue-100 rounded-md transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer: Tổng tiền & Nút Đặt hàng */}
        <div className="p-4 border-t border-gray-100 bg-white">
          <div className="flex justify-between items-center mb-4">
            <span className="text-gray-600 font-medium">Tổng cộng:</span>
            <span className="text-xl font-bold text-red-500">
              {formatPrice(calculateTotal())}
            </span>
          </div>
          
          <button 
            onClick={onCheckout}
            disabled={groupedItems.length === 0}
            className={`w-full py-3.5 px-4 rounded-xl font-semibold text-white transition-colors shadow-sm
              ${groupedItems.length === 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#007BFF] hover:bg-blue-600'}`}
          >
            Xác nhận Đặt hàng
          </button>
        </div>

      </div>
    </div>
  );
};

export default Cart;