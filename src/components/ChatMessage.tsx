import React, { useState } from 'react';
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

  if (!inline && match && (language === 'html' || language === 'svg' || language === 'xml' || language === 'react')) {
    return (
      <div className="my-5 w-full rounded-xl overflow-hidden border border-gray-700/50 bg-nova-dark/50 ring-1 ring-white/10 shadow-xl">
        <div className="flex items-center justify-between px-3 py-2 bg-black/40 border-b border-gray-700/50">
           <div className="flex gap-2">
             <button onClick={() => setView('preview')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${view === 'preview' ? 'bg-nova-accent text-white shadow-md' : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-white/5'}`}>
               <Play size={14} /> Artifact Preview
             </button>
             <button onClick={() => setView('code')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${view === 'code' ? 'bg-gray-700 text-gray-900 dark:text-white shadow-md' : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-white/5'}`}>
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
             <div className="w-full bg-white relative rounded-b-xl flex-grow flex" style={{ minHeight: '400px', height: 'auto', resize: 'vertical', overflow: 'auto' }}>
                <iframe srcDoc={codeStr} className="w-full flex-grow border-none" style={{ minHeight: '400px' }} sandbox="allow-scripts allow-forms allow-same-origin"/>
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
      initial={{ opacity: 0, x: isAssistant ? -30 : 30, scale: 0.8 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      className={`flex w-full px-4 py-8 sm:px-6 relative group ${
        isAssistant ? 'bg-white dark:bg-nova-surface' : 'bg-transparent'
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
                className="w-full bg-nova-dark/50 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg p-3 min-h-[100px] focus:outline-none focus:ring-1 focus:ring-nova-accent focus:border-nova-accent resize-y"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-700 transition-colors"
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
                {message.content}
              </Markdown>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
