import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { uiStrings } from '../lib/tutorPrompts';

export function ApiKeyBar() {
  const { apiKey, setApiKey, optionalInstruction, setOptionalInstruction } = useApp();
  const [draft, setDraft] = useState(apiKey);
  const [savedFlash, setSavedFlash] = useState(false);

  const save = () => {
    setApiKey(draft.trim());
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1500);
  };

  return (
    <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl bg-[#e9ecef] p-4">
      <label htmlFor="api-key-input" className="font-semibold text-[#495057]">
        {uiStrings.apiKeyLabel}
      </label>
      <input
        id="api-key-input"
        type="password"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
        }}
        placeholder={uiStrings.apiKeyPlaceholder}
        className="flex-grow rounded-lg border border-[#ced4da] px-3 py-2 text-[10pt]"
      />
      <button
        type="button"
        onClick={save}
        className="cursor-pointer rounded-lg border-0 bg-brand px-4 py-2 font-bold text-white transition-colors hover:bg-brand-dark"
      >
        {uiStrings.apiKeySave}
      </button>
      <span
        className={`font-medium text-accent-green transition-opacity duration-500 ${savedFlash ? 'opacity-100' : 'opacity-0'}`}
      >
        {uiStrings.apiKeySaved}
      </span>
      <label className="ml-auto flex cursor-pointer items-center gap-2 select-none">
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
        <span className="font-semibold text-[#495057]">{uiStrings.allAtOnce}</span>
      </label>
    </div>
  );
}
