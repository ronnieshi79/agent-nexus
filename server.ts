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

  // 1. Nexa Platform Concierge Agent (Project Contract Settlement, Order Dispatch & Audit)
  app.post('/api/assistant/chat', async (req, res) => {
    try {
      const {
        message = '',
        history = [],
        workspaces = [],
        tasks = [],
        negotiations = [],
        settlements = [],
        privateAgents = [],
      } = req.body ?? {};

      const ai = getGeminiClient();

      const unsettledList = settlements.filter(
        (s: { status: string }) => s.status === 'unsettled',
      );
      const unsettledTotal = unsettledList.reduce(
        (sum: number, s: { amountUsd: number }) => sum + (Number(s.amountUsd) || 0),
        0,
      );
      const reviewTasks = tasks.filter((t: { status: string }) => t.status === 'review');
      const activeNegs = negotiations.filter((n: { status: string }) => n.status !== 'hired');

      const prompt = `
你是 AgentNexus 的官方「平台助理 Agent（Nexa 助理）」。
重要商业原则：AgentNexus 采用「按项目签约制」定价（基于专家的能力等级、历史信誉分、复购率、稀缺性与市场供需），绝对不是 Token 计费或按单次任务几美元计费。

你的四大职责：
1. 结算服务（settlement）：核对各项目的专家签约里程碑结算、未结算托管款项与项目预算水位。
2. 接单与协商服务（order）：跟进外部专家的项目报价协商、提醒用户私有上架节点的项目接单与稀缺定价策略。
3. 审计与风控提醒（audit）：检查待雇主验收的高危交付物、项目预算健康度、权限回收审计日志。
4. 通用工作台引导（general）：回答跨项目进度与协作问题。

当前平台实时快照：
- 托管项目 (${workspaces.length}个): ${workspaces
        .map(
          (w: { name: string; spentUsd: number; budgetCapUsd: number; hiredAgentIds: string[] }) =>
            `「${w.name}」(已签约$${w.spentUsd}/项目预算$${w.budgetCapUsd}, ${w.hiredAgentIds.length}位专家)`,
        )
        .join('；')}
- 待雇主验收的工作卡 (${reviewTasks.length}张): ${
        reviewTasks
          .map(
            (t: { title: string; assigneeHandle: string }) =>
              `${t.title}(${t.assigneeHandle})`,
          )
          .join('；') || '无'
      }
- 待结算项目里程碑账单 (${unsettledList.length}笔，合计 $${unsettledTotal}): ${
        unsettledList
          .map(
            (s: { id: string; projectName: string; agentHandle: string; amountUsd: number }) =>
              `${s.id}:${s.projectName}/${s.agentHandle}/$${s.amountUsd}`,
          )
          .join('；') || '已全部结清'
      }
- 进行中的外部专家项目报价协商 (${activeNegs.length}笔): ${
        activeNegs
          .map(
            (n: { agentId: string; status: string; negotiatedPriceUsd: number; firstWorkCardTitle: string }) =>
              `agent=${n.agentId} (${n.status}, 项目报价$${n.negotiatedPriceUsd}, 首项:${n.firstWorkCardTitle})`,
          )
          .join('；') || '无'
      }
- 用户的私有 Agent 节点 (${privateAgents.length}个): ${
        privateAgents
          .map(
            (a: { handle: string; isListedInMarket: boolean; projectPriceUsd: number }) =>
              `${a.handle}(${a.isListedInMarket ? `已上架市场 $${a.projectPriceUsd}/项目` : '仅私有自用'})`,
          )
          .join('；') || '无'
      }

最近与用户的对话：
${history
  .slice(-5)
  .map((m: { sender: string; content: string }) => `${m.sender === 'user' ? '用户' : 'Nexa助理'}: ${m.content}`)
  .join('\n') || '（首次对话）'}

用户刚刚发送：
"${message}"

请输出结构化 JSON：
- category: 本次回复所属服务类型（settlement / order / audit / general）
- reply: 专业、条理清晰的中文平台助理回复（65~150 汉字，直接引用上面的真实项目名、项目签约金额、工作卡或协商状态，不要提 Token 费用）
- cardTitle: 附带的一张平台服务提醒卡片标题（不超过 20 汉字）
- cardDetail: 卡片内的一句话关键摘要（不超过 45 汉字）
- metricLabel: 卡片右侧简短数据标签（如"待结 $4,100"、"1 项待验收"、"签约占比 41%"，不超过 12 汉字）
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
                category: {
                  type: Type.STRING,
                  description: 'One of: settlement, order, audit, general',
                },
                reply: { type: Type.STRING },
                cardTitle: { type: Type.STRING },
                cardDetail: { type: Type.STRING },
                metricLabel: { type: Type.STRING },
              },
              required: ['category', 'reply', 'cardTitle', 'cardDetail', 'metricLabel'],
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

  // 2. Agent Marketplace AI Talent Advisor (Project-level Capability & Reputation Matching)
  app.post('/api/market/match', async (req, res) => {
    try {
      const { requirement = '', agents = [], hiredIds = [] } = req.body ?? {};
      const ai = getGeminiClient();

      const prompt = `
你是 AgentNexus 专家市场的 AI 选人顾问。市场采用基于能力等级、历史信誉、稀缺性与供需档期的「项目制签约定价」。
雇主的项目需求描述："${requirement}"

当前市场所有已上架的专家 Agent：
${agents
  .map(
    (a: {
      id: string;
      handle: string;
      name: string;
      title: string;
      serviceMode: string;
      skills: string[];
      projectPriceUsd: number;
      performance: {
        capabilityTier: string;
        reputationScore: number;
        completedProjects: number;
        repeatHireRate: number;
        demandStatus: string;
      };
    }) =>
      `- id=${a.id} | ${a.handle} (${a.name}) | ${a.title} | ${a.serviceMode === 'human-agent' ? '人+Agent协同' : '纯Agent租用'} | ${a.performance.capabilityTier} | 信誉${a.performance.reputationScore} | 复购${a.performance.repeatHireRate}% | 供需:${a.performance.demandStatus} | 项目签约价$${a.projectPriceUsd} | 技能:${a.skills.join(',')} | 状态:${hiredIds.includes(a.id) ? '已在群' : '可私聊签约'}`,
  )
  .join('\n')}

请从中挑选 1~3 位最匹配雇主需求的专家（优先挑选尚未入群的），给出简短精准的中文推荐理由，以及组合签约的项目总预算预估（estimatedBudgetUsd，等于所选专家 projectPriceUsd 之和）。
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
                summary: { type: Type.STRING, description: '总体组队与定价性价比建议，不超过 60 字' },
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

  // 3. 1-on-1 External Expert Project Engagement Negotiation Chat
  app.post('/api/market/dm', async (req, res) => {
    try {
      const { agent, workspace, history = [], message = '', currentTerms } = req.body ?? {};
      const ai = getGeminiClient();

      const modeDesc =
        agent?.serviceMode === 'human-agent'
          ? '人 + Agent 协同（专属 Agent 自动分析草稿，人类资深专家把关签发关键决策）'
          : '纯 Agent 租用（7x24 全周期驻场交付，严格对齐项目验收标准）';

      const basePrice = Number(agent?.projectPriceUsd) || 2000;
      const minPrice = Math.round((basePrice * 0.85) / 50) * 50;

      const prompt = `
你现在扮演 AgentNexus 外部市场专家：${agent?.handle}（${agent?.name}）。
你正在与雇主进行 1v1 私聊协商，敲定整个项目的交付范围与「项目制一口价签约费」（绝对不是按 Token 计费，也不是按单次任务计费）。
你的报价底气来源于自身的能力等级、历史信誉分、雇主复购率以及当前市场供需与档期稀缺度。

你的真实专业履历与市场供需数据：
- 专业定位：${agent?.title}
- 服务模式：${modeDesc}
- 能力等级：${agent?.performance?.capabilityTier ?? 'A+ 资深'} · 综合信誉分 ${agent?.performance?.reputationScore ?? 96}/100
- 市场供需：${agent?.performance?.demandStatus ?? '需求旺盛'}（${agent?.performance?.demandNote ?? '档期紧凑'}）
- 定价依据：${agent?.performance?.pricingBasis ?? '按完整项目交付范围与稀缺能力定价'}
- 历史数据：已完成 ${agent?.performance?.completedProjects ?? 40} 个项目，一次验收率 ${agent?.performance?.successRate ?? 98}%，雇主复购率 ${agent?.performance?.repeatHireRate ?? 85}%，均期 ${agent?.performance?.avgDeliveryDays ?? 3} 天
- 项目挂牌价：$${basePrice} / 项目（底线不低于 $${minPrice}）

拟加入的目标项目：
- 项目名称：${workspace?.name ?? '当前项目'}
- 项目目标：${workspace?.goal ?? ''}
- 当前协商项目价：$${currentTerms?.negotiatedPriceUsd ?? basePrice} / 项目
- 当前协商交付范围：${currentTerms?.scopeNote ?? '待确认'}

历史协商对话：
${history
  .slice(-6)
  .map((m: { sender: string; content: string }) => `${m.sender === 'employer' ? '雇主' : agent?.handle}: ${m.content}`)
  .join('\n') || '（首次对话）'}

雇主刚刚发来协商消息：
"${message}"

请返回结构化 JSON：
- reply: 以该专家第一人称自然回复雇主（专业、坦诚、务实，75~135 汉字；结合你的能力稀缺度、信誉复购率或当前档期说明项目报价合理性，若雇主砍价可在合理底线 $${minPrice} 以上微调或坚持价值，绝不提 Token 消耗）
- quotedPriceUsd: 本轮你确认/建议的项目签约美金整数（50 的倍数，不低于 $${minPrice}）
- proposedScope: 一句话总结当前达成或建议的项目交付范围（不超过 42 汉字）
- proposedWorkCardTitle: 建议入群后推进的首张工作卡片标题（不超过 24 汉字）
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
                reply: { type: Type.STRING },
                quotedPriceUsd: { type: Type.NUMBER },
                proposedScope: { type: Type.STRING },
                proposedWorkCardTitle: { type: Type.STRING },
              },
              required: ['reply', 'quotedPriceUsd', 'proposedScope', 'proposedWorkCardTitle'],
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

  // 4. Project Group Chat Multi-Agent Orchestrator
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
你是 AgentNexus 项目群聊的协同编排引擎，负责扮演内置管家 @Nexa 以及本项目群中已入队的专家 Agent，用自然、专业、像真实精英团队一样对话回复雇主。
本项目采用「项目签约制 + 群聊自然协作推进工作卡片」模式，工作卡片不单独计价或计算 Token。

项目上下文：
- 项目名称：${workspace?.name ?? '智能体协同项目'}
- 项目目标：${workspace?.goal ?? ''}
- 项目预算余额：$${Math.max(0, (workspace?.budgetCapUsd ?? 10000) - (workspace?.spentUsd ?? 0))}（已签约 $${workspace?.spentUsd ?? 0} / 总预算 $${workspace?.budgetCapUsd ?? 10000}）

当前项目群已入队专家（只能由名单内专家或 @Nexa 发言）：
- id="butler" | @Nexa | Nexa 管家（协调分工、汇总进度、若缺角色提醒去私聊协商签约外部专家）
${hiredAgents
  .map(
    (a: { id: string; handle: string; name: string; title: string; skills: string[] }) =>
      `- id="${a.id}" | ${a.handle} | ${a.name} | 职责:${a.title} | 技能:${a.skills.join('、')}`,
  )
  .join('\n')}

本项目已有工作卡片：
${existingTasks
  .map(
    (t: { id: string; featureModule: string; title: string; status: string; assigneeHandle: string }) =>
      `- ${t.id} [${t.featureModule}] (${t.status}) ${t.title} - ${t.assigneeHandle}`,
  )
  .join('\n')}

最近群聊记录：
${recentMessages
  .slice(-5)
  .map((m: { senderHandle: string; content: string }) => `${m.senderHandle}: ${m.content}`)
  .join('\n')}

雇主刚刚在项目群发送：
"${message}"

编排规则：
1. 生成 1 到 2 条自然、专业、简洁的中文群聊回复（每条 40~100 字），像真实团队同事在群里沟通一样自然，不要出现机械的“已耗费 $x”或 Token 字样。若雇主 @ 了某位已入群专家，务必由该专家率先回应。
2. 如果雇主的消息包含明确的功能开发、测试、规划、审查或拆解诉求，请在 newTasks 中生成 1~2 张工作卡片（带清晰的 featureModule 如"A功能 · 多币种结算"或"B功能 · 退款风控"，以及 workType 必须是 planning / development / testing / review 之一）。如果只是询问进展，newTasks 可为空数组。
3. 若雇主提及尚未入群的角色，由 @Nexa 提醒前往「私聊协商」或「专家市场」按项目签约外部专家。
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
                      featureModule: { type: Type.STRING },
                      workType: {
                        type: Type.STRING,
                        description: 'One of: planning, development, testing, review',
                      },
                      title: { type: Type.STRING },
                      description: { type: Type.STRING },
                      assigneeId: { type: Type.STRING },
                      assigneeHandle: { type: Type.STRING },
                      priority: { type: Type.STRING, description: '高, 中, or 低' },
                    },
                    required: [
                      'featureModule',
                      'workType',
                      'title',
                      'description',
                      'assigneeId',
                      'assigneeHandle',
                      'priority',
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

  // 5. Autonomous Execution for a Project Work Card (Pure Deliverable Output — No Token Metering)
  app.post('/api/kanban/execute', async (req, res) => {
    try {
      const { task, agent, workspace } = req.body ?? {};
      const ai = getGeminiClient();

      const prompt = `
你现在扮演 AgentNexus 项目中的专家 Agent：${agent?.handle ?? task?.assigneeHandle}（${agent?.name ?? '专业执行专家'}）。
职责：${agent?.title ?? '专业交付'}
服务模式：${agent?.serviceMode === 'human-agent' ? '人+Agent 协同' : '纯 Agent 租用'}
擅长技能：${(agent?.skills ?? []).join('、')}
所属项目：${workspace?.name ?? ''} — ${workspace?.goal ?? ''}

雇主刚刚批准执行以下项目工作卡片，你已完成沙箱研发/验证并产出交付物：
- 所属模块：${task?.featureModule ?? '核心功能'}
- 工作卡片标题：${task?.title}
- 工作描述：${task?.description}

请真实产出本次执行的高质量交付物摘要与产物路径，并写一段自然、简洁的项目群聊进度回复（提醒雇主验收，不要提任何 Token 或单任务费用）。
要求：
- deliverableSummary: 具体、专业的执行成果与关键要点（60~110 汉字）
- deliverableArtifact: 工作区产物文件路径（如 docs/arch_audit.md 或 src/services/retry_queue.ts）
- chatBroadcast: 发回项目群聊的自然交付说明（35~70 汉字，像真实同事在群里汇报成果）
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
              },
              required: ['deliverableSummary', 'deliverableArtifact', 'chatBroadcast'],
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

  // 6. Private Agent AI Capability & Project Pricing Optimizer
  app.post('/api/expert/optimize', async (req, res) => {
    try {
      const {
        name = '',
        title = '',
        category = 'engineering',
        serviceMode = 'pure-agent',
        skills = [],
        bio = '',
      } = req.body ?? {};
      const ai = getGeminiClient();

      const prompt = `
你是 AgentNexus 的专家节点能力包装与市场项目定价顾问。
重要原则：AgentNexus 的专家定价采用「项目签约制」，取决于专家的能力稀缺性、垂直行业沉淀、服务模式（纯 Agent 或人+Agent 协同）与市场供需，不是按 Token 或单任务几美元计费。

用户正在配置自己的私有 Agent（可用于团队自用，也准备按需上架到专家市场按项目接单）：
- 名称：${name}
- 定位：${title}
- 类别：${category}
- 服务模式：${serviceMode === 'human-agent' ? '人+Agent 协同' : '纯 Agent 租用'}
- 当前能力标签：${skills.join('、')}
- 当前简介：${bio}

请帮他优化：
1. optimizedBio: 更有信任感、突出项目交付确定性与专业稀缺度的简介（55~90 汉字）
2. recommendedSkills: 补充/提炼 5 个精准高价值能力标签（每个 4~8 个字）
3. recommendedMcpTools: 推荐 3 个匹配的 MCP 工具名（如 Git-PR, SQL-Explain 等）
4. suggestedProjectPriceUsd: 合理的单项目美金签约定价整数（1000 ~ 5000 之间，100 的倍数；人+Agent 协同或高稀缺架构/风控类定价更高）
5. marketAdvice: 一句话基于稀缺性与信誉溢价的上架定价建议（不超过 40 汉字）
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
                suggestedProjectPriceUsd: { type: Type.NUMBER },
                marketAdvice: { type: Type.STRING },
              },
              required: [
                'optimizedBio',
                'recommendedSkills',
                'recommendedMcpTools',
                'suggestedProjectPriceUsd',
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
