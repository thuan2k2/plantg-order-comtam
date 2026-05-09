import React, { useState, useEffect, useRef } from 'react';

const ARROW_SYMBOLS = { UP: '⬆️', DOWN: '⬇️', LEFT: '⬅️', RIGHT: '➡️' };
const OPPOSITE_KEYS = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' };

const BeatmapMaker = () => {
  const [audioSrc, setAudioSrc] = useState(null);
  const [currentSequence, setCurrentSequence] = useState([]);
  const [savedMeasures, setSavedMeasures] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const audioRef = useRef(null);

  // Xử lý upload file nhạc local để test
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAudioSrc(url);
    }
  };

  // Bắt sự kiện bàn phím để Record
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Chỉ nhận phím khi đang bật chế độ Ghi âm
      if (!isRecording) return;

      const keyMap = { ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT' };
      
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const dir = keyMap[e.key];
        const isRed = e.shiftKey; // Giữ Shift để tạo phím ĐỎ (Ngược)

        setCurrentSequence(prev => [
          ...prev, 
          { 
            display: dir, 
            actual: isRed ? OPPOSITE_KEYS[dir] : dir, 
            isRed: isRed 
          }
        ]);
      }

      // Xóa phím gõ nhầm (Backspace)
      if (e.key === 'Backspace') {
        e.preventDefault();
        setCurrentSequence(prev => prev.slice(0, -1));
      }

      // Chốt 1 lượt nhảy (Space)
      if (e.code === 'Space') {
        e.preventDefault();
        if (currentSequence.length > 0) {
            setSavedMeasures(prev => [...prev, currentSequence]);
            setCurrentSequence([]); // Reset chuỗi hiện tại
        } else {
            // Nếu không gõ gì mà bấm Space -> Nghỉ 1 nhịp (Mảng rỗng)
            setSavedMeasures(prev => [...prev, []]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRecording, currentSequence]);

  // Xóa lượt vừa lưu
  const undoLastMeasure = () => {
    setSavedMeasures(prev => prev.slice(0, -1));
  };

  // ĐÃ THÊM: Xóa toàn bộ dữ liệu Beatmap
  const clearAllMeasures = () => {
    if (savedMeasures.length === 0) return;
    if (window.confirm("⚠️ Bạn có chắc chắn muốn xóa TOÀN BỘ dữ liệu Beatmap đã ghi không?")) {
      setSavedMeasures([]);
      setCurrentSequence([]);
    }
  };

  // Copy JSON ra Clipboard
  const copyJson = () => {
    const jsonString = JSON.stringify(savedMeasures, null, 2);
    navigator.clipboard.writeText(jsonString);
    alert("Đã Copy Code Beatmap vào Khay nhớ tạm! Dán vào file config nhạc của bạn nhé.");
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 font-sans">
      <header className="mb-8 border-b border-gray-700 pb-4 flex justify-between items-center">
        <div>
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500 uppercase tracking-widest">🎵 Beatmap Maker</h1>
            <p className="text-gray-400 mt-2">Công cụ tự động hóa tạo phím nhảy cho Au Plant G</p>
        </div>
        <button onClick={copyJson} className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-xl font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-500/30">
            📋 Copy JSON
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* PANEL TRÁI: ĐIỀU KHIỂN & GÕ PHÍM */}
        <div className="space-y-6">
            <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 shadow-xl">
                <h2 className="font-bold uppercase text-gray-400 mb-4 tracking-widest text-xs">1. Tải nhạc (Chạy Offline)</h2>
                <input type="file" accept="audio/mp3" onChange={handleFileUpload} className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer" />
                
                {audioSrc && (
                    <div className="mt-4">
                        <audio ref={audioRef} src={audioSrc} controls className="w-full rounded-lg outline-none" />
                    </div>
                )}
            </div>

            <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 shadow-xl">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="font-bold uppercase text-gray-400 tracking-widest text-xs">2. Bàn phím ghi âm</h2>
                    <button 
                        onClick={() => {
                            setIsRecording(!isRecording);
                            if (!isRecording && audioRef.current) audioRef.current.play();
                            if (isRecording && audioRef.current) audioRef.current.pause();
                        }} 
                        className={`px-4 py-2 rounded-full font-black text-xs uppercase tracking-widest transition-all ${isRecording ? 'bg-red-500 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-gray-700'}`}
                    >
                        {isRecording ? '🔴 Đang Ghi' : 'Bật Ghi Âm'}
                    </button>
                </div>

                <ul className="text-xs text-gray-400 space-y-2 bg-black/30 p-4 rounded-xl mb-6">
                    <li><b className="text-white">Mũi tên:</b> Gõ phím Xanh thường.</li>
                    <li><b className="text-red-400">Shift + Mũi tên:</b> Gõ phím Đỏ (Ngược).</li>
                    <li><b className="text-yellow-400">Space:</b> Chốt nhịp, chuyển sang lượt tiếp theo.</li>
                    <li><b className="text-gray-500">Backspace:</b> Xóa phím vừa gõ sai.</li>
                </ul>

                <div className="bg-black p-8 rounded-2xl min-h-[120px] flex items-center justify-center flex-wrap gap-4 border-2 border-dashed border-gray-700">
                    {currentSequence.length === 0 ? (
                        <span className="text-gray-600 italic">Đang chờ gõ phím...</span>
                    ) : (
                        currentSequence.map((item, idx) => (
                            <span key={idx} className={`text-5xl ${item.isRed ? 'text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]' : 'text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,0.8)]'}`}>
                                {ARROW_SYMBOLS[item.display]}
                            </span>
                        ))
                    )}
                </div>
            </div>
        </div>

        {/* PANEL PHẢI: KẾT QUẢ ĐÃ LƯU */}
        <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 shadow-xl flex flex-col h-[75vh]">
            <div className="flex justify-between items-center mb-6">
                <h2 className="font-bold uppercase text-gray-400 tracking-widest text-xs">3. Dữ liệu Beatmap ({savedMeasures.length} Lượt)</h2>
                
                {/* ĐÃ SỬA: Thêm cụm nút quản lý */}
                <div className="flex gap-2">
                    <button onClick={undoLastMeasure} className="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all">↩️ Undo</button>
                    <button onClick={clearAllMeasures} className="bg-red-900/40 hover:bg-red-600 text-red-300 hover:text-white border border-red-800/50 px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all">🗑️ Xóa hết</button>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto bg-black/50 p-4 rounded-xl space-y-3 font-mono text-sm border border-gray-700">
                {savedMeasures.map((measure, index) => (
                    <div key={index} className="flex items-center gap-4 bg-gray-900 p-3 rounded-lg">
                        <span className="text-gray-500 font-bold w-8">#{index + 1}</span>
                        <div className="flex gap-2">
                            {measure.length === 0 ? (
                                <span className="text-gray-600 italic">-- Nghỉ (Không có phím) --</span>
                            ) : (
                                measure.map((k, i) => (
                                    <span key={i} className={k.isRed ? 'text-red-400' : 'text-green-400'}>{ARROW_SYMBOLS[k.display]}</span>
                                ))
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>

      </div>
    </div>
  );
};

export default BeatmapMaker;