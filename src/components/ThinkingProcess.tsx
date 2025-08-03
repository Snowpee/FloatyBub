import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, Brain } from 'lucide-react';

interface ThinkingProcessProps {
  content: string;
  isComplete?: boolean;
  className?: string;
}

const ThinkingProcess: React.FC<ThinkingProcessProps> = ({ 
  content, 
  isComplete = false, 
  className = '' 
}) => {
  const [displayedContent, setDisplayedContent] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [hasStartedAnimation, setHasStartedAnimation] = useState(false);
  
  // 使用 ref 来跟踪状态，避免闭包问题
  const animationRef = useRef<NodeJS.Timeout | null>(null);
  const currentIndexRef = useRef(0);
  const lastProcessedContentRef = useRef('');
  const isAnimatingRef = useRef(false);
  const contentRef = useRef(content); // 用于在动画中获取最新的content

  // 更新content ref
  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  // 简化的内容显示逻辑
  useEffect(() => {
    // 如果已经完成，立即显示完整内容
    if (isComplete) {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
        animationRef.current = null;
      }
      isAnimatingRef.current = false;
      setIsTyping(false);
      setDisplayedContent(content);
      console.log('✅ 思考完成，显示完整内容');
      return;
    }

    // 如果有内容且还未完成，开始或继续动画
    if (content && content.trim()) {
      // 如果还没开始动画，开始动画
      if (!hasStartedAnimation) {
        console.log('⌨️ 思考动画开始');
        setHasStartedAnimation(true);
        isAnimatingRef.current = true;
        setIsTyping(true);
        currentIndexRef.current = 0;
        setDisplayedContent('');
      }

      // 确保动画正在运行
      if (!animationRef.current && isAnimatingRef.current) {
        const animate = () => {
          if (!isAnimatingRef.current || isComplete) {
            return;
          }

          const currentIndex = currentIndexRef.current;
          const currentContent = content;
          
          // 如果已经显示完所有内容，等待更多内容或完成
          if (currentIndex >= currentContent.length) {
            if (isComplete) {
              isAnimatingRef.current = false;
              setIsTyping(false);
              setDisplayedContent(currentContent);
              console.log('✅ 思考动画结束');
              return;
            } else {
              // 等待更多内容
              animationRef.current = setTimeout(animate, 100);
              return;
            }
          }

          // 显示下一个字符
          const newDisplayed = currentContent.slice(0, currentIndex + 1);
          setDisplayedContent(newDisplayed);
          currentIndexRef.current = currentIndex + 1;

          animationRef.current = setTimeout(animate, 30);
        };
        
        animate();
      }
    }

    // 清理函数
    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [content, isComplete, hasStartedAnimation]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
        animationRef.current = null;
      }
      isAnimatingRef.current = false;
    };
  }, []);

  // 当内容完成且动画结束时，立即折叠
  useEffect(() => {
    if (isComplete && !isTyping) {
      console.log('📦 思考块收起');
      setIsExpanded(false);
    }
  }, [isComplete, isTyping]);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  // 如果没有内容但正在准备思考，显示准备状态
  const isPreparingToThink = !content && !isComplete;
  
  // 如果既没有内容也已经完成，则不显示组件
  if (!content && isComplete) {
    return null;
  }

  return (
    <div className={`thinking-process bg-base-200 mt-2 mb-1 ${className}`}>
      {/* 使用 DaisyUI collapse 组件结构 */}
      <div className={`collapse ${isExpanded ? 'collapse-open' : 'collapse-close'}`}>
        {/* collapse 标题 - 思考过程头部 */}
        <div 
          className="collapse-title flex items-center justify-between p-3 cursor-pointer"
          onClick={toggleExpanded}
        >
          <div className="flex items-center gap-2">
            <div className="relative">
              <Brain className="w-4 h-4 text-base-content/50" />
            </div>
            <span className="text-sm font-medium text-base-content/50">
              {isPreparingToThink ? '准备思考中...' : isTyping ? '思考中...' : '思考过程'}
            </span>
            {isComplete && !isTyping && (
              <div className="badge badge-soft badge-sm gap-1">
                完成
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isTyping && (
              <span className="loading loading-dots loading-xs text-accent"></span>
            )}
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-base-content/50" />
            ) : (
              <ChevronDown className="w-4 h-4 text-base-content/50" />
            )}
          </div>
        </div>

        {/* collapse 内容 - 思考过程内容 */}
        <div className="collapse-content p-0">
          <div className="card-body p-4 bg-base-200/50">
            <div className="relative overflow-y-auto">
              <pre className="text-sm text-base-content/80 whitespace-pre-wrap font-mono leading-relaxed">
                {isPreparingToThink ? (
                  <span className="text-base-content/60 italic flex items-center gap-1">
                    等待AI开始思考...
                    <span className="loading loading-ring loading-xs text-accent"></span>
                  </span>
                ) : (
                  <>
                    {/* 优先显示动画内容，如果动画内容为空则显示原始内容作为回退 */}
                    {hasStartedAnimation ? (displayedContent || content) : content}
                    {isTyping && (
                      <span className="inline-block w-2 h-4 bg-accent animate-pulse ml-1" />
                    )}
                  </>
                )}
              </pre>
              
              {/* 渐变遮罩效果 - 仅在内容过长时显示 */}
              {isExpanded && displayedContent.length > 1000 && (
                <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-base-200/50 to-transparent pointer-events-none" />
              )}
            </div>
          </div>
        </div>
      </div>


    </div>
  );
};

export default ThinkingProcess;