const express = require('express');
const router = express.Router();
const ctrl = require('../services/scrapbookService');
const auth = require('../auth/auth');
const { upload, videoUpload, audioUpload } = require('../uploads/upload');

router.use(auth);

// ── Day Log ───────────────────────────────────────────────────────────────────
router.get('/logs/:date',  ctrl.getOrCreateLog);
router.get('/logs',        ctrl.getAllLogs);
router.patch('/logs/:logId', ctrl.updateLog);

// ── Photos ────────────────────────────────────────────────────────────────────
router.post('/photos/:logId',       upload.single('photo'), ctrl.uploadPhoto);
router.patch('/photos/:photoId',    ctrl.updatePhoto);
router.delete('/photos/:photoId',   ctrl.deletePhoto);

// ── Videos ───────────────────────────────────────────────────────────────────
router.post('/videos/:logId',       videoUpload.single('video'), ctrl.uploadVideo);
router.delete('/videos/:videoId',   ctrl.deleteVideo);

// ── Audio ─────────────────────────────────────────────────────────────────────
router.post('/audio/:logId',        audioUpload.single('audio'), ctrl.uploadAudio);
router.delete('/audio/:audioId',    ctrl.deleteAudio);

// ── Notes ─────────────────────────────────────────────────────────────────────
router.post('/notes/:logId',        ctrl.createNote);
router.patch('/notes/:noteId',      ctrl.updateNote);
router.delete('/notes/:noteId',     ctrl.deleteNote);

// ── Prompts ───────────────────────────────────────────────────────────────────
router.get('/prompts/daily',                    ctrl.getDailyPrompt);
router.post('/prompts/answer/:logId',           ctrl.savePromptAnswer);
router.patch('/prompts/answer/:answerId',       ctrl.updatePromptAnswer);
router.delete('/prompts/answer/:answerId',      ctrl.deletePromptAnswer); 

// ── Stickers ──────────────────────────────────────────────────────────────────
router.get('/assets',                   ctrl.getArtAssets);
router.post('/stickers/:logId',         ctrl.placeSticker);
router.patch('/stickers/:stickerId',    ctrl.updateSticker);
router.delete('/stickers/:stickerId',   ctrl.deleteSticker);

// ── Layout ────────────────────────────────────────────────────────────────────
router.post('/layout/:logId',                       ctrl.saveLayout);
router.post('/logs/:logId/unlock-achievement',      ctrl.unlockAchievement);

module.exports = router;
