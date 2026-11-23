import React, { useState } from 'react';
import { Copy, Check, Play } from 'lucide-react';
import { highlight } from './highlight';

// Small, dependency-free Markdown renderer for AI replies and lesson text.
// Supports: fenced code (```lang), #/##/### headings, - / * / 1. lists,
// > quotes, | tables |, **bold**, *italic*, `code`, [links](url).

export function inline(text, keyBase) {
  const parts = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*\s][^*]*\*)/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${keyBase}-${i++}`;
    if (tok.startsWith('**')) {
      parts.push(<strong key={k} className="font-bold text-slate-800">{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith('`')) {
      parts.push(<code key={k} className="px-1 py-0.5 rounded bg-slate-100 text-pink-700 text-[0.85em] font-mono">{tok.slice(1, -1)}</code>);
    } else if (tok.startsWith('[')) {
      const [, label, href] = tok.match(/\[([^\]]+)\]\(([^)]+)\)/);
      const safe = /^(https?:\/\/|\/[\w-])/.test(href) ? href : '#';
      parts.push(<a key={k} href={safe} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">{label}</a>);
    } else {
      parts.push(<em key={k}>{tok.slice(1, -1)}</em>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

const RUNNABLE = ['python', 'py', 'javascript', 'js', 'sql', 'html'];

export function CodeBlock({ lang, code, onRun }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const runnable = onRun && RUNNABLE.includes((lang || '').toLowerCase());
  return (
    <div className="my-3 rounded-xl overflow-hidden border border-slate-800 bg-[#0f172a]">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800/80 text-[10px] font-bold uppercase tracking-wider text-slate-300">
        <span>{lang || 'code'}</span>
        <div className="flex gap-1">
          {runnable && (
            <button onClick={() => onRun(lang, code)} className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white">
              <Play size={10} /> Try it
            </button>
          )}
          <button onClick={copy} className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-slate-700">
            {copied ? <Check size={10} /> : <Copy size={10} />} {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <pre className="code-hl p-3 overflow-x-auto text-[12.5px] leading-relaxed font-mono bg-[#1e1e1e]">
        <code dangerouslySetInnerHTML={{ __html: highlight(code, lang) }} />
      </pre>
    </div>
  );
}

const LIST_RE = /^\s*([-*]|\d+\.)\s+/;
const TABLE_RE = /^\s*\|.*\|\s*$/;
const TABLE_SEP_RE = /^\s*\|[\s:|-]+\|\s*$/;

export default function Markdown({ text, onRunCode }) {
  const lines = (text || '').split('\n');
  const out = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];

    const fence = line.match(/^```([\w-]*)/);
    if (fence) {
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++]);
      i++;
      out.push(<CodeBlock key={key++} lang={fence[1]} code={buf.join('\n')} onRun={onRunCode} />);
      continue;
    }

    const h = line.match(/^(#{1,4})\s+(.*)/);
    if (h) {
      const size = ['text-lg', 'text-base', 'text-sm', 'text-sm'][h[1].length - 1];
      out.push(<p key={key++} data-h={h[1].length} className={`${size} font-black text-slate-800 mt-4 mb-1`}>{inline(h[2], key)}</p>);
      i++;
      continue;
    }

    if (TABLE_RE.test(line)) {
      const rows = [];
      while (i < lines.length && TABLE_RE.test(lines[i])) {
        if (!TABLE_SEP_RE.test(lines[i])) rows.push(lines[i].trim().slice(1, -1).split('|').map((c) => c.trim()));
        i++;
      }
      const [head, ...body] = rows;
      const k = key++;
      out.push(
        <div key={k} className="overflow-x-auto my-2">
          <table className="text-xs border border-slate-200 rounded-lg">
            <thead className="bg-slate-50">
              <tr>{(head || []).map((c, j) => <th key={j} className="px-2 py-1 text-left font-bold border-b">{inline(c, `${k}h${j}`)}</th>)}</tr>
            </thead>
            <tbody>
              {body.map((r, ri) => (
                <tr key={ri} className="border-b border-slate-100">
                  {r.map((c, j) => <td key={j} className="px-2 py-1">{inline(c, `${k}-${ri}-${j}`)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    if (LIST_RE.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items = [];
      while (i < lines.length && LIST_RE.test(lines[i])) {
        items.push(lines[i].replace(LIST_RE, ''));
        i++;
      }
      const Tag = ordered ? 'ol' : 'ul';
      const k = key++;
      out.push(
        <Tag key={k} className={`${ordered ? 'list-decimal' : 'list-disc'} pl-5 my-1.5 space-y-0.5`}>
          {items.map((it, j) => <li key={j}>{inline(it, `${k}-${j}`)}</li>)}
        </Tag>
      );
      continue;
    }

    if (line.startsWith('>')) {
      const k = key++;
      out.push(
        <blockquote key={k} className="border-l-4 border-amber-300 bg-amber-50 px-3 py-2 my-2 rounded-r-lg text-slate-700">
          {inline(line.replace(/^>\s?/, ''), k)}
        </blockquote>
      );
      i++;
      continue;
    }

    if (line.trim() === '') {
      i++;
      continue;
    }
    const k = key++;
    out.push(<p key={k} className="my-1.5">{inline(line, k)}</p>);
    i++;
  }
  return <div className="text-[13px] leading-relaxed text-slate-600">{out}</div>;
}
