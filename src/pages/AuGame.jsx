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

  // Gameplay States
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
  const [loadProgress, setLoadMusicProgress] = useState(0);
  const [prepCountdown, setPrepCountdown] = useState(3);

  const audioRef = useRef(null);
  const requestRef = useRef();

  // --- REFS CHO AUTO-SYNC VÀ TÍNH ĐIỂM ---
  const cycleRef = useRef(0);
  const hasJudgedRef = useRef(false);
  const targetSeqRef = useRef([]);
  const userInputRef = useRef([]);
  const isFailedSeqRef = useRef(false);
  const levelRef = useRef(4);
  const perfectComboRef = useRef(0); // Bộ đếm chuỗi Perfect liên tiếp

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
        setMusicList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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
    setCurrentTrack(track);
    setGameState('LOADING');
    setLoadMusicProgress(0);
    
    let loadedBeatmap = null;
    try {
        const response = await fetch(`/music/beatmap/${track.id}.json`);
        if (response.ok) { loadedBeatmap = await response.json(); }
    } catch (e) {}

    setCurrentTrack({ ...track, beatmap: loadedBeatmap || track.beatmap });

    let prog = 0;
    const interval = setInterval(() => {
        prog += Math.random() * 25;
        if (prog >= 100) {
            setLoadMusicProgress(100); clearInterval(interval);
            setTimeout(() => {
                setGameState('PREPARING'); 
                setPrepCountdown(3); setHp(100); setScore(0); setCombo(0); setMeasureIndex(0); setMusicProgress(0);
            }, 500);
        } else setLoadMusicProgress(prog);
    }, 150);
  };

  const loadNextMeasure = (index) => {
    let newSeq = [];
    const currentLv = levelRef.current;

    if (currentTrack && currentTrack.beatmap && currentTrack.beatmap[index]) {
        newSeq = currentTrack.beatmap[index];
    } else if (currentTrack && !currentTrack.beatmap) {
        const redChance = currentLv > 6 ? (currentLv - 5) * 0.12 : 0;
        for(let i = 0; i < currentLv; i++) {
            const dir = ['UP', 'DOWN', 'LEFT', 'RIGHT'][Math.floor(Math.random() * 4)];
            const isRed = Math.random() < redChance;
            newSeq.push({ display: dir, actual: isRed ? OPPOSITE_KEYS[dir] : dir, isRed });
        }
    } 

    targetSeqRef.current = newSeq;
    userInputRef.current = [];
    isFailedSeqRef.current = false;
    hasJudgedRef.current = false;

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
        setLevel(initialLv); levelRef.current = initialLv; cycleRef.current = 0; perfectComboRef.current = 0;
        loadNextMeasure(0);
      }
    }
  }, [gameState, prepCountdown, currentTrack]);

  // CƠ CHẾ TÍNH ĐIỂM CHUẨN: CHỈ PERFECT MỚI ĐƯỢC NHÂN COMBO VÀ CỘNG DỒN
  const processJudgment = (judg) => {
    setJudgment({ text: judg, id: Date.now() });
    setTimeout(() => setJudgment(prev => prev?.text === judg ? null : prev), 400);

    const k = judg.toLowerCase();
    setStats(prev => ({ ...prev, [k]: prev[k] + 1 }));

    let scoreAdd = 0;
    let isSuccess = false;
    let hpAdd = 0;

    // 1 nút = 10 điểm (Tính toán dựa trên số nút thực tế của lượt đó)
    const baseKeyScore = targetSeqRef.current.length * 10;

    if (judg === 'PERFECT') {
        perfectComboRef.current += 1;
        scoreAdd = baseKeyScore + (10 * perfectComboRef.current);
        isSuccess = true; hpAdd = 8; 
        setCombo(perfectComboRef.current); // Tăng Combo cho Perfect
    } else if (judg === 'GREAT') {
        perfectComboRef.current = 0; // Trượt Perfect -> Đứt chuỗi Perfect
        scoreAdd = baseKeyScore + 5;
        isSuccess = true; hpAdd = 3; 
        setCombo(0); // Cắt chuỗi
    } else if (judg === 'COOL') {
        perfectComboRef.current = 0; 
        scoreAdd = baseKeyScore + 2;
        isSuccess = true; hpAdd = 1; 
        setCombo(0); 
    } else if (judg === 'BAD') {
        perfectComboRef.current = 0; 
        scoreAdd = 0; // Không có điểm
        hpAdd = -15; 
        setCombo(0); 
    } else { // MISS
        perfectComboRef.current = 0; 
        scoreAdd = 0; // Không có điểm
        hpAdd = -25; 
        setCombo(0); 
    }

    setScore(s => s + scoreAdd);
    
    setHp(prev => {
        const newHp = Math.max(0, Math.min(100, prev + hpAdd));
        if (newHp <= 0) { setGameState('GAME_OVER'); if(audioRef.current) audioRef.current.pause(); }
        return newHp;
    });

    setMaxCombo(prev => Math.max(prev, perfectComboRef.current));
    
    // Gỡ bỏ hiệu ứng Burst, chỉ giữ lại hiệu ứng Rung màn hình khi Perfect
    if (judg === 'PERFECT') {
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 300);
    }

    setLevel(prev => {
        let newLv = isSuccess ? Math.min(11, prev + 0.5) : (judg === 'MISS' ? Math.max(4, prev - 1) : prev);
        levelRef.current = Math.floor(newLv);
        return Math.floor(newLv);
    });
  };

  // --- QUẢN LÝ DỪNG/PHÁT NHẠC ĐỘC LẬP CHUẨN XÁC ---
  useEffect(() => {
    if (!audioRef.current) return;
    if (gameState === 'PLAYING' && !isPaused) {
        audioRef.current.play().catch(e => console.warn("Audio play issue:", e));
    } else {
        audioRef.current.pause(); // Nhạc sẽ lập tức dừng khi isPaused = true
    }
  }, [isPaused, gameState]);

  const togglePause = () => {
      setIsPaused(prev => !prev);
  };

  const handleLeaveGame = () => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
      setGameState('LOBBY'); setIsPaused(false); fetchGlobalLeaderboard(); 
  };

  // TỰ ĐỘNG CHẠY & CHUYỂN NHỊP (AUTO-SYNC)
  useEffect(() => {
    if (gameState !== 'PLAYING' || isPaused || !currentTrack) return;
    const bps = currentTrack.bpm / 60;
    const measureSec = 4 / bps;
    
    const animate = () => {
      if (audioRef.current && !isPaused) {
         const currentTime = audioRef.current.currentTime;
         const currentCycle = Math.floor(currentTime / measureSec);
         
         setSliderPos((currentTime % measureSec) / measureSec * 100);

         // Quả cầu trôi đến vạch 100% (Sang vòng mới)
         if (currentCycle > cycleRef.current) {
             if (targetSeqRef.current.length > 0 && !hasJudgedRef.current) {
                 processJudgment('MISS');
             }
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
        const progress = (audioRef.current.currentTime / audioRef.current.duration) * 100;
        setMusicProgress(progress || 0);
    }
  };

  useEffect(() => {
    if (gameState !== 'PLAYING' || isPaused) return;
    const handleKeyDown = (e) => {
      if (targetSeqRef.current.length === 0) return;
      if (hasJudgedRef.current) return;

      const keyMap = { ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT' };
      
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault(); 
        if (isFailedSeqRef.current) return;
        if (userInputRef.current.length >= targetSeqRef.current.length) return;
        
        const pressedKey = keyMap[e.key];
        const nextInput = [...userInputRef.current, pressedKey];
        
        userInputRef.current = nextInput;
        setUserInput(nextInput);
        
        const expectedKey = targetSeqRef.current[nextInput.length - 1].actual;
        if (expectedKey !== pressedKey) {
            isFailedSeqRef.current = true;
            setIsFailedSeq(true);
        }
      }

      if (e.code === 'Space') {
        e.preventDefault();
        hasJudgedRef.current = true; 

        if (isFailedSeqRef.current || userInputRef.current.length < targetSeqRef.current.length) {
            processJudgment('MISS');
        } else {
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
      } catch (e) { console.error(e); }
  };

  // TÍNH TOÁN SỐ SAO DỰA TRÊN ĐỘ KHÓ
  const getDifficultyStars = (diff) => {
      switch(diff) {
          case 'Easy': return 2;
          case 'Normal': return 4;
          case 'Hard': return 6;
          case 'Expert': return 8;
          default: return 4;
      }
  };

  return (
    <div className={`min-h-screen bg-[url('https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1920&auto=format&fit=crop')] bg-cover bg-center text-white font-sans overflow-hidden relative transition-all ${isShaking ? 'modern-impact' : ''}`}>
      
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"></div>

      <style>{`
        .modern-impact { animation: impact 0.2s cubic-bezier(.36,.07,.19,.97) both; }
        @keyframes impact { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.02) translateY(5px); } }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 10px; }
        .glass-card { background: rgba(0, 0, 0, 0.4); backdrop-blur: 20px; border: 1px solid rgba(255, 255, 255, 0.1); }
      `}</style>

      {/* LOBBY */}
      {gameState === 'LOBBY' && (
        <div className="relative z-10 max-w-6xl mx-auto py-12 px-6 animate-in fade-in duration-500">
           <header className="flex justify-between items-center mb-12">
               <h1 className="text-5xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">AU PLANT G</h1>
               <button onClick={() => navigate('/')} className="bg-white/5 hover:bg-white/10 px-6 py-2 rounded-2xl text-xs font-black uppercase tracking-widest border border-white/10 transition-all">Trở về</button>
           </header>
           
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
               <div className="lg:col-span-2 space-y-4 max-h-[72vh] overflow-y-auto pr-4 custom-scrollbar">
                   {isLoadingMusic ? (
                       <div className="flex flex-col items-center justify-center h-full text-white/50 space-y-4">
                           <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white"></div>
                           <p className="text-xs font-black tracking-widest uppercase">Đang tải máy chủ...</p>
                       </div>
                   ) : (
                       musicList.map(track => {
                           const isLocked = track.requiredRank && userData.rankId !== track.requiredRank;
                           return (
                               <div key={track.id} onClick={() => !isLocked && selectTrack(track)} 
                                    className={`group glass-card p-5 rounded-[2rem] flex items-center gap-6 transition-all 
                                    ${isLocked ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer hover:bg-white/10 hover:border-cyan-500/50 hover:shadow-[0_0_30px_rgba(34,211,238,0.2)]'}`}>
                                   <img src={track.cover} className="w-20 h-20 rounded-xl object-cover shadow-2xl group-hover:scale-105 transition-transform" alt="cover" />
                                   <div className="flex-1">
                                       <h3 className="font-black text-xl tracking-tight mb-1">{track.title} {track.requiredRank && '👑'}</h3>
                                       <p className="text-cyan-400 text-[10px] font-bold uppercase tracking-widest">{track.artist} • {track.bpm} BPM</p>
                                   </div>
                                   <div className={`px-4 py-2 rounded-2xl font-black text-[9px] uppercase tracking-tighter ${track.difficulty === 'Expert' ? 'bg-purple-500/30 text-purple-300' : 'bg-white/10 text-white/50'}`}>{track.difficulty}</div>
                               </div>
                           );
                       })
                   )}
               </div>

               <div className="glass-card p-8 rounded-[3rem] h-fit">
                   <h2 className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.4em] mb-8 flex items-center gap-2">🏆 TOP THẦN NHẢY</h2>
                   <div className="space-y-4">
                       {leaderboard.map((item, i) => (
                           <div key={i} className={`flex justify-between items-center bg-black/40 p-4 rounded-2xl border-l-4 ${i === 0 ? 'border-yellow-400' : 'border-white/10'}`}>
                               <div className="flex items-center gap-4">
                                   <span className={`font-black italic text-lg ${i === 0 ? 'text-yellow-400' : 'text-white/30'}`}>{i+1}</span>
                                   <span className="font-bold text-sm truncate max-w-[110px]">{item.name}</span>
                               </div>
                               <span className="font-mono font-black text-cyan-300">{item.bestScore?.toLocaleString()}</span>
                           </div>
                       ))}
                   </div>
               </div>
           </div>
        </div>
      )}

      {/* MÀN HÌNH CHƠI CHÍNH SLEEK UI */}
      {gameState === 'PLAYING' && (
          <div className="h-screen relative z-10 w-full">
              <audio ref={audioRef} src={currentTrack?.src} onEnded={handleGameEnd} onTimeUpdate={handleTimeUpdate} className="hidden" />
              
              <button onClick={togglePause} className="absolute top-8 right-8 z-50 bg-black/50 p-4 rounded-2xl border border-white/10 backdrop-blur-md hover:bg-white/10 transition-all">⏸️</button>

              {isPaused && (
                  <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[100] flex flex-col items-center justify-center animate-in fade-in">
                      <h2 className="text-8xl font-black italic text-white mb-16 tracking-tighter">PAUSED</h2>
                      <div className="flex gap-6">
                          <button onClick={togglePause} className="px-10 py-4 bg-cyan-500 text-black font-black rounded-full uppercase tracking-widest hover:scale-105 transition-all">Tiếp tục</button>
                          <button onClick={handleLeaveGame} className="px-10 py-4 bg-white/10 text-white font-black rounded-full uppercase tracking-widest hover:bg-red-500 transition-all">Thoát</button>
                      </div>
                  </div>
              )}

              {/* KHU VỰC TRÁI: NĂNG LƯỢNG VÀ ĐIỂM SỐ */}
              <div className="absolute left-8 top-1/3 -translate-y-1/2 flex flex-col">
                  <div className="mb-8 p-4 bg-black/40 backdrop-blur-md rounded-2xl border border-white/5 w-48">
                      <p className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.3em] mb-2">ENERGY</p>
                      <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                          <div className={`h-full transition-all duration-300 ${hp < 30 ? 'bg-red-500 shadow-[0_0_10px_red]' : 'bg-cyan-400 shadow-[0_0_10px_cyan]'}`} style={{ width: `${hp}%` }}></div>
                      </div>
                  </div>

                  <div className="drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]">
                      <p className="text-sm font-black italic text-white/50 uppercase tracking-[0.5em] mb-[-10px]">SCORE</p>
                      <p className="text-7xl font-black italic text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400 tracking-tighter">
                          {score.toLocaleString()}
                      </p>
                  </div>
              </div>

              {/* ĐÁNH GIÁ NỔI BẬT GIỮA MÀN HÌNH */}
              {judgment && (
                  <div key={judgment.id} className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 z-50 animate-in zoom-in duration-100 flex flex-col items-center pointer-events-none drop-shadow-[0_0_30px_rgba(0,0,0,0.8)]">
                      <h2 className={`text-6xl sm:text-7xl font-black italic uppercase tracking-tighter
                          ${judgment.text === 'PERFECT' ? 'text-yellow-400 drop-shadow-[0_0_20px_yellow]' : 
                            judgment.text === 'GREAT' ? 'text-green-400 drop-shadow-[0_0_20px_green]' : 
                            judgment.text === 'COOL' ? 'text-blue-400 drop-shadow-[0_0_20px_blue]' : 
                            judgment.text === 'BAD' ? 'text-gray-400' : 'text-red-500 drop-shadow-[0_0_20px_red]'}`}>
                          {judgment.text}
                      </h2>
                      {combo > 1 && <p className="text-4xl font-black text-white italic tracking-tighter mt-1 drop-shadow-xl">x{combo}</p>}
                  </div>
              )}

              {/* KHU VỰC ĐIỀU KHIỂN ĐÁY GIỮA */}
              <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-full max-w-3xl flex flex-col items-center px-4">
                  
                  {/* Thanh Nhịp điệu */}
                  <div className="relative w-full h-4 bg-black/80 rounded-full border border-white/20 shadow-[0_0_20px_rgba(34,211,238,0.2)]">
                      <div className="absolute left-[75%] right-[5%] inset-y-0 bg-cyan-500/20 rounded-full"></div>
                      <div className="absolute left-[85%] w-[3px] h-[150%] top-[-25%] bg-white shadow-[0_0_10px_white,0_0_20px_cyan] rounded-full z-10"></div>
                      <div className="absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white shadow-[0_0_15px_white,0_0_30px_cyan] transition-transform z-20" style={{ left: `${sliderPos}%` }}></div>
                  </div>

                  {/* Phím bấm mũi tên */}
                  <div className={`flex justify-center gap-3 sm:gap-4 mt-8 h-20 transition-all ${isFailedSeq ? 'opacity-30 blur-[2px]' : ''}`}>
                      {targetSequence.length > 0 ? targetSequence.map((item, i) => (
                          <span key={i} className={`text-5xl sm:text-6xl font-black drop-shadow-[0_10px_10px_rgba(0,0,0,0.8)] transition-all flex-shrink-0 ${
                              i < userInput.length ? 'opacity-0 scale-50' : 
                              item.isRed ? 'text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]' : 'text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.8)]'
                          }`}>
                              {ARROW_SYMBOLS[item.display]}
                          </span>
                      )) : <span className="text-white/30 italic font-black uppercase tracking-[0.5em] text-2xl py-4 animate-pulse">Rest Time</span>}
                  </div>

                  {/* Thanh Thông Tin Nhạc + Thanh Tiến Trình Bài Hát (Progress Bar) */}
                  <div className="mt-8 flex flex-col items-center">
                      <div className="flex items-center gap-4 bg-black/60 backdrop-blur-xl border border-white/10 pl-2 pr-6 py-2 rounded-full shadow-2xl relative overflow-hidden">
                          {/* Thanh tiến trình chạy ngang làm nền mờ */}
                          <div className="absolute bottom-0 left-0 h-1 bg-cyan-400/80 transition-all duration-300" style={{ width: `${musicProgress}%` }}></div>
                          
                          <img src={currentTrack?.cover} className="w-10 h-10 rounded-full object-cover border border-white/20 z-10" alt="cover" />
                          <div className="flex flex-col z-10">
                              <span className="font-black text-sm text-white tracking-tight">{currentTrack?.title}</span>
                              <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest">{currentTrack?.artist}</span>
                          </div>
                      </div>
                  </div>
              </div>

              {/* GÓC TRÁI DƯỚI: ĐỘ KHÓ (SAO) VÀ LEVEL PHÍM */}
              <div className="absolute bottom-10 left-8 flex flex-col gap-1 drop-shadow-[0_5px_10px_rgba(0,0,0,0.8)]">
                  <span className="font-black italic text-2xl text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 uppercase">
                     {currentTrack?.difficulty || 'NORMAL'}
                  </span>
                  <div className="flex gap-1 text-yellow-400 text-lg drop-shadow-[0_0_10px_yellow]">
                      {[...Array(getDifficultyStars(currentTrack?.difficulty))].map((_, i) => <span key={i}>★</span>)}
                  </div>
                  <span className="text-white/40 font-black text-[10px] mt-1 tracking-widest uppercase">Phím: {Math.floor(level)}</span>
              </div>

          </div>
      )}

      {/* CÁC TRẠNG THÁI LOADING, PREPARING, RESULT, GAME_OVER GIỮ NGUYÊN */}
      {gameState === 'PREPARING' && (
          <div className="h-screen flex items-center justify-center relative z-10">
              <div className="text-[20rem] leading-none font-black italic text-white drop-shadow-[0_0_50px_cyan] animate-bounce text-center select-none">
                  {prepCountdown > 0 ? prepCountdown : 'GO!'}
              </div>
          </div>
      )}
      
      {gameState === 'RESULT' && (
          <div className="h-screen flex items-center justify-center p-6 w-full relative z-10">
              <div className="bg-black/60 backdrop-blur-2xl p-16 rounded-[4rem] border border-white/10 shadow-[0_0_100px_rgba(34,211,238,0.2)] max-w-xl w-full text-center">
                  <h2 className="text-6xl font-black italic text-white uppercase mb-12 tracking-tighter">STAGE CLEARED</h2>
                  <div className="grid grid-cols-2 gap-6 mb-12">
                      <div className="bg-white/5 p-6 rounded-[2rem]">
                          <p className="text-[10px] text-cyan-400 font-black uppercase tracking-widest mb-2">Max Combo</p>
                          <p className="text-4xl font-black text-white">{maxCombo}</p>
                      </div>
                      <div className="bg-white/5 p-6 rounded-[2rem]">
                          <p className="text-[10px] text-yellow-400 font-black uppercase tracking-widest mb-2">Perfects</p>
                          <p className="text-4xl font-black text-white">{stats.perfect}</p>
                      </div>
                  </div>
                  <div className="mb-16">
                      <p className="text-xs text-white/50 font-black uppercase tracking-[0.5em] mb-4">Final Score</p>
                      <p className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-cyan-400 drop-shadow-2xl tracking-tighter">{score.toLocaleString()}</p>
                  </div>
                  <button onClick={() => { setGameState('LOBBY'); fetchGlobalLeaderboard(); }} 
                          className="w-full py-6 bg-cyan-600 text-black font-black rounded-[2rem] uppercase tracking-[0.3em] shadow-[0_0_20px_cyan] hover:scale-105 transition-all">Trở về sảnh</button>
              </div>
          </div>
      )}

      {gameState === 'GAME_OVER' && (
          <div className="h-screen flex flex-col items-center justify-center text-center p-6 relative z-10 bg-black/80 backdrop-blur-md">
              <h2 className="text-[10rem] font-black text-red-600 uppercase tracking-tighter mb-4 italic drop-shadow-[0_0_50px_red]">FAILED</h2>
              <p className="text-xl font-bold text-gray-400 mb-12 uppercase tracking-[0.5em]">Hãy luyện tập thêm</p>
              <button onClick={() => { setGameState('LOBBY'); fetchGlobalLeaderboard(); }} className="px-16 py-6 bg-white text-black font-black rounded-full uppercase tracking-[0.2em] hover:scale-105 transition-all">Thử lại</button>
          </div>
      )}

    </div>
  );
};

export default AuGame;