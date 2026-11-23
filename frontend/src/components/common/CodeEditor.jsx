import React, { forwardRef, useMemo } from 'react';
import { highlight } from './highlight';

// Editable code with VS Code colours. A transparent <textarea> sits exactly on
// top of a highlighted <pre>: you type in the textarea, you see the colours.
// The outer box scrolls both together, so they never drift apart.
const CodeEditor = forwardRef(function CodeEditor({ value, onChange, onKeyDown, lang, minHeight = 300, maxHeight = 560 }, ref) {
  const html = useMemo(() => `${highlight(value, lang)}\n`, [value, lang]);
  const lineCount = value.split('\n').length;
  const numbers = useMemo(() => Array.from({ length: lineCount }, (_, i) => i + 1).join('\n'), [lineCount]);

  return (
    <div className="overflow-auto bg-[#1e1e1e]" style={{ minHeight, maxHeight }}>
      <div className="flex min-w-max">
        <pre aria-hidden="true"
          className="select-none text-right text-[#858585] font-mono text-[13px] leading-[21px] py-4 pl-3 pr-4 m-0 sticky left-0 bg-[#1e1e1e] z-10">
          {numbers}
        </pre>
        <div className="code-editor code-hl flex-grow">
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            wrap="off"
            aria-label="Code editor"
          />
          <pre aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>
    </div>
  );
});

export default CodeEditor;
