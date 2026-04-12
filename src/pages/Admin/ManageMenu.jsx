import React, { useState, useEffect } from 'react';
import { getMenu, addMenuItem, updateMenuItem, deleteMenuItem } from '../../services/menuService';

const ManageMenu = () => {
  const [menuItems, setMenuItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // State quản lý Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null); 
  
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    description: '',
    isAvailable: true
  });

  // 1. Tải thực đơn từ Firebase khi mở trang
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    const data = await getMenu();
    setMenuItems(data);
    setIsLoading(false);
  };

  const handleAddNew = () => {
    setEditingItem(null);
    setFormData({ name: '', price: '', description: '', isAvailable: true });
    setIsModalOpen(true);
  };

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

  // 2. Xử lý Xoá món thật trên Firebase
  const handleDelete = async (id, name) => {
    if (window.confirm(`Bạn có chắc chắn muốn xoá món "${name}" khỏi thực đơn không?`)) {
      const result = await deleteMenuItem(id);
      if (result.success) {
        setMenuItems(menuItems.filter(item => item.id !== id));
      } else {
        alert("Lỗi khi xoá món: " + result.error);
      }
    }
  };

  // 3. Xử lý đổi trạng thái nhanh
  const toggleAvailability = async (item) => {
    const newStatus = !item.isAvailable;
    const result = await updateMenuItem(item.id, { isAvailable: newStatus });
    if (result.success) {
      setMenuItems(menuItems.map(i => 
        i.id === item.id ? { ...i, isAvailable: newStatus } : i
      ));
    }
  };

  // 4. Xử lý Lưu (Thêm/Sửa) vào Firestore
  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.price) {
      alert('Vui lòng nhập Tên món và Giá tiền!');
      return;
    }

    if (editingItem) {
      // Logic Sửa món
      const result = await updateMenuItem(editingItem.id, formData);
      if (result.success) {
        setMenuItems(menuItems.map(item => 
          item.id === editingItem.id ? { ...item, ...formData } : item
        ));
      }
    } else {
      // Logic Thêm món mới
      const result = await addMenuItem(formData);
      if (result.success) {
        // Thêm vào state cục bộ để UI cập nhật ngay mà không cần reload
        setMenuItems([...menuItems, { id: result.id, ...formData }]);
      }
    }
    
    setIsModalOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
        <p className="text-sm">Đang tải thực đơn...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
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
                      onClick={() => toggleAvailability(item)}
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
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button 
                      onClick={() => handleDelete(item.id, item.name)}
                      className="text-red-500 hover:text-red-700 p-1 bg-red-50 hover:bg-red-100 rounded transition-colors"
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

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold">
                {editingItem ? 'Chỉnh sửa món' : 'Thêm món mới'}
              </h3>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Tên món *</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full border rounded-lg px-4 py-2 text-sm focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Giá bán *</label>
                <input 
                  type="text" 
                  value={formData.price}
                  onChange={(e) => setFormData({...formData, price: e.target.value})}
                  className="w-full border rounded-lg px-4 py-2 text-sm focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Mô tả</label>
                <textarea 
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full border rounded-lg px-4 py-2 text-sm focus:border-blue-500 outline-none resize-none"
                  rows="3"
                ></textarea>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 border py-2 rounded-lg">Huỷ</button>
                <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-semibold">Lưu</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageMenu;