import React, { useState, useEffect } from 'react';

const CountdownBorder = ({ startTime, durationMinutes = 30, isActive }) => {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!isActive || !startTime) return;

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const start = startTime.toDate().getTime();
      const end = start + durationMinutes * 60 * 1000;
      const total = end - start;
      const remaining = end - now;

      const currentProgress = Math.max(0, (remaining / total) * 100);
      setProgress(currentProgress);

      if (remaining <= 0) clearInterval(timer);
    }, 1000);

    return () => clearInterval(timer);
  }, [startTime, isActive]);

  if (!isActive || progress <= 0) return null;

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" preserveAspectRatio="none">
      <rect
        x="0" y="0" width="100%" height="100%"
        fill="none"
        stroke={progress < 20 ? '#ef4444' : '#3b82f6'} // Đỏ khi dưới 20% thời gian
        strokeWidth="4"
        strokeDasharray="2000" // Giá trị lớn để bao phủ chu vi
        strokeDashoffset={(2000 * (100 - progress)) / 100}
        className="transition-all duration-1000 ease-linear"
        style={{ rx: '2.5rem' }} // Khớp với rounded-[2.5rem] của đơn hàng
      />
    </svg>
  );
};

export default CountdownBorder;