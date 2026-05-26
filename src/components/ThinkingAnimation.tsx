import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Search, BrainCircuit, PenTool } from 'lucide-react';

const phases = [
  { text: "Analyzing context...", icon: BrainCircuit, color: "text-purple-500" },
  { text: "Searching knowledge...", icon: Search, color: "text-blue-500" },
  { text: "Synthesizing response...", icon: Sparkles, color: "text-amber-500" },
  { text: "Finalizing thoughts...", icon: PenTool, color: "text-emerald-500" }
];

export function ThinkingAnimation({ mode }: { mode: string }) {
  const [phaseIndex, setPhaseIndex] = useState(0);

  useEffect(() => {
    // If fast mode, maybe don't cycle as much or just show a general thinking state, 
    // but the task says "multi-phase loading animation", so we'll do it for all or fast mode can be slightly faster.
    const interval = setInterval(() => {
      setPhaseIndex((prev) => (prev + 1) % phases.length);
    }, mode === 'fast' ? 1500 : 2500);
    return () => clearInterval(interval);
  }, [mode]);

  const CurrentIcon = phases[phaseIndex].icon;

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex items-center justify-center h-6 w-6">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-nova-accent border-r-nova-accent opacity-50"
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          className="absolute inset-1 rounded-full border-2 border-transparent border-b-purple-500 border-l-purple-500 opacity-50"
        />
        <CurrentIcon size={12} className={phases[phaseIndex].color} />
      </div>
      <div className="relative h-6 overflow-hidden min-w-[180px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={phaseIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 flex items-center text-sm font-medium text-gray-600 dark:text-gray-400"
          >
            {phases[phaseIndex].text}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
