import React, { useState, useEffect, useRef, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { claimPetReward } from '../services/orderService';

// CÁC MẨU CHUYỆN NHỎ (Mỗi mảng là 1 câu chuyện được kể nối tiếp nhau)
const PET_STORIES = [
  ["Trời hôm nay đẹp quá nhỉ?", "Bạn đã ăn cơm chưa?", "Nhớ uống nhiều nước nha!"],
  ["Mình bay nãy giờ mỏi cánh ghê...", "Nhưng mà rất vui!", "Lát nữa cho mình xin miếng sườn nhé 🤤"],
  ["Bếp trưởng dặn mình phải chăm sóc bạn thật tốt.", "Bạn thấy mình ngoan không?", "Hihi 🥰"],
  ["Phía xa xa có mùi thịt nướng thơm quá!", "Bụng mình sôi cồn cào rồi...", "Hay là bạn đặt thêm món đi?"],
  ["Nghe nói hạng Thách Đấu nhiều đặc quyền lắm.", "Bạn thật là cừ khôi!", "Mình tự hào về bạn lắm đó 👑"],
  ["Úm ba la xì bùa...", "Mình đang nhặt xu rơi vãi trên đường.", "Lát bạn bấm vào mình để lấy nha!"]
];

const THANK_YOU_PHRASES = [
  "Meow! Cảm ơn bạn nha! 🥰",
  "Chụt chụt! Tặng bạn ít Xu nè! 🎁",
  "Yeah! Thích quá đi! Xu của bạn đây!",
  "Bạn thật tốt bụng! Nhận quà nhé! ✨"
];

const PetEntity = ({ phone }) => {
  const [position, setPosition] = useState({ x: -100, y: -100 }); // Vị trí (x, y)
  const [isFlipped, setIsFlipped] = useState(false); // Xoay chiều Pet khi bay
  const [message, setMessage] = useState(''); // Lời nói hiện tại của Pet
  const [floatingReward, setFloatingReward] = useState(null); // Hiển thị +Xu bay lên
  const [isCooldown, setIsCooldown] = useState(false); 

  const [config, setConfig] = useState({ petMinReward: 1, petMaxReward: 10 });
  const isInteracting = useRef(false); // Chặn hội thoại idle khi đang tương tác
  const storyTimeoutRef = useRef(null);

  // 1. Lắng nghe cấu hình số Xu phần thưởng từ Admin
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system', 'config'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setConfig({
          petMinReward: data.petMinReward || 1,
          petMaxReward: data.petMaxReward || 10
        });
      }
    });
    return () => unsub();
  }, []);

  // 2. Logic Bay Lượn Ngẫu Nhiên
  const movePet = useCallback(() => {
    const paddingX = 80;
    const paddingY = 150; // Tránh bay đụng Header/Footer
    const maxX = window.innerWidth - paddingX;
    const maxY = window.innerHeight - paddingY;

    const nextX = Math.random() * (maxX - paddingX) + paddingX;
    const nextY = Math.random() * (maxY - paddingY) + paddingY;

    setPosition(prev => {
      // Nếu tọa độ X mới nhỏ hơn tọa độ cũ -> Đang bay sang trái -> Không lật
      // (Giả sử ảnh gốc của Pet đang hướng sang trái)
      setIsFlipped(nextX > prev.x); 
      return { x: nextX, y: nextY };
    });
  }, []);

  useEffect(() => {
    // Khởi tạo vị trí ban đầu giữa màn hình
    setPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    
    const moveTimer = setInterval(() => {
      movePet();
    }, 8000); // Đổi hướng mỗi 8 giây

    return () => clearInterval(moveTimer);
  }, [movePet]);

  // 3. Logic Kể chuyện vặt (Idle Chatter)
  useEffect(() => {
    const playStory = async () => {
      if (isInteracting.current) return;

      const randomStory = PET_STORIES[Math.floor(Math.random() * PET_STORIES.length)];
      
      for (const phrase of randomStory) {
        if (isInteracting.current) break; // Nếu khách bấm vào pet thì dừng ngay
        
        setMessage(phrase);
        // Chờ 4 giây cho mỗi câu thoại
        await new Promise(resolve => {
          storyTimeoutRef.current = setTimeout(resolve, 4000);
        });
        setMessage('');
        
        // Ngắt quãng nhỏ giữa 2 câu
        await new Promise(resolve => {
          storyTimeoutRef.current = setTimeout(resolve, 1000);
        });
      }
    };

    const chatterTimer = setInterval(() => {
      // 30% tỷ lệ bắt đầu kể 1 câu chuyện mỗi 15 giây
      if (Math.random() > 0.7 && !isInteracting.current && !message) {
        playStory();
      }
    }, 15000);

    return () => {
      clearInterval(chatterTimer);
      if (storyTimeoutRef.current) clearTimeout(storyTimeoutRef.current);
    };
  }, [message]);

  // 4. Logic Tương tác (Click)
  const handleInteract = async () => {
    // Nếu đang trong thời gian chờ
    if (isCooldown) {
      isInteracting.current = true;
      if (storyTimeoutRef.current) clearTimeout(storyTimeoutRef.current);
      
      setMessage("Mình đang đi gom thêm xu, đợi xíu nha! 💦");
      setTimeout(() => {
        setMessage('');
        isInteracting.current = false;
      }, 4000);
      return;
    }

    // Bắt đầu nhận thưởng
    isInteracting.current = true;
    if (storyTimeoutRef.current) clearTimeout(storyTimeoutRef.current);
    setMessage("Đợi xíu, có quà cho bạn nè! ✨");

    const res = await claimPetReward(phone, config.petMinReward, config.petMaxReward);
    
    if (res.success) {
      setFloatingReward(res.reward);
      const thankPhrase = THANK_YOU_PHRASES[Math.floor(Math.random() * THANK_YOU_PHRASES.length)];
      setMessage(thankPhrase);

      // Kích hoạt Cooldown (Random từ 60s đến 120s)
      setIsCooldown(true);
      const randomCooldownSeconds = Math.floor(Math.random() * (120 - 60 + 1)) + 60;
      
      setTimeout(() => {
        setIsCooldown(false);
      }, randomCooldownSeconds * 1000);

      // Dọn dẹp UI sau khi tặng
      setTimeout(() => {
        setFloatingReward(null);
        setMessage('');
        isInteracting.current = false;
      }, 5000);
    } else {
      setMessage("Ui lỗi rồi, mình rớt mất xu rồi! 😢");
      setTimeout(() => {
        setMessage('');
        isInteracting.current = false;
      }, 4000);
    }
  };

  return (
    <div 
      className="fixed z-[9900] pointer-events-none"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transition: 'all 8000ms ease-in-out', // Bay mượt mà trong 8 giây
      }}
    >
      <div className="relative flex flex-col items-center justify-center pointer-events-auto">
        
        {/* Floating Reward Animation (+ Xu) */}
        {floatingReward !== null && (
          <div className="absolute -top-16 text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 drop-shadow-md animate-out fade-out slide-out-to-top-8 duration-1000 z-20">
            +{floatingReward} Xu
          </div>
        )}

        {/* Khung Chat Bubble */}
        <div className={`absolute bottom-full mb-4 w-max max-w-[160px] bg-white dark:bg-gray-800 p-3 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 transition-all duration-300 transform origin-bottom z-10
          ${message ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}
        >
          <p className="text-[11px] font-bold text-gray-700 dark:text-gray-200 text-center leading-snug">
            {message}
          </p>
          {/* Mũi tên trỏ xuống của Chat Bubble */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white dark:bg-gray-800 rotate-45 border-b border-r border-gray-100 dark:border-gray-700"></div>
        </div>

        {/* Hình ảnh Thú cưng (Pet) */}
        <img 
          src="/pet/Pet.gif" 
          alt="Pet" 
          onClick={handleInteract}
          className={`w-20 h-20 object-contain cursor-pointer drop-shadow-xl transition-transform duration-500 hover:scale-110 active:scale-95
            ${isFlipped ? 'scale-x-[-1]' : 'scale-x-100'} 
            ${isInteracting.current ? 'animate-pulse' : ''}
          `}
          onError={(e) => {
            // Ẩn nếu không tìm thấy file
            e.target.style.display = 'none';
          }}
        />
      </div>
    </div>
  );
};

export default PetEntity;