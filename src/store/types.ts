export interface LLMConfig {
  id: string;
  name: string;
  provider: 'openai' | 'claude' | 'gemini' | 'kimi' | 'deepseek' | 'openrouter' | 'custom';
  apiKey: string;
  baseUrl?: string;
  proxyUrl?: string;
  model: string;
  temperature: number;
  maxTokens: number;
  enabled: boolean;
}

export interface AIRole {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  openingMessages?: string[];
  currentOpeningIndex?: number;
  avatar?: string;
  globalPromptId?: string;
  globalPromptIds?: string[];
  skillIds?: string[];
  voiceModelId?: string;
  isFavorite?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  id: string;
  name: string;
  description: string;
  avatar: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GlobalPrompt {
  id: string;
  title: string;
  description?: string;
  prompt: string;
  createdAt: Date;
  updatedAt: Date;
  pendingUpload?: boolean;
}

export interface AgentSkillFile {
  path: string;
  content: string;
}

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  content: string;
  files?: AgentSkillFile[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  pendingUpload?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  message_timestamp?: string;
  snowflake_id?: string;
  isStreaming?: boolean;
  pendingUpload?: boolean;
  roleId?: string;
  userProfileId?: string;
  versions?: string[];
  currentVersionIndex?: number;
  reasoningContent?: string;
  isReasoningComplete?: boolean;
  images?: string[];
}

export interface ChatSession {
  id: string;
  title: string;
  roleId: string;
  modelId: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  isHidden?: boolean;
  isPinned?: boolean;
  pendingUpload?: boolean;
  lastSyncedAt?: Date;
  activeSkillIds?: string[];
  loadedSkillFiles?: string[];
}

export interface VoiceModel {
  id: string;
  name: string;
  description?: string;
  author?: string;
  tags?: string[];
  userNote?: string;
  isPreset?: boolean;
}

export interface VoiceSettings {
  provider: 'fish-audio' | 'other';
  apiUrl: string;
  apiKey: string;
  readingMode: 'all' | 'dialogue-only';
  customModels: VoiceModel[];
  defaultVoiceModelId?: string;
  modelVersion?: string;
}

export interface SearchConfig {
  enabled: boolean;
  provider: 'google-cse';
  apiKey?: string;
  engineId?: string;
  language?: string;
  country?: string;
  safeSearch?: 'off' | 'active';
  maxResults?: number;
}

export interface AutoTitleConfig {
  enabled: boolean;
  strategy: 'follow' | 'custom';
  modelId?: string | null;
}

export interface AssistantConfig {
  enabled: boolean;
  strategy: 'follow' | 'custom';
  modelId?: string | null;
}

export interface SettingsSlice {
  theme: 'light' | 'dark' | 'cupcake' | 'floaty';
  sidebarOpen: boolean;
  chatStyle: 'conversation' | 'document';
  sendMessageShortcut: 'enter' | 'ctrlEnter';
  voiceSettings: VoiceSettings | null;
  searchConfig: SearchConfig;
  autoTitleConfig: AutoTitleConfig;
  assistantConfig: AssistantConfig;
  defaultRoleId: string | null;

  setTheme: (theme: 'light' | 'dark' | 'cupcake' | 'floaty') => void;
  toggleSidebar: () => void;
  setChatStyle: (style: 'conversation' | 'document') => void;
  setSendMessageShortcut: (shortcut: 'enter' | 'ctrlEnter') => void;
  setVoiceSettings: (settings: VoiceSettings | null) => void;
  setSearchConfig: (config: SearchConfig) => void;
  updateSearchConfig: (partial: Partial<SearchConfig>) => void;
  setAutoTitleConfig: (config: AutoTitleConfig) => void;
  updateAutoTitleConfig: (partial: Partial<AutoTitleConfig>) => void;
  setAssistantConfig: (config: AssistantConfig) => void;
  updateAssistantConfig: (partial: Partial<AssistantConfig>) => void;
  setDefaultRoleId: (roleId: string | null) => void;
  syncGeneralSettingsFull: () => Promise<void>;
  
  exportData: () => string;
  importData: (data: string) => boolean;
  clearAllData: () => void;
}

export interface ChatSlice {
  chatSessions: ChatSession[];
  currentSessionId: string | null;
  tempSessionId: string | null;
  tempSession: ChatSession | null;
  sessionsNeedingTitle: Set<string>;

