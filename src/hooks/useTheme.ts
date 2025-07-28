import { useState, useEffect } from 'react';

type Theme = 'light' | 'dark' | 'cupcake' | 'bumblebee' | 'emerald' | 'corporate' | 'synthwave' | 'retro' | 'cyberpunk' | 'valentine' | 'halloween' | 'garden' | 'forest' | 'aqua' | 'lofi' | 'pastel' | 'fantasy' | 'wireframe' | 'black' | 'luxury' | 'dracula' | 'cmyk' | 'autumn' | 'business' | 'acid' | 'lemonade' | 'night' | 'coffee' | 'winter' | 'dim' | 'nord' | 'sunset' | 'caramellatte' | 'abyss' | 'silk';

export const THEMES: { name: Theme; label: string; emoji: string }[] = [
  { name: 'light', label: '浅色', emoji: '☀️' },
  { name: 'dark', label: '深色', emoji: '🌙' },
  { name: 'cupcake', label: '纸杯蛋糕', emoji: '🧁' },
  { name: 'bumblebee', label: '大黄蜂', emoji: '🐝' },
  { name: 'emerald', label: '翡翠', emoji: '💚' },
  { name: 'corporate', label: '企业', emoji: '🏢' },
  { name: 'synthwave', label: '合成波', emoji: '🌆' },
  { name: 'retro', label: '复古', emoji: '📼' },
  { name: 'cyberpunk', label: '赛博朋克', emoji: '🤖' },
  { name: 'valentine', label: '情人节', emoji: '💝' },
  { name: 'halloween', label: '万圣节', emoji: '🎃' },
  { name: 'garden', label: '花园', emoji: '🌸' },
  { name: 'forest', label: '森林', emoji: '🌲' },
  { name: 'aqua', label: '水蓝', emoji: '🌊' },
  { name: 'lofi', label: 'Lo-Fi', emoji: '🎵' },
  { name: 'pastel', label: '粉彩', emoji: '🎨' },
  { name: 'fantasy', label: '幻想', emoji: '🦄' },
  { name: 'wireframe', label: '线框', emoji: '📐' },
  { name: 'black', label: '黑色', emoji: '⚫' },
  { name: 'luxury', label: '奢华', emoji: '💎' },
  { name: 'dracula', label: '德古拉', emoji: '🧛' },
  { name: 'cmyk', label: 'CMYK', emoji: '🖨️' },
  { name: 'autumn', label: '秋天', emoji: '🍂' },
  { name: 'business', label: '商务', emoji: '💼' },
  { name: 'acid', label: '酸性', emoji: '🧪' },
  { name: 'lemonade', label: '柠檬水', emoji: '🍋' },
  { name: 'night', label: '夜晚', emoji: '🌃' },
  { name: 'coffee', label: '咖啡', emoji: '☕' },
  { name: 'winter', label: '冬天', emoji: '❄️' },
  { name: 'dim', label: '昏暗', emoji: '🔅' },
  { name: 'nord', label: '北欧', emoji: '🏔️' },
  { name: 'sunset', label: '日落', emoji: '🌅' },
  { name: 'caramellatte', label: '焦糖拿铁', emoji: '🥛' },
  { name: 'abyss', label: '深渊', emoji: '🕳️' },
  { name: 'silk', label: '丝绸', emoji: '🪞' }
];

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme && THEMES.find(t => t.name === savedTheme)) {
      return savedTheme;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    // 移除所有主题类
    THEMES.forEach(t => {
      document.documentElement.classList.remove(t.name);
    });
    // 设置data-theme属性
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  return {
    theme,
    setTheme,
    toggleTheme,
    isDark: theme === 'dark'
  };
}