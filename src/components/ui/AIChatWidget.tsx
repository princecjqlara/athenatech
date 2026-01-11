'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Search, TrendingUp, Users, Image, Sparkles, ChevronDown, Plus, History, Trash2 } from 'lucide-react';

interface ChatMessage {
    id: string;
    type: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    results?: SearchResult[];
}

interface Conversation {
    id: string;
    title: string;
    messages: ChatMessage[];
    createdAt: Date;
    updatedAt: Date;
}

interface SearchResult {
    type: 'lead' | 'ad' | 'campaign' | 'creative' | 'user';
    id: string;
    name: string;
    detail: string;
    metric?: string;
}

// Simulated search data
const mockLeads = [
    { id: 'l1', name: 'John Smith', email: 'john@example.com', status: 'new', value: 5000 },
    { id: 'l2', name: 'Sarah Johnson', email: 'sarah@company.com', status: 'contacted', value: 12000 },
    { id: 'l3', name: 'Mike Chen', email: 'mike@startup.io', status: 'qualified', value: 8500 },
    { id: 'l4', name: 'Emily Davis', email: 'emily@tech.co', status: 'converted', value: 25000 },
];

const mockCampaigns = [
    { id: 'c1', name: 'Summer Sale', spend: 15000, roas: 4.2 },
    { id: 'c2', name: 'Winter Promo', spend: 8000, roas: 3.1 },
    { id: 'c3', name: 'Spring Launch', spend: 22000, roas: 5.5 },
    { id: 'c4', name: 'Holiday Special', spend: 18000, roas: 2.8 },
];

const mockCreatives = [
    { id: 'cr1', name: 'Video Ad - Product Demo', ctr: 4.2, roas: 5.1 },
    { id: 'cr2', name: 'Carousel - Features', ctr: 3.1, roas: 3.8 },
    { id: 'cr3', name: 'Image - Testimonial', ctr: 2.8, roas: 4.2 },
    { id: 'cr4', name: 'Reel - Behind Scenes', ctr: 5.5, roas: 6.2 },
];

const mockUsers = [
    { id: 'u1', name: 'Admin User', email: 'admin@athena.io', role: 'admin', campaigns: 12 },
    { id: 'u2', name: 'Marketing Manager', email: 'marketing@company.com', role: 'manager', campaigns: 8 },
    { id: 'u3', name: 'Creative Director', email: 'creative@agency.co', role: 'user', campaigns: 15 },
    { id: 'u4', name: 'Growth Lead', email: 'growth@startup.io', role: 'user', campaigns: 6 },
    { id: 'u5', name: 'Demo User', email: 'demo@test.com', role: 'demo', campaigns: 3 },
];

const quickQuestions = [
    { icon: TrendingUp, text: 'What are my top performing campaigns?' },
    { icon: Users, text: 'Show me all users' },
    { icon: Image, text: 'Which creatives have best ROAS?' },
    { icon: Sparkles, text: 'Suggest new ad angles' },
];

function searchData(query: string): SearchResult[] {
    const results: SearchResult[] = [];
    const q = query.toLowerCase();

    // Search leads
    mockLeads.filter(l =>
        l.name.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        l.status.toLowerCase().includes(q)
    ).forEach(lead => {
        results.push({
            type: 'lead',
            id: lead.id,
            name: lead.name,
            detail: `${lead.email} • ${lead.status}`,
            metric: lead.status === 'converted' ? `₱${lead.value.toLocaleString()}` : undefined,
        });
    });

    // Search campaigns
    mockCampaigns.filter(c => c.name.toLowerCase().includes(q)).forEach(camp => {
        results.push({
            type: 'campaign',
            id: camp.id,
            name: camp.name,
            detail: `₱${camp.spend.toLocaleString()} spend`,
            metric: `${camp.roas.toFixed(1)}x ROAS`,
        });
    });

    // Search creatives
    mockCreatives.filter(c => c.name.toLowerCase().includes(q)).forEach(creative => {
        results.push({
            type: 'creative',
            id: creative.id,
            name: creative.name,
            detail: `${creative.ctr.toFixed(1)}% CTR`,
            metric: `${creative.roas.toFixed(1)}x ROAS`,
        });
    });

    // Search users
    mockUsers.filter(u =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    ).forEach(user => {
        results.push({
            type: 'user',
            id: user.id,
            name: user.name,
            detail: `${user.email} • ${user.role}`,
            metric: `${user.campaigns} campaigns`,
        });
    });

    return results.slice(0, 8);
}

