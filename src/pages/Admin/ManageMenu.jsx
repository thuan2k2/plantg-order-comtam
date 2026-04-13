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

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');

  const [formData, setFormData] = useState({
    name: '',
    price: '',
    description: '',
    category: 'MAIN',
    isAvailable: true,
    image: '',
    maxQty: 10 // CƠ CHẾ MỚI: Mặc định tối đa 10 phần/đơn
  });

  useEffect(() => {
    const unsubscribe = subscribeToMenu((data) => {
      setMenuItems(data);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredDisplayItems = menuItems.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategory = filterCategory === 'ALL' || item.category === filterCategory;
    return matchSearch && matchCategory;
  });

  const handleAddNew = () => {
    setEditingItem(null);
    setImageFile(null);
    setPreviewUrl('');
    setFormData({ name: '', price: '', description: '', category: 'MAIN', isAvailable: true, image: '', maxQty: 10 });
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
      image: item.image || '',
      maxQty: item.maxQty || 10 // Cập nhật từ Firebase
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

  if (isLoading) return <div className="p-20 text-center text-gray-400 animate-pulse font-black uppercase tracking-widest text-xs">Đang đồng bộ thực đơn...</div>;

  return (
    <div className="space-y-6">
      {/* Header & Search */}
      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-5">
        <div className="flex justify-between items-center px-2">
          <div>
            <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Thực đơn hệ thống</h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Cấu hình món ăn & Giới hạn mua</p>
          </div>
          <button onClick={handleAddNew} className="bg-blue-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-blue-100 active:scale-95 transition-all">
            + Thêm món
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <input 
              type="text" 
              placeholder="Tìm tên món ăn..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none transition-all"
            />
            <svg className="w-5 h-5 absolute left-4 top-3.5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <select 
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-gray-50 border-none rounded-2xl px-6 py-3.5 text-sm font-black text-gray-500 outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
          >
            <option value="ALL">TẤT CẢ LOẠI</option>
            <option value="MAIN">MÓN CHÍNH</option>
            <option value="SIDE">MÓN PHỤ</option>
            <option value="EXTRA">ĂN KÈM</option>
          </select>
        </div>
      </div>

      {/* Bảng danh sách */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 text-gray-400 text-[10px] font-black uppercase tracking-[0.2em] border-b border-gray-50">
                <th className="px-8 py-5">Sản phẩm</th>
                <th className="px-8 py-5">Phân loại</th>
                <th className="px-8 py-5">Giá bán</th>
                <th className="px-8 py-5 text-center">Giới hạn</th>
                <th className="px-8 py-5 text-center">Trạng thái</th>
                <th className="px-8 py-5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredDisplayItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/30 transition-colors group">
                  <td className="px-8 py-5 flex items-center gap-4">
                    <img src={item.image || 'https://via.placeholder.com/50'} className="w-14 h-14 object-cover rounded-2xl shadow-md border-2 border-white" />
                    <div>
                      <p className={`text-sm font-black uppercase tracking-tight ${item.isAvailable ? 'text-gray-800' : 'text-gray-300'}`}>{item.name}</p>
                      <p className="text-[10px] text-gray-400 font-medium line-clamp-1 italic mt-0.5">{item.description || 'Chưa có mô tả'}</p>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-[9px] font-black uppercase px-3 py-1.5 bg-gray-100 rounded-xl text-gray-500 tracking-widest">
                      {item.category === 'MAIN' ? 'Chính' : item.category === 'SIDE' ? 'Phụ' : 'Kèm'}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-sm font-black text-red-500 tracking-tighter">{item.price}</td>
                  
                  {/* HIỂN THỊ GIỚI HẠN MỚI */}
                  <td className="px-8 py-5 text-center">
                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-lg border border-blue-100">
                      Tối đa {item.maxQty || 10}
                    </span>
                  </td>

                  <td className="px-8 py-5 text-center">
                    <button onClick={() => toggleAvailability(item)} className={`w-11 h-6 rounded-full relative transition-all ${item.isAvailable ? 'bg-green-500' : 'bg-gray-200'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${item.isAvailable ? 'right-1' : 'left-1'}`}></div>
                    </button>
                  </td>
                  <td className="px-8 py-5 text-right space-x-2">
                    <button onClick={() => handleEdit(item)} className="p-3 text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-600 hover:text-white transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
                    <button onClick={() => handleDelete(item.id, item.name)} className="p-3 text-red-600 bg-red-50 rounded-xl hover:bg-red-600 hover:text-white transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form - Nâng cấp Bo góc 2.5rem */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-300">
            <div className="px-10 py-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                <h3 className="text-base font-black text-gray-800 uppercase tracking-widest">{editingItem ? 'Cập nhật món ăn' : 'Tạo món mới'}</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Hệ thống thực đơn Plant G</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 flex items-center justify-center bg-white rounded-full text-gray-400 hover:text-red-500 shadow-sm transition-all">&times;</button>
            </div>
            
            <form onSubmit={handleSave} className="p-10 space-y-6">
              <div className="flex items-center gap-8">
                <div className="w-32 h-32 border-2 border-dashed border-gray-200 rounded-[2rem] overflow-hidden flex flex-col items-center justify-center bg-gray-50 relative group cursor-pointer">
                  {previewUrl ? <img src={previewUrl} className="w-full h-full object-cover" /> : (
                    <div className="text-center">
                       <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                       <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Ảnh món ăn</p>
                    </div>
                  )}
                  <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">Danh mục</label>
                    <select 
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="MAIN">Món chính</option>
                      <option value="SIDE">Món phụ</option>
                      <option value="EXTRA">Ăn kèm</option>
                    </select>
                  </div>
                  
                  {/* Ô NHẬP GIỚI HẠN MỚI TRONG MODAL */}
                  <div>
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">Giới hạn mua/đơn</label>
                    <input 
                      type="number" 
                      min="1"
                      value={formData.maxQty} 
                      onChange={(e) => setFormData({...formData, maxQty: parseInt(e.target.value) || 1})} 
                      placeholder="Mặc định: 10" 
                      className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm font-bold text-blue-600 focus:ring-2 focus:ring-blue-500" 
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="Tên món ăn *" className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 text-sm font-black tracking-tight focus:ring-2 focus:ring-blue-500" />
                <input type="text" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} placeholder="Giá tiền (VD: 35.000đ) *" className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 text-sm font-black text-red-500 focus:ring-2 focus:ring-blue-500" />
                <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} placeholder="Mô tả nguyên liệu, hương vị..." className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 text-sm font-medium focus:ring-2 focus:ring-blue-500 h-24 resize-none" />
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Hủy</button>
                <button type="submit" disabled={isSubmitting} className="flex-[2] bg-blue-600 text-white py-5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-100 active:scale-95 disabled:bg-gray-300">
                  {isSubmitting ? 'ĐANG LƯU...' : (editingItem ? 'LƯU THAY ĐỔI' : 'XÁC NHẬN THÊM')}
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