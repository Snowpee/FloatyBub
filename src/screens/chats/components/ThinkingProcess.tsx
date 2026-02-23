import React, { useState, useEffect } from 'react';
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
  const [isExpanded, setIsExpanded] = useState(true);
  
  // 思考状态：只要未完成，就在思考中
  const isThinking = !isComplete;
  
  // 准备状态：未完成且无内容
  const isPreparingToThink = !content && !isComplete;

  // 当思考完成时，自动收起
  useEffect(() => {
    if (isComplete) {
      // 稍微延迟一点收起，让用户看到最后的思考内容（哪怕一瞬间）
      // 或者直接收起，原逻辑是动画结束后收起。
      // 这里没有动画了，直接收起可能太快？
      // 用户说“不写代码回答：...”，然后说“那我们删除这种动画”。
      // 之前的逻辑是：动画播完 -> isTyping变false -> 触发useEffect -> 收起。
      // 现在：isComplete变true -> 立即收起。
      const timer = setTimeout(() => {
        console.log('📦 思考完成，自动收起');
        setIsExpanded(false);
      }, 500); // 给个500ms的延迟，体验更好
      return () => clearTimeout(timer);
    } else {
      // 如果重新开始思考（isComplete变false），且有内容，则展开
      if (content) {
        setIsExpanded(true);
      }
    }
  }, [isComplete, content ? true : false]);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };
  
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
              {isPreparingToThink ? '准备思考中...' : isThinking ? '思考中...' : '思考过程'}
            </span>
            {isComplete && (
              <div className="badge badge-soft badge-sm gap-1">
                完成
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isThinking && (
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
                    {/* 直接显示内容，无动画 */}
                    {content}
                    {/* 思考中（未完成）显示光标 */}
                    {isThinking && (
                      <span className="inline-block w-2 h-4 bg-accent animate-pulse ml-1 align-middle" />
                    )}
                  </>
                )}
              </pre>
              
              {/* 渐变遮罩效果 - 仅在内容过长时显示 */}
              {isExpanded && content.length > 1000 && (
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
