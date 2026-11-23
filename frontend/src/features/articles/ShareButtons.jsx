import React, { useState } from 'react';
import { Link2, Check, Share2 } from 'lucide-react';

// Brand marks drawn inline (lucide has no Facebook/WhatsApp icons).
const FbIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
    <path d="M13.5 22v-8h2.7l.4-3.2h-3.1V8.8c0-.9.3-1.5 1.6-1.5h1.7V4.4c-.3 0-1.3-.1-2.5-.1-2.5 0-4.1 1.5-4.1 4.2v2.3H7.4V14h2.8v8h3.3z" />
  </svg>
);
const WaIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z" />
  </svg>
);
const XIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
    <path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.3L5.3 21H2.2l7.2-8.3L2 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z" />
  </svg>
);
const LiIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
    <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.5h4V21H3V9.5zM9.5 9.5h3.8v1.6h.1c.5-1 1.8-2 3.8-2 4 0 4.8 2.6 4.8 6V21h-4v-5.2c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7V21h-4V9.5z" />
  </svg>
);

const open = (url) => window.open(url, '_blank', 'noopener,noreferrer,width=640,height=560');

/**
 * Share buttons for an article. `shareUrl` should be the backend /share/... page:
 * it carries the Open Graph tags Facebook and WhatsApp read for the preview card
 * (title, summary, map image) and forwards people to the article itself.
 */
export default function ShareButtons({ shareUrl, title, compact = false, dark = false }) {
  const [copied, setCopied] = useState(false);
  const u = encodeURIComponent(shareUrl);
  const t = encodeURIComponent(title || 'GIS analysis on MapNiti');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked: the link is still visible in the address bar */ }
  };
  const nativeShare = () => navigator.share?.({ title, url: shareUrl }).catch(() => {});

  const base = `inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition ${compact ? 'h-9 w-9' : 'px-3.5 py-2 text-[13px]'}`;
  const neutral = dark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-slate-100 text-slate-700 hover:bg-slate-200';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={() => open(`https://www.facebook.com/sharer/sharer.php?u=${u}`)} title="Share on Facebook"
        className={`${base} bg-[#1877F2] text-white hover:bg-[#166fe0]`}>
        <FbIcon />{!compact && 'Facebook'}
      </button>
      <button onClick={() => open(`https://wa.me/?text=${t}%20${u}`)} title="Share on WhatsApp"
        className={`${base} bg-[#25D366] text-white hover:bg-[#1fbe5b]`}>
        <WaIcon />{!compact && 'WhatsApp'}
      </button>
      <button onClick={() => open(`https://www.linkedin.com/sharing/share-offsite/?url=${u}`)} title="Share on LinkedIn"
        className={`${base} bg-[#0A66C2] text-white hover:bg-[#0959aa]`}>
        <LiIcon />{!compact && 'LinkedIn'}
      </button>
      <button onClick={() => open(`https://twitter.com/intent/tweet?url=${u}&text=${t}`)} title="Share on X"
        className={`${base} ${neutral}`}>
        <XIcon />{!compact && 'X'}
      </button>
      <button onClick={copy} title="Copy link" className={`${base} ${neutral}`}>
        {copied ? <Check size={15} /> : <Link2 size={15} />}{!compact && (copied ? 'Copied' : 'Copy link')}
      </button>
      {typeof navigator !== 'undefined' && navigator.share && (
        <button onClick={nativeShare} title="More options" className={`${base} ${neutral}`}>
          <Share2 size={15} />{!compact && 'More'}
        </button>
      )}
    </div>
  );
}
