import { useCallback, useEffect, useMemo, useState } from 'react';
import { AgentAudioVisualizer, FishAgentError, useAgentMessages, useConversation } from '@fishaudio/agent-react';
import { Download, Mic, MicOff, Phone, PhoneOff, RefreshCw, Square } from 'lucide-react';
import { createVoiceSession, getVoicePilotHealth, type VoicePilotHealth } from '@/services/voice/pilot';
import { useAppStore } from '@/store';
import { getVoiceModelForMessage } from '@/utils/voiceUtils';

const stateLabels = {
  idle: '准备接通', connecting: '正在接通', connected: '通话中', reconnecting: '网络重连中',
  ended: '通话已结束', listening: '正在聆听', thinking: '正在思考', speaking: '正在回答',
} as const;

function readableError(error: unknown) {
  if (error instanceof FishAgentError) {
    if (error.code === 'mic_permission_denied') return '无法使用麦克风，请在系统或浏览器设置中允许访问。';
    if (error.code === 'session_expired') return '会话令牌已过期，请重新接通。';
    if (error.code === 'provider_error') return '语音或模型服务暂时不可用，请稍后重试。';
  }
  return error instanceof Error ? error.message : '接通失败，请检查网络和麦克风权限。';
}

export default function VoicePilot() {
  const roles = useAppStore(state => state.aiRoles);
  const conversations = useAppStore(state => state.chatSessions);
  const llmConfigs = useAppStore(state => state.llmConfigs);
  const currentModelId = useAppStore(state => state.currentModelId);
  const userProfile = useAppStore(state => state.currentUserProfile);
  const voiceSettings = useAppStore(state => state.voiceSettings);
  const conversation = useConversation();
  const messages = useAgentMessages(conversation.session);
  const [health, setHealth] = useState<VoicePilotHealth | null>(null);
  const [checking, setChecking] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [roleId, setRoleId] = useState('');
  const [conversationId, setConversationId] = useState('');
  const [modelConfigId, setModelConfigId] = useState('');
  const [voiceId, setVoiceId] = useState('');

  const supportedModels = useMemo(() => llmConfigs.filter(config => config.enabled && ['openai', 'kimi', 'deepseek', 'openrouter', 'custom'].includes(config.provider)), [llmConfigs]);
  const roleConversations = useMemo(() => conversations.filter(item => item.roleId === roleId), [conversations, roleId]);

  useEffect(() => { if (!roleId && roles[0]) setRoleId(roles[0].id); }, [roleId, roles]);
  useEffect(() => {
    if (!modelConfigId) setModelConfigId(supportedModels.find(item => item.id === currentModelId)?.id || supportedModels[0]?.id || '');
  }, [currentModelId, modelConfigId, supportedModels]);
  useEffect(() => {
    if (conversationId && !roleConversations.some(item => item.id === conversationId)) setConversationId('');
  }, [conversationId, roleConversations]);
  useEffect(() => {
    const role = roles.find(item => item.id === roleId);
    setVoiceId(role ? getVoiceModelForMessage(role, voiceSettings)?.id || '' : '');
  }, [roleId, roles, voiceSettings]);

  const check = useCallback(async () => {
    setChecking(true); setError('');
    try { setHealth(await getVoicePilotHealth()); }
    catch (cause) { setHealth(null); setError(readableError(cause)); }
    finally { setChecking(false); }
  }, []);

  useEffect(() => { void check(); }, [check]);

  const start = async () => {
    if (starting || conversation.status === 'connecting') return;
    setStarting(true); setError('');
    try {
      const sessionToken = await createVoiceSession({
        roleId,
        modelConfigId,
        conversationId: conversationId || undefined,
        userProfileId: userProfile?.id,
        voiceId: voiceId || undefined,
      });
      await conversation.startSession({ sessionToken });
    } catch (cause) { setError(readableError(cause)); }
    finally { setStarting(false); }
  };

  const end = async () => {
    setError('');
    try { await conversation.endSession(); }
    catch (cause) { setError(readableError(cause)); }
  };

  const toggleMute = async () => {
    try { await conversation.setMicMuted(!conversation.micMuted); }
    catch (cause) { setError(readableError(cause)); }
  };

  const download = () => {
    const data = { createdAt: new Date().toISOString(), provider: 'fish-agents', messages: messages.map(({ role, text, final }) => ({ role, text, final })) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `voice-pilot-${Date.now()}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const active = ['connecting', 'connected', 'reconnecting'].includes(conversation.status);
  const displayState = conversation.status === 'connected' ? conversation.mode : conversation.status;

  return <main className="mx-auto max-w-3xl p-4 md:p-8 pb-24">
    <div className="mb-6"><h1 className="text-2xl font-bold">实时通话测试</h1><p className="text-sm opacity-60 mt-1">Fish Agents 最小验证版</p></div>
    <section className="rounded-2xl bg-base-200 p-5 space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="form-control"><span className="label">项目 Agent</span><select className="select select-bordered" value={roleId} disabled={active} onChange={event => setRoleId(event.target.value)}>
          <option value="">请选择</option>{roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
        </select></label>
        <label className="form-control"><span className="label">LLM 配置</span><select className="select select-bordered" value={modelConfigId} disabled={active} onChange={event => setModelConfigId(event.target.value)}>
          <option value="">请选择</option>{supportedModels.map(model => <option key={model.id} value={model.id}>{model.name} · {model.model}</option>)}
        </select></label>
        <label className="form-control"><span className="label">继续已有会话（可选）</span><select className="select select-bordered" value={conversationId} disabled={active} onChange={event => setConversationId(event.target.value)}>
          <option value="">仅测试本次通话</option>{roleConversations.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select></label>
        <label className="form-control"><span className="label">音色（可选）</span><select className="select select-bordered" value={voiceId} disabled={active} onChange={event => setVoiceId(event.target.value)}>
          <option value="">使用 Fish Agent 默认音色</option>{voiceSettings?.customModels.map(voice => <option key={voice.id} value={voice.id}>{voice.name}</option>)}
        </select></label>
      </div>
      <p className="text-sm">System Prompt、开场白、音色和 LLM 均由所选项目配置动态传入。</p>
      <p className="text-sm opacity-60">本版不加载知识库、不启用 Skill；选择已有会话时，Gateway 会补入最近 40 条云端消息。</p>
      <div className="flex items-center gap-3 text-sm">
        <button className="btn btn-sm btn-ghost" disabled={checking || active} onClick={() => void check()}><RefreshCw size={15} />{checking ? '检查中' : '检查连接'}</button>
        <span>{health?.configured ? 'local-server 已就绪' : '服务尚未就绪'}</span>
      </div>
      {health && !health.configured && <div className="text-sm text-warning break-words">待配置：{health.missing.join('、')}</div>}
    </section>
    <section className="text-center py-8" aria-live="polite">
      <div className={`mx-auto mb-4 w-24 h-24 rounded-full flex items-center justify-center ${active ? 'bg-primary/15 text-primary' : 'bg-base-200'}`}>
        {conversation.status === 'connected' ? <AgentAudioVisualizer session={conversation.session} bars={12} width={64} height={40} className="text-primary" /> : <Phone size={30} />}
      </div>
      <p className="font-semibold text-lg">{conversation.micMuted ? '麦克风已静音' : stateLabels[displayState as keyof typeof stateLabels] || displayState}</p>
      <div className="flex justify-center gap-3 mt-5 flex-wrap">
        {!active ? <button className="btn btn-primary" onClick={() => void start()} disabled={!health?.configured || starting || !roleId || !modelConfigId}><Phone size={18} />{starting ? '正在准备' : '开始通话'}</button> : <>
          <button className="btn" onClick={() => void toggleMute()} disabled={conversation.status !== 'connected'}>{conversation.micMuted ? <MicOff size={18} /> : <Mic size={18} />}{conversation.micMuted ? '取消静音' : '静音'}</button>
          <button className="btn" onClick={() => conversation.interrupt()} disabled={conversation.status !== 'connected' || !conversation.isSpeaking}><Square size={16} />打断</button>
          <button className="btn btn-error" onClick={() => void end()}><PhoneOff size={18} />挂断</button>
        </>}
      </div>
      {active && <button className="btn btn-link btn-sm mt-2" onClick={() => void conversation.startAudio().catch(cause => setError(readableError(cause)))}>听不到声音？点击开启播放</button>}
    </section>
    {error && <div role="alert" className="alert alert-warning mb-4 text-sm">{error}</div>}
    <section className="rounded-2xl border border-base-300 p-4">
      <div className="flex items-center justify-between mb-4"><h2 className="font-semibold">本次转录</h2><button className="btn btn-ghost btn-sm" disabled={active || !messages.length} onClick={download}><Download size={15} />导出</button></div>
      <div className="space-y-3 max-h-96 overflow-auto" aria-live="polite">
        {!messages.length && <p className="opacity-50 text-sm">接通后，双方的实时转录会显示在这里。</p>}
        {messages.map(message => <div key={message.key} className={`rounded-xl p-3 ${message.role === 'user' ? 'bg-primary/10' : 'bg-base-200'}`}><p className="text-xs opacity-50 mb-1">{message.role === 'user' ? '你' : '助手'}{message.final ? '' : ' · 输入中'}</p><p className="whitespace-pre-wrap text-sm">{message.text}</p></div>)}
      </div>
    </section>
  </main>;
}
