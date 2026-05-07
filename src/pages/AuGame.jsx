import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getRankInfo } from '../utils/rankUtils';

const MUSIC_TRACKS = [
    { id: 'track1', src: '/music/track1.mp3', title: "Sôi Động Vinhomes", artist: "DJ Plant G", bpm: 110, difficulty: 'Easy', genre: 'Pop', cover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&h=200&fit=crop' },
    { id: 'track2', src: '/music/track2.mp3', title: "Bass Cực Căng", artist: "Remixer Pro", bpm: 128, difficulty: 'Normal', genre: 'EDM', cover: 'https://images.unsplash.com/photo-1459749411177-042180ce673c?w=200&h=200&fit=crop' },
    { id: 'track3', src: '/music/track3.mp3', title: "Giai Điệu Buồn", artist: "Lofi Chill", bpm: 95, difficulty: 'Easy', genre: 'Lofi', cover: 'https://images.unsplash.com/photo-1516280440614-37939bb92583?w=200&h=200&fit=crop' },
    { id: 'track4', src: '/music/track4.mp3', title: "Dance Alone", artist: "V-Dance", bpm: 140, difficulty: 'Hard', genre: 'Dance', cover: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=200&h=200&fit=crop' },
    { id: 'track5', src: '/music/track5.mp3', title: "Challenger Anthem", artist: "Plant G VIP", bpm: 155, difficulty: 'Expert', genre: 'Hardstyle', cover: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=200&h=200&fit=crop', requiredRank: 'CHALLENGER' },
    { id: 'track6', src: '/music/track6.mp3', title: "đêm tĩnh lặng", artist: "kẻ cô đơn", bpm: 85, difficulty: 'Easy', genre: 'Lofi', cover: 'https://images.unsplash.com/photo-1493225457124-a1a2a5f0b008?w=200&h=200&fit=crop' },
    { id: 'track7', src: '/music/track7.mp3', title: "Cơm Tấm Rush", artist: "Bếp Trưởng", bpm: 135, difficulty: 'Hard', genre: 'Electro', cover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=200&h=200&fit=crop' },
    { id: 'track8', src: '/music/track8.mp3', title: "Nhịp Đập Phố Đêm", artist: "Night Owl", bpm: 125, difficulty: 'Normal', genre: 'House', cover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&h=200&fit=crop' },
    { id: 'track9', src: '/music/track9.mp3', title: "góc tối", artist: "mưa rơi", bpm: 80, difficulty: 'Easy', genre: 'Lofi', cover: 'https://images.unsplash.com/photo-1499946981954-e7f4b234d7fa?w=200&h=200&fit=crop' },
    { id: 'track10', src: '/music/track10.mp3', title: "Spacebar Smasher", artist: "Keyboard Warrior", bpm: 150, difficulty: 'Hard', genre: 'Techno', cover: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=200&h=200&fit=crop' },
    { id: 'track11', src: '/music/track11.mp3', title: "Vũ Điệu Giao Hàng", artist: "Shipper Boy", bpm: 105, difficulty: 'Normal', genre: 'HipHop', cover: 'https://images.unsplash.com/photo-1483032469466-b937c425697b?w=200&h=200&fit=crop' },
    { id: 'track12', src: '/music/track12.mp3', title: "nỗi buồn để lại", artist: "hư không", bpm: 90, difficulty: 'Easy', genre: 'Lofi', cover: 'https://images.unsplash.com/photo-1458560871784-56d23406c091?w=200&h=200&fit=crop' },
    { id: 'track13', src: '/music/track13.mp3', title: "Speed Limit", artist: "Sonic", bpm: 160, difficulty: 'Expert', genre: 'Trance', cover: 'https://images.unsplash.com/photo-1478147427282-58a87a120781?w=200&h=200&fit=crop' },
    { id: 'track14', src: '/music/track14.mp3', title: "Plant G Party", artist: "All Stars", bpm: 120, difficulty: 'Normal', genre: 'Pop', cover: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=200&h=200&fit=crop' },
    { id: 'track15', src: '/music/track15.mp3', title: "WHERE U AT FULL", artist: "THÁI HOÀNG REMIX", bpm: 155, difficulty: 'Hard', genre: 'Dance', cover: 'https://i.ytimg.com/vi/AFEWE3ySRGo/maxresdefault.jpg' },
    { id: 'track16', src: '/music/track16.mp3', title: "chìm vào giấc mơ", artist: "kẻ mộng du", bpm: 75, difficulty: 'Easy', genre: 'Lofi', cover: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=200&h=200&fit=crop' },
    { id: 'track17', src: '/music/track17.mp3', title: "Tốc Độ Ánh Sáng", artist: "Master Tier", bpm: 175, difficulty: 'Expert', genre: 'Hardcore', cover: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=200&h=200&fit=crop', requiredRank: 'CHALLENGER' },
    { id: 'track18', src: '/music/track18.mp3', title: "Vương Miện Plant G", artist: "The Boss", bpm: 180, difficulty: 'Expert', genre: 'Hardstyle', cover: 'https://images.unsplash.com/photo-1505506874110-6a7a4f4aa009?w=200&h=200&fit=crop', requiredRank: 'CHALLENGER' }
];

const ARROW_SYMBOLS = { UP: '⬆️', DOWN: '⬇️', LEFT: '⬅️', RIGHT: '➡️' };
const OPPOSITE_KEYS = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' };

const AuGame = () => {
  const navigate = useNavigate();
  const [gameState, setGameState] = useState('LOBBY'); 
  const [isPaused, setIsPaused] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [userData, setUserData] = useState({ phone: '', name: '', rankId: '' });
  const [leaderboard, setLeaderboard] = useState([]);

  // Gameplay & UI States
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
  
  const [isShaking, setIsShaking] = useState(false);
  const [burstEffect, setBurstEffect] = useState(false);
  const [loadProgress, setLoadMusicProgress] = useState(0);
  const [prepCountdown, setPrepCountdown] = useState(3);

  const audioRef = useRef(null);
  const requestRef = useRef();

  useEffect(() => {
    const fetchUser = async () => {
      const phones = JSON.parse(localStorage.getItem('recentPhones') || '[]');
      if (phones.length > 0) {
        const userSnap = await getDoc(doc(db, 'users', phones[0]));
        if (userSnap.exists()) {
          const data = userSnap.data();
          const rankInfo = getRankInfo(data.totalSpend || 0, data.manualRankId);
          setUserData({ phone: phones[0], name: data.fullName || 'Người chơi', rankId: rankInfo.current.id });
        }
      } else { navigate('/'); }
    };
    fetchUser();
    fetchGlobalLeaderboard(); // Lấy BXH toàn cầu ngay khi vào
  }, [navigate]);

  const fetchGlobalLeaderboard = async () => {
    try {
        const lbRef = collection(db, 'au_global_leaderboard');
        const q = query(lbRef, orderBy('bestScore', 'desc'), limit(10));
        const querySnapshot = await getDocs(q);
        setLeaderboard(querySnapshot.docs.map(d => d.data()));
    } catch (e) { console.error("Lỗi lấy BXH:", e); }
  };

  const selectTrack = (track) => {
    if (track.requiredRank && userData.rankId !== track.requiredRank) return;
    setCurrentTrack(track);
    setGameState('LOADING');
    let prog = 0;
    const interval = setInterval(() => {
        prog += Math.random() * 25;
        if (prog >= 100) {
            setLoadMusicProgress(100); clearInterval(interval);
            setTimeout(() => {
                setGameState('PREPARING'); setPrepCountdown(3); setHp(100); setScore(0); setCombo(0); setMusicProgress(0);
            }, 500);
        } else setLoadMusicProgress(prog);
    }, 150);
  };

  const generateNewSequence = (lv) => {
    const seq = [];
    const redChance = lv > 6 ? (lv - 5) * 0.12 : 0;
    for(let i = 0; i < lv; i++) {
        const dir = ['UP', 'DOWN', 'LEFT', 'RIGHT'][Math.floor(Math.random() * 4)];
        const isRed = Math.random() < redChance;
        seq.push({ display: dir, actual: isRed ? OPPOSITE_KEYS[dir] : dir, isRed });
    }
    setTargetSequence(seq); setUserInput([]); setIsFailedSeq(false);
  };

  useEffect(() => {
    if (gameState === 'PREPARING') {
      if (prepCountdown > 0) {
        const t = setTimeout(() => setPrepCountdown(prev => prev - 1), 1000);
        return () => clearTimeout(t);
      } else {
        setGameState('PLAYING');
        generateNewSequence(currentTrack.difficulty === 'Expert' ? 8 : currentTrack.difficulty === 'Hard' ? 7 : 4);
      }
    }
  }, [gameState, prepCountdown]);

  useEffect(() => {
    if (gameState !== 'PLAYING' || isPaused || !currentTrack) return;
    const bps = currentTrack.bpm / 60;
    const measureSec = 4 / bps;
    const animate = () => {
      if (audioRef.current && !isPaused) {
         setSliderPos((audioRef.current.currentTime % measureSec) / measureSec * 100);
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

  const registerJudgment = (judg) => {
    setJudgment({ text: judg, id: Date.now() });
    const k = judg.toLowerCase();
    setStats(prev => ({ ...prev, [k]: prev[k] + 1 }));
    let scoreAdd = 0, hpAdd = 0, isSuccess = false;

    if (judg === 'PERFECT') {
        scoreAdd = 500 + (combo * 50); hpAdd = 8; setCombo(c => c + 1); setBurstEffect(true); setIsShaking(true);
        setTimeout(() => { setBurstEffect(false); setIsShaking(false); }, 300);
        isSuccess = true;
    } else if (judg === 'GREAT') { scoreAdd = 300; hpAdd = 3; setCombo(0); isSuccess = true; }
    else if (judg === 'COOL') { scoreAdd = 100; hpAdd = 1; setCombo(0); isSuccess = true; }
    else if (judg === 'BAD') { scoreAdd = 20; hpAdd = -15; setCombo(0); }
    else { scoreAdd = 0; hpAdd = -25; setCombo(0); }

    setScore(s => s + scoreAdd);
    setHp(prev => {
        const newHp = Math.max(0, Math.min(100, prev + hpAdd));
        if (newHp <= 0) { setGameState('GAME_OVER'); audioRef.current.pause(); }
        return newHp;
    });

    if (combo + 1 > maxCombo) setMaxCombo(combo + 1);
    let newLv = isSuccess ? Math.min(11, level + 0.5) : (judg === 'MISS' ? Math.max(4, level - 1) : level);
    setLevel(Math.floor(newLv));
    generateNewSequence(Math.floor(newLv));
  };

  useEffect(() => {
    if (gameState !== 'PLAYING' || isPaused) return;
    const handleKeyDown = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault(); if (isFailedSeq) return;
        const keyMap = { ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT' };
        setUserInput((prev) => {
          if (prev.length >= targetSequence.length) return prev;
          const next = [...prev, keyMap[e.key]];
          if (targetSequence[prev.length].actual !== keyMap[e.key]) setIsFailedSeq(true);
          return next;
        });
      }
      if (e.code === 'Space') {
        e.preventDefault();
        if (isFailedSeq || userInput.length < targetSequence.length) registerJudgment('MISS');
        else {
            const diff = Math.abs(sliderPos - 85);
            if (diff <= 2.5) registerJudgment('PERFECT');
            else if (diff <= 6) registerJudgment('GREAT');
            else if (diff <= 12) registerJudgment('COOL');
            else if (diff <= 20) registerJudgment('BAD');
            else registerJudgment('MISS');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, targetSequence, userInput, sliderPos, isFailedSeq, isPaused]);

  const handleGameEnd = async () => {
      setGameState('RESULT');
      try {
          // Lưu BXH Toàn cầu (Kỷ lục cá nhân cao nhất)
          const globalRef = doc(db, 'au_global_leaderboard', userData.phone);
          const snap = await getDoc(globalRef);
          if (!snap.exists() || snap.data().bestScore < score) {
              await setDoc(globalRef, { 
                  name: userData.name, 
                  bestScore: score, 
                  phone: userData.phone, 
                  timestamp: Date.now() 
              });
          }
      } catch (e) { console.error(e); }
  };

  return (
    <div className={`min-h-screen bg-gray-900 text-white font-sans overflow-hidden relative transition-all ${isShaking ? 'modern-shake' : ''}`}>
      
      <style>{`
        .modern-shake { animation: modernShake 0.3s cubic-bezier(.36,.07,.19,.97) both; }
        @keyframes modernShake {
          0%, 100% { transform: scale(1); filter: brightness(1); }
          50% { transform: scale(1.03); filter: brightness(1.5); }
        }
        .album-rotate { animation: rotate 10s linear infinite; }
        .album-rotate-paused { animation-play-state: paused; }
        @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #4b5563; border-radius: 10px; }
      `}</style>

      {/* LOBBY */}
      {gameState === 'LOBBY' && (
        <div className="max-w-6xl mx-auto py-12 px-6 animate-in fade-in duration-500">
           <header className="flex justify-between items-center mb-12">
               <h1 className="text-5xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">AU PLANT G</h1>
               <button onClick={() => navigate('/')} className="bg-white/10 hover:bg-white/20 backdrop-blur-md px-6 py-2 rounded-2xl text-xs font-black uppercase tracking-widest border border-white/10 transition-all">Trở về</button>
           </header>
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
               <div className="lg:col-span-2 space-y-4 max-h-[70vh] overflow-y-auto pr-4 custom-scrollbar">
                   {MUSIC_TRACKS.map(track => {
                       const isLocked = track.requiredRank && userData.rankId !== track.requiredRank;
                       return (
                           <div key={track.id} onClick={() => !isLocked && selectTrack(track)} 
                                className={`relative group bg-white/5 backdrop-blur-sm p-5 rounded-[2rem] border border-white/5 flex items-center gap-6 transition-all 
                                ${isLocked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-white/10 hover:border-purple-500/50 hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(168,85,247,0.2)]'}`}>
                               <div className="relative w-20 h-20 flex-shrink-0">
                                   <img src={track.cover} className="w-full h-full rounded-full object-cover border-2 border-white/10 shadow-lg group-hover:border-purple-400 transition-all" alt="cover" />
                                   {!isLocked && <div className="absolute inset-0 bg-black/20 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">▶️</div>}
                               </div>
                               <div className="flex-1">
                                   <h3 className="font-black text-xl tracking-tight mb-1">{track.title} {track.requiredRank && '👑'}</h3>
                                   <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">{track.artist} • <span className="text-purple-400">{track.bpm} BPM</span></p>
                               </div>
                               <div className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase ${track.difficulty === 'Expert' ? 'bg-purple-600/30 text-purple-300' : 'bg-white/5 text-gray-400'}`}>{track.difficulty}</div>
                               {isLocked && <div className="absolute right-6 top-1/2 -translate-y-1/2 text-2xl">🔒</div>}
                           </div>
                       );
                   })}
               </div>
               <div className="bg-white/5 backdrop-blur-xl p-8 rounded-[3rem] border border-white/10 shadow-2xl h-fit">
                   <h2 className="text-xs font-black text-purple-400 uppercase tracking-[0.3em] mb-8 flex items-center gap-2">🏆 Top 10 Thần Nhảy</h2>
                   <div className="space-y-5">
                       {leaderboard.length > 0 ? leaderboard.map((item, i) => (
                           <div key={i} className={`flex justify-between items-center bg-white/5 p-4 rounded-2xl border-l-4 ${i === 0 ? 'border-yellow-400 bg-yellow-400/5' : 'border-blue-500'}`}>
                               <div className="flex items-center gap-4">
                                   <span className={`font-black italic text-lg ${i === 0 ? 'text-yellow-400' : 'text-gray-600'}`}>{i+1}</span>
                                   <span className="font-bold text-sm truncate max-w-[120px]">{item.name}</span>
                               </div>
                               <span className="font-mono font-black text-white/90">{item.bestScore.toLocaleString()}</span>
                           </div>
                       )) : <p className="text-center text-gray-500 italic py-10 text-xs tracking-widest">Đang tải cao thủ...</p>}
                   </div>
               </div>
           </div>
        </div>
      )}

      {/* LOADING */}
      {gameState === 'LOADING' && (
          <div className="h-screen flex flex-col items-center justify-center bg-black">
              <div className="w-64 h-1 bg-gray-800 rounded-full overflow-hidden mb-6">
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
                          <button onClick={() => { setIsPaused(false); audioRef.current.play(); }} className="py-5 bg-white text-black font-black rounded-[2rem] uppercase tracking-widest hover:scale-105 transition-all">Tiếp tục quẩy</button>
                          <button onClick={() => { setGameState('LOBBY'); setIsPaused(false); }} className="py-5 bg-red-600 text-white font-black rounded-[2rem] uppercase tracking-widest hover:scale-105 transition-all">Rời sân khấu</button>
                      </div>
                  </div>
              )}

              <div className="absolute top-12 left-1/2 -translate-x-1/2 w-full max-w-md px-10">
                  <div className="h-4 bg-black/40 rounded-full border border-white/10 p-1 overflow-hidden shadow-2xl">
                      <div className={`h-full rounded-full transition-all duration-300 ${hp < 30 ? 'bg-red-500 animate-pulse' : 'bg-gradient-to-r from-green-500 to-blue-500'}`} style={{ width: `${hp}%` }}></div>
                  </div>
              </div>

              {judgment && (
                  <div key={judgment.id} className="absolute top-1/4 z-50 animate-bounce text-center">
                      <h2 className={`text-8xl font-black italic drop-shadow-[0_0_30px_rgba(255,255,255,0.3)] ${judgment.text === 'PERFECT' ? 'text-yellow-400 scale-110' : 'text-blue-400'}`}>{judgment.text}</h2>
                      {combo > 1 && <p className="text-3xl font-black text-white italic tracking-tighter">COMBO x{combo}</p>}
                  </div>
              )}

              <div className="w-fit min-w-[600px] max-w-[95vw] bg-white/5 backdrop-blur-2xl rounded-[4rem] p-12 border border-white/10 shadow-[0_20px_80px_rgba(0,0,0,0.5)] relative overflow-hidden">
                  <div className="flex justify-between items-end mb-12 px-4">
                      <div className="text-5xl font-black italic text-white/10">LVL {level}</div>
                      <div className="text-right">
                          <p className="text-[10px] font-black text-purple-400 uppercase tracking-[0.4em] mb-1">Current Score</p>
                          <p className="text-6xl font-black text-white tracking-tighter">{score.toLocaleString()}</p>
                      </div>
                  </div>

                  <div className={`flex flex-nowrap justify-center gap-4 sm:gap-6 mb-16 transition-all px-8 ${isFailedSeq ? 'opacity-10 blur-md' : ''}`}>
                      {targetSequence.map((item, i) => (
                          <span key={i} className={`text-6xl sm:text-8xl transition-all duration-150 flex-shrink-0 ${
                              i < userInput.length ? 'opacity-20 scale-90' : 
                              item.isRed ? 'text-pink-500 drop-shadow-[0_0_20px_rgba(236,72,153,0.6)]' : 'text-green-400 drop-shadow-[0_0_20px_rgba(74,222,128,0.4)]'
                          }`}>
                              {ARROW_SYMBOLS[item.display]}
                          </span>
                      ))}
                  </div>

                  <div className="relative h-20 bg-black/40 rounded-full border-[6px] border-white/5 shadow-inner overflow-hidden">
                      <div className="absolute inset-y-0 left-[75%] right-[5%] bg-blue-500/10"></div>
                      <div className="absolute inset-y-0 left-[85%] w-3 bg-white shadow-[0_0_40px_#fff] z-10"></div>
                      {burstEffect && <div className="absolute top-1/2 left-[85%] -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full border-8 border-white/20 animate-ping z-0 pointer-events-none"></div>}
                      <div className={`absolute top-1/2 -translate-y-1/2 w-12 h-12 rounded-full border-[6px] border-white shadow-2xl transition-transform z-20 ${userData.rankId === 'CHALLENGER' ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-yellow-400'}`} style={{ left: `${sliderPos}%` }}></div>
                  </div>
              </div>

              {/* MUSIC PLAYER (BOTTOM-CENTER) - ĐÃ DÀI RA VÀ XOAY 360 */}
              <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-full max-w-lg px-4">
                  <div className="bg-black/60 backdrop-blur-3xl p-6 rounded-[2.5rem] border border-white/10 shadow-2xl flex flex-col gap-5">
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-200" style={{ width: `${musicProgress}%` }}></div>
                      </div>
                      <div className="flex items-center gap-6">
                          {/* ALBUM XOAY */}
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
              <button onClick={() => setGameState('LOBBY')} className="px-16 py-6 bg-white text-black font-black rounded-full uppercase tracking-[0.2em] hover:scale-105 active:scale-95 transition-all">Thử lại sân khấu</button>
          </div>
      )}

      {/* RESULT */}
      {gameState === 'RESULT' && (
          <div className="h-screen flex items-center justify-center p-6 bg-black w-full">
              <div className="bg-white/5 backdrop-blur-2xl p-16 rounded-[4rem] border border-white/10 shadow-2xl max-w-xl w-full text-center">
                  <h2 className="text-6xl font-black italic text-white uppercase mb-12 tracking-tighter">BẢN NHẠC XONG!</h2>
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