import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

// Fix đường dẫn: Bỏ chữ /public/ vì Vite sẽ tự động map thư mục public ra root (/)
const MUSIC_TRACKS = Array.from({ length: 18 }, (_, i) => `/music/track${i + 1}.mp3`);

const ARROWS = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
const ARROW_SYMBOLS = { UP: '⬆️', DOWN: '⬇️', LEFT: '⬅️', RIGHT: '➡️' };

const AuGame = () => {
  const navigate = useNavigate();
  const [gameState, setGameState] = useState('CONFIRM'); // CONFIRM -> PREPARING -> PLAYING -> SPINNING -> RESULT
  const [currentTrack, setCurrentTrack] = useState('');
  
  const [savedPhone, setSavedPhone] = useState('');
  const [totalXu, setTotalXu] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Gameplay states
  const [targetSequence, setTargetSequence] = useState([]);
  const [userInput, setUserInput] = useState([]);
  const [sliderPos, setSliderPos] = useState(0);
  
  // Stats
  const [totalRounds, setTotalRounds] = useState(0);
  const [missCount, setMissCount] = useState(0);
  
  // Result states
  const [prepCountdown, setPrepCountdown] = useState(3); // Đếm ngược 3s chuẩn bị
  const [countdown, setCountdown] = useState(5);
  const [rewardPercent, setRewardPercent] = useState(0);

  const audioRef = useRef(null);
  const requestRef = useRef();
  
  // MỚI: Ref dùng cho Anti-Cheat
  const startTimeRef = useRef();
  const gameStartTimeRef = useRef(0);
  const isClaimedRef = useRef(false);

  // Khởi tạo lấy dữ liệu user
  useEffect(() => {
    const fetchUser = async () => {
      const phones = JSON.parse(localStorage.getItem('recentPhones') || '[]');
      if (phones.length > 0) {
        setSavedPhone(phones[0]);
        const userSnap = await getDoc(doc(db, 'users', phones[0]));
        if (userSnap.exists()) {
          // Lấy chuẩn dữ liệu dạng Number để tránh lỗi Rollback của Firebase
          setTotalXu(Number(userSnap.data().totalXu || userSnap.data().coins || 0));
        }
      } else {
        alert("Vui lòng đăng nhập trước khi chơi!");
        navigate('/');
      }
      setIsLoading(false);
    };
    fetchUser();
  }, [navigate]);

  // Khởi tạo vòng nhảy mới với độ khó thay đổi ngẫu nhiên
  const generateNewSequence = () => {
    const length = Math.floor(Math.random() * 6) + 4; // 4 đến 9 mũi tên
    const seq = Array.from({ length }, () => ARROWS[Math.floor(Math.random() * ARROWS.length)]);
    setTargetSequence(seq);
    setUserInput([]);
  };

  // Bắt đầu game và trừ Xu
  const startGame = async () => {
    if (totalXu < 5000) {
      alert("Bạn không đủ 5.000 Xu để tham gia trò chơi này!");
      return;
    }

    try {
      // FIX LỖI NHẢY ĐIỂM: Fetch số dư mới nhất và trừ tĩnh thay vì dùng increment
      const userRef = doc(db, 'users', savedPhone);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const currentDbXu = Number(userSnap.data().totalXu || userSnap.data().coins || 0);
        if (currentDbXu < 5000) {
            alert("Số dư thực tế không đủ, vui lòng tải lại trang!");
            return;
        }
        
        const newXu = currentDbXu - 5000;
        await updateDoc(userRef, { 
            totalXu: newXu,
            lastUpdateSource: 'au_game_fee' // Khai báo nguồn cập nhật hợp lệ
        });
        
        setTotalXu(newXu);
        isClaimedRef.current = false; // Reset cờ chống nhận đúp

        const randomMusic = MUSIC_TRACKS[Math.floor(Math.random() * MUSIC_TRACKS.length)];
        setCurrentTrack(randomMusic);
        
        // Chuyển sang trạng thái Đếm ngược chuẩn bị
        setPrepCountdown(3);
        setGameState('PREPARING');
      }
    } catch (error) {
      console.error("Lỗi trừ xu:", error);
      alert("Lỗi kết nối máy chủ, vui lòng thử lại!");
    }
  };

  // Logic Đếm ngược 3s trước khi nhảy
  useEffect(() => {
    if (gameState === 'PREPARING') {
      if (prepCountdown > 0) {
        const timer = setTimeout(() => setPrepCountdown(prev => prev - 1), 1000);
        return () => clearTimeout(timer);
      } else {
        // Đếm xong thì kích hoạt nhạc và thanh trượt
        setGameState('PLAYING');
        generateNewSequence();
        // Lưu thời điểm bắt đầu game thực tế để Anti-cheat
        gameStartTimeRef.current = Date.now();
      }
    }
  }, [gameState, prepCountdown]);

  // Cố gắng ép phát nhạc khi đã chuyển sang trạng thái PLAYING
  useEffect(() => {
    if (gameState === 'PLAYING' && currentTrack && audioRef.current) {
        audioRef.current.load(); // Bắt buộc tải lại source mới
        audioRef.current.play().catch(e => {
            console.error("Trình duyệt chặn Audio AutoPlay:", e);
            alert("Vui lòng tương tác với màn hình để phát nhạc!");
        });
    }
  }, [gameState, currentTrack]);

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
    const missRate = totalRounds > 0 ? (missCount / totalRounds) : 1; 
    
    if (missRate > 0.05) { // Miss trên 5%
        setRewardPercent(-1); 
    } else {
        const rand = Math.random() * 100;
        let percent = 0;
        if (rand < 99.999) { 
            const common = [10, 20, 30, 40];
            percent = common[Math.floor(Math.random() * common.length)];
        } else { 
            const rare = [50, 60, 70, 80, 90, 100];
            percent = rare[Math.floor(Math.random() * rare.length)];
        }
        setRewardPercent(percent);
    }

    // Đếm ngược random từ 3 đến 5 giây
    let counter = Math.floor(Math.random() * 3) + 3;
    setCountdown(counter);
    
    const interval = setInterval(() => {
        counter--;
        setCountdown(counter);
        if (counter <= 0) {
            clearInterval(interval);
            setGameState('RESULT');
            applyRewardResult(missRate > 0.05 ? -1 : percent);
        }
    }, 1000);
  };

  // Cộng thưởng vào Database với ANTI-CHEAT
  const applyRewardResult = async (percent) => {
    if (percent === -1) return; // Thua cuộc không làm gì
    
    // ANTI-CHEAT 1: Ngăn chặn Spam gọi hàm nhiều lần
    if (isClaimedRef.current) return;
    
    // ANTI-CHEAT 2: Thời gian chơi thực tế phải hợp lý (Ví dụ nhạc ngắn nhất là 30s -> Min 20s chơi)
    const timePlayed = Date.now() - gameStartTimeRef.current;
    if (timePlayed < 20000) {
        console.warn(`ANTI-CHEAT ALERT: Khách hàng ${savedPhone} có dấu hiệu dùng Tool skip nhạc (Time: ${timePlayed}ms).`);
        alert("Kết quả không hợp lệ do phát hiện bất thường trong thời gian chơi!");
        return;
    }

    // Lock cờ đã nhận
    isClaimedRef.current = true;
    
    const rewardAmount = 5000 + (5000 * (percent / 100));

    try {
        // Lấy lại số dư mới nhất trên Server thay vì dùng increment để tránh lỗi Type String/Number
        const userRef = doc(db, 'users', savedPhone);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            const currentDbXu = Number(userSnap.data().totalXu || userSnap.data().coins || 0);
            const newXu = currentDbXu + rewardAmount;
            
            await updateDoc(userRef, { 
                totalXu: newXu,
                lastUpdateSource: 'au_game_reward' // Khai báo nguồn hợp lệ
            });
            
            setTotalXu(newXu);
        }
    } catch (error) {
        console.error("Lỗi cộng xu thưởng:", error);
    }
  };

  if (isLoading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Đang tải...</div>;

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4 relative">
      
      {/* NÚT QUAY LẠI TRANG CHỦ */}
      <div className="absolute top-6 left-6 z-50">
        <button 
          onClick={() => navigate('/')}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white rounded-xl shadow-lg border border-gray-700 transition-all active:scale-95"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          <span className="font-bold uppercase text-xs tracking-widest">Trang chủ</span>
        </button>
      </div>

      {/* Hiển thị Xu hiện tại */}
      <div className="absolute top-6 right-6 z-50">
         <div className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 flex items-center gap-2 shadow-lg">
             <span className="text-xl">🪙</span>
             <span className="font-black text-yellow-400">{totalXu.toLocaleString()} Xu</span>
         </div>
      </div>

      <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700 rounded-3xl p-8 max-w-2xl w-full text-white shadow-2xl relative overflow-hidden">
        
        {/* MÀN HÌNH XÁC NHẬN */}
        {gameState === 'CONFIRM' && (
          <div className="text-center space-y-6">
            <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 uppercase tracking-widest drop-shadow-sm">🎮 AU Nhân Phẩm</h2>
            <div className="bg-gray-900/50 p-6 rounded-2xl border border-gray-700/50">
                <p className="text-gray-300 leading-relaxed text-sm">
                Tham gia trò chơi nhảy nhịp điệu với mức phí <span className="font-bold text-yellow-400">5.000 Xu</span>.
                <br /><br /> 
                <span className="text-blue-400 font-bold">CÁCH CHƠI:</span> Gõ đúng các phím mũi tên và ấn <kbd className="bg-gray-700 px-2 py-1 rounded text-white font-mono border-b-2 border-gray-600">Space</kbd> ngay vạch sáng để hoàn thành nhịp.
                <br /> Lệch nhịp quá 5% sẽ bị tính là thua cuộc. Bạn đã sẵn sàng thử thách nhân phẩm?
                </p>
            </div>
            <div className="flex justify-center gap-4 mt-8">
              <button onClick={() => navigate('/')} className="px-8 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 font-bold uppercase tracking-widest text-xs transition-all shadow-lg">Từ chối</button>
              <button onClick={startGame} className="px-8 py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-black uppercase tracking-widest text-xs transition-all shadow-[0_0_20px_rgba(234,179,8,0.4)] hover:shadow-[0_0_30px_rgba(234,179,8,0.6)] hover:scale-105 active:scale-95">
                Đồng ý (-5000 Xu)
              </button>
            </div>
          </div>
        )}

        {/* MÀN HÌNH CHỜ ĐẾM NGƯỢC (PREPARING) */}
        {gameState === 'PREPARING' && (
          <div className="text-center space-y-8 py-16 flex flex-col items-center justify-center">
            <h2 className="text-2xl font-black text-white uppercase tracking-widest animate-pulse drop-shadow-md">Chuẩn bị!</h2>
            <div className="text-[10rem] leading-none font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-orange-600 drop-shadow-[0_0_30px_rgba(250,204,21,0.6)] animate-bounce">
              {prepCountdown > 0 ? prepCountdown : 'GO!'}
            </div>
          </div>
        )}

        {/* MÀN HÌNH GAMEPLAY */}
        {gameState === 'PLAYING' && (
          <div className="space-y-10 py-8">
            <audio ref={audioRef} src={currentTrack} onEnded={handleAudioEnd} className="hidden" preload="auto" />
            
            {/* Chống tràn nút mũi tên */}
            <div className="text-center font-bold text-yellow-400 tracking-widest flex flex-wrap justify-center items-center gap-2 sm:gap-4 min-h-[60px] px-4">
              {targetSequence.map((dir, idx) => {
                  const isTyped = idx < userInput.length;
                  const isCorrect = isTyped && userInput[idx] === dir;
                  const isWrong = isTyped && userInput[idx] !== dir;
                  return (
                      <span key={idx} className={`text-3xl sm:text-5xl transition-all duration-200 ${isCorrect ? 'opacity-20 scale-90' : ''} ${isWrong ? 'text-red-500 scale-125 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]' : 'drop-shadow-md'}`}>
                          {ARROW_SYMBOLS[dir]}
                      </span>
                  );
              })}
            </div>

            {/* Thanh trượt */}
            <div className="relative w-full h-10 bg-gray-900 rounded-full border border-gray-600 overflow-hidden shadow-[inset_0_4px_10px_rgba(0,0,0,0.5)]">
               {/* Vùng hit zone (80% - 95%) */}
              <div className="absolute top-0 bottom-0 left-[80%] right-[5%] bg-gradient-to-r from-blue-500/30 to-blue-400/60 border-l border-r border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>
              {/* Vạch phát sáng */}
              <div className="absolute top-0 bottom-0 right-[12%] w-1.5 bg-white shadow-[0_0_15px_#fff]"></div>
              
              {/* Con chạy */}
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-6 h-6 bg-yellow-400 rounded-full shadow-[0_0_15px_#facc15] border-2 border-white"
                style={{ left: `${sliderPos}%` }}
              ></div>
            </div>

            <div className="flex justify-between items-center bg-gray-900/50 px-6 py-3 rounded-2xl border border-gray-700/50">
               <span className="text-gray-400 font-bold tracking-widest text-sm uppercase">Miss: <span className="text-red-500 font-black ml-1 text-lg">{missCount}</span></span>
               <span className="text-gray-400 font-bold tracking-widest text-sm uppercase">Beat: <span className="text-blue-400 font-black ml-1 text-lg">{totalRounds}</span></span>
            </div>
          </div>
        )}

        {/* MÀN HÌNH CHỜ QUAY (SPINNING) */}
        {gameState === 'SPINNING' && (
          <div className="text-center space-y-8 py-10">
            <h2 className="text-2xl font-black text-blue-400 animate-pulse tracking-widest uppercase">Tính toán nhân phẩm...</h2>
            <div className="w-full bg-gray-900 h-6 rounded-full overflow-hidden border border-gray-700 p-1">
                <div 
                    className="bg-gradient-to-r from-blue-600 to-blue-400 h-full rounded-full transition-all duration-1000 ease-linear shadow-[0_0_15px_rgba(59,130,246,0.6)]"
                    style={{ width: `${(5 - countdown) * 20}%` }}
                ></div>
            </div>
            <p className="text-6xl font-black text-white font-mono drop-shadow-md">{countdown}</p>
          </div>
        )}

        {/* MÀN HÌNH KẾT QUẢ */}
        {gameState === 'RESULT' && (
          <div className="text-center space-y-6 py-4 animate-in zoom-in duration-300">
            {rewardPercent === -1 ? (
               <>
                 <div className="text-7xl mb-6 drop-shadow-lg">💔</div>
                 <h2 className="text-4xl font-black text-red-500 uppercase tracking-widest drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]">THẤT BẠI!</h2>
                 <p className="text-gray-400 text-lg">Bạn đã nhảy miss quá 5% ({missCount}/{totalRounds} nhịp). Chúc bạn may mắn lần sau!</p>
               </>
            ) : (
               <>
                 <div className="text-7xl mb-6 drop-shadow-lg">🎉</div>
                 <h2 className="text-4xl font-black text-green-400 uppercase tracking-widest drop-shadow-[0_0_15px_rgba(74,222,128,0.5)]">THÀNH CÔNG!</h2>
                 <p className="text-gray-400 text-lg">Nhân phẩm bùng nổ! Bạn nhận được tỷ lệ thưởng <b>{rewardPercent}%</b>.</p>
                 
                 <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-6 inline-block mt-4 w-full">
                     <p className="text-sm font-bold text-yellow-500/80 uppercase tracking-widest mb-1">Tổng xu nhận về</p>
                     <p className="text-4xl font-black text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.4)]">
                        +{(5000 + (5000 * rewardPercent / 100)).toLocaleString()} Xu
                     </p>
                 </div>
               </>
            )}
            <button onClick={() => { setGameState('CONFIRM'); setTotalRounds(0); setMissCount(0); }} className="mt-8 px-8 py-4 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-black uppercase tracking-widest w-full transition-all border border-gray-600 hover:border-gray-500 shadow-lg active:scale-95">Chơi Lại</button>
          </div>
        )}

      </div>
    </div>
  );
};

export default AuGame;