import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  FishAgentError,
  useAgentMessages,
  useAudioLevels,
  useConversation,
  type AgentSession,
} from '@fishaudio/agent-react';
import { CircleCheck, MessageCircle, Mic, MicOff, Phone, Send, Square, Volume2, X } from 'lucide-react';
import { createVoiceSession } from '@/services/voice/pilot';
import Avatar from '@/components/Avatar';
import VoiceCallModal from './VoiceCallModal';
import SoftAurora from '@/components/SoftAurora';
import VoiceAvatarAura from '@/components/VoiceAvatarAura';
import VoiceMessageText from '@/components/VoiceMessageText';

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

function CallCloseButton({ requestClose }: { requestClose: () => void }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const close = requestClose;

  useEffect(() => {
    const previousFocus = document.activeElement;
    // Avoid focusing an offscreen sheet during its mobile entrance.
    if (window.innerWidth >= 768) buttonRef.current?.focus({ preventScroll: true });
    return () => {
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [close]);

  return <button
    ref={buttonRef}
    type="button"
    className="btn btn-circle btn-ghost absolute left-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-20 md:left-auto md:right-3 md:top-3"
    onPointerDown={event => event.stopPropagation()}
    onClick={close}
    aria-label="关闭通话界面"
    title="关闭通话界面"
  ><X size={22} /></button>;
}

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
  const closeHandledRef = useRef(false);
  const messages = useAgentMessages(conversation.session);
  const audioLevels = useAudioLevels(conversation.session, 30);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [textMessage, setTextMessage] = useState('');
  const [, setSavedCount] = useState<number | null>(null);
  const [needsAudioUnlock, setNeedsAudioUnlock] = useState(false);
  const [textChatOpen, setTextChatOpen] = useState(false);
  const [showConnectedNotice, setShowConnectedNotice] = useState(false);
  const [hangupIconReady, setHangupIconReady] = useState(false);
  const messageScrollRef = useRef<HTMLDivElement>(null);
  const messageContentRef = useRef<HTMLDivElement>(null);
  const followMessagesRef = useRef(true);
  const mutedForTextRef = useRef(false);
  const textInputRef = useRef<HTMLInputElement>(null);
  const connectionAttemptRef = useRef(0);
  const connectionAbortRef = useRef<AbortController | null>(null);
  const lastSessionRef = useRef<AgentSession | null>(null);
  const persistedSessionIdsRef = useRef(new Set<string>());
  const onPersistMessagesRef = useRef(onPersistMessages);
  const visibleMessagesRef = useRef(messages);

  useLayoutEffect(() => {
    const viewport = messageScrollRef.current;
    const content = messageContentRef.current;
    if (!viewport || !content) return;
    const follow = () => {
      if (followMessagesRef.current) viewport.scrollTop = viewport.scrollHeight;
    };
    follow();
    const observer = new ResizeObserver(follow);
    observer.observe(content);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [messages, showConnectedNotice, conversation.status]);

  useEffect(() => {
    followMessagesRef.current = true;
  }, [conversation.session]);

  useEffect(() => {
    onPersistMessagesRef.current = onPersistMessages;
  }, [onPersistMessages]);

  useEffect(() => {
    visibleMessagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (!textChatOpen) return;
    const frame = requestAnimationFrame(() => textInputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [textChatOpen]);

  useEffect(() => {
    if (conversation.session) lastSessionRef.current = conversation.session;
  }, [conversation.session]);

  useEffect(() => {
    if (conversation.status === 'connecting' || conversation.status === 'reconnecting') {
      setShowConnectedNotice(false);
      return;
    }
    if (conversation.status !== 'connected') return;
    setShowConnectedNotice(true);
    const timer = window.setTimeout(() => setShowConnectedNotice(false), 1800);
    return () => window.clearTimeout(timer);
  }, [conversation.status]);

  useEffect(() => {
    const callInProgress = starting || ['connecting', 'connected', 'reconnecting'].includes(conversation.status);
    if (!callInProgress) {
      setHangupIconReady(false);
      return;
    }
    const frame = requestAnimationFrame(() => setHangupIconReady(true));
    return () => cancelAnimationFrame(frame);
  }, [conversation.status, starting]);

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
    connectionAttemptRef.current += 1;
    connectionAbortRef.current?.abort();
    persistTranscript(lastSessionRef.current);
  }, [persistTranscript]);

  const start = async () => {
    if (starting || conversation.status === 'connecting') return;
    const attempt = connectionAttemptRef.current + 1;
    connectionAttemptRef.current = attempt;
    connectionAbortRef.current?.abort();
    const controller = new AbortController();
    connectionAbortRef.current = controller;
    setStarting(true);
    setError('');
    setSavedCount(null);
    setNeedsAudioUnlock(false);
    try {
      const sessionToken = await createVoiceSession({
        roleId,
        modelConfigId,
        conversationId,
        userProfileId,
        voiceId,
      }, controller.signal);
      if (controller.signal.aborted || connectionAttemptRef.current !== attempt) return;
      await conversation.startSession({ sessionToken });
      if (controller.signal.aborted || connectionAttemptRef.current !== attempt) {
        await conversation.endSession().catch(() => undefined);
        return;
      }
      try {
        await conversation.startAudio();
      } catch {
        if (controller.signal.aborted || connectionAttemptRef.current !== attempt) return;
        // Safari/iOS may require a second, direct user gesture for playback.
        setNeedsAudioUnlock(true);
      }
    } catch (cause) {
      if (controller.signal.aborted || connectionAttemptRef.current !== attempt) return;
      setError(readableError(cause));
    } finally {
      if (connectionAttemptRef.current === attempt) {
        connectionAbortRef.current = null;
        setStarting(false);
      }
    }
  };

  const end = async () => {
    connectionAttemptRef.current += 1;
    connectionAbortRef.current?.abort();
    connectionAbortRef.current = null;
    setStarting(false);
    setError('');
    setNeedsAudioUnlock(false);
    setTextChatOpen(false);
    mutedForTextRef.current = false;
    const session = conversation.session || lastSessionRef.current;
    try {
      if (conversation.session || ['connecting', 'connected', 'reconnecting'].includes(conversation.status)) {
        await conversation.endSession();
      }
      const count = persistTranscript(session);
      if (count) setSavedCount(count);
    } catch (cause) {
      setError(readableError(cause));
    }
  };

  // BottomSheetModal invokes this after its own exit animation. Unmount now;
  // do not keep isOpen=true while awaiting asynchronous session teardown.
  const close = () => {
    if (closeHandledRef.current) return;
    closeHandledRef.current = true;
    connectionAttemptRef.current += 1;
    connectionAbortRef.current?.abort();
    persistTranscript(conversation.session || lastSessionRef.current);
    onClose();
    // useConversation releases the session on unmount.
  };

  const { status: audioStatus, startAudio: resumeAudio } = conversation;
  useEffect(() => {
    if (audioStatus !== 'connected') return;
    const resume = () => {
      if (document.hidden) return;
      void resumeAudio().catch(() => setNeedsAudioUnlock(true));
    };
    window.addEventListener('pointerdown', resume);
    window.addEventListener('keydown', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      window.removeEventListener('pointerdown', resume);
      window.removeEventListener('keydown', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [audioStatus, resumeAudio]);

  const toggleMute = async () => {
    try {
      await conversation.setMicMuted(!conversation.micMuted);
    } catch (cause) {
      setError(readableError(cause));
    }
  };

  const unlockAudio = async () => {
    try {
      await conversation.startAudio();
      setNeedsAudioUnlock(false);
    } catch (cause) {
      setError(readableError(cause));
    }
  };

  const openTextChat = async () => {
    if (conversation.status !== 'connected') return;
    mutedForTextRef.current = !conversation.micMuted;
    if (!conversation.micMuted) {
      try {
        await conversation.setMicMuted(true);
      } catch (cause) {
        setError(readableError(cause));
        return;
      }
    }
    setTextChatOpen(true);
  };

  const closeTextChat = async () => {
    setTextChatOpen(false);
    if (mutedForTextRef.current && conversation.status === 'connected') {
      try {
        await conversation.setMicMuted(false);
      } catch (cause) {
        setError(readableError(cause));
      }
    }
    mutedForTextRef.current = false;
  };

  const sendTextMessage = () => {
    const text = textMessage.trim();
    if (!text || conversation.status !== 'connected') return;
    if (conversation.isSpeaking) conversation.interrupt();
    followMessagesRef.current = true;
    conversation.sendUserMessage(text, { audio: true });
    setTextMessage('');
  };

  const active = ['connecting', 'connected', 'reconnecting'].includes(conversation.status);
  const callInProgress = starting || active;
  const connectionPending = conversation.status === 'connecting'
    || conversation.status === 'reconnecting'
    || (starting && conversation.status !== 'connected');
  const startButtonLabel = starting ? '正在准备通话' : conversation.status === 'ended' ? '再次通话' : '开始通话';
  const connected = conversation.status === 'connected';
  // Playback can outlast the transcript's speaking mode. Always meter output.
  const output = Number.isFinite(audioLevels.output) ? Math.max(0, audioLevels.output) : 0;
  const agentLevel = connected && !needsAudioUnlock
    ? Math.min(1, Math.pow(Math.max(0, output - 0.002) * 9, 0.7))
    : 0;
  const userLevel = active && !conversation.micMuted ? Math.min(1, audioLevels.input * 7) : 0;

  return <VoiceCallModal onClose={close}>
    {({ bind, requestClose }) => <section
      className="relative flex h-full w-full flex-col overflow-hidden bg-base-100"
      role="dialog"
      aria-modal="true"
      aria-label={`与${title}通话`}
    >
      <CallCloseButton requestClose={requestClose} />
      <div className="absolute inset-x-0 bottom-0 z-0 h-32 pointer-events-none">
        <SoftAurora className="block h-full w-full" active={connected} intensity={agentLevel} />
      </div>

      <header {...bind()} className="relative z-10 shrink-0 touch-none pt-[calc(env(safe-area-inset-top)+3.5rem)] text-center md:pt-14">
        <div className="relative isolate mx-auto h-24 w-24">
          {connected && <VoiceAvatarAura intensity={agentLevel} />}
          <Avatar name={title} avatar={avatar} size="2xl" className="relative z-10 rounded-full ring-4 ring-base-100" />
        </div>
        <h2 className="mt-3 truncate px-10 text-base font-semibold">{title}</h2>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col pb-[calc(1.25rem+env(safe-area-inset-bottom))]" aria-live="polite">
        {!active ? <>
          <div className="flex flex-1 items-center justify-center px-10">
            {starting
              ? <div className="flex flex-col items-center gap-4 text-primary">
                <span className="loading loading-spinner loading-lg" aria-hidden="true" />
                <p className="text-base font-semibold">正在接通…</p>
                <p className="text-xs text-base-content/45">正在建立实时语音连接</p>
              </div>
              : <p className="text-base opacity-45">{conversation.status === 'ended' ? '通话已结束，可以再次拨打' : '一切就绪，准备通话'}</p>}
          </div>
          {error && <div role="alert" className="alert alert-warning mx-10 mb-4 text-sm">{error}</div>}
          <div className="mb-24 flex justify-center">
            <button
              className={`btn btn-circle btn-xl border-0 text-white shadow-lg ${callInProgress ? 'bg-error hover:bg-error/90' : 'bg-primary hover:bg-primary/90'}`}
              onClick={() => void (callInProgress ? end() : start())}
              aria-label={callInProgress ? '取消并挂断' : startButtonLabel}
              title={callInProgress ? '取消并挂断' : startButtonLabel}
            >
              <Phone size={28} className={`transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${hangupIconReady ? 'rotate-[135deg]' : 'rotate-0'}`} />
            </button>
          </div>
        </> : <>
          <div
            ref={messageScrollRef}
            className="mt-5 min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain [overflow-anchor:none]"
            onScroll={event => {
              const viewport = event.currentTarget;
              followMessagesRef.current = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 32;
            }}
          >
            <div ref={messageContentRef} className="flex min-h-full flex-col px-10 pb-4">
            {connectionPending ? <div className="flex flex-1 flex-col items-center justify-center gap-4 text-primary">
              <span className="loading loading-spinner loading-lg" aria-hidden="true" />
              <p className="text-base font-semibold">{conversation.status === 'reconnecting' ? '正在重新连接…' : '正在接通…'}</p>
              <p className="text-xs text-base-content/45">请稍候，正在建立实时语音连接</p>
            </div> : showConnectedNotice ? <div className="flex flex-1 flex-col items-center justify-center gap-3 text-success">
              <CircleCheck size={44} strokeWidth={1.8} aria-hidden="true" />
              <p className="text-lg font-semibold">已接通</p>
              <p className="text-xs text-base-content/45">现在可以开始说话</p>
            </div> : <div className="space-y-3">
              {!messages.length && <p className="pt-8 text-center text-sm opacity-40">已接通，正在等待对话…</p>}
              {messages.map(message => <div key={message.key} className={message.role === 'user' ? 'flex justify-end' : ''}>
              <div className={message.role === 'user'
                ? 'max-w-[78%] rounded-2xl rounded-br-sm bg-primary/12 px-4 py-2.5 text-sm'
                : 'max-w-[92%] px-1 py-1 text-sm leading-relaxed'}>
                <VoiceMessageText text={message.text} />
              </div>
              </div>)}
            </div>}
            </div>
          </div>

          {error && <div role="alert" className="alert alert-warning mx-10 mb-3 shrink-0 text-sm">{error}</div>}
          {needsAudioUnlock && <button className="btn btn-warning btn-sm mx-auto mb-3 shrink-0" onClick={() => void unlockAudio()}><Volume2 size={17} />恢复声音</button>}

          <div className="relative mx-10 h-[9em] shrink-0">
            <div className={`absolute inset-0 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${textChatOpen ? 'pointer-events-none translate-y-8 scale-95 opacity-0' : 'translate-y-0 scale-100 opacity-100'}`} aria-hidden={textChatOpen}>
              <div className="flex items-center justify-center gap-8">
              <button className="btn btn-circle btn-xl btn-ghost bg-base-200/85" onClick={() => void toggleMute()} disabled={conversation.status !== 'connected'} aria-label={conversation.micMuted ? '取消静音' : '静音'} title={conversation.micMuted ? '取消静音' : '静音'}>{conversation.micMuted ? <MicOff size={20} /> : <Mic size={20} />}</button>
              <div className="rounded-full p-2 transition-[background-color,box-shadow] duration-100" style={{
                backgroundColor: `rgb(56 189 248 / ${0.1 + userLevel * 0.28})`,
                boxShadow: `0 0 ${10 + userLevel * 25}px ${3 + userLevel * 11}px rgb(56 189 248 / ${0.16 + userLevel * 0.26})`,
              }}>
                <button className="btn btn-circle btn-xl relative border-0 bg-error text-white hover:bg-[#e94600]" onClick={() => void end()} aria-label={connectionPending ? '取消并挂断' : '挂断'} title={connectionPending ? '取消并挂断' : '挂断'}>
                  <Phone
                    size={24}
                    className={`transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${hangupIconReady ? 'rotate-[135deg]' : 'rotate-0'}`}
                  />
                </button>
              </div>
              <button className="btn btn-circle  btn-xl btn-ghost bg-base-200/85" onClick={() => conversation.interrupt()} disabled={conversation.status !== 'connected' || !conversation.isSpeaking} aria-label="打断 Agent" title="打断 Agent"><Square size={17} fill="currentColor" /></button>
              </div>
              <div className="mt-4 flex justify-center">
                <button className="flex w-14 btn items-center justify-center rounded-full border border-white/75 bg-white/30 p-0 text-white shadow-sm backdrop-blur-md transition-transform duration-200 hover:scale-105 active:scale-95" onClick={() => void openTextChat()} aria-label="输入文字" title="输入文字"><MessageCircle size={23} fill="currentColor" /></button>
              </div>
            </div>

            <div className={`absolute inset-0 pt-12 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${textChatOpen ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none translate-y-8 scale-[0.98] opacity-0'}`} aria-hidden={!textChatOpen}>
              <button className={`absolute left-0 top-0 btn btn-circle btn-sm border-0 bg-white/75 text-primary shadow-sm backdrop-blur-md transition-all delay-100 duration-300 ${textChatOpen ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'}`} onClick={() => void closeTextChat()} tabIndex={textChatOpen ? 0 : -1} aria-label="返回语音控制" title="返回语音控制"><Phone size={17} fill="currentColor" /></button>
              <div className="flex h-12 items-center gap-2 rounded-full bg-white/90 p-1.5 pl-5 shadow-sm ring-1 ring-base-300/70 backdrop-blur-md">
              <input
                ref={textInputRef}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:opacity-45"
                value={textMessage}
                onChange={event => setTextMessage(event.target.value)}
                onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendTextMessage(); } }}
                placeholder="输入文字…"
                tabIndex={textChatOpen ? 0 : -1}
              />
                <button className="btn btn-circle btn-primary btn-sm shrink-0" onClick={sendTextMessage} disabled={!textMessage.trim()} tabIndex={textChatOpen ? 0 : -1} aria-label="发送文字消息" title="发送文字消息"><Send size={17} /></button>
              </div>
            </div>
          </div>
        </>}
      </div>
    </section>}
  </VoiceCallModal>;
}
