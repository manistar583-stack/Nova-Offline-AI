import React, { useState } from 'react';
import Markdown from 'react-markdown';
import { User, Sparkles, Code2, Play } from 'lucide-react';
import { Message } from '../types';
import { ImageViewer, VideoViewer } from './MediaViewer';
import { CustomAudioPlayer } from './CustomAudioPlayer';

function CodeBlock({ node, inline, className, children, ...props }: any) {
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const codeStr = String(children).replace(/\n$/, '');
  const [view, setView] = useState<'code' | 'preview'>('preview');

  if (!inline && match && (language === 'html' || language === 'svg' || language === 'xml' || language === 'react')) {
    return (
      <div className="my-5 w-full rounded-xl overflow-hidden border border-gray-700/50 bg-nova-dark/50 ring-1 ring-white/10 shadow-xl">
        <div className="flex items-center justify-between px-3 py-2 bg-black/40 border-b border-gray-700/50">
           <div className="flex gap-2">
             <button onClick={() => setView('preview')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${view === 'preview' ? 'bg-nova-accent text-white shadow-md' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}>
               <Play size={14} /> Artifact Preview
             </button>
             <button onClick={() => setView('code')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${view === 'code' ? 'bg-gray-700 text-white shadow-md' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}>
               <Code2 size={14} /> Code
             </button>
           </div>
           <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold px-2">{language}</span>
        </div>
        <div className="p-0 bg-transparent flex flex-col w-full">
           {view === 'code' ? (
             <pre className="p-4 overflow-auto text-sm text-gray-300 font-mono bg-[#1e1e1e] m-0 max-h-[500px] w-full" {...props}>
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
       <div className="flex items-center justify-between px-4 py-2 bg-black/40 border-b border-gray-800">
          <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">{language || 'code'}</span>
       </div>
       <pre className="p-4 overflow-auto text-sm text-gray-300 font-mono m-0" {...props}>
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
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isAssistant = message.role === 'assistant';

  return (
    <div
      className={`flex w-full px-4 py-8 sm:px-6 ${
        isAssistant ? 'bg-nova-surface' : 'bg-transparent'
      }`}
    >
      <div className="mx-auto flex w-full max-w-3xl gap-4 sm:gap-6">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-sm ${
            isAssistant
              ? 'bg-nova-accent text-white'
              : 'bg-emerald-600 text-white'
          }`}
        >
          {isAssistant ? <Sparkles size={18} /> : <User size={18} />}
        </div>
        <div className="flex-1 space-y-2 overflow-hidden">
          <div className="font-display text-sm font-semibold text-gray-200">
            {isAssistant ? 'Nova' : 'You'}
          </div>
          <div className="prose prose-invert max-w-none text-gray-300">
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
        </div>
      </div>
    </div>
  );
}
