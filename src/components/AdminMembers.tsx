'use client';

import React, { useState, useEffect } from 'react';
import { Users, Shield, Check, AlertCircle } from 'lucide-react';
import { ActiveSession } from '@/lib/auth/session';
import { OrganizationMembership, OrgRole } from '@/lib/types';

interface AdminMembersProps {
  session: ActiveSession | null;
}

export const AdminMembers: React.FC<AdminMembersProps> = ({ session }) => {
  const [members, setMembers] = useState<OrganizationMembership[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    loadMembers();
  }, [session?.organizationId]);

  const loadMembers = async () => {
    try {
      const res = await fetch('/api/admin/members');
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
      }
    } catch (err) {
      console.error('Failed to load members:', err);
    }
  };

  const handleRoleChange = async (userId: string, newRole: OrgRole) => {
    try {
      const res = await fetch('/api/admin/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: userId, role: newRole }),
      });

      if (res.ok) {
        setStatusMessage(`Role successfully updated to ${newRole.toUpperCase()}.`);
        setTimeout(() => setStatusMessage(null), 3000);
        loadMembers();
      } else {
        const err = await res.json();
        alert(`Failed to update role: ${err.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-950 text-slate-100 p-8">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" />
            <span>Organization Members & Access Roles</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Enforce role-based access boundaries across knowledge documents and administrative workflows.
          </p>
        </div>
      </div>

      {statusMessage && (
        <div className="mt-4 p-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{statusMessage}</span>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-y-auto">
        {/* Member Table */}
        <div className="lg:col-span-2 border border-slate-800 rounded-xl bg-slate-900/60 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-800 bg-slate-900 font-semibold text-xs text-slate-300">
            Active Organization Members ({members.length})
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 text-[10px] uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Assigned Role</th>
                  <th className="px-4 py-3 text-right">Adjust Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {members.map((mem) => (
                  <tr key={mem.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-slate-200">{mem.user?.fullName || 'User'}</div>
                      <div className="text-[11px] text-slate-400">{mem.user?.email}</div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-400">{mem.department || 'General'}</td>
                    <td className="px-4 py-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-800 border border-slate-700 text-slate-300">
                        {mem.role}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <select
                        value={mem.role}
                        onChange={(e) => handleRoleChange(mem.userId, e.target.value as OrgRole)}
                        className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none"
                      >
                        <option value="owner">Owner</option>
                        <option value="admin">Admin</option>
                        <option value="editor">Editor</option>
                        <option value="member">Member</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Role Matrix Card */}
        <div className="border border-slate-800 rounded-xl bg-slate-900/60 p-5 space-y-4 h-fit text-xs">
          <h3 className="font-semibold text-slate-200 flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-400" />
            <span>Role Permissions Matrix</span>
          </h3>

          <div className="space-y-3 text-[11px]">
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
              <span className="font-bold text-blue-400 uppercase">Owner</span>
              <p className="text-slate-400 mt-0.5">
                Full organization control, role promotion, security auditing, and workspace deletion.
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
              <span className="font-bold text-emerald-400 uppercase">Admin</span>
              <p className="text-slate-400 mt-0.5">
                Upload/retire documents, edit access scopes, manage members, view full analytics & knowledge gaps.
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
              <span className="font-bold text-amber-400 uppercase">Editor</span>
              <p className="text-slate-400 mt-0.5">
                Upload and update knowledge documents, view indexing pipelines and draft statuses.
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
              <span className="font-bold text-slate-400 uppercase">Member</span>
              <p className="text-slate-400 mt-0.5">
                Ask natural-language questions and search authorized organization-wide knowledge documents.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
