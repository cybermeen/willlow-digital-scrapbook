import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import './Scrapbook.css';

const API = '/api/scrapbook';

const CANVAS_REF_WIDTH  = 680;
const CANVAS_REF_HEIGHT = 540;
const SB_PAGE_CONTENT_WIDTH  = 400;
const SB_PAGE_CONTENT_HEIGHT = 520;

function resolveGeometry(item, side, pageW = SB_PAGE_CONTENT_WIDTH, pageH = SB_PAGE_CONTENT_HEIGHT) {
  const scaleX = pageW / CANVAS_REF_WIDTH;
  const scaleY = pageH / CANVAS_REF_HEIGHT;

  // Calculate width/height first. If the normalized data is missing, 
  // safely fall back to scaling the absolute dimensions from the database.
  const resolvedWidth = (item.norm_w != null) 
    ? Math.round(item.norm_w * pageW) 
    : Math.round((item.width || 200) * scaleX);

  const resolvedHeight = (item.norm_h != null) 
    ? Math.round(item.norm_h * pageH) 
    : Math.round((item.height || 160) * scaleY);

  // Apply coordinates
  if (item.norm_x != null && item.norm_y != null) {
    return {
      x: Math.round(item.norm_x * pageW),
      y: Math.round(item.norm_y * pageH),
      width: resolvedWidth,
      height: resolvedHeight,
    };
  }

  // Fallback coordinates if normalized data is completely missing
  return {
    x: Math.round((item.pos_x || (side === 'left' ? 20 : 30)) * scaleX),
    y: Math.round((item.pos_y || 60) * scaleY),
    width: resolvedWidth,
    height: resolvedHeight,
  };
}

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

