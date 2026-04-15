import React, { useState, useEffect } from 'react';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config'; // Kiểm tra lại đường dẫn tới file config của bạn

const ManageCommunication = () => {
  const [activeTab, setActiveTab] = useState('NOTIF'); // 'NOTIF' | 'MAIL'
  const [items, setItems] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Trạng thái Form
  const [formData, setFormData] = useState({
    targetType: 'all', // 'all' | 'personal'
    targetPhone: '',
    title: '',
    content: '',
    coins: 0
  });

  // 1. Lắng nghe dữ liệu theo Tab hiện tại (Real-time)
  useEffect(() => {
    const collectionName = activeTab === 'NOTIF' ? 'notifications' : 'mailbox';
    const q = query(collection(db, collectionName), orderBy('createdAt', 'desc'));
    
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    
    return () => unsub();
  }, [activeTab]);

  // 2. Xử lý Gửi Thông báo / Thư
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.content.trim()) {
      return alert("Vui lòng nhập đủ Tiêu đề và Nội dung!");
    }
    
    if (formData.targetType === 'personal' && formData.targetPhone.trim().length < 10) {
      return alert("Vui lòng nhập đúng Số điện thoại của khách hàng!");
    }

    setIsSubmitting(true);
    try {
      const collectionName = activeTab === 'NOTIF' ? 'notifications' : 'mailbox';
      const target = formData.targetType === 'all' ? 'all' : formData.targetPhone.trim();

      const payload = {
        title: formData.title.trim(),
        content: formData.content.trim(),
        target: target,
        readBy: [], // Mảng trống ban đầu, dùng để đếm số người đã đọc
        createdAt: serverTimestamp(),
      };

      // Chỉ thêm vật phẩm đính kèm nếu đang ở tab Hòm Thư và số Xu > 0
      if (activeTab === 'MAIL' && formData.coins > 0) {
        payload.items = { coins: Number(formData.coins) };
      }

      await addDoc(collection(db, collectionName), payload);
      
      // Xóa form sau khi gửi thành công
      setFormData({ targetType: 'all', targetPhone: '', title: '', content: '', coins: 0 });
      alert("Đã gửi thành công!");
    } catch (error) {
      console.error("Lỗi khi gửi:", error);
      alert("Có lỗi xảy ra, vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Xử lý Thu hồi (Xóa)
  const handleDelete = async (id) => {
    if (window.confirm("Bạn có chắc chắn muốn thu hồi mục này? Toàn bộ khách hàng sẽ không thấy nữa (kể cả thư chưa nhận quà).")) {
      try {
        const collectionName = activeTab === 'NOTIF' ? 'notifications' : 'mailbox';
        await deleteDoc(doc(db, collectionName, id));
      } catch (error) {
        console.error("Lỗi xóa dữ liệu:", error);
        alert("Lỗi khi thu hồi, vui lòng thử lại.");
      }
    }
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* ================= CỘT TRÁI: FORM TẠO MỚI ================= */}
        <div className="lg:col-span-1 bg-white rounded-3xl shadow-xl border border-gray-100 p-6 h-fit sticky top-6">
          <h2 className="text-xl font-black uppercase text-gray-800 mb-6">Soạn tin mới</h2>
          
          {/* Chuyển đổi Loại (Tab) */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
            <button 
              type="button"
              onClick={() => setActiveTab('NOTIF')} 
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'NOTIF' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              🔔 Thông báo
            </button>
            <button 
              type="button"
              onClick={() => setActiveTab('MAIL')} 
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'MAIL' ? 'bg-white text-yellow-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              ✉️ Hòm thư
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 1. Chọn Đối Tượng */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Đối tượng nhận</label>
              <select 
                value={formData.targetType} 
                onChange={e => setFormData({...formData, targetType: e.target.value})}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              >
                <option value="all">Toàn bộ khách hàng (All)</option>
                <option value="personal">Khách hàng cá nhân (SĐT)</option>
              </select>
            </div>

            {/* Ô nhập SĐT cá nhân (Chỉ hiện khi chọn personal) */}
            {formData.targetType === 'personal' && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Số điện thoại nhận</label>
                <input 
                  type="tel" 
                  placeholder="Nhập SĐT..." 
                  value={formData.targetPhone} 
                  onChange={e => setFormData({...formData, targetPhone: e.target.value})}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
            )}

            {/* 2. Tiêu đề */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Tiêu đề</label>
              <input 
                type="text" 
                placeholder={activeTab === 'NOTIF' ? "Vd: Cập nhật hệ thống..." : "Vd: Quà tặng tri ân..."} 
                value={formData.title} 
                onChange={e => setFormData({...formData, title: e.target.value})}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>

            {/* 3. Nội dung */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Nội dung chi tiết</label>
              <textarea 
                rows="4" 
                placeholder="Nhập nội dung hiển thị..." 
                value={formData.content} 
                onChange={e => setFormData({...formData, content: e.target.value})}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none transition-all"
              ></textarea>
            </div>

            {/* 4. Đính kèm Xu (Chỉ Hòm Thư mới có) */}
            {activeTab === 'MAIL' && (
              <div className="space-y-2 animate-in fade-in bg-yellow-50 p-4 rounded-xl border border-yellow-200">
                <label className="text-xs font-black text-yellow-700 uppercase flex items-center justify-between tracking-widest">
                  Đính kèm thưởng (Xu)
                  <span className="text-lg">💰</span>
                </label>
                <input 
                  type="number" 
                  min="0" 
                  placeholder="0" 
                  value={formData.coins} 
                  onChange={e => setFormData({...formData, coins: e.target.value})}
                  className="w-full bg-white border border-yellow-300 rounded-xl px-4 py-3 text-lg font-black text-yellow-600 focus:ring-2 focus:ring-yellow-500 outline-none transition-all text-center"
                />
                <p className="text-[10px] text-yellow-600/70 italic mt-2 text-center">Để số 0 nếu thư này không đính kèm xu.</p>
              </div>
            )}

            {/* Nút Submit */}
            <button 
              disabled={isSubmitting} 
              type="submit" 
              className={`w-full py-4 rounded-xl font-black text-sm uppercase tracking-widest text-white transition-all shadow-lg active:scale-95 ${
                activeTab === 'NOTIF' 
                  ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200' 
                  : 'bg-yellow-500 hover:bg-yellow-600 shadow-yellow-200'
              }`}
            >
              {isSubmitting ? 'Đang gửi...' : 'Gửi đi ngay'}
            </button>
          </form>
        </div>

        {/* ================= CỘT PHẢI: LỊCH SỬ GỬI ================= */}
        <div className="lg:col-span-2 bg-white rounded-3xl shadow-xl border border-gray-100 p-6 flex flex-col h-fit">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
            <h2 className="text-xl font-black uppercase text-gray-800">
              Lịch sử đã gửi
            </h2>
            <span className="bg-gray-100 text-gray-500 text-sm px-4 py-1.5 rounded-full font-bold">
              {items.length} mục
            </span>
          </div>

          <div className="space-y-4 overflow-y-auto pr-2 no-scrollbar" style={{ maxHeight: 'calc(100vh - 200px)' }}>
            {items.length === 0 ? (
              <div className="text-center py-24 opacity-30">
                <span className="text-5xl block mb-3">📭</span>
                <p className="font-bold text-sm uppercase tracking-widest">Chưa có dữ liệu nào được gửi.</p>
              </div>
            ) : items.map(item => (
              <div 
                key={item.id} 
                className={`flex items-start justify-between p-5 rounded-2xl border transition-all hover:shadow-md ${
                  activeTab === 'NOTIF' 
                    ? 'bg-blue-50/30 border-blue-100' 
                    : 'bg-yellow-50/30 border-yellow-100'
                }`}
              >
                <div className="flex-1 pr-4">
                  {/* Metadata */}
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md ${
                      item.target === 'all' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-purple-100 text-purple-700'
                    }`}>
                      {item.target === 'all' ? 'Tất cả khách' : `Cá nhân: ${item.target}`}
                    </span>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                      {item.createdAt ? new Date(item.createdAt.toDate()).toLocaleString('vi-VN') : 'Đang xử lý...'}
                    </span>
                  </div>
                  
                  {/* Content */}
                  <h4 className="font-black text-gray-800 mb-1.5 text-base">{item.title}</h4>
                  <p className="text-sm text-gray-600 line-clamp-3 leading-relaxed whitespace-pre-wrap">{item.content}</p>
                  
                  {/* Attachment Badge */}
                  {item.items?.coins > 0 && (
                    <div className="mt-4 inline-flex items-center gap-2 bg-yellow-100 text-yellow-700 text-xs font-black px-3 py-1.5 rounded-lg border border-yellow-200">
                      <span>🎁</span> Đính kèm: {item.items.coins} Xu
                    </div>
                  )}
                  
                  {/* Read Count */}
                  <div className="mt-4 flex items-center gap-1.5 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                    <span>👁️</span> Đã xem: {item.readBy?.length || 0} người
                  </div>
                </div>

                {/* Delete Button */}
                <button 
                  onClick={() => handleDelete(item.id)}
                  className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-colors border border-red-100"
                  title="Thu hồi mục này"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ManageCommunication;