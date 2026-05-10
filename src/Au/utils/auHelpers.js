// src/Au/utils/auHelpers.js
import { useState, useEffect } from 'react';

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