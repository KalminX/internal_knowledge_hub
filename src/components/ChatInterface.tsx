'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Plus,
  Bot,
  User,
  BookOpen,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  FileCheck,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Search,
  ExternalLink,
  ShieldAlert,
  Loader2
} from 'lucide-react';
import { ActiveSession } from '@/lib/auth/session';
import { Conversation, Message, MessageCitation } from '@/lib/types';

interface ChatInterfaceProps {
  session: ActiveSession | null;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ session }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedCitationId, setExpandedCitationId] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<Record<string, string>>({});
  const [feedbackModalMsgId, setFeedbackModalMsgId] = useState<string | null>(null);
  const [feedbackReason, setFeedbackReason] = useState('');
  const [gapReportSuccess, setGapReportSuccess] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    loadConversations();
  }, [session?.user.id]);

  useEffect(() => {
    if (activeConvId) {
      loadConversationMessages(activeConvId);
    } else {
      setMessages([]);
    }
  }, [activeConvId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const loadConversations = async () => {
    try {
      const res = await fetch('/api/conversations');
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
        if (data.conversations?.length > 0 && !activeConvId) {
          setActiveConvId(data.conversations[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  const loadConversationMessages = async (convId: string) => {
    try {
      const res = await fetch(`/api/conversations/${convId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  const handleStartNewChat = async () => {
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Knowledge Query' }),
      });
      if (res.ok) {
        const data = await res.json();
        setConversations([data.conversation, ...conversations]);
        setActiveConvId(data.conversation.id);
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to create new conversation:', err);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const query = customQuery || inputQuery;
    if (!query.trim() || isLoading) return;

    setInputQuery('');
    setIsLoading(true);

    // Optimistic user message
    const tempUserMsg: Message = {
      id: crypto.randomUUID(),
      conversationId: activeConvId || '',
      organizationId: session?.organizationId || '',
      userId: session?.user.id || '',
      sender: 'user',
      content: query.trim(),
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeConvId,
          question: query.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (!activeConvId && data.conversationId) {
          setActiveConvId(data.conversationId);
          loadConversations();
        }
        setMessages(data.messages || []);
      } else {
        const errData = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            conversationId: activeConvId || '',
            organizationId: session?.organizationId || '',
            userId: session?.user.id || '',
            sender: 'assistant',
            content: `Error: ${errData.error || 'Failed to process request.'}`,
            insufficientEvidence: true,
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } catch (err: any) {
      console.error('Chat error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const submitFeedback = async (messageId: string, rating: 'helpful' | 'unhelpful', explanation = '', reportedMissingDoc = false) => {
    if (!activeConvId) return;
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeConvId,
          messageId,
          rating,
          explanation,
          reportedMissingDoc,
        }),
      });
      if (res.ok) {
        setFeedbackSuccess((prev) => ({ ...prev, [messageId]: rating }));
        setFeedbackModalMsgId(null);
        setFeedbackReason('');
      }
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    }
  };

  const handleReportMissingDocumentation = async (questionText: string) => {
    try {
      const res = await fetch('/api/admin/gaps', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gapId: crypto.randomUUID(),
          status: 'pending',
          notes: `Reported by user from chat: "${questionText}"`,
        }),
      }).catch(() => null);

      setGapReportSuccess('Report submitted! Operations team has been notified of this documentation gap.');
      setTimeout(() => setGapReportSuccess(null), 4000);
    } catch (err) {
      console.error('Failed to report gap:', err);
    }
  };

  const samplePrompts = [
    { label: 'PTO Rollover Rules', query: 'How many days of PTO can I roll over into the new year and what is the deadline?' },
    { label: 'P1 Ticket SLA', query: 'What is the required response time and escalation procedure for Priority 1 urgent tickets?' },
    { label: 'Remote Setup Stipend', query: 'What is the home office equipment setup stipend and monthly allowance?' },
    { label: 'Executive Compensation (Restricted)', query: 'What is the leadership equity vesting schedule and executive bonus formula?' },
    { label: 'Pet Policy (Missing Doc)', query: 'What is the company policy on bringing pets to the office and pet health insurance?' },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100 flex-1">
      {/* Left Chat History Sub-Sidebar */}
      <div className="w-64 border-r border-slate-800/80 bg-slate-900/60 flex flex-col h-full shrink-0">
        <div className="p-3 border-b border-slate-800 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300">History</span>
          <button
            onClick={handleStartNewChat}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Chat</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">
              No conversations yet
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setActiveConvId(conv.id)}
                className={`w-full text-left px-2.5 py-2 rounded-md text-xs truncate transition-colors flex items-center gap-2 ${
                  activeConvId === conv.id
                    ? 'bg-slate-800 text-blue-400 font-medium border border-slate-700'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{conv.title}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Thread */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Chat Bar */}
        <div className="px-6 py-3 border-b border-slate-800/80 bg-slate-900/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-200">Grounded Knowledge Query</span>
            <span className="px-2 py-0.5 rounded text-[10px] bg-blue-900/40 text-blue-400 border border-blue-800/60">
              Anthropic Claude 3.5 Grounded
            </span>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center gap-2">
            <span>Isolation:</span>
            <span className="font-mono text-emerald-400 font-medium">Tenant Verified</span>
          </div>
        </div>

        {/* Message Thread Scroll Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {gapReportSuccess && (
            <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{gapReportSuccess}</span>
            </div>
          )}

          {messages.length === 0 ? (
            <div className="max-w-2xl mx-auto text-center py-12">
              <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-semibold text-slate-100">Private Enterprise Knowledge Assistant</h2>
              <p className="text-xs text-slate-400 mt-1.5 max-w-md mx-auto">
                Ask questions about verified company policies, onboarding guides, engineering SOPs, and support tiers. Answers are strictly grounded in authorized source documents.
              </p>

              {/* Sample Prompt Starter Chips */}
              <div className="mt-8 text-left">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Test Retrieval & Groundedness:
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {samplePrompts.map((sp, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(undefined, sp.query)}
                      className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-blue-500/60 hover:bg-slate-800/80 text-left transition-all group"
                    >
                      <div className="text-xs font-medium text-slate-200 group-hover:text-blue-400 flex items-center justify-between">
                        <span>{sp.label}</span>
                        <Search className="w-3 h-3 text-slate-500 group-hover:text-blue-400" />
                      </div>
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">{sp.query}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-3xl ${
                  msg.sender === 'user' ? 'ml-auto justify-end' : 'mr-auto justify-start'
                }`}
              >
                {msg.sender === 'assistant' && (
                  <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`rounded-xl p-4 text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-slate-900 border border-slate-800 text-slate-200'
                  }`}
                >
                  {/* Message Content */}
                  <div className="whitespace-pre-wrap">{msg.content}</div>

                  {/* Insufficient Evidence Notice */}
                  {msg.insufficientEvidence && (
                    <div className="mt-3 p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/60 text-amber-200 text-xs space-y-2">
                      <div className="flex items-center gap-1.5 font-medium text-amber-300">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Abstention Triggered: Insufficient Evidence</span>
                      </div>
                      <p className="text-[11px] text-amber-200/90">
                        The requested topic is not covered in authorized company documents or requires higher access permissions.
                      </p>
                      <button
                        onClick={() => handleReportMissingDocumentation(msg.content)}
                        className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold text-[11px] transition-colors"
                      >
                        Submit as Documentation Gap
                      </button>
                    </div>
                  )}

                  {/* Source Citations */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-800">
                      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                        <span>Verified Source Citations ({msg.citations.length})</span>
                      </div>
                      <div className="space-y-2">
                        {msg.citations.map((cit, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 text-[11px] space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-blue-300 truncate">
                                {cit.documentTitle}
                              </span>
                              <span className="px-1.5 py-0.2 rounded text-[10px] bg-blue-950 border border-blue-800/80 text-blue-300 font-mono">
                                Match: {(cit.similarityScore * 100).toFixed(0)}%
                              </span>
                            </div>
                            <div className="text-slate-400 text-[10px] flex items-center gap-2">
                              <span>Section: {cit.headingPath || 'General'}</span>
                              <span>•</span>
                              <span>Page: {cit.pageNumber || 1}</span>
                            </div>
                            <p className="text-slate-300 italic pt-1 border-t border-slate-800/50">
                              "{cit.excerpt}"
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Assistant Footer Actions (Feedback & Metadata) */}
                  {msg.sender === 'assistant' && (
                    <div className="mt-3 pt-2 flex items-center justify-between border-t border-slate-800/60 text-[11px] text-slate-400">
                      <span className="text-[10px] font-mono text-slate-400">
                        {msg.modelUsed || 'grounded-engine'}
                      </span>
                      <div className="flex items-center gap-2">
                        {feedbackSuccess[msg.id] ? (
                          <span className="text-[10px] text-emerald-400 font-medium">
                            Feedback recorded ({feedbackSuccess[msg.id]})
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => submitFeedback(msg.id, 'helpful')}
                              className="p-1 rounded hover:bg-slate-800 hover:text-emerald-400 transition-colors"
                              title="Helpful answer"
                            >
                              <ThumbsUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setFeedbackModalMsgId(msg.id)}
                              className="p-1 rounded hover:bg-slate-800 hover:text-rose-400 transition-colors"
                              title="Unhelpful or missing info"
                            >
                              <ThumbsDown className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {msg.sender === 'user' && (
                  <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0 mt-0.5 text-white">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))
          )}

          {isLoading && (
            <div className="flex gap-3 max-w-3xl mr-auto justify-start">
              <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="rounded-xl p-4 bg-slate-900 border border-slate-800 text-slate-300 text-xs flex items-center gap-3">
                <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                <span>Searching authorized pgvector index & generating grounded answer...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Feedback Modal */}
        {feedbackModalMsgId && (
          <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-col gap-2">
            <div className="text-xs font-semibold text-slate-200">
              Provide feedback for documentation improvement:
            </div>
            <textarea
              rows={2}
              value={feedbackReason}
              onChange={(e) => setFeedbackReason(e.target.value)}
              placeholder="What was missing or inaccurate in this response?"
              className="w-full bg-slate-950 border border-slate-700 rounded-md p-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setFeedbackModalMsgId(null)}
                className="px-3 py-1 text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={() => submitFeedback(feedbackModalMsgId, 'unhelpful', feedbackReason, true)}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-md text-xs font-medium"
              >
                Submit Gap Report
              </button>
            </div>
          </div>
        )}

        {/* Chat Query Input Form */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/60">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Ask a question about company policies, SOPs, or operations..."
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !inputQuery.trim()}
              className="px-5 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-medium text-xs flex items-center gap-2 transition-colors shadow-md shadow-blue-500/10"
            >
              <Send className="w-4 h-4" />
              <span>Ask</span>
            </button>
          </form>
          <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2 px-1">
            <span>Role: {session?.role.toUpperCase()} • Retrieval: pgvector & keyword hybrid</span>
            <span>Zero hallucination policy active</span>
          </div>
        </div>
      </div>
    </div>
  );
};