function generateAIResponse(query: string): { response: string; results: SearchResult[] } {
    const q = query.toLowerCase();

    // Handle specific queries
    if (q.includes('top') && q.includes('campaign')) {
        const topCampaigns = mockCampaigns.sort((a, b) => b.roas - a.roas).slice(0, 3);
        return {
            response: `Your top 3 campaigns by ROAS are:`,
            results: topCampaigns.map(c => ({
                type: 'campaign',
                id: c.id,
                name: c.name,
                detail: `₱${c.spend.toLocaleString()} spend`,
                metric: `${c.roas.toFixed(1)}x ROAS`,
            })),
        };
    }

    if (q.includes('converted') && q.includes('lead')) {
        const converted = mockLeads.filter(l => l.status === 'converted');
        return {
            response: `Found ${converted.length} converted lead(s):`,
            results: converted.map(l => ({
                type: 'lead',
                id: l.id,
                name: l.name,
                detail: l.email,
                metric: `₱${l.value.toLocaleString()}`,
            })),
        };
    }

    if (q.includes('user') || q.includes('team') || q.includes('member')) {
        return {
            response: `Found ${mockUsers.length} user(s):`,
            results: mockUsers.map(u => ({
                type: 'user',
                id: u.id,
                name: u.name,
                detail: `${u.email} • ${u.role}`,
                metric: `${u.campaigns} campaigns`,
            })),
        };
    }

    if (q.includes('creative') && (q.includes('roas') || q.includes('best'))) {
        const topCreatives = mockCreatives.sort((a, b) => b.roas - a.roas).slice(0, 3);
        return {
            response: `Top performing creatives by ROAS:`,
            results: topCreatives.map(c => ({
                type: 'creative',
                id: c.id,
                name: c.name,
                detail: `${c.ctr.toFixed(1)}% CTR`,
                metric: `${c.roas.toFixed(1)}x ROAS`,
            })),
        };
    }

    if (q.includes('suggest') || q.includes('angle') || q.includes('new')) {
        return {
            response: `Based on your top performers, I suggest:\n• Try UGC-style testimonials (performing 3.2x better)\n• Test 9:16 format for Stories/Reels\n• Experiment with Problem-Solution hooks\n• Add behind-the-scenes content`,
            results: [],
        };
    }

    // General search
    const results = searchData(query);
    if (results.length > 0) {
        return {
            response: `Found ${results.length} result(s) for "${query}":`,
            results,
        };
    }

    return {
        response: `I can help you search through:\n• Users (names, emails, roles)\n• Leads (names, emails, status)\n• Campaigns (by name or performance)\n• Creatives (by name or metrics)\n\nTry asking about "users" or "top campaigns"!`,
        results: [],
    };
}

