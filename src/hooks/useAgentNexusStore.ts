import { useCallback, useMemo, useState } from 'react';
import {
  INITIAL_EXPERT_AGENTS,
  INITIAL_HIRED_IDS,
  INITIAL_MESSAGES,
  INITIAL_TASKS,
  INITIAL_WORKSPACE,
} from '../data/initialData';
import {
  executeKanbanTask,
  fetchBrainRecommendation,
  orchestrateGroupChat,
} from '../services/api';
import type {
  AirobotState,
  BrainRecommendation,
  ChatMessage,
  ExpertAgent,
  ProjectWorkspace,
  ServiceCardId,
  TaskStatus,
  UserPerspective,
  WorkflowTask,
} from '../types/agentnexus';

function nowTimeStr(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function useAgentNexusStore() {
  const [perspective, setPerspective] = useState<UserPerspective>('employer');
  const [activeCard, setActiveCard] = useState<ServiceCardId>('chat');
  const [workspace, setWorkspace] = useState<ProjectWorkspace>(INITIAL_WORKSPACE);
  const [agents, setAgents] = useState<ExpertAgent[]>(INITIAL_EXPERT_AGENTS);
  const [hiredIds, setHiredIds] = useState<string[]>(INITIAL_HIRED_IDS);
  const [tasks, setTasks] = useState<WorkflowTask[]>(INITIAL_TASKS);
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);

  const [isAiBusy, setIsAiBusy] = useState(false);
  const [executingTaskId, setExecutingTaskId] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [chatDraftSeed, setChatDraftSeed] = useState<string>('');
  const [marketRequirementSeed, setMarketRequirementSeed] = useState<string>('');

  const [recommendation, setRecommendation] = useState<BrainRecommendation>({
    recommendedCard: 'kanban',
    headline: '1 项核心支付交付正等待你的审批',
    reason: '@全栈开发员 已完成幂等支付网关编码并通过 14 项单测，可前往看板一键审批或雇佣 @架构审查员 复核。',
    suggestedActionLabel: '打开工作流看板',
    suggestedPrompt: '',
    confidenceNote: '情境感知 · 1 项待审核',
  });

  const hiredAgents = useMemo(
    () => agents.filter((a) => hiredIds.includes(a.id)),
    [agents, hiredIds],
  );

  const airobotState: AirobotState = useMemo(() => {
    if (isAiBusy || executingTaskId) return 'thinking';
    if (celebrating) return 'celebrating';
    return activeCard;
  }, [activeCard, celebrating, executingTaskId, isAiBusy]);

  const triggerCelebration = useCallback(() => {
    setCelebrating(true);
    window.setTimeout(() => setCelebrating(false), 1800);
  }, []);

  const switchPerspective = useCallback((next: UserPerspective) => {
    setPerspective(next);
    setAiError(null);
    if (next === 'expert') {
      setActiveCard('expert');
      setRecommendation({
        recommendedCard: 'expert',
        headline: '已切换至专家 Agent 供给端档案台',
        reason: '你可以维护技能标签、历史绩效背书并开启闲时挂网接单，实时同步到雇主市场。',
        suggestedActionLabel: '管理专家档案',
        confidenceNote: '视角切换 · 专家供给端',
      });
    } else {
      setActiveCard('chat');
      setRecommendation({
        recommendedCard: 'market',
        headline: '雇主指挥模式就绪，可随时扩编团队',
        reason: '当前已有产品与全栈特工在群协同，建议按需从市场补充架构审查或 QA 测试专家。',
        suggestedActionLabel: '逛逛专家市场',
        confidenceNote: '视角切换 · 雇主端',
      });
    }
  }, []);

  const hireAgent = useCallback(
    (agentId: string) => {
      const target = agents.find((a) => a.id === agentId);
      if (!target || hiredIds.includes(agentId)) return;

      setHiredIds((prev) => [...prev, agentId]);
      const ts = nowTimeStr();
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_hire_${Date.now()}`,
          senderType: 'system',
          senderId: 'system',
          senderName: '系统协同同步',
          senderHandle: '系统通知',
          content: `已雇佣 ${target.handle}（${target.name}）加入「${workspace.name}」项目群，已自动挂载 ${target.skills.slice(0, 3).join(' / ')} 技能包，单次参考价 $${target.pricePerTaskUsd.toFixed(2)}。`,
          timestamp: ts,
        },
        {
          id: `msg_greet_${Date.now() + 1}`,
          senderType: 'agent',
          senderId: target.id,
          senderName: target.name,
          senderHandle: target.handle,
          content: `报道！我是 ${target.name}，已接入加密云工作区。现在可以直接在群里 ${target.handle} 向我派发任务卡片。`,
          timestamp: ts,
        },
      ]);

      setRecommendation({
        recommendedCard: 'chat',
        headline: `${target.handle} 已入队，马上派发首张任务卡`,
        reason: '新专家已完成加密工作区挂载与技能装填，回到群聊即可通过 @ 语法直接指派任务。',
        suggestedActionLabel: '去群里 @ 派单',
        suggestedPrompt: `${target.handle} 请结合当前多币种结算项目进展，帮我输出一份专业专项方案并拆解可执行子任务`,
        confidenceNote: '团队已更新 · 新专家入列',
      });
      triggerCelebration();
    },
    [agents, hiredIds, triggerCelebration, workspace.name],
  );

  const releaseAgent = useCallback(
    (agentId: string) => {
      const target = agents.find((a) => a.id === agentId);
      if (!target) return;
      setHiredIds((prev) => prev.filter((id) => id !== agentId));
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_rel_${Date.now()}`,
          senderType: 'system',
          senderId: 'system',
          senderName: '系统协同同步',
          senderHandle: '系统通知',
          content: `已解除 ${target.handle} 的当前项目挂载，技能包与工作区访问权限已自动回收卸载。`,
          timestamp: nowTimeStr(),
        },
      ]);
    },
    [agents],
  );

  const sendGroupMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setAiError(null);

      const userMsgId = `msg_user_${Date.now()}`;
      const userMsg: ChatMessage = {
        id: userMsgId,
        senderType: 'employer',
        senderId: 'employer',
        senderName: '我（项目指挥官）',
        senderHandle: '@指挥官',
        content: trimmed,
        timestamp: nowTimeStr(),
      };

      const nextMessages = [...messages, userMsg];
      setMessages(nextMessages);
      setIsAiBusy(true);

      try {
        const result = await orchestrateGroupChat({
          message: trimmed,
          workspace,
          hiredAgents,
          recentMessages: nextMessages,
          existingTasks: tasks,
        });

        const ts = nowTimeStr();
        const createdTasks: WorkflowTask[] = (result.newTasks || []).map((nt, idx) => {
          const validAssignee = hiredAgents.find((a) => a.id === nt.assigneeId) || hiredAgents[0];
          return {
            id: `tsk_${Date.now().toString().slice(-4)}_${idx + 1}`,
            title: nt.title,
            description: nt.description,
            assigneeId: validAssignee ? validAssignee.id : 'butler',
            assigneeHandle: validAssignee ? validAssignee.handle : nt.assigneeHandle || '@Butler',
            status: 'pending',
            priority: nt.priority === '高' || nt.priority === '低' ? nt.priority : '中',
            budgetLimitUsd: Number(nt.budgetLimitUsd) || 2.0,
            actualCostUsd: 0,
            tokensUsed: 0,
            createdAt: ts,
            updatedAt: ts,
            sourceMessageId: userMsgId,
          };
        });

        if (createdTasks.length > 0) {
          setTasks((prev) => [...createdTasks, ...prev]);
        }

        const aiReplies: ChatMessage[] = (result.replies || []).map((r, idx) => ({
          id: `msg_ai_${Date.now()}_${idx}`,
          senderType: r.senderType === 'butler' ? 'butler' : 'agent',
          senderId: r.senderId,
          senderName: r.senderName,
          senderHandle: r.senderHandle,
          content: r.content,
          timestamp: ts,
          linkedTaskIds: idx === result.replies.length - 1 ? createdTasks.map((t) => t.id) : undefined,
        }));

        if (aiReplies.length > 0) {
          setMessages((prev) => [...prev, ...aiReplies]);
        }

        if (createdTasks.length > 0) {
          setRecommendation({
            recommendedCard: 'kanban',
            headline: `已自动同步 ${createdTasks.length} 张新任务卡至工作流看板`,
            reason: '任务已按预算护栏排入待接单队列，可前往看板一键触发对应专家 AI 自主执行。',
            suggestedActionLabel: '查看同步看板',
            confidenceNote: `自动同步 · +${createdTasks.length} 卡片`,
          });
          triggerCelebration();
        }
      } catch (err) {
        setAiError(err instanceof Error ? err.message : '群聊智能体响应失败');
      } finally {
        setIsAiBusy(false);
      }
    },
    [hiredAgents, messages, tasks, triggerCelebration, workspace],
  );

  const updateTaskStatus = useCallback(
    (taskId: string, nextStatus: TaskStatus) => {
      const target = tasks.find((t) => t.id === taskId);
      if (!target) return;
      const ts = nowTimeStr();

      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: nextStatus, updatedAt: ts } : t)),
      );

      if (nextStatus === 'done') {
        setMessages((prev) => [
          ...prev,
          {
            id: `msg_approve_${Date.now()}`,
            senderType: 'system',
            senderId: 'system',
            senderName: '工作流自动同步',
            senderHandle: '看板同步',
            content: `雇主已审批通过任务「${target.title}」（负责特工：${target.assigneeHandle}），交付产物已归档至加密工作区。`,
            timestamp: ts,
            linkedTaskIds: [taskId],
          },
        ]);
        triggerCelebration();
      }
    },
    [tasks, triggerCelebration],
  );

  const runAutonomousTask = useCallback(
    async (taskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;
      setAiError(null);
      setExecutingTaskId(taskId);

      // Immediately move task to in_progress
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: 'in_progress', updatedAt: nowTimeStr() } : t,
        ),
      );

      const assignedAgent = agents.find((a) => a.id === task.assigneeId);

      try {
        const result = await executeKanbanTask({
          task,
          agent: assignedAgent,
          workspace,
        });

        const safeCost = Math.min(
          Number(result.actualCostUsd) || 1.25,
          task.budgetLimitUsd,
        );
        const ts = nowTimeStr();

        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  status: 'review',
                  deliverableSummary: result.deliverableSummary,
                  deliverableArtifact: result.deliverableArtifact,
                  tokensUsed: result.tokensUsed || 28400,
                  actualCostUsd: Number(safeCost.toFixed(2)),
                  updatedAt: ts,
                }
              : t,
          ),
        );

        setWorkspace((prev) => ({
          ...prev,
          spentUsd: Number((prev.spentUsd + safeCost).toFixed(2)),
        }));

        setMessages((prev) => [
          ...prev,
          {
            id: `msg_exec_${Date.now()}`,
            senderType: 'agent',
            senderId: assignedAgent?.id || 'butler',
            senderName: assignedAgent?.name || 'Nexa 管家',
            senderHandle: assignedAgent?.handle || task.assigneeHandle,
            content: `${result.chatBroadcast}（产物路径：${result.deliverableArtifact}，实际耗费 $${safeCost.toFixed(2)}）`,
            timestamp: ts,
            linkedTaskIds: [taskId],
            costUsd: Number(safeCost.toFixed(2)),
          },
        ]);

        setRecommendation({
          recommendedCard: 'kanban',
          headline: `${task.assigneeHandle} 已提交交付物待审核`,
          reason: `「${task.title}」自主执行完毕，费用控制在预算上限内，请复核后批准归档。`,
          suggestedActionLabel: '审批交付成果',
          confidenceNote: `消耗 $${safeCost.toFixed(2)} · 已回流群聊`,
        });
        triggerCelebration();
      } catch (err) {
        setAiError(err instanceof Error ? err.message : '专家自主执行任务失败');
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: 'pending' } : t)),
        );
      } finally {
        setExecutingTaskId(null);
      }
    },
    [agents, tasks, triggerCelebration, workspace],
  );

  const askContextBrain = useCallback(
    async (userIntent?: string) => {
      setAiError(null);
      setIsAiBusy(true);
      try {
        const rec = await fetchBrainRecommendation({
          userIntent,
          perspective,
          activeCard,
          workspace,
          hiredAgents,
          tasks,
        });
        setRecommendation(rec);
        setActiveCard(rec.recommendedCard);
        if (rec.recommendedCard === 'expert') {
          setPerspective('expert');
        } else {
          setPerspective('employer');
        }
        if (rec.suggestedPrompt) {
          if (rec.recommendedCard === 'chat') {
            setChatDraftSeed(rec.suggestedPrompt);
          } else if (rec.recommendedCard === 'market') {
            setMarketRequirementSeed(rec.suggestedPrompt);
          }
        }
      } catch (err) {
        setAiError(err instanceof Error ? err.message : '情境大脑分析失败');
      } finally {
        setIsAiBusy(false);
      }
    },
    [activeCard, hiredAgents, perspective, tasks, workspace],
  );

  const saveOrPublishExpert = useCallback(
    (expert: ExpertAgent, isNew: boolean) => {
      if (isNew) {
        setAgents((prev) => [expert, ...prev]);
        setRecommendation({
          recommendedCard: 'market',
          headline: `新专家 ${expert.handle} 已上架雇主市场`,
          reason: '能力标签、历史绩效与单次定价均已实时同步，雇主现在可以在市场中筛选并雇佣。',
          suggestedActionLabel: '去市场预览效果',
          confidenceNote: '供给端发布成功',
        });
      } else {
        setAgents((prev) => prev.map((a) => (a.id === expert.id ? expert : a)));
      }
      triggerCelebration();
    },
    [triggerCelebration],
  );

  return {
    perspective,
    switchPerspective,
    activeCard,
    setActiveCard,
    workspace,
    agents,
    hiredIds,
    hiredAgents,
    tasks,
    messages,
    airobotState,
    isAiBusy,
    executingTaskId,
    aiError,
    clearAiError: () => setAiError(null),
    recommendation,
    chatDraftSeed,
    clearChatDraftSeed: () => setChatDraftSeed(''),
    marketRequirementSeed,
    clearMarketRequirementSeed: () => setMarketRequirementSeed(''),
    hireAgent,
    releaseAgent,
    sendGroupMessage,
    updateTaskStatus,
    runAutonomousTask,
    askContextBrain,
    saveOrPublishExpert,
  };
}
