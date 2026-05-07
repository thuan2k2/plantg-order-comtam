import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, updateDoc, collection, query, orderBy, limit, getDocs, increment, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getRankInfo } from '../utils/rankUtils';

const MUSIC_TRACKS = [
    { id: 'track1', src: '/music/track1.mp3', title: "Sôi Động Vinhomes", artist: "DJ Plant G", bpm: 110, difficulty: 'Easy', genre: 'Pop', cover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100&h=100&fit=crop' },
    { id: 'track2', src: '/music/track2.mp3', title: "Bass Cực Căng", artist: "Remixer Pro", bpm: 128, difficulty: 'Normal', genre: 'EDM', cover: 'https://images.unsplash.com/photo-1459749411177-042180ce673c?w=100&h=100&fit=crop' },
    { id: 'track3', src: '/music/track3.mp3', title: "Giai Điệu Buồn", artist: "Lofi Chill", bpm: 95, difficulty: 'Easy', genre: 'Lofi', cover: 'https://images.unsplash.com/photo-1516280440614-37939bb92583?w=100&h=100&fit=crop' },
    { id: 'track4', src: '/music/track4.mp3', title: "Dance Alone", artist: "V-Dance", bpm: 140, difficulty: 'Hard', genre: 'Dance', cover: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=100&h=100&fit=crop' },
    { id: 'track5', src: '/music/track5.mp3', title: "Challenger Anthem", artist: "Plant G VIP", bpm: 155, difficulty: 'Expert', genre: 'Hardstyle', cover: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=100&h=100&fit=crop', requiredRank: 'CHALLENGER' },
    { id: 'track6', src: '/music/track6.mp3', title: "đêm tĩnh lặng", artist: "kẻ cô đơn", bpm: 85, difficulty: 'Easy', genre: 'Lofi', cover: 'https://images.unsplash.com/photo-1493225457124-a1a2a5f0b008?w=100&h=100&fit=crop' },
    { id: 'track7', src: '/music/track7.mp3', title: "Cơm Tấm Rush", artist: "Bếp Trưởng", bpm: 135, difficulty: 'Hard', genre: 'Electro', cover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100&h=100&fit=crop' },
    { id: 'track8', src: '/music/track8.mp3', title: "Nhịp Đập Phố Đêm", artist: "Night Owl", bpm: 125, difficulty: 'Normal', genre: 'House', cover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&h=100&fit=crop' },
    { id: 'track9', src: '/music/track9.mp3', title: "góc tối", artist: "mưa rơi", bpm: 80, difficulty: 'Easy', genre: 'Lofi', cover: 'https://images.unsplash.com/photo-1499946981954-e7f4b234d7fa?w=100&h=100&fit=crop' },
    { id: 'track10', src: '/music/track10.mp3', title: "Spacebar Smasher", artist: "Keyboard Warrior", bpm: 150, difficulty: 'Hard', genre: 'Techno', cover: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=100&h=100&fit=crop' },
    { id: 'track11', src: '/music/track11.mp3', title: "Vũ Điệu Giao Hàng", artist: "Shipper Boy", bpm: 105, difficulty: 'Normal', genre: 'HipHop', cover: 'https://images.unsplash.com/photo-1483032469466-b937c425697b?w=100&h=100&fit=crop' },
    { id: 'track12', src: '/music/track12.mp3', title: "nỗi buồn để lại", artist: "hư không", bpm: 90, difficulty: 'Easy', genre: 'Lofi', cover: 'https://images.unsplash.com/photo-1458560871784-56d23406c091?w=100&h=100&fit=crop' },
    { id: 'track13', src: '/music/track13.mp3', title: "Speed Limit", artist: "Sonic", bpm: 160, difficulty: 'Expert', genre: 'Trance', cover: 'https://images.unsplash.com/photo-1478147427282-58a87a120781?w=100&h=100&fit=crop' },
    { id: 'track14', src: '/music/track14.mp3', title: "Plant G Party", artist: "All Stars", bpm: 120, difficulty: 'Normal', genre: 'Pop', cover: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=100&h=100&fit=crop' },
    { id: 'track15', src: '/music/track15.mp3', title: "Ký Ức Audition", artist: "Nostalgia", bpm: 115, difficulty: 'Normal', genre: 'Dance', cover: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=100&h=100&fit=crop' },
    { id: 'track16', src: '/music/track16.mp3', title: "chìm vào giấc mơ", artist: "kẻ mộng du", bpm: 75, difficulty: 'Easy', genre: 'Lofi', cover: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=100&h=100&fit=crop' },
    { id: 'track17', src: '/music/track17.mp3', title: "Tốc Độ Ánh Sáng", artist: "Master Tier", bpm: 175, difficulty: 'Expert', genre: 'Hardcore', cover: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=100&h=100&fit=crop', requiredRank: 'CHALLENGER' },
    { id: 'track18', src: '/music/track18.mp3', title: "Vương Miện Plant G", artist: "The Boss", bpm: 180, difficulty: 'Expert', genre: 'Hardstyle', cover: 'https://images.unsplash.com/photo-1505506874110-6a7a4f4aa009?w=100&h=100&fit=crop', requiredRank: 'CHALLENGER' }
];

const ARROW_SYMBOLS = { UP: '⬆️', DOWN: '⬇️', LEFT: '⬅️', RIGHT: '➡️' };
const OPPOSITE_KEYS = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' };

const AuGame = () => {
  const navigate = useNavigate();
  const [gameState, setGameState] = useState('LOBBY'); 
  const [isPaused, setIsPaused] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [userData, setUserData] = useState({ phone: '', name: '', totalXu: 0, rankId: '', dailyPlays: 0 });
  const [leaderboard, setLeaderboard] = useState([]);

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
          const todayStr = new Date().toDateString();
          const playsToday = data.auLastPlayDate === todayStr ? (data.auDailyPlays || 0) : 0;
          setUserData({ phone: phones[0], name: data.fullName || 'Người chơi', totalXu: data.totalXu || data.coins || 0, rankId: rankInfo.current.id, dailyPlays: playsToday });
        }
      } else { navigate('/'); }
    };
    fetchUser();
  }, [navigate]);

  const selectTrack = (track) => {
    if (track.requiredRank && userData.rankId !== track.requiredRank) return;
    setCurrentTrack(track);
    setGameState('LOADING');
    setLoadMusicProgress(0);
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

  // FIX LỖI ĐỒNG BỘ: Chỉ dùng requestAnimationFrame cho Slider Ball (60fps)
  useEffect(() => {
    if (gameState !== 'PLAYING' || isPaused || !currentTrack) return;
    
    const bps = currentTrack.bpm / 60;
    const measureSec = 4 / bps;

    const animate = () => {
      if (audioRef.current && !isPaused) {
         // Quả cầu bay theo nhịp beat
         const current = audioRef.current.currentTime;
         setSliderPos((current % measureSec) / measureSec * 100);
      }
      requestRef.current = requestAnimationFrame(animate);
    };
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [gameState, isPaused, currentTrack]);

  // FIX LỖI TIẾN TRÌNH NHẠC: Sử dụng Event Listener từ chính Audio Element
  const handleTimeUpdate = () => {
    if (audioRef.current && gameState === 'PLAYING') {
        const progress = (audioRef.current.currentTime / audioRef.current.duration) * 100;
        setMusicProgress(progress || 0);
    }
  };

  const togglePause = () => {
      if (isPaused) {
          audioRef.current.play();
          setIsPaused(false);
      } else {
          audioRef.current.pause();
          setIsPaused(true);
      }
  };

  const handleLeaveGame = () => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
      setGameState('LOBBY');
      setIsPaused(false);
  };

  const registerJudgment = (judg) => {
    setJudgment({ text: judg, id: Date.now() });
    const k = judg.toLowerCase();
    setStats(prev => ({ ...prev, [k]: prev[k] + 1 }));
    let scoreAdd = 0, hpAdd = 0, isSuccess = false;

    if (judg === 'PERFECT') {
        scoreAdd = 500 + (combo * 50); hpAdd = 8; setCombo(c => c + 1); setIsShaking(true); setBurstEffect(true);
        setTimeout(() => { setIsShaking(false); setBurstEffect(false); }, 300);
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
          const lbRef = doc(db, 'au_leaderboards', currentTrack.id, 'ranking', userData.phone);
          const snap = await getDoc(lbRef);
          if (!snap.exists() || snap.data().score < score) {
              await setDoc(lbRef, { name: userData.name, score: score, phone: userData.phone, timestamp: Date.now() });
          }
          const todayStr = new Date().toDateString();
          const userRef = doc(db, 'users', userData.phone);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
              const d = userSnap.data();
              let plays = d.auLastPlayDate === todayStr ? (d.auDailyPlays || 0) : 0;
              plays += 1;
              let updates = { auDailyPlays: plays, auLastPlayDate: todayStr };
              if (plays === 3) { updates.totalXu = increment(500); updates.lastUpdateSource = 'au_daily_quest'; updates.badges = arrayUnion('DANCER'); }
              await updateDoc(userRef, updates);
              setUserData(prev => ({ ...prev, dailyPlays: plays }));
          }
      } catch (e) { console.error(e); }
  };

  useEffect(() => { if (judgment) { const t = setTimeout(() => setJudgment(null), 1000); return () => clearTimeout(t); } }, [judgment]);

  return (
    <div className={`min-h-screen bg-gray-900 text-white font-sans overflow-hidden relative transition-all ${isShaking ? 'scale-[1.01]' : ''}`}>
      
      <style>{`
        .shake-animation { animation: shake 0.2s cubic-bezier(.36,.07,.19,.97) both; }
        @keyframes shake { 0%, 100% { transform: translate(0, 0); } 20% { transform: translate(-3px, 3px); } 40% { transform: translate(3px, -3px); } }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #4b5563; border-radius: 10px; }
      `}</style>

      {gameState === 'LOBBY' && (
        <div className="max-w-4xl mx-auto py-12 px-6 animate-in fade-in duration-500">
           <header className="flex justify-between items-center mb-10">
               <h1 className="text-4xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">AU PLANT G</h1>
               <div className="flex gap-4">
                   <div className="bg-gray-800 border border-gray-700 rounded-full px-4 py-1.5 flex items-center gap-2">
                       <span className="text-xl">🏆</span>
                       <p className="text-xs font-bold">{Math.min(userData.dailyPlays, 3)}/3 Bài</p>
                   </div>
                   <button onClick={() => navigate('/')} className="bg-gray-800 px-4 py-2 rounded-xl text-xs font-bold uppercase border border-gray-700">Trở về</button>
               </div>
           </header>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                   {MUSIC_TRACKS.map(track => (
                       <div key={track.id} onClick={() => selectTrack(track)} className={`relative bg-gray-800/50 p-4 rounded-2xl border flex items-center gap-4 transition-all group ${track.requiredRank && userData.rankId !== track.requiredRank ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-purple-500'}`}>
                           <img src={track.cover} className="w-14 h-14 rounded-lg object-cover" alt="cover" />
                           <div className="flex-1">
                               <h3 className="font-black text-base">{track.title} {track.requiredRank && '👑'}</h3>
                               <p className="text-gray-400 text-[10px]">{track.artist} • {track.bpm} BPM</p>
                           </div>
                           <div className={`text-[10px] font-black px-2 py-1 rounded uppercase ${track.difficulty === 'Expert' ? 'bg-purple-600' : 'bg-gray-700'}`}>{track.difficulty}</div>
                       </div>
                   ))}
               </div>
               <div className="bg-gray-800/30 p-6 rounded-[2rem] border border-gray-700/50">
                   <h2 className="text-[10px] font-black text-gray-500 uppercase mb-4">🏆 BXH TOÀN CẦU</h2>
                   <p className="text-center text-gray-600 italic py-10 text-xs">Chọn bài nhạc để xem cao thủ.</p>
               </div>
           </div>
        </div>
      )}

      {gameState === 'LOADING' && (
          <div className="h-screen flex flex-col items-center justify-center bg-black">
              <div className="w-64 h-1.5 bg-gray-800 rounded-full overflow-hidden mb-4">
                  <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300" style={{ width: `${loadProgress}%` }}></div>
              </div>
              <p className="text-[10px] font-black uppercase text-gray-500 tracking-[0.3em]">Loading stage... {Math.floor(loadProgress)}%</p>
          </div>
      )}

      {gameState === 'PREPARING' && (
          <div className="h-screen flex items-center justify-center">
              <div className="text-[15rem] leading-none font-black italic text-transparent bg-clip-text bg-gradient-to-b from-purple-400 to-pink-600 animate-bounce text-center w-full">
                  {prepCountdown > 0 ? prepCountdown : 'GO!'}
              </div>
          </div>
      )}

      {gameState === 'PLAYING' && (
          <div className="h-screen relative flex flex-col items-center justify-center p-6">
              {/* FIXED: Audio sử dụng onTimeUpdate để đồng bộ tiến trình cực chuẩn */}
              <audio 
                ref={audioRef} 
                src={currentTrack?.src} 
                autoPlay 
                onEnded={handleGameEnd} 
                onTimeUpdate={handleTimeUpdate}
                className="hidden" 
              />
              
              <button onClick={togglePause} className="absolute top-6 left-6 z-50 bg-white/10 hover:bg-white/20 p-3 rounded-full border border-white/20 backdrop-blur-md transition-all">
                  <span className="text-xl">{isPaused ? '▶️' : '⏸️'}</span>
              </button>

              {isPaused && (
                  <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex flex-col items-center justify-center animate-in fade-in duration-300">
                      <h2 className="text-6xl font-black italic text-white mb-10 tracking-tighter text-center">GAME PAUSED</h2>
                      <div className="flex flex-col gap-4 w-64">
                          <button onClick={togglePause} className="py-4 bg-white text-black font-black rounded-2xl uppercase tracking-widest hover:scale-105 transition-all">Tiếp tục</button>
                          <button onClick={handleLeaveGame} className="py-4 bg-red-600 text-white font-black rounded-2xl uppercase tracking-widest hover:scale-105 transition-all">Rời khỏi</button>
                      </div>
                  </div>
              )}

              <div className="absolute top-10 left-1/2 -translate-x-1/2 w-full max-w-md px-10">
                  <div className="h-3 bg-gray-800 rounded-full border border-white/10 p-0.5 overflow-hidden shadow-2xl">
                      <div className={`h-full rounded-full transition-all duration-300 ${hp < 30 ? 'bg-red-500 animate-pulse' : 'bg-gradient-to-r from-green-500 to-blue-500'}`} style={{ width: `${hp}%` }}></div>
                  </div>
              </div>

              {judgment && (
                  <div key={judgment.id} className="absolute top-1/4 z-50 animate-bounce text-center">
                      <h2 className={`text-7xl font-black italic drop-shadow-2xl ${judgment.text === 'PERFECT' ? 'text-yellow-400 scale-125' : 'text-blue-400'}`}>{judgment.text}</h2>
                      {combo > 1 && <p className="text-2xl font-black text-white italic">COMBO x{combo}</p>}
                  </div>
              )}

              <div className="w-fit min-w-[500px] max-w-[95vw] bg-gray-800/40 backdrop-blur-xl rounded-[3rem] p-10 border border-white/5 shadow-2xl relative overflow-hidden">
                  <div className="flex justify-between items-end mb-10 px-4">
                      <div className="text-4xl font-black italic text-white opacity-20">LVL {level}</div>
                      <div className="text-right"><p className="text-[10px] font-black text-gray-500 uppercase">Score</p><p className="text-5xl font-black text-yellow-400">{score.toLocaleString()}</p></div>
                  </div>

                  <div className={`flex flex-nowrap justify-center gap-3 sm:gap-5 mb-12 transition-all px-4 ${isFailedSeq ? 'opacity-20 blur-sm' : ''}`}>
                      {targetSequence.map((item, i) => (
                          <span key={i} className={`text-5xl sm:text-7xl transition-all duration-150 flex-shrink-0 ${
                              i < userInput.length ? 'opacity-20 scale-75' : 
                              item.isRed ? 'text-pink-500 drop-shadow-[0_0_15px_rgba(236,72,153,0.8)]' : 'text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,0.5)]'
                          }`}>
                              {ARROW_SYMBOLS[item.display]}
                          </span>
                      ))}
                  </div>

                  <div className="relative h-16 bg-black/60 rounded-full border-4 border-gray-700 shadow-inner overflow-hidden">
                      <div className="absolute inset-y-0 left-[75%] right-[5%] bg-blue-500/20"></div>
                      <div className="absolute inset-y-0 left-[85%] w-2 bg-white shadow-[0_0_30px_#fff] z-10"></div>
                      {burstEffect && <div className="absolute top-1/2 left-[85%] -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border-4 border-yellow-300 animate-ping z-0 pointer-events-none"></div>}
                      <div className={`absolute top-1/2 -translate-y-1/2 w-10 h-10 rounded-full border-4 border-white transition-transform z-20 ${userData.rankId === 'CHALLENGER' ? 'bg-gradient-to-r from-purple-500 to-pink-500 shadow-[0_0_30px_rgba(236,72,153,0.8)]' : 'bg-yellow-400 shadow-[0_0_30px_#facc15]'}`} style={{ left: `${sliderPos}%` }}></div>
                  </div>
              </div>

              {/* MUSIC PLAYER (BOTTOM-CENTER) - Đã đồng bộ tiến trình cực chuẩn */}
              <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-full max-w-sm px-4">
                  <div className="bg-black/60 backdrop-blur-xl p-4 rounded-[2rem] border border-white/10 shadow-2xl flex flex-col gap-3">
                      <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-purple-500 transition-all duration-200" 
                            style={{ width: `${musicProgress}%` }}
                          ></div>
                      </div>
                      <div className="flex items-center gap-4">
                          <img src={currentTrack?.cover} className={`w-12 h-12 rounded-xl object-cover border border-white/10 ${!isPaused && 'animate-spin-slow'}`} alt="art" />
                          <div className="overflow-hidden">
                              <p className="text-xs font-black uppercase text-white truncate leading-none mb-1">{currentTrack?.title}</p>
                              <p className="text-[10px] text-gray-400 font-bold truncate uppercase">{currentTrack?.artist}</p>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {gameState === 'GAME_OVER' && (
          <div className="h-screen bg-black/90 flex flex-col items-center justify-center text-center p-6 animate-in zoom-in">
              <div className="text-9xl mb-8">💀</div>
              <h2 className="text-6xl font-black text-red-600 uppercase tracking-tighter mb-4 italic">GAME OVER</h2>
              <button onClick={() => setGameState('LOBBY')} className="px-12 py-5 bg-white text-black font-black rounded-full uppercase hover:scale-105 active:scale-95 transition-all">Về Lobby</button>
          </div>
      )}

      {gameState === 'RESULT' && (
          <div className="h-screen flex items-center justify-center p-6 bg-gradient-to-br from-purple-900/50 to-gray-900 w-full">
              <div className="bg-gray-800/80 backdrop-blur-2xl p-12 rounded-[4rem] border border-white/10 shadow-2xl max-w-md w-full text-center">
                  <h2 className="text-5xl font-black italic text-white uppercase mb-8">BẢN NHẠC XONG!</h2>
                  <div className="grid grid-cols-2 gap-4 mb-10">
                      <div className="bg-black/30 p-4 rounded-3xl"><p className="text-[10px] text-gray-500 font-black uppercase">Max Combo</p><p className="text-3xl font-black text-blue-400">{maxCombo}</p></div>
                      <div className="bg-black/30 p-4 rounded-3xl"><p className="text-[10px] text-gray-500 font-black uppercase">Perfects</p><p className="text-3xl font-black text-green-400">{stats.perfect}</p></div>
                  </div>
                  <div className="mb-10"><p className="text-xs text-gray-400 uppercase mb-2">Tổng điểm</p><p className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-500">{score.toLocaleString()}</p></div>
                  <button onClick={() => setGameState('LOBBY')} className="w-full py-5 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-black rounded-3xl uppercase tracking-widest shadow-xl">Tiếp tục</button>
              </div>
          </div>
      )}

    </div>
  );
};

export default AuGame;