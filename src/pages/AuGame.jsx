import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getRankInfo } from '../utils/rankUtils';

const ARROW_SYMBOLS = { UP: '⬆️', DOWN: '⬇️', LEFT: '⬅️', RIGHT: '➡️' };
const OPPOSITE_KEYS = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' };

// --- ĐÃ THÊM: Custom Hook tạo hiệu ứng số nhảy cuộn (Rolling Number) ---
function useRollingScore(value, duration = 300) {
    const [displayValue, setDisplayValue] = useState(value);
    
    useEffect(() => {
        let startTimestamp = null;
        const startValue = displayValue;
        
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            
            setDisplayValue(Math.floor(progress * (value - startValue) + startValue));
            
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        
        window.requestAnimationFrame(step);
    }, [value, duration]);
    
    return displayValue;
}

const AuGame = () => {
  const navigate = useNavigate();
  const [gameState, setGameState] = useState('LOBBY'); 
  const [isPaused, setIsPaused] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [userData, setUserData] = useState({ phone: '', name: '', rankId: '' });
  const [leaderboard, setLeaderboard] = useState([]);
  
  const [musicList, setMusicList] = useState([]);
  const [isLoadingMusic, setIsLoadingMusic] = useState(true);

  // --- QUẢN LÝ ÂM LƯỢNG (Lưu vào LocalStorage) ---
  const [volumes, setVolumes] = useState(() => {
      const saved = localStorage.getItem('auVolumes');
      return saved ? JSON.parse(saved) : { lobby: 0.5, track: 0.8, sfx: 0.8, judgment: 0.8, end: 0.8 };
  });
  const [showSettings, setShowSettings] = useState(false);

  // Gameplay States
  const [hp, setHp] = useState(100);
  const [level, setLevel] = useState(4); 
  const [score, setScore] = useState(0);
  
  // Tích hợp Hook cuộn điểm cho Score
  const displayScore = useRollingScore(score, 400); 

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

  // Trạng thái dùng để kích hoạt hiệu ứng Rest Wave
  const [isResting, setIsResting] = useState(false);

  // Visual Effects
  const [isShaking, setIsShaking] = useState(false);
  const [loadProgress, setLoadMusicProgress] = useState(0);
  const [prepCountdown, setPrepCountdown] = useState(3);

  const audioRef = useRef(null);
  const requestRef = useRef();

  // Refs Tracking
  const cycleRef = useRef(0);
  const hasJudgedRef = useRef(false);
  const targetSeqRef = useRef([]);
  const userInputRef = useRef([]);
  const isFailedSeqRef = useRef(false);
  const levelRef = useRef(4);
  const perfectComboRef = useRef(0); 
  const prevLevelRangeRef = useRef(null);
  const hasStartedNotesRef = useRef(false); 
  const lastRestMusicRef = useRef(null); 

  // --- HỆ THỐNG ÂM THANH (SFX & LOBBY) ---
  const sfxRef = useRef(null);
  const lobbyAudioRef = useRef(null);
  const fadeIntervalRef = useRef(null);

  useEffect(() => {
    sfxRef.current = {
      perfect: new Audio('/music/7 sould dance/perfect.ogg'),
      great: new Audio('/music/7 sould dance/good.ogg'), 
      cool: new Audio('/music/7 sould dance/cool.ogg'),
      fail: new Audio('/music/7 sould dance/fail.ogg'),
      missKey: new Audio('/music/7 sould dance/normal_miss.ogg'),
      readyGo: new Audio('/music/7 sould dance/ready_go.ogg'),
      countdown: new Audio('/music/7 sould dance/demnguoc.ogg'),
      end: new Audio('/music/7 sould dance/seg_end.ogg'),
      level2: new Audio('/music/cap do/Level2.ogg'),
      level3: new Audio('/music/cap do/Level3.ogg'),
      level4: new Audio('/music/cap do/Level4.ogg'),
      level5: new Audio('/music/cap do/Level5.ogg'),
      rest1: new Audio('/music/giua tran/loverDance_FinishTimeBegin.ogg'),
      rest2: new Audio('/music/giua tran/loverDance_ShowTimeBegin.ogg'),
      rest3: new Audio('/music/giua tran/Outdoor_applause.ogg'),
      rest4: new Audio('/music/giua tran/Outdoor_fireworks.ogg'),
    };

    const lobbyTracks = [1, 2, 3, 4, 5, 6].map(n => `/music/nhac cho/loverDance_FinishTime_${n}.ogg`);
    const randomTrack = lobbyTracks[Math.floor(Math.random() * lobbyTracks.length)];
    lobbyAudioRef.current = new Audio(randomTrack);
    lobbyAudioRef.current.loop = false;

    return () => {
        clearInterval(fadeIntervalRef.current);
        if (lobbyAudioRef.current) lobbyAudioRef.current.pause();
    };
  }, []);

  const handleVolumeChange = (key, value) => {
      const newVols = { ...volumes, [key]: parseFloat(value) };
      setVolumes(newVols);
      localStorage.setItem('auVolumes', JSON.stringify(newVols));
      
      if (key === 'lobby' && lobbyAudioRef.current && gameState === 'LOBBY') {
          lobbyAudioRef.current.volume = parseFloat(value);
      }
      if (key === 'track' && audioRef.current) {
          audioRef.current.volume = parseFloat(value);
      }
  };

  useEffect(() => {
      if (!lobbyAudioRef.current) return;
      if (gameState === 'LOBBY') {
          const targetVolume = volumes.lobby;
          lobbyAudioRef.current.volume = 0;
          lobbyAudioRef.current.play().catch(e => console.warn("Lobby Music block:", e));
          
          clearInterval(fadeIntervalRef.current);
          fadeIntervalRef.current = setInterval(() => {
              if (lobbyAudioRef.current.volume + 0.05 < targetVolume) {
                  lobbyAudioRef.current.volume += 0.05;
              } else {
                  lobbyAudioRef.current.volume = targetVolume;
                  clearInterval(fadeIntervalRef.current);
              }
          }, 200); 
      } else {
          clearInterval(fadeIntervalRef.current);
          lobbyAudioRef.current.pause();
      }
  }, [gameState]);

  useEffect(() => {
      if (audioRef.current) {
          audioRef.current.volume = volumes.track;
      }
  }, [currentTrack, volumes.track]);

  const playSFX = (type, category = 'sfx') => {
    if (sfxRef.current && sfxRef.current[type]) {
        sfxRef.current[type].currentTime = 0;
        sfxRef.current[type].volume = volumes[category];
        sfxRef.current[type].play().catch(() => {});
    }
  };

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
                prevLevelRangeRef.current = null; 
                setIsResting(false);
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

    const len = newSeq.length;
    let currentRange = 0; 
    
    if (len >= 9) currentRange = 5;       
    else if (len >= 7) currentRange = 4;  
    else if (len >= 5) currentRange = 3;  
    else if (len >= 3) currentRange = 2;  
    else if (len >= 1) currentRange = 1;  

    if (len > 0) {
        hasStartedNotesRef.current = true; 
        setIsResting(false); // Đang có phím -> Tắt hiệu ứng Rest Wave
    }

    if (currentRange > 1 && currentRange !== prevLevelRangeRef.current) {
        playSFX(`level${currentRange}`, 'sfx');
    } else if (currentRange === 0 && hasStartedNotesRef.current) {
        setIsResting(true); // Nhịp rỗng -> Bật hiệu ứng Rest Wave
        if (prevLevelRangeRef.current !== 0) {
            const restSFX = ['rest1', 'rest2', 'rest3', 'rest4'];
            const available = restSFX.filter(r => r !== lastRestMusicRef.current);
            const randomSFX = available[Math.floor(Math.random() * available.length)];
            
            playSFX(randomSFX, 'sfx');
            lastRestMusicRef.current = randomSFX; 
        }
    }
    
    prevLevelRangeRef.current = currentRange; 

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
        playSFX('countdown', 'sfx'); 
        const t = setTimeout(() => setPrepCountdown(prev => prev - 1), 1000);
        return () => clearTimeout(t);
      } else if (prepCountdown === 0) {
        playSFX('readyGo', 'sfx'); 
        const t = setTimeout(() => {
            setGameState('PLAYING');
            const initialLv = currentTrack.difficulty === 'Expert' ? 8 : currentTrack.difficulty === 'Hard' ? 7 : 4;
            setLevel(initialLv); levelRef.current = initialLv; cycleRef.current = 0; perfectComboRef.current = 0;
            
            hasStartedNotesRef.current = false; 
            prevLevelRangeRef.current = null;
            lastRestMusicRef.current = null;
            
            loadNextMeasure(0);
        }, 1500); 
        return () => clearTimeout(t);
      }
    }
  }, [gameState, prepCountdown, currentTrack]);

  const processJudgment = (judg) => {
    setJudgment({ text: judg, id: Date.now() });
    setTimeout(() => setJudgment(prev => prev?.text === judg ? null : prev), 400);

    const k = judg.toLowerCase();
    setStats(prev => ({ ...prev, [k]: prev[k] + 1 }));

    let scoreAdd = 0;
    let isSuccess = false;
    let hpAdd = 0;

    const baseKeyScore = targetSeqRef.current.length * 10;

    if (judg === 'PERFECT') {
        playSFX('perfect', 'judgment');
        perfectComboRef.current += 1;
        scoreAdd = baseKeyScore + (10 * perfectComboRef.current);
        isSuccess = true; hpAdd = 8; 
        setCombo(perfectComboRef.current);
    } else if (judg === 'GREAT') {
        playSFX('great', 'judgment');
        perfectComboRef.current = 0; 
        scoreAdd = baseKeyScore + 5;
        isSuccess = true; hpAdd = 3; 
        setCombo(0); 
    } else if (judg === 'COOL') {
        playSFX('cool', 'judgment');
        perfectComboRef.current = 0; 
        scoreAdd = baseKeyScore + 2;
        isSuccess = true; hpAdd = 1; 
        setCombo(0); 
    } else if (judg === 'BAD') {
        playSFX('fail', 'judgment');
        perfectComboRef.current = 0; 
        scoreAdd = 0; 
        hpAdd = -15; 
        setCombo(0); 
    } else { // MISS
        playSFX('fail', 'judgment');
        perfectComboRef.current = 0; 
        scoreAdd = 0; 
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

  useEffect(() => {
    if (!audioRef.current) return;
    if (gameState === 'PLAYING' && !isPaused) {
        audioRef.current.play().catch(e => console.warn("Audio play issue:", e));
    } else {
        audioRef.current.pause();
    }
  }, [isPaused, gameState]);

  const togglePause = () => {
      setIsPaused(prev => !prev);
  };

  const handleLeaveGame = () => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
      setGameState('LOBBY'); setIsPaused(false); fetchGlobalLeaderboard(); 
  };

  useEffect(() => {
    if (gameState !== 'PLAYING' || isPaused || !currentTrack) return;
    const bps = currentTrack.bpm / 60;
    const measureSec = 4 / bps;
    
    const animate = () => {
      if (audioRef.current && !isPaused) {
         const currentTime = audioRef.current.currentTime;
         const currentCycle = Math.floor(currentTime / measureSec);
         
         setSliderPos((currentTime % measureSec) / measureSec * 100);

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
            playSFX('missKey', 'judgment');
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
      playSFX('end', 'end'); 
      
      try {
          if (!userData.phone) return;
          const globalRef = doc(db, 'au_global_leaderboard', userData.phone);
          const snap = await getDoc(globalRef);
          if (!snap.exists() || snap.data().bestScore < score) {
              await setDoc(globalRef, { name: userData.name, bestScore: score, phone: userData.phone, timestamp: Date.now() });
          }
      } catch (e) { console.error(e); }
  };

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

      {/* --- CSS CHO TIẾN TRÌNH VIỀN VÀ CÁC HIỆU ỨNG MỚI --- */}
      <style>{`
        .modern-impact { animation: impact 0.2s cubic-bezier(.36,.07,.19,.97) both; }
        @keyframes impact { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.02) translateY(5px); } }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 10px; }
        .glass-card { background: rgba(0, 0, 0, 0.4); backdrop-blur: 20px; border: 1px solid rgba(255, 255, 255, 0.1); }
        
        .edge-progress {
            position: absolute; inset: 0; pointer-events: none; z-index: 30;
            padding: 4px; 
            background: conic-gradient(from 0deg at 50% 50%, #22d3ee var(--music-progress), transparent 0);
            -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            -webkit-mask-composite: xor;
            mask-composite: exclude;
            transition: all 0.3s ease;
        }

        /* ĐÃ THÊM: Class viền sóng phát sáng khi Rest Time */
        .edge-rest-wave {
            background: linear-gradient(90deg, #22d3ee, #a855f7, #22d3ee);
            background-size: 200% 200%;
            animation: waveFlow 2s linear infinite, glowPulse 1.5s ease-in-out infinite alternate;
            padding: 8px; /* Dày hơn lúc bình thường */
            box-shadow: inset 0 0 50px rgba(34,211,238,0.5);
        }
        @keyframes waveFlow { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
        @keyframes glowPulse { 0% { opacity: 0.7; filter: drop-shadow(0 0 10px #22d3ee); } 100% { opacity: 1; filter: drop-shadow(0 0 30px #a855f7); } }

        .pill-progress {
            position: absolute; inset: 0; pointer-events: none; z-index: 0;
            border-radius: 9999px;
            padding: 3px; 
            background: conic-gradient(from 0deg at 50% 50%, #22d3ee var(--music-progress), transparent 0);
            -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            -webkit-mask-composite: xor;
            mask-composite: exclude;
        }

        /* ĐÃ THÊM: Xoay đĩa đệm (Avatar Nhạc) */
        .album-rotate { animation: spin 4s linear infinite; }
        .album-rotate-paused { animation-play-state: paused; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>

      {/* --- CÀI ĐẶT ÂM THANH MODAL --- */}
      {showSettings && (
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
      )}

      {/* LOBBY */}
      {gameState === 'LOBBY' && (
        <div className="relative z-10 max-w-6xl mx-auto py-12 px-6 animate-in fade-in duration-500">
           <header className="flex justify-between items-center mb-12">
               <h1 className="text-5xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">AU PLANT G</h1>
               <div className="flex gap-4">
                   <button onClick={() => setShowSettings(true)} className="bg-white/5 hover:bg-white/10 px-4 py-2 rounded-2xl text-lg transition-all border border-white/10 shadow-[0_0_15px_rgba(34,211,238,0.1)]">⚙️</button>
                   <button onClick={() => navigate('/')} className="bg-white/5 hover:bg-white/10 px-6 py-2 rounded-2xl text-xs font-black uppercase tracking-widest border border-white/10 transition-all">Trở về</button>
               </div>
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
          <div className="h-screen relative z-10 w-full overflow-hidden">
              
              {/* --- ĐÃ SỬA: Viền Màn Hình Chạy Nhịp (Thêm hiệu ứng Rest) --- */}
              <div className={`edge-progress ${isResting ? 'edge-rest-wave' : ''}`} style={{ '--music-progress': `${musicProgress}%` }}></div>

              <audio ref={audioRef} src={currentTrack?.src} onEnded={handleGameEnd} onTimeUpdate={handleTimeUpdate} className="hidden" />
              
              {/* --- ĐÃ ĐỔI VỊ TRÍ: Nút Pause chuyển sang Góc Trái --- */}
              <button onClick={togglePause} className="absolute top-8 left-8 z-50 bg-black/50 p-4 rounded-2xl border border-white/10 backdrop-blur-md hover:bg-white/10 transition-all">⏸️</button>

              {isPaused && (
                  <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-[100] flex flex-col items-center justify-center animate-in fade-in">
                      <h2 className="text-8xl font-black italic text-white mb-16 tracking-tighter drop-shadow-[0_0_20px_rgba(0,0,0,0.8)]">PAUSED</h2>
                      <div className="flex gap-6">
                          <button onClick={togglePause} className="px-10 py-4 bg-cyan-500 text-black font-black rounded-full uppercase tracking-widest hover:scale-105 transition-all">Tiếp tục</button>
                          <button onClick={handleLeaveGame} className="px-10 py-4 bg-white/10 text-white font-black rounded-full uppercase tracking-widest hover:bg-red-500 transition-all border border-white/20">Thoát</button>
                      </div>
                  </div>
              )}

              {/* KHU VỰC TOP-CENTER (NĂNG LƯỢNG) */}
              <div className="absolute top-8 left-1/2 -translate-x-1/2 flex flex-col items-center w-full max-w-md z-40">
                  <div className="w-full bg-black/40 backdrop-blur-md p-3 rounded-2xl border border-white/10 shadow-lg">
                      <div className="flex justify-between items-end mb-2 px-1">
                          <p className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.3em]">ENERGY</p>
                          <p className="text-[10px] text-white/50 font-black">{Math.floor(hp)}%</p>
                      </div>
                      <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                          <div className={`h-full transition-all duration-300 ${hp < 30 ? 'bg-red-500 shadow-[0_0_10px_red]' : 'bg-cyan-400 shadow-[0_0_10px_cyan]'}`} style={{ width: `${hp}%` }}></div>
                      </div>
                  </div>
              </div>

              {/* KHU VỰC TRÁI GIỮA (ĐIỂM SỐ DẠNG CUỘN) */}
              <div className="absolute left-8 top-1/2 -translate-y-1/2 flex flex-col w-64 sm:w-80 lg:w-96">
                  <div className="drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)] w-full">
                      <p className="text-sm font-black italic text-white/50 uppercase tracking-[0.5em] mb-[-5px]">SCORE</p>
                      <p className="text-5xl sm:text-6xl lg:text-7xl font-black italic text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400 tracking-tighter break-words leading-none py-2">
                          {/* SỬ DỤNG BIẾN ĐIỂM SỐ CUỘN */}
                          {displayScore.toLocaleString()}
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
                  
                  {/* Thanh Nhịp điệu và Level */}
                  <div className="flex items-center gap-4 w-full px-4">
                      <span className="font-black italic text-cyan-400 text-xl tracking-wider drop-shadow-[0_0_10px_cyan]">
                          LV {Math.floor(level)}
                      </span>
                      <div className="relative flex-1 h-4 bg-black/80 rounded-full border border-white/20 shadow-[0_0_20px_rgba(34,211,238,0.2)]">
                          <div className="absolute left-[75%] right-[5%] inset-y-0 bg-cyan-500/20 rounded-full"></div>
                          <div className="absolute left-[85%] w-[3px] h-[150%] top-[-25%] bg-white shadow-[0_0_10px_white,0_0_20px_cyan] rounded-full z-10"></div>
                          <div className="absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white shadow-[0_0_15px_white,0_0_30px_cyan] transition-transform z-20" style={{ left: `${sliderPos}%` }}></div>
                      </div>
                  </div>

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

                  {/* Thanh Thông Tin Nhạc + Viền Progress (Pill) */}
                  <div className="mt-8 flex flex-col items-center">
                      <div className="flex items-center gap-4 bg-black/60 backdrop-blur-xl pl-3 pr-8 py-3 rounded-full shadow-2xl relative">
                          <div className="pill-progress" style={{ '--music-progress': `${musicProgress}%` }}></div>
                          
                          {/* --- ĐÃ SỬA: Ảnh Avatar Xoay (Dừng khi Pause) --- */}
                          <img src={currentTrack?.cover} className={`w-14 h-14 rounded-full object-cover border border-white/20 z-10 album-rotate ${isPaused ? 'album-rotate-paused' : ''}`} alt="cover" />
                          
                          <div className="flex flex-col z-10">
                              <span className="font-black text-lg text-white tracking-tight leading-none mb-1">{currentTrack?.title}</span>
                              <span className="text-xs text-cyan-400 font-bold uppercase tracking-widest leading-none">{currentTrack?.artist}</span>
                          </div>
                      </div>
                  </div>
              </div>

              {/* GÓC TRÁI DƯỚI: ĐỘ KHÓ (SAO) */}
              <div className="absolute bottom-10 left-8 flex flex-col gap-1 drop-shadow-[0_5px_10px_rgba(0,0,0,0.8)]">
                  <span className="font-black italic text-2xl text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 uppercase">
                     {currentTrack?.difficulty || 'NORMAL'}
                  </span>
                  <div className="flex gap-1 text-yellow-400 text-lg drop-shadow-[0_0_10px_yellow]">
                      {[...Array(getDifficultyStars(currentTrack?.difficulty))].map((_, i) => <span key={i}>★</span>)}
                  </div>
              </div>

          </div>
      )}

      {/* HIỂN THỊ CHỮ READY GO SAU KHI ĐẾM NGƯỢC */}
      {gameState === 'PREPARING' && (
          <div className="h-screen flex items-center justify-center relative z-10">
              <div className="text-[12rem] sm:text-[15rem] leading-none font-black italic text-white drop-shadow-[0_0_50px_cyan] animate-bounce text-center select-none uppercase">
                  {prepCountdown > 0 ? prepCountdown : 'READY GO!'}
              </div>
          </div>
      )}
      
      {gameState === 'RESULT' && (
          <div className="h-screen flex items-center justify-center p-6 w-full relative z-10">
              <div className="bg-black/60 backdrop-blur-2xl p-16 rounded-[4rem] border border-white/10 shadow-[0_0_100px_rgba(34,211,238,0.2)] max-w-xl w-full text-center animate-in zoom-in duration-500">
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