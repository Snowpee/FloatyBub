import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FishAgentError,
  useAgentMessages,
  useAudioLevels,
  useConversation,
  type AgentSession,
} from '@fishaudio/agent-react';
import { Mic, MicOff, Phone, PhoneOff, Send, Square, Volume2, X } from 'lucide-react';
import { createVoiceSession } from '@/services/voice/pilot';
import Avatar from '@/components/Avatar';
import SoftAurora from '@/components/SoftAurora';

export interface PersistedVoiceMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface VoiceCallPanelProps {
  roleId: string;
  modelConfigId: string;
  conversationId?: string;
  userProfileId?: string;
  voiceId?: string;
  title: string;
  avatar?: string;
  onPersistMessages: (messages: PersistedVoiceMessage[]) => void;
  onClose: () => void;
}

interface VoiceAuroraProps {
  input: number;
  output: number;
  mode: string;
  muted: boolean;
  active: boolean;
}

function VoiceAurora({ input, output, mode, muted, active }: VoiceAuroraProps) {
  const [isDarkTheme, setIsDarkTheme] = useState(() => document.documentElement.getAttribute('data-theme') === 'dark');
  useEffect(() => {
    const root = document.documentElement;
    const updateTheme = () => setIsDarkTheme(root.getAttribute('data-theme') === 'dark');
    const observer = new MutationObserver(updateTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const source = mode === 'speaking' ? 'agent' : 'user';
  const rawLevel = source === 'agent' ? output : muted ? 0 : input;
  const level = active ? Math.min(1, rawLevel * 6) : 0;
  const speaking = level > 0.045;
  const label = !active ? 'Standby' : source === 'agent' ? (speaking ? 'Agent speaking' : 'Agent') : muted ? 'Muted' : speaking ? 'You are speaking' : 'Listening';
  const colors = isDarkTheme
    ? source === 'agent'
      ? { color1: '#8b5cf6', color2: '#ec4899' }
      : { color1: '#22d3ee', color2: '#3b82f6' }
    : source === 'agent'
      ? { color1: '#06b6d4', color2: '#7c3aed' }
      : { color1: '#00b8d4', color2: '#2563eb' };
  return <div
    className="relative h-32 overflow-hidden rounded-3xl border border-base-300/60"
    style={{ background: isDarkTheme ? 'color-mix(in oklab, var(--color-base-200) 42%, transparent)' : 'color-mix(in oklab, var(--color-primary) 7%, white)' }}
    aria-label={source === 'agent' ? 'Agent Aurora 声音动画' : '用户 Aurora 声音动画'}
  >
    <SoftAurora
      className="absolute inset-0"
      active={active}
      intensity={active ? Math.max(0.12, level) : 0.03}
      color1={colors.color1}
      color2={colors.color2}
      lightMode={!isDarkTheme}
    />
    <div className="absolute bottom-3 inset-x-0 text-center">
      <span className="inline-flex rounded-full bg-base-100/55 backdrop-blur-md px-3 py-1 text-[10px] font-semibold tracking-[0.2em] uppercase opacity-75">
        {label}
      </span>
    </div>
  </div>;
}

const stateLabels = {
  idle: '准备接通',
  connecting: '正在接通',
  connected: '通话中',
  reconnecting: '网络重连中',
  ended: '通话已结束',
  listening: '正在聆听',
  thinking: '正在思考',
  speaking: '正在回答',
} as const;

function readableError(error: unknown) {
  if (error instanceof FishAgentError) {
    if (error.code === 'mic_permission_denied') return '无法使用麦克风，请在系统或浏览器设置中允许访问。';
    if (error.code === 'session_expired') return '会话令牌已过期，请重新接通。';
    if (error.code === 'provider_error') return '语音或模型服务暂时不可用，请稍后重试。';
  }
  return error instanceof Error ? error.message : '接通失败，请检查网络和麦克风权限。';
}

export default function VoiceCallPanel({
  roleId,
  modelConfigId,
  conversationId,
  userProfileId,
  voiceId,
  title,
  avatar,
  onPersistMessages,
  onClose,
}: VoiceCallPanelProps) {
  const conversation = useConversation();
  const messages = useAgentMessages(conversation.session);
  const audioLevels = useAudioLevels(conversation.session, 24);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [textMessage, setTextMessage] = useState('');
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const lastSessionRef = useRef<AgentSession | null>(null);
  const persistedSessionIdsRef = useRef(new Set<string>());
  const onPersistMessagesRef = useRef(onPersistMessages);
  const visibleMessagesRef = useRef(messages);

  useEffect(() => {
    onPersistMessagesRef.current = onPersistMessages;
  }, [onPersistMessages]);

  useEffect(() => {
    visibleMessagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (conversation.session) lastSessionRef.current = conversation.session;
  }, [conversation.session]);

  const persistTranscript = useCallback((candidate?: AgentSession | null) => {
    const session = candidate || lastSessionRef.current;
    if (!session || persistedSessionIdsRef.current.has(session.sessionId)) return 0;

    let transcript = session.getTranscript()
      .filter(item => item.final && item.text.trim())
      .map((item, index) => ({
        role: item.role === 'agent' ? 'assistant' as const : 'user' as const,
        content: item.text.trim(),
        timestamp: new Date(Date.now() + index),
      }));

    if (!transcript.length) {
      transcript = visibleMessagesRef.current
        .filter(item => item.final && item.text.trim())
        .map((item, index) => ({
          role: item.role === 'agent' ? 'assistant' as const : 'user' as const,
          content: item.text.trim(),
          timestamp: new Date(Date.now() + index),
        }));
    }

    if (!transcript.length) return 0;
    persistedSessionIdsRef.current.add(session.sessionId);
    onPersistMessagesRef.current(transcript);
    return transcript.length;
  }, []);

  useEffect(() => {
    if (conversation.status === 'ended') {
      const count = persistTranscript(conversation.session || lastSessionRef.current);
      if (count) setSavedCount(count);
    }
  }, [conversation.session, conversation.status, persistTranscript]);

  useEffect(() => () => {
    persistTranscript(lastSessionRef.current);
  }, [persistTranscript]);

  const start = async () => {
    if (starting || conversation.status === 'connecting') return;
    setStarting(true);
    setError('');
    setSavedCount(null);
    try {
      const sessionToken = await createVoiceSession({
        roleId,
        modelConfigId,
        conversationId,
        userProfileId,
        voiceId,
      });
      await conversation.startSession({ sessionToken });
    } catch (cause) {
      setError(readableError(cause));
    } finally {
      setStarting(false);
    }
  };

  const end = async () => {
    setError('');
    const session = conversation.session || lastSessionRef.current;
    try {
      await conversation.endSession();
      const count = persistTranscript(session);
      if (count) setSavedCount(count);
    } catch (cause) {
      setError(readableError(cause));
    }
  };

  const close = async () => {
    if (['connecting', 'connected', 'reconnecting'].includes(conversation.status)) await end();
    persistTranscript(conversation.session || lastSessionRef.current);
    onClose();
  };

  const toggleMute = async () => {
    try {
      await conversation.setMicMuted(!conversation.micMuted);
    } catch (cause) {
      setError(readableError(cause));
    }
  };

  const sendTextMessage = () => {
    const text = textMessage.trim();
    if (!text || conversation.status !== 'connected') return;
    if (conversation.isSpeaking) conversation.interrupt();
    conversation.sendUserMessage(text, { audio: true });
    setTextMessage('');
  };

  const active = ['connecting', 'connected', 'reconnecting'].includes(conversation.status);
  const displayState = conversation.status === 'connected' ? conversation.mode : conversation.status;

  const startButtonLabel = starting ? '正在准备通话' : conversation.status === 'ended' ? '再次通话' : '开始通话';

  return <div className="fixed inset-0 z-[100] bg-black/45 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={`与${title}通话`}>
    <section className="relative flex h-[92dvh] w-full flex-col overflow-visible rounded-t-3xl bg-base-100 shadow-2xl sm:mt-12 sm:h-[min(82dvh,760px)] sm:max-w-lg sm:rounded-3xl">
      <div className="absolute -top-10 left-1/2 z-10 -translate-x-1/2 rounded-full bg-base-100 p-1.5 shadow-lg">
        <Avatar name={title} avatar={avatar} size="2xl" showRing={active} />
      </div>
      <button className="btn btn-circle btn-ghost btn-sm absolute right-4 top-4 z-20" onClick={() => void close()} aria-label="关闭通话" title="关闭通话"><X size={20} /></button>

      <header className="shrink-0 px-14 pb-3 pt-16 text-center">
        <h2 className="truncate text-lg font-semibold">{title}</h2>
        <p className="mt-0.5 text-xs opacity-55">{savedCount === null ? (active ? '实时语音已连接' : 'Floaty Agent') : `已保存 ${savedCount} 条通话记录`}</p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col px-5" aria-live="polite">
        <div className="shrink-0 text-center">
          <VoiceAurora input={audioLevels.input} output={audioLevels.output} mode={conversation.mode} muted={conversation.micMuted} active={active} />
          <p className="mt-2 text-lg font-semibold">{conversation.micMuted ? '麦克风已静音' : stateLabels[displayState as keyof typeof stateLabels] || displayState}</p>
          <div className="mt-3 flex justify-center gap-3">
            {!active
              ? <button className="btn btn-circle btn-primary btn-lg" onClick={() => void start()} disabled={starting} aria-label={startButtonLabel} title={startButtonLabel}><Phone size={22} /></button>
              : <>
                <button className={`btn btn-circle ${conversation.micMuted ? 'btn-primary' : 'btn-ghost bg-base-200'}`} onClick={() => void toggleMute()} disabled={conversation.status !== 'connected'} aria-label={conversation.micMuted ? '取消静音' : '静音'} title={conversation.micMuted ? '取消静音' : '静音'}>{conversation.micMuted ? <MicOff size={20} /> : <Mic size={20} />}</button>
                <button className="btn btn-circle btn-ghost bg-base-200" onClick={() => conversation.interrupt()} disabled={conversation.status !== 'connected' || !conversation.isSpeaking} aria-label="打断 Agent" title="打断 Agent"><Square size={17} /></button>
                <button className="btn btn-circle btn-error" onClick={() => void end()} aria-label="挂断" title="挂断"><PhoneOff size={20} /></button>
              </>}
            {active && <button className="btn btn-circle btn-ghost bg-base-200" onClick={() => void conversation.startAudio().catch(cause => setError(readableError(cause)))} aria-label="开启声音播放" title="听不到声音时点击"><Volume2 size={20} /></button>}
          </div>
        </div>

        {error && <div role="alert" className="alert alert-warning mt-3 shrink-0 text-sm">{error}</div>}
        <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto rounded-2xl border border-base-300 p-3">
          {!messages.length && <p className="opacity-50 text-sm">接通后，双方的实时转录会显示在这里。</p>}
          {messages.map(message => <div key={message.key} className={`rounded-xl p-2.5 ${message.role === 'user' ? 'bg-primary/10' : 'bg-base-200'}`}>
            <p className="mb-1 text-xs opacity-50">{message.role === 'user' ? '你' : title}{message.final ? '' : ' · 输入中'}</p>
            <p className="whitespace-pre-wrap text-sm">{message.text}</p>
          </div>)}
        </div>
      </div>

      <footer className="mt-3 flex shrink-0 gap-2 border-t border-base-300/70 bg-base-100 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 sm:rounded-b-3xl">
        <input
          className="input input-bordered min-w-0 flex-1"
          value={textMessage}
          onChange={event => setTextMessage(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendTextMessage(); } }}
          placeholder={conversation.status === 'connected' ? '输入文字…' : '接通后可输入文字'}
          disabled={conversation.status !== 'connected'}
        />
        <button className="btn btn-circle btn-primary shrink-0" onClick={sendTextMessage} disabled={conversation.status !== 'connected' || !textMessage.trim()} aria-label="发送文字消息" title="发送文字消息"><Send size={19} /></button>
      </footer>
    </section>
  </div>;
}
