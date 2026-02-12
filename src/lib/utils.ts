import { clsx, type ClassValue } from "clsx"
import { Capacitor } from '@capacitor/core'
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 统一获取后端 API 基址
// 优先使用环境变量 VITE_API_BASE_URL；开发环境回退到本地 local-server；
// 生产环境若未配置则返回空字符串（同源），在 iOS/Capacitor 中请务必配置。
export function getApiBaseUrl(): string {
  // 开发环境优先使用本地服务
  if ((import.meta as any).env?.DEV) {
    return "http://localhost:3001";
  }
  
  const envBase = (import.meta as any).env?.VITE_API_BASE_URL as string | undefined;
  if (envBase && envBase.trim()) {
    return envBase.trim().replace(/\/$/, "");
  }
  
  return "";
}

// 检测是否在 Capacitor iOS 环境中运行
export function isCapacitorIOS(): boolean {
  try {
    // Capacitor 平台检测：仅在原生 iOS 上返回 true
    return Capacitor && Capacitor.getPlatform() === 'ios';
  } catch {
    return false;
  }
}

export function isMobile(): boolean {
  return window.innerWidth < 1024;
}
