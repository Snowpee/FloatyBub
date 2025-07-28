import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import {
  MessageCircle,
  Settings,
  Globe
} from 'lucide-react';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const {
    llmConfigs,
    aiRoles,
    chatSessions,
    currentRoleId,
    currentModelId
  } = useAppStore();

  const hasConfigs = llmConfigs.length > 0 && llmConfigs.some(c => c.enabled);
  const recentSessions = chatSessions.slice(0, 3);

  const handleQuickStart = () => {
    // 导航到聊天页面，与侧边栏新建聊天按钮行为一致
    navigate('/chat');
  };



  return (
    <div 
      className="min-h-[calc(100vh-4rem)] bg-base-200"
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
            {hasConfigs && currentRoleId && currentModelId ? (
              <button
                onClick={handleQuickStart}
                className="btn btn-outline btn-accent btn-lg"
              >
                <MessageCircle className="h-5 w-5" />
                开始聊天
              </button>
            ) : (
              <Link
                to="/config"
                className="btn btn-primary btn-lg"
              >
                <Settings className="h-5 w-5" />
                配置模型
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12">




        {/* 状态提示 */}
        {!hasConfigs && (
          <div className="alert alert-warning mt-12">
            <Settings className="h-6 w-6" />
            <div>
              <h3 className="font-bold">
                开始使用前需要配置
              </h3>
              <div className="text-sm">
                请先添加至少一个AI模型配置才能开始聊天。
              </div>
              <Link
                to="/config"
                className="btn btn-sm btn-outline mt-2"
              >
                立即配置
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;