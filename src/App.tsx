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
  BookOpen,
  ArrowRight,
  Check,
  RotateCcw,
  Sparkle
} from 'lucide-react';
import { cn } from './lib/utils';

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface LetterRuleDetail {
  targetWordOrLetter: string;
  correctedWordOrLetter: string;
  ruleType: string;
  letterReasonSinhala: string;
  isRuleCompliant: boolean;
}

export interface Correction {
  correctedText: string;
  explanation: string;
  isCorrect: boolean;
  score: number;
  letterRules: LetterRuleDetail[];
}

export default function App() {
  const [inputText, setInputText] = useState('');
  const [correction, setCorrection] = useState<Correction | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  const [appliedRules, setAppliedRules] = useState<Record<number, boolean>>({});

  const abortControllerRef = useRef<AbortController | null>(null);

  const checkText = async (text: string) => {
    if (!text.trim()) {
      setCorrection(null);
      setIsChecking(false);
      setError(null);
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
        contents: `You are an authoritative Sinhala linguistics and grammar expert (සිංහල භාෂා හා අක්ෂර වින්‍යාස විශේෂඥයෙකි).
Carefully inspect the following Sinhala text for spelling, letter selection, grammar, and punctuation:

Text: "${text}"

TASK:
1. Provide the complete corrected text.
2. Determine if the input text is already grammatically and orthographically correct (isCorrect).
3. Assign a linguistic accuracy score out of 100.
4. Provide a clear overall summary explanation in Sinhala.
5. Provide a detailed breakdown of specific letter and word grammar rules (letterRules):
   - If there are mistakes: For EVERY incorrect letter or word (e.g. ණ/න භේදය, ල/ළ භේදය, ශ/ෂ/ස භේදය, අල්පප්‍රාණ/මහාප්‍රාණ, ඇලපිල්ල/පිල්ලම්, නිපාත පුනරුක්තිය, උක්ත-ආඛ්‍යාත රීතිය), explain EXACTLY WHY that specific letter/word was wrong and WHY the corrected letter/word is right according to classical and standard Sinhala grammar rules (ශ්‍රී ලංකා ප්‍රමිති ආයතනයේ හා ජාතික අධ්‍යාපන ආයතනයේ සම්මත සිංහල අක්ෂර වින්‍යාස රීති).
   - If the text is ALREADY correct: Highlight 1 to 3 key correct letters or grammatical rules used properly in the text (e.g. why 'ණ' or 'ල' or subject-verb concord in this position adheres to Sinhala grammar rules), setting isRuleCompliant to true.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              correctedText: { 
                type: Type.STRING,
                description: "The complete grammatically corrected Sinhala text"
              },
              explanation: { 
                type: Type.STRING,
                description: "Overall summary explanation in Sinhala"
              },
              isCorrect: { 
                type: Type.BOOLEAN,
                description: "True if no changes were needed, false otherwise"
              },
              score: {
                type: Type.INTEGER,
                description: "Grammatical quality score from 0 to 100"
              },
              letterRules: {
                type: Type.ARRAY,
                description: "Breakdown of specific letters or words and their Sinhala grammatical rules",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    targetWordOrLetter: { 
                      type: Type.STRING,
                      description: "The specific word or letter evaluated (e.g. පාසැල්, ණ, ඉතාමත්)"
                    },
                    correctedWordOrLetter: { 
                      type: Type.STRING,
                      description: "The correct word or letter according to grammar rules (e.g. පාසල්, න, ඉතා)"
                    },
                    ruleType: { 
                      type: Type.STRING,
                      description: "Category of rule in Sinhala (e.g. 'ණ / න භේදය', 'ල / ළ භේදය', 'ශ / ෂ / ස භාවිතය', 'මහාප්‍රාණ අක්ෂර', 'පිල්ලම් භාවිතය', 'උක්ත ආඛ්‍යාත රීතිය', 'නිපාත පද')"
                    },
                    letterReasonSinhala: { 
                      type: Type.STRING,
                      description: "Thorough linguistic explanation in Sinhala stating why that letter/word is wrong or right according to Sinhala grammar laws"
                    },
                    isRuleCompliant: { 
                      type: Type.BOOLEAN,
                      description: "True if highlighting a rule already obeyed, false if it was an error corrected"
                    }
                  },
                  required: [
                    "targetWordOrLetter", 
                    "correctedWordOrLetter", 
                    "ruleType", 
                    "letterReasonSinhala", 
                    "isRuleCompliant"
                  ]
                }
              }
            },
            required: ["correctedText", "explanation", "isCorrect", "score", "letterRules"]
          }
        }
      });

      const result = JSON.parse(response.text || '{}') as Correction;
      setCorrection(result);
      setAppliedRules({});
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Correction error:', err);
        
        // Handle Quota/Credit exhaustion specifically
        if (err.message?.includes('429') || err.message?.toLowerCase().includes('quota')) {
          setError('දෛනික සීමාව ඉක්මවා ඇත. කරුණාකර මද වේලාවකින් නැවත උත්සාහ කරන්න. (Daily limit exceeded. Please try again later.)');
        } else {
          setError('යම් දෝෂයක් සිදු විය. කරුණාකර නැවත උත්සාහ කරන්න.');
        }
      }
    } finally {
      setIsChecking(false);
    }
  };

  const debouncedCheck = useCallback(
    debounce((text: string) => checkText(text), 3000),
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
    setAppliedRules({});
  };

  const applySingleRule = (index: number, target: string, replacement: string) => {
    if (!target || !replacement) return;
    setInputText((prev) => {
      return prev.replace(target, replacement);
    });
    setAppliedRules((prev) => ({ ...prev, [index]: true }));
  };

  const applyAllCorrections = () => {
    if (correction?.correctedText) {
      setInputText(correction.correctedText);
      setAppliedRules(
        correction.letterRules.reduce((acc, _, idx) => ({ ...acc, [idx]: true }), {})
      );
    }
  };

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-theme-bg font-sans selection:bg-theme-accent/30 selection:text-white">
      {/* Header */}
      <header className="h-[70px] border-b border-theme-border flex items-center justify-between px-10 bg-theme-header shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-theme-accent rounded-md flex items-center justify-center text-black font-bold text-xl">
            අ
          </div>
          <div>
            <div className="text-2xl font-light tracking-wider text-white font-serif">Akshara</div>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <div className="hidden sm:flex items-center gap-2 text-xs text-theme-text-muted">
            <BookOpen size={14} className="text-theme-accent" />
            <span>සම්මත සිංහල අක්ෂර වින්‍යාස විග්‍රහය (Sinhala Grammar & Letter Rules)</span>
          </div>
          <div className="w-11 h-[22px] bg-theme-accent rounded-full relative">
            <div className="w-[18px] h-[18px] bg-white rounded-full absolute top-[2px] right-[2px]" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Editor Workspace */}
        <section className="flex-1 p-8 sm:p-10 border-r border-theme-border flex flex-col gap-6 overflow-y-auto">
          <div className="flex justify-between items-end flex-wrap gap-3">
            <div>
              <h1 className="font-serif text-[32px] font-light m-0 text-white">Draft Workspace</h1>
              <p className="text-xs text-theme-text-muted mt-1">
                ඔබේ සිංහල පාඨය ඇතුළත් කරන්න. අකුරු හා වියරණ නීති ක්ෂණිකව විශ්ලේෂණය කෙරේ.
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="bg-theme-accent/10 text-theme-accent px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
                Sinhala (Standard)
              </span>
              {correction && !correction.isCorrect && (
                <button
                  onClick={applyAllCorrections}
                  className="bg-theme-accent text-black hover:bg-theme-accent/90 text-xs px-3 py-1 rounded font-semibold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                  title="Apply all suggested corrections"
                >
                  <Sparkles size={13} />
                  <span>සියල්ල නිවැරදි කරන්න (Apply All)</span>
                </button>
              )}
            </div>
          </div>
          
          <div className="bg-theme-card border border-theme-border rounded-xl flex-1 flex flex-col p-8 relative shadow-2xl min-h-[300px]">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="මෙහි සිංහලෙන් ලියන්න (උදා: ශ්‍රී ලංකාව ඉතාමත් ලස්සන රටකි. මම හෙට පාසැල් යනවා)..."
              className="flex-1 bg-transparent border-none outline-none text-2xl leading-[1.8] text-[#f0f0f0] resize-none placeholder:text-theme-text-muted/30 font-sans"
            />
            <div className="pt-4 border-t border-theme-border/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button 
                  onClick={handleClear}
                  className="text-theme-text-muted hover:text-red-500 transition-colors flex items-center gap-1.5 text-xs cursor-pointer"
                  title="Clear text"
                >
                  <Trash2 size={16} />
                  <span>Clear Draft</span>
                </button>
              </div>
              <span className="text-theme-text-muted/40 text-[11px] font-mono">
                {inputText.length} CHARS
              </span>
            </div>
          </div>
        </section>

        {/* Sidebar */}
        <aside className="w-[420px] bg-theme-sidebar p-8 px-6 flex flex-col gap-6 overflow-y-auto shrink-0 border-l border-theme-border/50">
          <section className="space-y-5">
            <div className="flex items-center justify-between border-b border-theme-border pb-3">
              <div className="text-[13px] uppercase tracking-[2px] text-theme-accent font-semibold flex items-center gap-2">
                <BookOpen size={16} />
                <span>අක්ෂර හා වියරණ නීති (Rules)</span>
              </div>
              {correction && (
                <span className="text-[11px] font-mono bg-[#1c1f26] px-2 py-0.5 rounded text-theme-accent border border-theme-border">
                  Score: {correction.score}/100
                </span>
              )}
            </div>

            <AnimatePresence mode="wait">
              {!inputText ? (
                <motion.div 
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-8 border border-dashed border-theme-border rounded-xl text-center space-y-3"
                >
                  <Languages size={28} className="mx-auto text-theme-text-muted/30" />
                  <p className="text-theme-text-muted text-xs leading-relaxed">
                    වචනයක් හෝ වාක්‍යයක් ලියන්න. <br />
                    න/ණ, ල/ළ, ශ/ෂ/ස සහ අනෙකුත් අක්ෂර නිවැරදි හෝ වැරදි වීමට හේතු විග්‍රහ කෙරේ.
                  </p>
                </motion.div>
              ) : isChecking ? (
                <motion.div 
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-theme-correction border border-theme-border rounded-xl p-8 flex flex-col items-center gap-3 text-center"
                >
                  <Loader2 size={26} className="text-theme-accent animate-spin" />
                  <span className="text-xs text-white font-medium">සිංහල වියරණ රීති පරීක්ෂා කරමින් පවතී...</span>
                  <span className="text-[11px] text-theme-text-muted">Analyzing letter choices and orthography rules</span>
                </motion.div>
              ) : error ? (
                <motion.div 
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-red-950/20 border border-red-900/30 rounded-xl p-6 text-center"
                >
                  <AlertCircle size={24} className="mx-auto mb-2 text-red-500" />
                  <p className="text-red-400 text-xs">{error}</p>
                </motion.div>
              ) : correction ? (
                <motion.div 
                  key="correction"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  {/* Overall Result Banner */}
                  <div className="bg-theme-correction border border-theme-border rounded-xl p-5 flex flex-col gap-3 shadow-lg">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] text-theme-text-muted font-bold uppercase tracking-wider">
                        {correction.isCorrect ? "Grammatically Perfect" : "Full Suggested Text"}
                      </div>
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded",
                        correction.isCorrect 
                          ? "bg-emerald-500/20 text-emerald-400" 
                          : "bg-theme-accent/20 text-theme-accent"
                      )}>
                        {correction.isCorrect ? "නිවැරදියි (Valid)" : "සංශෝධනයන් ඇත (Changes)"}
                      </span>
                    </div>

                    <div className="text-[18px] text-theme-accent font-medium font-serif leading-relaxed">
                      {correction.correctedText}
                    </div>

                    <div className="text-[12px] leading-relaxed text-[#b0b0b0] bg-[#12141a]/60 p-3 rounded border border-[#2a2d35]/60">
                      {correction.explanation}
                    </div>
                    
                    <div className="flex gap-2.5 mt-1 flex-wrap">
                      <button 
                        onClick={handleCopy}
                        className={cn(
                          "px-4 py-2 rounded-lg font-semibold text-[12px] transition-all cursor-pointer flex items-center gap-1.5",
                          copyStatus === 'copied'
                            ? "bg-emerald-600 text-white"
                            : "bg-theme-accent text-black hover:bg-theme-accent/90"
                        )}
                      >
                        <Copy size={13} />
                        <span>{copyStatus === 'copied' ? 'Copied' : 'Copy Corrected Text'}</span>
                      </button>

                      {!correction.isCorrect && (
                        <button 
                          onClick={applyAllCorrections}
                          className="px-3 py-2 rounded-lg border border-theme-border text-xs text-white hover:bg-white/5 transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <Sparkles size={13} className="text-theme-accent" />
                          <span>Apply to Draft</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Letter-by-Letter and Grammar Rule Cards */}
                  <div className="space-y-3 pt-2">
                    <div className="text-xs uppercase tracking-wider font-semibold text-theme-accent/90 flex items-center justify-between">
                      <span>අක්ෂර හා වියරණ නීති විස්තරය ({correction.letterRules.length})</span>
                      <span className="text-[10px] text-theme-text-muted lowercase font-normal">why it's right/wrong</span>
                    </div>

                    {correction.letterRules.map((rule, idx) => (
                      <div 
                        key={idx}
                        className={cn(
                          "border rounded-xl p-4 flex flex-col gap-3 transition-all",
                          rule.isRuleCompliant 
                            ? "bg-emerald-950/10 border-emerald-800/30" 
                            : "bg-[#181b22] border-theme-border hover:border-theme-accent/40"
                        )}
                      >
                        {/* Header: Rule Category */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="bg-theme-accent/15 text-theme-accent font-semibold px-2 py-0.5 rounded text-[11px] border border-theme-accent/20">
                            {rule.ruleType}
                          </span>

                          <span className={cn(
                            "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide",
                            rule.isRuleCompliant 
                              ? "text-emerald-400 bg-emerald-500/10" 
                              : "text-red-400 bg-red-500/10"
                          )}>
                            {rule.isRuleCompliant ? "නිවැරදි රීතිය (Rule followed)" : "දෝෂය (Error)"}
                          </span>
                        </div>

                        {/* Visual Difference / Comparison */}
                        {!rule.isRuleCompliant ? (
                          <div className="flex items-center gap-2.5 font-serif text-[15px] bg-[#101217] p-2.5 rounded-lg border border-theme-border/60">
                            <span className="text-red-400 line-through bg-red-950/40 px-2 py-0.5 rounded border border-red-900/50">
                              {rule.targetWordOrLetter}
                            </span>
                            <ArrowRight size={14} className="text-theme-accent shrink-0" />
                            <span className="text-emerald-400 font-bold bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900/50">
                              {rule.correctedWordOrLetter}
                            </span>

                            <button
                              onClick={() => applySingleRule(idx, rule.targetWordOrLetter, rule.correctedWordOrLetter)}
                              className="ml-auto text-[11px] font-sans font-semibold text-theme-accent hover:underline flex items-center gap-1 cursor-pointer bg-theme-accent/10 px-2 py-1 rounded"
                              title="Replace this word in your draft"
                            >
                              {appliedRules[idx] ? (
                                <>
                                  <Check size={12} className="text-emerald-400" />
                                  <span className="text-emerald-400">Fixed</span>
                                </>
                              ) : (
                                <>
                                  <Sparkle size={11} />
                                  <span>Fix</span>
                                </>
                              )}
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 font-serif text-[15px] bg-[#101217] p-2.5 rounded-lg border border-theme-border/60 text-emerald-400 font-semibold">
                            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                            <span>"{rule.targetWordOrLetter}"</span>
                            <span className="text-xs text-theme-text-muted font-sans font-normal ml-auto">
                              නිවැරදි අක්ෂර වින්‍යාසය
                            </span>
                          </div>
                        )}

                        {/* Deep Linguistic Reason */}
                        <div className="bg-[#12141a] p-3 rounded-lg border border-theme-border/80 text-[12px] leading-relaxed">
                          <div className="flex items-center gap-1.5 text-theme-accent font-semibold text-[11px] mb-1.5">
                            <BookOpen size={13} />
                            <span>වියරණ හා අක්ෂර නීතිය (Grammar Law):</span>
                          </div>
                          <p className="font-sans text-gray-300 leading-normal">
                            {rule.letterReasonSinhala}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {correction.isCorrect && (
                    <div className="p-4 bg-emerald-950/20 border border-emerald-900/40 rounded-xl flex items-center gap-3 text-emerald-400 text-xs">
                      <CheckCircle2 size={18} className="shrink-0" />
                      <span>ඔබ ඇතුළත් කළ පාඨය සම්මත සිංහල වියරණ හා අක්ෂර වින්‍යාස නීතිවලට පූර්ණ ලෙස අනුකූල වේ.</span>
                    </div>
                  )}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </section>

          {/* Stats Widget */}
          <section className="mt-auto pt-4 border-t border-theme-border">
            <div className="p-4 border border-dashed border-[#3a3d45] rounded-xl space-y-3 bg-[#111318]">
              <div className="flex justify-between items-center text-[12px] text-[#888]">
                <span>Linguistic Accuracy Score</span>
                <b className="text-theme-accent font-mono text-sm">
                  {correction ? `${correction.score}/100` : '0/100'}
                </b>
              </div>
              <div className="h-1.5 bg-[#222] rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${correction ? correction.score : 0}%` }}
                  className="h-full bg-gradient-to-r from-amber-600 to-theme-accent"
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
