import React from 'react';

// 创建 Context 用于传递拖拽绑定
export const DragContext = React.createContext<{ bind: any; requestClose: any }>({ bind: () => ({}), requestClose: () => {} });
