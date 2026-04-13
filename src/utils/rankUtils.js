// Cấu hình Rank dùng chung cho toàn hệ thống
export const RANK_TIERS = [
  { name: 'Đồng', min: 0, color: 'from-amber-700 to-amber-500', border: 'border-amber-200', bg: 'bg-amber-50', darkBg: 'dark:bg-amber-900/20', icon: '🥉' },
  { name: 'Bạc', min: 300000, color: 'from-slate-400 to-slate-200', border: 'border-slate-200', bg: 'bg-slate-50', darkBg: 'dark:bg-slate-900/20', icon: '🥈' },
  { name: 'Vàng', min: 600000, color: 'from-yellow-600 to-yellow-300', border: 'border-yellow-200', bg: 'bg-yellow-50', darkBg: 'dark:bg-yellow-900/20', icon: '🥇' },
  { name: 'Bạch Kim', min: 900000, color: 'from-cyan-400 to-blue-300', border: 'border-cyan-200', bg: 'bg-cyan-50', darkBg: 'dark:bg-cyan-900/20', icon: '💎' },
  { name: 'Kim Cương', min: 1200000, color: 'from-blue-600 to-indigo-400', border: 'border-blue-200', bg: 'bg-blue-50', darkBg: 'dark:bg-blue-900/20', icon: '💠' },
  { name: 'Tinh Anh', min: 1500000, color: 'from-purple-600 to-pink-400', border: 'border-purple-200', bg: 'bg-purple-50', darkBg: 'dark:bg-purple-900/20', icon: '🔮' },
  { name: 'Cao Thủ', min: 1800000, color: 'from-red-600 to-orange-500', border: 'border-red-200', bg: 'bg-red-50', darkBg: 'dark:bg-red-900/20', icon: '🔥' },
  { name: 'Chiến Tướng', min: 2100000, color: 'from-red-800 to-red-600', border: 'border-red-400', bg: 'bg-red-100', darkBg: 'dark:bg-red-900/30', icon: '👑' },
  { name: 'Thách Đấu', min: 2400000, color: 'from-gray-900 via-purple-900 to-violet-600', border: 'border-purple-400', bg: 'bg-purple-100', darkBg: 'dark:bg-purple-900/40', icon: '🌌' }
];

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