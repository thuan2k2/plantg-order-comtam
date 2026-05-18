// src/Au/utils/auHelpers.js
import { useState, useEffect } from 'react';

// ĐÃ THÊM: Các hàm từ Firebase Realtime Database
import { ref, set, update, push, remove } from 'firebase/database';
// Import rtdb từ file config của bạn (cần đảm bảo đã export rtdb trong file config)
import { rtdb } from '../../firebase/config';

export const ARROW_SYMBOLS = { UP: '⬆️', DOWN: '⬇️', LEFT: '⬅️', RIGHT: '➡️' };
export const OPPOSITE_KEYS = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' };

// Custom Hook cuộn điểm (Rolling Score)
export function useRollingScore(value, duration = 300) {
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

// Logic chuyển đổi Sao độ khó
export const getDifficultyStars = (diff) => {
    switch(diff) {
        case 'Easy': return 2;
        case 'Normal': return 4;
        case 'Hard': return 6;
        case 'Expert': return 8;
        default: return 4;
    }
};

/* =========================================================================
   --- ĐÃ THÊM: CÁC HÀM HỖ TRỢ MULTIPLAYER (REALTIME DATABASE) ---
   ========================================================================= */

// 1. Quản lý trạng thái Online (Presence) của người chơi tại Trang Chủ Au
export const updatePlayerPresence = (uid, name, status = 'ONLINE') => {
    if (!uid || !rtdb) return;
    const presenceRef = ref(rtdb, `presence/${uid}`);
    set(presenceRef, { 
        name, 
        status, // 'ONLINE', 'WAITING', 'PLAYING'
        updatedAt: Date.now() 
    });
};

// 2. Tạo phòng chờ mới
export const createRoom = async (hostInfo, mode, track = null) => {
    if (!rtdb) return null;
    const roomRef = push(ref(rtdb, 'rooms'));
    const roomId = roomRef.key;
    
    await set(roomRef, {
        roomId,
        host: hostInfo.uid,
        mode, // 'SINGLE', 'SOLO', 'COUPLE'
        status: 'WAITING',
        track,
        players: {
            [hostInfo.uid]: {
                name: hostInfo.name,
                team: mode === 'COUPLE' ? 1 : 0, // Đấu cặp thì host ở team 1
                isReady: true
            }
        },
        createdAt: Date.now()
    });
    
    return roomId;
};

// 3. Tham gia vào phòng chờ có sẵn
export const joinRoom = async (roomId, userInfo, mode) => {
    if (!rtdb || !roomId) return false;
    
    // Logic gán team nếu đấu cặp (team 1 hoặc 2)
    const teamAssigned = mode === 'COUPLE' ? (userInfo.team || 2) : 0; 

    const playerRef = ref(rtdb, `rooms/${roomId}/players/${userInfo.uid}`);
    await update(playerRef, {
        name: userInfo.name,
        team: teamAssigned,
        isReady: false
    });
    return true;
};

// 4. Rời khỏi phòng
export const leaveRoom = async (roomId, uid) => {
    if (!rtdb || !roomId || !uid) return;
    const playerRef = ref(rtdb, `rooms/${roomId}/players/${uid}`);
    await remove(playerRef);
};

// 5. Đồng bộ tín hiệu Bắt đầu Game cho toàn phòng
export const syncStartGame = async (roomId) => {
    if (!rtdb || !roomId) return;
    const statusRef = ref(rtdb, `rooms/${roomId}`);
    await update(statusRef, { 
        status: 'PLAYING', 
        startedAt: Date.now() 
    });
};

// 6. Đẩy điểm số Realtime khi đang nhảy
export const updateLiveScore = (roomId, uid, score, combo, judgment) => {
    if (!rtdb || !roomId || !uid) return;
    const scoreRef = ref(rtdb, `live_scores/${roomId}/${uid}`);
    set(scoreRef, { 
        score, 
        combo, 
        judgment: judgment || '',
        updatedAt: Date.now() 
    });
};

// 7. Tính tổng điểm đồng đội (Dành riêng cho COUPLE Mode)
export const calculateTeamScores = (liveScores, roomPlayers) => {
    if (!liveScores || !roomPlayers) return { team1: 0, team2: 0 };
    
    let team1 = 0;
    let team2 = 0;
    
    Object.keys(liveScores).forEach(uid => {
        const playerTeam = roomPlayers[uid]?.team;
        const playerScore = liveScores[uid]?.score || 0;
        
        if (playerTeam === 1) team1 += playerScore;
        else if (playerTeam === 2) team2 += playerScore;
    });
    
    return { team1, team2 };
};