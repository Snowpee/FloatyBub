import { useState, useEffect, useRef } from 'react';
import { useScrollMask } from '@/hooks/useScrollMask';

interface UseChatScrollProps {
  currentSessionId?: string;
  messagesLength: number;
  isGenerating: boolean;
  isLoading: boolean;
}

export const useChatScroll = ({
  currentSessionId,
  messagesLength,
  isGenerating,
  isLoading
}: UseChatScrollProps) => {
  // 智能滚动遮罩
  const { scrollContainerRef, scrollMaskClasses } = useScrollMask({
    gradientPadding: '1rem',
    dependencies: [currentSessionId, messagesLength]
  });

  // 状态：用户是否手动滚动过
  const [userHasScrolled, setUserHasScrolled] = useState(false);

  // 自动滚动到底部
  const scrollToBottom = (smooth = true) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
      setUserHasScrolled(false); // 重置用户滚动状态
    }
  };

  // 监听流式输出并自动滚动
  useEffect(() => {
    if (isGenerating && !userHasScrolled) {
      scrollToBottom(false); // 流式输出时使用即时滚动，避免卡顿
    }
  }, [messagesLength, isGenerating, userHasScrolled]);

  // 监听滚动事件，检测用户是否手动向上滚动
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // 如果正在生成且用户向上滚动（即没有贴底），则标记为用户已滚动
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50; // 50px 容差
      
      if (isGenerating) {
        if (!isAtBottom) {
          setUserHasScrolled(true);
        } else {
          // 如果用户滚回底部，恢复自动滚动
          setUserHasScrolled(false);
        }
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [isGenerating]);

  // 新消息或会话切换时滚动到底部
  useEffect(() => {
    if (currentSessionId) {
      // 只有在用户没有手动滚动或者刚切换会话时才滚动
      if (!userHasScrolled || !isGenerating) {
        scrollToBottom(false);
        setUserHasScrolled(false);
      }
    }
  }, [currentSessionId, messagesLength]); // 添加 messagesLength 依赖以在非流式添加消息时也能滚动
  
  // 发送消息时强制滚动到底部
  useEffect(() => {
    if (isLoading) {
      scrollToBottom(true);
      setUserHasScrolled(false);
    }
  }, [isLoading]);

  return {
    scrollRef: scrollContainerRef,
    scrollMaskClasses,
    scrollToBottom,
    userHasScrolled
  };
};
