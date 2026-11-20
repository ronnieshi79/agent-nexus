import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MODEL = 'gemini-4-hydrogen';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('未检测到 GEMINI_API_KEY，请在 Settings > Secrets 面板配置 API Key。');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function runWithRetry<T>(fn: () => Promise<T>, maxAttempts = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 450 * attempt));
      }
    }
  }
  throw lastError;
}

function formatApiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('API_KEY_INVALID') || raw.includes('PERMISSION_DENIED') || raw.includes('403')) {
    return {
      status: 403,
      message: 'Gemini API 鉴权失败，请检查 Settings > Secrets 中的 API Key 配置。',
    };
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
    return {
      status: 429,
      message: '当前 API 配额已达上限，请稍后再试或在 Settings > Secrets 中切换更高配额的 Key。',
    };
  }
  if (raw.includes('GEMINI_API_KEY')) {
    return { status: 500, message: raw };
  }
  return {
    status: 500,
    message: `智能体服务调用失败：${raw}`,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // 1. Context-Aware AI Brain: recommends the most suitable functional service card
  app.post('/api/brain/recommend', async (req, res) => {
    try {
      const {
        userIntent = '',
        perspective = 'employer',
        activeCard = 'chat',
        workspace,
        hiredAgents = [],
        tasks = [],
      } = req.body ?? {};

      const ai = getGeminiClient();

      const prompt = `
你是 AgentNexus 的内嵌情境感知 AI 大脑（@Butler 的中枢大脑）。
请根据当前用户意图、视角、团队配置和任务进展，判断此刻最应该为雇主或专家弹出哪一张“单一职责功能服务卡片”，并给出精炼、务实的中文建议。

可选功能卡片 ID（必须严格从中选 1 个）：
- "market": Agent 专家市场（当团队缺人、需要按能力标签和历史绩效筛选/雇佣产品或研发专家时）
- "chat": 项目团队群聊指挥台（当需要 @专家派单、拆解需求、讨论方案、跟进实时协作进展时）
- "kanban": 自动化工作流与任务看板（当有任务处于待审核、待执行、需要触发 AI 自主推进、或查看预算消耗与依赖进度时）
- "expert": 专家能力档案与接单台（当用户想以专家 Agent 供给端身份配置技能标签、查看历史绩效、挂网闲时接单或发布新特工时）

当前情境数据：
- 用户视角: ${perspective === 'expert' ? '专家 Agent 供给端' : '雇主/指挥官视角'}
- 当前停留卡片: ${activeCard}
- 用户主动输入意图: "${userIntent || '（无主动输入，请基于项目现状主动情境感知推荐）'}"
- 项目名称与目标: ${workspace?.name ?? ''} — ${workspace?.goal ?? ''}
- 已雇佣团队 (${hiredAgents.length}人): ${hiredAgents.map((a: { handle: string; title: string }) => `${a.handle}(${a.title})`).join('、') || '暂无'}
- 当前任务状态分布:
  待接单: ${tasks.filter((t: { status: string }) => t.status === 'pending').length}
  执行中: ${tasks.filter((t: { status: string }) => t.status === 'in_progress').length}
  待审核: ${tasks.filter((t: { status: string }) => t.status === 'review').length}
  已完成: ${tasks.filter((t: { status: string }) => t.status === 'done').length}
- 任务摘要: ${tasks.map((t: { title: string; status: string; assigneeHandle: string }) => `[${t.status}] ${t.title} (${t.assigneeHandle})`).join('; ')}

请输出 JSON：
- recommendedCard: 推荐的卡片 ID
- headline: 一句话情境洞察标题（不超过 18 个汉字，口语化自然表达）
- reason: 为什么此刻推荐这张卡片（不超过 48 个汉字，紧扣项目真实状态或用户意图）
- suggestedActionLabel: 推荐卡片按钮文案（4-8 个汉字，例如"前往审批任务"、"雇佣架构专家"）
- suggestedPrompt: 如果推荐的是 chat 或 market，给出一句可直接填入执行的示范指令（可为空字符串）
- confidenceNote: 简短情境依据（不超过 14 个汉字，如"检测到 1 项待审批交付"）
`;

      const response = await runWithRetry(() =>
        ai.models.generateContent({
          model: MODEL,
          contents: prompt,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                recommendedCard: {
                  type: Type.STRING,
                  description: 'One of: market, chat, kanban, expert',
                },
                headline: { type: Type.STRING },
                reason: { type: Type.STRING },
                suggestedActionLabel: { type: Type.STRING },
                suggestedPrompt: { type: Type.STRING },
                confidenceNote: { type: Type.STRING },
              },
              required: [
                'recommendedCard',
                'headline',
                'reason',
                'suggestedActionLabel',
                'confidenceNote',
              ],
            },
          },
        }),
      );

      const parsed = JSON.parse((response.text ?? '{}').trim());
      const validCards = new Set(['market', 'chat', 'kanban', 'expert']);
      if (!validCards.has(parsed.recommendedCard)) {
        parsed.recommendedCard = perspective === 'expert' ? 'expert' : 'chat';
      }
      res.json(parsed);
    } catch (err) {
      const { status, message } = formatApiError(err);
      res.status(status).json({ error: message });
    }
  });

  // 2. Agent Marketplace AI Talent Advisor
  app.post('/api/market/match', async (req, res) => {
    try {
      const { requirement = '', agents = [], hiredIds = [] } = req.body ?? {};
      const ai = getGeminiClient();

      const prompt = `
你是 AgentNexus 专家市场的 AI 选人顾问。
雇主的需求描述："${requirement}"

当前市场所有可用专家 Agent（已标记是否已雇佣）：
${agents
  .map(
    (a: {
      id: string;
      handle: string;
      name: string;
      title: string;
      category: string;
      skills: string[];
      pricePerTaskUsd: number;
      performance: { rating: number; successRate: number; avgDurationMin: number };
    }) =>
      `- id=${a.id} | ${a.handle} (${a.name}) | ${a.title} | 技能:${a.skills.join(',')} | 单任务$${a.pricePerTaskUsd} | 评分${a.performance.rating} | 成功率${a.performance.successRate}% | 状态:${hiredIds.includes(a.id) ? '已在团队' : '可雇佣'}`,
  )
  .join('\n')}

请从中挑选 1~3 位最匹配雇主需求的专家（优先挑选尚未雇佣的），并给出简短精准的中文推荐理由和总预算预估。
`;

      const response = await runWithRetry(() =>
        ai.models.generateContent({
          model: MODEL,
          contents: prompt,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summary: { type: Type.STRING, description: '总体组队建议，不超过 55 字' },
                estimatedBudgetUsd: { type: Type.NUMBER },
                matches: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      agentId: { type: Type.STRING },
                      reason: { type: Type.STRING, description: '精准匹配原因，不超过 32 字' },
                    },
                    required: ['agentId', 'reason'],
                  },
                },
              },
              required: ['summary', 'estimatedBudgetUsd', 'matches'],
            },
          },
        }),
      );

      res.json(JSON.parse((response.text ?? '{}').trim()));
    } catch (err) {
      const { status, message } = formatApiError(err);
      res.status(status).json({ error: message });
    }
  });

  // 3. Team Group Chat Multi-Agent Orchestrator
  app.post('/api/chat/orchestrate', async (req, res) => {
    try {
      const {
        message = '',
        workspace,
        hiredAgents = [],
        recentMessages = [],
        existingTasks = [],
      } = req.body ?? {};

      const ai = getGeminiClient();

      const prompt = `
你是 AgentNexus 项目群聊的协同编排引擎，负责扮演内置管家 @Butler 以及团队中已雇佣的专家 Agent 回复雇主，并在雇主下达需求或 @派单 时自动拆解/生成结构化任务卡片同步到看板。

项目上下文：
- 项目名称：${workspace?.name ?? '智能体协同项目'}
- 项目目标：${workspace?.goal ?? ''}
- 剩余预算：$${Math.max(0, (workspace?.budgetCapUsd ?? 35) - (workspace?.spentUsd ?? 0)).toFixed(2)}

当前群内已雇佣专家名单（只能由名单里的专家或 @Butler 发言）：
- id="butler" | @Butler | Nexa 管家（负责任务协调、预算护栏校验、若缺合适角色则提醒去市场雇佣）
${hiredAgents
  .map(
    (a: { id: string; handle: string; name: string; title: string; skills: string[]; pricePerTaskUsd: number }) =>
      `- id="${a.id}" | ${a.handle} | ${a.name} | 职责:${a.title} | 技能:${a.skills.join('、')} | 单次参考价:$${a.pricePerTaskUsd}`,
  )
  .join('\n')}

已有任务看板：
${existingTasks
  .map((t: { id: string; title: string; status: string; assigneeHandle: string }) => `- ${t.id}: [${t.status}] ${t.title} (${t.assigneeHandle})`)
  .join('\n')}

最近群聊记录：
${recentMessages
  .slice(-5)
  .map((m: { senderHandle: string; content: string }) => `${m.senderHandle}: ${m.content}`)
  .join('\n')}

雇主刚刚在群里发送：
"${message}"

编排规则：
1. 生成 1 到 2 条真实、专业、简洁的中文群聊回复（不要套话，每条 45~110 字），若雇主 @ 了某位已雇佣专家，务必由该专家率先回应；如果雇主需要拆解开发/设计/评审任务，由最匹配的已雇佣专家承接，或者由 @Butler 协调拆解。
2. 如果雇主的消息包含明确的工作要求、需求拆解、开发、评审或测试任务，请同时在 newTasks 中生成 1~2 张可直接同步到工作流看板的任务卡片（指定给已雇佣的对应专家 ID 和 handle，设置合理 budgetLimitUsd 在 1.2~4.5 之间）。如果只是闲聊或单纯询问进展，newTasks 可为空数组。
3. 若雇主 @ 的角色尚未雇佣，由 @Butler 提醒去“Agent 专家市场”卡片一键雇佣对应专家。
`;

      const response = await runWithRetry(() =>
        ai.models.generateContent({
          model: MODEL,
          contents: prompt,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                replies: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      senderId: { type: Type.STRING },
                      senderHandle: { type: Type.STRING },
                      senderName: { type: Type.STRING },
                      senderType: { type: Type.STRING, description: 'butler or agent' },
                      content: { type: Type.STRING },
                    },
                    required: ['senderId', 'senderHandle', 'senderName', 'senderType', 'content'],
                  },
                },
                newTasks: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      description: { type: Type.STRING },
                      assigneeId: { type: Type.STRING },
                      assigneeHandle: { type: Type.STRING },
                      priority: { type: Type.STRING, description: '高, 中, or 低' },
                      budgetLimitUsd: { type: Type.NUMBER },
                    },
                    required: [
                      'title',
                      'description',
                      'assigneeId',
                      'assigneeHandle',
                      'priority',
                      'budgetLimitUsd',
                    ],
                  },
                },
              },
              required: ['replies', 'newTasks'],
            },
          },
        }),
      );

      res.json(JSON.parse((response.text ?? '{}').trim()));
    } catch (err) {
      const { status, message } = formatApiError(err);
      res.status(status).json({ error: message });
    }
  });

  // 4. Autonomous Functional Agent Execution for a Kanban Task
  app.post('/api/kanban/execute', async (req, res) => {
    try {
      const { task, agent, workspace } = req.body ?? {};
      const ai = getGeminiClient();

      const prompt = `
你现在扮演 AgentNexus 中的专家 Agent：${agent?.handle ?? task?.assigneeHandle}（${agent?.name ?? '专业执行特工'}）。
职责：${agent?.title ?? '专业交付'}
擅长技能：${(agent?.skills ?? []).join('、')}
项目背景：${workspace?.name ?? ''} — ${workspace?.goal ?? ''}

你刚刚在自动化工作流看板上接手并自主执行了以下任务卡片：
- 任务标题：${task?.title}
- 任务描述：${task?.description}
- 预算熔断上限：$${task?.budgetLimitUsd ?? 2.5}

请真实产出本次执行的高质量交付物摘要与产物路径，并写一段简洁的群聊进度回流播报（用于同步给雇主审批）。
要求：
- deliverableSummary: 具体、专业的执行成果与关键技术/产品要点（60~110 汉字）
- deliverableArtifact: 工作区产物文件路径（例如 docs/arch_audit.md 或 src/services/retry_queue.ts）
- chatBroadcast: 发回项目群聊的简短交付播报，提醒雇主审批验收（40~75 汉字）
- tokensUsed: 合理的消耗 Token 整数（例如 18500 ~ 49000）
- actualCostUsd: 严格低于预算上限 ${task?.budgetLimitUsd ?? 2.5} 的实际费用（保留两位小数，如 1.38）
`;

      const response = await runWithRetry(() =>
        ai.models.generateContent({
          model: MODEL,
          contents: prompt,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                deliverableSummary: { type: Type.STRING },
                deliverableArtifact: { type: Type.STRING },
                chatBroadcast: { type: Type.STRING },
                tokensUsed: { type: Type.INTEGER },
                actualCostUsd: { type: Type.NUMBER },
              },
              required: [
                'deliverableSummary',
                'deliverableArtifact',
                'chatBroadcast',
                'tokensUsed',
                'actualCostUsd',
              ],
            },
          },
        }),
      );

      res.json(JSON.parse((response.text ?? '{}').trim()));
    } catch (err) {
      const { status, message } = formatApiError(err);
      res.status(status).json({ error: message });
    }
  });

  // 5. Expert Studio AI Capability & Pricing Optimizer
  app.post('/api/expert/optimize', async (req, res) => {
    try {
      const { name = '', title = '', category = 'engineering', skills = [], bio = '' } = req.body ?? {};
      const ai = getGeminiClient();

      const prompt = `
你是 AgentNexus 专家端的能力包装与商业定价顾问。
一位专家 Agent 创作者正在配置自己的对外接单档案，以便雇主在市场中快速筛选和委派任务：
- 名称：${name}
- 定位：${title}
- 类别：${category}
- 当前能力标签：${skills.join('、')}
- 当前简介：${bio}

请帮他优化：
1. optimizedBio: 更有信任感、突出交付确定性与行业场景的专家简介（55~90 汉字）
2. recommendedSkills: 补充/提炼 5 个精准高转化能力标签（每个 4~8 个字）
3. recommendedMcpTools: 推荐 3 个匹配的 MCP 工具名（如 Git-PR, SQL-Explain 等）
4. suggestedPricePerTaskUsd: 合理的单任务美金定价（1.2 ~ 4.0 之间）
5. marketAdvice: 一句话接单提升建议（不超过 38 汉字）
`;

      const response = await runWithRetry(() =>
        ai.models.generateContent({
          model: MODEL,
          contents: prompt,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                optimizedBio: { type: Type.STRING },
                recommendedSkills: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                recommendedMcpTools: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                suggestedPricePerTaskUsd: { type: Type.NUMBER },
                marketAdvice: { type: Type.STRING },
              },
              required: [
                'optimizedBio',
                'recommendedSkills',
                'recommendedMcpTools',
                'suggestedPricePerTaskUsd',
                'marketAdvice',
              ],
            },
          },
        }),
      );

      res.json(JSON.parse((response.text ?? '{}').trim()));
    } catch (err) {
      const { status, message } = formatApiError(err);
      res.status(status).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AgentNexus prototype running at http://localhost:${PORT}`);
  });
}

startServer();
