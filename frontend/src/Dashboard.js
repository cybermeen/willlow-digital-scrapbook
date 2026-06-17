import React, { useState, useEffect } from 'react';
import ToDo from './ToDo';
import Progress from './Progress';
import DayLog from './DayLog';
import Scrapbook from './Scrapbook';
import './Dashboard.css';

const BACKEND_URL = 'http://localhost:5000';

function Dashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('today');

  // Streak state — used for nav dot indicator
  const [streak, setStreak] = useState({ currentStreak: 0, rewardsUnlocked: false });
  const [lastUpdated, setLastUpdated] = useState(Date.now());

  // claimingReward: true when the user clicked "Claim Reward" in ToDo
  // and we've navigated them to the DayLog tab
  const [claimingReward, setClaimingReward] = useState(false);

  const [testMode, setTestMode] = useState(false);
  useEffect(() => {
    refreshStreak();
  }, []);

  const refreshStreak = () => {
    fetch('/api/progress/streak', { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) setStreak(data);
        setLastUpdated(Date.now());
      })
      .catch(err => console.error('Streak fetch failed:', err));
  };

  // Called when user clicks "Claim Your Reward" inside the celebration modal
  const handleClaimReward = () => {
    setClaimingReward(true);
    setActiveTab('daylog');
  };

  // Called by DayLog once the user has actually clicked a sticker to unlock
  const handleRewardClaimed = () => {
    setClaimingReward(false);
    refreshStreak();
  };

  const handleTestModeChange = (isTest) => {
    setTestMode(isTest);
  };

  const navItems = [
    { id: 'daylog',    label: 'Day Log' },
    { id: 'today',     label: 'Today' },
    { id: 'todo',      label: 'To-Do' },
    { id: 'scrapbook', label: 'Scrapbook' },
  ];

  const initials = user?.displayName
    ? user.displayName.charAt(0).toUpperCase()
    : user?.email?.charAt(0).toUpperCase() || '?';

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="dashboard-logo">
          <img
            src={`${BACKEND_URL}/assets/logo/logo.png`}
            alt="Willow logo"
            className="dashboard-logo-img"
          />
          <span className="dashboard-logo-name">Willow</span>
        </div>

        <nav className="dashboard-nav">
          {navItems.map(item => (
            <button
              key={item.id}
              className={[
                'nav-btn',
                activeTab === item.id ? 'nav-btn--active' : '',
                item.id === 'daylog' && streak.rewardsUnlocked ? 'nav-btn--reward' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => {
                // If leaving daylog while claiming, cancel the claim flow
                if (activeTab === 'daylog' && item.id !== 'daylog') {
                  setClaimingReward(false);
                }
                setActiveTab(item.id);
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="dashboard-user">
          <div className="user-avatar" title={user?.displayName || user?.email}>
            {initials}
          </div>
          <button className="btn-logout" onClick={onLogout}>Log Out</button>
        </div>
      </header>

      <main className="dashboard-main">
        {activeTab === 'today' && (
          <Progress lastUpdated={lastUpdated} />
        )}

        {activeTab === 'todo' && (
          <ToDo
            user={user}
            lastUpdated={lastUpdated}
            onTaskChange={refreshStreak}
            onClaimReward={handleClaimReward}
            onTestModeChange={handleTestModeChange}  
          />
        )}

        {activeTab === 'daylog' && (
          <DayLog
            user={user}
            streak={streak}
            claimingReward={claimingReward}
            onRewardClaimed={handleRewardClaimed}
            goToTab={setActiveTab}
            forceRewardsUnlocked={testMode}
          />
        )}

        {activeTab === 'scrapbook' && (
          <Scrapbook user={user} />
        )}
      </main>
    </div>
  );
}

export default Dashboard;