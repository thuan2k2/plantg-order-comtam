import React from 'react';
import { getRankInfo } from '../utils/rankUtils';

const UserAvatar = ({ avatarUrl, totalSpend = 0, manualRankId = null, size = 'w-12 h-12' }) => {
  const { activeFrame } = getRankInfo(totalSpend, manualRankId);
  
  // Tính toán kích thước khung viền lớn hơn avatar gốc khoảng 35% để bọc vừa khít
  const frameScale = 'scale-[1.35]'; 

  return (
    <div className={`relative flex items-center justify-center ${size}`}>
      {/* Avatar Cốt lõi */}
      <img 
        src={avatarUrl || 'https://ui-avatars.com/api/?name=User&background=f97316&color=fff'} 
        alt="Avatar" 
        className="w-[75%] h-[75%] rounded-full object-cover absolute z-0" 
        onError={(e) => { 
          // Tự động fallback về ảnh mặc định nếu URL bị lỗi
          e.target.src = 'https://ui-avatars.com/api/?name=User&background=f97316&color=fff'; 
        }}
      />
      
      {/* Khung viền Logo (Chỉ render nếu có activeFrame) */}
      {activeFrame && (
        <img 
          src={activeFrame} 
          alt="Rank Frame" 
          className={`absolute inset-0 w-full h-full object-contain z-10 pointer-events-none transition-transform duration-300 ${frameScale}`} 
        />
      )}
    </div>
  );
};

export default UserAvatar;