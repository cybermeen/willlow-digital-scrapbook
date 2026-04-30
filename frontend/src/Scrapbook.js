import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import './Scrapbook.css';

const BACKEND_URL = 'http://localhost:5000';
const API = '/api/scrapbook';

// ── Reference canvas dimensions (must match DayLog.js constants) ──────────
const CANVAS_REF_WIDTH  = 680;
const CANVAS_REF_HEIGHT = 540;

// ── Scrapbook page content area dimensions ────────────────────────────────
const SB_PAGE_CONTENT_WIDTH  = 400;
const SB_PAGE_CONTENT_HEIGHT = 520;

// ── Position/size resolver ────────────────────────────────────────────────
function resolveGeometry(item, side, pageW = SB_PAGE_CONTENT_WIDTH, pageH = SB_PAGE_CONTENT_HEIGHT) {
  if (item.norm_x !== undefined && item.norm_x !== null) {
    return {
      x:      Math.round(item.norm_x * pageW),
      y:      Math.round(item.norm_y * pageH),
      width:  Math.round((item.norm_w  || 0.2) * pageW),
      height: Math.round((item.norm_h  || 0.2) * pageH),
    };
  }
  const scaleX = pageW / CANVAS_REF_WIDTH;
  const scaleY = pageH / CANVAS_REF_HEIGHT;
  return {
    x:      Math.round((item.pos_x  || (side === 'left' ? 20 : 30)) * scaleX),
    y:      Math.round((item.pos_y  || 60) * scaleY),
    width:  Math.round((item.width  || 200) * scaleX),
    height: Math.round((item.height || 160) * scaleY),
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatLogDate(dateStr) {
  if (!dateStr) return { weekday: 'Loading...', full: 'Date pending' };
  const datePart = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const d = new Date(datePart + 'T00:00:00');
  if (isNaN(d.getTime())) return { weekday: 'Unknown', full: 'Invalid Date' };
  const day = d.getDate();
  const s = ['th','st','nd','rd'];
  const v = day % 100;
  const ordinal = day + (s[(v - 20) % 10] || s[v] || s[0]);
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'long' }),
    full: `${ordinal} ${d.toLocaleDateString('en-US', { month: 'long' })} ${d.getFullYear()}`,
  };
}

// ── Lazy-load JSZip only when needed ──────────────────────────────────────
// We import dynamically to avoid bloating the main bundle.
async function loadJSZip() {
  // JSZip is loaded from CDN via a script tag if not already available.
  // If you have it installed via npm, replace with: import JSZip from 'jszip'
  if (window.JSZip) return window.JSZip;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    script.onload = () => resolve(window.JSZip);
    script.onerror = () => reject(new Error('Failed to load JSZip'));
    document.head.appendChild(script);
  });
}

// ── Scrapbook Page ─────────────────────────────────────────────────────────

function ScrapbookPage({ leftLog, rightLog, leftRef, rightRef }) {
  return (
    <div className="sb-spread">
      <div className="sb-page sb-page--left" ref={leftRef}>
        {leftLog ? (
          <LogPage key={`left-${leftLog.log_date}`} log={leftLog} side="right" />
        ) : (
          <div className="sb-page-empty" />
        )}
      </div>
      <div className="sb-spine" />
      <div className="sb-page sb-page--right" ref={rightRef}>
        {rightLog ? (
          <LogPage key={`right-${rightLog.log_date}`} log={rightLog} side="right" />
        ) : (
          <div className="sb-page-empty" />
        )}
      </div>
    </div>
  );
}

// ── Individual log page ────────────────────────────────────────────────────

