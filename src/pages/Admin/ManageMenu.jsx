import React, { useState, useEffect } from 'react';
import { getMenu, addMenuItem, updateMenuItem, deleteMenuItem, uploadImage } from '../../services/menuService';

const ManageMenu = () => {
  const [menuItems, setMenuItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false); // Trạng thái khi đang upload/lưu
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null); 
  
  const [imageFile, setImageFile] = useState(null); // Lưu file ảnh được chọn
  const [previewUrl, setPreviewUrl] = useState(''); // Lưu link ảnh xem trước

  const [formData, setFormData] = useState({
    name: '',
    price: '',
    description: '',
    isAvailable: true,
    image: '' // Link ảnh từ Storage
  });

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
    setImageFile(null);
    setPreviewUrl('');
    setFormData({ name: '', price: '', description: '', isAvailable: true, image: '' });
    setIsModalOpen(true);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setImageFile(null);
    setPreviewUrl(item.image || ''); // Hiển thị ảnh cũ nếu có
    setFormData({ 
      name: item.name, 
      price: item.price, 
      description: item.description, 
      isAvailable: item.isAvailable,
      image: item.image || ''
    });
    setIsModalOpen(true);
  };

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

  const toggleAvailability = async (item) => {
    const newStatus = !item.isAvailable;
    const result = await updateMenuItem(item.id, { isAvailable: newStatus });
    if (result.success) {
      setMenuItems(menuItems.map(i => 
        i.id === item.id ? { ...i, isAvailable: newStatus } : i
      ));
    }
  };

  // Xử lý chọn ảnh
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file)); // Tạo link xem trước tạm thời
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.price) {
      alert('Vui lòng nhập Tên món và Giá tiền!');
      return;
    }

    setIsSubmitting(true);
    let finalImageUrl = formData.image;

    try {
      // 1. Nếu có chọn file mới, upload lên Storage trước
      if (imageFile) {
        const uploadedUrl = await uploadImage(imageFile);
        if (uploadedUrl) {
          finalImageUrl = uploadedUrl;
        }
      }

      const saveDate = { ...formData, image: finalImageUrl };

      // 2. Lưu vào Firestore
      if (editingItem) {
        const result = await updateMenuItem(editingItem.id, saveDate);
        if (result.success) {
          setMenuItems(menuItems.map(item => 
            item.id === editingItem.id ? { ...item, ...saveDate } : item
          ));
        }
      } else {
        const result = await addMenuItem(saveDate);
        if (result.success) {
          setMenuItems([...menuItems, { id: result.id, ...saveDate }]);
        }
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error("Lỗi khi lưu:", error);
      alert("Đã có lỗi xảy ra khi lưu món ăn.");
    } finally {
      setIsSubmitting(false);
    }
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
                <th className="px-6 py-3 font-medium">Hình ảnh</th>
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
                    <img 
                      src={item.image || 'https://via.placeholder.com/50'} 
                      alt={item.name} 
                      className="w-12 h-12 object-cover rounded-lg border border-gray-100 shadow-sm"
                    />
                  </td>
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-800">
                {editingItem ? 'Chỉnh sửa món' : 'Thêm món mới'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {/* PHẦN CHỌN ẢNH */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Hình ảnh món ăn</label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 border-2 border-dashed border-gray-200 rounded-xl overflow-hidden flex items-center justify-center bg-gray-50">
                    {previewUrl ? (
                      <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    )}
                  </div>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleFileChange}
                    className="text-xs file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Tên món *</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:border-blue-500 outline-none"
                  placeholder="VD: Cơm Gà KATSU"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Giá tiền *</label>
                <input 
                  type="text" 
                  value={formData.price}
                  onChange={(e) => setFormData({...formData, price: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:border-blue-500 outline-none"
                  placeholder="VD: 70,000đ"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Mô tả món ăn</label>
                <textarea 
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:border-blue-500 outline-none resize-none"
                  rows="3"
                ></textarea>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="flex-1 bg-white border border-gray-300 py-2 rounded-lg text-sm font-semibold"
                >
                  Huỷ
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className={`flex-1 text-white py-2 rounded-lg font-semibold shadow-md transition-all ${isSubmitting ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  {isSubmitting ? 'Đang lưu...' : (editingItem ? 'Lưu thay đổi' : 'Thêm ngay')}
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