  createChatSession: (roleId: string, modelId: string) => string;
  createTempSession: (roleId: string, modelId: string) => string;
  saveTempSession: () => void;
  deleteTempSession: () => void;
  generateSessionTitle: (sessionId: string, llmConfig: LLMConfig) => Promise<void>;
  updateChatSession: (id: string, session: Partial<ChatSession>) => void;
  deleteChatSession: (id: string) => Promise<void>;
  hideSession: (id: string) => void;
  showSession: (id: string) => void;
  pinSession: (id: string) => void;
  unpinSession: (id: string) => void;
  setCurrentSession: (id: string) => void;
  migrateIdsToUUID: () => boolean;
  
  addMessage: (sessionId: string, message: Omit<ChatMessage, 'id'> & { id?: string }, onTempSessionSaved?: (sessionId: string) => void) => void;
  updateMessage: (sessionId: string, messageId: string, content: string, isStreaming?: boolean) => void;
  updateMessageWithReasoning: (sessionId: string, messageId: string, content?: string, reasoningContent?: string, isStreaming?: boolean, isReasoningComplete?: boolean, images?: string[]) => void;
  regenerateMessage: (sessionId: string, messageId: string) => Promise<void>;
  addMessageVersion: (sessionId: string, messageId: string, newContent: string) => void;
  addMessageVersionWithOriginal: (sessionId: string, messageId: string, originalContent: string, newContent: string, newImages?: string[]) => void;
  switchMessageVersion: (sessionId: string, messageId: string, versionIndex: number) => void;
  deleteMessage: (sessionId: string, messageId: string) => Promise<void>;
  
  markSessionNeedsTitle: (sessionId: string) => void;
  removeSessionNeedsTitle: (sessionId: string) => void;
  checkSessionNeedsTitle: (sessionId: string) => boolean;
}

export interface ConfigSlice {
  llmConfigs: LLMConfig[];
  currentModelId: string | null;
  globalPrompts: GlobalPrompt[];
  agentSkills: AgentSkill[];

  addLLMConfig: (config: Omit<LLMConfig, 'id'>) => void;
  updateLLMConfig: (id: string, config: Partial<LLMConfig>) => void;
  deleteLLMConfig: (id: string) => Promise<void>;
  setCurrentModel: (id: string) => void;
  
  addGlobalPrompt: (prompt: Omit<GlobalPrompt, 'id' | 'createdAt' | 'updatedAt'> & { id?: string, createdAt?: Date, updatedAt?: Date }, options?: { skipSync?: boolean }) => void;
  updateGlobalPrompt: (id: string, prompt: Partial<GlobalPrompt>, options?: { skipSync?: boolean }) => void;
  deleteGlobalPrompt: (id: string, options?: { skipSync?: boolean }) => Promise<void>;
  
  addAgentSkill: (skill: Omit<AgentSkill, 'id' | 'createdAt' | 'updatedAt'> & { id?: string, createdAt?: Date, updatedAt?: Date }, options?: { skipSync?: boolean }) => void;
  updateAgentSkill: (id: string, skill: Partial<AgentSkill>, options?: { skipSync?: boolean }) => void;
  deleteAgentSkill: (id: string, options?: { skipSync?: boolean }) => Promise<void>;
}

export interface RoleSlice {
  aiRoles: AIRole[];
  
  addAIRole: (role: Omit<AIRole, 'id' | 'createdAt' | 'updatedAt'>) => AIRole;
  updateAIRole: (id: string, role: Partial<AIRole>) => void;
  deleteAIRole: (id: string) => Promise<void>;
  toggleRoleFavorite: (id: string) => void;
  getFavoriteRoles: () => AIRole[];
}

export interface UserSlice {
  userRoles: UserProfile[];
  currentUserProfile: UserProfile | null;
  currentUser: any | null;

  addUserProfile: (profile: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateUserProfile: (id: string, profile: Partial<UserProfile>) => void;
  deleteUserProfile: (id: string) => Promise<void>;
  setCurrentUserProfile: (profile: UserProfile | null) => void;
  setCurrentUser: (user: any | null) => void;
}

export interface AppState extends SettingsSlice, ChatSlice, ConfigSlice, RoleSlice, UserSlice {}
