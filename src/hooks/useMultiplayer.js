import { useState, useEffect, useCallback } from 'react';
import { ref, set, onValue, update, remove, onDisconnect, get, push } from 'firebase/database';
// Import RTDB từ config. Nếu trong config của bạn khai báo là 'database' thì đổi lại cho khớp nhé.
import { rtdb } from '../firebase/config'; 

export const useMultiplayer = (userData) => {
    const [onlinePlayers, setOnlinePlayers] = useState([]);
    const [availableRooms, setAvailableRooms] = useState([]);
    const [currentRoom, setCurrentRoom] = useState(null);
    const [liveScores, setLiveScores] = useState({});

    const userId = userData?.phone || 'guest_' + Math.floor(Math.random() * 10000);

    // 1. QUẢN LÝ TRẠNG THÁI ONLINE (PRESENCE)
    useEffect(() => {
        if (!userData?.phone) return;

        const userStatusRef = ref(rtdb, `au_presence/${userId}`);
        const isOfflineForDatabase = {
            state: 'offline',
            last_changed: Date.now(),
        };
        const isOnlineForDatabase = {
            state: 'online',
            name: userData.name,
            rankId: userData.rankId,
            last_changed: Date.now(),
        };

        const connectedRef = ref(rtdb, '.info/connected');
        const unsubscribe = onValue(connectedRef, (snap) => {
            if (snap.val() === true) {
                // Khi mất kết nối, tự động xóa/đổi trạng thái
                onDisconnect(userStatusRef).set(isOfflineForDatabase).then(() => {
                    set(userStatusRef, isOnlineForDatabase);
                });
            }
        });

        // Lắng nghe danh sách tất cả người chơi online
        const presenceRef = ref(rtdb, 'au_presence');
        const presenceUnsub = onValue(presenceRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const players = Object.keys(data)
                    .map(key => ({ id: key, ...data[key] }))
                    .filter(p => p.state === 'online');
                setOnlinePlayers(players);
            } else {
                setOnlinePlayers([]);
            }
        });

        return () => {
            unsubscribe();
            presenceUnsub();
            set(userStatusRef, isOfflineForDatabase); // Set offline khi unmount
        };
    }, [userData, userId]);

    // 2. LẮNG NGHE DANH SÁCH PHÒNG CHỜ (AVAILABLE ROOMS)
    useEffect(() => {
        const roomsRef = ref(rtdb, 'au_rooms');
        const unsubscribe = onValue(roomsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const rooms = Object.keys(data)
                    .map(key => ({ id: key, ...data[key] }))
                    .filter(room => room.status === 'waiting' && room.mode !== 'single');
                setAvailableRooms(rooms);
            } else {
                setAvailableRooms([]);
            }
        });
        return () => unsubscribe();
    }, []);

    // 3. LẮNG NGHE THAY ĐỔI CỦA PHÒNG HIỆN TẠI & ĐIỂM SỐ
    useEffect(() => {
        if (!currentRoom?.id) return;

        // Lắng nghe trạng thái phòng (Bắt đầu game, người vào/ra)
        const roomRef = ref(rtdb, `au_rooms/${currentRoom.id}`);
        const roomUnsub = onValue(roomRef, (snapshot) => {
            if (snapshot.exists()) {
                setCurrentRoom({ id: currentRoom.id, ...snapshot.val() });
            } else {
                setCurrentRoom(null); // Phòng đã bị xóa
            }
        });

        // Lắng nghe điểm số trực tiếp
        const scoresRef = ref(rtdb, `au_live_scores/${currentRoom.id}`);
        const scoresUnsub = onValue(scoresRef, (snapshot) => {
            if (snapshot.exists()) {
                setLiveScores(snapshot.val());
            } else {
                setLiveScores({});
            }
        });

        return () => {
            roomUnsub();
            scoresUnsub();
        };
    }, [currentRoom?.id]);

    // 4. CÁC HÀM TƯƠNG TÁC PHÒNG

    // Tạo phòng mới
    const createRoom = async (mode, track) => {
        const roomsRef = ref(rtdb, 'au_rooms');
        const newRoomRef = push(roomsRef);
        const roomId = newRoomRef.key;

        const roomData = {
            hostId: userId,
            mode: mode, // 'single', 'solo', 'couple'
            status: 'waiting',
            track: track, // Thông tin bài nhạc
            createdAt: Date.now(),
            players: {
                [userId]: {
                    name: userData.name,
                    rankId: userData.rankId,
                    team: mode === 'couple' ? 'A' : 'none'
                }
            }
        };

        await set(newRoomRef, roomData);
        setCurrentRoom({ id: roomId, ...roomData });
        return roomId;
    };

    // Tham gia phòng
    const joinRoom = async (roomId) => {
        const roomRef = ref(rtdb, `au_rooms/${roomId}`);
        const snapshot = await get(roomRef);
        
        if (snapshot.exists()) {
            const roomData = snapshot.val();
            if (roomData.status !== 'waiting') throw new Error("Phòng đã bắt đầu!");
            
            // Xếp team cho chế độ Cặp (Chia đều team A và B)
            let team = 'none';
            if (roomData.mode === 'couple') {
                const playerCounts = Object.values(roomData.players || {}).reduce((acc, p) => {
                    acc[p.team] = (acc[p.team] || 0) + 1;
                    return acc;
                }, { A: 0, B: 0 });
                team = playerCounts.A <= playerCounts.B ? 'A' : 'B';
            }

            const updates = {};
            updates[`players/${userId}`] = {
                name: userData.name,
                rankId: userData.rankId,
                team: team
            };

            await update(roomRef, updates);
            setCurrentRoom({ id: roomId, ...roomData, players: { ...roomData.players, [userId]: { name: userData.name, team } } });
            return roomId;
        } else {
            throw new Error("Phòng không tồn tại!");
        }
    };

    // Rời phòng
    const leaveRoom = async () => {
        if (!currentRoom) return;
        const roomId = currentRoom.id;
        
        if (currentRoom.hostId === userId) {
            // Nếu là chủ phòng rời đi -> Xóa phòng
            await remove(ref(rtdb, `au_rooms/${roomId}`));
            await remove(ref(rtdb, `au_live_scores/${roomId}`));
        } else {
            // Xóa player khỏi phòng
            await remove(ref(rtdb, `au_rooms/${roomId}/players/${userId}`));
            await remove(ref(rtdb, `au_live_scores/${roomId}/${userId}`));
        }
        setCurrentRoom(null);
        setLiveScores({});
    };

    // Chủ phòng bắt đầu game
    const startGameSync = async () => {
        if (!currentRoom || currentRoom.hostId !== userId) return;
        await update(ref(rtdb, `au_rooms/${currentRoom.id}`), {
            status: 'playing',
            startTime: Date.now() + 3000 // Hẹn giờ bắt đầu đồng loạt sau 3s (Ping delay buffer)
        });
    };

    // Cập nhật điểm Realtime trong lúc nhảy
    const updateLiveScore = useCallback((score, combo, maxCombo, perfectCount) => {
        if (!currentRoom || currentRoom.mode === 'single') return; // Single không cần sync điểm realtime để tiết kiệm băng thông
        
        const scoreRef = ref(rtdb, `au_live_scores/${currentRoom.id}/${userId}`);
        update(scoreRef, {
            score: score,
            combo: combo,
            maxCombo: maxCombo,
            perfect: perfectCount,
            name: userData.name,
            team: currentRoom.players[userId]?.team || 'none'
        });
    }, [currentRoom, userId, userData.name]);

    return {
        onlinePlayers,
        availableRooms,
        currentRoom,
        liveScores,
        createRoom,
        joinRoom,
        leaveRoom,
        startGameSync,
        updateLiveScore
    };
};