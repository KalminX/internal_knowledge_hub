'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Users,
  MessageSquare,
  AlertTriangle,
  ThumbsUp,
  FileCheck,
  CheckCircle2,
  TrendingUp,
  Layers
} from 'lucide-react';
import { ActiveSession } from '@/lib/auth/session';
import { AnalyticsSummary } from '@/lib/types';

interface AdminAnalyticsProps {
  session: ActiveSession | null;
}

export const AdminAnalytics: React.FC<AdminAnalyticsProps> = ({ session }) => {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [session?.organizationId]);

  const loadAnalytics = async () => {
    try {
      const res = await fetch('/api/admin/analytics');
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
      }
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !summary) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-950 text-slate-400 text-xs">
        Loading analytics telemetry...
      </div>
    );
  }

  const satisfactionRate = (summary.positiveFeedbackCount + summary.negativeFeedbackCount) > 0
    ? ((summary.positiveFeedbackCount / (summary.positiveFeedbackCount + summary.negativeFeedbackCount)) * 100).toFixed(0)
    : '100';

  const abstentionRate = summary.totalQuestions > 0
    ? ((summary.insufficientEvidenceCount / summary.totalQuestions) * 100).toFixed(0)
    : '0';

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-slate-950 text-slate-100 p-8 space-y-8">
      {/* Header */}
      <div className="pb-6 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-500" />
            <span>Operational RAG & Knowledge Analytics</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Telemetry on query volume, retrieval groundedness, source citation frequency, and documentation gaps.
          </p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total Questions Asked</span>
            <MessageSquare className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white">{summary.totalQuestions}</div>
          <div className="text-[11px] text-slate-500">Across all active organization sessions</div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Answer Satisfaction</span>
            <ThumbsUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">{satisfactionRate}%</div>
          <div className="text-[11px] text-slate-500">
            {summary.positiveFeedbackCount} positive / {summary.negativeFeedbackCount} negative
          </div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Abstention / Gap Rate</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400">{abstentionRate}%</div>
          <div className="text-[11px] text-slate-500">
            {summary.insufficientEvidenceCount} questions with insufficient evidence
          </div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Indexed Documents</span>
            <CheckCircle2 className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {summary.readyDocumentsCount} <span className="text-xs text-slate-400 font-normal">/ {summary.totalDocumentsCount}</span>
          </div>
          <div className="text-[11px] text-slate-500">
            {summary.failedJobsCount} failed indexing jobs
          </div>
        </div>
      </div>

      {/* Analytics Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Frequently Asked Policy Topics */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="font-semibold text-xs text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            <span>Top Queried Policy Categories</span>
          </h3>

          <div className="space-y-3">
            {summary.frequentlyAskedTopics.length === 0 ? (
              <div className="text-xs text-slate-500 py-4">No query data collected yet.</div>
            ) : (
              summary.frequentlyAskedTopics.map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium text-slate-300">
                    <span>{item.topic}</span>
                    <span className="text-slate-400 font-mono">{item.count} queries</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{
                        width: `${Math.min(100, (item.count / summary.totalQuestions) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Most Cited Documents */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="font-semibold text-xs text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-emerald-400" />
            <span>Most Cited Grounding Documents</span>
          </h3>

          <div className="space-y-2.5">
            {summary.topCitedDocuments.length === 0 ? (
              <div className="text-xs text-slate-500 py-4">No citations recorded yet.</div>
            ) : (
              summary.topCitedDocuments.map((doc, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div className="font-medium text-slate-200 truncate pr-4">
                    {idx + 1}. {doc.documentTitle}
                  </div>
                  <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-950 border border-emerald-800 text-emerald-400 shrink-0">
                    {doc.citationCount} citations
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
