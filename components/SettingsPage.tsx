import React, { useEffect, useState } from 'react';
import { MonitoringSettings } from '../types';
import { ClockIcon, PulseIcon } from './Icons';

interface SettingsPageProps {
  monitoringSettings: MonitoringSettings;
  onUpdateMonitoring: (settings: MonitoringSettings) => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ monitoringSettings, onUpdateMonitoring }) => {
  const [localSettings, setLocalSettings] = useState<MonitoringSettings>(monitoringSettings);

  useEffect(() => {
    setLocalSettings(monitoringSettings);
  }, [monitoringSettings]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, type, checked, value } = event.target;
    setLocalSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : Number(value),
    }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onUpdateMonitoring(localSettings);
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-4xl font-bold text-brand-dark">Settings</h1>
        <p className="text-brand-text-light max-w-3xl">
          Configure global application behaviours such as stream monitoring cadence and alerting thresholds. These values apply
          everywhere the monitoring simulator is used, including the Monitoring dashboard.
        </p>
      </header>

      <section className="bg-brand-surface border border-brand-border rounded-2xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-brand-primary/20 text-brand-dark flex items-center justify-center">
            <PulseIcon />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-brand-dark">Stream monitoring defaults</h2>
            <p className="text-sm text-brand-text-light">
              Define how often streams are probed and how many failures trigger an incident.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <label className="block">
            <span className="flex items-center text-sm font-medium text-brand-text-light gap-2">
              <ClockIcon />
              Check Interval (minutes)
            </span>
            <input
              type="number"
              name="interval"
              min={1}
              value={localSettings.interval}
              onChange={handleChange}
              className="mt-2 w-full px-3 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-brand-text-light">Failure Threshold</span>
            <input
              type="number"
              name="threshold"
              min={1}
              value={localSettings.threshold}
              onChange={handleChange}
              className="mt-2 w-full px-3 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </label>

          <label className="flex items-center gap-3 text-sm font-medium text-brand-text-light">
            <input
              type="checkbox"
              name="enabled"
              checked={localSettings.enabled}
              onChange={handleChange}
              className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
            />
            Monitoring enabled
          </label>

          <div className="md:col-span-3 flex items-center justify-between bg-brand-background/60 border border-dashed border-brand-border rounded-xl px-4 py-3 text-sm text-brand-text-light gap-4 flex-col md:flex-row">
            <span className="text-center md:text-left">
              Current configuration checks all active stations every {localSettings.interval} minutes and raises an alert after{' '}
              {localSettings.threshold} consecutive failures.
            </span>
            <button
              type="submit"
              className="px-4 py-2 bg-brand-dark text-white rounded-lg font-semibold hover:bg-gray-800 transition-colors"
            >
              Save changes
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};

export default SettingsPage;
