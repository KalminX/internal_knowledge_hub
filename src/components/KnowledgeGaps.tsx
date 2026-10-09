'use client';

import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Clock, Search, FileQuestion, ArrowRight } from 'lucide-react';
import { ActiveSession } from '@/lib/auth/session';
import { UnansweredQuestion } from '@/lib/types';

interface KnowledgeGapsProps {
  session: ActiveSession | null;
}

export const KnowledgeGaps: React.FC<KnowledgeGapsProps> = ({ session }) => {
  const [gaps, setGaps] = useState<UnansweredQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGaps();
  }, [session?.organizationId]);

  const loadGaps = async () => {
    try {
      const res = await fetch('/api/admin/gaps');
      if (res.ok) {
        const data = await res.json();
        setGaps(data.gaps || []);
      }
    } catch (err) {
      console.error('Failed to load knowledge gaps:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (gapId: string, status: UnansweredQuestion['status']) => {
    try {
      const res = await fetch('/api/admin/gaps', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gapId, status }),
      });
      if (res.ok) {
        loadGaps();
      }
    } catch (err) {
      console.error('Failed to update gap status:', err);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-950 text-slate-100 p-8">
      <div className="pb-6 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            <span>Knowledge Gaps & Unanswered Questions</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Questions where the assistant abstained or users flagged missing documentation, queued for editorial review.
          </p>
        </div>
      </div>

      <div className="mt-6 flex-1 overflow-y-auto border border-slate-800 rounded-xl bg-slate-900/60">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px] font-semibold sticky top-0">
            <tr>
              <th className="px-4 py-3">Unanswered Question</th>
              <th className="px-4 py-3">Trigger Reason</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Reported At</th>
              <th className="px-4 py-3 text-right">Workflow Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {gaps.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No knowledge gaps currently open! All queries have been answered or resolved.
                </td>
              </tr>
            ) : (
              gaps.map((gap) => (
                <tr key={gap.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3.5 font-medium text-slate-200 max-w-md">
                    <div className="flex items-start gap-2">
                      <FileQuestion className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>{gap.questionText}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-slate-400">{gap.reason}</td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        gap.status === 'addressed'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : gap.status === 'reviewed'
                          ? 'bg-blue-950 text-blue-400 border border-blue-800'
                          : 'bg-amber-950 text-amber-400 border border-amber-800'
                      }`}
                    >
                      {gap.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-slate-400 font-mono text-[11px]">
                    {new Date(gap.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <select
                      value={gap.status}
                      onChange={(e) => handleUpdateStatus(gap.id, e.target.value as any)}
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none"
                    >
                      <option value="pending">Pending</option>
                      <option value="reviewed">In Review</option>
                      <option value="addressed">Addressed (Doc Added)</option>
                      <option value="dismissed">Dismissed</option>
                    </select>
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
