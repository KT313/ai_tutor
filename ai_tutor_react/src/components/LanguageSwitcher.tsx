import { useApp } from '../context/AppContext';
import { supportedLocales, type LocaleKey } from '../lib/i18n';

export function LanguageSwitcher() {
  const { uiLanguage, setUiLanguage, locale } = useApp();

  return (
    <label className="flex items-center gap-2 text-sm text-gray-600">
      {locale.ui.languageLabel}:
      <select
        value={uiLanguage}
        onChange={(e) => setUiLanguage(e.target.value as LocaleKey)}
        className="rounded border border-gray-300 bg-white px-2 py-1 text-sm"
      >
        {supportedLocales.map((l) => (
          <option key={l.key} value={l.key}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
