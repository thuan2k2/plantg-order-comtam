// Định nghĩa cấu hình các chế độ chơi của Au Plant G
export const GAME_MODES = {
  SINGLE: {
    id: 'SINGLE',
    name: 'Đấu Đơn',
    maxPlayers: 1,
    icon: '👤',
    description: 'Thử thách kỹ năng cá nhân, chinh phục kỷ lục điểm số của chính mình.'
  },
  SOLO: {
    id: 'SOLO',
    name: 'Đấu Solo',
    maxPlayers: 2,
    icon: '⚔️',
    description: 'Ghép trận 1vs1. Cạnh tranh điểm số trực tiếp với một đối thủ khác.'
  },
  COUPLE: {
    id: 'COUPLE',
    name: 'Đấu Cặp',
    maxPlayers: 4,
    icon: '👯',
    description: 'Chế độ 2vs2. Hợp tác cùng đồng đội, tổng điểm đội nào cao hơn sẽ chiến thắng.'
  }
};

// Chuyển Object thành Array để tiện cho việc render danh sách nút bấm trên giao diện
export const GAME_MODE_LIST = Object.values(GAME_MODES);