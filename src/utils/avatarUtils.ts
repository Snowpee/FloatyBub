// 头像工具函数

// 生成随机背景颜色
const generateRandomColor = (seed: string): string => {
  // 使用角色名作为种子生成一致的颜色
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // 预定义的颜色调色板，确保颜色对比度和美观性
  const colors = [
    '#FF6B6B', // 红色
    '#4ECDC4', // 青色
    '#45B7D1', // 蓝色
    '#96CEB4', // 绿色
    '#FFEAA7', // 黄色
    '#DDA0DD', // 紫色
    '#98D8C8', // 薄荷绿
    '#F7DC6F', // 金黄色
    '#BB8FCE', // 淡紫色
    '#85C1E9', // 天蓝色
    '#F8C471', // 橙色
    '#82E0AA'  // 浅绿色
  ];
  
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

// 获取角色名首字母
const getInitials = (name: string): string => {
  if (!name) return 'A';
  
  // 处理中文和英文名称
  const trimmedName = name.trim();
  if (!trimmedName) return 'A';
  
  // 如果是中文，取第一个字符
  if (/[\u4e00-\u9fa5]/.test(trimmedName[0])) {
    return trimmedName[0];
  }
  
  // 如果是英文，取首字母并转为大写
  const words = trimmedName.split(/\s+/);
  if (words.length === 1) {
    return words[0][0].toUpperCase();
  }
  
  // 多个单词取前两个单词的首字母
  return (words[0][0] + (words[1] ? words[1][0] : '')).toUpperCase();
};

// 生成头像数据
export const generateAvatar = (name: string): {
  initials: string;
  backgroundColor: string;
  textColor: string;
} => {
  const initials = getInitials(name);
  const backgroundColor = generateRandomColor(name);
  
  // 根据背景颜色亮度决定文字颜色
  const getTextColor = (bgColor: string): string => {
    // 移除 # 号
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // 计算亮度
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    
    // 亮度大于128使用深色文字，否则使用浅色文字
    return brightness > 128 ? '#000000' : '#FFFFFF';
  };
  
  return {
    initials,
    backgroundColor,
    textColor: getTextColor(backgroundColor)
  };
};

// 检查是否为有效的图片URL或base64
export const isValidImageUrl = (url: string): boolean => {
  if (!url) return false;
  
  // 检查是否为base64图片
  if (url.startsWith('data:image/')) {
    return true;
  }
  
  // 检查是否为有效的URL
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// 将文件转换为base64
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert file to base64'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

// 验证图片文件
export const validateImageFile = (file: File): { valid: boolean; error?: string } => {
  // 检查文件类型
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: '只支持 JPEG、PNG、GIF 和 WebP 格式的图片'
    };
  }
  
  // 检查文件大小 (限制为5MB)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    return {
      valid: false,
      error: '图片大小不能超过 5MB'
    };
  }
  
  return { valid: true };
};