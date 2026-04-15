import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';

const ManageRatings = () => {
  const [reviews, setReviews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStar, setFilterStar] = useState(0); // 0 = Tất cả, 1-5 = Lọc theo sao
  const [filterStatus, setFilterStatus] = useState('ALL'); // ALL | UNREPLIED | REPLIED

  // State cho input phản hồi
  const [replyTexts, setReplyTexts] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(null); // Lưu ID đơn đang gửi

  useEffect(() => {
    setIsLoading(true);
    // Lấy tất cả đơn hàng có rating, sắp xếp mới nhất lên đầu
    const q = query(
      collection(db, 'orders'), 
      where('rating', '!=', null)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const fetchedReviews = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a, b) => {
        // Firestore where('!=', null) yêu cầu order phụ thuộc, ta sort ở client cho an toàn
        const timeA = a.rating?.createdAt?.toMillis() || 0;
        const timeB = b.rating?.createdAt?.toMillis() || 0;
        return timeB - timeA;
      });
      
      setReviews(fetchedReviews);
      setIsLoading(false);
    }, (error) => {
      console.error("Lỗi lấy dữ liệu đánh giá:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // XỬ LÝ GỬI PHẢN HỒI
  const handleSendReply = async (orderId) => {
    const text = replyTexts[orderId]?.trim();
    if (!text) return alert("Vui lòng nhập nội dung phản hồi!");

    setIsSubmitting(orderId);
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        'rating.adminReply': text
      });
      // Xóa text khỏi ô input sau khi gửi thành công (Tuỳ chọn: có thể giữ lại để sửa)
      // setReplyTexts(prev => ({ ...prev, [orderId]: '' }));
    } catch (error) {
      console.error("Lỗi gửi phản hồi:", error);
      alert("Có lỗi xảy ra khi lưu phản hồi.");
    } finally {
      setIsSubmitting(null);
    }
  };

  // LOGIC LỌC
  const filteredReviews = reviews.filter(r => {
    let passStar = filterStar === 0 ? true : r.rating.stars === filterStar;
    let passStatus = true;
    if (filterStatus === 'UNREPLIED') passStatus = !r.rating.adminReply;
    if (filterStatus === 'REPLIED') passStatus = !!r.rating.adminReply;
    return passStar && passStatus;
  });

  // TÍNH TOÁN THỐNG KÊ NHANH
  const totalReviews = reviews.length;
  const avgStars = totalReviews > 0 
    ? (reviews.reduce((sum, r) => sum + (r.rating?.stars || 0), 0) / totalReviews).toFixed(1) 
    : 0;
  const unrepliedCount = reviews.filter(r => !r.rating?.adminReply).length;

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
      <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Đang tải dữ liệu đánh giá...</p>
    </div>
  );

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-24">
      
      {/* HEADER & THỐNG KÊ */}
      <div>
        <h2 className="text-2xl font-black uppercase tracking-tighter text-gray-800 dark:text-white mb-6">Đánh giá & Phản hồi</h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Tổng đánh giá</p>
              <p className="text-3xl font-black text-gray-800 dark:text-white">{totalReviews}</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-xl text-blue-600">📝</div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Điểm trung bình</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-black text-yellow-500">{avgStars}</p>
                <span className="text-sm text-yellow-500">⭐</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-yellow-50 dark:bg-yellow-900/30 rounded-full flex items-center justify-center text-xl text-yellow-600">🌟</div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-sm border border-red-100 dark:border-red-900/30 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Chưa phản hồi</p>
              <p className="text-3xl font-black text-red-500">{unrepliedCount}</p>
            </div>
            <div className="w-12 h-12 bg-red-50 dark:bg-red-900/30 rounded-full flex items-center justify-center text-xl text-red-600">⏰</div>
          </div>
        </div>
      </div>

      {/* BỘ LỌC */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-2">Lọc theo số sao:</span>
          <div className="flex gap-1 bg-gray-50 dark:bg-gray-900/50 p-1 rounded-xl">
            {[0, 5, 4, 3, 2, 1].map(star => (
              <button 
                key={star}
                onClick={() => setFilterStar(star)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterStar === star ? 'bg-white dark:bg-gray-700 text-yellow-500 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
              >
                {star === 0 ? 'Tất cả' : `${star} ⭐`}
              </button>
            ))}
          </div>
        </div>

        <div className="h-8 w-px bg-gray-200 dark:bg-gray-700 hidden sm:block"></div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-2">Trạng thái:</span>
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-gray-50 dark:bg-gray-900/50 dark:text-white border-none outline-none text-xs font-bold px-4 py-2 rounded-xl focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">Tất cả</option>
            <option value="UNREPLIED">Chưa phản hồi</option>
            <option value="REPLIED">Đã phản hồi</option>
          </select>
        </div>
      </div>

      {/* DANH SÁCH ĐÁNH GIÁ */}
      <div className="space-y-6">
        {filteredReviews.length === 0 ? (
          <div className="text-center py-24 bg-white dark:bg-gray-800 rounded-[2.5rem] border border-dashed border-gray-200 dark:border-gray-700">
            <span className="text-5xl opacity-40 block mb-4">📭</span>
            <p className="text-xs font-black uppercase text-gray-400 tracking-widest">Không có đánh giá nào phù hợp với bộ lọc</p>
          </div>
        ) : (
          filteredReviews.map(order => {
            const r = order.rating;
            const hasReply = !!r.adminReply;
            const isEditing = replyTexts[order.id] !== undefined;
            const currentInputValue = replyTexts[order.id] ?? r.adminReply ?? '';

            return (
              <div key={order.id} className={`bg-white dark:bg-gray-800 rounded-[2rem] p-6 sm:p-8 shadow-sm border transition-colors ${hasReply ? 'border-gray-100 dark:border-gray-700' : 'border-blue-100 dark:border-blue-900/30'}`}>
                <div className="flex flex-col sm:flex-row justify-between gap-6">
                  
                  {/* Cột trái: Thông tin khách & Đánh giá */}
                  <div className="flex-1 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="font-black text-gray-800 dark:text-white text-lg leading-none">{order.customer}</h3>
                          <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded text-[10px] font-mono font-black">#{order.id.slice(-6).toUpperCase()}</span>
                        </div>
                        <p className="text-[10px] text-gray-400 font-bold mt-1.5">{order.phone} • {r.createdAt?.toDate().toLocaleString('vi-VN') || 'N/A'}</p>
                      </div>
                      <div className="text-yellow-400 text-lg">
                        {"★".repeat(r.stars)}{"☆".repeat(5-r.stars)}
                      </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
                      <p className="text-sm text-gray-700 dark:text-gray-300 italic">
                        {r.comment ? `"${r.comment}"` : <span className="text-gray-400">Khách hàng không để lại nhận xét.</span>}
                      </p>
                      
                      {/* Hiển thị món ăn để Admin dễ hình dung */}
                      <div className="mt-3 pt-3 border-t border-dashed border-gray-200 dark:border-gray-700">
                        <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-1">Món đã đặt</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 font-medium line-clamp-2">{order.items}</p>
                      </div>
                    </div>
                  </div>

                  {/* Cột phải: Khu vực Admin Phản hồi */}
                  <div className="w-full sm:w-1/2 flex flex-col justify-end border-t sm:border-t-0 sm:border-l border-dashed border-gray-200 dark:border-gray-700 pt-6 sm:pt-0 sm:pl-6">
                    
                    {!hasReply && !isEditing ? (
                      <button 
                        onClick={() => setReplyTexts(prev => ({...prev, [order.id]: ''}))}
                        className="w-full py-4 rounded-2xl border-2 border-blue-100 dark:border-blue-900/50 text-blue-600 dark:text-blue-400 font-black text-[10px] uppercase tracking-widest hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                      >
                        Trả lời đánh giá này
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-widest flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span> Phản hồi của Quán
                          </label>
                          {hasReply && !isEditing && (
                            <button onClick={() => setReplyTexts(prev => ({...prev, [order.id]: r.adminReply}))} className="text-[9px] font-bold text-gray-400 hover:text-blue-500 underline">Chỉnh sửa</button>
                          )}
                        </div>
                        
                        {!isEditing ? (
                          <p className="text-sm text-gray-800 dark:text-gray-200 bg-blue-50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                            {r.adminReply}
                          </p>
                        ) : (
                          <>
                            <textarea 
                              value={currentInputValue}
                              onChange={(e) => setReplyTexts(prev => ({...prev, [order.id]: e.target.value}))}
                              placeholder="Nhập lời cảm ơn hoặc xin lỗi khách hàng..."
                              className="w-full p-4 bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-800 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none dark:text-white"
                              rows="3"
                            />
                            <div className="flex gap-2">
                              {hasReply && (
                                <button 
                                  onClick={() => setReplyTexts(prev => { const copy = {...prev}; delete copy[order.id]; return copy; })}
                                  className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 font-bold text-[10px] uppercase tracking-widest hover:bg-gray-200 dark:hover:bg-gray-600"
                                >
                                  Hủy
                                </button>
                              )}
                              <button 
                                onClick={() => handleSendReply(order.id)}
                                disabled={isSubmitting === order.id}
                                className={`flex-1 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                                  isSubmitting === order.id ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-none hover:bg-blue-700 active:scale-95'
                                }`}
                              >
                                {isSubmitting === order.id ? 'Đang lưu...' : 'Lưu phản hồi'}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};

export default ManageRatings;