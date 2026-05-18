import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { getDatabase, ref as dbRef, set, onValue, update, remove, onDisconnect, push } from 'firebase/database';

import { db } from '../firebase/config';
import { getRankInfo } from '../utils/rankUtils';

import './AuStyles.css';
import AuSettings from './AuSettings';
import { ARROW_SYMBOLS, OPPOSITE_KEYS, useRollingScore, getDifficultyStars } from './utils/auHelpers';

const AuGame = () => {
  const navigate = useNavigate();
  const [gameState, setGameState] = useState('HOME'); 
  
  // ĐÃ THÊM: Dùng useRef để các Listener RTDB luôn lấy được gameState mới nhất
  const gameStateRef = useRef(gameState);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  const [isPaused, setIsPaused] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [userData, setUserData] = useState({ phone: '', name: '', rankId: '', bestScore: 0 });
  
  const [gameMode, setGameMode] = useState('SINGLE'); 
  const [lbTab, setLbTab] = useState('SINGLE'); 
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [waitingRooms, setWaitingRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  
  // ĐÃ THÊM: Sửa cấu trúc matchScores để lưu tổng điểm 2 Team
  const [matchScores, setMatchScores] = useState({ teamA: 0, teamB: 0 });
  
  const [leaderboard, setLeaderboard] = useState([]);
  const [musicList, setMusicList] = useState([]);
  const [isLoadingMusic, setIsLoadingMusic] = useState(true);

  const [volumes, setVolumes] = useState(() => {
      const saved = localStorage.getItem('auVolumes');
      return saved ? JSON.parse(saved) : { lobby: 0.5, track: 0.8, sfx: 0.8, judgment: 0.8, end: 0.8 };
  });
  const [showSettings, setShowSettings] = useState(false);

  const [hp, setHp] = useState(100);
  const [level, setLevel] = useState(4); 
  const [score, setScore] = useState(0);
  
  const displayScore = useRollingScore(score, 400); 
  const displayTeamA = useRollingScore(matchScores.teamA, 400);
  const displayTeamB = useRollingScore(matchScores.teamB, 400);

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

  const [isResting, setIsResting] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [loadProgress, setLoadMusicProgress] = useState(0);
  const [prepCountdown, setPrepCountdown] = useState(3);

  const audioRef = useRef(null);
  const requestRef = useRef();

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
  
  const serverTimeOffsetRef = useRef(0);

  // ĐÃ THÊM: Refs để hủy lắng nghe Firebase khi thoát phòng, tránh lỗi nhảy lung tung
  const roomListenerUnsub = useRef(null);
  const scoreListenerUnsub = useRef(null);

  const sfxRef = useRef(null);
  const lobbyAudioRef = useRef(null);
  const fadeIntervalRef = useRef(null);
  
  const rtdb = getDatabase();

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

    const offsetRef = dbRef(rtdb, '.info/serverTimeOffset');
    onValue(offsetRef, (snap) => {
        serverTimeOffsetRef.current = snap.val() || 0;
    });

    return () => {
        clearInterval(fadeIntervalRef.current);
        if (lobbyAudioRef.current) lobbyAudioRef.current.pause();
    };
  }, []);

  const handleVolumeChange = (key, value) => {
      const newVols = { ...volumes, [key]: parseFloat(value) };
      setVolumes(newVols);
      localStorage.setItem('auVolumes', JSON.stringify(newVols));
      
      if (key === 'lobby' && lobbyAudioRef.current && (gameState === 'LOBBY' || gameState === 'HOME' || gameState === 'ROOM_WAITING')) {
          lobbyAudioRef.current.volume = parseFloat(value);
      }
      if (key === 'track' && audioRef.current) {
          audioRef.current.volume = parseFloat(value);
      }
  };

  useEffect(() => {
      if (!lobbyAudioRef.current) return;
      if (gameState === 'LOBBY' || gameState === 'HOME' || gameState === 'ROOM_WAITING') {
          const targetVolume = volumes.lobby;
          if (lobbyAudioRef.current.paused) {
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
              lobbyAudioRef.current.volume = targetVolume;
          }
      } else {
          clearInterval(fadeIntervalRef.current);
          lobbyAudioRef.current.pause();
      }
  }, [gameState, volumes.lobby]);

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
              let pBest = 0;
              try {
                  const lbSnap = await getDoc(doc(db, 'au_global_leaderboard', phones[0]));
                  if (lbSnap.exists()) pBest = lbSnap.data().bestScore;
              } catch(e) {}

              if (userSnap.exists()) {
                  const data = userSnap.data();
                  const rankInfo = getRankInfo(data.totalSpend || 0, data.manualRankId);
                  const uData = { phone: phones[0], name: data.fullName || 'Người chơi', rankId: rankInfo.current.id, bestScore: pBest };
                  setUserData(uData);

                  const myPresenceRef = dbRef(rtdb, `presence/${phones[0]}`);
                  set(myPresenceRef, { name: uData.name, rank: uData.rankId, status: 'Online' });
                  onDisconnect(myPresenceRef).remove();
              }
          } else { navigate('/'); }
      } catch (error) { console.error("Lỗi lấy thông tin:", error); }
    };
    fetchUser();
    fetchGlobalLeaderboard(); 
    fetchMusicTracks(); 
  }, [navigate]);

  useEffect(() => {
      const presenceRef = dbRef(rtdb, 'presence');
      const unsubPresence = onValue(presenceRef, (snapshot) => {
          if(snapshot.exists()) {
              const data = snapshot.val();
              const users = Object.keys(data).map(key => ({ id: key, ...data[key] }));
              setOnlineUsers(users);
          } else setOnlineUsers([]);
      });

      const roomsRef = dbRef(rtdb, 'rooms');
      const unsubRooms = onValue(roomsRef, (snapshot) => {
          if(snapshot.exists()) {
              const data = snapshot.val();
              const rooms = Object.keys(data)
                  .map(key => ({ id: key, ...data[key] }))
                  .filter(r => r.status === 'waiting' && r.mode !== 'SINGLE');
              setWaitingRooms(rooms);
          } else setWaitingRooms([]);
      });

      return () => { unsubPresence(); unsubRooms(); };
  }, []);

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

  // --- LOGIC PHÒNG VÀ ĐỒNG BỘ MULTIPLAYER ĐÃ SỬA CHUẨN ---
  const handleSelectTrackAndCreateRoom = async (track) => {
      if (track.requiredRank && userData.rankId !== track.requiredRank) return;
      setCurrentTrack(track);

      if (gameMode === 'SINGLE') {
          startGameLoading(track);
      } else {
          const newRoomRef = push(dbRef(rtdb, 'rooms'));
          const roomDataInit = {
              hostId: userData.phone,
              trackId: track.id,
              trackTitle: track.title,
              mode: gameMode,
              status: 'waiting',
              players: {
                  [userData.phone]: { name: userData.name, score: 0, team: 'A' }
              }
          };
          await set(newRoomRef, roomDataInit);
          
          if (roomListenerUnsub.current) roomListenerUnsub.current();
          roomListenerUnsub.current = onValue(newRoomRef, (snap) => {
              if (snap.exists()) {
                  const data = snap.val();
                  setCurrentRoom({ id: newRoomRef.key, ...data });

                  if (data.status === 'playing' && data.startTimestamp && gameStateRef.current === 'ROOM_WAITING') {
                      startGameLoading(track, data.startTimestamp);
                  }

                  // ĐÃ THÊM: Nghe tín hiệu chết sớm (Ai hết HP trước thì phòng báo ended)
                  if (data.status === 'ended' && data.winnerTeam) {
                      if (gameStateRef.current === 'PLAYING') {
                          if (audioRef.current) audioRef.current.pause();
                          const myTeam = data.players[userData.phone]?.team;
                          if (myTeam === data.winnerTeam) {
                              playSFX('end', 'end'); 
                              setGameState('RESULT'); // Bạn là người sống sót -> Thắng
                          } else {
                              setGameState('GAME_OVER'); // Bạn đã chết -> Thua
                          }
                      }
                  }
              } else {
                  setCurrentRoom(null);
                  if (gameStateRef.current === 'ROOM_WAITING' || gameStateRef.current === 'PLAYING') {
                      alert("Phòng đã bị đóng!");
                      setGameState('LOBBY');
                      if (audioRef.current) audioRef.current.pause();
                  }
              }
          });
          
          setGameState('ROOM_WAITING');
      }
  };

  const handleJoinRoom = async (room) => {
      if (!userData.phone) return;
      
      // ĐÃ SỬA: Phân chia Team logic siêu chuẩn
      const players = Object.values(room.players || {});
      const teamACount = players.filter(p => p.team === 'A').length;
      let assignedTeam = 'A';
      if (room.mode === 'SOLO' && teamACount >= 1) assignedTeam = 'B';
      else if (room.mode === 'COUPLE' && teamACount >= 2) assignedTeam = 'B';
      
      const myPlayerRef = dbRef(rtdb, `rooms/${room.id}/players/${userData.phone}`);
      onDisconnect(myPlayerRef).remove();
      await set(myPlayerRef, { name: userData.name, score: 0, team: assignedTeam });
      
      const fullRoomSnap = await getDocs(query(collection(db, 'au_tracks')));
      const trackData = fullRoomSnap.docs.find(d => d.id === room.trackId)?.data();
      setCurrentTrack(trackData);
      setCurrentRoom(room);
      setGameState('ROOM_WAITING');

      const roomRef = dbRef(rtdb, `rooms/${room.id}`);
      if (roomListenerUnsub.current) roomListenerUnsub.current();
      roomListenerUnsub.current = onValue(roomRef, (snap) => {
          if (snap.exists()) {
              const data = snap.val();
              setCurrentRoom({ id: room.id, ...data });
              
              if (data.status === 'playing' && data.startTimestamp && gameStateRef.current === 'ROOM_WAITING') {
                  startGameLoading(trackData, data.startTimestamp);
              }

              if (data.status === 'ended' && data.winnerTeam) {
                  if (gameStateRef.current === 'PLAYING') {
                      if (audioRef.current) audioRef.current.pause();
                      const myTeam = data.players[userData.phone]?.team;
                      if (myTeam === data.winnerTeam) {
                          playSFX('end', 'end'); 
                          setGameState('RESULT');
                      } else {
                          setGameState('GAME_OVER');
                      }
                  }
              }
          } else {
              setCurrentRoom(null);
              if (gameStateRef.current === 'ROOM_WAITING' || gameStateRef.current === 'PLAYING') {
                  alert("Phòng đã bị đóng!");
                  setGameState('LOBBY');
                  if (audioRef.current) audioRef.current.pause();
              }
          }
      });
  };

  const handleHostStartGame = async () => {
      if (currentRoom && currentRoom.hostId === userData.phone) {
          const exactServerTime = Date.now() + serverTimeOffsetRef.current;
          const startTime = exactServerTime + 3000; 

          await update(dbRef(rtdb, `rooms/${currentRoom.id}`), { 
              status: 'playing',
              startTimestamp: startTime
          });
          
          startGameLoading(currentTrack, startTime);
      }
  };

  const startGameLoading = async (track, targetStartTime = 0) => {
    setGameState('LOADING');
    setLoadMusicProgress(0);
    
    let loadedBeatmap = null;
    try {
        const response = await fetch(`/music/beatmap/${track.id}.json`);
        if (response.ok) { loadedBeatmap = await response.json(); }
    } catch (e) {}

    setCurrentTrack({ ...track, beatmap: loadedBeatmap || track.beatmap });

    let delay = 500;
    if (targetStartTime > 0) {
        const exactServerTime = Date.now() + serverTimeOffsetRef.current;
        delay = Math.max(0, targetStartTime - exactServerTime);
    }

    setLoadMusicProgress(100);
    
    setTimeout(() => {
        setGameState('PREPARING'); 
        setPrepCountdown(3); setHp(100); setScore(0); setCombo(0); setMeasureIndex(0); setMusicProgress(0);
        setMatchScores({ teamA: 0, teamB: 0 });
        prevLevelRangeRef.current = null; setIsResting(false);

        if (gameMode !== 'SINGLE' && currentRoom) {
            const myTeam = currentRoom.players[userData.phone]?.team || 'A';
            set(dbRef(rtdb, `live_scores/${currentRoom.id}/${userData.phone}`), { name: userData.name, score: 0, team: myTeam });
            
            // ĐÃ THÊM: Listener gộp tổng điểm 2 team
            if (scoreListenerUnsub.current) scoreListenerUnsub.current();
            const scoresRef = dbRef(rtdb, `live_scores/${currentRoom.id}`);
            scoreListenerUnsub.current = onValue(scoresRef, (snap) => {
                if (snap.exists()) {
                    const sData = snap.val();
                    let tA = 0, tB = 0;
                    Object.values(sData).forEach(p => {
                        if (p.team === 'A') tA += p.score;
                        if (p.team === 'B') tB += p.score;
                    });
                    setMatchScores({ teamA: tA, teamB: tB });
                }
            });
        }
    }, delay);
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
        setIsResting(false); 
    }

    if (currentRange > 1 && currentRange !== prevLevelRangeRef.current) {
        playSFX(`level${currentRange}`, 'sfx');
    } else if (currentRange === 0 && hasStartedNotesRef.current && prevLevelRangeRef.current !== 0) {
        const restSFX = ['rest1', 'rest2', 'rest3', 'rest4'];
        const available = restSFX.filter(r => r !== lastRestMusicRef.current);
        const randomSFX = available[Math.floor(Math.random() * available.length)];
        
        playSFX(randomSFX, 'sfx');
        lastRestMusicRef.current = randomSFX; 
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

  // --- ĐÃ SỬA: CƠ CHẾ HP CHO SOLO VÀ CẶP ---
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
    } else { 
        playSFX('fail', 'judgment');
        perfectComboRef.current = 0; 
        scoreAdd = 0; 
        hpAdd = -25; 
        setCombo(0); 
    }

    setScore(prevScore => {
        const newScore = prevScore + scoreAdd;
        if (gameMode !== 'SINGLE' && currentRoom && userData.phone) {
            const myT = currentRoom.players[userData.phone]?.team || 'A';
            update(dbRef(rtdb, `live_scores/${currentRoom.id}/${userData.phone}`), { name: userData.name, score: newScore, team: myT });
        }
        return newScore;
    });
    
    setHp(prev => {
        let newHp = Math.max(0, Math.min(100, prev + hpAdd));
        
        // ĐÃ THÊM: Logic loại trực tiếp nếu hết HP ở Solo/Đơn. Couple thì vẫn nhảy bình thường.
        if (newHp <= 0 && gameMode !== 'COUPLE') { 
            if (audioRef.current) audioRef.current.pause();
            
            if (gameMode === 'SOLO' && currentRoom) {
                const myTeam = currentRoom.players[userData.phone]?.team;
                const enemyTeam = myTeam === 'A' ? 'B' : 'A';
                update(dbRef(rtdb, `rooms/${currentRoom.id}`), { status: 'ended', winnerTeam: enemyTeam });
            }
            setGameState('GAME_OVER'); 
        }
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

  const togglePause = () => setIsPaused(prev => !prev);

  // ĐÃ SỬA: Clean up dứt điểm listener khi Thoát phòng
  const handleLeaveGame = async () => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
      
      if (roomListenerUnsub.current) { roomListenerUnsub.current(); roomListenerUnsub.current = null; }
      if (scoreListenerUnsub.current) { scoreListenerUnsub.current(); scoreListenerUnsub.current = null; }

      if (currentRoom) {
          if (currentRoom.hostId === userData.phone) {
              await remove(dbRef(rtdb, `rooms/${currentRoom.id}`));
              await remove(dbRef(rtdb, `live_scores/${currentRoom.id}`));
          } else {
              await remove(dbRef(rtdb, `rooms/${currentRoom.id}/players/${userData.phone}`));
              await remove(dbRef(rtdb, `live_scores/${currentRoom.id}/${userData.phone}`));
          }
          setCurrentRoom(null);
      }
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
        
        const pressedKey = { ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT' }[e.key];
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
      playSFX('end', 'end'); 
      
      if (currentRoom && currentRoom.hostId === userData.phone) {
          remove(dbRef(rtdb, `rooms/${currentRoom.id}`)); 
      }
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

  const getDifficultyStars = (diff) => {
      switch(diff) {
          case 'Easy': return 2;
          case 'Normal': return 4;
          case 'Hard': return 6;
          case 'Expert': return 8;
          default: return 4;
      }
  };

  // Logic xác định thắng thua và điểm số lúc kết thúc
  let resultMessage = "STAGE CLEARED";
  let isVictory = true;
  if (gameState === 'RESULT' && gameMode !== 'SINGLE' && currentRoom) {
      const myT = currentRoom.players[userData.phone]?.team || 'A';
      const myS = myT === 'A' ? matchScores.teamA : matchScores.teamB;
      const enS = myT === 'A' ? matchScores.teamB : matchScores.teamA;
      if (myS >= enS) {
          resultMessage = "VICTORY!";
          isVictory = true;
      } else {
          resultMessage = "DEFEAT!";
          isVictory = false;
      }
  }

  return (
    <div className={`min-h-screen bg-[url('https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1920&auto=format&fit=crop')] bg-cover bg-center text-white font-sans overflow-hidden relative transition-all ${isShaking ? 'modern-impact' : ''}`}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"></div>

      {showSettings && (
          <AuSettings volumes={volumes} handleVolumeChange={handleVolumeChange} setShowSettings={setShowSettings} />
      )}

      {/* --- MÀN HÌNH SẢNH CHÍNH (HOME) --- */}
      {gameState === 'HOME' && (
          <div className="relative z-10 h-screen flex flex-col p-6 animate-in fade-in duration-500 max-w-[1400px] mx-auto">
             <header className="flex justify-between items-center mb-8 shrink-0">
                 <h1 className="text-4xl sm:text-5xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 drop-shadow-[0_0_30px_rgba(34,211,238,0.5)]">AU PLANT G</h1>
                 <div className="flex gap-4">
                     <button onClick={() => setShowSettings(true)} className="bg-white/5 hover:bg-white/10 px-6 py-2 rounded-2xl text-sm font-black transition-all border border-white/10 shadow-[0_0_15px_rgba(34,211,238,0.1)] flex items-center gap-2">⚙️ CÀI ĐẶT</button>
                     <button onClick={() => navigate('/')} className="bg-white/5 hover:bg-red-500/20 px-6 py-2 rounded-2xl text-xs font-black uppercase tracking-widest border border-white/10 transition-all hover:text-red-400 hover:border-red-500/50">Thoát</button>
                 </div>
             </header>

             <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-8 min-h-0">
                 <div className="glass-card p-6 rounded-[2rem] flex flex-col overflow-hidden h-full hidden lg:flex">
                     <h2 className="text-[10px] font-black text-green-400 uppercase tracking-[0.4em] mb-6 flex items-center gap-2">🟢 Đang Online ({onlineUsers.length})</h2>
                     <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                         {onlineUsers.map(user => (
                             <div key={user.id} className="flex items-center gap-3 p-3 bg-black/40 rounded-xl border border-white/5">
                                 <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-400 to-purple-500 flex items-center justify-center text-xs">👤</div>
                                 <div className="flex-1 overflow-hidden">
                                     <p className="text-sm font-bold truncate">{user.name}</p>
                                     <p className="text-[9px] text-white/40 uppercase">{user.rank}</p>
                                 </div>
                             </div>
                         ))}
                     </div>
                 </div>

                 <div className="lg:col-span-2 flex flex-col items-center justify-center">
                     <div className="glass-card p-10 rounded-[3rem] w-full max-w-md flex flex-col items-center text-center shadow-[0_0_50px_rgba(0,0,0,0.5)] mb-8 transform hover:scale-[1.02] transition-transform">
                         <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-cyan-400 to-purple-500 mb-4 flex items-center justify-center shadow-[0_0_20px_cyan]">
                             <span className="text-4xl">👑</span>
                         </div>
                         <h2 className="text-3xl font-black text-white mb-2">{userData.name}</h2>
                         <div className="px-4 py-1 bg-white/10 rounded-full border border-white/20 mb-8">
                             <span className="text-xs font-black tracking-widest text-cyan-400 uppercase">{userData.rankId || 'NEWBIE'}</span>
                         </div>

                         <div className="w-full bg-black/40 rounded-2xl p-4 border border-white/5 mb-8">
                             <p className="text-[10px] text-white/50 font-black uppercase tracking-[0.3em] mb-1">Kỷ lục Cá nhân</p>
                             <p className="text-4xl font-black text-yellow-400 tracking-tighter drop-shadow-[0_0_10px_yellow]">
                                 {userData.bestScore?.toLocaleString() || 0}
                             </p>
                         </div>

                         <button onClick={() => setGameState('LOBBY')} className="w-full py-5 bg-gradient-to-r from-cyan-500 to-blue-500 text-black font-black rounded-full uppercase tracking-[0.2em] hover:brightness-125 active:scale-95 transition-all shadow-[0_0_30px_rgba(34,211,238,0.4)]">Vào Sảnh Chờ</button>
                     </div>
                 </div>

                 <div className="glass-card p-6 rounded-[2rem] flex flex-col overflow-hidden h-full">
                     <h2 className="text-[10px] font-black text-yellow-400 uppercase tracking-[0.4em] mb-4 flex items-center gap-2">🏆 TOP THẦN NHẢY</h2>
                     
                     <div className="flex gap-2 mb-6 bg-black/40 p-1 rounded-xl">
                         {['SINGLE', 'SOLO', 'COUPLE'].map(tab => (
                             <button key={tab} onClick={() => setLbTab(tab)} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${lbTab === tab ? 'bg-white/20 text-white shadow-lg' : 'text-white/40 hover:text-white/70'}`}>
                                 {tab === 'SINGLE' ? 'Đơn' : tab === 'SOLO' ? 'Solo' : 'Cặp'}
                             </button>
                         ))}
                     </div>

                     <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                         {leaderboard.map((item, i) => (
                             <div key={i} className={`flex justify-between items-center bg-black/40 p-3 rounded-xl border-l-4 ${i === 0 ? 'border-yellow-400' : 'border-white/10'}`}>
                                 <div className="flex items-center gap-3 overflow-hidden">
                                     <span className={`font-black italic text-sm ${i === 0 ? 'text-yellow-400' : 'text-white/30'}`}>{i+1}</span>
                                     <span className="font-bold text-xs truncate">{item.name}</span>
                                 </div>
                                 <span className="font-mono font-black text-cyan-300 text-xs shrink-0">{item.bestScore?.toLocaleString()}</span>
                             </div>
                         ))}
                     </div>
                 </div>
             </div>
          </div>
      )}

      {/* --- MÀN HÌNH CHỌN NHẠC (LOBBY) --- */}
      {gameState === 'LOBBY' && (
        <div className="relative z-10 max-w-[1400px] mx-auto py-12 px-6 animate-in fade-in duration-500 h-screen flex flex-col">
           <header className="flex justify-between items-center mb-8 shrink-0">
               <div>
                   <h1 className="text-4xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">SẢNH CHỜ</h1>
                   <p className="text-xs text-white/50 uppercase tracking-widest mt-1">Chọn chế độ và bài hát để bắt đầu</p>
               </div>
               <button onClick={() => setGameState('HOME')} className="bg-white/5 hover:bg-white/10 px-6 py-2 rounded-2xl text-xs font-black uppercase tracking-widest border border-white/10 transition-all">Quay lại</button>
           </header>
           
           <div className="flex gap-4 mb-8 shrink-0">
               {['SINGLE', 'SOLO', 'COUPLE'].map(mode => (
                   <button key={mode} onClick={() => setGameMode(mode)} 
                       className={`px-8 py-4 rounded-[1.5rem] font-black uppercase tracking-widest transition-all border 
                       ${gameMode === mode ? 'bg-cyan-500/20 border-cyan-400 text-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.2)]' : 'bg-black/40 border-white/10 text-white/40 hover:bg-white/5'}`}>
                       {mode === 'SINGLE' ? '👤 Nhảy Đơn' : mode === 'SOLO' ? '⚔️ Đấu Solo' : '🤝 Đấu Cặp'}
                   </button>
               ))}
           </div>

           <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 min-h-0">
               <div className="lg:col-span-2 glass-card p-6 rounded-[2.5rem] flex flex-col overflow-hidden h-full">
                   <h2 className="text-xs font-black text-white/50 uppercase tracking-[0.3em] mb-6 border-b border-white/10 pb-4">🎵 Danh sách Nhạc</h2>
                   <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar space-y-4">
                       {isLoadingMusic ? (
                           <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div></div>
                       ) : (
                           musicList.map(track => {
                               const isLocked = track.requiredRank && userData.rankId !== track.requiredRank;
                               return (
                                   <div key={track.id} onClick={() => !isLocked && handleSelectTrackAndCreateRoom(track)} 
                                        className={`group bg-black/40 p-4 rounded-3xl flex items-center gap-5 transition-all border border-white/5
                                        ${isLocked ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer hover:bg-white/10 hover:border-cyan-500/50 hover:shadow-[0_10px_20px_rgba(0,0,0,0.3)]'}`}>
                                       <img src={track.cover} className="w-16 h-16 rounded-2xl object-cover shadow-lg group-hover:scale-105 transition-transform" alt="cover" />
                                       <div className="flex-1">
                                           <h3 className="font-black text-lg tracking-tight mb-1">{track.title} {track.requiredRank && '👑'}</h3>
                                           <p className="text-cyan-400 text-[10px] font-bold uppercase tracking-widest">{track.artist} • {track.bpm} BPM</p>
                                       </div>
                                       <div className={`px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-tighter ${track.difficulty === 'Expert' ? 'bg-purple-500/30 text-purple-300' : 'bg-white/10 text-white/50'}`}>{track.difficulty}</div>
                                   </div>
                               );
                           })
                       )}
                   </div>
               </div>

               <div className="glass-card p-6 rounded-[2.5rem] flex flex-col overflow-hidden h-full">
                   <h2 className="text-xs font-black text-white/50 uppercase tracking-[0.3em] mb-6 border-b border-white/10 pb-4">⚔️ Phòng Chờ {gameMode !== 'SINGLE' ? `(${gameMode})` : ''}</h2>
                   <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2">
                       {gameMode === 'SINGLE' ? (
                           <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                               <span className="text-4xl mb-4">👤</span>
                               <p className="text-xs font-bold uppercase tracking-widest">Chế độ Đấu Đơn</p>
                               <p className="text-[10px] mt-2">Chọn nhạc bên trái để nhảy ngay</p>
                           </div>
                       ) : waitingRooms.filter(r => r.mode === gameMode).length === 0 ? (
                           <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                               <span className="text-4xl mb-4">🔍</span>
                               <p className="text-xs font-bold uppercase tracking-widest">Chưa có phòng nào</p>
                               <p className="text-[10px] mt-2">Chọn nhạc để tạo phòng mới</p>
                           </div>
                       ) : (
                           waitingRooms.filter(r => r.mode === gameMode).map(room => (
                               <div key={room.id} className="bg-black/60 p-4 rounded-2xl border border-white/10">
                                   <div className="flex justify-between items-center mb-3">
                                       <span className="text-xs font-black text-cyan-400">ROOM: {room.id.slice(-4)}</span>
                                       <span className="text-[9px] uppercase bg-white/10 px-2 py-1 rounded-md">{Object.keys(room.players || {}).length} / {room.mode==='SOLO' ? 2 : 4} Người</span>
                                   </div>
                                   <p className="text-sm font-bold truncate mb-4">{room.trackTitle}</p>
                                   <button onClick={() => handleJoinRoom(room)} className="w-full py-2 bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 hover:bg-cyan-500 hover:text-black font-black text-xs uppercase tracking-widest rounded-xl transition-all">Tham Gia</button>
                               </div>
                           ))
                       )}
                   </div>
               </div>
           </div>
        </div>
      )}

      {/* --- MÀN HÌNH ĐỢI TRONG PHÒNG MULTIPLAYER --- */}
      {gameState === 'ROOM_WAITING' && currentRoom && (
          <div className="h-screen flex items-center justify-center relative z-10 p-6 animate-in zoom-in duration-300">
              <div className="glass-card p-12 rounded-[4rem] w-full max-w-2xl text-center shadow-2xl">
                  <h2 className="text-4xl font-black italic text-cyan-400 uppercase tracking-tighter mb-2">ĐANG CHỜ NGƯỜI CHƠI</h2>
                  <p className="text-sm text-white/50 mb-10">{currentTrack?.title}</p>
                  
                  <div className="grid grid-cols-2 gap-8 mb-12">
                      <div className="bg-black/40 p-6 rounded-3xl border border-white/10 min-h-[150px]">
                          <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-4">TEAM A</h3>
                          {Object.values(currentRoom.players || {}).filter(p => p.team === 'A').map((p, i) => <p key={i} className="font-bold mb-2 text-white">{p.name}</p>)}
                      </div>
                      {currentRoom.mode === 'COUPLE' || currentRoom.mode === 'SOLO' ? (
                          <div className="bg-black/40 p-6 rounded-3xl border border-white/10 min-h-[150px]">
                              <h3 className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-4">TEAM B</h3>
                              {Object.values(currentRoom.players || {}).filter(p => p.team === 'B').map((p, i) => <p key={i} className="font-bold mb-2 text-white">{p.name}</p>)}
                          </div>
                      ) : null}
                  </div>

                  {currentRoom.hostId === userData.phone ? (
                      <button onClick={handleHostStartGame} className="w-full py-5 bg-cyan-500 text-black font-black rounded-full uppercase tracking-widest hover:scale-105 transition-all shadow-[0_0_20px_cyan]">Bắt Đầu Ngay</button>
                  ) : (
                      <p className="text-sm font-bold text-yellow-400 animate-pulse">Chờ chủ phòng bắt đầu...</p>
                  )}
                  
                  <button onClick={handleLeaveGame} className="mt-6 text-xs text-white/40 hover:text-white uppercase tracking-widest font-bold">Rời Phòng</button>
              </div>
          </div>
      )}

      {/* MÀN HÌNH CHƠI CHÍNH SLEEK UI */}
      {gameState === 'PLAYING' && (
          <div className="h-screen relative z-10 w-full overflow-hidden">
              <div className={`edge-progress ${isResting ? 'edge-rest-wave' : ''}`} style={{ '--music-progress': `${musicProgress}%` }}></div>
              <audio ref={audioRef} src={currentTrack?.src} onEnded={handleGameEnd} onTimeUpdate={handleTimeUpdate} className="hidden" />
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

              {/* ĐÃ SỬA: Ẩn thanh HP nếu đang chơi Đấu Cặp (COUPLE) */}
              {gameMode !== 'COUPLE' && (
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
              )}

              {/* --- ĐÃ SỬA: ĐIỂM SỐ TÙY THEO MODE (TEAM ĐỎ / XANH HOẶC CÁ NHÂN) --- */}
              <div className="absolute left-8 top-1/2 -translate-y-1/2 flex flex-col w-64 sm:w-80 lg:w-96 gap-6">
                  {gameMode === 'SINGLE' ? (
                      <div className="drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)] w-full">
                          <p className="text-sm font-black italic text-cyan-400 uppercase tracking-[0.5em] mb-[-5px]">MY SCORE</p>
                          <p className="text-5xl sm:text-6xl lg:text-7xl font-black italic text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400 tracking-tighter break-words leading-none py-2 transition-all">
                              {displayScore.toLocaleString()}
                          </p>
                      </div>
                  ) : gameMode === 'SOLO' ? (
                      <>
                          <div className="drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)] w-full">
                              <p className="text-sm font-black italic text-cyan-400 uppercase tracking-[0.5em] mb-[-5px]">MY SCORE</p>
                              <p className="text-5xl sm:text-6xl lg:text-7xl font-black italic text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 to-blue-500 tracking-tighter break-words leading-none py-2 transition-all">
                                  {displayScore.toLocaleString()}
                              </p>
                          </div>
                          <div className="drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)] w-full opacity-90 mt-4 border-l-4 border-red-500 pl-4 bg-black/40 rounded-r-2xl py-2">
                              <p className="text-xs font-black italic text-red-400 uppercase tracking-[0.5em] mb-[-2px]">ENEMY</p>
                              <p className="text-3xl sm:text-4xl font-black italic text-transparent bg-clip-text bg-gradient-to-b from-red-300 to-red-600 tracking-tighter break-words leading-none py-2 transition-all">
                                  {/* Hiển thị điểm đội kia (đối thủ) */}
                                  {(currentRoom?.players[userData.phone]?.team === 'A' ? displayTeamB : displayTeamA).toLocaleString()}
                              </p>
                          </div>
                      </>
                  ) : (
                      <>
                          <div className="drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)] w-full border-l-4 border-cyan-500 pl-4 bg-cyan-500/10 rounded-r-2xl py-2">
                              <p className="text-xs font-black italic text-cyan-400 uppercase tracking-[0.5em] mb-[-2px]">TEAM XANH (BẠN)</p>
                              <p className="text-4xl sm:text-5xl font-black italic text-cyan-100 tracking-tighter break-words leading-none py-2 transition-all">
                                  {(currentRoom?.players[userData.phone]?.team === 'A' ? displayTeamA : displayTeamB).toLocaleString()}
                              </p>
                          </div>
                          <div className="drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)] w-full opacity-90 mt-4 border-l-4 border-red-500 pl-4 bg-red-500/10 rounded-r-2xl py-2">
                              <p className="text-xs font-black italic text-red-400 uppercase tracking-[0.5em] mb-[-2px]">TEAM ĐỎ (ĐỐI THỦ)</p>
                              <p className="text-4xl sm:text-5xl font-black italic text-red-100 tracking-tighter break-words leading-none py-2 transition-all">
                                  {(currentRoom?.players[userData.phone]?.team === 'A' ? displayTeamB : displayTeamA).toLocaleString()}
                              </p>
                          </div>
                      </>
                  )}
              </div>

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

              <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-full max-w-3xl flex flex-col items-center px-4">
                  <div className="flex items-center gap-4 w-full px-4">
                      <span className="font-black italic text-cyan-400 text-xl tracking-wider drop-shadow-[0_0_10px_cyan]">LV {Math.floor(level)}</span>
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

                  <div className="mt-8 flex flex-col items-center">
                      <div className="flex items-center gap-4 bg-black/60 backdrop-blur-xl pl-3 pr-8 py-3 rounded-full shadow-2xl relative overflow-hidden">
                          <div className="absolute bottom-0 left-0 h-1 bg-cyan-400/80 transition-all duration-300" style={{ width: `${musicProgress}%` }}></div>
                          <img src={currentTrack?.cover} className={`w-14 h-14 rounded-full object-cover border border-white/20 z-10 album-rotate ${isPaused ? 'album-rotate-paused' : ''}`} alt="cover" />
                          <div className="flex flex-col z-10">
                              <span className="font-black text-sm text-white tracking-tight leading-none mb-1">{currentTrack?.title}</span>
                              <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest leading-none">{currentTrack?.artist}</span>
                          </div>
                      </div>
                  </div>
              </div>

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

      {/* CÁC MÀN HÌNH PHỤ TRỢ KHÁC */}
      {gameState === 'PREPARING' && (
          <div className="h-screen flex items-center justify-center relative z-10">
              <div className="text-[12rem] sm:text-[15rem] leading-none font-black italic text-white drop-shadow-[0_0_50px_cyan] animate-bounce text-center select-none uppercase">
                  {prepCountdown > 0 ? prepCountdown : 'READY GO!'}
              </div>
          </div>
      )}
      
      {/* ĐÃ SỬA: MÀN HÌNH KẾT QUẢ CHO CÁC MODE */}
      {gameState === 'RESULT' && (
          <div className="h-screen flex items-center justify-center p-6 w-full relative z-10">
              <div className="bg-black/60 backdrop-blur-2xl p-16 rounded-[4rem] border border-white/10 shadow-[0_0_100px_rgba(34,211,238,0.2)] max-w-xl w-full text-center animate-in zoom-in duration-500">
                  <h2 className={`text-6xl font-black italic uppercase mb-12 tracking-tighter ${isVictory ? 'text-yellow-400 drop-shadow-[0_0_20px_yellow]' : 'text-red-500 drop-shadow-[0_0_20px_red]'}`}>
                      {resultMessage}
                  </h2>
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
                      <p className="text-xs text-white/50 font-black uppercase tracking-[0.5em] mb-4">
                          {gameMode === 'SINGLE' ? 'Final Score' : (isVictory ? 'Team Score' : 'Điểm của bạn')}
                      </p>
                      <p className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-cyan-400 drop-shadow-2xl tracking-tighter">
                          {gameMode === 'SINGLE' ? score.toLocaleString() : (currentRoom?.players[userData.phone]?.team === 'A' ? matchScores.teamA : matchScores.teamB).toLocaleString()}
                      </p>
                  </div>
                  <button onClick={handleLeaveGame} 
                          className="w-full py-6 bg-cyan-600 text-black font-black rounded-[2rem] uppercase tracking-[0.3em] shadow-[0_0_20px_cyan] hover:scale-105 transition-all">Trở về sảnh</button>
              </div>
          </div>
      )}

      {gameState === 'LOADING' && (
          <div className="h-screen flex flex-col items-center justify-center bg-black relative z-10">
              <div className="w-64 h-1 bg-white/5 rounded-full overflow-hidden mb-6">
                  <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300" style={{ width: `${loadProgress}%` }}></div>
              </div>
              <p className="text-[10px] font-black uppercase text-white/40 tracking-[0.5em] animate-pulse">Entering Stage... {Math.floor(loadProgress)}%</p>
          </div>
      )}

      {gameState === 'GAME_OVER' && (
          <div className="h-screen flex flex-col items-center justify-center text-center p-6 relative z-10 bg-black/80 backdrop-blur-md">
              <h2 className="text-[10rem] font-black text-red-600 uppercase tracking-tighter mb-4 italic drop-shadow-[0_0_50px_red]">FAILED</h2>
              <p className="text-xl font-bold text-gray-400 mb-12 uppercase tracking-[0.5em]">Đáng tiếc, bạn đã hết năng lượng!</p>
              <button onClick={handleLeaveGame} className="px-16 py-6 bg-white text-black font-black rounded-full uppercase tracking-[0.2em] hover:scale-105 transition-all">Thoát</button>
          </div>
      )}

    </div>
  );
};

export default AuGame;