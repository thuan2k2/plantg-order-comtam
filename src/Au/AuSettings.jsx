// src/Au/AuSettings.jsx
import React from 'react';

const AuSettings = ({ volumes, handleVolumeChange, setShowSettings }) => {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center animate-in fade-in">
        <div className="bg-gray-900 border border-white/20 p-8 rounded-[2rem] w-full max-w-md shadow-[0_0_50px_rgba(34,211,238,0.1)]">
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black italic text-cyan-400 uppercase tracking-widest">Cài đặt Âm thanh</h2>
                <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-white text-2xl transition-colors">✖</button>
            </div>
            <div className="space-y-6">
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
                    <label className="flex justify-between text-xs font-bold text-gray-400 uppercase mb-2"><span>Đánh giá (Perfect, Great, Sai nút)</span><span>{Math.round(volumes.judgment * 100)}%</span></label>
                    <input type="range" min="0" max="1" step="0.05" value={volumes.judgment} onChange={(e) => handleVolumeChange('judgment', e.target.value)} className="w-full accent-cyan-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                </div>
                <div>
                    <label className="flex justify-between text-xs font-bold text-gray-400 uppercase mb-2"><span>Nhạc Kết thúc trận</span><span>{Math.round(volumes.end * 100)}%</span></label>
                    <input type="range" min="0" max="1" step="0.05" value={volumes.end} onChange={(e) => handleVolumeChange('end', e.target.value)} className="w-full accent-cyan-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                </div>
            </div>
        </div>
    </div>
  );
};

export default AuSettings;