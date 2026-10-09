'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar, ActiveTab } from '@/components/Sidebar';
import { ChatInterface } from '@/components/ChatInterface';
import { DocumentLibrary } from '@/components/DocumentLibrary';
import { AdminMembers } from '@/components/AdminMembers';
import { AdminAnalytics } from '@/components/AdminAnalytics';
import { KnowledgeGaps } from '@/components/KnowledgeGaps';
import { AuditLogView } from '@/components/AuditLogView';
import { IntegrationsView } from '@/components/IntegrationsView';
import { ActiveSession } from '@/lib/auth/session';

export default function Home() {
  const [currentTab, setCurrentTab] = useState<ActiveTab>('chat');
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [demoUsers, setDemoUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSession();
  }, []);

  const fetchSession = async () => {
    try {
      const res = await fetch('/api/auth/session');
      if (res.ok) {
        const data = await res.json();
        setSession(data.session);
        setDemoUsers(data.demoUsers || []);
      }
    } catch (err) {
      console.error('Failed to load session:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchUser = async (userId: string) => {
    try {
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        await fetchSession();
      }
    } catch (err) {
      console.error('Failed to switch user:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-950 text-slate-400 text-xs">
        Initializing Secure Knowledge Hub environment...
      </div>
    );
  }

  return (
    <div className="flex w-full h-screen overflow-hidden bg-slate-950">
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        session={session}
        demoUsers={demoUsers}
        onSwitchUser={handleSwitchUser}
      />

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {currentTab === 'chat' && <ChatInterface session={session} />}
        {currentTab === 'documents' && <DocumentLibrary session={session} />}
        {currentTab === 'members' && <AdminMembers session={session} />}
        {currentTab === 'analytics' && <AdminAnalytics session={session} />}
        {currentTab === 'gaps' && <KnowledgeGaps session={session} />}
        {currentTab === 'audit' && <AuditLogView session={session} />}
        {currentTab === 'integrations' && <IntegrationsView />}
      </main>
    </div>
  );
}
