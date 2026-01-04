import React from 'react';
import { cn } from '@/lib/utils';

interface AudioWaveformProps {
  className?: string;
}

const AudioWaveform: React.FC<AudioWaveformProps> = ({ className }) => {
  return (
    <div className={cn("flex items-end gap-0.5 h-4 w-6", className)}>
      {/* 生成5个波纹条 */}
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className={cn(
            "bg-primary rounded-sm w-0.5 h-full",
            "animate-scale-y"
          )}
          style={{
            animationDelay: `${index * 0.15}s`,
            animationDuration: `${0.6 + Math.random() * 0.4}s`,
          }}
        />
      ))}
    </div>
  );
};

export default AudioWaveform;