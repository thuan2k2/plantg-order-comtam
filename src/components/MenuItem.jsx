import React from 'react';

const MenuItem = ({ name, price, description, image, onAdd }) => {
  return (
    <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-white hover:bg-gray-50/50 transition-colors">
      <div className="flex gap-4 w-full mr-2">
        {/* Hiển thị hình ảnh từ Firebase */}
        <div className="w-20 h-20 bg-gray-50 border border-gray-100 rounded-xl flex-shrink-0 overflow-hidden shadow-sm">
          {image ? (
            <img 
              src={image} 
              alt={name} 
              className="w-full h-full object-cover"
              loading="lazy" 
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-orange-50">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-orange-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-[8px] text-orange-300 font-bold uppercase mt-1">Plant G</span>
            </div>
          )}
        </div>

        <div className="flex flex-col justify-center flex-1">
          <h3 className="text-[15px] font-bold text-gray-800 leading-snug">{name}</h3>
          <p className="text-[14px] text-blue-600 font-bold mt-0.5">{price}</p>
          {description && (
            <p className="text-[12px] text-gray-500 mt-1 line-clamp-2 leading-relaxed italic">
              {description}
            </p>
          )}
        </div>
      </div>

      {/* Nút thêm vào giỏ hàng */}
      <button 
        onClick={onAdd}
        className="w-8 h-8 bg-[#007BFF] text-white rounded-xl flex items-center justify-center font-bold flex-shrink-0 hover:bg-blue-600 active:scale-90 transition-all shadow-md"
        title="Thêm vào giỏ"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
};

export default MenuItem;