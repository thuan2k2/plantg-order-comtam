// src/Au/AuSettings.jsx
import React from 'react';

// ĐÃ THÊM: multiSettings và handleMultiSettingChange với giá trị mặc định để tránh lỗi
const AuSettings = ({ volumes, handleVolumeChange, multiSettings = { showOpponentScore: true, allowInvites: true }, handleMultiSettingChange, setShowSettings }) => {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center animate-in fade-in p-4">
        {/* ĐÃ THÊM: Giới hạn chiều cao max-h-[90vh] và cho phép cuộn (overflow-y-auto) */}
        <div className="bg-gray-900 border border-white/20 p-8 rounded-[2rem] w-full max-w-md shadow-[0_0_50px_rgba(34,211,238,0.1)] max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black italic text-cyan-400 uppercase tracking-widest">Cài đặt</h2>
                <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-white text-2xl transition-colors">✖</button>
            </div>
            
            <div className="space-y-8">
                {/* --- PHẦN 1: CÀI ĐẶT ÂM THANH --- */}
                <div>
                    <h3 className="text-sm font-black text-white/50 uppercase tracking-widest mb-4 border-b border-white/10 pb-2">🎵 Âm thanh</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="flex justify-between text-xs font-bold text-gray-400 uppercase mb-2"><span>Nhạc Sảnh (Lobby)</span><span>{Math.round(volumes.lobby * 100)}%</span></label>
                            <input type="range" min="0" max="1" step="0.05" value={volumes.lobby} onChange={(e) => handleVolumeChange('lobby', e.target.value)} className="w-full accent-cyan-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                        </div>
                        <div>
                            <label className="flex justify-between text-xs font-bold text-gray-400 uppercase mb-2"><span>Nhạc Nhảy (Main Track)</span><span>{Math.round(volumes.track * 100)}%</span></label>
                            <input type="range" min="0" max="1" step="0.05" value={volumes.track} onChange={(e) => handleVolumeChange('track', e.target.value)} className="w-full accent-cyan-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                        </div>
                        <div>
                            <label className="flex justify-between text-xs font-bold text-gray-400 uppercase mb-2"><span>Hiệu ứng Trận (Level, Nhịp nghỉ)</span><span>{Math.round(volumes.sfx * 100)}%</span></label>
                            <input type="range" min="0" max="1" step="0.05" value={volumes.sfx} onChange={(e) => handleVolumeChange('sfx', e.target.value)} className="w-full accent-cyan-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                        </div>
                        <div>
                            <label className="flex justify-between text-xs font-bold text-gray-400 uppercase mb-2"><span>Đánh giá (Perfect, Sai nút)</span><span>{Math.round(volumes.judgment * 100)}%</span></label>
                            <input type="range" min="0" max="1" step="0.05" value={volumes.judgment} onChange={(e) => handleVolumeChange('judgment', e.target.value)} className="w-full accent-cyan-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                        </div>
                        <div>
                            <label className="flex justify-between text-xs font-bold text-gray-400 uppercase mb-2"><span>Nhạc Kết thúc trận</span><span>{Math.round(volumes.end * 100)}%</span></label>
                            <input type="range" min="0" max="1" step="0.05" value={volumes.end} onChange={(e) => handleVolumeChange('end', e.target.value)} className="w-full accent-cyan-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                        </div>
                    </div>
                </div>

                {/* --- PHẦN 2: CÀI ĐẶT MULTIPLAYER --- */}
                <div>
                    <h3 className="text-sm font-black text-white/50 uppercase tracking-widest mb-4 border-b border-white/10 pb-2">🎮 Multiplayer</h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-bold text-gray-400 uppercase">Hiển thị điểm Đối thủ / Đội</label>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={multiSettings.showOpponentScore} onChange={(e) => handleMultiSettingChange && handleMultiSettingChange('showOpponentScore', e.target.checked)} />
                                <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
                            </label>
                        </div>
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-bold text-gray-400 uppercase">Nhận lời mời ghép phòng</label>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={multiSettings.allowInvites} onChange={(e) => handleMultiSettingChange && handleMultiSettingChange('allowInvites', e.target.checked)} />
                                <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
                            </label>
                        </div>
                    </div>
                </div>
                
            </div>
        </div>
    </div>
  );
};

export default AuSettings;