function LogPage({ log, side }) {
  const [detail,  setDetail]  = useState(null);
  const [loading, setLoading] = useState(true);
  const display = formatLogDate(log.log_date);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`${API}/logs/${log.log_date}`, { credentials: 'include' });
        if (res.ok && !cancelled) {
          const data = await res.json();
          setDetail(data);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [log.log_date]);

  return (
    <div className="sb-log-page">
      {loading && <div className="sb-log-loading">…</div>}

      {!loading && detail && (
        <>
          {/* ── Photos — no auto washi tape ── */}
          {/* FIX: WashiTapeDecor removed. Photos render cleanly without
              automatic tape. Only explicitly placed sticker assets appear
              as tape/decoration elements. */}
          {detail.photos?.map((photo) => {
            const geo = resolveGeometry(photo, side);
            return (
              <div key={photo.id} className="sb-stamp-wrap" style={{
                top:       `${geo.y}px`,
                left:      `${geo.x}px`,
                transform: `rotate(${photo.rotation || 0}deg)`,
              }}>
                <div className="sb-stamp" style={{ width: `${geo.width}px`, height: `${geo.height}px` }}>
                  <img
                    src={`/${photo.file_path}`}
                    alt={photo.original_name || 'memory'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
              </div>
            );
          })}

          {/* ── Videos — FIX: enforce min-height to prevent thin videos ── */}
          {detail.videos?.map(video => {
            const geo = resolveGeometry(video, side);
            // FIX: enforce aspect-ratio aware minimum height (5:4 = 80%)
            const minH = Math.max(geo.height, Math.round(geo.width * 0.8), 100);
            return (
              <div key={video.id} className="sb-media-item sb-video-item" style={{
                top:       `${geo.y}px`,
                left:      `${geo.x}px`,
                width:     `${geo.width}px`,
                height:    `${minH}px`,
                zIndex:    video.z_index || 1,
                transform: `rotate(${video.rotation || 0}deg)`,
              }}>
                <video src={`/${video.file_path}`} controls muted playsInline
                  style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }} />
              </div>
            );
          })}

          {/* ── Audio ── */}
          {detail.audio?.map(audio => {
            const geo = resolveGeometry(audio, side);
            return (
              <div key={audio.id} className="sb-media-item sb-audio-item" style={{
                top:       `${geo.y}px`,
                left:      `${geo.x}px`,
                width:     `${geo.width}px`,
                height:    `${Math.max(geo.height, 70)}px`,
                zIndex:    audio.z_index || 1,
                transform: `rotate(${audio.rotation || 0}deg)`,
              }}>
                <div className="sb-audio-card">
                  <span className="sb-audio-label">🎵 {audio.original_name || 'Audio'}</span>
                  <audio src={`/${audio.file_path}`} controls style={{ width: '100%' }} />
                </div>
              </div>
            );
          })}

          {/* ── Answers — FIX: blue washi matching DayLog canvas ── */}
          {detail.answers?.map(answer => {
            const geo = resolveGeometry(answer, side);
            return (
              <div key={answer.id} className="sb-answer-wrap" style={{
                top:       `${geo.y}px`,
                left:      `${geo.x}px`,
                width:     `${geo.width}px`,
                minHeight: `${geo.height}px`,
                zIndex:    answer.z_index || 1,
                transform: `rotate(${answer.rotation || 0}deg)`,
              }}>
                <div className="sb-answer-prompt">{answer.prompt_text}:</div>
                {/* FIX: sb-answer-washi is now blue to match DayLog's .dl-canvas-washi */}
                <div className="sb-answer-washi">
                  <span className="sb-answer-text">{answer.answer_text}</span>
                </div>
              </div>
            );
          })}

          {/* ── Stickers (art assets from Magic Library) ── */}
          {detail.stickers?.map(sticker => {
            const geo = resolveGeometry(sticker, side);
            return (
              <div key={sticker.id} className="sb-sticker" style={{
                top:       `${geo.y}px`,
                left:      `${geo.x}px`,
                width:     `${geo.width}px`,
                height:    `${geo.height}px`,
                zIndex:    sticker.z_index || 2,
                transform: `rotate(${sticker.rotation || 0}deg)`,
              }}>
                <img
                  src={`${BACKEND_URL}/assets/tape/${sticker.asset_path.split('/').pop()}`}
                  alt={sticker.asset_name}
                  onError={e => { e.target.style.display = 'none'; }}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>
            );
          })}

          {/* ── Emoji notes (streak stickers) ── */}
          {detail.notes?.filter(n => n.content?.startsWith('EMOJI:')).map(note => {
            const geo   = resolveGeometry(note, side);
            const emoji = note.content.replace('EMOJI:', '');
            const scaledFont = Math.round((note.font_size || 48) * (SB_PAGE_CONTENT_WIDTH / CANVAS_REF_WIDTH));
            return (
              <div key={note.id} style={{
                position:   'absolute',
                top:        `${geo.y}px`,
                left:       `${geo.x}px`,
                width:      `${geo.width}px`,
                height:     `${geo.height}px`,
                fontSize:   `${scaledFont}px`,
                display:    'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1,
                userSelect: 'none',
                zIndex:     note.z_index || 2,
                transform:  `rotate(${note.rotation || 0}deg)`,
              }}>
                {emoji}
              </div>
            );
          })}
        </>
      )}

      {/* FIX: date rendered AFTER all media so it always paints on top */}
      <div className={`sb-date ${side === 'left' ? 'sb-date--left' : 'sb-date--right'}`}>
        <span className="sb-date-weekday">{display.weekday}</span>
        <span className="sb-date-full">{display.full}</span>
      </div>
    </div>
  );
}

