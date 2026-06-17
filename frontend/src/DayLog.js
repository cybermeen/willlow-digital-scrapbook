import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Rnd } from 'react-rnd';
import './DayLog.css';

const API = '/api/scrapbook';

// ── Helpers ────────────────────────────────────────────────────────────────

const PROMPT_TYPES = [
  { value: 'gratitude', label: 'Gratitude' },
  { value: 'growth',    label: 'Growth' },
  { value: 'fun',       label: 'Fun' },
  { value: 'general',   label: 'General' },
];

// Stickers unlocked after a 7-day streak
const STREAK_EMOJI_STICKERS = [
  { emoji: '🌟', label: 'Gold Star' },
  { emoji: '⚡', label: 'Lightning' },
  { emoji: '🦋', label: 'Butterfly' },
  { emoji: '🎉', label: 'Party' },
  { emoji: '🌈', label: 'Rainbow' },
  { emoji: '🏆', label: 'Trophy' },
  { emoji: '🔥', label: 'Fire' },
  { emoji: '🌺', label: 'Flower' },
  { emoji: '💫', label: 'Sparkle' },
  { emoji: '🎊', label: 'Confetti' },
  { emoji: '✨', label: 'Magic' },
  { emoji: '🦄', label: 'Unicorn' },
];

// Special prompts unlocked after a 7-day streak
const STREAK_SPECIAL_PROMPTS = [
  "You've shown incredible consistency — what habit made this possible?",
  "A 7-day champion! What does showing up every day mean to you?",
  "Reflect on the biggest win from your streak week.",
  "What will you do to keep this momentum going into next week?",
  "Name three things this streak has taught you about yourself.",
];

function formatDisplayDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'long' }),
    full:    d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }),
    ordinal: (() => {
      const day = d.getDate();
      const s = ['th','st','nd','rd'];
      const v = day % 100;
      return day + (s[(v - 20) % 10] || s[v] || s[0]);
    })(),
    month: d.toLocaleDateString('en-US', { month: 'long' }),
    year:  d.getFullYear(),
  };
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function StampPhoto({ src, alt, style }) {
  return (
    <div className="stamp-photo" style={{ ...style, width: '100%', height: '100%' }}>
      <img src={src} alt={alt || 'log photo'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
  );
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const CANVAS_REF_WIDTH  = 680;
const CANVAS_REF_HEIGHT = 540;

const RND_HANDLE_STYLES = {
  topLeft:     { width: 12, height: 12, left: -6,  top: -6,  background: '#fff', border: '2px solid #aad4e8', borderRadius: '50%', zIndex: 20 },
  topRight:    { width: 12, height: 12, right: -6, top: -6,  background: '#fff', border: '2px solid #aad4e8', borderRadius: '50%', zIndex: 20 },
  bottomLeft:  { width: 12, height: 12, left: -6,  bottom: -6, background: '#fff', border: '2px solid #aad4e8', borderRadius: '50%', zIndex: 20 },
  bottomRight: { width: 12, height: 12, right: -6, bottom: -6, background: '#fff', border: '2px solid #aad4e8', borderRadius: '50%', zIndex: 20 },
};

const ENABLE_CORNERS = { topLeft: true, topRight: true, bottomLeft: true, bottomRight: true };

/** Returns the angle in degrees between a pivot and a point */
function angleBetween(pivot, point) {
  return Math.atan2(point.y - pivot.y, point.x - pivot.x) * (180 / Math.PI);
}

function getCanvasScale(canvasEl) {
  if (!canvasEl) return { scaleX: 1, scaleY: 1 };
  const rect = canvasEl.getBoundingClientRect();
  return {
    scaleX: CANVAS_REF_WIDTH  / (rect.width  || CANVAS_REF_WIDTH),
    scaleY: CANVAS_REF_HEIGHT / (rect.height || CANVAS_REF_HEIGHT),
  };
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function DayLog({ user, streak: streakProp, claimingReward, onRewardClaimed, goToTab, forceRewardsUnlocked }) {
  const date    = todayStr();
  const display = formatDisplayDate(date);

  const canvasRef = useRef(null);

  // Log & content state
  const [log,      setLog]      = useState(null);
  const [photos,   setPhotos]   = useState([]);
  const [videos,   setVideos]   = useState([]);
  const [audios,    setAudios]    = useState([]);
  const [answers,  setAnswers]  = useState([]);
  const [stickers, setStickers] = useState([]);
  const [notes,    setNotes]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [rotations, setRotations] = useState({});

  // Streak state
  const [streak, setStreak] = useState(null);

  // Daily prompt
  const [dailyPrompt,  setDailyPrompt]  = useState(null);
  const [promptType,   setPromptType]   = useState('gratitude');
  const [answerText,   setAnswerText]   = useState('');
  const [savingAnswer, setSavingAnswer] = useState(false);

  // Upload states
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);

  // File input refs
  const photoInputRef = useRef();
  const videoInputRef = useRef();
  const audioInputRef = useRef();

  // Magic Library
  const [showLibrary,   setShowLibrary]   = useState(false);
  const [assets,        setAssets]        = useState([]);
  const [assetsLoading, setAssetsLoading] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('highlight') === 'new-sticker') {
      const el = document.getElementById('new-unicorn-sticker');
      if (el) el.classList.add('streak-dot--latest');
    }
  }, []);

  useEffect(() => {
    if (claimingReward) {
      setShowStreakRewards(true);
      setStreakRewardTab('stickers');
      setShowLibrary(false);
      setShowClaimModal(false);
    }
  }, [claimingReward]);

  const [showStreakRewards,    setShowStreakRewards]    = useState(false);
  const [streakRewardTab,      setStreakRewardTab]      = useState('stickers');
  const [showUnlockCelebration, setShowUnlockCelebration] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [newlyPlacedNoteId, setNewlyPlacedNoteId] = useState(null);

  const fetchPromptByCategory = useCallback(async (category) => {
    if (!category) return;
    try {
      const res = await fetch(`${API}/prompts/daily?category=${category}`, { credentials: 'include' });
      if (res.ok) {
        setDailyPrompt(await res.json());
      }
    } catch (err) {
      console.error('Error fetching prompt:', err);
    }
  }, []);

  const [selectedId, setSelectedId] = useState(null);

  // ── Load today's log ────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [logRes, promptRes, streakRes] = await Promise.all([
          fetch(`${API}/logs/${date}`, { credentials: 'include' }),
          fetch(`${API}/prompts/daily`, { credentials: 'include' }),
          fetch('/api/progress/streak', { credentials: 'include' }),
        ]);

        if (!logRes.ok) throw new Error('Failed to load log');
        const logData = await logRes.json();

        setLog(logData.log);
        setPhotos(logData.photos   || []);
        setVideos(logData.videos   || []);
        setAudios(logData.audio    || []);
        setStickers(logData.stickers || []);
        setAnswers(logData.answers  || []);
        setNotes(logData.notes || []);

        const initRotations = {};
        (logData.photos   || []).forEach(p => { if (p.rotation)  initRotations[`photo-${p.id}`]   = p.rotation; });
        (logData.videos   || []).forEach(v => { if (v.rotation)  initRotations[`video-${v.id}`]   = v.rotation; });
        (logData.audio    || []).forEach(a => { if (a.rotation)  initRotations[`audio-${a.id}`]   = a.rotation; });
        (logData.stickers || []).forEach(s => { if (s.rotation)  initRotations[`sticker-${s.id}`] = s.rotation; });
        (logData.answers  || []).forEach(a => { if (a.rotation)  initRotations[`answer-${a.id}`]  = a.rotation; });
        setRotations(initRotations);

        if (logData.answers?.length > 0) {
          const savedAnswer = logData.answers[0];
          setAnswerText(savedAnswer.answer_text || '');
          setPromptType(savedAnswer.category || 'gratitude');
          setDailyPrompt({
            id: savedAnswer.prompt_id,
            prompt_text: savedAnswer.prompt_text,
            category: savedAnswer.category || 'gratitude',
          });
        } else {
          if (promptRes.ok) {
            const defaultPrompt = await promptRes.json();
            setDailyPrompt(defaultPrompt);
            setPromptType(defaultPrompt.category || 'gratitude');
          } else {
            await fetchPromptByCategory('gratitude');
          }
        }

        if (streakRes.ok) {
          const streakData = await streakRes.json();
          setStreak(streakData);
          if (streakData.rewardsUnlocked) {
            const celebKey = `willow_streak_claimed_${user?.id || 'anon'}`;
            if (!localStorage.getItem(celebKey)) {
              setShowClaimModal(true);
            }
          }
        }

      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [date]);

  // ── Art assets ─────────────────────────────────────────────────────────

  const loadAssets = useCallback(async () => {
    if (assets.length > 0) return;
    setAssetsLoading(true);
    try {
      const res = await fetch(`${API}/assets`, { credentials: 'include' });
      if (res.ok) setAssets(await res.json());
    } finally {
      setAssetsLoading(false);
    }
  }, [assets.length]);

  const openLibrary = () => { setShowLibrary(true); loadAssets(); };

  // ── ROTATION: rndWrapperRefs stores refs to each Rnd's outer wrapper div
  // so handleRotateStart can always get the true bounding box for center calculation.
  const rndWrapperRefs = useRef({});
  const setRndRef = (key, el) => { rndWrapperRefs.current[key] = el; };

  // FIX: handleRotateStart now only takes (e, itemKey, currentRotation).
  // It finds the element center via rndWrapperRefs for all item types.
  // For items that don't use rndWrapperRefs (answer-0), we walk up the DOM
  // to find the react-draggable wrapper.
  const handleRotateStart = (e, itemKey, currentRotation) => {
    e.stopPropagation();
    if (e.preventDefault) e.preventDefault();

    // Try registered wrapper ref first (photos, videos, audios, stickers, emoji notes)
    let draggableEl = rndWrapperRefs.current[itemKey];

    // Fallback: walk up DOM from the rotate handle to find .react-draggable wrapper
    if (!draggableEl) {
      const nativeEvent = e.nativeEvent || e;
      let node = nativeEvent.target || nativeEvent.srcElement;
      while (node && node !== document.body) {
        if (node.classList && node.classList.contains('react-draggable')) {
          draggableEl = node;
          break;
        }
        node = node.parentElement;
      }
    }

    if (!draggableEl) return;

    const rect = draggableEl.getBoundingClientRect();
    const centerX = rect.left + rect.width  / 2;
    const centerY = rect.top  + rect.height / 2;

    const getPos = (ev) => ({
      x: ev.touches && ev.touches.length > 0 ? ev.touches[0].clientX : ev.clientX,
      y: ev.touches && ev.touches.length > 0 ? ev.touches[0].clientY : ev.clientY,
    });

    const startPos   = getPos(e.nativeEvent || e);
    const startAngle = angleBetween({ x: centerX, y: centerY }, startPos);
    const baseRotation = currentRotation || 0;

    const onMove = (moveEvent) => {
      if (moveEvent.cancelable) moveEvent.preventDefault();
      const currentPos   = getPos(moveEvent);
      const currentAngle = angleBetween({ x: centerX, y: centerY }, currentPos);
      const delta        = currentAngle - startAngle;

      setRotations(prev => ({
        ...prev,
        [itemKey]: baseRotation + delta,
      }));
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend',  onUp);
      setSaved(false);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend',  onUp);
  };

  // ── Photo upload ────────────────────────────────────────────────────────

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !log) return;
    setUploadingPhoto(true);
    try {
      const form = new FormData();
      form.append('photo', file);
      const res = await fetch(`${API}/photos/${log.id}`, {
        method: 'POST', credentials: 'include', body: form,
      });
      if (res.ok) {
        const newPhoto = await res.json();
        setPhotos(prev => [...prev, newPhoto]);
        setSaved(false);
      }
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handleDeletePhoto = async (photoId) => {
    try {
      await fetch(`${API}/photos/${photoId}`, { method: 'DELETE', credentials: 'include' });
      setPhotos(prev => prev.filter(p => p.id !== photoId));
      setSaved(false);
    } catch (err) { console.error('Delete photo error:', err); }
  };

  // ── Video upload ────────────────────────────────────────────────────────

  const handleVideoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !log) return;
    setUploadingVideo(true);
    try {
      const form = new FormData();
      form.append('video', file);
      const res = await fetch(`${API}/videos/${log.id}`, {
        method: 'POST', credentials: 'include', body: form,
      });
      if (res.ok) {
        const newVideo = await res.json();
        setVideos(prev => [...prev, newVideo]);
        setSaved(false);
      } else {
        const err = await res.json();
        alert(err.error || 'Video upload failed');
      }
    } finally {
      setUploadingVideo(false);
      e.target.value = '';
    }
  };

  const handleDeleteVideo = async (videoId) => {
    try {
      await fetch(`${API}/videos/${videoId}`, { method: 'DELETE', credentials: 'include' });
      setVideos(prev => prev.filter(v => v.id !== videoId));
      setSaved(false);
    } catch (err) { console.error('Delete video error:', err); }
  };

  // ── Audio upload ────────────────────────────────────────────────────────

  const handleAudioUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !log) return;
    setUploadingAudio(true);
    try {
      const form = new FormData();
      form.append('audio', file);
      const res = await fetch(`${API}/audio/${log.id}`, {
        method: 'POST', credentials: 'include', body: form,
      });
      if (res.ok) {
        const newAudio = await res.json();
        setAudios(prev => [...prev, newAudio]);
        setSaved(false);
      } else {
        const err = await res.json();
        alert(err.error || 'Audio upload failed');
      }
    } finally {
      setUploadingAudio(false);
      e.target.value = '';
    }
  };

  const handleDeleteAudio = async (audioId) => {
    try {
      await fetch(`${API}/audio/${audioId}`, { method: 'DELETE', credentials: 'include' });
      setAudios(prev => prev.filter(a => a.id !== audioId));
      setSaved(false);
    } catch (err) { console.error('Delete audio error:', err); }
  };

  // ── Stickers ────────────────────────────────────────────────────────────

  const handlePlaceSticker = async (asset) => {
    if (!log) return;
    try {
      const res = await fetch(`${API}/stickers/${log.id}`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_id: asset.id,
          pos_x: Math.floor(Math.random() * 250) + 100,
          pos_y: Math.floor(Math.random() * 250) + 100,
          width: 100, height: 100,
        }),
      });
      if (res.ok) {
        const newSticker = await res.json();
        setStickers(prev => [...prev, { ...newSticker, asset_path: asset.file_path, asset_name: asset.name }]);
        setSaved(false);
      }
    } catch (err) { console.error('Place sticker error:', err); }
    setShowLibrary(false);
  };

  const handleDeleteSticker = async (stickerId) => {
    try {
      await fetch(`${API}/stickers/${stickerId}`, { method: 'DELETE', credentials: 'include' });
      setStickers(prev => prev.filter(s => s.id !== stickerId));
      setSaved(false);
    } catch (err) { console.error('Delete sticker error:', err); }
  };

  const handleStickerUpdate = async () => {
    if (!log || stickers.length === 0) return;
    try {
      for (const sticker of stickers) {
        await fetch(`${API}/stickers/${sticker.id}`, {
          method: 'PATCH', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pos_x: sticker.pos_x,
            pos_y: sticker.pos_y,
            width: sticker.width,
            height: sticker.height,
          }),
        });
      }
    } catch (err) { console.error('Update sticker error:', err); }
  };

  // ── Streak Emoji Stickers ────────────────────────────────────────────────

  const handlePlaceEmojiSticker = async (emoji) => {
    if (!log) return;
    try {
      const res = await fetch(`${API}/notes/${log.id}`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `EMOJI:${emoji}`,
          pos_x: Math.floor(Math.random() * 350) + 60,
          pos_y: Math.floor(Math.random() * 320) + 60,
          bg_color: 'transparent',
          font_size: 48,
        }),
      });
      if (res.ok) {
        const newNote = await res.json();
        setNotes(prev => [...prev, newNote]);
        setNewlyPlacedNoteId(newNote.id);
        setTimeout(() => setNewlyPlacedNoteId(null), 4000);
        setSaved(false);
        if (claimingReward && onRewardClaimed) {
          onRewardClaimed();
        }
      }
    } catch (err) { console.error('Place emoji sticker error:', err); }
    setShowStreakRewards(false);
  };

  const handleClaimStreakSticker = async (emoji) => {
    await handlePlaceEmojiSticker(emoji);
    localStorage.setItem(`willow_streak_claimed_${user?.id || 'anon'}`, '1');
    setShowClaimModal(false);
  };

  const handleDismissClaimModal = () => {
    localStorage.setItem(`willow_streak_claimed_${user?.id || 'anon'}`, '1');
    setShowClaimModal(false);
  };

  const handleDeleteEmojiNote = async (noteId) => {
    try {
      await fetch(`${API}/notes/${noteId}`, { method: 'DELETE', credentials: 'include' });
      setNotes(prev => prev.filter(n => n.id !== noteId));
      setSaved(false);
    } catch (err) { console.error('Delete emoji note error:', err); }
  };

  const handleUseStreakPrompt = (promptText) => {
    setDailyPrompt({ id: null, prompt_text: promptText });
    setAnswerText('');
    setSaved(false);
    setShowStreakRewards(false);
  };

  // ── Prompt answer ───────────────────────────────────────────────────────

  const handleSaveAnswer = async (localAnswer) => {
    if (!log || !dailyPrompt || !answerText.trim()) return null;
    setSavingAnswer(true);
    try {
      const answerState = localAnswer || answers[0] || {};
      const answerPayload = {
        prompt_id: dailyPrompt.id,
        answer_text: answerText,
        pos_x: answerState.pos_x || 0,
        pos_y: answerState.pos_y || 0,
        width: answerState.width || 260,
        height: answerState.height || 120,
        z_index: answerState.z_index || 0,
      };

      if (answerState.id) {
        const res = await fetch(`${API}/prompts/answer/${answerState.id}`, {
          method: 'PATCH', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(answerPayload),
        });
        if (res.ok) {
          const updated = await res.json();
          setAnswers([updated]);
          return updated;
        }
      } else {
        const res = await fetch(`${API}/prompts/answer/${log.id}`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt_id: dailyPrompt.id, ...answerPayload }),
        });
        if (res.ok) {
          const created = await res.json();
          const hydrated = { ...answerState, ...created };
          setAnswers([hydrated]);
          return hydrated;
        }
      }
      return null;
    } finally {
      setSavingAnswer(false);
    }
  };

  const handleSave = async () => {
    if (!log) return;
    setSaving(true);

    try {
      const currentAnswer = answers[0];
      const savedAnswer   = await handleSaveAnswer(currentAnswer);
      const layoutAnswers = savedAnswer
        ? [{ ...savedAnswer, ...(currentAnswer || {}) }]
        : answers;

      await handleStickerUpdate();

      const { scaleX, scaleY } = getCanvasScale(canvasRef.current);

      const normalise = (item, typeKey, idField = 'id') => {
        const rot = rotations[`${typeKey}-${item[idField]}`] || 0;
        const nx  = ((item.pos_x  || 0) * scaleX) / CANVAS_REF_WIDTH;
        const ny  = ((item.pos_y  || 0) * scaleY) / CANVAS_REF_HEIGHT;
        const nw  = ((item.width  || 100) * scaleX) / CANVAS_REF_WIDTH;
        const nh  = ((item.height || 100) * scaleY) / CANVAS_REF_HEIGHT;
        return {
          ...item,
          rotation: rot,
          norm_x: nx,
          norm_y: ny,
          norm_w: nw,
          norm_h: nh,
        };
      };

      const payload = {
        canvas_ref_width:  CANVAS_REF_WIDTH,
        canvas_ref_height: CANVAS_REF_HEIGHT,
        photos:   photos.map(p  => normalise(p,  'photo')),
        videos:   videos.map(v  => normalise(v,  'video')),
        audios:   audios.map(a  => normalise(a,  'audio')),
        answers:  layoutAnswers.map(a => ({
          ...normalise(a, 'answer', 'id'),
          rotation: rotations['answer-0'] || rotations[`answer-${a.id}`] || 0,
        })),
        stickers: stickers.map(s => normalise(s, 'sticker')),
        notes,
      };

      const res = await fetch(`${API}/layout/${log.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to save layout');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Save error:', err);
      alert('Could not save layout.');
    } finally { setSaving(false); }
  };

  const handleReset = async () => {
    const confirmed = window.confirm("Are you sure you want to clear your entire canvas for today? This cannot be undone.");
    if (!confirmed) return;

    setSaving(true);
    
    try {
      // 1. Send true DELETE requests to the backend FIRST
      await Promise.all([
        ...photos.map(p => fetch(`${API}/photos/${p.id}`, { method: 'DELETE', credentials: 'include' })),
        ...videos.map(v => fetch(`${API}/videos/${v.id}`, { method: 'DELETE', credentials: 'include' })),
        ...audios.map(a => fetch(`${API}/audio/${a.id}`, { method: 'DELETE', credentials: 'include' })),
        ...stickers.map(s => fetch(`${API}/stickers/${s.id}`, { method: 'DELETE', credentials: 'include' })),
        ...notes.map(n => fetch(`${API}/notes/${n.id}`, { method: 'DELETE', credentials: 'include' })),
        ...answers.map(a => fetch(`${API}/prompts/answer/${a.id}`, { method: 'DELETE', credentials: 'include' })) // Now uses the new DELETE route!
      ]);

      // 2. THEN instantly clear the local UI React state
      setAnswerText('');
      setPhotos([]);
      setVideos([]);
      setAudios([]);
      setStickers([]);
      setNotes([]);
      setAnswers([]);
      setSelectedId(null);
      
      // 3. Show success (without calling handleSave() which would resurrect the ghosts)
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      
    } catch (err) {
      console.error('Reset error:', err);
      alert('There was an issue fully resetting your canvas. Please refresh the page.');
    } finally {
      setSaving(false);
    }
  };
  
  // ── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="dl-loading">
        <span className="dl-loading-icon">🌿</span>
        <p>Loading your canvas…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dl-error">
        <p>⚠️ {error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  const rewardsUnlocked = forceRewardsUnlocked || streak?.rewardsUnlocked;
  const currentStreak   = streak?.currentStreak || 0;
  const emojiNotes      = notes.filter(n => n.content?.startsWith('EMOJI:'));

  return (
    <div className="dl-layout">
      {/* ── Unlock Celebration Overlay ── */}
      {showUnlockCelebration && (
        <div className="dl-unlock-celebration" aria-live="polite">
          <div className="dl-unlock-celebration-inner">
            <span className="dl-unlock-celebration-emoji">🏆</span>
            <div>
              <strong>Streak Rewards Unlocked!</strong>
              <p>Your {currentStreak}-day streak earned you exclusive stickers &amp; special prompts!</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Streak Claim Modal ── */}
      {showClaimModal && (
        <div className="dl-claim-overlay">
          <div className="dl-claim-modal">
            <div className="dl-claim-confetti">🎊 🏆 🎊</div>
            <h2 className="dl-claim-title">🔥 7-Day Streak!</h2>
            <p className="dl-claim-sub">
              You completed every task for 7 days in a row.<br />
              Pick a sticker to claim as your reward!
            </p>
            <div className="dl-claim-sticker-grid">
              {STREAK_EMOJI_STICKERS.map(({ emoji, label }) => (
                <button
                  key={emoji}
                  className="dl-claim-sticker-btn"
                  onClick={() => handleClaimStreakSticker(emoji)}
                  title={`Claim ${label}`}
                >
                  <span className="dl-claim-sticker-emoji">{emoji}</span>
                  <span className="dl-claim-sticker-label">{label}</span>
                </button>
              ))}
            </div>
            <button className="dl-claim-later" onClick={handleDismissClaimModal}>
              Claim later
            </button>
          </div>
        </div>
      )}

      {/* ── Left Panel ── */}
      <div className="dl-panel">
        {streak && (
          <div className={`dl-streak-badge ${rewardsUnlocked ? 'dl-streak-badge--unlocked' : ''}`}>
            <span className="dl-streak-badge-flame">🔥</span>
            <span className="dl-streak-badge-count">{currentStreak} day streak</span>
            {rewardsUnlocked && (
              <span className="dl-streak-badge-unlocked">✨ Rewards unlocked</span>
            )}
          </div>
        )}
        <div className="dl-panel-title">Create Today's Log</div>

        {/* ── Streak Rewards Panel ── */}
        {rewardsUnlocked && showStreakRewards ? (
          <div className="dl-streak-rewards">
            <div className="dl-streak-rewards-header">
              <span className="dl-streak-rewards-title">🏆 Streak Rewards</span>
              <button className="dl-streak-rewards-close" onClick={() => setShowStreakRewards(false)}>✕</button>
            </div>
            <p className="dl-streak-rewards-sub">Earned by completing 7 consecutive days of tasks!</p>
            <div className="dl-streak-tabs">
              <button
                className={`dl-streak-tab ${streakRewardTab === 'stickers' ? 'dl-streak-tab--active' : ''}`}
                onClick={() => setStreakRewardTab('stickers')}
              >
                🎨 Stickers
              </button>
              <button
                className={`dl-streak-tab ${streakRewardTab === 'prompts' ? 'dl-streak-tab--active' : ''}`}
                onClick={() => setStreakRewardTab('prompts')}
              >
                ✍️ Prompts
              </button>
            </div>
            {streakRewardTab === 'stickers' && (
              <div className="dl-streak-sticker-grid">
                {STREAK_EMOJI_STICKERS.map(({ emoji, label }) => (
                  <button
                    key={emoji}
                    className="dl-streak-sticker-btn"
                    onClick={() => handlePlaceEmojiSticker(emoji)}
                    title={`Place ${label} sticker`}
                  >
                    <span className="dl-streak-sticker-emoji">{emoji}</span>
                    <span className="dl-streak-sticker-label">{label}</span>
                  </button>
                ))}
              </div>
            )}
            {streakRewardTab === 'prompts' && (
              <div className="dl-streak-prompts-list">
                {STREAK_SPECIAL_PROMPTS.map((prompt, i) => (
                  <button key={i} className="dl-streak-prompt-btn" onClick={() => handleUseStreakPrompt(prompt)}>
                    <span className="dl-streak-prompt-num">✦</span>
                    <span className="dl-streak-prompt-text">{prompt}</span>
                  </button>
                ))}
              </div>
            )}
            <button className="dl-streak-rewards-back" onClick={() => setShowStreakRewards(false)}>
              ◀ Back to editor
            </button>
          </div>

        ) : !showLibrary ? (
          <div className="dl-editor">
            {rewardsUnlocked && (
              <button className="dl-streak-open-btn" onClick={() => setShowStreakRewards(true)}>
                <span className="dl-streak-open-icon">🏆</span>
                <span>Open Streak Rewards</span>
                <span className="dl-streak-open-badge">NEW</span>
              </button>
            )}

            <div className="dl-field-group">
              <label className="dl-label">Choose prompt type:</label>
              <div className="dl-select-wrap">
                <select
                  className="dl-select"
                  value={promptType}
                  onChange={e => {
                    const nextType = e.target.value;
                    setPromptType(nextType);
                    fetchPromptByCategory(nextType);
                  }}
                >
                  {PROMPT_TYPES.map(pt => (
                    <option key={pt.value} value={pt.value}>{pt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {dailyPrompt && (
              <div className="dl-field-group">
                <label className="dl-label">Today's prompt:</label>
                <div className="dl-prompt-box">
                  <em>"{dailyPrompt.prompt_text}"</em>
                </div>
              </div>
            )}

            <textarea
              className="dl-textarea"
              placeholder="Write your thoughts here…"
              value={answerText}
              onChange={e => { setAnswerText(e.target.value); setSaved(false); }}
              rows={6}
            />

            <div className="dl-add-section">
              <span className="dl-add-label">Add:</span>
              <div className="dl-add-btns">
                <button className="dl-add-btn" onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto} title="Upload an image">
                  {uploadingPhoto ? '…' : '🖼 Image'}
                </button>
                <button className="dl-add-btn" onClick={() => videoInputRef.current?.click()} disabled={uploadingVideo} title="Upload a video (MP4, MOV, WebM — max 200MB)">
                  {uploadingVideo ? '⏳ Uploading…' : '🎬 Video'}
                </button>
                <button className="dl-add-btn" onClick={() => audioInputRef.current?.click()} disabled={uploadingAudio} title="Upload audio (MP3, WAV, AAC — max 50MB)">
                  {uploadingAudio ? '⏳ Uploading…' : '🎵 Audio'}
                </button>
              </div>
              <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
              <input ref={videoInputRef} type="file" accept="video/mp4,video/quicktime,video/webm,video/x-msvideo,video/mpeg" style={{ display: 'none' }} onChange={handleVideoUpload} />
              <input ref={audioInputRef} type="file" accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/aac,audio/x-m4a" style={{ display: 'none' }} onChange={handleAudioUpload} />
            </div>

            <button className="dl-library-btn" onClick={openLibrary}>
              Open Magic Library
            </button>
          </div>
        ) : (
          <div className="dl-library">
            <div className="dl-library-header">
              <div className="dl-library-title-pill">Magic Library</div>
            </div>
            <div className="dl-library-grid">
              {assetsLoading && <p className="dl-library-loading">Loading assets…</p>}
              {!assetsLoading && assets.length === 0 && (
                <p className="dl-library-empty">No assets found</p>
              )}
              {assets.map((asset, idx) => {
                const NUM_LOCKED = 3;
                const isLocked = idx >= assets.length - NUM_LOCKED && !rewardsUnlocked;
                return (
                  <button
                    key={asset.id}
                    className={`dl-asset-btn${isLocked ? ' dl-asset-btn--locked' : ''}`}
                    onClick={() => { if (!isLocked) handlePlaceSticker(asset); }}
                    title={isLocked ? '🔒 Complete a 7-day streak to unlock!' : asset.name}
                    disabled={isLocked}
                  >
                    <img src={`/${asset.file_path}`} alt={asset.name} onError={e => { e.target.style.display = 'none'; }} />
                    {isLocked && <span className="dl-asset-lock-icon">🔒</span>}
                  </button>
                );
              })}
            </div>
            <button className="dl-library-back" onClick={() => setShowLibrary(false)}>◀</button>
          </div>
        )}

        {showLibrary && (
          <div className="dl-library-footer">
            <button className="dl-import-btn" onClick={() => photoInputRef.current?.click()}>
              Import your own assets
            </button>
            <button className={`dl-save-btn ${saved ? 'dl-save-btn--saved' : ''}`} onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
            </button>
            <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
          </div>
        )}

        {!showLibrary && (
          <div className="dl-actions">
            <button className="dl-reset-btn" onClick={handleReset}>Reset</button>
            <button className={`dl-save-btn ${saved ? 'dl-save-btn--saved' : ''}`} onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
            </button>
          </div>
        )}
      </div>

      {/* ── Right Panel: Canvas ── */}
      <div className="dl-canvas-wrap">
        <div className="dl-canvas" ref={canvasRef}>
          {/* Date stamp */}
          <div
            className="dl-canvas-date"
            onMouseDown={(e) => {
              if (
                e.target.classList.contains('dl-canvas') ||
                e.target.classList.contains('dl-canvas-empty') ||
                e.target.classList.contains('dl-canvas-wrap')
              ) {
                setSelectedId(null);
              }
            }}
          >
            <span>{display.weekday}</span>
            <span>{display.ordinal} {display.month} {display.year}</span>
          </div>

          {/* Videos */}
          {videos.map((video, i) => {
            const isSelected = selectedId === `video-${video.id}`;
            return (
              <Rnd
                key={video.id}
                cancel=".dl-rotate-handle, .dl-canvas-delete"
                size={{ width: video.width || 400, height: video.height || 300 }}
                position={{ x: video.pos_x || 30, y: video.pos_y || 40 }}
                onDragStop={(e, d) => {
                  setVideos(prev => prev.map((v, idx) => idx === i ? { ...v, pos_x: d.x, pos_y: d.y } : v));
                  setSaved(false);
                }}
                onResizeStop={(e, direction, ref, delta, position) => {
                  setVideos(prev => prev.map((v, idx) => idx === i ? {
                    ...v,
                    width: parseInt(ref.style.width),
                    height: parseInt(ref.style.height),
                    pos_x: position.x,
                    pos_y: position.y,
                  } : v));
                  setSaved(false);
                }}
                bounds="parent"
                enableResizing={ENABLE_CORNERS}
                resizeHandleStyles={RND_HANDLE_STYLES}
                resizeHandleComponent={isSelected ? undefined : {
                  topLeft: <div style={{ display: 'none' }} />,
                  topRight: <div style={{ display: 'none' }} />,
                  bottomLeft: <div style={{ display: 'none' }} />,
                  bottomRight: <div style={{ display: 'none' }} />,
                }}
                minWidth={150}
                minHeight={100}
                style={{ cursor: isSelected ? 'grab' : 'auto' }}
              >
                <div
                  ref={el => setRndRef(`video-${video.id}`, el)}
                  className="dl-rnd-item"
                  onMouseDown={() => setSelectedId(`video-${video.id}`)}
                  onTouchStart={() => setSelectedId(`video-${video.id}`)}
                  style={{
                    width: '100%', height: '100%', position: 'relative',
                    display: 'flex', flexDirection: 'column',
                    transform: `rotate(${rotations[`video-${video.id}`] || 0}deg)`,
                  }}
                >
                  {isSelected && (
                    <div
                      className="dl-rotate-handle"
                      style={{ opacity: 1 }}
                      onMouseDown={e => { e.stopPropagation(); handleRotateStart(e, `video-${video.id}`, rotations[`video-${video.id}`] || 0); }}
                      onTouchStart={e => { e.stopPropagation(); handleRotateStart(e, `video-${video.id}`, rotations[`video-${video.id}`] || 0); }}
                      title="Rotate"
                    >↻</div>
                  )}
                  <div style={{ flex: 1, pointerEvents: 'auto', overflow: 'hidden' }}>
                    <video src={`/${video.file_path}`} controls preload="metadata"
                      className="dl-video-player" style={{ width: '100%', height: '100%', objectFit: 'cover' }}>
                      Your browser does not support video.
                    </video>
                  </div>
                  <button className="dl-canvas-delete" style={{ opacity: isSelected ? 1 : 0 }}
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => { e.stopPropagation(); handleDeleteVideo(video.id); }}>×</button>
                </div>
              </Rnd>
            );
          })}

          {/* Audio */}
          {audios.map((track, i) => {
            const isSelected = selectedId === `audio-${track.id}`;
            return (
              <Rnd
                key={track.id}
                cancel=".dl-rotate-handle, .dl-canvas-delete"
                size={{ width: track.width || 350, height: track.height || 100 }}
                position={{ x: track.pos_x || 30, y: track.pos_y || 200 }}
                onDragStop={(e, d) => {
                  setAudios(prev => prev.map((a, idx) => idx === i ? { ...a, pos_x: d.x, pos_y: d.y } : a));
                  setSaved(false);
                }}
                onResizeStop={(e, direction, ref, delta, position) => {
                  setAudios(prev => prev.map((a, idx) => idx === i ? {
                    ...a,
                    width: parseInt(ref.style.width),
                    height: parseInt(ref.style.height),
                    pos_x: position.x,
                    pos_y: position.y,
                  } : a));
                  setSaved(false);
                }}
                bounds="parent"
                enableResizing={ENABLE_CORNERS}
                resizeHandleStyles={RND_HANDLE_STYLES}
                resizeHandleComponent={isSelected ? undefined : {
                  topLeft: <div style={{ display: 'none' }} />,
                  topRight: <div style={{ display: 'none' }} />,
                  bottomLeft: <div style={{ display: 'none' }} />,
                  bottomRight: <div style={{ display: 'none' }} />,
                }}
                minWidth={200}
                minHeight={80}
                style={{ cursor: isSelected ? 'grab' : 'auto' }}
              >
                <div
                  ref={el => setRndRef(`audio-${track.id}`, el)}
                  className="dl-rnd-item"
                  onMouseDown={() => setSelectedId(`audio-${track.id}`)}
                  onTouchStart={() => setSelectedId(`audio-${track.id}`)}
                  style={{
                    width: '100%', height: '100%', position: 'relative',
                    display: 'flex', flexDirection: 'column',
                    padding: '0.5rem', boxSizing: 'border-box', gap: '0.35rem',
                    transform: `rotate(${rotations[`audio-${track.id}`] || 0}deg)`,
                  }}
                >
                  {isSelected && (
                    <div
                      className="dl-rotate-handle"
                      style={{ opacity: 1 }}
                      onMouseDown={e => { e.stopPropagation(); handleRotateStart(e, `audio-${track.id}`, rotations[`audio-${track.id}`] || 0); }}
                      onTouchStart={e => { e.stopPropagation(); handleRotateStart(e, `audio-${track.id}`, rotations[`audio-${track.id}`] || 0); }}
                      title="Rotate"
                    >↻</div>
                  )}
                  <div className="dl-audio-header" style={{ pointerEvents: 'none', flexShrink: 0 }}>
                    <span className="dl-audio-icon">🎵</span>
                    <span className="dl-audio-name">{track.original_name}</span>
                    <span className="dl-media-size">{formatFileSize(track.file_size)}</span>
                  </div>
                  <div style={{ flex: 1, pointerEvents: 'auto', overflow: 'hidden' }}>
                    <audio src={`/${track.file_path}`} controls preload="metadata"
                      className="dl-audio-player" style={{ width: '100%', height: '100%' }}>
                      Your browser does not support audio.
                    </audio>
                  </div>
                  <button className="dl-canvas-delete" style={{ opacity: isSelected ? 1 : 0 }}
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => { e.stopPropagation(); handleDeleteAudio(track.id); }}>×</button>
                </div>
              </Rnd>
            );
          })}

          {/* Photos */}
          {photos.map((photo, i) => {
            const isSelected = selectedId === `photo-${photo.id}`;
            return (
              <Rnd
                key={photo.id}
                cancel=".dl-rotate-handle, .dl-canvas-delete"
                size={{ width: photo.width || 200, height: photo.height || 200 }}
                position={{ x: photo.pos_x || 30, y: photo.pos_y || 40 }}
                onDragStop={(e, d) => {
                  setPhotos(prev => prev.map((p, idx) => idx === i ? { ...p, pos_x: d.x, pos_y: d.y } : p));
                  setSaved(false);
                }}
                onResizeStop={(e, direction, ref, delta, position) => {
                  setPhotos(prev => prev.map((p, idx) => idx === i ? {
                    ...p,
                    width: parseInt(ref.style.width),
                    height: parseInt(ref.style.height),
                    pos_x: position.x,
                    pos_y: position.y,
                  } : p));
                  setSaved(false);
                }}
                bounds="parent"
                enableResizing={ENABLE_CORNERS}
                resizeHandleStyles={RND_HANDLE_STYLES}
                resizeHandleComponent={isSelected ? undefined : {
                  topLeft: <div style={{ display: 'none' }} />,
                  topRight: <div style={{ display: 'none' }} />,
                  bottomLeft: <div style={{ display: 'none' }} />,
                  bottomRight: <div style={{ display: 'none' }} />,
                }}
                minWidth={80}
                minHeight={80}
                style={{ cursor: isSelected ? 'grab' : 'auto' }}
              >
                <div
                  ref={el => setRndRef(`photo-${photo.id}`, el)}
                  className="dl-rnd-item"
                  onMouseDown={() => setSelectedId(`photo-${photo.id}`)}
                  onTouchStart={() => setSelectedId(`photo-${photo.id}`)}
                  style={{
                    width: '100%', height: '100%', position: 'relative',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transform: `rotate(${rotations[`photo-${photo.id}`] || 0}deg)`,
                  }}
                >
                  {isSelected && (
                    <div
                      className="dl-rotate-handle"
                      style={{ opacity: 1 }}
                      onMouseDown={e => { e.stopPropagation(); handleRotateStart(e, `photo-${photo.id}`, rotations[`photo-${photo.id}`] || 0); }}
                      onTouchStart={e => { e.stopPropagation(); handleRotateStart(e, `photo-${photo.id}`, rotations[`photo-${photo.id}`] || 0); }}
                      title="Rotate"
                    >↻</div>
                  )}
                  <div style={{ width: '100%', height: '100%', pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <StampPhoto src={`/${photo.file_path}`} alt={photo.original_name} />
                  </div>
                  <button
                    className="dl-canvas-delete"
                    style={{ opacity: isSelected ? 1 : 0 }}
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => { e.stopPropagation(); handleDeletePhoto(photo.id); }}
                  >×</button>
                </div>
              </Rnd>
            );
          })}

          {/* Prompt Answer */}
          {answerText && dailyPrompt && (
            <Rnd
              key="answer-rnd"
              cancel=".dl-rotate-handle, .dl-canvas-delete"
              size={{ width: answers[0]?.width || 260, height: answers[0]?.height || 120 }}
              position={{ x: answers[0]?.pos_x ?? 50, y: answers[0]?.pos_y ?? 300 }}
              onDragStop={(e, d) => {
                setAnswers(prev => {
                  const updated = [...prev];
                  if (!updated[0]) updated[0] = { pos_x: d.x, pos_y: d.y, width: 260, height: 120 };
                  else updated[0] = { ...updated[0], pos_x: d.x, pos_y: d.y };
                  return updated;
                });
                setSaved(false);
              }}
              onResizeStop={(e, direction, ref, delta, position) => {
                setAnswers(prev => {
                  const updated = [...prev];
                  const entry   = updated[0] || {};
                  updated[0] = {
                    ...entry,
                    pos_x: position.x,
                    pos_y: position.y,
                    width: parseInt(ref.style.width),
                    height: parseInt(ref.style.height),
                  };
                  return updated;
                });
                setSaved(false);
              }}
              bounds="parent"
              enableResizing={ENABLE_CORNERS}
              resizeHandleStyles={RND_HANDLE_STYLES}
              resizeHandleComponent={selectedId === 'answer-0' ? undefined : {
                topLeft: <div style={{ display: 'none' }} />,
                topRight: <div style={{ display: 'none' }} />,
                bottomLeft: <div style={{ display: 'none' }} />,
                bottomRight: <div style={{ display: 'none' }} />,
              }}
              minWidth={150}
              minHeight={60}
              style={{ cursor: selectedId === 'answer-0' ? 'grab' : 'pointer' }}
            >
              {/* FIX: answer-rnd uses rndWrapperRefs too so rotation works consistently */}
              <div
                ref={el => setRndRef('answer-0', el)}
                className="dl-rnd-item dl-rnd-answer"
                onMouseDown={() => setSelectedId('answer-0')}
                onTouchStart={() => setSelectedId('answer-0')}
                style={{
                  width: '100%', height: '100%', position: 'relative',
                  display: 'flex', flexDirection: 'column',
                  gap: '0.35rem', padding: '0.5rem 0.75rem', boxSizing: 'border-box',
                  transform: `rotate(${rotations['answer-0'] || 0}deg)`,
                }}
              >
                {selectedId === 'answer-0' && (
                  <div
                    className="dl-rotate-handle"
                    style={{ opacity: 1 }}
                    onMouseDown={e => {
                      e.stopPropagation();
                      // FIX: use the same handleRotateStart signature — no 4th arg
                      handleRotateStart(e, 'answer-0', rotations['answer-0'] || 0);
                    }}
                    onTouchStart={e => {
                      e.stopPropagation();
                      handleRotateStart(e, 'answer-0', rotations['answer-0'] || 0);
                    }}
                    title="Rotate"
                  >↻</div>
                )}
                <div className="dl-canvas-answer-label" style={{ pointerEvents: 'none', flexShrink: 0 }}>
                  {dailyPrompt.prompt_text}
                </div>
                {/* FIX: blue washi background (matches DayLog canvas colour) */}
                <div className="dl-canvas-washi" style={{ flex: 1, overflow: 'visible', pointerEvents: 'none' }}>
                  <span className="dl-canvas-answer-text">{answerText}</span>
                </div>
              </div>
            </Rnd>
          )}

          {/* Stickers */}
          {stickers.map((sticker, i) => {
            const isSelected = selectedId === `sticker-${sticker.id}`;
            return (
              <Rnd
                key={sticker.id}
                cancel=".dl-rotate-handle, .dl-canvas-delete"
                size={{ width: sticker.width || 100, height: sticker.height || 100 }}
                position={{ x: sticker.pos_x || 200, y: sticker.pos_y || 100 }}
                onDragStop={(e, d) => {
                  setStickers(prev => prev.map((s, idx) => idx === i ? { ...s, pos_x: d.x, pos_y: d.y } : s));
                  setSaved(false);
                }}
                onResizeStop={(e, direction, ref, delta, position) => {
                  setStickers(prev => prev.map((s, idx) => idx === i ? {
                    ...s,
                    width: parseInt(ref.style.width),
                    height: parseInt(ref.style.height),
                    pos_x: position.x,
                    pos_y: position.y,
                  } : s));
                  setSaved(false);
                }}
                bounds="parent"
                enableResizing={ENABLE_CORNERS}
                resizeHandleStyles={RND_HANDLE_STYLES}
                resizeHandleComponent={isSelected ? undefined : {
                  topLeft: <div style={{ display: 'none' }} />,
                  topRight: <div style={{ display: 'none' }} />,
                  bottomLeft: <div style={{ display: 'none' }} />,
                  bottomRight: <div style={{ display: 'none' }} />,
                }}
                minWidth={40}
                minHeight={40}
                style={{ cursor: isSelected ? 'grab' : 'pointer' }}
              >
                <div
                  ref={el => setRndRef(`sticker-${sticker.id}`, el)}
                  className="dl-rnd-item"
                  onMouseDown={() => setSelectedId(`sticker-${sticker.id}`)}
                  onTouchStart={() => setSelectedId(`sticker-${sticker.id}`)}
                  style={{
                    width: '100%', height: '100%', position: 'relative',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transform: `rotate(${rotations[`sticker-${sticker.id}`] || 0}deg)`,
                  }}
                >
                  {isSelected && (
                    <div
                      className="dl-rotate-handle"
                      style={{ opacity: 1 }}
                      onMouseDown={e => {
                        e.stopPropagation();
                        // FIX: consistent 3-arg call
                        handleRotateStart(e, `sticker-${sticker.id}`, rotations[`sticker-${sticker.id}`] || 0);
                      }}
                      onTouchStart={e => {
                        e.stopPropagation();
                        handleRotateStart(e, `sticker-${sticker.id}`, rotations[`sticker-${sticker.id}`] || 0);
                      }}
                      title="Rotate"
                    >↻</div>
                  )}
                  <img src={`/${sticker.asset_path}`} alt={sticker.asset_name}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }}
                    onError={e => { e.target.style.display = 'none'; }} />
                  <button className="dl-canvas-delete" style={{ opacity: isSelected ? 1 : 0, pointerEvents: isSelected ? 'auto' : 'none' }}
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => { e.stopPropagation(); handleDeleteSticker(sticker.id); }}>×</button>
                </div>
              </Rnd>
            );
          })}

          {/* Emoji Stickers */}
          {emojiNotes.map((note) => {
            const isSelected = selectedId === `note-${note.id}`;
            const isNew      = newlyPlacedNoteId === note.id;
            const emoji      = note.content.replace('EMOJI:', '');
            return (
              <Rnd
                key={note.id}
                cancel=".dl-rotate-handle, .dl-canvas-delete"
                size={{ width: note.width || 80, height: note.height || 80 }}
                position={{ x: note.pos_x || 100, y: note.pos_y || 100 }}
                onDragStop={(e, d) => {
                  setNotes(prev => prev.map(n => n.id === note.id ? { ...n, pos_x: d.x, pos_y: d.y } : n));
                  setSaved(false);
                }}
                onResizeStop={(e, direction, ref, delta, position) => {
                  setNotes(prev => prev.map(n => n.id === note.id ? {
                    ...n,
                    width: parseInt(ref.style.width),
                    height: parseInt(ref.style.height),
                    pos_x: position.x,
                    pos_y: position.y,
                  } : n));
                  setSaved(false);
                }}
                bounds="parent"
                enableResizing={ENABLE_CORNERS}
                resizeHandleStyles={RND_HANDLE_STYLES}
                resizeHandleComponent={isSelected ? undefined : {
                  topLeft: <div style={{ display: 'none' }} />,
                  topRight: <div style={{ display: 'none' }} />,
                  bottomLeft: <div style={{ display: 'none' }} />,
                  bottomRight: <div style={{ display: 'none' }} />,
                }}
                minWidth={40}
                minHeight={40}
                style={{ cursor: isSelected ? 'grab' : 'pointer' }}
              >
                <div
                  ref={el => setRndRef(`note-${note.id}`, el)}
                  className={`dl-rnd-item dl-emoji-note${isNew ? ' dl-emoji-note--new' : ''}`}
                  onMouseDown={() => setSelectedId(`note-${note.id}`)}
                  onTouchStart={() => setSelectedId(`note-${note.id}`)}
                  style={{
                    width: '100%', height: '100%', position: 'relative',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transform: `rotate(${rotations[`note-${note.id}`] || 0}deg)`,
                    fontSize: note.font_size || 48,
                    userSelect: 'none',
                    lineHeight: 1,
                  }}
                >
                  {isSelected && (
                    <div
                      className="dl-rotate-handle"
                      style={{ opacity: 1 }}
                      onMouseDown={e => {
                        e.stopPropagation();
                        // FIX: consistent 3-arg call
                        handleRotateStart(e, `note-${note.id}`, rotations[`note-${note.id}`] || 0);
                      }}
                      onTouchStart={e => {
                        e.stopPropagation();
                        handleRotateStart(e, `note-${note.id}`, rotations[`note-${note.id}`] || 0);
                      }}
                      title="Rotate"
                    >↻</div>
                  )}
                  <span style={{ pointerEvents: 'none' }}>{emoji}</span>
                  <button
                    className="dl-canvas-delete"
                    style={{ opacity: isSelected ? 1 : 0, pointerEvents: isSelected ? 'auto' : 'none' }}
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => { e.stopPropagation(); handleDeleteEmojiNote(note.id); }}
                  >×</button>
                </div>
              </Rnd>
            );
          })}

          {/* Empty state */}
          {photos.length === 0 && videos.length === 0 && audios.length === 0 && stickers.length === 0 && emojiNotes.length === 0 && !answerText && (
            <div className="dl-canvas-empty">
              <p>Your canvas is empty — add photos, videos, audio, answer the prompt, or place stickers!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}