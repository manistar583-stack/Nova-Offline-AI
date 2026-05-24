import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Image as ImageIcon, Paperclip, Zap, BrainCircuit, Microscope, X, Video, Wifi, WifiOff, Plus } from 'lucide-react';
import { Message } from './types';
import { ChatMessage } from './components/ChatMessage';

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "greeting",
      role: "assistant",
      content: "Hello! I am **Nova**, an advanced AI assistant. I can help study, code, write, and generate images. Just ask me to *generate an image* if you want to see something visually!",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'fast' | 'thinking' | 'deep-research'>('fast');
  const [networkMode, setNetworkMode] = useState<'online' | 'offline'>('online');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !selectedFile) || isLoading) return;

    let contentStr = input.trim();
    if (selectedFile) {
       contentStr = `[Attached: ${selectedFile.name}]\n` + contentStr;
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: contentStr,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSelectedFile(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content
          })),
          mode,
          networkMode
        })
      });

      if (!response.ok) {
        throw new Error("Network error");
      }

      const data = await response.json();
      
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      };
      
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error) {
      console.error(error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "❌ Sorry, I encountered an error while trying to respond.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleNewChat = () => {
    setMessages([
      {
        id: "greeting",
        role: "assistant",
        content: "Hello! I am **Nova**, an advanced AI assistant. I can help study, code, write, and generate images. Just ask me to *generate an image* if you want to see something visually!",
        timestamp: new Date()
      }
    ]);
    setInput("");
    setSelectedFile(null);
  };

  return (
    <div className="flex h-screen flex-col bg-nova-dark font-sans text-gray-200">
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-gray-800 bg-nova-surface px-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-nova-accent text-white">
            <span className="font-display font-bold">N</span>
          </div>
          <h1 className="font-display text-lg font-bold tracking-tight text-white">Nova Assistant</h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <button 
            onClick={handleNewChat}
            className="flex items-center gap-2 hover:text-gray-200 transition-colors bg-nova-dark/50 px-3 py-1.5 rounded-full border border-gray-800 shadow-sm"
          >
            <Plus size={14} className="text-gray-400" />
            New Chat
          </button>
          <button 
            onClick={() => setNetworkMode(prev => prev === 'online' ? 'offline' : 'online')}
            className="flex items-center gap-2 hover:text-gray-200 transition-colors bg-nova-dark/50 px-3 py-1.5 rounded-full border border-gray-800 shadow-sm"
          >
            {networkMode === 'online' ? <Wifi size={14} className="text-emerald-500" /> : <WifiOff size={14} className="text-amber-500" />}
            {networkMode === 'online' ? 'Online' : 'Offline Mode'}
          </button>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {isLoading && (
          <div className="flex w-full px-4 py-8 sm:px-6 bg-nova-surface">
            <div className="mx-auto flex w-full max-w-3xl gap-4 sm:gap-6 items-center">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-nova-accent text-white">
                 <Loader2 size={18} className="animate-spin" />
              </div>
              <div className="text-gray-400 text-sm font-medium animate-pulse flex items-center gap-2">
                Nova is thinking...
                {mode !== 'fast' && (
                  <span className="text-xs px-2 py-0.5 rounded bg-nova-dark border border-gray-700">
                    {mode === 'thinking' ? 'Deep Thought' : 'Extensive Research'}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} className="h-6" />
      </main>

      {/* Input Area */}
      <footer className="shrink-0 p-4 sm:p-6 pb-6 sm:pb-8">
        <div className="mx-auto max-w-3xl">
          {/* Options Toolbar */}
          <div className="mb-2.5 flex flex-wrap items-center gap-2">
            <div className="flex bg-nova-surface rounded-lg p-1 border border-gray-700 shadow-sm">
              <button
                type="button"
                onClick={() => setMode('fast')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  mode === 'fast' ? 'bg-nova-dark text-white shadow-sm ring-1 ring-gray-600' : 'text-gray-400 hover:text-gray-200 hover:bg-nova-dark/50'
                }`}
              >
                <Zap size={14} /> Fast
              </button>
              <button
                type="button"
                onClick={() => setMode('thinking')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  mode === 'thinking' ? 'bg-nova-dark text-white shadow-sm ring-1 ring-gray-600' : 'text-gray-400 hover:text-gray-200 hover:bg-nova-dark/50'
                }`}
              >
                <BrainCircuit size={14} /> Thinking
              </button>
              <button
                type="button"
                onClick={() => setMode('deep-research')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  mode === 'deep-research' ? 'bg-nova-dark text-white shadow-sm ring-1 ring-gray-600' : 'text-gray-400 hover:text-gray-200 hover:bg-nova-dark/50'
                }`}
              >
                <Microscope size={14} /> Deep Research
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                if (!input.startsWith("Generate an image of ")) {
                  setInput("Generate an image of " + input.replace(/^Generate a 30 sec video of /i, ''));
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-700 bg-nova-surface text-gray-400 hover:bg-nova-dark hover:text-gray-200 hover:border-gray-600 shadow-sm transition-colors"
            >
              <ImageIcon size={14} /> Image
            </button>
            <button
              type="button"
              onClick={() => {
                if (!input.startsWith("Generate a 30 sec video of ")) {
                  setInput("Generate a 30 sec video of " + input.replace(/^Generate an image of /i, ''));
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-700 bg-nova-surface text-gray-400 hover:bg-nova-dark hover:text-gray-200 hover:border-gray-600 shadow-sm transition-colors"
            >
              <Video size={14} /> Video
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            className="relative flex flex-col rounded-xl bg-nova-surface border border-gray-700 shadow-sm focus-within:border-nova-accent focus-within:ring-1 focus-within:ring-nova-accent transition-all"
          >
            {selectedFile && (
              <div className="flex items-center gap-2 px-3 pt-3 pb-1">
                <div className="flex items-center gap-2 rounded-md bg-nova-dark px-3 py-1.5 text-xs text-gray-300 border border-gray-700">
                   <Paperclip size={12} className="text-gray-400" />
                   <span className="truncate max-w-[200px]">{selectedFile.name}</span>
                   <button type="button" onClick={() => setSelectedFile(null)} className="text-gray-400 hover:text-white ml-1">
                     <X size={14} />
                   </button>
                </div>
              </div>
            )}
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mb-2.5 ml-2 mt-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-nova-dark hover:text-gray-200 transition-colors"
                title="Attach Files"
              >
                <Paperclip size={18} />
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    setSelectedFile(e.target.files[0]);
                  }
                }} 
              />
              <textarea
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message Nova..."
                className="max-h-52 min-h-[56px] w-full resize-none bg-transparent py-4 pl-2 pr-4 text-gray-200 placeholder-gray-500 focus:outline-none sm:text-sm"
              />
              <div className="mb-2 mr-2 flex gap-1 shrink-0">
                 <button
                  type="submit"
                  disabled={(!input.trim() && !selectedFile) || isLoading}
                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-nova-accent text-white transition-colors hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
              </div>
            </div>
          </form>
          <div className="mt-3 text-center text-xs text-gray-500">
            Nova may display inaccurate info. Always double-check.
          </div>
        </div>
      </footer>
    </div>
  );
}
