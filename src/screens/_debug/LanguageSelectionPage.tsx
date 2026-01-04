import React from 'react';
import { BackButton, useNav } from '@/components/navigation/MobileNav';
import { Globe, Check, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePageContext } from '@/hooks/usePageContext';

interface LanguageSelectionPageProps {
  currentLanguage?: string;
  onSelect?: (language: string) => void;
}

const languages = [
  { code: 'en', label: 'English' },
  { code: 'zh', label: '简体中文' },
  { code: 'ja', label: '日本語' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
];

const LanguageSelectionPage: React.FC<LanguageSelectionPageProps> = ({ 
  currentLanguage = 'English', 
  onSelect 
}) => {
  const nav = useNav();
  // Use local state to update UI immediately since props are static in navigation stack
  const [selected, setSelected] = React.useState(currentLanguage);

  const handleSelect = (lang: string) => {
    setSelected(lang);
    if (onSelect) {
      onSelect(lang);
    }
  };

  return (
    <div className="flex flex-col h-full bg-base-100">
      <div className="flex items-center justify-between p-4 border-b border-base-200">
        <BackButton>← 返回</BackButton>
        <h1 className="text-xl font-bold">选择语言</h1>
        <div className="w-16"></div>
      </div>
      <div className="flex-1 overflow-auto bg-base-100">
        <div className="p-4 space-y-2">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleSelect(lang.label)}
              className={`w-full text-left p-4 rounded-lg flex items-center justify-between transition-all ${
                selected === lang.label
                  ? 'bg-primary text-primary-content shadow-md'
                  : 'bg-base-200 hover:bg-base-300 text-base-content'
              }`}
            >
              <div className="flex flex-col">
                <span className="font-medium text-lg">{lang.label}</span>
                <span className={`text-xs ${selected === lang.label ? 'text-primary-content/70' : 'text-base-content/50'}`}>
                  {lang.code}
                </span>
              </div>
              {selected === lang.label && (
                <span className="text-xl font-bold">✓</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LanguageSelectionPage;
