import React, { useState } from 'react';

// Dữ liệu mock ban đầu (Lấy theo đúng thực đơn của bạn)
const initialMenu = [
  { id: 1, name: 'Cơm Gà KATSU Phủ Trứng (sốt STAMINA)', price: '70,000đ', description: 'Gà giòn tan - mọng nước. Cơm phủ trứng béo ngậy. Sốt STAMINA.', isAvailable: true },
  { id: 2, name: 'Cơm Gà KATSUDON (sốt STAMINA)', price: '60,000đ', description: 'Gà giòn tan. Sốt STAMINA - Sốt Tokyo Garlic BBQ.', isAvailable: true },
  { id: 3, name: 'Hương Nhài Dẻ Cười', price: '2 giá', description: 'Trà thanh – kem bùi – vị dịu dàng khó quên.', isAvailable: true },
  { id: 4, name: 'Sakura Hồng Sữa Dẻ Cười', price: '2 giá', description: '', isAvailable: false }, // Ví dụ món đang tạm hết
  { id: 5, name: 'Sakura Hồng Sữa', price: '2 giá', description: 'Hồng trà sữa Sakura (hoa anh đào)', isAvailable: true },
  { id: 6, name: 'Sakura Cream Frappe', price: '57,000đ', description: 'Hương hoa anh đào thanh ngọt, mát lạnh và nhẹ nhàng.', isAvailable: true }
];

const ManageMenu = () => {
  const [menuItems, setMenuItems] = useState(initialMenu);
  
  // State quản lý Modal (Popup thêm/sửa món)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null); // null nghĩa là đang Thêm mới
  
  // State quản lý dữ liệu trong form
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    description: '',
    isAvailable: true
  });

  // Mở modal để Thêm mới
  const handleAddNew = () => {
    setEditingItem(null);
    setFormData({ name: '', price: '', description: '', isAvailable: true });
    setIsModalOpen(true);
  };

  // Mở modal để Sửa món có sẵn
  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({ 
      name: item.name, 
      price: item.price, 
      description: item.description, 
      isAvailable: item.isAvailable 
    });
    setIsModalOpen(true);
  };

  // Xử lý Xoá món
  const handleDelete = (id, name) => {
    if (window.confirm(`Bạn có chắc chắn muốn xoá món "${name}" khỏi thực đơn không?`)) {
      // TODO: Gọi API xoá khỏi Firebase
      setMenuItems(menuItems.filter(item => item.id !== id));
    }
  };

  // Xử lý đổi trạng thái Còn/Hết món nhanh (Không cần mở form)
  const toggleAvailability = (id) => {
    // TODO: Gọi API cập nhật Firebase
    setMenuItems(menuItems.map(item => 
      item.id === id ? { ...item, isAvailable: !item.isAvailable } : item
    ));
  };

  // Xử lý Lưu (Submit form Thêm/Sửa)
  const handleSave = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.price) {
      alert('Vui lòng nhập Tên món và Giá tiền!');
      return;
    }

    if (editingItem) {
      // Logic Sửa món
      setMenuItems(menuItems.map(item => 
        item.id === editingItem.id ? { ...item, ...formData } : item
      ));
    } else {
      // Logic Thêm món mới (Tạo ID giả lập)
      const newItem = {
        id: Date.now(),
        ...formData
      };
      setMenuItems([...menuItems, newItem]);
    }
    
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 relative">
      {/* Thanh công cụ phía trên */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Quản lý Thực đơn</h2>
          <p className="text-sm text-gray-500">Tổng cộng: {menuItems.length} món</p>
        </div>
        <button 
          onClick={handleAddNew}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Thêm món mới
        </button>
      </div>

      {/* Bảng danh sách món ăn */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-sm border-b border-gray-100">
                <th className="px-6 py-3 font-medium">Tên Món</th>
                <th className="px-6 py-3 font-medium w-32">Giá</th>
                <th className="px-6 py-3 font-medium text-center w-32">Trạng thái</th>
                <th className="px-6 py-3 font-medium text-right w-32">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {menuItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className={`font-medium ${item.isAvailable ? 'text-gray-800' : 'text-gray-400'}`}>
                      {item.name}
                    </p>
                    {item.description && (
                      <p className={`text-xs mt-1 line-clamp-1 ${item.isAvailable ? 'text-gray-500' : 'text-gray-400'}`}>
                        {item.description}
                      </p>
                    )}
                  </td>
                  <td className={`px-6 py-4 text-sm font-medium ${item.isAvailable ? 'text-gray-800' : 'text-gray-400'}`}>
                    {item.price}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button 
                      onClick={() => toggleAvailability(item.id)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        item.isAvailable 
                          ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' 
                          : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                      }`}
                    >
                      {item.isAvailable ? 'Đang bán' : 'Hết món'}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button 
                      onClick={() => handleEdit(item)}
                      className="text-blue-500 hover:text-blue-700 p-1 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
                      title="Chỉnh sửa"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button 
                      onClick={() => handleDelete(item.id, item.name)}
                      className="text-red-500 hover:text-red-700 p-1 bg-red-50 hover:bg-red-100 rounded transition-colors"
                      title="Xoá món"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form Thêm/Sửa Món */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-800">
                {editingItem ? 'Chỉnh sửa món ăn' : 'Thêm món mới'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Tên món <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
                  placeholder="VD: Cơm Gà Chiên Mắm"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Giá bán <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={formData.price}
                  onChange={(e) => setFormData({...formData, price: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
                  placeholder="VD: 55,000đ"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Mô tả chi tiết</label>
                <textarea 
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"
                  rows="3"
                  placeholder="Thành phần, hương vị..."
                ></textarea>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox" 
                  id="isAvailable"
                  checked={formData.isAvailable}
                  onChange={(e) => setFormData({...formData, isAvailable: e.target.checked})}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="isAvailable" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Món đang sẵn sàng phục vụ
                </label>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                >
                  Huỷ bỏ
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
                >
                  {editingItem ? 'Lưu thay đổi' : 'Thêm món'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageMenu;