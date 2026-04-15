/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import debounce from 'lodash.debounce';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Languages, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Copy, 
  Trash2,
  History,
  Info
} from 'lucide-react';
import { cn } from './lib/utils';

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface Correction {
  correctedText: string;
  explanation: string;
  isCorrect: boolean;
}

export default function App() {
  const [inputText, setInputText] = useState('');
  const [correction, setCorrection] = useState<Correction | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');

  const abortControllerRef = useRef<AbortController | null>(null);

  const checkText = async (text: string) => {
    if (!text.trim()) {
      setCorrection(null);
      setIsChecking(false);
      return;
    }

    setIsChecking(true);
    setError(null);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Correct the following Sinhala text for spelling, grammar, and punctuation. 
        If the text is already correct, say so.
        Provide the response in JSON format with the following structure:
        {
          "correctedText": "the full corrected text",
          "explanation": "a brief explanation of changes in Sinhala",
          "isCorrect": boolean (true if no changes were needed)
        }
        
        Text to correct: "${text}"`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              correctedText: { type: Type.STRING },
              explanation: { type: Type.STRING },
              isCorrect: { type: Type.BOOLEAN }
            },
            required: ["correctedText", "explanation", "isCorrect"]
          }
        }
      });

      const result = JSON.parse(response.text || '{}') as Correction;
      setCorrection(result);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Correction error:', err);
        setError('යම් දෝෂයක් සිදු විය. කරුණාකර නැවත උත්සාහ කරන්න.');
      }
    } finally {
      setIsChecking(false);
    }
  };

  const debouncedCheck = useCallback(
    debounce((text: string) => checkText(text), 1000),
    []
  );

  useEffect(() => {
    if (inputText) {
      debouncedCheck(inputText);
    } else {
      setCorrection(null);
      setIsChecking(false);
    }
  }, [inputText, debouncedCheck]);

  const handleCopy = async () => {
    if (correction?.correctedText) {
      await navigator.clipboard.writeText(correction.correctedText);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    }
  };

  const handleClear = () => {
    setInputText('');
    setCorrection(null);
  };

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-theme-bg font-sans selection:bg-theme-accent/30 selection:text-white">
      {/* Header */}
      <header className="h-[70px] border-b border-theme-border flex items-center justify-between px-10 bg-theme-header shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-theme-accent rounded-md flex items-center justify-center text-black font-bold text-xl">
            අ
          </div>
          <div className="text-2xl font-light tracking-wider text-white font-serif">Akshara</div>
        </div>
        <div className="flex items-center gap-5">
          <span className="text-[13px] opacity-60">Real-time correction active</span>
          <div className="w-11 h-[22px] bg-theme-accent rounded-full relative">
            <div className="w-[18px] h-[18px] bg-white rounded-full absolute top-[2px] right-[2px]" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Editor Workspace */}
        <section className="flex-1 p-10 border-r border-theme-border flex flex-col gap-6 overflow-y-auto">
          <div className="flex justify-between items-end">
            <h1 className="font-serif text-[32px] font-light m-0 text-white">Draft Workspace</h1>
            <span className="bg-theme-accent/10 text-theme-accent px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
              Sinhala (Standard)
            </span>
          </div>
          
          <div className="bg-theme-card border border-theme-border rounded-xl flex-1 flex flex-col p-8 relative shadow-2xl">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="මෙහි සිංහලෙන් ලියන්න..."
              className="flex-1 bg-transparent border-none outline-none text-2xl leading-[1.8] text-[#f0f0f0] resize-none placeholder:text-theme-text-muted/30"
            />
            <div className="absolute bottom-6 right-8 flex items-center gap-4">
              <button 
                onClick={handleClear}
                className="text-theme-text-muted hover:text-red-500 transition-colors"
                title="Clear text"
              >
                <Trash2 size={18} />
              </button>
              <span className="text-theme-text-muted/40 text-[11px] font-mono">
                {inputText.length} CHARS
              </span>
            </div>
          </div>
        </section>

        {/* Sidebar */}
        <aside className="w-[340px] bg-theme-sidebar p-10 px-6 flex flex-col gap-8 overflow-y-auto shrink-0">
          <section className="space-y-6">
            <div className="text-[14px] uppercase tracking-[2px] text-theme-accent font-semibold">
              Suggestions
            </div>

            <AnimatePresence mode="wait">
              {!inputText ? (
                <motion.div 
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-6 border border-dashed border-theme-border rounded-lg text-center"
                >
                  <Languages size={24} className="mx-auto mb-3 text-theme-text-muted/30" />
                  <p className="text-theme-text-muted text-xs">Enter text to begin correction</p>
                </motion.div>
              ) : isChecking ? (
                <motion.div 
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-theme-correction border border-theme-border rounded-lg p-6 flex flex-col items-center gap-3"
                >
                  <Loader2 size={24} className="text-theme-accent animate-spin" />
                  <span className="text-xs text-theme-text-muted">Analyzing text...</span>
                </motion.div>
              ) : error ? (
                <motion.div 
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-red-950/20 border border-red-900/30 rounded-lg p-6 text-center"
                >
                  <AlertCircle size={24} className="mx-auto mb-2 text-red-500" />
                  <p className="text-red-400 text-xs">{error}</p>
                </motion.div>
              ) : correction ? (
                <motion.div 
                  key="correction"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-4"
                >
                  <div className="bg-theme-correction border border-theme-border rounded-lg p-5 flex flex-col gap-3">
                    <div className="text-[12px] opacity-50 font-semibold uppercase tracking-wider">
                      {correction.isCorrect ? "Status" : "Suggested Correction"}
                    </div>
                    <div className="text-[18px] text-theme-accent font-medium font-serif leading-relaxed">
                      {correction.correctedText}
                    </div>
                    <div className="text-[13px] leading-relaxed text-theme-text-muted">
                      {correction.explanation}
                    </div>
                    
                    <div className="flex gap-2.5 mt-2">
                      <button 
                        onClick={handleCopy}
                        className={cn(
                          "px-4 py-2 rounded font-semibold text-[12px] transition-all",
                          copyStatus === 'copied'
                            ? "bg-emerald-600 text-white"
                            : "bg-theme-accent text-black hover:bg-theme-accent/90"
                        )}
                      >
                        {copyStatus === 'copied' ? 'Copied' : 'Copy Result'}
                      </button>
                      {!correction.isCorrect && (
                        <button className="px-4 py-2 rounded border border-[#3a3d45] text-white font-semibold text-[12px] hover:bg-white/5 transition-all">
                          Ignore
                        </button>
                      )}
                    </div>
                  </div>

                  {correction.isCorrect && (
                    <div className="p-4 bg-emerald-950/10 border border-emerald-900/20 rounded-lg flex items-center gap-3 text-emerald-500 text-xs">
                      <CheckCircle2 size={16} />
                      Your text is grammatically perfect.
                    </div>
                  )}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </section>

          {/* Stats Widget */}
          <section className="mt-auto">
            <div className="p-4 border border-dashed border-[#3a3d45] rounded-lg space-y-3">
              <div className="flex justify-between items-center text-[12px] text-[#888]">
                <span>Correction Score</span>
                <b className="text-theme-accent">{correction ? (correction.isCorrect ? '100' : '92') : '0'}/100</b>
              </div>
              <div className="h-1 bg-[#222] rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: correction ? (correction.isCorrect ? '100%' : '92%') : '0%' }}
                  className="h-full bg-theme-accent"
                />
              </div>
            </div>
          </section>
        </aside>
      </main>

      {/* Footer */}
      <footer className="h-10 bg-theme-header border-t border-theme-border flex items-center justify-between px-10 text-[11px] text-[#666] shrink-0">
        <div className="flex gap-4">
          <span>Characters: {inputText.length}</span>
          <span>|</span>
          <span>Words: {inputText.trim() ? inputText.trim().split(/\s+/).length : 0}</span>
          <span>|</span>
          <span>Reading Time: {Math.ceil(inputText.length / 100)}s</span>
        </div>
        <div>Akshara Engine v2.4.1 — © 2026 Precision Linguistics</div>
      </footer>
    </div>
  );
}
