import React, { useState, useEffect } from 'react';
import { getAllVouchers, createVoucher, deleteVoucher } from '../../services/orderService';

const ManageVouchers = () => {
  const [vouchers, setVouchers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  
  // State khởi tạo cho Voucher mới
  const [newV, setNewV] = useState({
    code: '', 
    value: 5000, 
    type: 'CASH', // CASH hoặc FREESHIP
    assignedPhone: '', // Để trống = Mọi người đều dùng được
    usageLimit: 1, // Số lượt khách có thể sử dụng (VD: add 50 lượt cho khách A)
  });

  useEffect(() => {
    loadVouchers();
  }, []);

  const loadVouchers = async () => {
    setIsLoading(true);
    const data = await getAllVouchers();
    setVouchers(data);
    setIsLoading(false);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newV.code) return;

    // Chuẩn hóa dữ liệu: Code viết hoa, phí ship mặc định giảm 5000đ nếu là FREESHIP
    const voucherData = {
      ...newV,
      code: newV.code.toUpperCase().trim(),
      value: newV.type === 'FREESHIP' ? 5000 : newV.value,
      usageLimit: parseInt(newV.usageLimit) || 1
    };

    const res = await createVoucher(voucherData);
    if (res.success) {
      setShowAdd(false);
      loadVouchers();
      // Reset form
      setNewV({ code: '', value: 5000, type: 'CASH', assignedPhone: '', usageLimit: 1 });
      alert("Đã tạo và lưu kho Voucher thành công!");
    } else {
      alert("Lỗi: " + res.error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Bạn muốn xóa mã Voucher này khỏi kho hệ thống?")) {
      const res = await deleteVoucher(id);
      if (res.success) loadVouchers();
    }
  };

  if (isLoading) return (
    <div className="p-20 text-center font-black text-blue-600 animate-pulse tracking-widest uppercase">
      Đang kiểm kê kho voucher...
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header & Button Thêm */}
      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter leading-none">Kho Voucher Hệ Thống</h2>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-2">Quản lý mã giảm giá & Số lượng lượt dùng</p>
        </div>
        <button 
          onClick={() => setShowAdd(true)}
          className="bg-blue-600 text-white px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-blue-100 active:scale-95 transition-all"
        >
          + Tạo Voucher Mới
        </button>
      </div>

      {/* Form thêm Voucher mới */}
      {showAdd && (
        <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-blue-50 animate-in zoom-in duration-300">
          <form onSubmit={handleAdd} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">Mã Voucher (VD: FREESHIP5K)</label>
                <input 
                  type="text" 
                  required 
                  placeholder="CODE"
                  value={newV.code} 
                  onChange={e => setNewV({...newV, code: e.target.value})} 
                  className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm font-black uppercase placeholder:text-gray-300 focus:ring-2 focus:ring-blue-600 outline-none" 
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">Loại ưu đãi</label>
                <select 
                  value={newV.type} 
                  onChange={e => setNewV({...newV, type: e.target.value})} 
                  className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-blue-600 outline-none cursor-pointer"
                >
                  <option value="CASH">Giảm tiền mặt (đ)</option>
                  <option value="FREESHIP">Miễn phí vận chuyển (5k)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">Giá trị giảm (đ)</label>
                <input 
                  type="number" 
                  disabled={newV.type === 'FREESHIP'}
                  value={newV.value} 
                  onChange={e => setNewV({...newV, value: parseInt(e.target.value)})} 
                  className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm font-black text-red-500 focus:ring-2 focus:ring-blue-600 outline-none disabled:opacity-50" 
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">Số lượng lượt dùng (VD: 50)</label>
                <input 
                  type="number" 
                  required
                  min="1"
                  value={newV.usageLimit} 
                  onChange={e => setNewV({...newV, usageLimit: e.target.value})} 
                  className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm font-black text-blue-600 focus:ring-2 focus:ring-blue-600 outline-none" 
                />
              </div>

              <div className="lg:col-span-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">Gán cho SĐT (Để trống nếu dùng chung)</label>
                <input 
                  type="tel" 
                  placeholder="0386 xxx xxx"
                  value={newV.assignedPhone} 
                  onChange={e => setNewV({...newV, assignedPhone: e.target.value})} 
                  className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none" 
                />
              </div>
            </div>

            <div className="flex gap-4 pt-4 border-t border-gray-50">
              <button type="submit" className="flex-[2] bg-green-500 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-green-100 active:scale-95 transition-all">Lưu vào kho dữ liệu</button>
              <button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Hủy bỏ</button>
            </div>
          </form>
        </div>
      )}

      {/* Danh sách Voucher hiển thị dạng Grid mượt mà */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {vouchers.map(v => (
          <div key={v.id} className="bg-white p-7 rounded-[2.5rem] shadow-sm border border-gray-100 flex justify-between items-center relative overflow-hidden group hover:shadow-md transition-all">
            {/* Thanh màu chỉ thị loại voucher */}
            <div className={`absolute left-0 top-0 bottom-0 w-2 ${v.type === 'FREESHIP' ? 'bg-blue-500' : 'bg-green-500'}`}></div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-black text-gray-800 tracking-tight">{v.code}</h3>
                <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${v.type === 'FREESHIP' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                  {v.type === 'FREESHIP' ? 'Freeship' : `-${v.value.toLocaleString()}đ`}
                </span>
              </div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
                {v.assignedPhone ? (
                  <span className="text-blue-500">📍 Riêng: {v.assignedPhone}</span>
                ) : (
                  <span className="text-gray-400">🌍 Voucher công khai</span>
                )}
              </p>
              <div className="flex items-center gap-2 mt-2">
                 <div className="bg-gray-100 h-1.5 w-20 rounded-full overflow-hidden">
                    <div className="bg-gray-300 h-full w-full"></div>
                 </div>
                 <p className="text-[9px] font-black text-gray-500 uppercase">Còn {v.usageLimit} lượt</p>
              </div>
            </div>

            <button 
              onClick={() => handleDelete(v.id)} 
              className="p-3 text-gray-300 hover:bg-red-50 hover:text-red-500 rounded-2xl transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
        ))}

        {vouchers.length === 0 && (
          <div className="col-span-full py-20 text-center bg-white rounded-[2.5rem] border border-dashed border-gray-200">
            <p className="text-sm font-bold text-gray-300 italic uppercase tracking-widest">Kho Voucher đang trống</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageVouchers;