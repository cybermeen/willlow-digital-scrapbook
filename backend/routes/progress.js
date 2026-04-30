const express = require('express');
const router = express.Router();
const ProgressService = require('../services/progressService');
const auth = require('../auth/auth');

router.use(auth);

// GET /api/progress/stats — dashboard stats
router.get('/stats', async (req, res) => {
  try {
    const stats = await ProgressService.getDashboardStats(req.session.userId);
    res.json(stats);
  } catch (err) {
    console.error('Progress stats error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/progress/history?days=7 — last N days of history
router.get('/history', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const history = await ProgressService.getProgressHistory(req.session.userId, days);
    res.json(history);
  } catch (err) {
    console.error('Progress history error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/progress/streak — current streak + reward unlock status
router.get('/streak', async (req, res) => {
  try {
    const { currentStreak, longestStreak } = await ProgressService.calculateStreak(req.session.userId);
    const MILESTONE = 7;
 
    // Rewards unlock when the user has EVER hit 7 days (longest) OR currently on a 7-day streak
    const rewardsUnlocked = (longestStreak >= MILESTONE) || (currentStreak >= MILESTONE);
 
    // Days until next milestone
    const daysUntilUnlock = rewardsUnlocked ? 0 : MILESTONE - currentStreak;
 
    res.json({
      currentStreak:   currentStreak  || 0,
      longestStreak:   longestStreak  || 0,
      rewardsUnlocked,
      milestone:       MILESTONE,
      daysUntilUnlock,
    });
  } catch (err) {
    console.error('Streak error:', err);
    res.status(500).json({ error: err.message });
  }
});
 
module.exports = router;