'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

// shadcn
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// icons
import {
  Sparkles, Plus, Search, Trash2, Image as ImageIcon, FileText, Upload,
  Copy, Download, Zap, Code2, BookOpen, FlaskConical, Menu, X,
  Cpu, Wand2, ChevronRight, Clock, CheckCircle2, Loader2, Brain, KeyRound,
} from 'lucide-react';

// =====================================================================================
// Zustand store with localStorage persistence
// =====================================================================================
const useStore = create(
  persist(
    (set, get) => ({
      history: [],            // [{ id, title, language, atsMode, createdAt, input, image, result }]
      activeId: null,
      sidebarOpen: true,

      addItem: (item) => set((s) => ({ history: [item, ...s.history], activeId: item.id })),
      updateItem: (id, patch) => set((s) => ({
        history: s.history.map((h) => (h.id === id ? { ...h, ...patch } : h)),
      })),
      deleteItem: (id) => set((s) => ({
        history: s.history.filter((h) => h.id !== id),
        activeId: s.activeId === id ? null : s.activeId,
      })),
      setActive: (id) => set({ activeId: id }),
      newQuestion: () => set({ activeId: null }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
    }),
    {
      name: 'codevista-store',
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? localStorage : undefined)),
    }
  )
);

const LANGUAGES = ['Python', 'Java', 'C++', 'JavaScript', 'TypeScript', 'Go', 'Rust', 'C#'];
const LANG_TO_PRISM = {
  Python: 'python', Java: 'java', 'C++': 'cpp', JavaScript: 'javascript',
  TypeScript: 'typescript', Go: 'go', Rust: 'rust', 'C#': 'csharp',
};
const LANG_EXT = {
  Python: 'py', Java: 'java', 'C++': 'cpp', JavaScript: 'js',
  TypeScript: 'ts', Go: 'go', Rust: 'rs', 'C#': 'cs',
};

