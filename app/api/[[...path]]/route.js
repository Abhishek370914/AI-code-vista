import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// ---------- Python LLM bridge ----------
function callPythonLLM(payload) {
  return new Promise((resolve, reject) => {
    const py = spawn('/root/.venv/bin/python3', [path.join(process.cwd(), 'lib', 'llm_helper.py')], {
      env: { ...process.env },
    });
    let stdout = '';
    let stderr = '';
    py.stdout.on('data', (d) => { stdout += d.toString(); });
    py.stderr.on('data', (d) => { stderr += d.toString(); });
    py.on('close', (code) => {
      if (code !== 0 && !stdout) {
        return reject(new Error(`python exited ${code}: ${stderr}`));
      }
      try {
        const lastLine = stdout.trim().split('\n').filter(Boolean).pop() || '{}';
        resolve(JSON.parse(lastLine));
      } catch (e) {
        reject(new Error(`bad python output: ${stdout} | err: ${stderr}`));
      }
    });
    py.stdin.write(JSON.stringify(payload));
    py.stdin.end();
  });
}

// ---------- helpers ----------
function extractJSON(text) {
  // strip code fences, find first {...} block
  if (!text) return null;
  let t = text.trim();
  t = t.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  const candidate = t.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    // try to fix common issues - replace control chars in strings
    try {
      return JSON.parse(candidate.replace(/[\u0000-\u001F]+/g, ' '));
    } catch {
      return null;
    }
  }
}

function buildSystemPrompt(language, atsMode) {
  const tone = atsMode
    ? 'Write CLEAN, WELL-COMMENTED, PROFESSIONAL code suitable for ATS (Applicant Tracking System) review and code-review readability. Use descriptive variable names and add inline comments explaining each major step.'
    : 'Write OPTIMIZED, CONCISE, INTERVIEW-STYLE code. Prioritize brevity, clever tricks, minimal lines, and best time/space complexity. Comments should be minimal.';
  return `You are CodeVista AI — a world-class competitive-programming assistant.

The user will give you a coding question (as text or an image of a problem statement). Your job:

1. Read & understand the problem fully.
2. Solve it in ${language}.
3. Style: ${tone}
4. Provide time + space complexity.
5. Provide 3-5 representative test cases (input + expected output).
6. Provide a concise, beginner-friendly explanation of the approach.

Return ONLY a single valid JSON object (no markdown, no prose around it) with this EXACT shape:
{
  "title": "short 3-7 word title of the problem",
  "language": "${language}",
  "atsMode": ${atsMode},
  "code": "<the full source code as a string with \\n newlines>",
  "explanation": "<plain text approach explanation, can use \\n for paragraphs>",
  "complexity": { "time": "O(...)", "space": "O(...)" },
  "testCases": [ { "input": "...", "output": "..." } ],
  "pattern": "<one of: array, two-pointer, sliding-window, binary-search, bfs, dfs, tree, graph, dp, recursion, hashmap, stack, queue, sorting, greedy, math, string, other>"
}

DO NOT include any text outside the JSON object. Escape strings properly. Use real newlines in code as \\n.`;
}

// ---------- routes ----------
async function handleSolve(request) {
  try {
    const body = await request.json();
    const { questionText, imageBase64, imageMime, language = 'Python', atsMode = true, sessionId } = body || {};

    if (!questionText && !imageBase64) {
      return NextResponse.json({ error: 'Provide questionText or imageBase64' }, { status: 400 });
    }

    const systemMsg = buildSystemPrompt(language, atsMode);
    const userText = questionText && questionText.trim()
      ? `Here is the coding question:\n\n${questionText.trim()}\n\nSolve it as instructed and return ONLY the JSON object.`
      : `The image attached contains a coding question. Read it carefully (OCR if needed), then solve it as instructed and return ONLY the JSON object.`;

    const py = await callPythonLLM({
      session_id: sessionId || `codevista-${Date.now()}`,
      system: systemMsg,
      text: userText,
      image_base64: imageBase64 || null,
      image_mime: imageMime || 'image/png',
    });

    if (!py.ok) {
      return NextResponse.json({ error: py.error || 'LLM error' }, { status: 500 });
    }

    const parsed = extractJSON(py.content);
    if (!parsed) {
      return NextResponse.json({ error: 'Could not parse model output', raw: py.content }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      ...parsed,
      raw: undefined,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'unknown error' }, { status: 500 });
  }
}

async function handleFollowup(request) {
  try {
    const body = await request.json();
    const { sessionId, message } = body || {};
    if (!sessionId || !message) return NextResponse.json({ error: 'sessionId+message required' }, { status: 400 });
    const py = await callPythonLLM({
      session_id: sessionId,
      system: 'You are CodeVista AI. Answer follow-up questions concisely and helpfully about the previously solved coding problem. Use markdown when useful.',
      text: message,
      image_base64: null,
    });
    if (!py.ok) return NextResponse.json({ error: py.error }, { status: 500 });
    return NextResponse.json({ ok: true, reply: py.content });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(request, { params }) {
  const p = (await params)?.path || [];
  const route = p.join('/');
  if (route === '' || route === 'health') {
    return NextResponse.json({ ok: true, service: 'CodeVista AI', model: 'claude-sonnet-4-5-20250929' });
  }
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function POST(request, { params }) {
  const p = (await params)?.path || [];
  const route = p.join('/');
  if (route === 'solve') return handleSolve(request);
  if (route === 'followup') return handleFollowup(request);
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
