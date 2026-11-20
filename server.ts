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

  // 1. Nexa Platform Concierge Agent (Settlement, Order Dispatch, Audit & Guardrail Alerts)
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
你是 AgentNexus 的官方「平台助理 Agent（Nexa 助理）」。你在统一消息聊天中为用户提供平台级托管服务，涵盖四大职责：
1. 结算服务（settlement）：核对各项目任务消耗、未结算账单汇总、成本护栏核算与结算确认建议。
2. 接单与协商服务（order）：跟进外部专家报价协商进度、提醒用户私有上架节点的接单与报价策略。
3. 审计与风控提醒（audit）：检查待雇主验收合并的高危代码交付物、预算护栏水位、权限回收审计日志。
4. 通用工作台引导（general）：回答跨项目进度与操作问题。

当前平台实时快照：
- 托管项目 (${workspaces.length}个): ${workspaces
        .map(
          (w: { name: string; spentUsd: number; budgetCapUsd: number; hiredAgentIds: string[] }) =>
            `「${w.name}」(已耗$${w.spentUsd}/上限$${w.budgetCapUsd}, ${w.hiredAgentIds.length}位专家)`,
        )
        .join('；')}
- 待雇主审批合并的工作卡 (${reviewTasks.length}张): ${
        reviewTasks
          .map(
            (t: { title: string; assigneeHandle: string; actualCostUsd: number }) =>
              `${t.title}(${t.assigneeHandle}, 实耗$${t.actualCostUsd})`,
          )
          .join('；') || '无'
      }
- 待结算账单 (${unsettledList.length}笔，合计 $${unsettledTotal.toFixed(2)}): ${
        unsettledList
          .map(
            (s: { id: string; projectName: string; agentHandle: string; amountUsd: number }) =>
              `${s.id}:${s.projectName}/${s.agentHandle}/$${s.amountUsd}`,
          )
          .join('；') || '已全部结清'
      }
- 进行中的外部专家雇佣协商 (${activeNegs.length}笔): ${
        activeNegs
          .map(
            (n: { agentId: string; status: string; negotiatedPriceUsd: number; firstWorkCardTitle: string }) =>
              `agent=${n.agentId} (${n.status}, 报价$${n.negotiatedPriceUsd}, 拟立项:${n.firstWorkCardTitle})`,
          )
          .join('；') || '无'
      }
