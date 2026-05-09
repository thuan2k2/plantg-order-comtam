import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getRankInfo } from '../utils/rankUtils';

const ARROW_SYMBOLS = { UP: '⬆️', DOWN: '⬇️', LEFT: '⬅️', RIGHT: '➡️' };
const OPPOSITE_KEYS = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' };

const AuGame = () => {
  const navigate = useNavigate();
  const [gameState, setGameState] = useState('LOBBY'); 
  const [isPaused, setIsPaused] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [userData, setUserData] = useState({ phone: '', name: '', rankId: '' });
  const [leaderboard, setLeaderboard] = useState([]);
  const [musicList, setMusicList] = useState([]);
  const [isLoadingMusic, setIsLoadingMusic] = useState(true);

  // Gameplay States (UI)
  const [hp, setHp] = useState(100);
  const [level, setLevel] = useState(4); 
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [judgment, setJudgment] = useState(null); 
  const [stats, setStats] = useState({ perfect: 0, great: 0, cool: 0, bad: 0, miss: 0 });
  const [sliderPos, setSliderPos] = useState(0);
  const [userInput, setUserInput] = useState([]);
  const [targetSequence, setTargetSequence] = useState([]);
  const [isFailedSeq, setIsFailedSeq] = useState(false);
  const [musicProgress, setMusicProgress] = useState(0);
  const [measureIndex, setMeasureIndex] = useState(0);

  // Visual Effects
  const [isShaking, setIsShaking] = useState(false);
  const [burstEffect, setBurstEffect] = useState(false);
  const [loadProgress, setLoadMusicProgress] = useState(0);
  const [prepCountdown, setPrepCountdown] = useState(3);

  const audioRef = useRef(null);
  const requestRef = useRef();

  // --- REFS CHO GAME LOOP (Phản hồi tức thì, không bị delay bởi State) ---
  const cycleRef = useRef(0); // Theo dõi số vòng của quả cầu
  const hasJudgedRef = useRef(false); // Đã bấm Space ở vòng này chưa?
  const targetSeqRef = useRef([]); // Dãy phím hiện tại
  const userInputRef = useRef([]); // Phím người chơi vừa gõ
  const isFailedSeqRef = useRef(false); // Gõ sai chưa?
  const levelRef = useRef(4); // Cấp độ hiện tại

  useEffect(() => {
    const fetchUser = async () => {
      try {
          const phones = JSON.parse(localStorage.getItem('recentPhones') || '[]');
          if (phones.length > 0) {
              const userSnap = await getDoc(doc(db, 'users', phones[0]));
              if (userSnap.exists()) {
                  const data = userSnap.data();
                  const rankInfo = getRankInfo(data.totalSpend || 0, data.manualRankId);
                  setUserData({ phone: phones[0], name: data.fullName || 'Người chơi', rankId: rankInfo.current.id });
              }
          } else { navigate('/'); }
      } catch (error) { console.error("Lỗi lấy thông tin:", error); }
    };
    fetchUser();
    fetchGlobalLeaderboard(); 
    fetchMusicTracks(); 
  }, [navigate]);

  const fetchMusicTracks = async () => {
    setIsLoadingMusic(true);
    try {
        const q = query(collection(db, 'au_tracks'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        const tracks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMusicList(tracks);
    } catch (e) { console.error(e); }
    setIsLoadingMusic(false);
  };

  const fetchGlobalLeaderboard = async () => {
    try {
        const lbRef = collection(db, 'au_global_leaderboard');
        const q = query(lbRef, orderBy('bestScore', 'desc'), limit(10));
        const querySnapshot = await getDocs(q);
        setLeaderboard(querySnapshot.docs.map(d => d.data()));
    } catch (e) { setLeaderboard([]); }
  };

  const selectTrack = async (track) => {
    if (track.requiredRank && userData.rankId !== track.requiredRank) return;
    setGameState('LOADING');
    setLoadMusicProgress(0);

    let loadedBeatmap = null;
    try {
        const response = await fetch(`/music/beatmap/${track.id}.json`);
        if (response.ok) { loadedBeatmap = await response.json(); }
    } catch (e) {}

    setCurrentTrack({ ...track, beatmap: loadedBeatmap });

    let prog = 0;
    const interval = setInterval(() => {
        prog += Math.random() * 25;
        if (prog >= 100) {
            setLoadMusicProgress(100); clearInterval(interval);
            setTimeout(() => {
                setGameState('PREPARING'); 
                setPrepCountdown(3); setHp(100); setScore(0); setCombo(0); setMusicProgress(0);
            }, 500);
        } else setLoadMusicProgress(prog);
    }, 150);
  };

  // NẠP KỊCH BẢN PHÍM TỪ BEATMAP VÀO LƯỢT TIẾP THEO
  const loadNextMeasure = (index) => {
    let newSeq = [];
    const currentLv = levelRef.current;

    if (currentTrack && currentTrack.beatmap && currentTrack.beatmap[index]) {
        newSeq = currentTrack.beatmap[index];
    } else if (!currentTrack.beatmap) {
        // Chỉ tự sinh phím nếu bài này chưa có file Beatmap
        const redChance = currentLv > 6 ? (currentLv - 5) * 0.12 : 0;
        for(let i = 0; i < currentLv; i++) {
            const dir = ['UP', 'DOWN', 'LEFT', 'RIGHT'][Math.floor(Math.random() * 4)];
            const isRed = Math.random() < redChance;
            newSeq.push({ display: dir, actual: isRed ? OPPOSITE_KEYS[dir] : dir, isRed });
        }
    } 
    // Nếu có file beatmap nhưng hết mảng (beatmap[index] undefined) -> newSeq = [] (Coi như nghỉ)

    // Reset các trạng thái cho lượt mới
    targetSeqRef.current = newSeq;
    userInputRef.current = [];
    isFailedSeqRef.current = false;
    hasJudgedRef.current = false;

    // Cập nhật UI
    setTargetSequence(newSeq);
    setUserInput([]);
    setIsFailedSeq(false);
  };

  useEffect(() => {
    if (gameState === 'PREPARING') {
      if (prepCountdown > 0) {
        const t = setTimeout(() => setPrepCountdown(prev => prev - 1), 1000);
        return () => clearTimeout(t);
      } else {
        setGameState('PLAYING');
        const initialLv = currentTrack.difficulty === 'Expert' ? 8 : currentTrack.difficulty === 'Hard' ? 7 : 4;
        setLevel(initialLv);
        levelRef.current = initialLv;
        cycleRef.current = 0;
        setMeasureIndex(0);
        loadNextMeasure(0);
      }
    }
  }, [gameState, prepCountdown, currentTrack]);

  // HÀM XỬ LÝ KẾT QUẢ TÍNH ĐIỂM
  const processJudgment = (judg) => {
    setJudgment({ text: judg, id: Date.now() });
    setTimeout(() => setJudgment(prev => prev?.text === judg ? null : prev), 400);

    const k = judg.toLowerCase();
    setStats(prev => ({ ...prev, [k]: prev[k] + 1 }));

    let scoreAdd = 0;
    let isSuccess = false;

    setCombo(prevCombo => {
        let newCombo = 0;
        if (judg === 'PERFECT') { scoreAdd = 500 + (prevCombo * 50); newCombo = prevCombo + 1; isSuccess = true; }
        else if (judg === 'GREAT') { scoreAdd = 300; isSuccess = true; }
        else if (judg === 'COOL') { scoreAdd = 100; isSuccess = true; }
        setMaxCombo(max => Math.max(max, newCombo));
        return newCombo;
    });

    setScore(s => s + scoreAdd);

    setHp(prev => {
        const newHp = judg === 'MISS' ? Math.max(0, prev - 25) : 
                      judg === 'BAD' ? Math.max(0, prev - 15) : 
                      Math.min(100, prev + (judg === 'PERFECT' ? 8 : judg === 'GREAT' ? 3 : 1));
        if (newHp <= 0) { setGameState('GAME_OVER'); if(audioRef.current) audioRef.current.pause(); }
        return newHp;
    });

    if (judg === 'PERFECT') {
        setBurstEffect(true); setIsShaking(true);
        setTimeout(() => { setBurstEffect(false); setIsShaking(false); }, 300);
    }

    setLevel(prev => {
        let newLv = isSuccess ? Math.min(11, prev + 0.5) : (judg === 'MISS' ? Math.max(4, prev - 1) : prev);
        levelRef.current = Math.floor(newLv);
        return Math.floor(newLv);
    });
  };

  // --- GAME LOOP: TỰ ĐỘNG CHẠY & CHUYỂN NHỊP ---
  useEffect(() => {
    if (gameState !== 'PLAYING' || isPaused || !currentTrack) return;
    const bps = currentTrack.bpm / 60;
    const measureSec = 4 / bps;
    
    const animate = () => {
      if (audioRef.current && !isPaused) {
         const currentTime = audioRef.current.currentTime;
         const currentCycle = Math.floor(currentTime / measureSec);
         
         // Cập nhật con chạy
         setSliderPos((currentTime % measureSec) / measureSec * 100);

         // TỰ ĐỘNG QUA NHỊP MỚI KHI HẾT 1 VÒNG
         if (currentCycle > cycleRef.current) {
             // 1. Kiểm tra lượt cũ: Nếu có phím mà người chơi chưa Space -> Báo MISS
             if (targetSeqRef.current.length > 0 && !hasJudgedRef.current) {
                 processJudgment('MISS');
             }

             // 2. Chuyển sang lượt mới
             cycleRef.current = currentCycle;
             setMeasureIndex(currentCycle);
             loadNextMeasure(currentCycle);
         }
      }
      requestRef.current = requestAnimationFrame(animate);
    };
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [gameState, isPaused, currentTrack]);

  const handleTimeUpdate = () => {
    if (audioRef.current && gameState === 'PLAYING') {
        setMusicProgress((audioRef.current.currentTime / audioRef.current.duration) * 100 || 0);
    }
  };

  const togglePause = () => {
      if (isPaused) { audioRef.current.play().catch(() => {}); setIsPaused(false); } 
      else { audioRef.current.pause(); setIsPaused(true); }
  };

  const handleLeaveGame = () => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
      setGameState('LOBBY'); setIsPaused(false); fetchGlobalLeaderboard(); 
  };

  // --- LẮNG NGHE BÀN PHÍM TỨC THÌ ---
  useEffect(() => {
    if (gameState !== 'PLAYING' || isPaused) return;
    
    const handleKeyDown = (e) => {
      // Bỏ qua nếu là Lượt nghỉ (Không có phím) hoặc đã bấm Space rồi
      if (targetSeqRef.current.length === 0) return;
      if (hasJudgedRef.current) return;

      const keyMap = { ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT' };
      
      // XỬ LÝ PHÍM MŨI TÊN
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault(); 
        if (isFailedSeqRef.current) return;
        if (userInputRef.current.length >= targetSeqRef.current.length) return;
        
        const pressedKey = keyMap[e.key];
        const nextInput = [...userInputRef.current, pressedKey];
        
        // Cập nhật Ref (Nhanh) và State (Đồ họa UI)
        userInputRef.current = nextInput;
        setUserInput(nextInput);
        
        const expectedKey = targetSeqRef.current[nextInput.length - 1].actual;
        if (expectedKey !== pressedKey) {
            isFailedSeqRef.current = true;
            setIsFailedSeq(true);
        }
      }

      // XỬ LÝ PHÍM SPACE (Chốt điểm)
      if (e.code === 'Space') {
        e.preventDefault();
        hasJudgedRef.current = true; // Khóa mảng lại, chờ qua nhịp mới

        if (isFailedSeqRef.current || userInputRef.current.length < targetSeqRef.current.length) {
            processJudgment('MISS');
        } else {
            // Lấy vị trí quả cầu hiện tại để tính độ chuẩn xác
            const measureSec = 4 / (currentTrack.bpm / 60);
            const currentPos = (audioRef.current.currentTime % measureSec) / measureSec * 100;
            const diff = Math.abs(currentPos - 85);

            if (diff <= 3.5) processJudgment('PERFECT');
            else if (diff <= 8) processJudgment('GREAT');
            else if (diff <= 15) processJudgment('COOL');
            else if (diff <= 25) processJudgment('BAD');
            else processJudgment('MISS');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, isPaused, currentTrack]);

  const handleGameEnd = async () => {
      setGameState('RESULT');
      try {
          if (!userData.phone) return;
          const globalRef = doc(db, 'au_global_leaderboard', userData.phone);
          const snap = await getDoc(globalRef);
          if (!snap.exists() || snap.data().bestScore < score) {
              await setDoc(globalRef, { name: userData.name, bestScore: score, phone: userData.phone, timestamp: Date.now() });
          }
      } catch (e) { console.error("Lỗi cập nhật điểm:", e); }
  };

  return (
    <div className={`min-h-screen bg-gray-900 text-white font-sans overflow-hidden relative transition-all ${isShaking ? 'modern-impact' : ''}`}>
      
      <style>{`
        .modern-impact { animation: impact 0.3s cubic-bezier(.36,.07,.19,.97) both; }
        @keyframes impact { 0%, 100% { transform: scale(1); filter: brightness(1); } 50% { transform: scale(1.02); filter: brightness(1.8); } }
        .album-rotate { animation: rotate 8s linear infinite; }
        .album-rotate-paused { animation-play-state: paused; }
        @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .glass-card { background: rgba(255, 255, 255, 0.03); backdrop-blur: 15px; border: 1px solid rgba(255, 255, 255, 0.05); }
      `}</style>

      {/* LOBBY */}
      {gameState === 'LOBBY' && (
        <div className="max-w-6xl mx-auto py-12 px-6 animate-in fade-in duration-500">
           <header className="flex justify-between items-center mb-12">
               <h1 className="text-5xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">AU PLANT G</h1>
               <button onClick={() => navigate('/')} className="bg-white/5 hover:bg-white/10 backdrop-blur-md px-6 py-2 rounded-2xl text-xs font-black uppercase tracking-widest border border-white/5 transition-all">Trở về</button>
           </header>
           
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
               <div className="lg:col-span-2 space-y-4 max-h-[72vh] overflow-y-auto pr-4 custom-scrollbar">
                   {isLoadingMusic ? (
                       <div className="flex flex-col items-center justify-center h-full text-white/50 space-y-4">
                           <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white"></div>
                           <p className="text-xs font-black tracking-widest uppercase">Đang tải máy chủ âm nhạc...</p>
                       </div>
                   ) : musicList.length === 0 ? (
                       <div className="flex flex-col items-center justify-center h-full text-white/30 text-center">
                           <p className="text-4xl mb-4">🎵</p>
                           <p className="text-sm font-black tracking-widest uppercase">Máy chủ chưa có bài nhạc nào</p>
                       </div>
                   ) : (
                       musicList.map(track => {
                           const isLocked = track.requiredRank && userData.rankId !== track.requiredRank;
                           return (
                               <div key={track.id} onClick={() => !isLocked && selectTrack(track)} 
                                    className={`group relative glass-card p-5 rounded-[2.5rem] flex items-center gap-6 transition-all 
                                    ${isLocked ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer hover:bg-white/10 hover:border-purple-500/40 hover:-translate-y-1.5 hover:shadow-[0_20px_50px_rgba(168,85,247,0.15)]'}`}>
                                   <div className="relative w-20 h-20 flex-shrink-0">
                                       <img src={track.cover} className="w-full h-full rounded-full object-cover border-2 border-white/5 shadow-2xl group-hover:scale-105 transition-transform" alt="cover" />
                                       {!isLocked && <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-xl">▶️</div>}
                                   </div>
                                   <div className="flex-1">
                                       <h3 className="font-black text-xl tracking-tight mb-1">{track.title} {track.requiredRank && '👑'}</h3>
                                       <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">{track.artist} • <span className="text-purple-400">{track.bpm} BPM</span></p>
                                   </div>
                                   <div className={`px-4 py-2 rounded-2xl font-black text-[9px] uppercase tracking-tighter ${track.difficulty === 'Expert' ? 'bg-purple-500/20 text-purple-300' : 'bg-white/5 text-white/30'}`}>{track.difficulty}</div>
                                   {isLocked && <div className="absolute right-8 top-1/2 -translate-y-1/2 text-2xl">🔒</div>}
                               </div>
                           );
                       })
                   )}
               </div>

               <div className="glass-card p-8 rounded-[3.5rem] h-fit">
                   <h2 className="text-[10px] font-black text-purple-400 uppercase tracking-[0.4em] mb-8 flex items-center gap-2">🏆 Global Top 10</h2>
                   <div className="space-y-5">
                       {leaderboard.length > 0 ? leaderboard.map((item, i) => (
                           <div key={i} className={`flex justify-between items-center bg-white/5 p-4 rounded-3xl border-l-4 ${i === 0 ? 'border-yellow-400' : 'border-white/10'}`}>
                               <div className="flex items-center gap-4">
                                   <span className={`font-black italic text-lg ${i === 0 ? 'text-yellow-400' : 'text-white/20'}`}>{i+1}</span>
                                   <span className="font-bold text-sm truncate max-w-[110px]">{item.name}</span>
                               </div>
                               <span className="font-mono font-black text-white">{item.bestScore?.toLocaleString()}</span>
                           </div>
                       )) : <p className="text-center text-white/10 italic py-10 text-xs tracking-widest uppercase">No data found</p>}
                   </div>
               </div>
           </div>
        </div>
      )}

      {/* LOADING */}
      {gameState === 'LOADING' && (
          <div className="h-screen flex flex-col items-center justify-center bg-black">
              <div className="w-64 h-1 bg-white/5 rounded-full overflow-hidden mb-6">
                  <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300" style={{ width: `${loadProgress}%` }}></div>
              </div>
              <p className="text-[10px] font-black uppercase text-white/40 tracking-[0.5em] animate-pulse">Entering Stage... {Math.floor(loadProgress)}%</p>
          </div>
      )}

      {/* PREPARING */}
      {gameState === 'PREPARING' && (
          <div className="h-screen flex items-center justify-center">
              <div className="text-[18rem] leading-none font-black italic text-transparent bg-clip-text bg-gradient-to-b from-purple-400 to-pink-600 animate-bounce text-center w-full select-none">
                  {prepCountdown > 0 ? prepCountdown : 'GO!'}
              </div>
          </div>
      )}

      {/* PLAYING */}
      {gameState === 'PLAYING' && (
          <div className="h-screen relative flex flex-col items-center justify-center p-6">
              <audio ref={audioRef} src={currentTrack?.src} autoPlay onEnded={handleGameEnd} onTimeUpdate={handleTimeUpdate} className="hidden" />
              
              <button onClick={() => setIsPaused(true)} className="absolute top-8 left-8 z-50 bg-white/5 hover:bg-white/10 p-4 rounded-3xl border border-white/10 backdrop-blur-xl transition-all">
                  <span className="text-xl text-white">⏸️</span>
              </button>

              {isPaused && (
                  <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[100] flex flex-col items-center justify-center animate-in fade-in duration-300">
                      <h2 className="text-8xl font-black italic text-white mb-16 tracking-tighter">PAUSED</h2>
                      <div className="flex flex-col gap-6 w-72">
                          <button onClick={togglePause} className="py-5 bg-white text-black font-black rounded-[2rem] uppercase tracking-widest hover:scale-105 transition-all">Continue</button>
                          <button onClick={handleLeaveGame} className="py-5 bg-red-600 text-white font-black rounded-[2rem] uppercase tracking-widest hover:scale-105 transition-all">Exit Stage</button>
                      </div>
                  </div>
              )}

              <div className="absolute top-12 left-1/2 -translate-x-1/2 w-full max-w-md px-10">
                  <div className="h-4 bg-white/5 rounded-full border border-white/5 p-1 overflow-hidden shadow-2xl">
                      <div className={`h-full rounded-full transition-all duration-300 ${hp < 30 ? 'bg-red-500 animate-pulse' : 'bg-gradient-to-r from-green-400 to-blue-500'}`} style={{ width: `${hp}%` }}></div>
                  </div>
              </div>

              {judgment && (
                  <div key={judgment.id} className="absolute top-1/4 z-50 animate-bounce pointer-events-none text-center">
                      <h2 className={`text-6xl font-black italic drop-shadow-[0_0_30px_rgba(255,255,255,0.3)] ${judgment.text === 'PERFECT' ? 'text-yellow-400 scale-110' : 'text-blue-400'}`}>{judgment.text}</h2>
                      {combo > 1 && <p className="text-3xl font-black text-white italic tracking-tighter mt-1">COMBO x{combo}</p>}
                  </div>
              )}

              <div className="glass-card rounded-[4.5rem] p-14 border border-white/5 shadow-2xl relative overflow-hidden">
                  <div className="flex justify-between items-end mb-12 px-4">
                      <div className="text-5xl font-black italic text-white/5">TURN {measureIndex + 1}</div>
                      <div className="text-right">
                          <p className="text-[10px] font-black text-purple-400 uppercase tracking-[0.4em] mb-1">Total Score</p>
                          <p className="text-6xl font-black text-white tracking-tighter">{score.toLocaleString()}</p>
                      </div>
                  </div>

                  {/* THAY ĐỔI: Hiển thị chữ Rest khi không có phím hoặc nghỉ */}
                  <div className={`flex flex-nowrap justify-center gap-4 sm:gap-6 mb-16 transition-all px-8 ${isFailedSeq ? 'opacity-10 blur-md' : ''}`}>
                      {targetSequence.length > 0 ? targetSequence.map((item, i) => (
                          <span key={i} className={`text-6xl sm:text-8xl transition-all duration-150 flex-shrink-0 ${
                              i < userInput.length ? 'opacity-20 scale-90' : 
                              item.isRed ? 'text-pink-500 drop-shadow-[0_0_20px_rgba(236,72,153,0.6)]' : 'text-green-400 drop-shadow-[0_0_20px_rgba(74,222,128,0.4)]'
                          }`}>
                              {ARROW_SYMBOLS[item.display]}
                          </span>
                      )) : <span className="text-white/20 italic font-black uppercase tracking-[0.4em] text-4xl py-6 animate-pulse">Rest Time</span>}
                  </div>

                  <div className="relative h-20 bg-black/40 rounded-full border-[6px] border-white/5 shadow-inner overflow-hidden">
                      <div className="absolute inset-y-0 left-[75%] right-[5%] bg-blue-500/10"></div>
                      <div className="absolute inset-y-0 left-[85%] w-3 bg-white shadow-[0_0_40px_#fff] z-10"></div>
                      {burstEffect && <div className="absolute top-1/2 left-[85%] -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full border-8 border-white/20 animate-ping z-0 pointer-events-none"></div>}
                      <div className={`absolute top-1/2 -translate-y-1/2 w-12 h-12 rounded-full border-[6px] border-white shadow-2xl transition-transform z-20 ${userData.rankId === 'CHALLENGER' ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-yellow-400'}`} style={{ left: `${sliderPos}%` }}></div>
                  </div>
              </div>

              {/* MUSIC PLAYER */}
              <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-full max-w-lg px-4">
                  <div className="bg-black/60 backdrop-blur-3xl p-6 rounded-[2.5rem] border border-white/10 shadow-2xl flex flex-col gap-5">
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-200" style={{ width: `${musicProgress}%` }}></div>
                      </div>
                      <div className="flex items-center gap-6">
                          <img src={currentTrack?.cover} 
                               className={`w-16 h-16 rounded-full object-cover border-2 border-white/20 shadow-lg album-rotate ${isPaused ? 'album-rotate-paused' : ''}`} 
                               alt="art" />
                          <div className="overflow-hidden flex-1">
                              <p className="text-lg font-black text-white truncate leading-none mb-2">{currentTrack?.title}</p>
                              <p className="text-xs text-white/40 font-black truncate uppercase tracking-widest">{currentTrack?.artist}</p>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* GAME OVER */}
      {gameState === 'GAME_OVER' && (
          <div className="h-screen bg-black flex flex-col items-center justify-center text-center p-6">
              <div className="text-[12rem] mb-12 animate-pulse">💀</div>
              <h2 className="text-7xl font-black text-red-600 uppercase tracking-tighter mb-8 italic">YOU FAILED</h2>
              <button onClick={() => { setGameState('LOBBY'); fetchGlobalLeaderboard(); }} className="px-16 py-6 bg-white text-black font-black rounded-full uppercase tracking-[0.2em] hover:scale-105 active:scale-95 transition-all">Thử lại sân khấu</button>
          </div>
      )}

      {/* RESULT */}
      {gameState === 'RESULT' && (
          <div className="h-screen flex items-center justify-center p-6 bg-black w-full">
              <div className="bg-white/5 backdrop-blur-2xl p-16 rounded-[4rem] border border-white/10 shadow-2xl max-w-xl w-full text-center">
                  <h2 className="text-6xl font-black italic text-white uppercase mb-12 tracking-tighter">COMPLETE!</h2>
                  <div className="grid grid-cols-2 gap-6 mb-12">
                      <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5">
                          <p className="text-[10px] text-purple-400 font-black uppercase tracking-widest mb-2">Max Combo</p>
                          <p className="text-4xl font-black text-white">{maxCombo}</p>
                      </div>
                      <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5">
                          <p className="text-[10px] text-green-400 font-black uppercase tracking-widest mb-2">Perfects</p>
                          <p className="text-4xl font-black text-white">{stats.perfect}</p>
                      </div>
                  </div>
                  <div className="mb-16">
                      <p className="text-xs text-gray-500 font-black uppercase tracking-[0.5em] mb-4">Final Score</p>
                      <p className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-500 drop-shadow-2xl tracking-tighter">{score.toLocaleString()}</p>
                  </div>
                  <button onClick={() => { setGameState('LOBBY'); fetchGlobalLeaderboard(); }} 
                          className="w-full py-6 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-black rounded-[2rem] uppercase tracking-[0.3em] shadow-xl hover:scale-105 transition-all">Tiếp tục</button>
              </div>
          </div>
      )}

    </div>
  );
};

export default AuGame;