// ── Export / Share Modal ───────────────────────────────────────────────────
// FIX: Three export options:
//   1. PNG  — static screenshot (videos/audio skipped, noted)
//   2. PDF  — print-ready via browser print dialog
//   3. ZIP  — page screenshot + all video + audio files bundled together
//             so nothing is lost. Uses JSZip loaded from CDN.

function ShareModal({ leftRef, rightRef, leftLog, rightLog, onClose }) {
  const [exporting, setExporting]   = useState(false);
  const [exportMsg, setExportMsg]   = useState('');

  // ── Fetch a media file as a Blob for ZIP packaging ──────────────────────
  const fetchBlob = async (url) => {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error(`Failed to fetch ${url}`);
    return res.blob();
  };

  // ── Capture a page to html2canvas ───────────────────────────────────────
  const captureCanvas = async (ref) => {
    if (!ref?.current) return null;
    return html2canvas(ref.current, {
      backgroundColor: '#faf5ee',
      scale: 2,
      useCORS: true,
      imageTimeout: 30000,
      allowTaint: false,
      scrollX: -window.scrollX,
      scrollY: -window.scrollY,
      // Skip video/audio elements — html2canvas can't render them
      ignoreElements: el => el.tagName === 'VIDEO' || el.tagName === 'AUDIO',
    });
  };

  // ── PNG download ─────────────────────────────────────────────────────────
  const exportPng = async (ref, logDate) => {
    if (!ref?.current) return;
    setExporting(true);
    setExportMsg('Capturing page…');
    try {
      const canvas = await captureCanvas(ref);
      if (!canvas) return;
      canvas.toBlob(blob => {
        if (!blob) { alert('Unable to create image.'); return; }
        const url  = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = `scrapbook-${logDate}.png`;
        document.body.appendChild(link); link.click(); link.remove();
        URL.revokeObjectURL(url);
        onClose();
      }, 'image/png');
    } catch (err) {
      console.error('PNG export error:', err);
      alert('Unable to export PNG. Please try again.');
    } finally { setExporting(false); setExportMsg(''); }
  };

  // ── ZIP export — screenshot + all media files ────────────────────────────
  // FIX: This is the "download with videos" solution.
  // We bundle the page screenshot (PNG) alongside all video and audio files
  // from that log entry into a single ZIP archive. The user gets everything.
  const exportZip = async (ref, log) => {
    if (!ref?.current || !log) return;
    setExporting(true);
    setExportMsg('Loading JSZip…');
    try {
      const JSZip = await loadJSZip();
      const zip = new JSZip();
      const logDate = log.log_date;
      const folder = zip.folder(`scrapbook-${logDate}`);

      // 1. Screenshot of the page
      setExportMsg('Capturing page screenshot…');
      const canvas = await captureCanvas(ref);
      if (canvas) {
        const pngBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        if (pngBlob) folder.file('page-screenshot.png', pngBlob);
      }

      // 2. Fetch the actual log detail to get media file paths
      setExportMsg('Fetching media files…');
      const res = await fetch(`${API}/logs/${logDate}`, { credentials: 'include' });
      if (res.ok) {
        const detail = await res.json();

        // 3. Add video files
        if (detail.videos?.length) {
          const videoFolder = folder.folder('videos');
          for (const video of detail.videos) {
            try {
              setExportMsg(`Packaging video: ${video.original_name || video.id}…`);
              const blob = await fetchBlob(`/${video.file_path}`);
              const ext  = video.file_path.split('.').pop() || 'mp4';
              const name = video.original_name || `video-${video.id}.${ext}`;
              videoFolder.file(name, blob);
            } catch (err) { console.warn('Could not fetch video:', video.file_path, err); }
          }
        }

        // 4. Add audio files
        if (detail.audio?.length) {
          const audioFolder = folder.folder('audio');
          for (const track of detail.audio) {
            try {
              setExportMsg(`Packaging audio: ${track.original_name || track.id}…`);
              const blob = await fetchBlob(`/${track.file_path}`);
              const ext  = track.file_path.split('.').pop() || 'mp3';
              const name = track.original_name || `audio-${track.id}.${ext}`;
              audioFolder.file(name, blob);
            } catch (err) { console.warn('Could not fetch audio:', track.file_path, err); }
          }
        }

        // 5. Add photo files
        if (detail.photos?.length) {
          const photoFolder = folder.folder('photos');
          for (const photo of detail.photos) {
            try {
              const blob = await fetchBlob(`/${photo.file_path}`);
              const ext  = photo.file_path.split('.').pop() || 'jpg';
              const name = photo.original_name || `photo-${photo.id}.${ext}`;
              photoFolder.file(name, blob);
            } catch (err) { console.warn('Could not fetch photo:', photo.file_path, err); }
          }
        }
      }

      // 6. Generate and download
      setExportMsg('Compressing ZIP…');
      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 3 } });
      const url  = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url; link.download = `scrapbook-${logDate}.zip`;
      document.body.appendChild(link); link.click(); link.remove();
      URL.revokeObjectURL(url);
      onClose();
    } catch (err) {
      console.error('ZIP export error:', err);
      alert('Unable to create ZIP. Please try again.');
    } finally { setExporting(false); setExportMsg(''); }
  };


  const leftDate  = leftLog  ? formatLogDate(leftLog.log_date).full  : null;
  const rightDate = rightLog ? formatLogDate(rightLog.log_date).full : null;

  return (
    <div className="sb-share-modal-overlay" onClick={onClose}>
      <div className="sb-share-modal" onClick={e => e.stopPropagation()}>
        <h3 className="sb-share-modal-title">Export your page</h3>
        <p className="sb-share-modal-sub">Choose a format. Use ZIP to keep videos &amp; audio playable.</p>

        {/* ── PNG ── */}
        <div className="sb-share-section-label">Screenshot (PNG)</div>
        <div className="sb-share-modal-options">
          {leftLog  ? <button className="sb-share-page-btn" disabled={exporting} onClick={() => exportPng(leftRef, leftLog.log_date)}><span className="sb-share-page-icon">🖼</span><span className="sb-share-page-label">{leftDate}</span></button>
                    : <div className="sb-share-page-btn sb-share-page-btn--empty">Empty</div>}
          {rightLog ? <button className="sb-share-page-btn" disabled={exporting} onClick={() => exportPng(rightRef, rightLog.log_date)}><span className="sb-share-page-icon">🖼</span><span className="sb-share-page-label">{rightDate}</span></button>
                    : <div className="sb-share-page-btn sb-share-page-btn--empty">Empty</div>}
        </div>

        {/* ── ZIP — includes videos + audio ── */}
        <div className="sb-share-section-label">ZIP archive (screenshot + all media)</div>
        <div className="sb-share-modal-options">
          {leftLog  ? <button className="sb-share-page-btn sb-share-page-btn--zip" disabled={exporting} onClick={() => exportZip(leftRef, leftLog)}><span className="sb-share-page-icon">📦</span><span className="sb-share-page-label">{leftDate}</span><span className="sb-share-zip-badge">incl. video</span></button>
                    : <div className="sb-share-page-btn sb-share-page-btn--empty">Empty</div>}
          {rightLog ? <button className="sb-share-page-btn sb-share-page-btn--zip" disabled={exporting} onClick={() => exportZip(rightRef, rightLog)}><span className="sb-share-page-icon">📦</span><span className="sb-share-page-label">{rightDate}</span><span className="sb-share-zip-badge">incl. video</span></button>
                    : <div className="sb-share-page-btn sb-share-page-btn--empty">Empty</div>}
        </div>


        {exporting && <p className="sb-share-exporting">{exportMsg || 'Working…'}</p>}
        <button className="sb-share-modal-cancel" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

// ── Main Scrapbook Component ───────────────────────────────────────────────

export default function Scrapbook() {
  const [logs,           setLogs]           = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [pageIndex,      setPageIndex]      = useState(0);
  const [showShareModal, setShowShareModal] = useState(false);

  const leftPageRef  = useRef(null);
  const rightPageRef = useRef(null);

  useEffect(() => {
    async function load() {
      setLoading(true); setError(null);
      try {
        const res = await fetch(`${API}/logs`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load logs');
        setLogs(await res.json());
      } catch (err) {
        setError(err.message);
      } finally { setLoading(false); }
    }
    load();
  }, []);

  const totalPages = Math.ceil(logs.length / 2);
  const leftLog    = logs[pageIndex * 2]     || null;
  const rightLog   = logs[pageIndex * 2 + 1] || null;

  const goPrev = () => setPageIndex(p => Math.max(0, p - 1));
  const goNext = () => setPageIndex(p => Math.min(totalPages - 1, p + 1));

  if (loading) return <div className="sb-loading"><span>📖</span><p>Opening your scrapbook…</p></div>;
  if (error)   return <div className="sb-error"><p>⚠️ {error}</p><button onClick={() => window.location.reload()}>Retry</button></div>;
  if (logs.length === 0) return (
    <div className="sb-empty">
      <span>📖</span>
      <h2>Your scrapbook is empty</h2>
      <p>Head over to Day Log to create your first entry!</p>
    </div>
  );

  return (
    <div className="sb-layout">
      <div className="sb-toolbar">
        <button className="sb-share-btn" onClick={() => setShowShareModal(true)}>
          Share / Export
        </button>
      </div>

      <div className="sb-book-wrap">
        <ScrapbookPage
          key={pageIndex}
          leftLog={leftLog}
          rightLog={rightLog}
          leftRef={leftPageRef}
          rightRef={rightPageRef}
        />
      </div>

      <div className="sb-nav">
        <button className="sb-arrow sb-arrow--left"  onClick={goPrev} disabled={pageIndex === 0} aria-label="Previous page">◀</button>
        <span className="sb-page-indicator">{pageIndex + 1} / {totalPages}</span>
        <button className="sb-arrow sb-arrow--right" onClick={goNext} disabled={pageIndex >= totalPages - 1} aria-label="Next page">▶</button>
      </div>

      {showShareModal && (
        <ShareModal
          leftRef={leftPageRef}
          rightRef={rightPageRef}
          leftLog={leftLog}
          rightLog={rightLog}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}