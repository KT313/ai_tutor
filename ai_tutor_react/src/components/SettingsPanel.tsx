import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  DEFAULT_MODELS,
  GOOGLE_MODELS,
  OPENROUTER_MODELS,
} from '../context/AppContext';
import type { Provider } from '../lib/types';

interface Props {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: Props) {
  const {
    provider, setProvider,
    apiKey, setApiKey,
    tutorModel, setTutorModel,
    optionalInstruction, setOptionalInstruction,
    locale,
  } = useApp();
  const ui = locale.ui;

  const [keyDraft, setKeyDraft] = useState(apiKey);
  const [modelDraft, setModelDraft] = useState(tutorModel);
  const [savedFlash, setSavedFlash] = useState(false);

  // Sync drafts when provider changes (context re-renders with the new provider's key/model)
  useEffect(() => {
    setKeyDraft(apiKey);
  }, [apiKey]);

  useEffect(() => {
    setModelDraft(tutorModel);
  }, [tutorModel]);

  const handleProviderChange = (p: Provider) => {
    setProvider(p);
  };

  const saveKey = () => {
    setApiKey(keyDraft.trim());
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1500);
  };

  // Model dropdown logic
  const presets = provider === 'google' ? GOOGLE_MODELS : OPENROUTER_MODELS;
  const isPreset = presets.some((m) => m.id === modelDraft);
  const selectValue = isPreset ? modelDraft : 'custom';

  const handleModelSelect = (value: string) => {
    if (value === 'custom') {
      // Switch to custom input, keep current value if already custom
      if (isPreset) setModelDraft('');
      return;
    }
    setModelDraft(value);
    // Auto-save preset selection
    setTutorModel(value === DEFAULT_MODELS[provider] ? '' : value);
  };

  const saveCustomModel = () => {
    const trimmed = modelDraft.trim();
    if (!trimmed) {
      // Reset to default
      setModelDraft(DEFAULT_MODELS[provider]);
      setTutorModel('');
    } else {
      setTutorModel(trimmed === DEFAULT_MODELS[provider] ? '' : trimmed);
    }
  };

  return (
    <div className="mx-auto max-w-2xl rounded-xl border border-surface-cardBorder bg-white p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold text-brand">{ui.settingsTitle}</h3>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer border-0 bg-transparent text-xl font-bold text-[#aaa] transition-colors hover:text-[#333]"
          aria-label="Close"
        >
          &times;
        </button>
      </div>

      {/* Provider selection */}
      <div className="mb-4">
        <label className="mb-1 block text-sm font-semibold text-[#495057]">
          {ui.providerLabel}
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleProviderChange('google')}
            className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              provider === 'google'
                ? 'border border-brand bg-brand text-white'
                : 'border border-[#ced4da] bg-white text-[#495057] hover:bg-gray-50'
            }`}
          >
            Google Gemini
          </button>
          <button
            type="button"
            onClick={() => handleProviderChange('openrouter')}
            className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              provider === 'openrouter'
                ? 'border border-brand bg-brand text-white'
                : 'border border-[#ced4da] bg-white text-[#495057] hover:bg-gray-50'
            }`}
          >
            OpenRouter
          </button>
        </div>
      </div>

      {/* API key */}
      <div className="mb-4">
        <label htmlFor="settings-api-key" className="mb-1 block text-sm font-semibold text-[#495057]">
          {provider === 'openrouter' ? ui.openrouterKeyLabel : ui.apiKeyLabel}
        </label>
        <div className="flex gap-2">
          <input
            id="settings-api-key"
            type="password"
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveKey(); }}
            placeholder={provider === 'openrouter' ? ui.openrouterKeyPlaceholder : ui.apiKeyPlaceholder}
            className="min-w-0 flex-1 rounded-lg border border-[#ced4da] px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={saveKey}
            className="cursor-pointer rounded-lg border-0 bg-brand px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-dark"
          >
            {ui.apiKeySave}
          </button>
          <span
            className={`flex items-center text-sm font-medium text-accent-green transition-opacity duration-500 ${savedFlash ? 'opacity-100' : 'opacity-0'}`}
          >
            {ui.apiKeySaved}
          </span>
        </div>
      </div>

      {/* Model */}
      <div className="mb-4">
        <label htmlFor="settings-model-select" className="mb-1 block text-sm font-semibold text-[#495057]">
          {ui.tutorModelLabel}
        </label>
        <select
          id="settings-model-select"
          value={selectValue}
          onChange={(e) => handleModelSelect(e.target.value)}
          className="w-full rounded-lg border border-[#ced4da] px-3 py-2 text-sm"
        >
          {presets.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label} ({m.id})
            </option>
          ))}
          <option value="custom">{ui.modelCustom}</option>
        </select>
        {selectValue === 'custom' && (
          <input
            type="text"
            value={modelDraft}
            onChange={(e) => setModelDraft(e.target.value)}
            onBlur={saveCustomModel}
            onKeyDown={(e) => { if (e.key === 'Enter') saveCustomModel(); }}
            placeholder={ui.modelCustomPlaceholder}
            className="mt-2 w-full rounded-lg border border-[#ced4da] px-3 py-2 text-sm"
            autoFocus
          />
        )}
      </div>

      {/* All-at-once toggle */}
      <label className="flex cursor-pointer items-center gap-2 select-none">
        <span className="relative inline-block h-[26px] w-[50px]">
          <input
            type="checkbox"
            className="peer h-0 w-0 opacity-0"
            checked={optionalInstruction}
            onChange={(e) => setOptionalInstruction(e.target.checked)}
          />
          <span className="absolute inset-0 cursor-pointer rounded-[26px] bg-[#ccc] transition duration-300 peer-checked:bg-brand" />
          <span className="pointer-events-none absolute bottom-1 left-1 h-[18px] w-[18px] rounded-full bg-white transition duration-300 peer-checked:translate-x-6" />
        </span>
        <span className="text-sm font-semibold text-[#495057]">{ui.allAtOnce}</span>
      </label>
    </div>
  );
}
