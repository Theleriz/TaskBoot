import { DataSettings } from './DataSettings.tsx';
import { ThemeSettings } from './ThemeSettings.tsx';

/** Settings tab (the gear in the top-right corner). */
export function SettingsView() {
  return (
    <div className="settings">
      <h1 className="settings-title">Настройки</h1>
      <ThemeSettings />
      <DataSettings />
    </div>
  );
}
