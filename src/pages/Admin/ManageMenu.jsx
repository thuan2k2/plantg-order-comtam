import React, { useState, useEffect } from 'react';
import { subscribeToMenu, addMenuItem, updateMenuItem, deleteMenuItem, uploadImage } from '../../services/menuService';

const ManageMenu = () => {
  const [menuItems, setMenuItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null); 
  
  const [imageFile, setImageFile] = useState(null); 
  const [previewUrl, setPreviewUrl] = useState(''); 

  // BỔ SUNG: State cho tìm kiếm và lọc
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');

  const [formData, setFormData] = useState({
    name: '',
    price: '',
    description: '',
    category: 'MAIN', // Mặc định là món chính
    isAvailable: true,
    image: '' 
  });

  // CẬP NHẬT: Sử dụng subscribeToMenu để cập nhật Real-time
  useEffect(() => {
    const unsubscribe = subscribeToMenu((data) => {
      setMenuItems(data);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // LOGIC LỌC VÀ TÌM KIẾM NHANH
  const filteredDisplayItems = menuItems.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategory = filterCategory === 'ALL' || item.category === filterCategory;
    return matchSearch && matchCategory;
  });

  const handleAddNew = () => {
    setEditingItem(null);
    setImageFile(null);
    setPreviewUrl('');
    setFormData({ name: '', price: '', description: '', category: 'MAIN', isAvailable: true, image: '' });
    setIsModalOpen(true);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setImageFile(null);
    setPreviewUrl(item.image || '');
    setFormData({ 
      name: item.name, 
      price: item.price, 
      description: item.description, 
      category: item.category || 'MAIN',
      isAvailable: item.isAvailable,
      image: item.image || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Xoá món "${name}" khỏi thực đơn?`)) {
      await deleteMenuItem(id);
    }
  };

  const toggleAvailability = async (item) => {
    await updateMenuItem(item.id, { isAvailable: !item.isAvailable });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
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
      if (imageFile) {
        const uploadedUrl = await uploadImage(imageFile);
        if (uploadedUrl) finalImageUrl = uploadedUrl;
      }

      const saveData = { ...formData, image: finalImageUrl };

      if (editingItem) {
        await updateMenuItem(editingItem.id, saveData);
      } else {
        await addMenuItem(saveData);
      }
      setIsModalOpen(false);
    } catch (error) {
      alert("Đã có lỗi xảy ra khi lưu món ăn.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="p-20 text-center text-gray-400 animate-pulse">Đang tải thực đơn...</div>;

  return (
    <div className="space-y-6">
      {/* Header & Thanh công cụ tìm kiếm */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Thực đơn hệ thống</h2>
          <button onClick={handleAddNew} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">
            + Thêm món mới
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <input 
              type="text" 
              placeholder="Tìm tên món nhanh..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <svg className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <select 
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-gray-50 border-none rounded-xl px-4 py-2.5 text-sm font-bold text-gray-600 outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">Tất cả loại</option>
            <option value="MAIN">Món chính</option>
            <option value="SIDE">Món phụ</option>
            <option value="EXTRA">Ăn kèm</option>
          </select>
        </div>
      </div>

      {/* Bảng danh sách */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 text-gray-400 text-[10px] font-black uppercase tracking-widest border-b border-gray-50">
                <th className="px-6 py-4">Món ăn</th>
                <th className="px-6 py-4">Loại</th>
                <th className="px-6 py-4">Giá</th>
                <th className="px-6 py-4 text-center">Bán / Hết</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredDisplayItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 flex items-center gap-4">
                    <img src={item.image || 'https://via.placeholder.com/50'} className="w-12 h-12 object-cover rounded-xl shadow-sm" />
                    <div>
                      <p className={`text-sm font-bold ${item.isAvailable ? 'text-gray-800' : 'text-gray-300'}`}>{item.name}</p>
                      <p className="text-[10px] text-gray-400 line-clamp-1">{item.description}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-black uppercase px-2 py-1 bg-gray-100 rounded-md text-gray-500">
                      {item.category === 'MAIN' ? 'Chính' : item.category === 'SIDE' ? 'Phụ' : 'Kèm'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-black text-red-500">{item.price}</td>
                  <td className="px-6 py-4 text-center">
                    <button onClick={() => toggleAvailability(item)} className={`w-10 h-5 rounded-full relative transition-all ${item.isAvailable ? 'bg-green-500' : 'bg-gray-300'}`}>
                      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${item.isAvailable ? 'right-1' : 'left-1'}`}></div>
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button onClick={() => handleEdit(item)} className="p-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
                    <button onClick={() => handleDelete(item.id, item.name)} className="p-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
            <div className="px-8 py-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
              <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">{editingItem ? 'Sửa món ăn' : 'Thêm món mới'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            
            <form onSubmit={handleSave} className="p-8 space-y-5">
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 border-2 border-dashed border-gray-200 rounded-3xl overflow-hidden flex items-center justify-center bg-gray-50 relative group">
                  {previewUrl ? <img src={previewUrl} className="w-full h-full object-cover" /> : <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                  <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                </div>
                <div className="flex-1 space-y-3">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Loại món ăn</label>
                  <select 
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-2.5 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="MAIN">Món chính</option>
                    <option value="SIDE">Món phụ</option>
                    <option value="EXTRA">Ăn kèm</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="Tên món ăn *" className="w-full bg-gray-50 border-none rounded-xl px-5 py-3.5 text-sm font-bold focus:ring-2 focus:ring-blue-500" />
                <input type="text" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} placeholder="Giá (VD: 35.000đ) *" className="w-full bg-gray-50 border-none rounded-xl px-5 py-3.5 text-sm font-bold focus:ring-2 focus:ring-blue-500" />
                <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} placeholder="Mô tả món..." className="w-full bg-gray-50 border-none rounded-xl px-5 py-3.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 h-24 resize-none" />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Huỷ bỏ</button>
                <button type="submit" disabled={isSubmitting} className="flex-[2] bg-blue-600 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-100 active:scale-95 disabled:bg-gray-300">
                  {isSubmitting ? 'Đang xử lý...' : (editingItem ? 'Lưu thay đổi' : 'Xác nhận thêm')}
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