import React from 'react';
import { FileX } from 'lucide-react';

interface EmptyStateProps {
  message?: string;
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ 
  message,
  className = "text-center py-12" 
}) => {
  return (
    <div className={className}>
      <FileX className="h-12 w-12 text-base-content/40 mx-auto mb-4 fill-gray-50" />
      <h3 className="text-lg font-medium text-base-content mb-2 text-base-content/60">
        暂无内容
      </h3>
      {message && (
        <p className="text-base-content/60">
          {message}
        </p>
      )}
    </div>
  );
};

export default EmptyState;