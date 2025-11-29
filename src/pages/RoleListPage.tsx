import React from 'react';
import { usePageContext } from '../hooks/usePageContext';
import RoleSelector from '../components/RoleSelector';

const RoleListPage: React.FC = () => {
  const { className } = usePageContext();
  return <RoleSelector className={className} />;
};

export default RoleListPage;