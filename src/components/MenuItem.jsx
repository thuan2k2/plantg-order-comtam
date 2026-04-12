import React from 'react';

const MenuItem = ({ name, price, description, onAdd }) => {
  return (
    <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-white">
      <div className="flex gap-4 w-4/5">
        <div className="w-16 h-16 bg-orange-50 border border-orange-100 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center">
          {/* Vùng này dành cho thẻ <img> thật sau này */}
          <span className="text-[10px] text-orange-300 text-center px-1">Ảnh món</span>
        </div>
        <div className="flex flex-col justify-center">
          <h3 className="text-[15px] font-semibold text-gray-800 leading-snug">{name}</h3>
          <p className="text-[14px] text-gray-700 mt-1">{price}</p>
          {description && (
            <p className="text-[12px] text-gray-500 mt-1 line-clamp-2 leading-relaxed">{description}</p>
          )}
        </div>
      </div>
      <button 
        onClick={onAdd}
        className="w-7 h-7 bg-[#007BFF] text-white rounded-full flex items-center justify-center font-bold flex-shrink-0 hover:bg-blue-600 transition-colors shadow-sm"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
};

export default MenuItem;