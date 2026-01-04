import React from 'react';
import { usePageContext } from '@/hooks/usePageContext';
import RoleSelector from './RoleSelector';

const RoleListPage: React.FC = () => {
  const { className } = usePageContext();
  return <RoleSelector className={className} />;
};

export default RoleListPage;