// ── toDataURL: fetches any same-origin URL and converts to a data URL ──────
async function toDataURL(src) {
  try {
    const res = await fetch(src, { credentials: 'include' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror  = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ── CHANGE 1: fetchStickerAsDataURL — fallback now uses a RELATIVE path ───
// Root cause of chequered stickers in export: the previous fallback used
// `${BACKEND_URL}/assets/tape/...` (localhost:5000) which is cross-origin.
// html2canvas with allowTaint:false drops cross-origin images, leaving a
// chequered void. Fix: use a relative path `/assets/tape/...` so the
// request goes through the React dev proxy and is same-origin to the browser.
// In production (React and Express on the same host) this also works correctly.
async function fetchStickerAsDataURL(assetPath) {
  const filename = assetPath.split('/').pop();

  // Try the backend proxy route first (if you've added it to Express)
  const proxyUrl = `/api/scrapbook/asset-proxy/${encodeURIComponent(filename)}`;
  try {
    const res = await fetch(proxyUrl, { credentials: 'include' });
    if (res.ok) {
      const blob = await res.blob();
      if (blob.size > 100) {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror  = () => resolve(null);
          reader.readAsDataURL(blob);
        });
      }
    }
  } catch { /* proxy not set up yet — fall through */ }

  // CHANGE 1: Use relative path so the React dev proxy forwards the request
  // to Express on the same origin — avoids CORS entirely.
  return toDataURL(`/assets/tape/${filename}`);
}

// ── extractVideoPoster — unchanged from original ──────────────────────────
async function extractVideoPoster(filePath) {
  return new Promise(async (resolve) => {
    let objectUrl = null;
    try {
      const res = await fetch(`/${filePath}`, { credentials: 'include' });
      if (!res.ok) { resolve(null); return; }
      const blob = await res.blob();
      objectUrl = URL.createObjectURL(blob);

      const vid = document.createElement('video');
      vid.style.cssText = 'position:fixed;opacity:0;pointer-events:none;width:1px;height:1px;top:-9999px;left:-9999px;';
      vid.muted = true;
      vid.playsInline = true;
      vid.preload = 'auto';
      document.body.appendChild(vid);

      const cleanup = () => {
        try { document.body.removeChild(vid); } catch {}
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      };

      const timeout = setTimeout(() => { cleanup(); resolve(null); }, 20000);

      vid.addEventListener('error', () => { clearTimeout(timeout); cleanup(); resolve(null); });

      vid.addEventListener('loadedmetadata', () => {
        const safeTime = Math.min(0.1, (vid.duration || 1) * 0.05);
        vid.currentTime = safeTime;
      }, { once: true });

      vid.addEventListener('seeked', () => {
        requestAnimationFrame(() => requestAnimationFrame(() => {
          try {
            const W = vid.videoWidth;
            const H = vid.videoHeight;
            if (!W || !H) { clearTimeout(timeout); cleanup(); resolve(null); return; }
            const cvs = document.createElement('canvas');
            cvs.width  = W;
            cvs.height = H;
            cvs.getContext('2d').drawImage(vid, 0, 0, W, H);
            const dataUrl = cvs.toDataURL('image/jpeg', 0.85);
            clearTimeout(timeout);
            cleanup();
            resolve(dataUrl);
          } catch {
            clearTimeout(timeout);
            cleanup();
            resolve(null);
          }
        }));
      }, { once: true });

      vid.src = objectUrl;
      vid.load();
    } catch {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      resolve(null);
    }
  });
}

// ── Scrapbook Page ─────────────────────────────────────────────────────────
function ScrapbookPage({ leftLog, rightLog, leftRef, rightRef }) {
  return (
    <div className="sb-spread">
      <div className="sb-page sb-page--left" ref={leftRef}>
        {leftLog
          ? <LogPage key={`left-${leftLog.log_date}`}  log={leftLog}  side="right"  />
          : <div className="sb-page-empty" />}
      </div>
      <div className="sb-spine" />
      <div className="sb-page sb-page--right" ref={rightRef}>
        {rightLog
          ? <LogPage key={`right-${rightLog.log_date}`} log={rightLog} side="right" />
          : <div className="sb-page-empty" />}
      </div>
    </div>
  );
}

// ── Individual log page ────────────────────────────────────────────────────
function LogPage({ log, side }) {
  const [detail,  setDetail]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [stickerDataURLs, setStickerDataURLs] = useState({});
  const [photoDataURLs,   setPhotoDataURLs]   = useState({});
  const [videoPosters,    setVideoPosters]    = useState({});
  const display = formatLogDate(log.log_date);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`${API}/logs/${log.log_date}`, { credentials: 'include' });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        setDetail(data);

        if (data.stickers?.length) {
          const entries = await Promise.all(
            data.stickers.map(async (s) => [s.id, await fetchStickerAsDataURL(s.asset_path)])
          );
          if (!cancelled) setStickerDataURLs(Object.fromEntries(entries));
        }

        if (data.photos?.length) {
          const entries = await Promise.all(
            data.photos.map(async (p) => [p.id, await toDataURL(`/${p.file_path}`)])
          );
          if (!cancelled) setPhotoDataURLs(Object.fromEntries(entries));
        }

        if (data.videos?.length) {
          const entries = await Promise.all(
            data.videos.map(async (v) => [v.id, await extractVideoPoster(v.file_path)])
          );
          if (!cancelled) setVideoPosters(Object.fromEntries(entries));
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
          {detail.photos?.map((photo) => {
            const geo = resolveGeometry(photo, side);
            const imgSrc = photoDataURLs[photo.id] || `/${photo.file_path}`;
            return (
              <div key={photo.id} className="sb-stamp-wrap" style={{
                top: `${geo.y}px`, left: `${geo.x}px`,
                transform: `rotate(${photo.rotation || 0}deg)`,
              }}>
                <div className="sb-stamp" style={{ width: `${geo.width}px`, height: `${geo.height}px` }}>
                  <img src={imgSrc} alt={photo.original_name || 'memory'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              </div>
            );
          })}

          {detail.videos?.map(video => {
            const geo  = resolveGeometry(video, side);
            const minH = Math.max(geo.height, Math.round(geo.width * 0.8), 100);
            return (
              <VideoItem
                key={video.id}
                video={video}
                geo={{ ...geo, height: minH }}
                posterSrc={videoPosters[video.id] ?? null}
              />
            );
          })}

          {detail.audio?.map(audio => {
            const geo = resolveGeometry(audio, side);
            return (
              <div key={audio.id} className="sb-media-item sb-audio-item" style={{
                top: `${geo.y}px`, left: `${geo.x}px`,
                width: `${geo.width}px`, height: `${Math.max(geo.height, 70)}px`,
                zIndex: audio.z_index || 1, transform: `rotate(${audio.rotation || 0}deg)`,
              }}>
                <div className="sb-audio-card">
                  <span className="sb-audio-label">🎵 {audio.original_name || 'Audio'}</span>
                  <audio src={`/${audio.file_path}`} controls style={{ width: '100%' }} />
                </div>
              </div>
            );
          })}

          {detail.answers?.map(answer => {
            const geo = resolveGeometry(answer, side);
            return (
              <div key={answer.id} className="sb-answer-wrap" style={{
                top: `${geo.y}px`, left: `${geo.x}px`,
                width: `${geo.width}px`, minHeight: `${geo.height}px`,
                zIndex: answer.z_index || 1, transform: `rotate(${answer.rotation || 0}deg)`,
              }}>
                <div className="sb-answer-prompt">{answer.prompt_text}:</div>
                <div className="sb-answer-washi">
                  <span className="sb-answer-text">{answer.answer_text}</span>
                </div>
              </div>
            );
          })}

          {/* Stickers */}
          {detail.stickers?.map(sticker => {
            const geo = resolveGeometry(sticker, side);
            const imgSrc = stickerDataURLs[sticker.id];
            
            // Fallback securely to the backend URL if the DataURL hasn't loaded
            const finalSrc = imgSrc || `/assets/tape/${sticker.asset_path.split('/').pop()}`;

            return (
              <div key={sticker.id} className="sb-sticker" style={{
                position: 'absolute',
                top: `${geo.y}px`, 
                left: `${geo.x}px`,
                width: `${geo.width}px`, 
                height: `${geo.height}px`,
                zIndex: sticker.z_index || 2, 
                transform: `rotate(${sticker.rotation || 0}deg)`,
                
                // THE FIX: Use background properties instead of an <img> tag 
                // so html2canvas respects the original aspect ratio
                backgroundImage: `url("${finalSrc}")`,
                backgroundSize: 'contain',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat'
              }} />
            );
          })}

          {detail.notes?.filter(n => n.content?.startsWith('EMOJI:')).map(note => {
            const geo   = resolveGeometry(note, side);
            const emoji = note.content.replace('EMOJI:', '');
            const scaledFont = Math.round((note.font_size || 48) * (SB_PAGE_CONTENT_WIDTH / CANVAS_REF_WIDTH));
            return (
              <div key={note.id} style={{
                position: 'absolute', top: `${geo.y}px`, left: `${geo.x}px`,
                width: `${geo.width}px`, height: `${geo.height}px`,
                fontSize: `${scaledFont}px`, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                lineHeight: 1, userSelect: 'none',
                zIndex: note.z_index || 2, transform: `rotate(${note.rotation || 0}deg)`,
              }}>
                {emoji}
              </div>
            );
          })}
        </>
      )}
      <div className={`sb-date ${side === 'left' ? 'sb-date--left' : 'sb-date--right'}`}>
        <span className="sb-date-weekday">{display.weekday}</span>
        <span className="sb-date-full">{display.full}</span>
      </div>
    </div>
  );
}

