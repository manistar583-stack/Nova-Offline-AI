import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Image as ImageIcon, Paperclip, Zap, BrainCircuit, Microscope, X, Video, Wifi, WifiOff, Plus, Menu, LogOut, Github, Chrome, FileClock, Webhook, Mic, MicOff, Volume2 } from 'lucide-react';
import { Message } from './types';
import { ChatMessage } from './components/ChatMessage';
import { auth, loginWithGoogle, loginWithGithub, logout, db } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, getDocs } from 'firebase/firestore';

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
  
  const [user, setUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  
  const [isRecording, setIsRecording] = useState(false);
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setShowAuthModal(false);
      } else {
        setChatHistory([]);
        setCurrentChatId(null);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'chats'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setChatHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user]);

  const loadChat = async (chatId: string) => {
    setCurrentChatId(chatId);
    setShowSidebar(false);
    try {
      const q = query(collection(db, `chats/${chatId}/messages`), orderBy('createdAt', 'asc'));
      const snapshot = await getDocs(q);
      const loadedMessages = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          role: data.role,
          content: data.content,
          timestamp: data.createdAt?.toDate() || new Date()
        };
      });
      if (loadedMessages.length > 0) {
        setMessages(loadedMessages);
      }
    } catch(err) {
      console.error("Failed to load chat", err);
    }
  };

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
      // Save user message to Firebase
      let activeChatId = currentChatId;
      if (user && !activeChatId) {
        const chatRef = await addDoc(collection(db, 'chats'), {
          userId: user.uid,
          title: contentStr.substring(0, 40) + '...',
          createdAt: serverTimestamp()
        });
        activeChatId = chatRef.id;
        setCurrentChatId(activeChatId);
      }
      if (user && activeChatId) {
        await addDoc(collection(db, `chats/${activeChatId}/messages`), {
          role: 'user',
          content: contentStr,
          createdAt: serverTimestamp()
        });
      }

      // Add deep research / google search mode param handling here
      const apiMode = mode === 'deep-research' ? 'deep-research' : mode;
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content
          })),
          mode: apiMode,
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
      
      if (user && activeChatId) {
        await addDoc(collection(db, `chats/${activeChatId}/messages`), {
          role: 'assistant',
          content: data.response,
          createdAt: serverTimestamp()
        });
      }
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
    setCurrentChatId(null);
    if(window.innerWidth < 768) setShowSidebar(false);
  };

  const toggleRecording = () => {
    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Your browser does not support Speech Recognition.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    
    let currentInput = "";
    setInput(prev => {
        currentInput = prev;
        return prev;
    });

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      if (finalTranscript) {
        currentInput += (currentInput && !currentInput.endsWith(' ') ? ' ' : '') + finalTranscript;
        setInput(currentInput);
      } else if (interimTranscript) {
        setInput(currentInput + (currentInput && !currentInput.endsWith(' ') ? ' ' : '') + interimTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  return (
    <div className="flex h-screen overflow-hidden bg-nova-dark font-sans text-gray-200">
      {/* Sidebar for Chat History */}
      <div className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-nova-surface border-r border-gray-800 transition-transform duration-300 ease-in-out md:relative md:translate-x-0 \${showSidebar ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-full flex-col">
           <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <span className="font-display font-bold text-white tracking-tight flex items-center gap-2">
                 <FileClock size={16} className="text-nova-accent"/> History
              </span>
              <button className="md:hidden text-gray-400 hover:text-white" onClick={() => setShowSidebar(false)}>
                 <X size={18} />
              </button>
           </div>
           
           <div className="flex-1 overflow-y-auto p-2">
              <button onClick={handleNewChat} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white bg-nova-accent/20 hover:bg-nova-accent/30 rounded-lg mb-4 transition-colors">
                 <Plus size={16} /> New Chat
              </button>
              
              {!user ? (
                <div className="text-center p-4">
                  <p className="text-xs text-gray-400 mb-3">Sign in to save and access your chat history across devices.</p>
                  <button onClick={() => setShowAuthModal(true)} className="w-full bg-white/10 hover:bg-white/20 text-white text-xs py-2 rounded-lg font-medium transition-colors">
                    Sign In
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {chatHistory.map((chat) => (
                    <button 
                      key={chat.id}
                      onClick={() => loadChat(chat.id)}
                      className={`text-left truncate px-3 py-2 text-sm rounded-lg transition-colors \${currentChatId === chat.id ? 'bg-nova-dark text-nova-accent font-medium' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}`}
                    >
                      {chat.title}
                    </button>
                  ))}
                  {chatHistory.length === 0 && (
                    <p className="text-xs text-gray-500 text-center py-4">No recent chats.</p>
                  )}
                </div>
              )}
           </div>
           
           {user && (
             <div className="p-4 border-t border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-2 truncate flex-1">
                  <img src={user.photoURL || `https://ui-avatars.com/api/?name=\${user.email}`} className="w-6 h-6 rounded-full" />
                  <span className="text-xs text-gray-300 truncate">{user.displayName || user.email}</span>
                </div>
                <button onClick={logout} className="text-gray-400 hover:text-rose-400 ml-2" title="Sign Out">
                   <LogOut size={16} />
                </button>
             </div>
           )}
        </div>
      </div>
      
      {/* Main Content Area */}
      <div className="flex flex-1 flex-col h-full w-full relative">
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-gray-800 bg-nova-surface px-4 md:px-6 shadow-sm">
          <div className="flex items-center gap-3">
            <button className="md:hidden text-gray-400 hover:text-white" onClick={() => setShowSidebar(true)}>
              <Menu size={20} />
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-nova-accent text-white">
              <span className="font-display font-bold">N</span>
            </div>
            <h1 className="font-display text-lg font-bold tracking-tight text-white hidden sm:block">Nova Assistant</h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            {!user && (
              <button onClick={() => setShowAuthModal(true)} className="flex items-center gap-2 hover:text-white transition-colors bg-nova-accent px-3 py-1.5 rounded-full text-white shadow-sm font-medium mr-1">
                Sign In
              </button>
            )}
            <button 
              onClick={() => setNetworkMode(prev => prev === 'online' ? 'offline' : 'online')}
              className="flex items-center gap-2 hover:text-gray-200 transition-colors bg-nova-dark/50 px-3 py-1.5 rounded-full border border-gray-800 shadow-sm"
            >
              {networkMode === 'online' ? <Wifi size={14} className="text-emerald-500" /> : <WifiOff size={14} className="text-amber-500" />}
              <span className="hidden sm:inline">{networkMode === 'online' ? 'Online' : 'Offline'}</span>
            </button>
          </div>
        </header>

        {/* Chat Area */}
        <main className="flex-1 overflow-y-auto w-full">
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
                      {mode === 'thinking' ? 'Deep Thought' : 'Deep Research & Search'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} className="h-6" />
        </main>

        {/* Input Area */}
        <footer className="shrink-0 p-3 sm:p-6 pb-6 sm:pb-8 bg-nova-dark/80 backdrop-blur-sm">
          <div className="mx-auto max-w-3xl">
            {/* Options Toolbar */}
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <div className="flex overflow-x-auto bg-nova-surface rounded-lg p-1 border border-gray-700 shadow-sm">
                <button
                  type="button"
                  onClick={() => setMode('fast')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    mode === 'fast' ? 'bg-nova-dark text-white shadow-sm ring-1 ring-gray-600' : 'text-gray-400 hover:text-gray-200 hover:bg-nova-dark/50'
                  }`}
                >
                  <Zap size={14} /> <span className="hidden sm:inline">Fast</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('thinking')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    mode === 'thinking' ? 'bg-nova-dark text-white shadow-sm ring-1 ring-gray-600' : 'text-gray-400 hover:text-gray-200 hover:bg-nova-dark/50'
                  }`}
                >
                  <BrainCircuit size={14} /> <span className="hidden sm:inline">Thinking</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('deep-research')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    mode === 'deep-research' ? 'bg-nova-dark text-white shadow-sm ring-1 ring-gray-600' : 'text-gray-400 hover:text-gray-200 hover:bg-nova-dark/50'
                  }`}
                >
                  <Webhook size={14} /> <span className="hidden sm:inline">DeepSearch AI</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!input.startsWith("Generate an image of ")) {
                    setInput("Generate an image of " + input.replace(/^Generate a 30 sec video of |^Generate audio of /i, ''));
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-700 bg-nova-surface text-gray-400 hover:bg-nova-dark hover:text-gray-200 hover:border-gray-600 shadow-sm transition-colors shrink-0"
              >
                <ImageIcon size={14} /> Image
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!input.startsWith("Generate a 30 sec video of ")) {
                    setInput("Generate a 30 sec video of " + input.replace(/^Generate an image of |^Generate audio of /i, ''));
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-700 bg-nova-surface text-gray-400 hover:bg-nova-dark hover:text-gray-200 hover:border-gray-600 shadow-sm transition-colors shrink-0"
              >
                <Video size={14} /> Video
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!input.startsWith("Generate audio of ")) {
                    setInput("Generate audio of " + input.replace(/^Generate an image of |^Generate a 30 sec video of /i, ''));
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-700 bg-nova-surface text-gray-400 hover:bg-nova-dark hover:text-gray-200 hover:border-gray-600 shadow-sm transition-colors shrink-0"
              >
                <Volume2 size={14} /> Audio
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
                  placeholder={`Message Nova \${mode === 'deep-research' ? '(Web Search Enabled)' : ''}...`}
                  className="max-h-52 min-h-[56px] w-full resize-none bg-transparent py-4 pl-2 pr-4 text-gray-200 placeholder-gray-500 focus:outline-none sm:text-sm"
                />
                <div className="mb-2 mr-2 flex gap-1 shrink-0 items-center">
                  <button
                    type="button"
                    onClick={toggleRecording}
                    className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors \${isRecording ? 'bg-rose-500/20 text-rose-500 hover:bg-rose-500/30 animate-pulse' : 'text-gray-400 hover:bg-nova-dark hover:text-gray-200'}`}
                    title={isRecording ? "Stop dictation" : "Start dictation"}
                  >
                    {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
                  </button>
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

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-sm rounded-2xl bg-nova-surface border border-gray-800 p-6 shadow-2xl relative">
             <button onClick={() => setShowAuthModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white">
                <X size={20} />
             </button>
             <div className="text-center mb-8 mt-2">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-nova-accent text-white mb-4">
                  <span className="font-display text-2xl font-bold">N</span>
                </div>
                <h2 className="text-xl font-bold text-white mb-1">Welcome to Nova</h2>
                <p className="text-sm text-gray-400">Sign in to save your workspaces and history.</p>
             </div>
             
             <div className="space-y-3">
               <button onClick={async () => {
                 try { await loginWithGoogle(); } catch(e: any) { if (e.code !== 'auth/popup-closed-by-user') console.error(e); }
               }} className="w-full flex items-center justify-center gap-3 bg-white text-gray-900 font-medium py-3 px-4 rounded-xl hover:bg-gray-100 transition-colors">
                  <Chrome size={20} /> Continue with Google
               </button>
               <button onClick={async () => {
                 try { await loginWithGithub(); } catch(e: any) { if (e.code !== 'auth/popup-closed-by-user') console.error(e); }
               }} className="w-full flex items-center justify-center gap-3 bg-[#24292e] text-white font-medium py-3 px-4 rounded-xl hover:bg-[#2f363d] transition-colors border border-gray-700">
                  <Github size={20} /> Continue with GitHub
               </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
