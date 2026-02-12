import { replaceTemplateVariables } from '@/utils/templateUtils';

export const tryExtractJson = (s: string) => {
  const trimmed = (s || '').trim();
  const fenceJson = trimmed.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenceJson && fenceJson[1]) return fenceJson[1].trim();
  const fenceAny = trimmed.match(/```\s*([\s\S]*?)\s*```/);
  if (fenceAny && fenceAny[1]) return fenceAny[1].trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) return trimmed.slice(start, end + 1).trim();
  return trimmed;
};

export const buildSystemMessages = (role: any, globalPrompts: any[], agentSkills: any[], userProfile: any, knowledgeContext?: string, selectedSkillIds?: string[]) => {
  const messages = [];
  
  // 获取用户名和角色名，用于模板替换
  const userName = userProfile?.name || '用户';
  const charName = role?.name || 'AI助手';
  
  // 1. 添加用户资料信息作为独立的system消息
  if (userProfile) {
    const userInfo = [`用户名：${userProfile.name}`];
    if (userProfile.description && userProfile.description.trim()) {
      userInfo.push(`用户简介：${userProfile.description.trim()}`);
    }
    messages.push({
      role: 'system',
      content: `[用户信息：${userInfo.join('，')}]`
    });
  }
  
  // 2. 添加每个全局提示词作为独立的system消息
  const promptIds = role.globalPromptIds || (role.globalPromptId ? [role.globalPromptId] : []);
  if (promptIds && promptIds.length > 0) {
    promptIds.forEach((promptId: string) => {
      const globalPrompt = globalPrompts.find((p: any) => p.id === promptId);
      if (globalPrompt && globalPrompt.prompt.trim()) {
        const processedPrompt = replaceTemplateVariables(globalPrompt.prompt.trim(), userName, charName);
        messages.push({
          role: 'system',
          content: `[全局设置：${processedPrompt}]`
        });
      }
    });
  }

  const roleSkillIds = role.skillIds || [];
  if (roleSkillIds && roleSkillIds.length > 0) {
    const enabledSkills = roleSkillIds
      .map((id: string) => agentSkills.find((s: any) => s.id === id))
      .filter((s: any) => s && s.enabled);

    const requested = Array.isArray(selectedSkillIds) ? selectedSkillIds : [];
    const useDetailed = requested.length > 0;
    const skillsToInclude = useDetailed
      ? requested.map((id: string) => enabledSkills.find((s: any) => s.id === id)).filter(Boolean)
      : enabledSkills;

    const skillsContent = skillsToInclude.map((skill: any) => {
      if (useDetailed) {
        const filesIndex = Array.isArray(skill.files) && skill.files.length > 0
          ? `\n<files>\n${skill.files.map((f: any) => `<file path="${f.path}" />`).join('\n')}\n</files>`
          : '';

        return `
<skill>
<name>${skill.name}</name>
<description>${skill.description || ''}</description>
<instructions>
${skill.content}
</instructions>${filesIndex}
</skill>`;
      }

      return `
<skill>
<name>${skill.name}</name>
<description>${skill.description || ''}</description>
</skill>`;
    }).filter(Boolean).join('\n');

    if (skillsContent) {
      messages.push({
        role: 'system',
        content: useDetailed
          ? `<available_skills>\n${skillsContent}\n</available_skills>\n\nIMPORTANT: When you use a skill to answer the user, you MUST output a tag <use_skill name="Skill Name" /> at the very beginning of your response. Replace "Skill Name" with the actual name of the skill you used.\n\nIMPORTANT: The <files> section is an index only. File contents will be provided separately when needed. If you require a file that is not provided, explicitly ask for it by path.`
          : `<available_skills>\n${skillsContent}\n</available_skills>\n\nIMPORTANT: This is a metadata-only list. Detailed skill instructions and files will be provided only when required.`
      });
    }
  }
  
  // 4. 添加角色设置作为独立的system消息
  if (role.systemPrompt && role.systemPrompt.trim()) {
    const processedPrompt = replaceTemplateVariables(role.systemPrompt.trim(), userName, charName);
    messages.push({
      role: 'system',
      content: `[角色设置：${processedPrompt}]`
    });
  }
  
  // 4. 添加知识库信息作为独立的system消息（如果有）
  if (knowledgeContext && knowledgeContext.trim()) {
    messages.push({
      role: 'system',
      content: knowledgeContext
    });
  }
  
  return messages;
};