// ── VideoItem ──────────────────────────────────────────────────────────────
function VideoItem({ video, geo, posterSrc }) {
  const [showVideo, setShowVideo] = useState(false);

  const containerStyle = {
    position: 'absolute',
    top:      `${geo.y}px`,
    left:     `${geo.x}px`,
    width:    `${geo.width}px`,
    height:   `${geo.height}px`,
    zIndex:   video.z_index || 1,
    transform:`rotate(${video.rotation || 0}deg)`,
    overflow: 'hidden',
    background: '#111',
    borderRadius: '4px',
  };

  if (!posterSrc || showVideo) {
    return (
      <div className="sb-media-item sb-video-item" style={containerStyle}>
        <video src={`/${video.file_path}`} controls autoPlay={showVideo} muted playsInline
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', objectFit: 'cover' }} />
      </div>
    );
  }

  return (
    <div className="sb-media-item sb-video-item" style={containerStyle}>
      <img src={posterSrc} alt="video preview"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      <div onClick={() => setShowVideo(true)} style={{
        position: 'absolute', inset: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        background: 'rgba(0,0,0,0.15)',
      }}>
        <span style={{ fontSize: '2rem', color: '#fff', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.7))' }}>▶</span>
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
  const [pendingExport,  setPendingExport]  = useState(null);

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

  // When modal closes with a pending export, run after DOM has repainted
  useEffect(() => {
    if (!showShareModal && pendingExport) {
      const { ref, log } = pendingExport;
      setPendingExport(null);
      requestAnimationFrame(() => requestAnimationFrame(async () => {
        await runExportPng(ref, log.log_date);
      }));
    }
  }, [showShareModal, pendingExport]);

  // ── CHANGE 2: captureCanvas — target inner content div, no dimension overrides ──
  // Root cause of the empty cream space + blur in the previous export:
  //   - ref.current points to `.sb-page` which is a flex child spanning the full
  //     column width (e.g. half the 800px spread = 400+px), but the items are
  //     absolutely positioned within the inner `.sb-log-page` (400×520px).
  //     getBoundingClientRect() was returning the wider flex-column size.
  //   - Passing `width` and `height` from getBoundingClientRect locked html2canvas
  //     into those wrong dimensions, then `scale` multiplied them — producing a
  //     canvas with a large empty region that browsers show as blurry when scaled.
  //
  // Fix:
  //   1. Query `.sb-log-page` — the actual content wrapper — and capture that
  //      instead of the outer `.sb-page` container. Its offsetWidth/offsetHeight
  //      match the content exactly (SB_PAGE_CONTENT_WIDTH × SB_PAGE_CONTENT_HEIGHT).
  //   2. Remove the explicit `width`/`height`/`scrollX`/`scrollY` overrides so
  //      html2canvas measures the target element from the DOM naturally.
  //   3. Keep allowTaint:true so images that loaded in the browser are captured
  //      even without CORS headers (toBlob is unaffected by taint).
  //   4. scale stays at devicePixelRatio (≥2 on HiDPI) for crisp output.
  
  /*/////////////////////////////////
  const captureCanvas = async (ref) => {
    if (!ref?.current) return null;

    // CHANGE 2a: target the inner content div, not the outer page container
    const contentEl = ref.current.querySelector('.sb-log-page') || ref.current;

    // Wait two paint frames to ensure the DOM is fully settled after modal close
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    return html2canvas(contentEl, {
      // CHANGE 2b: NO explicit width/height — let html2canvas measure naturally
      // CHANGE 2c: sharp output at native screen density (minimum 2×)
      scale: Math.max(2, window.devicePixelRatio || 2),
      // CHANGE 2d: allowTaint:true so browser-loaded images are captured
      allowTaint:      true,
      useCORS:         true,
      backgroundColor: '#faf5ee',
      imageTimeout:    30000,
      logging:         false,
      // Ignore raw <audio>/<video> tags; poster <img> is captured normally
      ignoreElements: el => el.tagName === 'AUDIO' || el.tagName === 'VIDEO',
    });
  };
  //////////////////////////// */

  const captureCanvas = async (ref) => {
    if (!ref?.current) return null;

    const originalEl = ref.current.querySelector('.sb-log-page') || ref.current;

    // 1. Create a detached wrapper to completely escape ALL of your app's CSS scaling/flexbox constraints
    const printWrapper = document.createElement('div');
    printWrapper.style.position = 'fixed';
    printWrapper.style.top = '-9999px'; // Hide it far off-screen
    printWrapper.style.left = '0';
    printWrapper.style.width = `${SB_PAGE_CONTENT_WIDTH}px`;
    printWrapper.style.height = `${SB_PAGE_CONTENT_HEIGHT}px`;
    printWrapper.style.transform = 'none'; // Critical: Absolutely no scaling
    printWrapper.style.background = '#faf5ee'; // Base background color

    // 2. Deep clone the scrapbook page into this clean environment
    const clone = originalEl.cloneNode(true);
    clone.style.width = '100%';
    clone.style.height = '100%';
    clone.style.transform = 'none';
    clone.style.maxWidth = 'none';

    printWrapper.appendChild(clone);
    document.body.appendChild(printWrapper);

    // 3. Give the browser a split second to render the images and fonts inside the clone
    await new Promise(r => setTimeout(r, 150));

    try {
      // 4. Take the perfect screenshot
      return await html2canvas(clone, {
        scale: Math.max(2, window.devicePixelRatio || 2),
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#faf5ee',
        imageTimeout: 30000,
        logging: false,
        ignoreElements: el => el.tagName === 'AUDIO' || el.tagName === 'VIDEO',
      });
    } finally {
      // 5. Clean up the invisible clone when finished
      document.body.removeChild(printWrapper);
    }
  };

  // ── CHANGE 4: runExportPng — removed ZIP branch, PNG only ────────────────
  // All ZIP-related code (loadJSZip, runExportZip, exportZip) has been
  // removed. Only PNG export remains.
  const runExportPng = async (ref, logDate) => {
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
      }, 'image/png');
    } catch (err) {
      console.error('PNG export error:', err);
      alert('Unable to export PNG.');
    }
  };

  // Queue an export: close modal first so the overlay is gone before capture
  const queueExport = (ref, log) => {
    setPendingExport({ ref, log });
    setShowShareModal(false);
  };

  const totalPages = Math.ceil(logs.length / 2);
  const leftLog    = logs[pageIndex * 2]     || null;
  const rightLog   = logs[pageIndex * 2 + 1] || null;

  if (loading) return <div className="sb-loading"><span>📖</span><p>Opening your scrapbook…</p></div>;
  if (error)   return <div className="sb-error"><p>⚠️ {error}</p><button onClick={() => window.location.reload()}>Retry</button></div>;
  if (!logs.length) return (
    <div className="sb-empty">
      <span>📖</span><h2>Your scrapbook is empty</h2>
      <p>Head over to Day Log to create your first entry!</p>
    </div>
  );

  return (
    <div className="sb-layout">
      <div className="sb-toolbar">
        <button className="sb-share-btn" onClick={() => setShowShareModal(true)}>
          Export
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
        <button className="sb-arrow sb-arrow--left"  onClick={() => setPageIndex(p => Math.max(0, p - 1))}
          disabled={pageIndex === 0} aria-label="Previous page">◀</button>
        <span className="sb-page-indicator">{pageIndex + 1} / {totalPages}</span>
        <button className="sb-arrow sb-arrow--right" onClick={() => setPageIndex(p => Math.min(totalPages - 1, p + 1))}
          disabled={pageIndex >= totalPages - 1} aria-label="Next page">▶</button>
      </div>

      {showShareModal && (
        <ExportModal
          leftLog={leftLog}
          rightLog={rightLog}
          leftRef={leftPageRef}
          rightRef={rightPageRef}
          onExport={queueExport}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}

// ── CHANGE 5: ExportModal — ZIP section removed entirely ─────────────────
// Only the PNG screenshot option remains. The onExport signature is simplified
// to (ref, log) — no type argument needed since there is only one export type.
function ExportModal({ leftLog, rightLog, leftRef, rightRef, onExport, onClose }) {
  const leftDate  = leftLog  ? formatLogDate(leftLog.log_date).full  : null;
  const rightDate = rightLog ? formatLogDate(rightLog.log_date).full : null;

  return (
    <div className="sb-share-modal-overlay" onClick={onClose}>
      <div className="sb-share-modal" onClick={e => e.stopPropagation()}>
        <h3 className="sb-share-modal-title">Export your page</h3>

        <div className="sb-share-section-label">Screenshot (PNG)</div>
        <div className="sb-share-modal-options">
          {leftLog
            ? <button className="sb-share-page-btn"
                onClick={() => onExport(leftRef, leftLog)}>
                <span className="sb-share-page-icon">🖼</span>
                <span className="sb-share-page-label">{leftDate}</span>
              </button>
            : <div className="sb-share-page-btn sb-share-page-btn--empty">Empty</div>}
          {rightLog
            ? <button className="sb-share-page-btn"
                onClick={() => onExport(rightRef, rightLog)}>
                <span className="sb-share-page-icon">🖼</span>
                <span className="sb-share-page-label">{rightDate}</span>
              </button>
            : <div className="sb-share-page-btn sb-share-page-btn--empty">Empty</div>}
        </div>

        <button className="sb-share-modal-cancel" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}