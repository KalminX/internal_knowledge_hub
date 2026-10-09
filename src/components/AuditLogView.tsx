'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, Activity, Eye, Terminal } from 'lucide-react';
import { ActiveSession } from '@/lib/auth/session';
import { AuditLog } from '@/lib/types';

interface AuditLogViewProps {
  session: ActiveSession | null;
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ session }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAuditLogs();
  }, [session?.organizationId]);

  const loadAuditLogs = async () => {
    try {
      const res = await fetch('/api/admin/audit');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-950 text-slate-100 p-8">
      <div className="pb-6 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            <span>Security & Compliance Audit Stream</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Immutable log of administrative operations, document ingestion, permission changes, and RAG queries.
          </p>
        </div>
      </div>

      <div className="mt-6 flex-1 overflow-y-auto border border-slate-800 rounded-xl bg-slate-900/60">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px] font-semibold sticky top-0">
            <tr>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Action Event</th>
              <th className="px-4 py-3">Entity Type</th>
              <th className="px-4 py-3">Metadata Context</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500 font-sans">
                  No audit logs recorded yet.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3 text-slate-400">
                    {new Date(log.createdAt).toISOString().replace('T', ' ').slice(0, 19)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 border border-slate-700 text-blue-400 font-semibold">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300 capitalize">{log.entityType}</td>
                  <td className="px-4 py-3 text-slate-400 truncate max-w-xs">
                    {JSON.stringify(log.metadata || {})}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
