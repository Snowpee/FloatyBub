import React, { useState, useEffect, useRef } from 'react';

interface AnimatedTextProps {
  isAnimating: boolean;
  baseText: string;
  staticText: string;
  interval?: number;
}

const useAnimatedText = ({
  isAnimating,
  baseText,
  staticText,
  interval = 500
}: AnimatedTextProps): string => {
  const [animatedText, setAnimatedText] = useState(baseText);
  const animationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isAnimating) {
      // 启动动画
      let dotCount = 0;
      animationIntervalRef.current = setInterval(() => {
        dotCount = (dotCount + 1) % 4; // 0, 1, 2, 3 循环
        const dots = '.'.repeat(dotCount);
        setAnimatedText(baseText + dots);
      }, interval);
    } else {
      // 停止动画并重置
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
        animationIntervalRef.current = null;
      }
      setAnimatedText(baseText);
    }

    // 清理函数
    return () => {
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
        animationIntervalRef.current = null;
      }
    };
  }, [isAnimating, baseText, interval]);

  return isAnimating ? animatedText : staticText;
};

const AnimatedText: React.FC<AnimatedTextProps> = (props) => {
  const text = useAnimatedText(props);
  return <>{text}</>;
};

export default AnimatedText;
export { useAnimatedText };