import React from 'react';

// Từ điển trạng thái chuẩn hóa cho toàn bộ hệ thống
const STATUS_MAP = {
  PENDING: { label: 'Chờ xác nhận', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  CONFIRMED: { label: 'Đã xác nhận', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  PREPARING: { label: 'Bếp đang chuẩn bị', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  DELIVERING: { label: 'Đang giao hàng', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  COMPLETED: { label: 'Đã hoàn thành', color: 'bg-green-100 text-green-700 border-green-200' },
  CANCELLED: { label: 'Đơn đã huỷ', color: 'bg-red-100 text-red-700 border-red-200' },
  CANCEL_REQUESTED: { label: 'Yêu cầu huỷ đơn', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  RESCHEDULED: { label: 'Đã dời lịch', color: 'bg-teal-100 text-teal-700 border-teal-200' },
  SCHEDULED: { label: 'Hẹn giờ giao', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' }
};

const StatusBadge = ({ status, className = '' }) => {
  // Nếu status truyền vào không khớp, mặc định sẽ hiện 'Chờ xác nhận'
  const config = STATUS_MAP[status] || STATUS_MAP.PENDING;

  return (
    <span 
      className={`px-2.5 py-1 text-[12px] font-medium rounded-full border inline-flex items-center justify-center ${config.color} ${className}`}
    >
      {/* Thêm chấm tròn nhỏ tạo hiệu ứng nhấp nháy nếu là trạng thái cần chú ý gấp */}
      {status === 'CANCEL_REQUESTED' && (
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse mr-1.5"></span>
      )}
      
      {config.label}
    </span>
  );
};

export default StatusBadge;