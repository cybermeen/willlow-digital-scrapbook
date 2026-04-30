import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import './Scrapbook.css';

const BACKEND_URL = 'http://localhost:5000';
const API = '/api/scrapbook';

// ── FIX 1: Reference canvas dimensions (must match DayLog.js constants) ───
// The DayLog canvas is 680×540 px (max-width + min-height from CSS).
// All saved positions are stored as normalised ratios (norm_x, norm_y, norm_w, norm_h)
// relative to these reference dimensions. The Scrapbook page is smaller, so we
// multiply the ratios by the Scrapbook page size to place items correctly.
const CANVAS_REF_WIDTH  = 680;
const CANVAS_REF_HEIGHT = 540;

// ── FIX 2: Scrapbook page content area dimensions ─────────────────────────
// The usable area inside each .sb-log-page (excluding padding).
// Adjust if you change the CSS padding of .sb-log-page.
const SB_PAGE_CONTENT_WIDTH  = 400; // ≈ half of 980px spread minus padding/spine
const SB_PAGE_CONTENT_HEIGHT = 520; // matches sb-log-page min-height minus padding

// ── FIX 3: Position/size resolver ─────────────────────────────────────────
// Converts saved item geometry to Scrapbook page coordinates.
// If norm_x/norm_y exist (new format), use them to scale proportionally.
// Otherwise fall back to raw pixel positions, scaled by the ratio of page sizes
// (handles entries saved before normalisation was added).
function resolveGeometry(item, side, pageW = SB_PAGE_CONTENT_WIDTH, pageH = SB_PAGE_CONTENT_HEIGHT) {
  // New format: normalised ratios stored alongside raw pixels
  if (item.norm_x !== undefined && item.norm_y !== undefined) {
    return {
      x:      Math.round(item.norm_x * pageW),
      y:      Math.round(item.norm_y * pageH),
      width:  Math.round((item.norm_w  || 0.2) * pageW),
      height: Math.round((item.norm_h  || 0.2) * pageH),
    };
  }

  // Legacy format: raw pixel positions saved against the DayLog canvas.
  // Scale them down proportionally to fit the scrapbook page.
  const scaleX = pageW / CANVAS_REF_WIDTH;
  const scaleY = pageH / CANVAS_REF_HEIGHT;
  const rawX   = item.pos_x   || (side === 'left' ? 20 : 30);
  const rawY   = item.pos_y   || 60;
  const rawW   = item.width   || 200;
  const rawH   = item.height  || 160;

  return {
    x:      Math.round(rawX * scaleX),
    y:      Math.round(rawY * scaleY),
    width:  Math.round(rawW * scaleX),
    height: Math.round(rawH * scaleY),
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

// ── FIX 4: Individual page refs for single-page export ────────────────────
// We keep a map of { pageIndex -> { left: ref, right: ref } } so the Share
// button can capture only the chosen page, not the whole spread.

// ── Scrapbook Page ─────────────────────────────────────────────────────────

function ScrapbookPage({ leftLog, rightLog, leftRef, rightRef }) {
  return (
    <div className="sb-spread">
      {/* Left page — FIX: attach forwarded ref for single-page capture */}
      <div className="sb-page sb-page--left" ref={leftRef}>
        {leftLog ? (
          <LogPage key={`left-${leftLog.log_date}`} log={leftLog} side="left" />
        ) : (
          <div className="sb-page-empty" />
        )}
      </div>

      {/* Spine */}
      <div className="sb-spine" />

      {/* Right page — FIX: attach forwarded ref for single-page capture */}
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
      <div className={`sb-date ${side === 'left' ? 'sb-date--left' : 'sb-date--right'}`}>
        <span className="sb-date-weekday">{display.weekday}</span>
        <span className="sb-date-full">{display.full}</span>
      </div>

      {loading && <div className="sb-log-loading">…</div>}

      {!loading && detail && (
        <>
          {/* ── FIX 5: Photos — proportionally scaled from DayLog canvas ── */}
          {detail.photos?.map((photo, i) => {
            const geo = resolveGeometry(photo, side);
            return (
              <div key={photo.id} className="sb-stamp-wrap" style={{
                // FIX: use resolved geometry instead of raw pos_x/pos_y
                top:       `${geo.y}px`,
                left:      `${geo.x}px`,
                transform: `rotate(${photo.rotation || 0}deg)`,
              }}>
                <WashiTapeDecor index={i} />
                <div className="sb-stamp" style={{ width: `${geo.width}px`, height: `${geo.height}px` }}>
                  <img
                    src={`/${photo.file_path}`}
                    alt={photo.original_name || 'memory'}
                    // FIX: override the fixed 200×190px CSS with resolved dimensions
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
              </div>
            );
          })}

          {/* ── FIX 6: Videos — proportionally scaled ── */}
          {detail.videos?.map(video => {
            const geo = resolveGeometry(video, side);
            return (
              <div key={video.id} className="sb-media-item sb-video-item" style={{
                top:       `${geo.y}px`,
                left:      `${geo.x}px`,
                width:     `${geo.width}px`,
                height:    `${geo.height}px`,
                zIndex:    video.z_index || 0,
                transform: `rotate(${video.rotation || 0}deg)`,
              }}>
                <video src={`/${video.file_path}`} controls muted playsInline
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            );
          })}

          {/* ── FIX 7: Audio — proportionally scaled ── */}
          {detail.audio?.map(audio => {
            const geo = resolveGeometry(audio, side);
            return (
              <div key={audio.id} className="sb-media-item sb-audio-item" style={{
                top:       `${geo.y}px`,
                left:      `${geo.x}px`,
                width:     `${geo.width}px`,
                height:    `${Math.max(geo.height, 70)}px`, // min height for audio controls
                zIndex:    audio.z_index || 0,
                transform: `rotate(${audio.rotation || 0}deg)`,
              }}>
                <div className="sb-audio-card">
                  <span className="sb-audio-label">🎵 {audio.original_name || 'Audio'}</span>
                  <audio src={`/${audio.file_path}`} controls style={{ width: '100%' }} />
                </div>
              </div>
            );
          })}

          {/* ── FIX 8: Answers — proportionally scaled ── */}
          {detail.answers?.map(answer => {
            const geo = resolveGeometry(answer, side);
            return (
              <div key={answer.id} className="sb-answer-wrap" style={{
                top:       `${geo.y}px`,
                left:      `${geo.x}px`,
                width:     `${geo.width}px`,
                minHeight: `${geo.height}px`,
                transform: `rotate(${answer.rotation || 0}deg)`,
              }}>
                <div className="sb-answer-prompt">{answer.prompt_text}:</div>
                <div className="sb-answer-washi">
                  <span className="sb-answer-text">{answer.answer_text}</span>
                </div>
              </div>
            );
          })}

          {/* ── FIX 9: Stickers (art assets) — proportionally scaled ── */}
          {detail.stickers?.map(sticker => {
            const geo = resolveGeometry(sticker, side);
            return (
              <div key={sticker.id} className="sb-sticker" style={{
                top:       `${geo.y}px`,
                left:      `${geo.x}px`,
                width:     `${geo.width}px`,
                height:    `${geo.height}px`,
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

          {/* ── FIX 10: Emoji notes (streak stickers) — proportionally scaled ── */}
          {detail.notes?.filter(n => n.content?.startsWith('EMOJI:')).map(note => {
            const geo   = resolveGeometry(note, side);
            const emoji = note.content.replace('EMOJI:', '');
            // Scale font size proportionally as well
            const baseFontSize  = note.font_size || 48;
            const scaledFont    = Math.round(baseFontSize * (SB_PAGE_CONTENT_WIDTH / CANVAS_REF_WIDTH));
            return (
              <div key={note.id} style={{
                position:  'absolute',
                top:       `${geo.y}px`,
                left:      `${geo.x}px`,
                width:     `${geo.width}px`,
                height:    `${geo.height}px`,
                fontSize:  `${scaledFont}px`,
                display:   'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1,
                userSelect: 'none',
                transform: `rotate(${note.rotation || 0}deg)`,
              }}>
                {emoji}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

// ── Decorative washi tape ──────────────────────────────────────────────────

function WashiTapeDecor({ index }) {
  const colors = [
    { bg: '#aad4e8', dots: true },
    { bg: '#e8d4aa', dots: false },
    { bg: '#c8d4aa', dots: false },
  ];
  const c = colors[index % colors.length];
  return (
    <div
      className={`sb-washi-tape ${c.dots ? 'sb-washi-tape--dots' : ''}`}
      style={{ background: c.bg, transform: `rotate(${-5 + (index * 7) % 20}deg)` }}
    />
  );
}

// ── FIX 11: Single-page share modal ───────────────────────────────────────
// Replaces the previous "capture entire spread" logic.
// Users choose which page (left / right) they want to export.

function ShareModal({ leftRef, rightRef, leftLog, rightLog, onClose }) {
  const [exporting, setExporting] = useState(false);

  const captureRef = async (ref, filename) => {
    if (!ref?.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(ref.current, {
        backgroundColor: '#faf5ee', // matches .sb-page paper colour
        scale: 2,
        useCORS: true,
        imageTimeout: 30000,
        allowTaint: false,
        scrollX: -window.scrollX,
        scrollY: -window.scrollY,
      });
      canvas.toBlob(blob => {
        if (!blob) { alert('Unable to create image. Please try again.'); return; }
        const url  = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href     = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        onClose();
      }, 'image/png');
    } catch (err) {
      console.error('Export error:', err);
      alert('Unable to export. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const leftDate  = leftLog  ? formatLogDate(leftLog.log_date).full  : null;
  const rightDate = rightLog ? formatLogDate(rightLog.log_date).full : null;

  return (
    <div className="sb-share-modal-overlay" onClick={onClose}>
      <div className="sb-share-modal" onClick={e => e.stopPropagation()}>
        <h3 className="sb-share-modal-title">Share a page</h3>
        <p className="sb-share-modal-sub">Choose which page to download as a PNG.</p>

        <div className="sb-share-modal-options">
          {/* Left page option */}
          {leftLog ? (
            <button
              className="sb-share-page-btn"
              disabled={exporting}
              onClick={() => captureRef(leftRef, `scrapbook-${leftLog.log_date}.png`)}
            >
              <span className="sb-share-page-icon">📖</span>
              <span className="sb-share-page-label">{leftDate}</span>
            </button>
          ) : (
            <div className="sb-share-page-btn sb-share-page-btn--empty">Empty page</div>
          )}

          {/* Right page option */}
          {rightLog ? (
            <button
              className="sb-share-page-btn"
              disabled={exporting}
              onClick={() => captureRef(rightRef, `scrapbook-${rightLog.log_date}.png`)}
            >
              <span className="sb-share-page-icon">📄</span>
              <span className="sb-share-page-label">{rightDate}</span>
            </button>
          ) : (
            <div className="sb-share-page-btn sb-share-page-btn--empty">Empty page</div>
          )}
        </div>

        {exporting && <p className="sb-share-exporting">Preparing download…</p>}

        <button className="sb-share-modal-cancel" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

// ── Main Scrapbook Component ───────────────────────────────────────────────

export default function Scrapbook() {
  const [logs,       setLogs]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [pageIndex,  setPageIndex]  = useState(0);
  // FIX 12: showShareModal replaces the old inline sharing state
  const [showShareModal, setShowShareModal] = useState(false);

  // FIX 13: Individual page refs for single-page capture
  const leftPageRef  = useRef(null);
  const rightPageRef = useRef(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API}/logs`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load logs');
        setLogs(await res.json());
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const totalPages = Math.ceil(logs.length / 2);
  const leftLog    = logs[pageIndex * 2]     || null;
  const rightLog   = logs[pageIndex * 2 + 1] || null;

  const goPrev = () => setPageIndex(p => Math.max(0, p - 1));
  const goNext = () => setPageIndex(p => Math.min(totalPages - 1, p + 1));

  // ── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="sb-loading">
        <span>📖</span>
        <p>Opening your scrapbook…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sb-error">
        <p>⚠️ {error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="sb-empty">
        <span>📖</span>
        <h2>Your scrapbook is empty</h2>
        <p>Head over to Day Log to create your first entry!</p>
      </div>
    );
  }

  return (
    <div className="sb-layout">
      {/* FIX 14: Share button now opens a modal to choose which page to export */}
      <div className="sb-toolbar">
        <button className="sb-share-btn" onClick={() => setShowShareModal(true)}>
          Share
        </button>
      </div>

      {/* Book spread — refs are passed down to each page div */}
      <div className="sb-book-wrap">
        <ScrapbookPage
          key={pageIndex}
          leftLog={leftLog}
          rightLog={rightLog}
          leftRef={leftPageRef}
          rightRef={rightPageRef}
        />
      </div>

      {/* Pagination */}
      <div className="sb-nav">
        <button className="sb-arrow sb-arrow--left" onClick={goPrev} disabled={pageIndex === 0} aria-label="Previous page">◀</button>
        <span className="sb-page-indicator">{pageIndex + 1} / {totalPages}</span>
        <button className="sb-arrow sb-arrow--right" onClick={goNext} disabled={pageIndex >= totalPages - 1} aria-label="Next page">▶</button>
      </div>

      {/* FIX 15: Single-page share modal */}
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