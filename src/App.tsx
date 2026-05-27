import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Loader2, Image as ImageIcon, Paperclip, Zap, BrainCircuit, Microscope, X, Video, Wifi, WifiOff, Plus, Menu, LogOut, Github, Chrome, FileClock, Webhook, Mic, MicOff, Volume2, Cloud, Table, ArrowDownToLine, ArrowDown, Search, Sun, Moon, Settings, MessageSquareHeart, Flag, FileText, Code2, Sparkles, AlignLeft, Trash2, Bold, Italic, List, Code, Globe, ShieldCheck, Smartphone, Key, Square } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

import { Message } from './types';
import { ChatMessage } from './components/ChatMessage';
import { ThinkingAnimation } from './components/ThinkingAnimation';
import { auth, loginWithGoogle, loginWithGithub, logout, db, getAccessToken, OperationType, handleFirestoreError } from './lib/firebase';
import firebaseConfig from '../firebase-applet-config.json';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, getDocs, doc, updateDoc, deleteDoc, getDoc, setDoc } from 'firebase/firestore';

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
  const [selectionMenu, setSelectionMenu] = useState<{x: number, y: number, text: string} | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [mode, setMode] = useState<'fast' | 'thinking' | 'deep-research'>('fast');
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash");
  const [searchEngine, setSearchEngine] = useState("google");
  const [networkMode, setNetworkMode] = useState<'online' | 'offline'>('online');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const [freeMessageCount, setFreeMessageCount] = useState(() => {
    const stored = localStorage.getItem('nova_free_messages');
    return stored ? parseInt(stored, 10) : 0;
  });

  const [user, setUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSidebar, setShowSidebar] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 768 : false);
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [searchHistoryQuery, setSearchHistoryQuery] = useState("");
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  
  const [isRecording, setIsRecording] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 208)}px`; // 208px is approx max-h-52
    }
  }, [input]);

  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('#selection-menu')) {
        return;
      }
      setTimeout(() => {
        const selection = window.getSelection();
        const text = selection?.toString().trim();
        if (text && text.length > 0) {
          try {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            setSelectionMenu({
              x: rect.left + (rect.width / 2),
              y: rect.top,
              text
            });
          } catch (e) {
            setSelectionMenu(null);
          }
        } else {
          setSelectionMenu(null);
        }
      }, 10);
    };

    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const insertFormatting = (prefix: string, suffix: string) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const text = input;
    const before = text.substring(0, start);
    const selected = text.substring(start, end);
    const after = text.substring(end);
    
    const textToWrap = selected || (prefix === '```\n' ? 'code' : (prefix === '- ' ? 'list item' : 'text'));
    const newText = `${before}${prefix}${textToWrap}${suffix}${after}`;
    
    setInput(newText);
    
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(
          start + prefix.length,
          start + prefix.length + textToWrap.length
        );
      }
    }, 0);
  };

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
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'chats');
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      try {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setTheme(docSnap.data().theme);
        }
      } catch (err) {
        console.error("Failed to load user profile", err);
      }
    };
    fetchProfile();
  }, [user]);

  const handleChangeTheme = async () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    if (user) {
      try {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          await updateDoc(docRef, { theme: newTheme, updatedAt: serverTimestamp() });
        } else {
          await setDoc(docRef, { theme: newTheme, updatedAt: serverTimestamp() });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
      }
    }
  };

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
      handleFirestoreError(err, OperationType.LIST, `chats/${chatId}/messages`);
    }
  };

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  const handleSubmit = async (e?: React.FormEvent, promptOverride?: string) => {
    if (e) e.preventDefault();
    if (!user && freeMessageCount >= 3) {
      setShowAuthModal(true);
      return;
    }

    const currentInput = promptOverride ?? input;
    if ((!currentInput.trim() && !selectedFile) || isLoading) return;

    if (!user) {
      const newCount = freeMessageCount + 1;
      setFreeMessageCount(newCount);
      localStorage.setItem('nova_free_messages', newCount.toString());
    }

    let contentStr = currentInput.trim();
    let imageDataUrl: string | undefined = undefined;

    if (selectedFile) {
       if (selectedFile.type === 'application/pdf') {
         setIsLoading(true);
         try {
           const arrayBuffer = await selectedFile.arrayBuffer();
           const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
           let fullText = "";
           for (let i = 1; i <= pdf.numPages; i++) {
             const page = await pdf.getPage(i);
             const content = await page.getTextContent();
             const strings = content.items.map((item: any) => item.str);
             fullText += strings.join(" ") + "\n";
             if (fullText.length > 50000) { // Limit size to avoid overloading
               fullText += "...(truncated)";
               break;
             }
           }
           contentStr = `[Attached PDF: ${selectedFile.name}]\n\n--- Document Content ---\n${fullText}\n------------------------\n\n` + contentStr;
         } catch (e) {
           console.error("Failed to extract PDF", e);
           contentStr = `[Attached PDF: ${selectedFile.name} (failed to read context)]\n` + contentStr;
         }
       } else if (selectedFile.type.startsWith('image/')) {
         setIsLoading(true);
         try {
           const arrayBuffer = await selectedFile.arrayBuffer();
           const fileType = selectedFile.type;
           const base64 = btoa(new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
           imageDataUrl = `data:${fileType};base64,${base64}`;
           contentStr = `[Attached Image: ${selectedFile.name}]\n` + contentStr;
         } catch (e) {
           console.error("Failed to read image", e);
           contentStr = `[Attached Image: ${selectedFile.name} (failed to read context)]\n` + contentStr;
         }
       } else {
         contentStr = `[Attached: ${selectedFile.name}]\n` + contentStr;
       }
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: contentStr,
      timestamp: new Date(),
      ...(imageDataUrl && { image: imageDataUrl })
    };


    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSelectedFile(null);
    setIsLoading(true);

    try {
      // Save user message to Firebase
      let activeChatId = currentChatId;
      if (user && !activeChatId) {
        try {
          let generatedTitle = contentStr.substring(0, 40) + '...';
          try {
            const titleRes = await fetch('/api/generate-title', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: contentStr })
            });
            if (titleRes.ok) {
              const titleData = await titleRes.json();
              if (titleData.title) generatedTitle = titleData.title;
            }
          } catch(e) {
            console.error("Title generation failed:", e);
          }

          const chatRef = await addDoc(collection(db, 'chats'), {
            userId: user.uid,
            title: generatedTitle,
            createdAt: serverTimestamp()
          });
          activeChatId = chatRef.id;
        } catch (e) {
          handleFirestoreError(e, OperationType.CREATE, 'chats');
        }
        setCurrentChatId(activeChatId);
      }
      if (user && activeChatId) {
        try {
          const msgRef = await addDoc(collection(db, `chats/${activeChatId}/messages`), {
            role: 'user',
            content: contentStr,
            createdAt: serverTimestamp()
          });
          const oldId = userMsg.id;
          userMsg.id = msgRef.id;
          setMessages(prev => prev.map(m => m.id === oldId ? { ...m, id: msgRef.id } : m));
        } catch (e) {
          handleFirestoreError(e, OperationType.CREATE, `chats/${activeChatId}/messages`);
        }
      }

      // Add deep research / google search mode param handling here
      const apiMode = mode === 'deep-research' ? 'deep-research' : mode;
      
      abortControllerRef.current = new AbortController();
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content,
            ...(m.image && { image: m.image })
          })),
          mode: apiMode,
          modelName: selectedModel,
          searchEngine,
          networkMode
        })
      });

      if (!response.ok) {
        let errMsg = "Network error";
        try {
          const errData = await response.json();
          errMsg = errData.error || errMsg;
        } catch(e) {}
        throw new Error(errMsg);
      }

      const data = await response.json();
      
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        audio: data.audio,
        isTyping: true
      };
      
      setMessages((prev) => [...prev, assistantMsg]);
      
      if (user && activeChatId) {
        try {
          const msgRef = await addDoc(collection(db, `chats/${activeChatId}/messages`), {
            role: 'assistant',
            content: data.response,
            ...(data.audio && { audio: data.audio }),
            createdAt: serverTimestamp()
          });
          const oldId = assistantMsg.id;
          assistantMsg.id = msgRef.id;
          setMessages(prev => prev.map(m => m.id === oldId ? { ...m, id: msgRef.id } : m));
        } catch (e) {
          handleFirestoreError(e, OperationType.CREATE, `chats/${activeChatId}/messages`);
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        const errorMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `⚠️ Generation stopped by user.`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMsg]);
        return;
      }
      console.error(error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `❌ Sorry, I encountered an error: ${error.message || "while trying to respond."}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditMessage = async (messageId: string, newContent: string) => {
    const editIndex = messages.findIndex((m) => m.id === messageId);
    if (editIndex === -1) return;

    // We only keep messages up to the edited one.
    const messagesToKeep = messages.slice(0, editIndex + 1);
    const messagesToDelete = messages.slice(editIndex + 1);
    
    // Update the targeted message locally
    messagesToKeep[editIndex] = { ...messagesToKeep[editIndex], content: newContent };
    
    setMessages(messagesToKeep);
    setIsLoading(true);

    const activeChatId = currentChatId;

    if (user && activeChatId) {
      if (messageId !== "greeting") {
        try {
          // Update the edited message in firestore
          await updateDoc(doc(db, `chats/${activeChatId}/messages`, messageId), {
            content: newContent
          });

          // Delete all subsequent messages in firestore
          for (const m of messagesToDelete) {
             if (m.id !== "greeting") {
                await deleteDoc(doc(db, `chats/${activeChatId}/messages`, m.id));
             }
          }
        } catch (e) {
          handleFirestoreError(e, OperationType.UPDATE, `chats/${activeChatId}/messages`);
        }
      }
    }

    // Trigger AI regeneration using the truncated message list
    try {
      const apiMode = mode === 'deep-research' ? 'deep-research' : mode;
      
      abortControllerRef.current = new AbortController();
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          messages: messagesToKeep.map((m) => ({
            role: m.role,
            content: m.content,
            ...(m.image && { image: m.image })
          })),
          mode: apiMode,
          modelName: selectedModel,
          searchEngine,
          networkMode
        })
      });

      if (!response.ok) {
        let errMsg = "Network error";
        try {
          const errData = await response.json();
          errMsg = errData.error || errMsg;
        } catch(e) {}
        throw new Error(errMsg);
      }

      const data = await response.json();
      
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        audio: data.audio,
        isTyping: true
      };
      
      setMessages((prev) => [...prev, assistantMsg]);
      
      if (user && activeChatId) {
        try {
          const msgRef = await addDoc(collection(db, `chats/${activeChatId}/messages`), {
            role: 'assistant',
            content: data.response,
            ...(data.audio && { audio: data.audio }),
            createdAt: serverTimestamp()
          });
          const oldId = assistantMsg.id;
          assistantMsg.id = msgRef.id;
          setMessages(prev => prev.map(m => m.id === oldId ? { ...m, id: msgRef.id } : m));
        } catch (e) {
          handleFirestoreError(e, OperationType.CREATE, `chats/${activeChatId}/messages`);
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        const errorMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `⚠️ Generation stopped by user.`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMsg]);
        return;
      }
      console.error(error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `❌ Sorry, I encountered an error: ${error.message || "while trying to respond to the edit."}`,
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

  const generateSummary = async () => {
    setIsSummarizing(true);
    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messages.filter(m => m.id !== 'greeting') })
      });
      const data = await response.json();
      setSummary(data.summary);
    } catch (err) {
      console.error("Failed to summarize chat", err);
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleNewChat = () => {
    setSummary(null);
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

  const handleDeleteChat = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, 'chats', chatId));
      if (currentChatId === chatId) {
        handleNewChat();
      }
    } catch (e) {
      console.error("Failed to delete chat", e);
    }
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

  const exportToSheets = async () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    
    const accessToken = await getAccessToken();
    if (!accessToken) {
      alert('Missing Google Sheets access token. Please sign in with Google to grant permissions.');
      setShowAuthModal(true);
      return;
    }

    try {
      // 1. Create a new Spreadsheet
      const createResponse = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: {
            title: `Nova Chat Export - ${new Date().toLocaleDateString()}`
          }
        }),
      });

      if (!createResponse.ok) {
        throw new Error('Failed to create spreadsheet');
      }

      const createData = await createResponse.json();
      const spreadsheetId = createData.spreadsheetId;

      // 2. Prepare the values
      const values = [
        ['Role', 'Message'], // Header row
        ...messages.map(msg => [msg.role, msg.content])
      ];

      // 3. Update the Spreadsheet with values
      const updateResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:B${values.length}?valueInputOption=RAW`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: values
        }),
      });

      if (!updateResponse.ok) {
        throw new Error('Failed to update spreadsheet');
      }

      // Open the sheet in a new tab
      window.open(createData.spreadsheetUrl, '_blank');

    } catch (error) {
      console.error('Error exporting to sheets:', error);
      alert('Failed to export to Google Sheets. Please ensure you have granted the required permissions.');
    }
  };

  const openGooglePicker = async (viewType: 'DOCS' | 'SPREADSHEETS' = 'DOCS') => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    
    const accessToken = await getAccessToken();
    if (!accessToken) {
      alert('Missing access token. Please sign in with Google to grant permissions.');
      setShowAuthModal(true);
      return;
    }

    const { gapi, google } = window as any;
    if (!gapi) {
      alert("Google API script not loaded.");
      return;
    }

    gapi.load('picker', { callback: () => {
      if ((window as any).google && (window as any).google.picker) {
        const viewId = viewType === 'SPREADSHEETS' 
            ? (window as any).google.picker.ViewId.SPREADSHEETS 
            : (window as any).google.picker.ViewId.DOCS;
        
        const picker = new (window as any).google.picker.PickerBuilder()
          .addView(viewId)
          .setOAuthToken(accessToken)
          .setDeveloperKey(firebaseConfig.apiKey)
          .setCallback((data: any) => {
            if (data.action == (window as any).google.picker.Action.PICKED) {
              const doc = data.docs[0];
              setInput((prev) => prev + (prev.trim() ? '\n' : '') + `[Selected Workspace File: ${doc.name}](${doc.url})`);
            }
          })
          .build();
        picker.setVisible(true);
      }
    }});
  };

  return (
    <div className={theme}>
      {selectionMenu && (
        <div 
          id="selection-menu"
          className="fixed z-50 flex items-center gap-1 bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700 rounded-lg p-1 -translate-x-1/2 -translate-y-full mb-2 animate-in fade-in zoom-in-95 duration-200"
          style={{ top: selectionMenu.y - 8, left: selectionMenu.x }}
        >
          <button
            onClick={() => {
              handleSubmit(undefined, `Explain this:\n\n"${selectionMenu.text}"`);
              setSelectionMenu(null);
              window.getSelection()?.removeAllRanges();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors whitespace-nowrap"
          >
            <Sparkles size={14} className="text-purple-500" /> Explain
          </button>
          <button
            onClick={() => {
              handleSubmit(undefined, `Summarize this:\n\n"${selectionMenu.text}"`);
              setSelectionMenu(null);
              window.getSelection()?.removeAllRanges();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors whitespace-nowrap"
          >
            <AlignLeft size={14} className="text-emerald-500" /> Summarize
          </button>
          <button
            onClick={() => {
              handleSubmit(undefined, `Translate this:\n\n"${selectionMenu.text}"`);
              setSelectionMenu(null);
              window.getSelection()?.removeAllRanges();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors whitespace-nowrap"
          >
            <Globe size={14} className="text-blue-500" /> Translate
          </button>
        </div>
      )}
      <div className="flex h-screen overflow-hidden bg-gray-50/50 dark:bg-nova-dark/80 font-sans text-gray-800 dark:text-gray-200 relative">
        {/* Dynamic Background Blobs */}
        <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-300 dark:bg-purple-900 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-30 dark:opacity-20 animate-blob pointer-events-none"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-yellow-300 dark:bg-yellow-900 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-30 dark:opacity-20 animate-blob animation-delay-2000 pointer-events-none"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 dark:bg-pink-900 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-30 dark:opacity-20 animate-blob animation-delay-4000 pointer-events-none"></div>

        {/* Mobile Sidebar Overlay */}
      {showSidebar && (
        <div 
          className="fixed inset-0 bg-gray-900/50 dark:bg-black/50 z-40 md:hidden backdrop-blur-sm transition-opacity cursor-pointer"
          onClick={(e) => {
             e.preventDefault();
             e.stopPropagation();
             setShowSidebar(false);
          }}
        />
      )}

      {/* Sidebar for Chat History */}
      <div className={`fixed inset-y-0 left-0 z-50 transform bg-white/70 dark:bg-nova-surface/60 backdrop-blur-2xl border-r border-white/40 dark:border-white/10 shadow-[8px_0_30px_rgb(0,0,0,0.05)] transition-all duration-300 ease-in-out md:relative md:z-10 flex-shrink-0 flex flex-col 
        ${showSidebar ? 'translate-x-0 w-64' : '-translate-x-full w-64 md:w-0 md:border-none md:overflow-hidden overflow-hidden'}`}>
        <div className="flex h-full flex-col">
           <div className="p-4 border-b border-gray-200/50 dark:border-gray-800/50 flex items-center justify-between">
              <span className="font-display font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                 <FileClock size={16} className="text-nova-accent"/> History
              </span>
              <button 
                 className="p-2 -mr-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white transition-colors" 
                 onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowSidebar(false);
                 }}
              >
                 <X size={20} />
              </button>
           </div>
           
           <div className="flex-1 overflow-y-auto p-2">
              <button 
                onClick={handleNewChat} 
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-900 dark:text-white bg-nova-accent/20 hover:bg-nova-accent/30 rounded-lg mb-2 transition-colors"
                title="Start a new conversation"
              >
                 <Plus size={16} /> New Chat
              </button>
              
              <button
                onClick={generateSummary}
                disabled={isSummarizing || messages.length < 2}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-900 dark:text-white bg-gray-100 dark:bg-nova-dark border border-gray-200 dark:border-gray-800 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg mb-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Summarize the current conversation"
              >
                {isSummarizing ? <Loader2 size={16} className="animate-spin" /> : <AlignLeft size={16} className="text-nova-accent" />}
                Summarize Chat
              </button>
              
              {user && messages.length > 0 && (
                <button
                  onClick={exportToSheets}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-900 dark:text-white bg-gray-100 dark:bg-nova-dark border border-gray-200 dark:border-gray-800 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg mb-4 transition-colors"
                  title="Export Chat to Google Sheets"
                >
                  <Table size={16} className="text-emerald-500" />
                  Export to Sheets
                </button>
              )}
              
              {user && chatHistory.length > 0 && (
                <div className="mb-4 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search size={14} className="text-gray-500" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search history..."
                    value={searchHistoryQuery}
                    onChange={(e) => setSearchHistoryQuery(e.target.value)}
                    className="w-full bg-nova-dark/50 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 text-sm rounded-lg pl-9 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-nova-accent focus:border-nova-accent placeholder-gray-500 transition-colors"
                  />
                </div>
              )}

              {!user ? (
                <div className="text-center p-4">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">Sign in to save and access your chat history across devices.</p>
                  <button onClick={() => setShowAuthModal(true)} className="w-full bg-white/10 hover:bg-white/20 text-gray-900 dark:text-white text-xs py-2 rounded-lg font-medium transition-colors">
                    Sign In
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {chatHistory
                    .filter(chat => chat.title?.toLowerCase().includes(searchHistoryQuery.toLowerCase()))
                    .map((chat) => (
                    <div key={chat.id} className={`group flex items-center justify-between rounded-lg transition-colors ${currentChatId === chat.id ? 'bg-white/60 dark:bg-black/40 shadow-sm border-t border-white/40 dark:border-white/10 text-nova-accent font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-white/40 dark:hover:bg-white/10 hover:text-gray-800 dark:text-gray-200'}`}>
                      <button 
                        onClick={() => loadChat(chat.id)}
                        className="flex-1 text-left truncate px-3 py-2 text-sm"
                      >
                        {chat.title}
                      </button>
                      <button
                        onClick={(e) => handleDeleteChat(e, chat.id)}
                        className="px-2 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-rose-500 transition-all"
                        title="Delete chat"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {chatHistory.length === 0 && (
                    <p className="text-xs text-gray-500 text-center py-4">No recent chats.</p>
                  )}
                  {chatHistory.length > 0 && chatHistory.filter(chat => chat.title?.toLowerCase().includes(searchHistoryQuery.toLowerCase())).length === 0 && (
                    <p className="text-xs text-gray-500 text-center py-4">No results found.</p>
                  )}
                </div>
              )}
           </div>
           
           {user && (
             <div className="p-4 border-t border-gray-300 dark:border-gray-800 flex flex-col gap-3">
                <div className="flex items-center gap-2 truncate w-full">
                  <img src={user.photoURL || `https://ui-avatars.com/api/?name=\${user.email}`} className="w-6 h-6 rounded-full" />
                  <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{user.displayName || user.email}</span>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-800/50">
                  <button 
                    onClick={handleChangeTheme} 
                    className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-2 transition-colors"
                    title="Toggle dark/light mode"
                  >
                     {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />} {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                  </button>
                  <button onClick={logout} className="text-gray-500 hover:text-rose-500 transition-colors" title="Sign Out">
                     <LogOut size={14} />
                  </button>
                </div>
             </div>
           )}
        </div>
      </div>
      
      {/* Main Content Area */}
      <div className="flex flex-1 flex-col h-full w-full relative z-10 backdrop-blur-[2px]">
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/20 dark:border-white/10 bg-white/40 dark:bg-black/20 backdrop-blur-md px-4 md:px-6 z-20">
          <div className="flex items-center gap-3">
            <button className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white transition-colors" onClick={() => setShowSidebar(!showSidebar)} title="Toggle Sidebar">
              <Menu size={20} />
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-nova-accent text-white">
              <span className="font-display font-bold">N</span>
            </div>
            <h1 className="font-display text-lg font-bold tracking-tight text-gray-900 dark:text-white hidden sm:block">Nova Assistant</h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`flex items-center gap-2 transition-colors px-3 py-1.5 rounded-full border border-gray-300 dark:border-gray-800 shadow-sm ${autoScroll ? 'bg-nova-accent/20 text-nova-accent hover:bg-nova-accent/30' : 'bg-nova-dark/50 hover:text-gray-800 dark:text-gray-200'}`}
              title={autoScroll ? "Auto-scroll enabled" : "Auto-scroll disabled"}
            >
              {autoScroll ? <ArrowDownToLine size={14} /> : <ArrowDown size={14} />}
              <span className="hidden sm:inline">Auto-scroll</span>
            </button>
            <button 
              onClick={() => setShowSettingsModal(true)}
              className="flex items-center gap-2 hover:text-gray-800 dark:text-gray-200 transition-colors bg-nova-dark/50 px-3 py-1.5 rounded-full border border-gray-300 dark:border-gray-800 shadow-sm"
              title="Settings"
            >
              <Settings size={14} className="text-gray-500" />
              <span className="hidden sm:inline">Settings</span>
            </button>
            {!user && (
              <button onClick={() => setShowAuthModal(true)} className="flex items-center gap-2 hover:text-gray-900 dark:text-white transition-colors bg-nova-accent px-3 py-1.5 rounded-full text-gray-900 dark:text-white shadow-sm font-medium mr-1">
                Sign In
              </button>
            )}
            <button 
              onClick={() => setNetworkMode(prev => prev === 'online' ? 'offline' : 'online')}
              className="flex items-center gap-2 hover:text-gray-800 dark:text-gray-200 transition-colors bg-nova-dark/50 px-3 py-1.5 rounded-full border border-gray-300 dark:border-gray-800 shadow-sm"
              title="Toggle network mode (simulate offline mode)"
            >
              {networkMode === 'online' ? <Wifi size={14} className="text-emerald-500" /> : <WifiOff size={14} className="text-amber-500" />}
              <span className="hidden sm:inline">{networkMode === 'online' ? 'Online' : 'Offline'}</span>
            </button>
          </div>
        </header>

        {summary && (
          <div className="bg-nova-accent/10 border-b border-nova-accent/20 px-4 py-3 flex items-start gap-4 shadow-inner relative shrink-0 z-10 transition-all">
            <div className="flex-1 text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
              <strong className="text-nova-accent mr-2 font-semibold">Conversation Summary:</strong>
              {summary}
            </div>
            <button 
              onClick={() => setSummary(null)} 
              className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 bg-white/50 dark:bg-black/50 p-1 rounded-full transition-colors shrink-0"
              title="Dismiss summary"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Chat Area */}
        <main className="flex-1 overflow-y-auto w-full">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} onEdit={handleEditMessage} />
            ))}
            {isLoading && (
              <motion.div 
                key="loading-indicator"
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                className="flex w-full px-4 py-8 sm:px-6 relative group bg-white/60 dark:bg-black/20 backdrop-blur-xl border-y border-white/40 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.12)]"
              >
                <div className="mx-auto flex w-full max-w-3xl gap-4 sm:gap-6 items-center pt-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-nova-accent text-white shadow-sm ring-1 ring-white/20">
                     <Sparkles size={16} />
                  </div>
                  <div className="flex-1 flex flex-col items-start">
                    <div className="bg-white/40 dark:bg-black/30 backdrop-blur-md rounded-2xl px-4 py-2 border border-white/40 dark:border-white/10 shadow-sm flex items-center gap-3 w-fit">
                      <ThinkingAnimation mode={mode} />
                      {mode !== 'fast' && (
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/50 dark:bg-white/10 border border-white/40 dark:border-white/5 text-nova-accent font-bold">
                          {mode === 'thinking' ? 'Deep Thought' : 'Deep Research & Search'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={bottomRef} className="h-6" />
        </main>

        {/* Input Area */}
        <footer className="shrink-0 p-3 sm:p-6 pb-6 sm:pb-8 bg-white/30 dark:bg-black/20 backdrop-blur-xl border-t border-white/20 dark:border-white/10 z-20">
          <div className="mx-auto max-w-3xl">
            {messages.length <= 1 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ staggerChildren: 0.1, delayChildren: 0.2 }}
                className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-2"
              >
                {[
                  { text: 'Analyze this document', icon: <FileText size={18} className="text-blue-500" /> },
                  { text: 'Help me debug code', icon: <Code2 size={18} className="text-amber-500" /> },
                  { text: 'Write a creative story', icon: <Sparkles size={18} className="text-purple-500" /> },
                  { text: 'Summarize an article', icon: <AlignLeft size={18} className="text-emerald-500" /> },
                ].map((prompt, index) => (
                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    key={index}
                    onClick={() => handleSubmit(undefined, prompt.text)}
                    className="flex flex-col items-start gap-2.5 p-3.5 text-left bg-white/50 dark:bg-black/30 backdrop-blur-md border border-white/40 dark:border-white/10 rounded-xl hover:bg-white/70 dark:hover:bg-black/50 hover:shadow-lg hover:-translate-y-0.5 transition-all w-full"
                    title={`Use prompt: ${prompt.text}`}
                  >
                    {prompt.icon}
                    <span className="text-sm text-gray-700 dark:text-gray-300 font-medium leading-tight">{prompt.text}</span>
                  </motion.button>
                ))}
              </motion.div>
            )}

            {/* Options Toolbar */}
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <div className="flex overflow-x-auto bg-white/40 dark:bg-black/20 backdrop-blur-md rounded-lg p-1 border border-white/30 dark:border-white/10 shadow-sm">
                <button
                  type="button"
                  onClick={() => setMode('fast')}
                  title="Fast standard assistant mode"
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    mode === 'fast' ? 'bg-white/80 dark:bg-white/10 text-gray-900 dark:text-white shadow-sm ring-1 ring-white/20' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-gray-200 hover:bg-white/20 dark:hover:bg-white/5'
                  }`}
                >
                  <Zap size={14} className={mode === 'fast' ? 'text-amber-500' : ''} /> <span className="hidden sm:inline">Fast</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('thinking')}
                  title="Deep reasoning and step-by-step logic"
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    mode === 'thinking' ? 'bg-white/80 dark:bg-white/10 text-gray-900 dark:text-white shadow-sm ring-1 ring-white/20' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-gray-200 hover:bg-white/20 dark:hover:bg-white/5'
                  }`}
                >
                  <BrainCircuit size={14} className={mode === 'thinking' ? 'text-purple-500' : ''} /> <span className="hidden sm:inline">Thinking</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('deep-research')}
                  title="Search the web to answer your questions"
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    mode === 'deep-research' ? 'bg-white/80 dark:bg-white/10 text-gray-900 dark:text-white shadow-sm ring-1 ring-white/20' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-gray-200 hover:bg-white/20 dark:hover:bg-white/5'
                  }`}
                >
                  <Webhook size={14} className={mode === 'deep-research' ? 'text-emerald-500' : ''} /> <span className="hidden sm:inline">DeepSearch AI</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!input.startsWith("Generate an image of ")) {
                    setInput("Generate an image of " + input.replace(/^Generate a 30 sec video of |^Generate audio of /i, ''));
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-white/30 dark:border-white/10 bg-white/40 dark:bg-black/20 backdrop-blur-md text-gray-700 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-black/40 hover:text-gray-800 dark:hover:text-gray-200 shadow-sm transition-colors shrink-0"
                title="Format next message as an image generation request"
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
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-white/30 dark:border-white/10 bg-white/40 dark:bg-black/20 backdrop-blur-md text-gray-700 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-black/40 hover:text-gray-800 dark:hover:text-gray-200 shadow-sm transition-colors shrink-0"
                title="Format next message as a video generation request"
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
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-white/30 dark:border-white/10 bg-white/40 dark:bg-black/20 backdrop-blur-md text-gray-700 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-black/40 hover:text-gray-800 dark:hover:text-gray-200 shadow-sm transition-colors shrink-0"
                title="Format next message as an audio generation request"
              >
                <Volume2 size={14} /> Audio
              </button>

              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="px-2 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-nova-surface text-gray-600 dark:text-gray-400 focus:outline-none focus:ring-1 focus:ring-nova-accent shadow-sm"
                title="Select the AI model family"
              >
                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
              </select>

              {mode === 'deep-research' && (
                <select
                  value={searchEngine}
                  onChange={(e) => setSearchEngine(e.target.value)}
                  className="px-2 py-1.5 text-xs font-medium rounded-lg border border-white/30 dark:border-white/10 bg-white/40 dark:bg-black/20 backdrop-blur-md text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-nova-accent shadow-sm"
                  title="Select preferred search engine"
                >
                  <option value="google">Google</option>
                  <option value="duckduckgo">DuckDuckGo</option>
                  <option value="bing">Bing</option>
                  <option value="yahoo">Yahoo</option>
                  <option value="chrome">Chrome Engine</option>
                  <option value="opera">Opera Engine</option>
                </select>
              )}
            </div>

            <form
              onSubmit={handleSubmit}
              className="relative flex flex-col rounded-xl bg-white/50 dark:bg-black/30 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-lg focus-within:border-nova-accent/50 focus-within:ring-1 focus-within:ring-nova-accent/50 transition-all"
            >
              {selectedFile && (
                <div className="flex items-center gap-2 px-3 pt-3 pb-1">
                  <div className="flex items-center gap-2 rounded-md bg-gray-50 dark:bg-nova-dark px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                     <Paperclip size={12} className="text-gray-600 dark:text-gray-400" />
                     <span className="truncate max-w-[200px]">{selectedFile.name}</span>
                     <button type="button" onClick={() => setSelectedFile(null)} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white ml-1">
                       <X size={14} />
                     </button>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-1 px-3 pt-2 pb-0 mx-1 mt-1">
                <button type="button" onClick={() => insertFormatting('**', '**')} className="p-1.5 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-md hover:bg-gray-100/50 dark:hover:bg-white/10 transition-colors" title="Bold">
                  <Bold size={14} />
                </button>
                <button type="button" onClick={() => insertFormatting('*', '*')} className="p-1.5 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-md hover:bg-gray-100/50 dark:hover:bg-white/10 transition-colors" title="Italic">
                  <Italic size={14} />
                </button>
                <div className="w-px h-3.5 bg-gray-300 dark:bg-gray-700/50 mx-1"></div>
                <button type="button" onClick={() => insertFormatting('- ', '')} className="p-1.5 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-md hover:bg-gray-100/50 dark:hover:bg-white/10 transition-colors" title="Bullet List">
                  <List size={14} />
                </button>
                <button type="button" onClick={() => insertFormatting('```\n', '\n```')} className="p-1.5 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-md hover:bg-gray-100/50 dark:hover:bg-white/10 transition-colors" title="Code Block">
                  <Code size={14} />
                </button>
              </div>
              <div className="flex items-end relative">
                <div className="relative mb-2.5 ml-2 mt-0">
                  <button
                    type="button"
                    onClick={() => setShowAttachMenu(!showAttachMenu)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:bg-nova-dark hover:text-gray-800 dark:text-gray-200 transition-colors"
                    title="Add attachment"
                  >
                    <Plus size={20} />
                  </button>

                  {showAttachMenu && (
                    <>
                      <div 
                        className="fixed inset-0 z-40 cursor-default" 
                        onClick={() => setShowAttachMenu(false)}
                      />
                      <div className="absolute bottom-full left-0 mb-2 w-48 rounded-xl border border-white/20 dark:border-white/10 bg-white/60 dark:bg-black/40 backdrop-blur-xl p-1 shadow-[0_8px_32px_0_rgba(31,38,135,0.2)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] z-50">
                        <button
                          type="button"
                          onClick={() => {
                            if (fileInputRef.current) {
                              fileInputRef.current.accept = "*/*";
                              fileInputRef.current.click();
                            }
                            setShowAttachMenu(false);
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:bg-nova-dark hover:text-gray-900 dark:text-white transition-colors"
                        >
                          <Paperclip size={16} /> Device File
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (fileInputRef.current) {
                              fileInputRef.current.accept = "image/*";
                              fileInputRef.current.click();
                            }
                            setShowAttachMenu(false);
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:bg-nova-dark hover:text-gray-900 dark:text-white transition-colors"
                        >
                          <ImageIcon size={16} /> Upload Image
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            openGooglePicker('DOCS');
                            setShowAttachMenu(false);
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-white/10 hover:text-gray-900 dark:text-white transition-colors"
                        >
                          <Cloud size={16} /> Google Docs
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            openGooglePicker('SPREADSHEETS');
                            setShowAttachMenu(false);
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-white/10 hover:text-gray-900 dark:text-white transition-colors"
                        >
                          <Table size={16} /> Google Sheets
                        </button>
                      </div>
                    </>
                  )}
                </div>
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
                  ref={textareaRef}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Message Nova \${mode === 'deep-research' ? '(Web Search Enabled)' : ''}...`}
                  className="max-h-52 min-h-[56px] w-full resize-none bg-transparent py-4 pl-2 pr-4 text-gray-800 dark:text-gray-200 placeholder-gray-500 focus:outline-none sm:text-sm"
                />
                <div className="mb-2 mr-2 flex gap-1 shrink-0 items-center">
                  <button
                    type="button"
                    onClick={toggleRecording}
                    className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors \${isRecording ? 'bg-rose-500/20 text-rose-500 hover:bg-rose-500/30 animate-pulse' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:bg-nova-dark hover:text-gray-800 dark:text-gray-200'}`}
                    title={isRecording ? "Stop dictation" : "Start dictation"}
                  >
                    {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
                  </button>
                  {isLoading ? (
                    <button
                      type="button"
                      onClick={stopGeneration}
                      className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-500 text-white transition-colors hover:bg-gray-600"
                      title="Stop generating"
                    >
                      <Square size={14} className="fill-current" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!input.trim() && !selectedFile}
                      className="flex h-10 w-10 items-center justify-center rounded-lg bg-nova-accent text-white transition-colors hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Send message"
                    >
                      <Send size={18} />
                    </button>
                  )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white/70 dark:bg-black/60 backdrop-blur-2xl border border-white/40 dark:border-white/10 p-6 shadow-2xl relative">
             <button onClick={() => setShowAuthModal(false)} className="absolute top-4 right-4 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white">
                <X size={20} />
             </button>
             <div className="text-center mb-8 mt-2">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-nova-accent text-white mb-4">
                  <span className="font-display text-2xl font-bold">N</span>
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Welcome to Nova</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {freeMessageCount >= 3 ? "You've reached your free preview limit. Sign in to continue!" : "Sign in to save your workspaces and history."}
                </p>
             </div>
             
             <div className="space-y-3">
               <button onClick={async () => {
                 try { await loginWithGoogle(); } catch(e: any) { if (e.code !== 'auth/popup-closed-by-user') console.error(e); }
               }} className="w-full flex items-center justify-center gap-3 bg-gray-100 dark:bg-white text-gray-900 font-medium py-3 px-4 rounded-xl hover:bg-gray-200 transition-colors">
                  <Chrome size={20} /> Continue with Google
               </button>
               <button onClick={async () => {
                 try { await loginWithGithub(); } catch(e: any) { if (e.code !== 'auth/popup-closed-by-user') console.error(e); }
               }} className="w-full flex items-center justify-center gap-3 bg-[#24292e] text-white font-medium py-3 px-4 rounded-xl hover:bg-[#2f363d] transition-colors border border-gray-200 dark:border-gray-700">
                  <Github size={20} /> Continue with GitHub
               </button>
             </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-2xl bg-white/70 dark:bg-black/60 backdrop-blur-2xl border border-white/40 dark:border-white/10 shadow-2xl relative max-h-[90vh] flex flex-col overflow-hidden">
             <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0">
               <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Settings size={24} /> Settings
               </h2>
               <button onClick={() => setShowSettingsModal(false)} className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white transition-colors">
                  <X size={20} />
               </button>
             </div>

             <div className="p-6 space-y-8 overflow-y-auto flex-1">
               {/* Theme Section */}
               <div className="space-y-3">
                 <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-300 uppercase tracking-wider flex items-center gap-2">
                   <Moon size={16} /> Appearance
                 </h3>
                 <div className="bg-white/10 dark:bg-black/20 backdrop-blur-md rounded-xl border border-white/20 dark:border-white/10 flex items-center p-1.5 overflow-hidden">
                   <button 
                     onClick={() => theme !== 'light' && handleChangeTheme()}
                     className={`flex-1 py-2 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-all ${theme === 'light' ? 'bg-white/70 dark:bg-white/20 text-gray-900 dark:text-white shadow-[0_4px_12px_rgb(0,0,0,0.1)] border border-white/40' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-white/30 dark:hover:bg-white/10'}`}
                   >
                     <Sun size={16} /> Light Mode
                   </button>
                   <button 
                     onClick={() => theme !== 'dark' && handleChangeTheme()}
                     className={`flex-1 py-2 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-all ${theme === 'dark' ? 'bg-white/70 dark:bg-white/20 text-gray-900 dark:text-white shadow-[0_4px_12px_rgb(0,0,0,0.1)] border border-white/40' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-white/30 dark:hover:bg-white/10'}`}
                   >
                     <Moon size={16} /> Dark Mode
                   </button>
                 </div>
               </div>

               {/* Security Section */}
               <div className="space-y-3">
                 <h3 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                   <ShieldCheck size={16} /> Security & MFA
                 </h3>
                 <div className="bg-white/50 dark:bg-black/30 backdrop-blur-md rounded-xl border border-white/40 dark:border-white/10 p-3 space-y-3 shadow-sm">
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      End-to-End Encryption is active for all communications. Advanced verification requires Identity Platform.
                    </p>
                    <button 
                      onClick={() => alert("Advanced MFA with Google Authenticator requires assigning the Identity Platform role to the project. Setting up hardware flow...")}
                      className="w-full flex items-center justify-between gap-2 bg-gray-100 dark:bg-black/40 text-gray-800 dark:text-gray-200 p-3 rounded-lg hover:bg-gray-200 dark:hover:bg-white/10 transition-colors text-sm font-medium border border-transparent dark:border-white/5"
                    >
                      <span className="flex items-center gap-2"><Smartphone size={16} className="text-blue-500" /> Authenticator App</span>
                      <span className="text-[10px] bg-gray-200 dark:bg-gray-800 px-2 py-0.5 rounded text-gray-500 font-bold uppercase tracking-wider">Setup</span>
                    </button>
                    <button 
                      onClick={() => alert("Phone verification requires Firebase Identity Platform billing and SMS configuration.")}
                      className="w-full flex items-center justify-between gap-2 bg-gray-100 dark:bg-black/40 text-gray-800 dark:text-gray-200 p-3 rounded-lg hover:bg-gray-200 dark:hover:bg-white/10 transition-colors text-sm font-medium border border-transparent dark:border-white/5"
                    >
                      <span className="flex items-center gap-2"><Smartphone size={16} className="text-emerald-500" /> Phone Number (SMS)</span>
                      <span className="text-[10px] bg-gray-200 dark:bg-gray-800 px-2 py-0.5 rounded text-gray-500 font-bold uppercase tracking-wider">Setup</span>
                    </button>
                    <button 
                      onClick={() => alert("Passkey setup initiated. WebAuthn requires HTTPS and valid origin configuration.")}
                      className="w-full flex items-center justify-between gap-2 bg-gray-100 dark:bg-black/40 text-gray-800 dark:text-gray-200 p-3 rounded-lg hover:bg-gray-200 dark:hover:bg-white/10 transition-colors text-sm font-medium border border-transparent dark:border-white/5"
                    >
                      <span className="flex items-center gap-2"><Key size={16} className="text-amber-500" /> Passkey (WebAuthn)</span>
                      <span className="text-[10px] bg-gray-200 dark:bg-gray-800 px-2 py-0.5 rounded text-gray-500 font-bold uppercase tracking-wider">Setup</span>
                    </button>
                 </div>
               </div>

               {/* Feedback Section */}
               <div className="space-y-3">
                 <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-300 uppercase tracking-wider flex items-center gap-2">
                   <MessageSquareHeart size={16} /> Feedback
                 </h3>
                 <form onSubmit={(e) => {
                   e.preventDefault();
                   alert("Thank you for your feedback!");
                   (e.target as HTMLFormElement).reset();
                 }} className="space-y-2">
                    <textarea 
                      placeholder="Share your thoughts or ideas..." 
                      required
                      className="w-full bg-gray-50 dark:bg-nova-dark border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 text-sm rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-nova-accent focus:border-nova-accent placeholder-gray-500 resize-none h-20"
                    />
                    <button type="submit" className="w-full bg-nova-accent text-gray-900 dark:text-white font-medium py-2 rounded-xl hover:opacity-90 transition-opacity text-sm">
                       Submit Feedback
                    </button>
                 </form>
               </div>

               {/* Report Section */}
               <div className="space-y-3">
                 <h3 className="text-sm font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-2">
                   <Flag size={16} /> Report an Issue
                 </h3>
                 <form onSubmit={(e) => {
                   e.preventDefault();
                   alert("Thank you for reporting this issue. Our team will look into it.");
                   (e.target as HTMLFormElement).reset();
                 }} className="space-y-2">
                    <textarea 
                      placeholder="Describe the issue you encountered..." 
                      required
                      className="w-full bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 text-gray-800 dark:text-gray-200 text-sm rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 placeholder-gray-500 resize-none h-20"
                    />
                    <button type="submit" className="w-full bg-rose-600 text-white font-medium py-2 rounded-xl hover:bg-rose-700 transition-colors text-sm">
                       Submit Report
                    </button>
                 </form>
               </div>
             </div>
             
             <div className="p-4 border-t border-gray-200 dark:border-gray-800 shrink-0 bg-gray-50/50 dark:bg-black/20 flex justify-end">
                <button onClick={() => setShowSettingsModal(false)} className="px-5 py-2 bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white font-medium rounded-xl hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors text-sm">
                  Close Settings
                </button>
             </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
