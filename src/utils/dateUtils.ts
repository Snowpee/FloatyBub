
export const getLastActiveTime = (session: any) => {
  if (!session) return 0;
  
  // 如果有消息，使用最后一条消息的时间
  if (session.messages && session.messages.length > 0) {
    const lastMessage = session.messages[session.messages.length - 1];
    
    // 优先使用 message_timestamp (与 HistoryContent 保持一致)
    // HistoryContent 逻辑: message_timestamp || timestamp
    // MessageList 排序逻辑也依赖 message_timestamp
    const messageTime = lastMessage.message_timestamp || lastMessage.timestamp || lastMessage.createdAt;
    
    if (messageTime) {
      // 尝试解析为日期对象
      const t = new Date(messageTime).getTime();
      if (!isNaN(t) && t > 0) return t;
      
      // 如果是数字或数字字符串（Unix时间戳）
      const num = parseFloat(messageTime);
      if (!isNaN(num) && num > 0) {
        // 如果小于 100 亿，通常是秒级时间戳，转换为毫秒
        // 2001-09-09 是 10亿秒; 2286年是 100亿秒
        return num < 10000000000 ? num * 1000 : num;
      }
    }
  }
  
  // 否则使用会话更新时间或创建时间
  const sessionTime = session.updatedAt || session.createdAt;
  if (sessionTime) {
    const t = new Date(sessionTime).getTime();
    if (!isNaN(t)) return t;
  }
  
  return 0;
};

/**
 * 安全地格式化日期
 * @param date 日期对象、时间戳或日期字符串
 * @returns 格式化后的日期字符串 (YYYY/M/D) 或 '未知日期'
 */
export const safeFormatDate = (date: Date | string | number | null | undefined): string => {
  if (!date) return '未知日期';
  
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '未知日期';
    
    // 统一格式为 YYYY/MM/DD
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    return `${year}/${month}/${day}`;
  } catch (e) {
    return '未知日期';
  }
};
