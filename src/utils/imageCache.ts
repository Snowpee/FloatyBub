// 通用图片缓存管理工具

interface ImageMetadata {
  width?: number;
  height?: number;
  format?: string;
  size?: number;
}

class ImageCache {
  private cache = new Map<string, boolean>();
  private loadingPromises = new Map<string, Promise<boolean>>();

  /**
   * 预加载图片
   */
  async preloadImage(url: string): Promise<boolean> {
    if (!url) return false;
    
    // 如果已经缓存，直接返回
    if (this.cache.has(url)) {
      return this.cache.get(url)!;
    }

    // 如果正在加载，返回现有的Promise
    if (this.loadingPromises.has(url)) {
      return this.loadingPromises.get(url)!;
    }

    // 创建新的加载Promise
    const loadPromise = new Promise<boolean>((resolve) => {
      const img = new Image();
      
      // 设置加载超时
      const timeout = setTimeout(() => {
        this.cache.set(url, false);
        this.loadingPromises.delete(url);
        resolve(false);
      }, 10000); // 10秒超时
      
      img.onload = () => {
        clearTimeout(timeout);
        this.cache.set(url, true);
        this.loadingPromises.delete(url);
        resolve(true);
      };
      
      img.onerror = () => {
        clearTimeout(timeout);
        this.cache.set(url, false);
        this.loadingPromises.delete(url);
        resolve(false);
      };
      
      // 移除crossOrigin设置以允许浏览器缓存
      // crossOrigin='anonymous'会阻止浏览器缓存图片
      // 设置图片src，浏览器会自动处理缓存
      img.src = url;
    });

    this.loadingPromises.set(url, loadPromise);
    return loadPromise;
  }

  /**
   * 检查图片是否已缓存
   */
  isCached(url: string): boolean {
    return this.cache.has(url) && this.cache.get(url) === true;
  }

  /**
   * 批量预加载图片
   */
  async preloadImages(urls: string[]): Promise<void> {
    const promises = urls.filter(url => url && !this.isCached(url))
                        .map(url => this.preloadImage(url));
    await Promise.allSettled(promises);
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
    this.loadingPromises.clear();
  }

  /**
   * 获取缓存状态
   */
  getCacheStatus(): { total: number; loaded: number; failed: number } {
    let loaded = 0;
    let failed = 0;
    
    for (const success of this.cache.values()) {
      if (success) loaded++;
      else failed++;
    }
    
    return {
      total: this.cache.size,
      loaded,
      failed
    };
  }

  /**
   * 获取图片元数据
   */
  async getImageMetadata(url: string): Promise<ImageMetadata | null> {
    return new Promise((resolve) => {
      const img = new Image();
      
      img.onload = () => {
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight,
          format: this.getImageFormat(url) || undefined
        });
      };
      
      img.onerror = () => {
        resolve(null);
      };
      
      img.src = url;
    });
  }

  /**
   * 验证图片格式
   */
  isValidImageFormat(url: string): boolean {
    const validFormats = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
    const format = this.getImageFormat(url);
    return format ? validFormats.includes(format) : false;
  }

  /**
   * 获取图片格式
   */
  private getImageFormat(url: string): string | null {
    const match = url.match(/\.([a-zA-Z0-9]+)(?:[?#]|$)/);
    return match ? `.${match[1].toLowerCase()}` : null;
  }
}

// 全局图片缓存实例
export const imageCache = new ImageCache();

// 向后兼容：头像缓存别名
export const avatarCache = imageCache;

// 通用图片预加载Hook
export function useImagePreload(imageUrl?: string) {
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);
  const [metadata, setMetadata] = React.useState<ImageMetadata | null>(null);

  React.useEffect(() => {
    if (!imageUrl) {
      setIsLoaded(false);
      setIsLoading(false);
      setHasError(false);
      setMetadata(null);
      return;
    }

    // 检查是否已缓存
    if (imageCache.isCached(imageUrl)) {
      setIsLoaded(true);
      setIsLoading(false);
      setHasError(false);
      // 异步获取元数据
      imageCache.getImageMetadata(imageUrl).then(setMetadata);
      return;
    }

    setIsLoading(true);
    setHasError(false);

    Promise.all([
      imageCache.preloadImage(imageUrl),
      imageCache.getImageMetadata(imageUrl)
    ])
      .then(([success, meta]) => {
        setIsLoaded(success);
        setHasError(!success);
        setMetadata(meta);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [imageUrl]);

  return { isLoaded, isLoading, hasError, metadata };
}

// 向后兼容：头像预加载Hook别名
export function useAvatarPreload(avatarUrl?: string) {
  const result = useImagePreload(avatarUrl);
  // 返回原有的接口，不包含metadata
  return {
    isLoaded: result.isLoaded,
    isLoading: result.isLoading,
    hasError: result.hasError
  };
}

// React import for the hook
import React from 'react';