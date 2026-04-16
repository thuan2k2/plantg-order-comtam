import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';

const ManageAllOrders = () => {
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');

  // State quản lý Modal Sửa đơn hàng
  const [editingOrder, setEditingOrder] = useState(null);
  const [editForm, setEditForm] = useState({
    customer: '', phone: '', items: '', total: '', status: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, []);

  // --- XÓA VĨNH VIỄN ---
  const handleDelete = async (id) => {
    if (window.confirm("CẢNH BÁO: Xóa vĩnh viễn đơn này khỏi hệ thống? Không thể khôi phục!")) {
      try {
        await deleteDoc(doc(db, 'orders', id));
      } catch (error) {
        alert("Lỗi khi xóa: " + error.message);
      }
    }
  };

  // --- MỞ MODAL SỬA ---
  const handleOpenEdit = (order) => {
    setEditingOrder(order);
    setEditForm({
      customer: order.customer || '',
      phone: order.phone || '',
      items: order.items || '',
      total: order.total || '',
      status: order.status || 'PENDING'
    });
  };

  // --- LƯU CẬP NHẬT ---
  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, 'orders', editingOrder.id), editForm);
      setEditingOrder(null);
      alert("Đã cập nhật thông tin đơn hàng thành công!");
    } catch (error) {
      alert("Lỗi cập nhật: " + error.message);
    }
  };

  const filtered = orders.filter(o => 
    o.id.toUpperCase().includes(search.toUpperCase()) || 
    (o.phone && o.phone.includes(search)) || 
    (o.customer && o.customer.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl font-black uppercase tracking-tighter text-gray-800 dark:text-white">Quản lý toàn bộ đơn hàng</h2>
        <input 
          placeholder="Tìm mã đơn, Tên hoặc SĐT..." 
          className="p-3 bg-white dark:bg-gray-800 dark:text-white rounded-2xl border-none shadow-sm text-sm w-full sm:w-64 focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="grid gap-3">
        {filtered.map(order => (
          <div key={order.id} className="bg-white dark:bg-gray-800 p-5 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row justify-between gap-4 transition-colors">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-[10px] font-black bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded">#{order.id.slice(-6).toUpperCase()}</span>
                <span className={`text-[10px] font-black uppercase 
                  ${order.status === 'COMPLETED' ? 'text-green-500' : 
                    order.status === 'CANCELLED' ? 'text-red-500' : 'text-orange-500'}`
                }>
                  {order.status}
                </span>
              </div>
              <p className="font-bold text-sm text-gray-800 dark:text-white">{order.customer} - {order.phone}</p>
              <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold">{order.time} | {order.total}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic line-clamp-2">{order.items}</p>
            </div>
            
            <div className="flex items-center gap-2 sm:self-center">
              {/* Nút Sửa */}
              <button 
                onClick={() => handleOpenEdit(order)}
                className="flex-1 sm:flex-none px-4 py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-2xl text-[10px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all"
              >
                Sửa
              </button>
              
              {/* Nút Xóa vĩnh viễn */}
              <button 
                onClick={() => handleDelete(order.id)}
                className="flex-1 sm:flex-none px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 rounded-2xl text-[10px] font-black uppercase hover:bg-red-600 hover:text-white transition-all"
              >
                Xóa vĩnh viễn
              </button>
            </div>
          </div>
        ))}
        
        {filtered.length === 0 && (
          <div className="text-center py-20 text-gray-400 text-xs font-bold uppercase tracking-widest">
            Không tìm thấy đơn hàng nào.
          </div>
        )}
      </div>

      {/* ======================================= */}
      {/* MODAL CHỈNH SỬA ĐƠN HÀNG */}
      {/* ======================================= */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-[2.5rem] p-6 sm:p-8 shadow-2xl relative overflow-y-auto max-h-[90vh]">
            <button 
              onClick={() => setEditingOrder(null)} 
              className="absolute top-6 right-6 w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >✕</button>

            <h2 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-tighter mb-1">Chỉnh sửa đơn hàng</h2>
            <p className="font-mono font-black text-blue-600 dark:text-blue-400 text-xs mb-6">#{editingOrder.id.slice(-6).toUpperCase()}</p>

            <form onSubmit={handleUpdateSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Khách hàng</label>
                  <input 
                    required type="text" 
                    value={editForm.customer} 
                    onChange={e => setEditForm({...editForm, customer: e.target.value})}
                    className="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:text-white rounded-xl border-none text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Số điện thoại</label>
                  <input 
                    required type="text" 
                    value={editForm.phone} 
                    onChange={e => setEditForm({...editForm, phone: e.target.value})}
                    className="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:text-white rounded-xl border-none text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" 
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Chi tiết món ăn</label>
                <textarea 
                  required rows="3"
                  value={editForm.items} 
                  onChange={e => setEditForm({...editForm, items: e.target.value})}
                  className="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:text-white rounded-xl border-none text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Tổng tiền (đ)</label>
                  <input 
                    required type="text" 
                    value={editForm.total} 
                    onChange={e => setEditForm({...editForm, total: e.target.value})}
                    className="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:text-white rounded-xl border-none text-sm font-black text-red-500 focus:ring-2 focus:ring-blue-500 outline-none" 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Trạng thái</label>
                  <select 
                    value={editForm.status} 
                    onChange={e => setEditForm({...editForm, status: e.target.value})}
                    className="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:text-white rounded-xl border-none text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="PENDING">PENDING (Chờ nhận)</option>
                    <option value="PREPARING">PREPARING (Bếp làm)</option>
                    <option value="DELIVERING">DELIVERING (Đang giao)</option>
                    <option value="COMPLETED">COMPLETED (Hoàn thành)</option>
                    <option value="CANCEL_REQUESTED">CANCEL_REQUESTED (Yêu cầu hủy)</option>
                    <option value="CANCELLED">CANCELLED (Đã hủy)</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setEditingOrder(null)}
                  className="flex-[1] py-4 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition-colors"
                >
                  Hủy
                </button>
                <button 
                  type="submit"
                  className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-200 dark:shadow-none active:scale-95 transition-all"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
            
          </div>
        </div>
      )}

    </div>
  );
};

export default ManageAllOrders;