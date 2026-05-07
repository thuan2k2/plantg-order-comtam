import React, { useState, useEffect, useRef } from 'react';

// Tự động tạo mảng chứa 18 bài nhạc từ track1.mp3 đến track18.mp3
const MUSIC_TRACKS = Array.from({ length: 18 }, (_, i) => `/music/track${i + 1}.mp3`);

const ARROWS = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
const ARROW_SYMBOLS = { UP: '⬆️', DOWN: '⬇️', LEFT: '⬅️', RIGHT: '➡️' };

const AuGame = ({ onGameEnd, onCancel }) => {
  const [gameState, setGameState] = useState('CONFIRM'); // CONFIRM -> PLAYING -> SPINNING -> RESULT
  const [currentTrack, setCurrentTrack] = useState('');
  
  // Gameplay states
  const [targetSequence, setTargetSequence] = useState([]);
  const [userInput, setUserInput] = useState([]);
  const [sliderPos, setSliderPos] = useState(0);
  
  // Stats
  const [totalRounds, setTotalRounds] = useState(0);
  const [missCount, setMissCount] = useState(0);
  
  // Result states
  const [countdown, setCountdown] = useState(5); // Rút ngắn thời gian chờ
  const [rewardPercent, setRewardPercent] = useState(0);

  const audioRef = useRef(null);
  const requestRef = useRef();
  const startTimeRef = useRef();

  // Khởi tạo vòng nhảy mới với độ khó thay đổi ngẫu nhiên
  const generateNewSequence = () => {
    // Random độ dài chuỗi từ 4 đến 9 phím
    const length = Math.floor(Math.random() * 6) + 4; 
    const seq = Array.from({ length }, () => ARROWS[Math.floor(Math.random() * ARROWS.length)]);
    setTargetSequence(seq);
    setUserInput([]);
  };

  // Bắt đầu game
  const startGame = () => {
    // Bốc ngẫu nhiên 1 bài hát trong số 18 bài
    const randomMusic = MUSIC_TRACKS[Math.floor(Math.random() * MUSIC_TRACKS.length)];
    setCurrentTrack(randomMusic);
    setGameState('PLAYING');
    generateNewSequence();
    if (audioRef.current) {
      audioRef.current.play();
    }
  };

  // Vòng lặp thanh trượt (Slider)
  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    // Thay đổi tốc độ thanh trượt ngẫu nhiên cho mỗi bài nhạc (từ 2s đến 3s)
    const DURATION = Math.floor(Math.random() * 1000) + 2000; 

    const animate = (time) => {
      if (!startTimeRef.current) startTimeRef.current = time;
      const elapsed = time - startTimeRef.current;
      const progress = (elapsed % DURATION) / DURATION;
      
      setSliderPos(progress * 100);
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [gameState]);

  // Bắt sự kiện bàn phím
  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    const handleKeyDown = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const keyMap = { ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT' };
        setUserInput((prev) => {
          if (prev.length < targetSequence.length) {
            return [...prev, keyMap[e.key]];
          }
          return prev;
        });
      }

      // Khi bấm Spacebar
      if (e.code === 'Space') {
        e.preventDefault();
        setTotalRounds(prev => prev + 1);
        
        // Kiểm tra Vùng Perfect (Giả sử vùng sáng từ 80% đến 95%)
        const inHitZone = sliderPos >= 80 && sliderPos <= 95;
        
        // Kiểm tra phím đã gõ có đúng không
        const isSequenceCorrect = targetSequence.length > 0 && 
            targetSequence.length === userInput.length && 
            targetSequence.every((val, index) => val === userInput[index]);

        if (inHitZone && isSequenceCorrect) {
          // Thành công
        } else {
          // Miss
          setMissCount(prev => prev + 1);
        }
        
        // Tạo nhịp mới
        generateNewSequence();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, targetSequence, userInput, sliderPos]);

  // Kết thúc nhạc -> Xử lý kết quả
  const handleAudioEnd = () => {
    setGameState('SPINNING');
    
    // Tính toán Miss Rate
    const missRate = totalRounds > 0 ? (missCount / totalRounds) : 1; // Nếu không chơi gì coi như miss 100%
    
    if (missRate > 0.05) { // Miss trên 5%
        setRewardPercent(-1); // Mã lỗi cho thất bại
    } else {
        // RNG Logic
        const rand = Math.random() * 100;
        let percent = 0;
        if (rand < 99.999) { // 99.999% rớt vào mốc thường
            const common = [10, 20, 30, 40];
            percent = common[Math.floor(Math.random() * common.length)];
        } else { // 0.001% rớt vào mốc siêu hiếm
            const rare = [50, 60, 70, 80, 90, 100];
            percent = rare[Math.floor(Math.random() * rare.length)];
        }
        setRewardPercent(percent);
    }

    // Đếm ngược random từ 3 đến 5 giây để tạo cảm giác hồi hộp nhưng không quá lâu
    let counter = Math.floor(Math.random() * 3) + 3;
    setCountdown(counter);
    
    const interval = setInterval(() => {
        counter--;
        setCountdown(counter);
        if (counter <= 0) {
            clearInterval(interval);
            setGameState('RESULT');
        }
    }, 1000);
  };

  const finishGame = () => {
    // Trả kết quả về component cha (Home) để cộng/trừ xu
    onGameEnd(rewardPercent);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl border border-gray-700 p-6 max-w-lg w-full text-white shadow-2xl relative overflow-hidden">
        
        {/* MÀN HÌNH XÁC NHẬN */}
        {gameState === 'CONFIRM' && (
          <div className="text-center space-y-6">
            <h2 className="text-2xl font-bold text-yellow-400">🎮 AU Nhân Phẩm</h2>
            <p className="text-gray-300">
              Tham gia trò chơi nhảy AU với mức phí <span className="font-bold text-white">5.000 Xu</span>.
              <br /> Gõ đúng phím mũi tên và ấn <b>Space</b> ngay vạch sáng để hoàn thành nhịp.
              <br /> Lệch nhịp quá 5% sẽ bị tính là thua cuộc. Bạn đã sẵn sàng?
            </p>
            <div className="flex justify-center gap-4">
              <button onClick={onCancel} className="px-6 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition">Từ chối</button>
              <button onClick={startGame} className="px-6 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-black font-bold transition shadow-[0_0_15px_rgba(234,179,8,0.5)]">Đồng ý (-5000 Xu)</button>
            </div>
          </div>
        )}

        {/* MÀN HÌNH GAMEPLAY */}
        {gameState === 'PLAYING' && (
          <div className="space-y-8 py-4">
            <audio ref={audioRef} src={currentTrack} onEnded={handleAudioEnd} className="hidden" />
            
            <div className="text-center text-xl font-bold text-yellow-400 tracking-widest flex justify-center gap-3 min-h-[40px]">
              {targetSequence.map((dir, idx) => {
                  const isTyped = idx < userInput.length;
                  const isCorrect = isTyped && userInput[idx] === dir;
                  const isWrong = isTyped && userInput[idx] !== dir;
                  return (
                      <span key={idx} className={`text-4xl transition-all ${isCorrect ? 'opacity-30' : ''} ${isWrong ? 'text-red-500 scale-125' : ''}`}>
                          {ARROW_SYMBOLS[dir]}
                      </span>
                  );
              })}
            </div>

            {/* Thanh trượt */}
            <div className="relative w-full h-8 bg-gray-800 rounded-full border-2 border-gray-700 overflow-hidden shadow-inner">
               {/* Vùng hit zone (80% - 95%) */}
              <div className="absolute top-0 bottom-0 left-[80%] right-[5%] bg-gradient-to-r from-blue-500/20 to-blue-400/50 border-l border-r border-blue-400"></div>
              {/* Vạch phát sáng */}
              <div className="absolute top-0 bottom-0 right-[12%] w-1 bg-white shadow-[0_0_10px_#fff]"></div>
              
              {/* Con chạy */}
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-yellow-400 rounded-full shadow-[0_0_10px_#facc15]"
                style={{ left: `${sliderPos}%` }}
              ></div>
            </div>

            <div className="flex justify-between text-sm text-gray-400">
               <span>Miss: <span className="text-red-400 font-bold">{missCount}</span></span>
               <span>Beat: {totalRounds}</span>
            </div>
          </div>
        )}

        {/* MÀN HÌNH CHỜ QUAY (SPINNING) */}
        {gameState === 'SPINNING' && (
          <div className="text-center space-y-6 py-6">
            <h2 className="text-xl font-bold text-blue-400 animate-pulse">Hệ thống đang kiểm tra nhân phẩm...</h2>
            <div className="w-full bg-gray-800 h-4 rounded-full overflow-hidden">
                <div 
                    className="bg-blue-500 h-full transition-all duration-1000 ease-linear"
                    style={{ width: `${(5 - countdown) * 20}%` }}
                ></div>
            </div>
            <p className="text-4xl font-bold text-white">{countdown}s</p>
          </div>
        )}

        {/* MÀN HÌNH KẾT QUẢ */}
        {gameState === 'RESULT' && (
          <div className="text-center space-y-6">
            {rewardPercent === -1 ? (
               <>
                 <div className="text-6xl mb-4">💔</div>
                 <h2 className="text-2xl font-bold text-red-500">THẤT BẠI!</h2>
                 <p className="text-gray-300">Bạn đã nhảy miss quá 5% ({missCount}/{totalRounds} nhịp). Chúc bạn may mắn lần sau!</p>
               </>
            ) : (
               <>
                 <div className="text-6xl mb-4">🎉</div>
                 <h2 className="text-2xl font-bold text-green-400">THÀNH CÔNG!</h2>
                 <p className="text-gray-300">Nhân phẩm bùng nổ! Bạn nhận được thưởng <b>{rewardPercent}%</b>.</p>
                 <p className="text-xl font-bold text-yellow-400">
                    Tổng nhận: {(5000 + (5000 * rewardPercent / 100)).toLocaleString()} Xu
                 </p>
               </>
            )}
            <button onClick={finishGame} className="mt-4 px-8 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 font-bold transition w-full">Đóng</button>
          </div>
        )}

      </div>
    </div>
  );
};

export default AuGame;