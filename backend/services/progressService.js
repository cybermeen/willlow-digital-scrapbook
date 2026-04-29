const db = require('../db/db');

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const ProgressService = {

  async calculateDailyProgress(userId) {
    console.log('calculateDailyProgress called for user:', userId);
    const todayStr = localToday();
    console.log('todayStr:', todayStr);

    try {
      const { rows } = await db.query(
        `SELECT
          COUNT(*) FILTER (WHERE (due_date AT TIME ZONE 'Asia/Karachi')::date = $2 AND status = 'completed') AS completed_tasks,
          COUNT(*) FILTER (WHERE (due_date AT TIME ZONE 'Asia/Karachi')::date = $2) AS total_tasks
         FROM tasks WHERE user_id = $1`,
        [userId, todayStr]
      );
      console.log('query result:', rows);

      const completedTasks = parseInt(rows[0].completed_tasks) || 0;
      const totalTasks     = parseInt(rows[0].total_tasks)     || 0;
      const completionPercentage = totalTasks > 0
        ? Math.round((completedTasks / totalTasks) * 100)
        : 0;

      await db.query(
        `INSERT INTO daily_progress (user_id, date, completed_tasks, total_tasks, completion_percentage, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (user_id, date)
         DO UPDATE SET
           completed_tasks       = $3,
           total_tasks           = $4,
           completion_percentage = $5,
           updated_at            = NOW()`,
        [userId, todayStr, completedTasks, totalTasks, completionPercentage]
      );

      return { completedTasks, totalTasks, completionPercentage };
    } catch (err) {
      console.error('calculateDailyProgress ERROR:', err.message);
    }
  },

  async calculateStreak(userId) {
    try {
      const { rows } = await db.query(
        `SELECT TO_CHAR(date, 'YYYY-MM-DD') AS date
        FROM daily_progress
        WHERE user_id = $1
          AND completion_percentage = 100
          AND total_tasks > 0
        ORDER BY date DESC`,
        [userId]
      );

      // Work with plain date strings - no Date objects, no timezone issues
      const localToday = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      };

      const subtractDays = (dateStr, n) => {
        const d = new Date(dateStr + 'T12:00:00'); // noon avoids DST issues
        d.setDate(d.getDate() - n);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      };

      const todayStr = localToday();
      let currentStreak = 0;

      for (let i = 0; i < rows.length; i++) {
        const expected = subtractDays(todayStr, i);
        if (rows[i].date === expected) {
          currentStreak++;
        } else {
          break;
        }
      }

      // Longest streak using same string comparison
      const { rows: allRows } = await db.query(
        `SELECT TO_CHAR(date, 'YYYY-MM-DD') AS date
        FROM daily_progress
        WHERE user_id = $1
          AND completion_percentage = 100
          AND total_tasks > 0
        ORDER BY date ASC`,
        [userId]
      );

      let longestStreak = 0;
      let runningStreak = 0;

      for (let i = 0; i < allRows.length; i++) {
        if (i === 0) {
          runningStreak = 1;
        } else {
          const prev = allRows[i - 1].date;
          const curr = allRows[i].date;
          const prevDate = new Date(prev + 'T12:00:00');
          const currDate = new Date(curr + 'T12:00:00');
          const diffDays = Math.round((currDate - prevDate) / (1000 * 60 * 60 * 24));
          runningStreak = diffDays === 1 ? runningStreak + 1 : 1;
        }
        longestStreak = Math.max(longestStreak, runningStreak);
      }

      await db.query(
        `UPDATE users SET streak = $1, longest_streak = $2 WHERE user_id = $3`,
        [currentStreak, longestStreak, userId]
      );

      return { currentStreak, longestStreak };
    } catch (err) {
      console.error('calculateStreak ERROR:', err.message);
    }
  },

  async getDashboardStats(userId) {
    // Always recalculate streak live — never read the stale cached value
    // from the users table, which only updates when calculateStreak() is called.
    const { currentStreak, longestStreak } = await this.calculateStreak(userId);

    const todayStr = localToday();

    const { rows: todayRows } = await db.query(
      `SELECT
        COUNT(*) FILTER (WHERE (due_date AT TIME ZONE 'Asia/Karachi')::date = $2 AND status = 'completed') AS completed_tasks,
        COUNT(*) FILTER (WHERE (due_date AT TIME ZONE 'Asia/Karachi')::date = $2) AS total_tasks
       FROM tasks WHERE user_id = $1`,
      [userId, todayStr]
    );

    const completedToday = parseInt(todayRows[0].completed_tasks) || 0;
    const totalToday     = parseInt(todayRows[0].total_tasks)     || 0;
    const completionPercentage = totalToday > 0
      ? Math.round((completedToday / totalToday) * 100)
      : 0;

    const { rows: avgRows } = await db.query(
      `SELECT COALESCE(ROUND(AVG(completion_percentage)), 0) AS average_completion
       FROM daily_progress WHERE user_id = $1`,
      [userId]
    );

    return {
      today: {
        completed_tasks:    completedToday,
        total_tasks:        totalToday,
        completionPercentage,
      },
      overall: {
        averageCompletion: parseInt(avgRows[0].average_completion) || 0,
        currentStreak,
        longestStreak,
      }
    };
  },

  async getProgressHistory(userId, days = 7) {
    const { rows } = await db.query(
      `SELECT
         TO_CHAR(date, 'YYYY-MM-DD') AS date,
         completed_tasks,
         total_tasks,
         completion_percentage
       FROM daily_progress
       WHERE user_id = $1
         AND date >= CURRENT_DATE - INTERVAL '${days} days'
       ORDER BY date ASC`,
      [userId]
    );

    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const found = rows.find(r => r.date === dateStr);
      result.push(found || {
        date:                  dateStr,
        completed_tasks:       0,
        total_tasks:           0,
        completion_percentage: 0,
      });
    }

    return result;
  }
};

module.exports = ProgressService;