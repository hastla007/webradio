import React from 'react';
import { View } from '../App';
import {
  HomeIcon,
  RadioIcon,
  TagIcon,
  ExportIcon,
  PulseIcon,
  DeviceIcon,
  HeadphonesIcon,
  LogsIcon,
  SettingsIcon,
  SunIcon,
  MoonIcon,
  AnalyticsIcon,
} from './Icons';
import { useTheme } from './ThemeProvider';

interface SidebarProps {
  currentView: View;
  onNavigate: (view: View) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate }) => {
  const { isDark, toggle } = useTheme();
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <HomeIcon /> },
    { id: 'stations', label: 'Stations', icon: <RadioIcon /> },
    { id: 'genres', label: 'Genres', icon: <TagIcon /> },
    { id: 'export', label: 'Export', icon: <ExportIcon /> },
    { id: 'listen', label: 'Listen', icon: <HeadphonesIcon /> },
    { id: 'players', label: 'Apps / Players', icon: <DeviceIcon /> },
    { id: 'monitoring', label: 'Monitoring', icon: <PulseIcon /> },
    { id: 'analytics', label: 'Analytics', icon: <AnalyticsIcon /> },
    { id: 'logs', label: 'Logs', icon: <LogsIcon /> },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon /> },
  ];

  return (
    <div className="w-64 bg-brand-surface dark:bg-dark-surface border-r border-brand-border dark:border-dark-border h-screen flex flex-col p-4 text-brand-dark dark:text-dark-text">
      <div className="flex items-center justify-start mb-10 gap-3">
        <div className="bg-brand-dark p-2 rounded-lg">
           <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 6a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm0 7a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2z"></path>
            </svg>
        </div>
        <div className="flex flex-col leading-[0.85]">
          <div className="text-3xl font-bold text-brand-dark dark:text-dark-text uppercase tracking-tight">WEBRADIO</div>
          <div className="text-[1.3rem] font-semibold text-brand-primary self-center -mt-1">Admin Panel</div>
        </div>
      </div>
      <nav>
        <ul className="space-y-1">
          {navItems.map(item => (
            <li key={item.id}>
              <button
                onClick={() => onNavigate(item.id as View)}
                className={`w-full text-left px-4 py-2.5 rounded-lg flex items-center transition-colors ${
                  currentView === item.id
                    ? 'bg-brand-primary text-brand-dark font-semibold dark:bg-brand-primary/80 dark:text-gray-900'
                    : 'text-brand-text-light dark:text-dark-text-light hover:bg-gray-100 dark:hover:bg-white/10'
                }`}
              >
                <span className="mr-3">{item.icon}</span>
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-8">
        <button
          type="button"
          onClick={toggle}
          aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
          className="w-full border border-brand-border dark:border-dark-border rounded-lg px-4 py-2.5 flex items-center justify-between text-sm font-semibold transition-colors hover:bg-gray-100 dark:hover:bg-white/10"
        >
          <span className="flex items-center gap-3">
            {isDark ? <MoonIcon /> : <SunIcon />}
            <span>{isDark ? 'Dark mode' : 'Light mode'}</span>
          </span>
          <span className="text-xs text-brand-text-light dark:text-dark-text-light">Tap to switch</span>
        </button>
      </div>

      <div className="mt-auto bg-brand-dark text-white p-4 rounded-lg text-center dark:bg-brand-primary/20 dark:text-dark-text">
        <div className="w-10 h-10 bg-brand-primary rounded-full flex items-center justify-center mx-auto mb-3">
          <span className="font-bold text-brand-dark text-xl">?</span>
        </div>
        <h3 className="font-semibold">Help Center</h3>
        <p className="text-xs text-gray-300 mt-1 dark:text-dark-text-light">Have a problem? Send us a message.</p>
        <button className="mt-4 w-full bg-white text-brand-dark font-semibold py-2 rounded-lg text-sm hover:bg-gray-200 transition-colors dark:bg-transparent dark:border dark:border-brand-primary dark:text-dark-text dark:hover:bg-brand-primary/20">
          Go to help center
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
