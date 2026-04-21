// Cấu hình Rank dùng chung cho toàn hệ thống
export const RANK_TIERS = [
  { id: 'BRONZE', name: 'Đồng', min: 0, color: 'from-amber-700 to-amber-500', border: 'border-amber-200', bg: 'bg-amber-50', darkBg: 'dark:bg-amber-900/20', icon: '🥉', frames: ['/logo/cap_1.png', '/logo/cap_3.png', '/logo/cap_5.png'], autoPerks: [], limit: 0, vipLevel: 1, vipIcon: '/vip/VIP1.png' },
  { id: 'SILVER', name: 'Bạc', min: 300000, color: 'from-slate-400 to-slate-200', border: 'border-slate-200', bg: 'bg-slate-50', darkBg: 'dark:bg-slate-900/20', icon: '🥈', frames: ['/logo/cap_7.png', '/logo/cap_9.png'], autoPerks: ['GIFT'], limit: 50, vipLevel: 1, vipIcon: '/vip/VIP1.png' },
  { id: 'GOLD', name: 'Vàng', min: 600000, color: 'from-yellow-600 to-yellow-300', border: 'border-yellow-200', bg: 'bg-yellow-50', darkBg: 'dark:bg-yellow-900/20', icon: '🥇', frames: ['/logo/cap_12.png'], autoPerks: ['GIFT'], limit: 50, vipLevel: 1, vipIcon: '/vip/VIP1.png' },
  { id: 'PLATINUM', name: 'Bạch Kim', min: 900000, color: 'from-cyan-400 to-blue-300', border: 'border-cyan-200', bg: 'bg-cyan-50', darkBg: 'dark:bg-cyan-900/20', icon: '💎', frames: ['/logo/cap_15.png'], autoPerks: ['GIFT', 'CHECKIN'], limit: 250, vipLevel: 2, vipIcon: '/vip/VIP2.png' },
  { id: 'DIAMOND', name: 'Kim Cương', min: 1200000, color: 'from-blue-600 to-indigo-400', border: 'border-blue-200', bg: 'bg-blue-50', darkBg: 'dark:bg-blue-900/20', icon: '💠', frames: ['/logo/cap_17.png'], autoPerks: ['GIFT', 'CHECKIN'], limit: 250, vipLevel: 3, vipIcon: '/vip/VIP3.png' },
  { id: 'VETERAN', name: 'Tinh Anh', min: 1500000, color: 'from-purple-600 to-pink-400', border: 'border-purple-200', bg: 'bg-purple-50', darkBg: 'dark:bg-purple-900/20', icon: '🔮', frames: ['/logo/cap_20.png'], autoPerks: ['GIFT', 'CHECKIN', 'LUCKY'], limit: 400, vipLevel: 4, vipIcon: '/vip/VIP4.png' },
  { id: 'MASTER', name: 'Cao Thủ', min: 1800000, color: 'from-red-600 to-orange-500', border: 'border-red-200', bg: 'bg-red-50', darkBg: 'dark:bg-red-900/20', icon: '🔥', frames: ['/logo/cap_23.png'], autoPerks: ['GIFT', 'CHECKIN', 'LUCKY'], limit: 400, vipLevel: 5, vipIcon: '/vip/VIP5.png' },
  { id: 'WARLORD', name: 'Chiến Tướng', min: 2100000, color: 'from-red-800 to-red-600', border: 'border-red-400', bg: 'bg-red-100', darkBg: 'dark:bg-red-900/30', icon: '👑', frames: ['/logo/cap_26.png'], autoPerks: ['ALL'], limit: null, vipLevel: 6, vipIcon: '/vip/VIP6.png' },
  { id: 'CHALLENGER', name: 'Thách Đấu', min: 2400000, color: 'from-gray-900 via-purple-900 to-violet-600', border: 'border-purple-400', bg: 'bg-purple-100', darkBg: 'dark:bg-purple-900/40', icon: '🌌', frames: ['/logo/cap_29.png'], autoPerks: ['ALL'], limit: null, vipLevel: 7, vipIcon: '/vip/VIP7.png' }
];

// Hàm tính Rank dành riêng cho CheckOrder (tương thích ngược)
export const calculateRank = (orders) => {
  const totalSpend = orders
    .filter(o => o.status === 'COMPLETED')
    .reduce((sum, o) => sum + parseInt(o.total?.replace(/\D/g, '') || 0), 0);

  let current = RANK_TIERS[0];
  for (let i = 0; i < RANK_TIERS.length; i++) {
    if (totalSpend >= RANK_TIERS[i].min) {
      current = RANK_TIERS[i];
    }
  }
  return current;
};

// Hàm tính Rank đa năng (Hỗ trợ Khung viền và Hạng thủ công từ Admin)
export const getRankInfo = (totalSpend, manualRankId = null) => {
  let current = RANK_TIERS[0];
  let next = RANK_TIERS[1];
  
  // Nếu Admin có set cứng hạng cho khách (manualRankId)
  if (manualRankId) {
    const found = RANK_TIERS.find(r => r.id === manualRankId);
    if (found) {
      current = found;
      const idx = RANK_TIERS.findIndex(r => r.id === manualRankId);
      next = RANK_TIERS[idx + 1] || null;
    }
  } else {
    // Tính hạng tự động theo chi tiêu
    for (let i = 0; i < RANK_TIERS.length; i++) {
      if (totalSpend >= RANK_TIERS[i].min) {
        current = RANK_TIERS[i];
        next = RANK_TIERS[i + 1] || null;
      }
    }
  }

  let progress = 100;
  let frameIndex = 0;

  if (next) {
    const range = next.min - current.min;
    const earned = totalSpend - current.min;
    progress = Math.min(Math.floor((earned / range) * 100), 100);
    
    // Tính toán khung viền nâng cấp dần bên trong 1 Hạng (Ví dụ: Đồng 1 -> Đồng 3 -> Đồng 5)
    if (current.frames.length > 1) {
      const step = 100 / current.frames.length;
      frameIndex = Math.min(Math.floor(progress / step), current.frames.length - 1);
    }
  } else {
    frameIndex = current.frames.length - 1; // Max frame cho rank cao nhất
  }

  return { 
    current, 
    next, 
    progress, 
    activeFrame: current.frames[frameIndex] 
  };
};