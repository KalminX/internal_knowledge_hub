'use client';

import React from 'react';
import {
  MessageSquare,
  FileText,
  Users,
  BarChart3,
  AlertCircle,
  ShieldCheck,
  Share2,
  Lock,
  Building2
} from 'lucide-react';
import { ActiveSession } from '@/lib/auth/session';

export type ActiveTab = 'chat' | 'documents' | 'members' | 'analytics' | 'gaps' | 'audit' | 'integrations';

interface SidebarProps {
  currentTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  session: ActiveSession | null;
  demoUsers: Array<{
    id: string;
    fullName: string;
    email: string;
    role: string;
    department?: string;
  }>;
  onSwitchUser: (userId: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  session,
  demoUsers,
  onSwitchUser,
}) => {
  const isAdmin = session?.role === 'admin' || session?.role === 'owner';
  const isEditor = session?.role === 'editor' || isAdmin;

  return (
    <aside className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col h-screen shrink-0 select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-semibold text-slate-100 text-sm tracking-tight leading-tight">Secure Knowledge Hub</h1>
            <p className="text-xs text-blue-400 font-medium">Enterprise RAG MVP</p>
          </div>
        </div>
      </div>

      {/* Role / User Switcher */}
      <div className="p-3 border-b border-slate-800/80 bg-slate-950/40">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
          <span>Active Test Persona</span>
          <span className="text-[10px] text-emerald-400 font-mono">RBAC Live</span>
        </label>
        <select
          value={session?.user.id || ''}
          onChange={(e) => onSwitchUser(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {demoUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName} ({u.role.toUpperCase()})
            </option>
          ))}
        </select>
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <Building2 className="w-3 h-3 text-slate-500" />
            {session?.user.id.startsWith('999') ? 'External Org' : 'Acme Global'}
          </span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 capitalize border border-slate-700">
            {session?.role}
          </span>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 py-1">
          Knowledge Workspace
        </div>

        <button
          onClick={() => onSelectTab('chat')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            currentTab === 'chat'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <MessageSquare className="w-4 h-4 shrink-0" />
          <span>Knowledge Assistant</span>
        </button>

        <button
          onClick={() => onSelectTab('documents')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            currentTab === 'documents'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4 shrink-0" />
          <span>Document Library</span>
        </button>

        <button
          onClick={() => onSelectTab('integrations')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            currentTab === 'integrations'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Share2 className="w-4 h-4 shrink-0" />
          <span>Cloud Connectors</span>
        </button>

        {/* Administration Section */}
        <div className="pt-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 py-1 flex items-center justify-between">
          <span>Administration</span>
          {!isAdmin && <span className="text-[9px] text-amber-500/80 font-normal">Admin Only</span>}
        </div>

        <button
          disabled={!isAdmin}
          onClick={() => onSelectTab('members')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            !isAdmin
              ? 'opacity-40 cursor-not-allowed text-slate-500'
              : currentTab === 'members'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4 shrink-0" />
          <span>Members & Roles</span>
        </button>

        <button
          disabled={!isAdmin}
          onClick={() => onSelectTab('analytics')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            !isAdmin
              ? 'opacity-40 cursor-not-allowed text-slate-500'
              : currentTab === 'analytics'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <BarChart3 className="w-4 h-4 shrink-0" />
          <span>Usage Analytics</span>
        </button>

        <button
          disabled={!isAdmin}
          onClick={() => onSelectTab('gaps')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            !isAdmin
              ? 'opacity-40 cursor-not-allowed text-slate-500'
              : currentTab === 'gaps'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Knowledge Gaps</span>
        </button>

        <button
          disabled={!isAdmin}
          onClick={() => onSelectTab('audit')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            !isAdmin
              ? 'opacity-40 cursor-not-allowed text-slate-500'
              : currentTab === 'audit'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>Security Audit Logs</span>
        </button>
      </nav>

      {/* Footer info */}
      <div className="p-3 border-t border-slate-800 text-[11px] text-slate-400 bg-slate-950/60">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-300">{session?.user.fullName}</span>
          <span className="text-[10px] text-slate-400">{session?.department}</span>
        </div>
        <div className="text-[10px] text-slate-500 truncate mt-0.5">{session?.user.email}</div>
      </div>
    </aside>
  );
};
