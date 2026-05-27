import React, { useState, useEffect } from 'react';
import Markdown from 'react-markdown';
import { User, Sparkles, Code2, Play, Pencil, X as XIcon, Check, Copy } from 'lucide-react';
import { motion } from 'motion/react';
import { Message } from '../types';
import { ImageViewer, VideoViewer } from './MediaViewer';
import { CustomAudioPlayer } from './CustomAudioPlayer';

function CodeBlock({ node, inline, className, children, ...props }: any) {
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const codeStr = String(children).replace(/\n$/, '');
  const [view, setView] = useState<'code' | 'preview'>('preview');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(codeStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isVisualPreview = language === 'html' || language === 'svg' || language === 'xml' || language === 'react';
  const isRunnable = language === 'python' || language === 'py' || language === 'javascript' || language === 'js' || language === 'ts' || language === 'typescript';

  const getRunnerDoc = (lang: string, code: string) => {
    if (lang === 'python' || lang === 'py') {
      return `
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js"></script>
  <style>
    body { background: #1e1e1e; color: #d4d4d4; font-family: monospace; padding: 16px; margin: 0; }
    pre { white-space: pre-wrap; word-wrap: break-word; margin: 0; }
    .error { color: #f48771; }
    .system { color: #569cd6; }
  </style>
</head>
<body>
  <pre id="output"><span class="system">Loading Python environment (Pyodide)...</span>\n</pre>
  <script>
    const output = document.getElementById('output');
    const log = (msg, isError = false) => {
      const span = document.createElement('span');
      if(isError) span.className = 'error';
      span.innerText = msg + '\\n';
      output.appendChild(span);
    };
    
    async function main() {
      try {
        let pyodide = await loadPyodide();
        const code = ${JSON.stringify(code)};
        
        output.innerHTML += '<span class="system">Loading required packages...</span>\\n';
        await pyodide.loadPackagesFromImports(code);
        
        output.innerHTML = '<span class="system">Runtime Ready.</span>\\n<span class="system">---</span>\\n';
        
        pyodide.setStdout({ batched: (str) => log(str) });
        pyodide.setStderr({ batched: (str) => log(str, true) });
        
        await pyodide.runPythonAsync(code);
      } catch (err) {
        log(err.toString(), true);
      }
    }
    main();
  </script>
</body>
</html>`;
    }
    
    if (lang === 'javascript' || lang === 'js' || lang === 'ts' || lang === 'typescript') {
      // Remove typescript type annotations via simple regex for preview
      const jsCode = (lang === 'ts' || lang === 'typescript') ? 
        code.replace(/:\\s*[A-Z][a-zA-Z0-9_]*\\b/g, '') // Basic heuristic
        : code;
        
      return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { background: #1e1e1e; color: #d4d4d4; font-family: monospace; padding: 16px; margin: 0; }
    pre { white-space: pre-wrap; word-wrap: break-word; margin: 0; }
    .error { color: #f48771; }
    .system { color: #569cd6; }
  </style>
</head>
<body>
  <pre id="output"><span class="system">Executing Javascript...</span>\n<span class="system">---</span>\n</pre>
  <script>
    const output = document.getElementById('output');
    const log = (msg, isError = false) => {
      const span = document.createElement('span');
      if(isError) span.className = 'error';
      span.innerText = msg + '\\n';
      output.appendChild(span);
    };
    const formatArg = (arg) => {
      if (arg === null) return 'null';
      if (arg === undefined) return 'undefined';
      if (typeof arg === 'object') {
        try { return JSON.stringify(arg, null, 2); } catch(e) { return String(arg); }
      }
      return String(arg);
    }
    console.log = (...args) => log(args.map(formatArg).join(' '));
    console.error = (...args) => log(args.map(formatArg).join(' '), true);
    console.warn = (...args) => log(args.map(formatArg).join(' '), true);
    console.info = (...args) => log(args.map(formatArg).join(' '));
    
    window.onerror = (msg) => {
      console.error(msg);
      return false;
    };
  </script>
  <script type="module">
    try {
      ${jsCode.replace(/<\/script>/g, '<\\/script>')}
    } catch(e) {
      console.error(e.toString());
    }
  </script>
</body>
</html>`;
    }
    return code;
  };

  if (!inline && match && (isVisualPreview || isRunnable)) {
    return (
      <div className="my-5 w-full rounded-xl overflow-hidden border border-gray-700/50 bg-nova-dark/50 ring-1 ring-white/10 shadow-xl">
        <div className="flex items-center justify-between px-3 py-2 bg-black/40 border-b border-gray-700/50">
           <div className="flex gap-2">
             <button onClick={() => setView('preview')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${view === 'preview' ? 'bg-nova-accent text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}>
               <Play size={14} /> {isRunnable ? 'Run execution' : 'Artifact Preview'}
             </button>
             <button onClick={() => setView('code')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${view === 'code' ? 'bg-white/20 text-white shadow-md ring-1 ring-white/30' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}>
               <Code2 size={14} /> Code
             </button>
           </div>
           <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-gray-600 dark:text-gray-400 font-bold px-2">{language}</span>
              <button onClick={handleCopy} className="text-gray-500 hover:text-gray-300 transition-colors" title="Copy code">
                 {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              </button>
           </div>
        </div>
        <div className="p-0 bg-transparent flex flex-col w-full">
           {view === 'code' ? (
             <pre className="p-4 overflow-auto text-sm text-gray-700 dark:text-gray-300 font-mono bg-[#1e1e1e] m-0 max-h-[500px] w-full" {...props}>
               <code className={className}>{children}</code>
             </pre>
           ) : (
             <div className={`w-full relative flex-grow flex rounded-b-xl overflow-hidden ${isRunnable ? 'bg-[#1e1e1e]' : 'bg-white'}`} style={{ minHeight: '400px', height: 'auto', resize: 'vertical' }}>
                <iframe srcDoc={isRunnable ? getRunnerDoc(language, codeStr) : codeStr} className="w-full flex-grow border-none" style={{ minHeight: '400px' }} sandbox="allow-scripts allow-forms allow-same-origin"/>
             </div>
           )}
        </div>
      </div>
    );
  }

  return (!inline && match) || (!inline && codeStr.includes('\n')) ? (
    <div className="my-5 rounded-xl overflow-hidden border border-gray-700/50 bg-[#1e1e1e] shadow-lg">
       <div className="flex items-center justify-between px-4 py-2 bg-black/40 border-b border-gray-300 dark:border-gray-800">
          <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">{language || 'code'}</span>
          <button onClick={handleCopy} className="text-gray-500 hover:text-gray-300 transition-colors" title="Copy code">
             {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
          </button>
       </div>
       <pre className="p-4 overflow-auto text-sm text-gray-700 dark:text-gray-300 font-mono m-0" {...props}>
         <code className={className}>{children}</code>
       </pre>
    </div>
  ) : (
    <code className="bg-white/10 text-nova-accent px-1.5 py-0.5 rounded text-sm font-mono whitespace-pre-wrap" {...props}>
      {children}
    </code>
  );
}

interface ChatMessageProps {
  message: Message;
  onEdit?: (id: string, newContent: string) => void;
}

export function ChatMessage({ message, onEdit }: ChatMessageProps) {
  const isAssistant = message.role === 'assistant';
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  
  const [displayedContent, setDisplayedContent] = useState(message.isTyping ? '' : message.content);

  useEffect(() => {
    if (message.isTyping && displayedContent.length < message.content.length) {
      const timeoutId = setTimeout(() => {
        setDisplayedContent(prev => message.content.slice(0, prev.length + 3));
      }, 10);
      return () => clearTimeout(timeoutId);
    } else if (message.isTyping && displayedContent.length >= message.content.length) {
      if (message.isTyping) {
        message.isTyping = false;
        setDisplayedContent(message.content);
      }
    } else if (!message.isTyping) {
      setDisplayedContent(message.content);
    }
  }, [displayedContent, message.content, message.isTyping]);

  const handleSave = () => {
    if (onEdit && editContent.trim() !== '' && editContent !== message.content) {
      onEdit(message.id, editContent);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditContent(message.content);
    setIsEditing(false);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 30, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={`flex w-full px-4 py-8 sm:px-6 relative group ${
        isAssistant 
          ? 'bg-white/60 dark:bg-black/20 backdrop-blur-xl border-y border-white/40 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.12)]' 
          : 'bg-transparent'
      }`}
    >
      <div className="mx-auto flex w-full max-w-3xl gap-4 sm:gap-6">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-sm ${
            isAssistant
              ? 'bg-nova-accent text-white'
              : 'bg-emerald-600 text-gray-900 dark:text-white'
          }`}
        >
          {isAssistant ? <Sparkles size={18} /> : <User size={18} />}
        </div>
        <div className="flex-1 space-y-2 overflow-hidden relative">
          <div className="font-display text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center justify-between">
            <div className="flex items-baseline gap-2">
              <span>{isAssistant ? 'Nova' : 'You'}</span>
              <span className="text-[10px] font-normal text-gray-400 dark:text-gray-500">
                {message.timestamp?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || ''}
              </span>
            </div>
            {!isAssistant && onEdit && !isEditing && (
              <button 
                onClick={() => setIsEditing(true)} 
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white"
                title="Edit message"
              >
                <Pencil size={14} />
              </button>
            )}
          </div>
          
          {isEditing ? (
            <div className="w-full flex flex-col gap-2 mt-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full bg-white/20 dark:bg-black/20 backdrop-blur-md text-gray-800 dark:text-gray-200 border border-black/10 dark:border-white/10 rounded-lg p-3 min-h-[100px] focus:outline-none focus:ring-1 focus:ring-nova-accent focus:border-nova-accent resize-y"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-black/5 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/20 transition-colors"
                >
                  <XIcon size={14} /> Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={editContent.trim() === ''}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-emerald-600 text-gray-900 dark:text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                >
                  <Check size={14} /> Save & Submit
                </button>
              </div>
            </div>
          ) : (
            <div className="prose prose-invert max-w-none text-gray-700 dark:text-gray-300">
              {message.audio && (
                <div className="mb-4">
                  <CustomAudioPlayer src={message.audio} />
                </div>
              )}
              {message.image && (
                <div className="mb-4">
                  <ImageViewer src={message.image} alt="User Uploaded Image" />
                </div>
              )}
              <Markdown
                urlTransform={(value: string) => value}
                components={{
                  code: CodeBlock,
                  img: ({ node, ...props }) => {
                    if (!props.src || props.src.trim() === '') return null;
                    if (props.alt === 'video-frame') {
                      return <VideoViewer src={props.src} alt={props.alt!} />;
                    }
                    return <ImageViewer src={props.src} alt={props.alt || "Generated Output"} />;
                  },
                  a: ({ node, ...props }) => {
                    if (props.title === 'audio' || (props.href && props.href.startsWith('data:audio/'))) {
                      if (!props.href || props.href.trim() === '') return null;
                      return <CustomAudioPlayer src={props.href} />;
                    }
                    if (!props.href || props.href.trim() === '') return <span {...props} />;
                    return <a href={props.href} target="_blank" rel="noopener noreferrer" className="text-nova-accent hover:underline" {...props} />;
                  },
                  p: ({ node, ...props }) => <span className="block mb-4 last:mb-0" {...props} />,
                }}
              >
                {displayedContent + (message.isTyping ? ' ▋' : '')}
              </Markdown>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
