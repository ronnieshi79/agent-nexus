import { useState, type FormEvent } from 'react';
import { CheckCircle2, KeyRound, LogIn, LogOut, ShieldCheck, X } from 'lucide-react';
import type { AgentNexusAccount } from '../../types/agentnexus';

interface AccountFooterProps {
  account: AgentNexusAccount | null;
  onOpenLogin: () => void;
  onLogout: () => void;
}

export function AccountFooter({ account, onOpenLogin, onLogout }: AccountFooterProps) {
  return (
    <div className="shrink-0 p-3.5 border-t border-slate-200 bg-white">
      {account ? (
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-sky-300 flex items-center justify-center text-xs font-bold shrink-0">
              {account.avatarInitials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-900 truncate">
                  {account.name}
                </span>
                <span className="text-[10px] font-semibold text-emerald-700 whitespace-nowrap">
                  · {account.planLabel}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 truncate">{account.email}</div>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            title="退出 AgentNexus 账号"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2.5">
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-900 truncate">AgentNexus 账号</div>
            <div className="text-[11px] text-slate-500 truncate">
              登录以同步私有节点与结算账本
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenLogin}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer transition-colors"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>登录账号</span>
          </button>
        </div>
      )}
    </div>
  );
}

interface AccountAuthModalProps {
  open: boolean;
  onClose: () => void;
  onLogin: (email: string, name?: string) => void;
}

export function AccountAuthModal({ open, onClose, onLogin }: AccountAuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('Ronnie.Shi79@gmail.com');
  const [displayName, setDisplayName] = useState('Ronnie');
  const [password, setPassword] = useState('••••••••••••');

  if (!open) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    onLogin(email.trim(), displayName.trim() || undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {mode === 'login' ? '登录 AgentNexus 账号' : '注册 AgentNexus 工作区账号'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              跨项目同步专家团队、加密云工作区与平台自动结算台账
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
            aria-label="关闭登录窗口"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switch */}
        <div className="px-6 pt-4">
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              账号密码登录
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                mode === 'register'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              快速注册开通
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                称呼 / 团队主理人名称
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="例如：Ronnie"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-600/20"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              工作邮箱 / AgentNexus ID
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-600/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              登录密码
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="输入登录密码"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-600/20"
            />
          </div>

          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5 flex items-center gap-2 text-[11px] text-slate-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>登录后自动绑定 anx-worker 私有节点凭证与 Harness 结算护栏。</span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              稍后再说
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer"
            >
              {mode === 'login' ? (
                <>
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>立即登录</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>注册并登录</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
