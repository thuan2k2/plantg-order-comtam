import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, updateDoc, collection, query, orderBy, limit, getDocs, increment, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase/config';

// MỚI: Import Utils tính Rank
import { getRankInfo } from '../utils/rankUtils';

// HỆ THỐNG METADATA NÂNG CAO (FULL 18 TRACKS)
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
  const [gameState, setGameState] = useState('LOBBY'); // LOBBY -> LOADING -> PREPARING -> PLAYING -> RESULT -> GAME_OVER
  const [currentTrack, setCurrentTrack] = useState(null);
  
  // Thêm rankId và dailyPlays vào userData
  const [userData, setUserData] = useState({ phone: '', name: '', totalXu: 0, rankId: '', dailyPlays: 0 });
  const [leaderboard, setLeaderboard] = useState([]);

  // Gameplay States
  const [hp, setHp] = useState(100);
  const [level, setLevel] = useState(4); 
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [judgment, setJudgment] = useState(null); 
  const [stats, setStats] = useState({ perfect: 0, great: 0, cool: 0, bad: 0, miss: 0 });
  
  // UI States
  const [sliderPos, setSliderPos] = useState(0);
  const [userInput, setUserInput] = useState([]);
  const [targetSequence, setTargetSequence] = useState([]);
  const [isFailedSeq, setIsFailedSeq] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [burstEffect, setBurstEffect] = useState(false);
  const [loadProgress, setLoadMusicProgress] = useState(0);
  const [prepCountdown, setPrepCountdown] = useState(3);

  const audioRef = useRef(null);
  const requestRef = useRef();

  // 1. KHỞI TẠO & LẤY DỮ LIỆU
  useEffect(() => {
    const fetchUser = async () => {
      const phones = JSON.parse(localStorage.getItem('recentPhones') || '[]');
      if (phones.length > 0) {
        const userSnap = await getDoc(doc(db, 'users', phones[0]));
        if (userSnap.exists()) {
          const data = userSnap.data();
          const rankInfo = getRankInfo(data.totalSpend || 0, data.manualRankId);
          
          // Tính số lần chơi hôm nay
          const todayStr = new Date().toDateString();
          const playsToday = data.auLastPlayDate === todayStr ? (data.auDailyPlays || 0) : 0;

          setUserData({ 
              phone: phones[0], 
              name: data.fullName || 'Người chơi', 
              totalXu: data.totalXu || data.coins || 0,
              rankId: rankInfo.current.id,
              dailyPlays: playsToday
          });
        }
      } else {
        alert("Vui lòng đăng nhập!"); navigate('/');
      }
    };
    fetchUser();
  }, [navigate]);

  const fetchLeaderboard = async (trackId) => {
    try {
        const lbRef = collection(db, 'au_leaderboards', trackId, 'ranking');
        const q = query(lbRef, orderBy('score', 'desc'), limit(5));
        const querySnapshot = await getDocs(q);
        setLeaderboard(querySnapshot.docs.map(d => d.data()));
    } catch (e) { console.error("Lỗi lấy Leaderboard:", e); }
  };

  // 2. LOGIC ĐIỀU KHIỂN TRẠNG THÁI
  const selectTrack = (track) => {
    // KHÓA NHẠC NẾU KHÔNG ĐỦ RANK
    if (track.requiredRank && userData.rankId !== track.requiredRank) return;

    setCurrentTrack(track);
    fetchLeaderboard(track.id);
    setGameState('LOADING');
    
    let prog = 0;
    const interval = setInterval(() => {
        prog += Math.random() * 15;
        if (prog >= 100) {
            setLoadMusicProgress(100);
            clearInterval(interval);
            setTimeout(() => {
                setGameState('PREPARING');
                setPrepCountdown(3);
                setHp(100); setScore(0); setCombo(0); setMaxCombo(0);
                setStats({ perfect: 0, great: 0, cool: 0, bad: 0, miss: 0 });
            }, 500);
        } else {
            setLoadMusicProgress(prog);
        }
    }, 200);
  };

  const generateNewSequence = (lv) => {
    const seq = [];
    const redChance = lv > 6 ? (lv - 5) * 0.12 : 0;
    for(let i = 0; i < lv; i++) {
        const dir = ['UP', 'DOWN', 'LEFT', 'RIGHT'][Math.floor(Math.random() * 4)];
        const isRed = Math.random() < redChance;
        seq.push({ display: dir, actual: isRed ? OPPOSITE_KEYS[dir] : dir, isRed });
    }
    setTargetSequence(seq);
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
        generateNewSequence(currentTrack.difficulty === 'Expert' ? 8 : currentTrack.difficulty === 'Hard' ? 7 : 4);
      }
    }
  }, [gameState, prepCountdown, currentTrack]);

  // 3. ĐỒNG BỘ BPM & THANH TRƯỢT
  useEffect(() => {
    if (gameState === 'PLAYING' && currentTrack && audioRef.current) {
        audioRef.current.load(); 
        audioRef.current.play().catch(e => {
            console.error("Trình duyệt chặn Autoplay:", e);
            alert("Vui lòng tương tác màn hình để phát nhạc!");
        });
    }
  }, [gameState, currentTrack]);

  useEffect(() => {
    if (gameState !== 'PLAYING' || !currentTrack) return;
    const bps = currentTrack.bpm / 60;
    const measureSec = 4 / bps;

    const animate = () => {
      if (audioRef.current) {
         setSliderPos((audioRef.current.currentTime % measureSec) / measureSec * 100);
      }
      requestRef.current = requestAnimationFrame(animate);
    };
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [gameState, currentTrack]);

  // 4. HỆ THỐNG HP & ĐÁNH GIÁ
  const registerJudgment = (judg) => {
    setJudgment({ text: judg, id: Date.now() });
    const k = judg.toLowerCase();
    setStats(prev => ({ ...prev, [k]: prev[k] + 1 }));

    let scoreAdd = 0;
    let hpAdd = 0;
    let isSuccess = false;

    if (judg === 'PERFECT') {
        scoreAdd = 500 + (combo * 50); hpAdd = 8; setCombo(c => c + 1); setIsShaking(true); setBurstEffect(true);
        setTimeout(() => setIsShaking(false), 200); setTimeout(() => setBurstEffect(false), 300);
        isSuccess = true;
    } else if (judg === 'GREAT') {
        scoreAdd = 300; hpAdd = 3; setCombo(0); isSuccess = true;
    } else if (judg === 'COOL') {
        scoreAdd = 100; hpAdd = 1; setCombo(0); isSuccess = true;
    } else if (judg === 'BAD') {
        scoreAdd = 20; hpAdd = -15; setCombo(0);
    } else {
        scoreAdd = 0; hpAdd = -25; setCombo(0);
    }

    setScore(s => s + scoreAdd);
    setHp(prev => {
        const newHp = Math.max(0, Math.min(100, prev + hpAdd));
        if (newHp <= 0) {
            setGameState('GAME_OVER');
            if (audioRef.current) audioRef.current.pause();
        }
        return newHp;
    });

    if (combo + 1 > maxCombo) setMaxCombo(combo + 1);
    
    let newLv = level;
    if (isSuccess) newLv = Math.min(11, level + 0.5);
    else if (judg === 'MISS') newLv = Math.max(4, level - 1);
    setLevel(Math.floor(newLv));
    generateNewSequence(Math.floor(newLv));
  };

  useEffect(() => {
    if (gameState !== 'PLAYING') return;
    const handleKeyDown = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault(); if (isFailedSeq) return;
        const keyMap = { ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT' };
        setUserInput((prev) => {
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
  }, [gameState, targetSequence, userInput, sliderPos, isFailedSeq, combo, level, maxCombo]);

  // 5. TÍCH HỢP NHIỆM VỤ NGÀY VÀ CẬP NHẬT RANKING
  const handleGameEnd = async () => {
      setGameState('RESULT');
      try {
          // A. Cập nhật Bảng xếp hạng
          const lbRef = doc(db, 'au_leaderboards', currentTrack.id, 'ranking', userData.phone);
          const snap = await getDoc(lbRef);
          if (!snap.exists() || snap.data().score < score) {
              await setDoc(lbRef, { name: userData.name, score: score, phone: userData.phone, timestamp: Date.now() });
          }

          // B. Xử lý Nhiệm vụ hằng ngày
          const todayStr = new Date().toDateString();
          const userRef = doc(db, 'users', userData.phone);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
              const d = userSnap.data();
              let plays = d.auLastPlayDate === todayStr ? (d.auDailyPlays || 0) : 0;
              plays += 1;
              
              let updates = { auDailyPlays: plays, auLastPlayDate: todayStr };
              let justCompletedQuest = false;

              // Hoàn thành nhiệm vụ (Vừa đạt mốc 3 bài)
              if (plays === 3) {
                  updates.totalXu = increment(500); // Thưởng 500 Xu
                  updates.lastUpdateSource = 'au_daily_quest';
                  updates.badges = arrayUnion('DANCER'); // Tặng Huy hiệu Dancer
                  justCompletedQuest = true;
              }

              await updateDoc(userRef, updates);
              setUserData(prev => ({ ...prev, dailyPlays: plays }));

              // Bắn thông báo nếu hoàn thành
              if (justCompletedQuest) {
                  setTimeout(() => {
                      alert("🎉 NHIỆM VỤ NGÀY: Bạn đã hoàn thành 3 bài nhảy.\n🎁 Thưởng: +500 Xu & Huy hiệu 'DANCER'!");
                  }, 1000);
              }
          }
      } catch (e) { console.error("Lỗi đồng bộ dữ liệu cuối game:", e); }
  };

  useEffect(() => {
    if (judgment) {
        const timer = setTimeout(() => setJudgment(null), 1000);
        return () => clearTimeout(timer);
    }
  }, [judgment]);

  return (
    <div className={`min-h-screen bg-gray-900 text-white font-sans overflow-hidden transition-all ${isShaking ? 'shake-animation' : ''}`}>
      
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translate(0, 0); }
          20% { transform: translate(-3px, 3px); }
          40% { transform: translate(3px, -3px); }
          60% { transform: translate(-3px, -3px); }
          80% { transform: translate(3px, 3px); }
        }
        .shake-animation { animation: shake 0.2s cubic-bezier(.36,.07,.19,.97) both; }
        .animate-spin-slow { animation: spin 8s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #4b5563; border-radius: 10px; }
      `}</style>

      {/* LOBBY */}
      {gameState === 'LOBBY' && (
        <div className="max-w-4xl mx-auto py-12 px-6 animate-in fade-in duration-500">
           <header className="flex justify-between items-center mb-10">
               <h1 className="text-4xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">AU PLANT G</h1>
               <div className="flex gap-4 items-center">
                   {/* NHIỆM VỤ NGÀY */}
                   <div className="bg-gray-800 border border-gray-700 rounded-full px-4 py-1.5 flex items-center gap-2">
                       <span className="text-xl">🏆</span>
                       <div>
                           <p className="text-[8px] font-black uppercase text-gray-400 leading-none">Nhiệm vụ ngày</p>
                           <p className={`text-xs font-bold ${userData.dailyPlays >= 3 ? 'text-green-400' : 'text-white'}`}>
                               {Math.min(userData.dailyPlays, 3)}/3 Bài
                           </p>
                       </div>
                   </div>
                   <button onClick={() => navigate('/')} className="bg-gray-800 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest border border-gray-700 hover:bg-gray-700">Trở về</button>
               </div>
           </header>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                   {MUSIC_TRACKS.map(track => {
                       // LOGIC KHÓA NHẠC VIP
                       const isLocked = track.requiredRank && userData.rankId !== track.requiredRank;

                       return (
                           <div 
                              key={track.id} 
                              onClick={() => !isLocked && selectTrack(track)} 
                              className={`relative bg-gray-800/50 p-4 rounded-2xl border flex items-center gap-4 transition-all group
                                  ${isLocked ? 'border-gray-700 opacity-60 cursor-not-allowed' : 'border-gray-700 cursor-pointer hover:border-purple-500 hover:bg-gray-800'}
                                  ${track.requiredRank === 'CHALLENGER' ? 'shadow-[0_0_15px_rgba(168,85,247,0.1)] border-purple-900/50' : ''}
                              `}
                           >
                               <img src={track.cover} className={`w-16 h-16 rounded-xl object-cover ${!isLocked && 'group-hover:rotate-6'} transition-transform`} alt="cover" />
                               <div className="flex-1">
                                   <h3 className="font-black text-lg leading-none flex items-center gap-2">
                                       {track.title} 
                                       {track.requiredRank === 'CHALLENGER' && <span className="text-xs bg-gradient-to-r from-purple-500 to-pink-500 px-2 rounded text-white">VIP</span>}
                                   </h3>
                                   <p className="text-gray-400 text-xs mt-1">{track.artist} • {track.genre}</p>
                                   <div className="flex gap-2 mt-2">
                                       <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${track.difficulty === 'Expert' ? 'bg-purple-600' : track.difficulty === 'Hard' ? 'bg-red-500' : 'bg-green-500'}`}>{track.difficulty}</span>
                                       <span className="text-[9px] font-black px-2 py-0.5 rounded bg-blue-500 uppercase">{track.bpm} BPM</span>
                                   </div>
                               </div>
                               
                               {isLocked ? (
                                   <div className="absolute inset-0 bg-black/60 rounded-2xl flex flex-col items-center justify-center backdrop-blur-[1px]">
                                       <span className="text-2xl mb-1">🔒</span>
                                       <span className="text-[10px] font-black uppercase text-purple-300 tracking-widest bg-black/50 px-2 py-1 rounded">Yêu cầu Rank: Thách Đấu</span>
                                   </div>
                               ) : (
                                   <div className="text-2xl opacity-0 group-hover:opacity-100 transition-opacity">▶️</div>
                               )}
                           </div>
                       );
                   })}
               </div>
               
               <div className="bg-gray-800/30 p-6 rounded-[2rem] border border-gray-700/50 backdrop-blur-sm">
                   <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">🏆 BẢNG VÀNG THẾ GIỚI</h2>
                   <div className="space-y-4">
                       {leaderboard.length > 0 ? leaderboard.map((item, i) => (
                           <div key={i} className={`flex justify-between items-center bg-black/20 p-3 rounded-xl border-l-4 ${i === 0 ? 'border-yellow-400 bg-yellow-900/20' : 'border-blue-500'}`}>
                               <div className="flex items-center gap-3">
                                   <span className={`font-black italic ${i === 0 ? 'text-yellow-400 text-lg' : 'text-gray-600'}`}>#{i+1}</span>
                                   <span className="font-bold text-sm">{item.name}</span>
                               </div>
                               <span className="font-mono font-black text-yellow-400 drop-shadow-md">{item.score.toLocaleString()}</span>
                           </div>
                       )) : <p className="text-center text-gray-600 italic py-10 text-sm">Hãy chọn 1 bản nhạc để xem cao thủ.</p>}
                   </div>
               </div>
           </div>
        </div>
      )}

      {/* LOADING SCREEN */}
      {gameState === 'LOADING' && (
          <div className="h-screen flex flex-col items-center justify-center bg-black">
              <div className="relative w-64 h-2 bg-gray-800 rounded-full overflow-hidden mb-4">
                  <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300" style={{ width: `${loadProgress}%` }}></div>
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-500 animate-pulse">Đang chuẩn bị sân khấu... {Math.floor(loadProgress)}%</p>
          </div>
      )}

      {/* PREPARING */}
      {gameState === 'PREPARING' && (
          <div className="h-screen flex flex-col items-center justify-center">
              <div className="text-[15rem] font-black italic text-transparent bg-clip-text bg-gradient-to-b from-purple-400 to-pink-600 animate-bounce drop-shadow-[0_0_30px_rgba(250,204,21,0.6)]">
                  {prepCountdown > 0 ? prepCountdown : 'GO!'}
              </div>
          </div>
      )}

      {/* PLAYING SCREEN */}
      {gameState === 'PLAYING' && (
          <div className="h-screen relative flex flex-col items-center justify-center p-6 w-full max-w-4xl mx-auto">
              <audio ref={audioRef} src={currentTrack?.src} onEnded={handleGameEnd} className="hidden" preload="auto" />
              
              {/* HP BAR */}
              <div className="absolute top-10 left-1/2 -translate-x-1/2 w-full max-w-md px-10">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">
                      <span>Năng lượng</span>
                      <span className={hp < 30 ? 'text-red-500 animate-pulse' : ''}>{Math.floor(hp)}%</span>
                  </div>
                  <div className="h-4 bg-gray-800 rounded-full border-2 border-gray-700 p-0.5 shadow-2xl">
                      <div className={`h-full rounded-full transition-all duration-300 ${hp < 30 ? 'bg-red-500' : 'bg-gradient-to-r from-green-500 to-blue-500'}`} style={{ width: `${hp}%` }}></div>
                  </div>
              </div>

              {/* SONG INFO */}
              <div className="absolute bottom-10 left-10 flex items-center gap-4 bg-black/40 backdrop-blur-md p-4 rounded-2xl border border-white/10 hidden md:flex">
                  <img src={currentTrack?.cover} className="w-12 h-12 rounded-lg animate-spin-slow" alt="art" />
                  <div>
                      <p className="text-xs font-black uppercase text-purple-400 tracking-tighter leading-none">{currentTrack?.title}</p>
                      <p className="text-[10px] text-gray-400 font-bold">{currentTrack?.artist}</p>
                  </div>
              </div>

              {/* JUDGMENT FLOATING TEXT */}
              {judgment && (
                  <div key={judgment.id} className="absolute top-1/3 z-50 animate-bounce pointer-events-none text-center">
                      <h2 className={`text-7xl font-black italic tracking-tighter drop-shadow-2xl ${
                          judgment.text === 'PERFECT' ? 'text-yellow-400' : 
                          judgment.text === 'GREAT' ? 'text-green-400' : 
                          judgment.text === 'COOL' ? 'text-blue-400' : 
                          judgment.text === 'BAD' ? 'text-gray-400' : 'text-red-500'
                      }`}>{judgment.text}</h2>
                      {combo > 1 && <p className="text-3xl font-black text-white italic tracking-tighter">COMBO x{combo}</p>}
                  </div>
              )}

              {/* GAMEBOARD */}
              <div className="w-full max-w-2xl bg-gray-800/40 backdrop-blur-xl rounded-[3rem] p-10 border border-white/5 shadow-2xl relative overflow-hidden mt-10">
                  <div className="flex justify-between items-end mb-10 px-4">
                      <div className="text-4xl font-black italic text-white opacity-20">LVL {level}</div>
                      <div className="text-right">
                          <p className="text-[10px] font-black text-gray-500 uppercase">Total Score</p>
                          <p className="text-5xl font-black text-yellow-400">{score.toLocaleString()}</p>
                      </div>
                  </div>

                  {/* HIỂN THỊ PHÍM BẤM (CÓ TÍCH HỢP SKIN VIP CHO THÁCH ĐẤU) */}
                  <div className={`flex flex-wrap justify-center gap-4 mb-12 transition-all ${isFailedSeq ? 'opacity-20 blur-sm scale-95' : ''}`}>
                      {targetSequence.map((item, i) => {
                          const isTyped = i < userInput.length;
                          const isChallenger = userData.rankId === 'CHALLENGER';
                          
                          // Skin Thường vs Skin Thách Đấu
                          let colorClass = item.isRed
                             ? (isChallenger ? 'text-pink-500 drop-shadow-[0_0_15px_rgba(236,72,153,0.8)]' : 'text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.6)]')
                             : (isChallenger ? 'text-yellow-300 drop-shadow-[0_0_15px_rgba(253,224,71,0.8)]' : 'text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,0.6)]');
                          
                          return (
                              <span key={i} className={`text-5xl sm:text-6xl transition-all duration-150 ${isTyped ? 'opacity-20 scale-75' : colorClass}`}>
                                  {ARROW_SYMBOLS[item.display]}
                              </span>
                          );
                      })}
                  </div>

                  {/* SLIDER BAR */}
                  <div className="relative h-16 bg-black/60 rounded-full border-4 border-gray-700 shadow-inner overflow-hidden">
                      <div className="absolute inset-y-0 left-[75%] right-[5%] bg-blue-500/20"></div>
                      <div className="absolute inset-y-0 left-[85%] w-2 bg-white shadow-[0_0_30px_#fff] z-10"></div>
                      
                      {burstEffect && (
                          <div className="absolute top-1/2 left-[85%] -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border-4 border-yellow-300 animate-ping z-0 pointer-events-none"></div>
                      )}

                      <div 
                        className={`absolute top-1/2 -translate-y-1/2 w-10 h-10 rounded-full border-4 border-white transition-transform z-20 
                            ${userData.rankId === 'CHALLENGER' ? 'bg-gradient-to-r from-purple-500 to-pink-500 shadow-[0_0_30px_rgba(236,72,153,0.8)]' : 'bg-yellow-400 shadow-[0_0_30px_#facc15]'}`}
                        style={{ left: `${sliderPos}%` }}
                      ></div>
                  </div>
              </div>
          </div>
      )}

      {/* GAME OVER */}
      {gameState === 'GAME_OVER' && (
          <div className="h-screen bg-black/90 flex flex-col items-center justify-center text-center p-6 animate-in zoom-in duration-500">
              <div className="text-9xl mb-8">💀</div>
              <h2 className="text-6xl font-black text-red-600 uppercase tracking-tighter mb-4 italic">Kạn Đã Kiệt Sức!</h2>
              <p className="text-gray-400 max-w-sm mb-10 font-bold uppercase tracking-widest">Đừng bỏ cuộc, hãy luyện tập thêm để giữ vững nhịp điệu của Vinhomes.</p>
              <button onClick={() => setGameState('LOBBY')} className="px-12 py-5 bg-white text-black font-black rounded-full uppercase tracking-widest hover:scale-105 active:scale-95 transition-all">Quay về Lobby</button>
          </div>
      )}

      {/* RESULT SCREEN */}
      {gameState === 'RESULT' && (
          <div className="h-screen flex items-center justify-center p-6 bg-gradient-to-br from-purple-900/50 to-gray-900 w-full">
              <div className="bg-gray-800/80 backdrop-blur-2xl p-12 rounded-[4rem] border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.5)] max-w-md w-full text-center">
                  <h2 className="text-5xl font-black italic text-white uppercase mb-8 leading-none tracking-tighter">Bản Nhạc <br/><span className="text-yellow-400">Hoàn Tất!</span></h2>
                  
                  <div className="grid grid-cols-2 gap-4 mb-10">
                      <div className="bg-black/30 p-4 rounded-3xl">
                          <p className="text-[10px] text-gray-500 font-black uppercase">Max Combo</p>
                          <p className="text-3xl font-black text-blue-400">{maxCombo}</p>
                      </div>
                      <div className="bg-black/30 p-4 rounded-3xl">
                          <p className="text-[10px] text-gray-500 font-black uppercase">Perfects</p>
                          <p className="text-3xl font-black text-green-400">{stats.perfect}</p>
                      </div>
                  </div>

                  <div className="mb-10">
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Tổng điểm đạt được</p>
                      <p className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-500 drop-shadow-2xl">{score.toLocaleString()}</p>
                  </div>

                  <button onClick={() => setGameState('LOBBY')} className="w-full py-5 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-black rounded-3xl uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 transition-all">Trở về Phòng chờ</button>
              </div>
          </div>
      )}
    </div>
  );
};

export default AuGame;