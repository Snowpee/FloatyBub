/**
 * 模板替换工具函数
 * 用于替换文本中的占位符，如 {{user}} 和 {{char}}
 */

/**
 * 替换文本中的模板占位符
 * @param text 要处理的文本
 * @param userName 用户名称，用于替换 {{user}}
 * @param charName 角色名称，用于替换 {{char}}
 * @returns 替换后的文本
 */
export const replaceTemplateVariables = (
  text: string,
  userName: string = '用户',
  charName: string = 'AI助手'
): string => {
  if (!text) return text;
  
  return text
    .replace(/\{\{user\}\}/gi, userName)
    .replace(/\{\{char\}\}/gi, charName);
};

/**
 * 替换数组中所有字符串元素的模板变量
 * @param arr 要处理的数组
 * @param userName 用户名
 * @param charName 角色名
 * @returns 处理后的数组
 */
export function replaceTemplateVariablesInArray(
  arr: any[],
  userName: string,
  charName: string
): any[] {
  return arr.map(item => {
    if (typeof item === 'string') {
      return replaceTemplateVariables(item, userName, charName);
    } else if (Array.isArray(item)) {
      return replaceTemplateVariablesInArray(item, userName, charName);
    } else if (typeof item === 'object' && item !== null) {
      return replaceTemplateVariablesInObject(item, userName, charName);
    }
    return item;
  });
}

/**
 * 替换对象中所有字符串属性的模板占位符
 * @param obj 要处理的对象
 * @param userName 用户名称
 * @param charName 角色名称
 * @returns 替换后的对象
 */
export const replaceTemplateVariablesInObject = <T extends Record<string, any>>(
  obj: T,
  userName: string = '用户',
  charName: string = 'AI助手'
): T => {
  const result = { ...obj };
  
  for (const key in result) {
    if (typeof result[key] === 'string') {
      (result as any)[key] = replaceTemplateVariables(result[key], userName, charName);
    } else if (Array.isArray(result[key])) {
      (result as any)[key] = result[key].map((item: any) => 
        typeof item === 'string' 
          ? replaceTemplateVariables(item, userName, charName)
          : item
      );
    } else if (result[key] && typeof result[key] === 'object') {
      (result as any)[key] = replaceTemplateVariablesInObject(result[key], userName, charName);
    }
  }
  
  return result;
};