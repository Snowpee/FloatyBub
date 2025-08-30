/**
 * 获取不同AI提供商的默认Base URL
 * @param provider 提供商名称
 * @returns 默认的Base URL
 */
export const getDefaultBaseUrl = (provider: string): string => {
  switch (provider) {
    case 'openai':
      return 'https://api.openai.com';
    case 'claude':
      return 'https://api.anthropic.com';
    case 'gemini':
      return 'https://generativelanguage.googleapis.com';
    case 'kimi':
      return 'https://api.moonshot.cn';
    case 'deepseek':
      return 'https://api.deepseek.com';
    case 'openrouter':
      return 'https://openrouter.ai/api';
    default:
      return 'https://api.openai.com';
  }
};