// =====================================================================================
// Animated background orbs
// =====================================================================================
function OrbsBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <motion.div
        className="orb"
        style={{ width: 520, height: 520, left: '-10%', top: '-10%', background: 'radial-gradient(circle, #00f5ff, transparent 60%)' }}
        animate={{ x: [0, 80, -40, 0], y: [0, 40, 80, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="orb"
        style={{ width: 600, height: 600, right: '-15%', top: '20%', background: 'radial-gradient(circle, #c026d3, transparent 60%)' }}
        animate={{ x: [0, -60, 40, 0], y: [0, -40, 60, 0] }}
        transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="orb"
        style={{ width: 420, height: 420, left: '40%', bottom: '-15%', background: 'radial-gradient(circle, #4f46e5, transparent 60%)', opacity: 0.35 }}
        animate={{ x: [0, 30, -30, 0], y: [0, -30, 30, 0] }}
        transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

// =====================================================================================
// Sidebar
// =====================================================================================
function Sidebar() {
  const { history, activeId, setActive, deleteItem, newQuestion, sidebarOpen, toggleSidebar } = useStore();
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    if (!q.trim()) return history;
    const s = q.toLowerCase();
    return history.filter((h) =>
      h.title?.toLowerCase().includes(s) || h.language?.toLowerCase().includes(s)
    );
  }, [history, q]);

  return (
    <AnimatePresence initial={false}>
      {sidebarOpen && (
        <motion.aside
          initial={{ x: -320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -320, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 240, damping: 30 }}
          className="w-[300px] shrink-0 h-screen sticky top-0 flex flex-col glass border-r border-white/5 z-40"
        >
          {/* Brand */}
          <div className="p-5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="relative w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-cyan-500/30 to-fuchsia-500/30 border border-cyan-400/40 neon-border-cyan">
                <Sparkles className="w-4.5 h-4.5 text-cyan-300" />
              </div>
              <div>
                <div className="font-[family-name:var(--font-space-grotesk)] font-bold text-[15px] tracking-tight gradient-text">CodeVista</div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">AI Solver</div>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={toggleSidebar} className="h-8 w-8">
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* New Question button */}
          <div className="px-4">
            <Button
              onClick={() => newQuestion()}
              className="w-full neon-button h-11 font-medium font-[family-name:var(--font-space-grotesk)]"
            >
              <Plus className="w-4 h-4 mr-2" /> New Question
              <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-muted-foreground">⌘K</kbd>
            </Button>
          </div>

          {/* Search */}
          <div className="px-4 mt-4">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search history..."
                className="h-9 pl-8 bg-white/[0.03] border-white/10 placeholder:text-muted-foreground/60"
              />
            </div>
          </div>

          {/* History list */}
          <div className="px-2 mt-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70 px-4">History</div>
          <ScrollArea className="flex-1 px-2 mt-1">
            {filtered.length === 0 && (
              <div className="text-xs text-muted-foreground/70 px-4 py-8 text-center">
                {history.length === 0 ? 'No questions yet. Start by solving one →' : 'No matches.'}
              </div>
            )}
            <div className="flex flex-col gap-1 pb-4">
              {filtered.map((item) => (
                <motion.button
                  key={item.id}
                  onClick={() => setActive(item.id)}
                  whileHover={{ x: 2 }}
                  className={`group text-left rounded-lg px-3 py-2.5 transition-all border ${
                    activeId === item.id
                      ? 'bg-gradient-to-r from-cyan-500/10 to-fuchsia-500/10 border-cyan-400/30'
                      : 'bg-transparent border-transparent hover:bg-white/[0.03] hover:border-white/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-foreground truncate">{item.title || 'Untitled'}</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Badge variant="outline" className="h-4 px-1.5 text-[9px] border-cyan-400/30 text-cyan-300 bg-cyan-400/5">
                          {item.language}
                        </Badge>
                        {item.atsMode && (
                          <Badge variant="outline" className="h-4 px-1.5 text-[9px] border-fuchsia-400/30 text-fuchsia-300 bg-fuchsia-400/5">
                            ATS
                          </Badge>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground/60 mt-1 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {new Date(item.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteItem(item.id); toast.success('Deleted'); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.button>
              ))}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="p-4 border-t border-white/5 text-[10px] text-muted-foreground/70 flex items-center gap-2">
            <Cpu className="w-3 h-3 text-cyan-400" />
            <span>Powered by Claude Sonnet 4.5</span>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

// =====================================================================================
// Top bar (when sidebar is closed)
// =====================================================================================
function Navbar() {
  const { sidebarOpen, toggleSidebar } = useStore();
  return (
    <div className="sticky top-0 z-30 px-6 py-3 flex items-center gap-3 backdrop-blur-xl bg-background/40 border-b border-white/5">
      {!sidebarOpen && (
        <Button variant="ghost" size="icon" onClick={toggleSidebar} className="h-9 w-9">
          <Menu className="w-4 h-4" />
        </Button>
      )}
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-cyan-400" />
        <span className="font-[family-name:var(--font-space-grotesk)] text-sm gradient-text font-semibold">CodeVista AI</span>
      </div>
      <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Online</span>
        <Separator orientation="vertical" className="h-4" />
        <span>claude-sonnet-4.5</span>
      </div>
    </div>
  );
}

// =====================================================================================
// Loading scan ring
// =====================================================================================
function ScanLoader({ label = 'AI is thinking...' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-20">
      <div className="relative">
        <div className="scan-ring" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Brain className="w-6 h-6 text-cyan-300" />
        </div>
      </div>
      <div className="text-center space-y-1">
        <div className="font-[family-name:var(--font-space-grotesk)] gradient-text font-semibold tracking-wide">{label}</div>
        <div className="text-[11px] text-muted-foreground tracking-[0.2em] uppercase">Reading · Reasoning · Writing</div>
      </div>
      <div className="w-72 h-1 rounded-full bg-white/5 overflow-hidden relative">
        <motion.div
          className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-cyan-400 to-transparent"
          animate={{ x: ['-100%', '300%'] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
    </div>
  );
}

// =====================================================================================
// Question Input area
// =====================================================================================
function QuestionInput({ onSolve, busy }) {
  const [tab, setTab] = useState('text');
  const [text, setText] = useState('');
  const [language, setLanguage] = useState('Python');
  const [atsMode, setAtsMode] = useState(true);
  const [imageData, setImageData] = useState(null); // { base64, mime, preview }

  const onDrop = useCallback((files) => {
    const file = files[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      toast.error('Use PNG, JPEG, or WEBP only');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const base64 = dataUrl.split(',')[1];
      setImageData({ base64, mime: file.type, preview: dataUrl, name: file.name });
    };
    reader.readAsDataURL(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/png': [], 'image/jpeg': [], 'image/webp': [] },
    maxFiles: 1,
    multiple: false,
  });

  const canSolve = useMemo(() => {
    if (busy) return false;
    if (tab === 'text') return text.trim().length > 5;
    return !!imageData;
  }, [tab, text, imageData, busy]);

  const handleSolve = () => {
    if (!canSolve) return;
    onSolve({
      questionText: tab === 'text' ? text.trim() : '',
      imageBase64: tab === 'image' ? imageData?.base64 : null,
      imageMime: tab === 'image' ? imageData?.mime : null,
      language,
      atsMode,
    });
  };

  return (
    <Card className="glass-strong scanline relative overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="font-[family-name:var(--font-space-grotesk)] text-2xl tracking-tight">
              Drop a question. <span className="gradient-text">Get a solution.</span>
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Paste a problem or upload a screenshot — Claude Sonnet 4.5 will solve, explain, and test it.</p>
          </div>
          <div className="flex items-center gap-3">
            <ATSToggle value={atsMode} onChange={setAtsMode} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="bg-white/[0.03] border border-white/10">
            <TabsTrigger value="text" className="data-[state=active]:bg-cyan-400/10 data-[state=active]:text-cyan-300">
              <FileText className="w-4 h-4 mr-1.5" /> Paste Text
            </TabsTrigger>
            <TabsTrigger value="image" className="data-[state=active]:bg-fuchsia-400/10 data-[state=active]:text-fuchsia-300">
              <ImageIcon className="w-4 h-4 mr-1.5" /> Upload Image
            </TabsTrigger>
          </TabsList>

          <TabsContent value="text" className="mt-4">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'Paste your coding question here...\n\ne.g. Given an array of integers, return the indices of the two numbers that add up to a target.'}
              className="min-h-[200px] bg-white/[0.02] border-white/10 font-[family-name:var(--font-mono)] text-[13px] leading-relaxed focus-visible:ring-cyan-400/50"
            />
          </TabsContent>

          <TabsContent value="image" className="mt-4">
            {!imageData ? (
              <div
                {...getRootProps()}
                className={`relative rounded-xl border-2 border-dashed transition-all p-10 text-center cursor-pointer ${
                  isDragActive
                    ? 'border-cyan-400/70 bg-cyan-400/5 neon-border-cyan'
                    : 'border-white/15 hover:border-fuchsia-400/40 hover:bg-fuchsia-400/[0.03]'
                }`}
              >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-fuchsia-500/20 border border-white/10 flex items-center justify-center">
                    <Upload className="w-6 h-6 text-cyan-300" />
                  </div>
                  <div className="space-y-1">
                    <div className="font-[family-name:var(--font-space-grotesk)] font-medium">
                      {isDragActive ? 'Release to upload' : 'Drag & drop a question screenshot'}
                    </div>
                    <div className="text-xs text-muted-foreground">PNG, JPEG, WEBP — or click to browse</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative rounded-xl overflow-hidden border border-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageData.preview} alt="preview" className="w-full max-h-[360px] object-contain bg-black/40" />
                <div className="absolute top-2 right-2 flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setImageData(null)} className="h-8 bg-black/50 hover:bg-black/70 backdrop-blur">
                    <X className="w-3.5 h-3.5 mr-1" /> Replace
                  </Button>
                </div>
                <div className="absolute bottom-0 inset-x-0 p-2 text-[11px] text-cyan-300 bg-gradient-to-t from-black/80 to-transparent">
                  ✓ Vision-ready · {imageData.name}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Bottom controls */}
        <div className="flex items-end justify-between flex-wrap gap-3 pt-2">
          <div className="flex items-center gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Language</span>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="w-[180px] bg-white/[0.03] border-white/10 h-10">
                  <Code2 className="w-4 h-4 mr-1 text-cyan-400" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <motion.div whileTap={{ scale: 0.97 }}>
            <Button
              disabled={!canSolve}
              onClick={handleSolve}
              size="lg"
              className="neon-button h-12 px-7 font-[family-name:var(--font-space-grotesk)] font-semibold tracking-wide text-base"
            >
              {busy ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Solving...</>
              ) : (
                <><Wand2 className="w-5 h-5 mr-2" /> Solve with AI <ChevronRight className="w-4 h-4 ml-1.5" /></>
              )}
            </Button>
          </motion.div>
        </div>
      </CardContent>
    </Card>
  );
}

function ATSToggle({ value, onChange }) {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Style</span>
          <span className={`text-xs font-medium ${value ? 'text-cyan-300' : 'text-fuchsia-300'}`}>
            {value ? 'ATS-Friendly' : 'Interview-Style'}
          </span>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Switch
                checked={value}
                onCheckedChange={onChange}
                className="data-[state=checked]:bg-cyan-500 data-[state=unchecked]:bg-fuchsia-600"
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[240px]">
            <div className="text-xs">
              <strong>ATS-Friendly:</strong> clean, well-commented, professional<br />
              <strong>Interview-Style:</strong> optimized, concise, clever
            </div>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

// =====================================================================================
// Output (Code | Explanation | Test Cases)
// =====================================================================================
function CodeOutput({ result, onLearnMode }) {
  const [tab, setTab] = useState('code');
  const langKey = LANG_TO_PRISM[result.language] || 'python';

  const copy = () => {
    navigator.clipboard.writeText(result.code || '');
    toast.success('Code copied to clipboard');
  };
  const download = () => {
    const ext = LANG_EXT[result.language] || 'txt';
    const blob = new Blob([result.code || ''], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${(result.title || 'solution').replace(/[^a-z0-9]+/gi, '_').toLowerCase()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Download started');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <Card className="glass-strong overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-400">Solved</span>
              </div>
              <CardTitle className="font-[family-name:var(--font-space-grotesk)] text-xl tracking-tight">
                {result.title}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge variant="outline" className="border-cyan-400/30 text-cyan-300 bg-cyan-400/5">{result.language}</Badge>
                {result.atsMode ? (
                  <Badge variant="outline" className="border-fuchsia-400/30 text-fuchsia-300 bg-fuchsia-400/5">ATS-Friendly</Badge>
                ) : (
                  <Badge variant="outline" className="border-orange-400/30 text-orange-300 bg-orange-400/5">Interview-Style</Badge>
                )}
                <Badge variant="outline" className="border-white/15 text-muted-foreground">
                  Time {result.complexity?.time || '—'}
                </Badge>
                <Badge variant="outline" className="border-white/15 text-muted-foreground">
                  Space {result.complexity?.space || '—'}
                </Badge>
                {result.pattern && (
                  <Badge variant="outline" className="border-indigo-400/30 text-indigo-300 bg-indigo-400/5 capitalize">
                    {result.pattern}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={copy} className="border-white/10 hover:border-cyan-400/40 hover:text-cyan-300">
                <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy
              </Button>
              <Button variant="outline" size="sm" onClick={download} className="border-white/10 hover:border-cyan-400/40 hover:text-cyan-300">
                <Download className="w-3.5 h-3.5 mr-1.5" /> Download
              </Button>
              <Button onClick={onLearnMode} className="neon-button h-9">
                <BookOpen className="w-4 h-4 mr-1.5" /> Learn Mode
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="bg-white/[0.03] border border-white/10">
              <TabsTrigger value="code" className="data-[state=active]:bg-cyan-400/10 data-[state=active]:text-cyan-300">
                <Code2 className="w-4 h-4 mr-1.5" /> Code
              </TabsTrigger>
              <TabsTrigger value="explain" className="data-[state=active]:bg-fuchsia-400/10 data-[state=active]:text-fuchsia-300">
                <BookOpen className="w-4 h-4 mr-1.5" /> Explanation
              </TabsTrigger>
              <TabsTrigger value="tests" className="data-[state=active]:bg-emerald-400/10 data-[state=active]:text-emerald-300">
                <FlaskConical className="w-4 h-4 mr-1.5" /> Test Cases
              </TabsTrigger>
            </TabsList>

            <TabsContent value="code" className="mt-4">
              <div className="rounded-xl overflow-hidden border border-white/10 relative">
                <div className="absolute top-2 right-3 z-10 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">{result.language}</div>
                <SyntaxHighlighter
                  language={langKey}
                  style={atomDark}
                  customStyle={{ margin: 0, padding: '20px', background: '#0a0a14', fontSize: '13px', lineHeight: '1.6' }}
                  wrapLongLines
                  showLineNumbers
                >
                  {result.code || ''}
                </SyntaxHighlighter>
              </div>
            </TabsContent>

            <TabsContent value="explain" className="mt-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 leading-relaxed text-[14px] whitespace-pre-wrap">
                {result.explanation}
              </div>
            </TabsContent>

            <TabsContent value="tests" className="mt-4">
              <div className="space-y-3">
                {(result.testCases || []).map((tc, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-md bg-gradient-to-br from-cyan-500/20 to-fuchsia-500/20 flex items-center justify-center text-[11px] font-mono">
                        {i + 1}
                      </div>
                      <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Test Case</span>
                    </div>
                    <div className="grid md:grid-cols-2 gap-3 text-[13px]">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-400 mb-1">Input</div>
                        <pre className="rounded-md p-3 bg-black/30 border border-white/5 overflow-x-auto whitespace-pre-wrap">{tc.input}</pre>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.18em] text-fuchsia-400 mb-1">Expected Output</div>
                        <pre className="rounded-md p-3 bg-black/30 border border-white/5 overflow-x-auto whitespace-pre-wrap">{tc.output}</pre>
                      </div>
                    </div>
                  </motion.div>
                ))}
                {(!result.testCases || result.testCases.length === 0) && (
                  <div className="text-sm text-muted-foreground text-center py-8">No test cases provided.</div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// =====================================================================================
// Learn Mode (Phase 1: pattern-aware visual scaffold + step-by-step explanation)
// =====================================================================================
function LearnMode({ result, onClose }) {
  const pattern = (result.pattern || '').toLowerCase();
  const steps = useMemo(() => {
    // Naive split of explanation into pseudo-steps for animated reveal
    const text = (result.explanation || '').split(/\n+/).filter((l) => l.trim().length > 0);
    return text.length > 0 ? text : ['Reading the problem.', 'Designing the approach.', 'Implementing.', 'Verifying with test cases.'];
  }, [result]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="space-y-4"
    >
      <Card className="glass-strong scanline overflow-hidden">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-fuchsia-400 mb-1">Learn Mode</div>
              <CardTitle className="font-[family-name:var(--font-space-grotesk)] text-2xl">
                Walkthrough — <span className="gradient-text">{result.title}</span>
              </CardTitle>
            </div>
            <Button variant="ghost" onClick={onClose}><X className="w-4 h-4 mr-1" /> Close</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid lg:grid-cols-2 gap-5">
            {/* Visualization canvas */}
            <div className="rounded-xl border border-white/10 bg-black/40 p-5 min-h-[320px] relative overflow-hidden">
              <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-300 mb-3 flex items-center gap-2">
                <Zap className="w-3 h-3" /> Pattern: <span className="text-fuchsia-300 capitalize">{pattern || 'general'}</span>
              </div>
              <PatternViz pattern={pattern} />
            </div>

            {/* Animated step-by-step explanation */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">Step-by-step</div>
              <div className="space-y-3">
                {steps.map((s, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.25, duration: 0.5 }}
                    className="flex gap-3"
                  >
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500/30 to-fuchsia-500/30 border border-cyan-400/30 flex items-center justify-center text-[11px] font-mono">
                      {i + 1}
                    </div>
                    <div className="text-[13px] leading-relaxed pt-0.5">{s}</div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Lightweight pattern visualizers (Framer Motion + SVG)
function PatternViz({ pattern }) {
  const arr = [3, 1, 4, 1, 5, 9, 2, 6, 5];
  if (pattern.includes('two-pointer') || pattern.includes('array') || pattern.includes('sliding') || pattern.includes('binary-search')) {
    return <ArrayViz arr={arr} mode={pattern} />;
  }
  if (pattern.includes('tree') || pattern.includes('bfs') || pattern.includes('dfs') || pattern.includes('graph')) {
    return <TreeViz />;
  }
  if (pattern.includes('recursion') || pattern.includes('dp')) {
    return <StackViz />;
  }
  return <ArrayViz arr={arr} mode="array" />;
}

function ArrayViz({ arr, mode }) {
  const [i, setI] = useState(0);
  const [j, setJ] = useState(arr.length - 1);
  useEffect(() => {
    const t = setInterval(() => {
      setI((x) => (x + 1) % arr.length);
      setJ((y) => (y - 1 + arr.length) % arr.length);
    }, 800);
    return () => clearInterval(t);
  }, [arr.length]);

  return (
    <div className="flex flex-col items-center justify-center gap-6 h-full">
      <div className="flex gap-2">
        {arr.map((v, idx) => {
          const isI = idx === i;
          const isJ = idx === j && mode.includes('two-pointer');
          return (
            <motion.div
              key={idx}
              animate={{
                y: isI || isJ ? -6 : 0,
                scale: isI || isJ ? 1.08 : 1,
                boxShadow: isI ? '0 0 20px #00f5ff' : isJ ? '0 0 20px #c026d3' : '0 0 0 transparent',
              }}
              transition={{ type: 'spring', stiffness: 300, damping: 18 }}
              className={`w-10 h-12 rounded-lg flex items-center justify-center font-mono text-sm border ${
                isI ? 'border-cyan-400 bg-cyan-400/10 text-cyan-200'
                : isJ ? 'border-fuchsia-400 bg-fuchsia-400/10 text-fuchsia-200'
                : 'border-white/10 bg-white/[0.03] text-foreground'
              }`}
            >
              {v}
            </motion.div>
          );
        })}
      </div>
      <div className="flex items-center gap-6 text-[11px] uppercase tracking-[0.2em]">
        <span className="text-cyan-300 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-cyan-400" /> i = {i}</span>
        {mode.includes('two-pointer') && <span className="text-fuchsia-300 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-fuchsia-400" /> j = {j}</span>}
      </div>
    </div>
  );
}

function TreeViz() {
  const nodes = [
    { id: 1, x: 200, y: 40 },
    { id: 2, x: 110, y: 110 },
    { id: 3, x: 290, y: 110 },
    { id: 4, x: 60, y: 180 },
    { id: 5, x: 160, y: 180 },
    { id: 6, x: 240, y: 180 },
    { id: 7, x: 340, y: 180 },
  ];
  const edges = [[1,2],[1,3],[2,4],[2,5],[3,6],[3,7]];
  const [active, setActive] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setActive((x) => (x + 1) % nodes.length), 700);
    return () => clearInterval(t);
  }, []);
  return (
    <svg viewBox="0 0 400 240" className="w-full h-full">
      {edges.map(([a, b], idx) => {
        const A = nodes.find((n) => n.id === a); const B = nodes.find((n) => n.id === b);
        return <line key={idx} x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />;
      })}
      {nodes.map((n, idx) => (
        <motion.g key={n.id}
          animate={{ scale: idx === active ? 1.18 : 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          style={{ originX: `${n.x}px`, originY: `${n.y}px` }}>
          <circle cx={n.x} cy={n.y} r={18}
            fill={idx === active ? 'rgba(0,245,255,0.18)' : 'rgba(255,255,255,0.04)'}
            stroke={idx === active ? '#00f5ff' : 'rgba(255,255,255,0.18)'} strokeWidth="1.5"
            style={{ filter: idx === active ? 'drop-shadow(0 0 8px #00f5ff)' : 'none' }} />
          <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize="11" fill={idx === active ? '#a5f3ff' : '#cbd5e1'} fontFamily="monospace">{n.id}</text>
        </motion.g>
      ))}
    </svg>
  );
}

function StackViz() {
  const [depth, setDepth] = useState(0);
  useEffect(() => {
    let dir = 1; let d = 0;
    const t = setInterval(() => {
      d += dir;
      if (d >= 5) dir = -1;
      if (d <= 0) dir = 1;
      setDepth(d);
    }, 600);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex flex-col-reverse items-center gap-1.5 justify-center h-full">
      {Array.from({ length: 5 }).map((_, i) => (
        <motion.div
          key={i}
          animate={{ opacity: i < depth ? 1 : 0.15, x: i < depth ? 0 : -8 }}
          transition={{ duration: 0.3 }}
          className={`w-48 h-9 rounded-md border flex items-center justify-center font-mono text-[12px] ${
            i < depth ? 'border-cyan-400/50 bg-cyan-400/5 text-cyan-200' : 'border-white/10 bg-white/[0.02] text-muted-foreground'
          }`}
        >
          frame #{i + 1}
        </motion.div>
      ))}
    </div>
  );
}

// =====================================================================================
// Hero Empty State
// =====================================================================================
function HeroEmpty({ onPickExample }) {
  const examples = [
    'Find the longest substring without repeating characters.',
    'Two Sum: return indices of the two numbers that add to target.',
    'Implement BFS on a graph and return the shortest path length.',
    'Detect a cycle in a linked list using Floyd\'s algorithm.',
  ];
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="text-center py-2">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/5 px-3 py-1 text-[11px] tracking-wider uppercase text-cyan-300">
          <Sparkles className="w-3 h-3" /> Powered by Claude Sonnet 4.5 · Vision-Enabled
        </motion.div>
        <h1 className="mt-5 font-[family-name:var(--font-space-grotesk)] text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
          Solve any coding question, <span className="gradient-text neon-text">instantly.</span>
        </h1>
        <p className="mt-4 text-muted-foreground max-w-2xl mx-auto text-[15px]">
          Drop a screenshot or paste the problem. Pick your language. Choose ATS-friendly or interview-style. Get production-ready code, complexity analysis, and a step-by-step visual learn mode.
        </p>
      </div>
    </motion.div>
  );
}

// =====================================================================================
// Main Page
// =====================================================================================
export default function Page() {
  const { history, activeId, addItem, updateItem, newQuestion, toggleSidebar } = useStore();
  const [busy, setBusy] = useState(false);
  const [learnMode, setLearnMode] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => { setHasMounted(true); }, []);

  const active = useMemo(() => history.find((h) => h.id === activeId) || null, [history, activeId]);

  // ⌘K → new question
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        newQuestion();
        setLearnMode(false);
        toast.message('Ready for a new question', { description: 'Cmd/Ctrl + K' });
      }
      if (e.key === '\\' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [newQuestion, toggleSidebar]);

  const fireConfetti = () => {
    confetti({
      particleCount: 90,
      spread: 70,
      origin: { y: 0.3 },
      colors: ['#00f5ff', '#c026d3', '#a855f7', '#22d3ee'],
    });
  };

  const handleSolve = async (payload) => {
    setBusy(true);
    setLearnMode(false);
    const sessionId = `cv-${uuidv4()}`;
    try {
      const res = await fetch('/api/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, sessionId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast.error(data.error || 'Failed to solve');
        return;
      }
      const id = uuidv4();
      const item = {
        id,
        sessionId,
        title: data.title || 'Untitled',
        language: data.language || payload.language,
        atsMode: !!data.atsMode,
        createdAt: Date.now(),
        input: { questionText: payload.questionText, hasImage: !!payload.imageBase64 },
        result: {
          title: data.title,
          language: data.language || payload.language,
          atsMode: !!data.atsMode,
          code: data.code,
          explanation: data.explanation,
          complexity: data.complexity || {},
          testCases: data.testCases || [],
          pattern: data.pattern,
        },
      };
      addItem(item);
      fireConfetti();
      toast.success('Solved!', { description: data.title });
    } catch (e) {
      toast.error(e.message || 'Network error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex relative">
      <OrbsBackground />
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col">
        <Navbar />
        <div className="flex-1 px-6 lg:px-10 py-8 max-w-6xl w-full mx-auto space-y-8">
          {hasMounted && !active && !busy && <HeroEmpty />}

          {!active && !learnMode && (
            <QuestionInput onSolve={handleSolve} busy={busy} />
          )}

          <AnimatePresence mode="wait">
            {busy && (
              <motion.div key="loader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Card className="glass-strong"><CardContent className="p-0"><ScanLoader /></CardContent></Card>
              </motion.div>
            )}
          </AnimatePresence>

          {active && !learnMode && (
            <CodeOutput result={active.result} onLearnMode={() => setLearnMode(true)} />
          )}

          {active && learnMode && (
            <LearnMode result={active.result} onClose={() => setLearnMode(false)} />
          )}

          <div className="text-center text-[11px] text-muted-foreground/60 pt-6">
            <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10">⌘K</kbd> new question · <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10">⌘\</kbd> toggle sidebar
          </div>
        </div>
      </main>
    </div>
  );
}
