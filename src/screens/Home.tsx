import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store';
import { cn } from '@/lib/utils';
import { usePageContext } from '@/hooks/usePageContext';
import {
  MessageCircle,
  Settings,
  Globe
} from 'lucide-react';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { className } = usePageContext();
  const {
    llmConfigs,
    aiRoles,
    chatSessions,
    currentModelId
  } = useAppStore();

  const hasConfigs = llmConfigs.length > 0 && llmConfigs.some(c => c.enabled);
  const recentSessions = chatSessions.slice(0, 3);

  const handleQuickStart = () => {
    // 导航到聊天页面，与侧边栏新建聊天按钮行为一致
    navigate('/chat');
  };

  // 如果已配置模型，自动跳转到 /chat 页面
  useEffect(() => {
    if (hasConfigs) {
      navigate('/chat', { replace: true });
    }
  }, [hasConfigs, navigate]);


  return (
    <div 
      className={cn("min-h-[calc(100vh-4rem)] bg-base-100", className)}
      style={{
        backgroundImage: `radial-gradient(circle at 30% 60%, var(--color-info) -200%, transparent 30%), radial-gradient(circle at 70% 50%, var(--color-warning) -200%, transparent 30%)`
      }}
      >
      {/* Hero Section */}
      <div className="text-base-content">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="text-center">
            <div className="flex items-center justify-center mb-6">
              <h1 className="text-4xl md:text-5xl font-bold">
                Floaty Bub
              </h1>
            </div>
            <p className="text-xl md:text-2xl mb-8">
              一个轻量的 LLM 聊天框架
            </p>
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
              {!hasConfigs ? (
                <button
                  onClick={() => window.location.hash = '#setting/config'}
                  className="btn btn-primary btn-lg"
                >
                  <Settings className="h-5 w-5" />
                  配置模型
                </button>
              ) : (
                // 已配置场景：会自动跳转到 /chat，这里不再显示“开始聊天”按钮
                null
              )}
              

            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12">




        {/* 状态提示 */}
        {!hasConfigs && (
          <div role="alert" className="alert sm:alert-horizontal mt-12 max-w-md mx-auto flex">
              <span>
                请先添加 AI 模型配置，点击配置按钮开始配置吧！
              </span>
          </div>
        )}
      </div>
      

    </div>
  );
};

export default Home;