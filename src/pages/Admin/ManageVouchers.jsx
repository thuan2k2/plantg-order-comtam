import React, { useState, useEffect } from 'react';
import { getAllVouchers, createVoucher, deleteVoucher } from '../../services/orderService';

const ManageVouchers = () => {
  const [vouchers, setVouchers] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newV, setNewV] = useState({
    code: '', value: 0, type: 'CASH', // CASH hoặc FREESHIP
    assignedPhone: '', usageLimit: 10,
    expiry: ''
  });

  useEffect(() => { loadVouchers(); }, []);
  const loadVouchers = async () => { setVouchers(await getAllVouchers()); };

  const handleAdd = async (e) => {
    e.preventDefault();
    const res = await createVoucher(newV);
    if (res.success) {
      setShowAdd(false);
      loadVouchers();
      setNewV({ code: '', value: 0, type: 'CASH', assignedPhone: '', usageLimit: 10, expiry: '' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center px-4">
        <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Quản lý Voucher & Phí Ship</h2>
        <button 
          onClick={() => setShowAdd(true)}
          className="bg-blue-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-100"
        >
          + Tạo mã mới
        </button>
      </div>

      {/* Form thêm nhanh */}
      {showAdd && (
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-blue-50 animate-in zoom-in duration-300">
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Mã Code (VD: GIAM30K)</label>
              <input type="text" required value={newV.code} onChange={e => setNewV({...newV, code: e.target.value})} className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-bold" />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Loại Voucher</label>
              <select value={newV.type} onChange={e => setNewV({...newV, type: e.target.value})} className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-bold">
                <option value="CASH">Giảm tiền mặt (đ)</option>
                <option value="FREESHIP">Miễn phí vận chuyển</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Giá trị giảm (đ)</label>
              <input type="number" value={newV.value} onChange={e => setNewV({...newV, value: parseInt(e.target.value)})} className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-bold" disabled={newV.type === 'FREESHIP'} />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Gán SĐT (Để trống nếu dùng chung)</label>
              <input type="tel" value={newV.assignedPhone} onChange={e => setNewV({...newV, assignedPhone: e.target.value})} className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-bold" />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Lượt dùng tối đa</label>
              <input type="number" value={newV.usageLimit} onChange={e => setNewV({...newV, usageLimit: parseInt(e.target.value)})} className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-bold" />
            </div>
            <div className="flex items-end gap-2">
              <button type="submit" className="flex-1 bg-green-500 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest">Lưu Voucher</button>
              <button onClick={() => setShowAdd(false)} className="px-4 py-3 text-gray-400 font-bold text-[10px] uppercase">Hủy</button>
            </div>
          </form>
        </div>
      )}

      {/* Danh sách Voucher */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {vouchers.map(v => (
          <div key={v.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex justify-between items-center relative overflow-hidden group">
            <div className={`absolute left-0 top-0 bottom-0 w-2 ${v.type === 'FREESHIP' ? 'bg-blue-500' : 'bg-green-500'}`}></div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-gray-800">{v.code}</h3>
                <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${v.type === 'FREESHIP' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                  {v.type === 'FREESHIP' ? 'Freeship' : `-${v.value.toLocaleString()}đ`}
                </span>
              </div>
              <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase">
                {v.assignedPhone ? `Dành riêng: ${v.assignedPhone}` : 'Mọi khách hàng'} • Còn {v.usageLimit} lượt
              </p>
            </div>
            <button onClick={() => deleteVoucher(v.id).then(loadVouchers)} className="p-3 text-gray-300 hover:text-red-500 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ManageVouchers;