- 用户的私有 Agent 节点 (${privateAgents.length}个): ${
        privateAgents
          .map(
            (a: { handle: string; isListedInMarket: boolean }) =>
              `${a.handle}(${a.isListedInMarket ? '已上架市场接单' : '仅私有自用'})`,
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
- reply: 专业、条理清晰的中文平台助理回复（65~150 汉字，直接引用上面的真实项目名、账单金额、工作卡或协商状态，给出可执行结论）
- cardTitle: 附带的一张平台服务提醒卡片标题（不超过 20 汉字）
- cardDetail: 卡片内的一句话关键摘要（不超过 45 汉字）
- metricLabel: 卡片右侧简短数据标签（如"待结 $3.80"、"1 项待审"、"预算健康 14%"，不超过 12 汉字）
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

  // 2. Agent Marketplace AI Talent Advisor
  app.post('/api/market/match', async (req, res) => {
    try {
      const { requirement = '', agents = [], hiredIds = [] } = req.body ?? {};
      const ai = getGeminiClient();

      const prompt = `
你是 AgentNexus 专家市场的 AI 选人顾问。
雇主的需求描述："${requirement}"

当前市场所有已上架的专家 Agent（已标记是否已在当前项目群）：
${agents
  .map(
    (a: {
      id: string;
      handle: string;
      name: string;
      title: string;
      serviceMode: string;
      skills: string[];
      pricePerTaskUsd: number;
      performance: { rating: number; successRate: number };
    }) =>
      `- id=${a.id} | ${a.handle} (${a.name}) | ${a.title} | 服务模式:${a.serviceMode === 'human-agent' ? '人+Agent协同' : '纯Agent租用'} | 技能:${a.skills.join(',')} | 单任务$${a.pricePerTaskUsd} | 评分${a.performance.rating} | 成功率${a.performance.successRate}% | 状态:${hiredIds.includes(a.id) ? '已在群' : '可私聊协商'}`,
  )
  .join('\n')}

请从中挑选 1~3 位最匹配雇主需求的专家（优先挑选尚未入群的），并给出简短精准的中文推荐理由和总预算预估。
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

  // 3. 1-on-1 External Expert Hiring Negotiation Chat
  app.post('/api/market/dm', async (req, res) => {
    try {
      const { agent, workspace, history = [], message = '', currentTerms } = req.body ?? {};
      const ai = getGeminiClient();

      const modeDesc =
        agent?.serviceMode === 'human-agent'
          ? '人 + Agent 协同（专属 Agent 自动分析草稿，人类专家把关签发关键决策）'
          : '纯 Agent 租用（7x24 秒级全自动按工作卡片执行，严格遵守 Harness 预算上限）';

      const prompt = `
你现在扮演 AgentNexus 外部市场专家：${agent?.handle}（${agent?.name}）。
你正在与雇主进行 1v1 私聊协商，敲定合作范围、单次报价、首张工作卡片交付物，以便雇主决定是否正式雇佣你进入项目群。

你的档案信息：
- 专业定位：${agent?.title}
- 服务模式：${modeDesc}
- 能力标签：${(agent?.skills ?? []).join('、')}
- 已装配 MCP 工具：${(agent?.mcpTools ?? []).join('、')}
- 挂牌参考价：单任务 $${agent?.pricePerTaskUsd ?? 2.0} / 包时 $${agent?.pricePerHourUsd ?? 6.0}
- 历史绩效：完成 ${agent?.performance?.completedTasks ?? 100} 单，一次通过率 ${agent?.performance?.successRate ?? 98}%，均耗 ${agent?.performance?.avgDurationMin ?? 10} 分钟

拟加入的目标项目：
- 项目名称：${workspace?.name ?? '当前项目'}
- 项目目标：${workspace?.goal ?? ''}
- 当前协商单报价：$${currentTerms?.negotiatedPriceUsd ?? agent?.pricePerTaskUsd ?? 2.0}
- 当前协商范围：${currentTerms?.scopeNote ?? '待确认'}

历史协商对话：
${history
  .slice(-6)
  .map((m: { sender: string; content: string }) => `${m.sender === 'employer' ? '雇主' : agent?.handle}: ${m.content}`)
  .join('\n') || '（首次对话）'}

雇主刚刚发来协商消息：
"${message}"

请返回结构化 JSON：
- reply: 以该专家第一人称回复雇主（专业、坦诚、务实，75~135 汉字；如果雇主砍价可在合理范围内适度让步或坚持底线并说明价值；清晰说明交付物和预计耗时）
- quotedPriceUsd: 本轮你确认/建议的单任务美金报价（保留两位小数，不低于挂牌价的 80%）
- proposedScope: 一句话总结当前达成或建议的交付范围（不超过 42 汉字）
- proposedWorkCardTitle: 建议入群后自动创建的首张工作卡片标题（例如"审查 A 功能：高并发支付网关架构体检"，不超过 24 汉字）
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

  // 4. Project Group Chat Multi-Agent Orchestrator (outputs structured featureModule + workType work cards)
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
你是 AgentNexus 项目群聊的协同编排引擎，负责扮演内置管家 @Butler 以及本项目群中已入队的专家 Agent 回复雇主。
本项目采用「项目 → 多张工作卡片（如规划/开发/测试/审查 A 功能）」的协作模式。

项目上下文：
- 项目名称：${workspace?.name ?? '智能体协同项目'}
- 项目目标：${workspace?.goal ?? ''}
- 剩余预算：$${Math.max(0, (workspace?.budgetCapUsd ?? 35) - (workspace?.spentUsd ?? 0)).toFixed(2)}

当前项目群已入队专家（只能由名单内专家或 @Butler 发言）：
- id="butler" | @Butler | Nexa 管家（协调分工、预算护栏校验、若缺角色提醒去私聊协商雇佣外部专家）
${hiredAgents
  .map(
    (a: { id: string; handle: string; name: string; title: string; skills: string[]; pricePerTaskUsd: number }) =>
      `- id="${a.id}" | ${a.handle} | ${a.name} | 职责:${a.title} | 技能:${a.skills.join('、')} | 单次参考价:$${a.pricePerTaskUsd}`,
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
1. 生成 1 到 2 条真实、专业、简洁的中文群聊回复（每条 45~110 字），若雇主 @ 了某位已入群专家，务必由该专家率先回应。
2. 如果雇主的消息包含明确的功能开发、测试、规划、审查或拆解诉求，请在 newTasks 中生成 1~2 张工作卡片（带清晰的 featureModule 如"A功能 · 多币种结算"或"B功能 · 退款风控"，以及 workType 必须是 planning / development / testing / review 之一，budgetLimitUsd 在 1.2~4.5 之间）。如果只是询问进展，newTasks 可为空数组。
3. 若雇主提及尚未入群的角色，由 @Butler 提醒前往「私聊协商」或「专家市场」洽谈雇佣。
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
                      budgetLimitUsd: { type: Type.NUMBER },
                    },
                    required: [
                      'featureModule',
                      'workType',
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

  // 5. Autonomous Execution for a Project Work Card
  app.post('/api/kanban/execute', async (req, res) => {
    try {
      const { task, agent, workspace } = req.body ?? {};
      const ai = getGeminiClient();

      const prompt = `
你现在扮演 AgentNexus 中的专家 Agent：${agent?.handle ?? task?.assigneeHandle}（${agent?.name ?? '专业执行特工'}）。
职责：${agent?.title ?? '专业交付'}
服务模式：${agent?.serviceMode === 'human-agent' ? '人+Agent 协同' : '纯 Agent 租用'}
擅长技能：${(agent?.skills ?? []).join('、')}
所属项目：${workspace?.name ?? ''} — ${workspace?.goal ?? ''}

你刚刚在工作看板上接手并自主执行了以下项目工作卡片：
- 所属模块：${task?.featureModule ?? '核心功能'}
- 工作卡片标题：${task?.title}
- 工作描述：${task?.description}
- 预算熔断上限：$${task?.budgetLimitUsd ?? 2.5}

请真实产出本次执行的高质量交付物摘要与产物路径，并写一段简洁的项目群聊进度回流播报（提醒雇主审批验收）。
要求：
- deliverableSummary: 具体、专业的执行成果与关键要点（60~110 汉字）
- deliverableArtifact: 工作区产物文件路径（如 docs/arch_audit.md 或 src/services/retry_queue.ts）
- chatBroadcast: 发回项目群聊的简短交付播报（40~75 汉字）
- tokensUsed: 合理的消耗 Token 整数（18500 ~ 49000）
- actualCostUsd: 严格低于预算上限 ${task?.budgetLimitUsd ?? 2.5} 的实际费用（两位小数）
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

  // 6. Private Agent AI Capability & Market Listing Optimizer
  app.post('/api/expert/optimize', async (req, res) => {
    try {
      const { name = '', title = '', category = 'engineering', skills = [], bio = '' } = req.body ?? {};
      const ai = getGeminiClient();

      const prompt = `
你是 AgentNexus 的节点能力包装与市场上架顾问。
用户正在配置自己的私有 Agent（可用于团队自用，也准备按需上架到专家市场对外接单）：
- 名称：${name}
- 定位：${title}
- 类别：${category}
- 当前能力标签：${skills.join('、')}
- 当前简介：${bio}

请帮他优化：
1. optimizedBio: 更有信任感、突出交付确定性与行业场景的简介（55~90 汉字）
2. recommendedSkills: 补充/提炼 5 个精准高转化能力标签（每个 4~8 个字）
3. recommendedMcpTools: 推荐 3 个匹配的 MCP 工具名（如 Git-PR, SQL-Explain 等）
4. suggestedPricePerTaskUsd: 合理的单任务美金定价（1.2 ~ 4.0 之间）
5. marketAdvice: 一句话上架接单提升建议（不超过 38 汉字）
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
