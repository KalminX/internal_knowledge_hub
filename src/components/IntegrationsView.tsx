'use client';

import React from 'react';
import { Share2, Cloud, CheckCircle2, ShieldAlert, Key, FolderSync, Info } from 'lucide-react';

export const IntegrationsView: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-slate-950 text-slate-100 p-8 space-y-6">
      <div className="pb-6 border-b border-slate-800">
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <Share2 className="w-5 h-5 text-blue-500" />
          <span>Cloud Document Connectors & Ingestion Architecture</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Production interface specifications for enterprise cloud storage synchronization with automated access control mapping.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Google Drive Connector Card */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-900/40 border border-blue-800/80 text-blue-400 flex items-center justify-center font-bold">
                GD
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Google Drive Connector</h2>
                <p className="text-[11px] text-slate-400">OAuth 2.0 with Least-Privilege Scopes</p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 border border-slate-700 font-mono">
              Ready for Credentials
            </span>
          </div>

          <div className="space-y-2 text-xs text-slate-300">
            <div className="font-semibold text-slate-400 text-[11px] uppercase tracking-wider">Required OAuth Scopes:</div>
            <ul className="space-y-1 font-mono text-[11px] text-slate-400 bg-slate-950 p-3 rounded-lg border border-slate-800">
              <li>• https://www.googleapis.com/auth/drive.readonly</li>
              <li>• https://www.googleapis.com/auth/drive.metadata.readonly</li>
            </ul>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs space-y-1.5 text-slate-400">
            <div className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-blue-400" />
              <span>Configuration Parameters:</span>
            </div>
            <p className="text-[11px]">Set <code className="text-blue-300">GOOGLE_CLIENT_ID</code> and <code className="text-blue-300">GOOGLE_CLIENT_SECRET</code> in environment.</p>
          </div>
        </div>

        {/* Microsoft SharePoint Connector Card */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-900/40 border border-emerald-800/80 text-emerald-400 flex items-center justify-center font-bold">
                MS
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Microsoft SharePoint / Graph</h2>
                <p className="text-[11px] text-slate-400">Azure AD Application Permissions</p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 border border-slate-700 font-mono">
              Ready for Credentials
            </span>
          </div>

          <div className="space-y-2 text-xs text-slate-300">
            <div className="font-semibold text-slate-400 text-[11px] uppercase tracking-wider">Required Microsoft Graph Permissions:</div>
            <ul className="space-y-1 font-mono text-[11px] text-slate-400 bg-slate-950 p-3 rounded-lg border border-slate-800">
              <li>• Sites.Read.All (Application Scope)</li>
              <li>• Files.Read.All (Delegated or App)</li>
            </ul>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs space-y-1.5 text-slate-400">
            <div className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-emerald-400" />
              <span>Configuration Parameters:</span>
            </div>
            <p className="text-[11px]">Set <code className="text-emerald-300">AZURE_TENANT_ID</code>, <code className="text-emerald-300">AZURE_CLIENT_ID</code>, and <code className="text-emerald-300">AZURE_CLIENT_SECRET</code> in environment.</p>
          </div>
        </div>
      </div>

      {/* Cloud Security Architecture Card */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <FolderSync className="w-4 h-4 text-purple-400" />
          <span>Synchronized Access-Control Ingestion Lifecycle</span>
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          Cloud document imports preserve file modification timestamps, origin URLs, and document permissions. When a file is updated, restricted, or deleted in Google Drive or SharePoint, the connector synchronizes the update: old chunks are pruned from pgvector immediately to prevent stale or unauthorized knowledge leakage.
        </p>
      </div>
    </div>
  );
};