export function AIChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: 'welcome',
            type: 'assistant',
            content: 'Hi! I can search through users, algorithms, leads, ads, and creatives. What would you like to find?',
            timestamp: new Date(),
        }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Load conversations from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('athena-conversations');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setConversations(parsed.map((c: Conversation) => ({
                    ...c,
                    createdAt: new Date(c.createdAt),
                    updatedAt: new Date(c.updatedAt),
                    messages: c.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) }))
                })));
            } catch (e) {
                console.error('Failed to parse conversations:', e);
            }
        }
    }, []);

    // Save conversations to localStorage when they change
    useEffect(() => {
        if (conversations.length > 0) {
            localStorage.setItem('athena-conversations', JSON.stringify(conversations));
        }
    }, [conversations]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const startNewConversation = () => {
        // Save current conversation if it has user messages
        if (messages.length > 1) {
            const title = messages.find(m => m.type === 'user')?.content.slice(0, 30) || 'New Chat';
            const newConvo: Conversation = {
                id: currentConversationId || `conv-${Date.now()}`,
                title: title + (title.length >= 30 ? '...' : ''),
                messages,
                createdAt: currentConversationId ? conversations.find(c => c.id === currentConversationId)?.createdAt || new Date() : new Date(),
                updatedAt: new Date(),
            };
            setConversations(prev => {
                const existing = prev.findIndex(c => c.id === newConvo.id);
                if (existing >= 0) {
                    const updated = [...prev];
                    updated[existing] = newConvo;
                    return updated;
                }
                return [newConvo, ...prev].slice(0, 20); // Keep last 20 conversations
            });
        }

        // Reset to new conversation
        setCurrentConversationId(null);
        setMessages([{
            id: 'welcome',
            type: 'assistant',
            content: 'Hi! Starting a new conversation. What would you like to find?',
            timestamp: new Date(),
        }]);
        setShowHistory(false);
    };

    const loadConversation = (conv: Conversation) => {
        setCurrentConversationId(conv.id);
        setMessages(conv.messages);
        setShowHistory(false);
    };

    const deleteConversation = (convId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setConversations(prev => prev.filter(c => c.id !== convId));
        if (currentConversationId === convId) {
            startNewConversation();
        }
    };

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMessage: ChatMessage = {
            id: `user-${Date.now()}`,
            type: 'user',
            content: input,
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsTyping(true);

        // Simulate AI thinking
        await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 500));

        const { response, results } = generateAIResponse(input);

        const assistantMessage: ChatMessage = {
            id: `assistant-${Date.now()}`,
            type: 'assistant',
            content: response,
            timestamp: new Date(),
            results,
        };

        setMessages(prev => [...prev, assistantMessage]);
        setIsTyping(false);
    };

    const handleQuickQuestion = (question: string) => {
        setInput(question);
    };

    const getTypeIcon = (type: SearchResult['type']) => {
        switch (type) {
            case 'lead': return <Users size={12} />;
            case 'user': return <Users size={12} />;
            case 'campaign': return <TrendingUp size={12} />;
            case 'creative': return <Image size={12} />;
            default: return <Search size={12} />;
        }
    };

    const getTypeColor = (type: SearchResult['type']) => {
        switch (type) {
            case 'lead': return '#87CEEB';
            case 'user': return '#DDA0DD';
            case 'campaign': return '#90EE90';
            case 'creative': return '#FFD580';
            default: return '#DDA0DD';
        }
    };

    return (
        <>
            {/* Floating Button */}
            <motion.button
                onClick={() => setIsOpen(true)}
                className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] shadow-lg flex items-center justify-center ${isOpen ? 'hidden' : ''}`}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
            >
                <MessageCircle size={24} className="text-white" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center">
                    <Sparkles size={10} className="text-white" />
                </span>
            </motion.button>

            {/* Chat Panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="fixed bottom-6 right-6 z-50 w-[380px] h-[520px] bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-[var(--glass-border)] bg-gradient-to-r from-[var(--accent-primary)]/10 to-transparent">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--accent-primary)] to-purple-500 flex items-center justify-center">
                                    <Sparkles size={16} className="text-white" />
                                </div>
                                <div>
                                    <div className="font-semibold text-sm">Athena AI</div>
                                    <div className="text-[10px] text-[var(--text-muted)]">
                                        {showHistory ? 'Conversation History' : 'Search across everything'}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={startNewConversation}
                                    className="btn-icon w-8 h-8"
                                    title="New conversation"
                                >
                                    <Plus size={16} />
                                </button>
                                <button
                                    onClick={() => setShowHistory(!showHistory)}
                                    className={`btn-icon w-8 h-8 ${showHistory ? 'text-[var(--accent-primary)]' : ''}`}
                                    title="History"
                                >
                                    <History size={16} />
                                </button>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="btn-icon w-8 h-8"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {/* History Panel */}
                        <AnimatePresence>
                            {showHistory && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="border-b border-[var(--glass-border)] overflow-hidden"
                                >
                                    <div className="p-2 max-h-48 overflow-y-auto">
                                        {conversations.length === 0 ? (
                                            <div className="text-center text-[var(--text-muted)] text-xs py-4">
                                                No conversations yet
                                            </div>
                                        ) : (
                                            conversations.map(conv => (
                                                <div
                                                    key={conv.id}
                                                    onClick={() => loadConversation(conv)}
                                                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer hover:bg-[var(--glass-bg)] transition-colors ${currentConversationId === conv.id ? 'bg-[var(--accent-soft)]' : ''}`}
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-xs font-medium truncate">{conv.title}</div>
                                                        <div className="text-[10px] text-[var(--text-muted)]">
                                                            {conv.messages.length} messages • {new Date(conv.updatedAt).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={(e) => deleteConversation(conv.id, e)}
                                                        className="btn-icon w-6 h-6 opacity-50 hover:opacity-100 hover:text-red-400"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {messages.map(message => (
                                <motion.div
                                    key={message.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div className={`max-w-[85%] ${message.type === 'user'
                                        ? 'bg-[var(--accent-primary)] text-white rounded-2xl rounded-br-md'
                                        : 'bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-2xl rounded-bl-md'
                                        } px-4 py-2.5`}>
                                        <div className="text-sm whitespace-pre-wrap">{message.content}</div>

                                        {/* Search Results */}
                                        {message.results && message.results.length > 0 && (
                                            <div className="mt-3 space-y-2">
                                                {message.results.map(result => (
                                                    <div
                                                        key={result.id}
                                                        className="p-2 bg-[var(--bg-primary)]/50 rounded-lg border border-[var(--glass-border)] hover:border-[var(--accent-primary)]/30 cursor-pointer transition-all"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <div style={{ color: getTypeColor(result.type) }}>
                                                                {getTypeIcon(result.type)}
                                                            </div>
                                                            <span className="text-xs font-medium">{result.name}</span>
                                                            {result.metric && (
                                                                <span className="ml-auto text-[10px] font-medium" style={{ color: getTypeColor(result.type) }}>
                                                                    {result.metric}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-[10px] text-[var(--text-muted)] mt-1 ml-5">
                                                            {result.detail}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            ))}

                            {/* Typing Indicator */}
                            {isTyping && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="flex items-center gap-2 text-[var(--text-muted)]"
                                >
                                    <div className="flex gap-1">
                                        <span className="w-2 h-2 bg-[var(--text-muted)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <span className="w-2 h-2 bg-[var(--text-muted)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <span className="w-2 h-2 bg-[var(--text-muted)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </motion.div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>

                        {/* Quick Questions */}
                        {messages.length <= 1 && (
                            <div className="px-4 pb-2">
                                <div className="text-[10px] text-[var(--text-muted)] mb-2">Quick questions:</div>
                                <div className="grid grid-cols-2 gap-2">
                                    {quickQuestions.map((q, i) => (
                                        <button
                                            key={i}
                                            onClick={() => handleQuickQuestion(q.text)}
                                            className="flex items-center gap-2 p-2 text-left text-[10px] bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-lg hover:border-[var(--accent-primary)]/30 transition-all"
                                        >
                                            <q.icon size={12} className="text-[var(--accent-primary)] flex-shrink-0" />
                                            <span className="line-clamp-2">{q.text}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Input */}
                        <div className="p-3 border-t border-[var(--glass-border)]">
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                    placeholder="Ask about leads, ads, campaigns..."
                                    className="input flex-1 text-sm py-2"
                                />
                                <motion.button
                                    onClick={handleSend}
                                    disabled={!input.trim()}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="btn-primary w-10 h-10 p-0 flex items-center justify-center disabled:opacity-50"
                                >
                                    <Send size={16} />
                                </motion.button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

export default AIChatWidget;
