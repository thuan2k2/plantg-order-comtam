import React, { useState, useEffect, useRef, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, functions } from '../firebase/config';
import { httpsCallable } from 'firebase/functions'; // GỌI CLOUD FUNCTION ĐỂ BẢO MẬT XU

// CÁC MẨU CHUYỆN NHỎ
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
  const [position, setPosition] = useState({ x: -100, y: -100 }); 
  const [isFlipped, setIsFlipped] = useState(false); 
  const [message, setMessage] = useState(''); 
  const [floatingReward, setFloatingReward] = useState(null); 
  const [isCooldown, setIsCooldown] = useState(false); 

  const [isDragging, setIsDragging] = useState(false);
  const [transitionStyle, setTransitionStyle] = useState('none'); 

  const isInteracting = useRef(false); 
  const storyTimeoutRef = useRef(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const moveTimerRef = useRef(null);

  // 0. FIX LỖI F5 SPAM XU: Phục hồi Cooldown từ localStorage
  useEffect(() => {
    const savedCooldown = localStorage.getItem(`pet_cooldown_${phone}`);
    if (savedCooldown) {
      const timeLeft = parseInt(savedCooldown) - Date.now();
      if (timeLeft > 0) {
        setIsCooldown(true);
        setTimeout(() => setIsCooldown(false), timeLeft);
      } else {
        localStorage.removeItem(`pet_cooldown_${phone}`);
      }
    }
  }, [phone]);

  // 2. Logic Bay Lượn Ngẫu Nhiên
  const movePet = useCallback(() => {
    if (isDragging) return;

    const paddingX = 80;
    const paddingY = 150; 
    const maxX = window.innerWidth - paddingX;
    const maxY = window.innerHeight - paddingY;

    const nextX = Math.random() * (maxX - paddingX) + paddingX;
    const nextY = Math.random() * (maxY - paddingY) + paddingY;

    setTransitionStyle('all 8000ms ease-in-out'); 

    setPosition(prev => {
      setIsFlipped(nextX > prev.x); 
      return { x: nextX, y: nextY };
    });
  }, [isDragging]);

  const startAutoMove = useCallback(() => {
    if (moveTimerRef.current) clearInterval(moveTimerRef.current);
    movePet(); 
    moveTimerRef.current = setInterval(movePet, 8000); 
  }, [movePet]);

  useEffect(() => {
    setPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    startAutoMove();
    return () => clearInterval(moveTimerRef.current);
  }, [startAutoMove]);

  // 3. Logic Kể chuyện vặt (Idle Chatter)
  useEffect(() => {
    const playStory = async () => {
      if (isInteracting.current || isDragging) return;

      const randomStory = PET_STORIES[Math.floor(Math.random() * PET_STORIES.length)];
      
      for (const phrase of randomStory) {
        if (isInteracting.current || isDragging) break; 
        
        setMessage(phrase);
        await new Promise(resolve => {
          storyTimeoutRef.current = setTimeout(resolve, 4000);
        });
        setMessage('');
        
        await new Promise(resolve => {
          storyTimeoutRef.current = setTimeout(resolve, 1000);
        });
      }
    };

    const chatterTimer = setInterval(() => {
      if (Math.random() > 0.7 && !isInteracting.current && !isDragging && !message) {
        playStory();
      }
    }, 15000);

    return () => {
      clearInterval(chatterTimer);
      if (storyTimeoutRef.current) clearTimeout(storyTimeoutRef.current);
    };
  }, [message, isDragging]);

  // 4. Logic Tương tác (Click nhận thưởng)
  const handleInteract = useCallback(async () => {
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

    isInteracting.current = true;
    if (storyTimeoutRef.current) clearTimeout(storyTimeoutRef.current);
    setMessage("Đợi xíu, có quà cho bạn nè! ✨");

    try {
      // ĐÃ FIX BẢO MẬT: Client KHÔNG tự tính xu nữa. Gọi thẳng lên Server.
      const claimPetXu = httpsCallable(functions, 'claimPetXu');
      const res = await claimPetXu({ phone });
      
      if (res.data.success) {
        setFloatingReward(res.data.reward); // Lấy số Xu do Server trả về
        const thankPhrase = THANK_YOU_PHRASES[Math.floor(Math.random() * THANK_YOU_PHRASES.length)];
        setMessage(thankPhrase);

        setIsCooldown(true);
        const randomCooldownSeconds = Math.floor(Math.random() * (120 - 60 + 1)) + 60;
        
        // Lưu Cooldown vào localStorage để tránh F5
        localStorage.setItem(`pet_cooldown_${phone}`, Date.now() + (randomCooldownSeconds * 1000));

        setTimeout(() => {
          setIsCooldown(false);
        }, randomCooldownSeconds * 1000);

        setTimeout(() => {
          setFloatingReward(null);
          setMessage('');
          isInteracting.current = false;
        }, 5000);
      }
    } catch (error) {
      console.error(error);
      setMessage("Hôm nay hết xu rơi rồi! 😢");
      setTimeout(() => {
        setMessage('');
        isInteracting.current = false;
      }, 4000);
    }
  }, [isCooldown, phone]);

  // 5. LOGIC KÉO THẢ (DRAG & DROP)
  const handlePointerDown = (e) => {
    e.preventDefault();
    if (moveTimerRef.current) clearInterval(moveTimerRef.current);
    
    setTransitionStyle('none'); 
    setIsDragging(true);
    isInteracting.current = true; 
    
    dragStartPos.current = { 
      x: e.clientX || (e.touches && e.touches[0].clientX), 
      y: e.clientY || (e.touches && e.touches[0].clientY) 
    };
  };

  useEffect(() => {
    const handlePointerMove = (e) => {
      if (isDragging) {
        const currentX = e.clientX || (e.touches && e.touches[0].clientX);
        const currentY = e.clientY || (e.touches && e.touches[0].clientY);
        
        setPosition(prev => {
          setIsFlipped(currentX > prev.x); 
          return { x: currentX, y: currentY };
        });
      }
    };

    const handlePointerUp = (e) => {
      if (isDragging) {
        setIsDragging(false);
        isInteracting.current = false;

        const currentX = e.clientX || (e.changedTouches && e.changedTouches[0].clientX);
        const currentY = e.clientY || (e.changedTouches && e.changedTouches[0].clientY);
        const dx = Math.abs(currentX - dragStartPos.current.x);
        const dy = Math.abs(currentY - dragStartPos.current.y);

        if (dx < 10 && dy < 10) {
          handleInteract();
        }

        setTimeout(() => {
          startAutoMove();
        }, 1000);
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handlePointerMove);
      window.addEventListener('mouseup', handlePointerUp);
      window.addEventListener('touchmove', handlePointerMove, { passive: false });
      window.addEventListener('touchend', handlePointerUp);
    }

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [isDragging, startAutoMove, handleInteract]);

  return (
    <div 
      className="fixed z-[9900]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transition: transitionStyle, 
        transform: 'translate(-50%, -50%)' 
      }}
    >
      <div 
        className="relative flex flex-col items-center justify-center cursor-grab active:cursor-grabbing pointer-events-auto"
        onMouseDown={handlePointerDown}
        onTouchStart={handlePointerDown}
      >
        
        {floatingReward !== null && (
          <div className="absolute -top-16 text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 drop-shadow-md animate-out fade-out slide-out-to-top-8 duration-1000 z-20 pointer-events-none">
            +{floatingReward} Xu
          </div>
        )}

        <div className={`absolute bottom-full mb-4 w-max max-w-[160px] bg-white dark:bg-gray-800 p-3 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 transition-all duration-300 transform origin-bottom z-10 pointer-events-none
          ${message ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}
        >
          <p className="text-[11px] font-bold text-gray-700 dark:text-gray-200 text-center leading-snug">
            {message}
          </p>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white dark:bg-gray-800 rotate-45 border-b border-r border-gray-100 dark:border-gray-700"></div>
        </div>

        <img 
          src="/pet/Pet.gif" 
          alt="Pet" 
          draggable="false"
          className={`w-20 h-20 object-contain drop-shadow-xl transition-transform duration-300 select-none
            ${isFlipped ? 'scale-x-[-1]' : 'scale-x-100'} 
            ${isInteracting.current && !isDragging ? 'animate-pulse' : ''}
          `}
          onError={(e) => {
            e.target.style.display = 'none';
          }}
        />
      </div>
    </div>
  );
};

export default PetEntity;