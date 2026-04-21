import React from 'react';

const VipBadge = ({ rankInfo, size = 'w-4 h-4', className = '' }) => {
  // Nếu chưa có thông tin rank hoặc rank đó không có cấu hình vipIcon thì không hiển thị gì cả
  if (!rankInfo || !rankInfo.current || !rankInfo.current.vipIcon) {
    return null;
  }

  const { vipIcon, vipLevel, name } = rankInfo.current;

  return (
    <img 
      src={vipIcon} 
      alt={`VIP ${vipLevel} - ${name}`} 
      title={`Thành viên VIP ${vipLevel} (${name})`}
      className={`object-contain drop-shadow-sm inline-block flex-shrink-0 transition-transform hover:scale-110 ${size} ${className}`}
      onError={(e) => {
        // Ẩn icon nếu trình duyệt không tìm thấy file ảnh trong thư mục public/vip
        e.target.style.display = 'none'; 
      }}
    />
  );
};

export default VipBadge;