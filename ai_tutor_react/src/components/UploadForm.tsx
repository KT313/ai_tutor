import { useCallback, useRef, useState } from 'react';
import {
  useApp,
  DEFAULT_GENERATE_MODELS,
  GOOGLE_MODELS,
  OPENROUTER_MODELS,
} from '../context/AppContext';
import type { LocaleKey } from '../lib/i18n';
import { supportedLocales } from '../lib/i18n';

type Step =
  | 'idle'
  | 'uploading'
  | 'processing'
  | 'generating'
  | 'consolidating'
  | 'finalizing'
  | 'saving'
  | 'done'
  | 'error';

const STEP_ORDER: Step[] = [
  'uploading',
  'processing',
  'generating',
  'consolidating',
  'finalizing',
  'saving',
  'done',
];

function stepLabel(step: Step, ui: Record<string, string>): string {
  const map: Record<string, string> = {
    uploading: ui.generateStepUploading,
    processing: ui.generateStepProcessing,
    generating: ui.generateStepGenerating,
    consolidating: ui.generateStepConsolidating,
    finalizing: ui.generateStepFinalizing,
    saving: ui.generateStepSaving,
    done: ui.generateStepDone,
    error: ui.generateStepError,
  };
  return map[step] ?? step;
}

function GenerateModelSelect({
  provider,
  model,
  setModel,
  disabled,
  customLabel,
  customPlaceholder,
}: {
  provider: 'google' | 'openrouter';
  model: string;
  setModel: (m: string) => void;
  disabled: boolean;
  customLabel: string;
  customPlaceholder: string;
}) {
  const presets = provider === 'google' ? GOOGLE_MODELS : OPENROUTER_MODELS;
  const isPreset = presets.some((m) => m.id === model);
  const selectValue = isPreset ? model : 'custom';

  return (
    <>
      <select
        value={selectValue}
        onChange={(e) => {
          if (e.target.value === 'custom') setModel('');
          else setModel(e.target.value);
        }}
        disabled={disabled}
        className="w-full rounded-lg border border-[#ced4da] px-3 py-2 text-sm disabled:opacity-50"
      >
        {presets.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label} ({p.id})
          </option>
        ))}
        <option value="custom">{customLabel}</option>
      </select>
      {selectValue === 'custom' && (
        <input
          type="text"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          disabled={disabled}
          placeholder={customPlaceholder}
          className="mt-2 w-full rounded-lg border border-[#ced4da] px-3 py-2 text-sm disabled:opacity-50"
        />
      )}
    </>
  );
}

interface Props {
  onClose: () => void;
}

export function UploadForm({ onClose }: Props) {
  const { apiKey, provider, locale, uiLanguage } = useApp();
  const ui = locale.ui;

  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState<LocaleKey>(uiLanguage);
  const [model, setModel] = useState(DEFAULT_GENERATE_MODELS[provider]);
  const [files, setFiles] = useState<FileList | null>(null);
  const [step, setStep] = useState<Step>('idle');
  const [message, setMessage] = useState('');
  const [resultId, setResultId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const isRunning = step !== 'idle' && step !== 'done' && step !== 'error';

  const handleSubmit = useCallback(async () => {
    if (!files || files.length === 0) {
      setError(ui.generateNoPdfs);
      return;
    }
    if (!title.trim()) {
      setError(ui.generateNoTitle);
      return;
    }
    if (!apiKey) {
      setError(ui.generateNoApiKey);
      return;
    }

    setError(null);
    setStep('uploading');
    setMessage('');
    setResultId(null);

    const controller = new AbortController();
    abortRef.current = controller;

    const formData = new FormData();
    formData.append('title', title.trim());
    formData.append('language', language);
    formData.append('model', model);
    for (let i = 0; i < files.length; i++) {
      formData.append('pdf', files[i]);
    }

    try {
      const res = await fetch('/api/generate-content', {
        method: 'POST',
        headers: { 'X-API-Key': apiKey, 'X-Provider': provider },
        body: formData,
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `HTTP ${res.status}`);
      }

      // Read SSE stream from response body
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;

        // Split on double newline (SSE frame boundary)
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? ''; // last incomplete frame stays in buffer

        for (const frame of frames) {
          const dataLine = frame
            .split('\n')
            .find((l) => l.startsWith('data:'));
          if (!dataLine) continue;

          const json = dataLine.slice(5).trim();
          if (!json) continue;

          try {
            const event = JSON.parse(json) as {
              step: string;
              message: string;
              id?: string;
            };

            setStep(event.step as Step);
            setMessage(event.message);

            if (event.step === 'done' && event.id) {
              setResultId(event.id);
            }
            if (event.step === 'error') {
              setError(event.message);
            }
          } catch {
            // ignore malformed SSE
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') {
        setStep('idle');
        return;
      }
      setStep('error');
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      abortRef.current = null;
    }
  }, [files, title, language, model, apiKey, provider, ui]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setStep('idle');
  }, []);

  const openContent = useCallback(() => {
    if (!resultId) return;
    const url = new URL(window.location.href);
    url.searchParams.set('content', resultId);
    window.location.href = url.toString();
  }, [resultId]);

  // Progress bar
  const stepIndex = STEP_ORDER.indexOf(step);
  const progress = step === 'done' ? 100 : stepIndex >= 0 ? Math.round(((stepIndex + 0.5) / STEP_ORDER.length) * 100) : 0;

  return (
    <div className="mx-auto max-w-2xl rounded-xl border border-surface-cardBorder bg-white p-6 shadow-card">
      <h2 className="mb-4 text-xl font-bold text-brand">{ui.generateTitle}</h2>

      {/* Title input */}
      <label className="mb-1 block text-sm font-semibold text-[#495057]">
        {ui.generateTitleLabel}
      </label>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={ui.generateTitlePlaceholder}
        disabled={isRunning}
        className="mb-4 w-full rounded-lg border border-[#ced4da] px-3 py-2 text-sm disabled:opacity-50"
      />

      {/* PDF file picker */}
      <label className="mb-1 block text-sm font-semibold text-[#495057]">
        {ui.generateSelectPdfs}
      </label>
      <input
        type="file"
        accept="application/pdf"
        multiple
        onChange={(e) => setFiles(e.target.files)}
        disabled={isRunning}
        className="mb-4 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-4 file:py-2 file:font-bold file:text-white hover:file:bg-brand-dark disabled:opacity-50"
      />

      {/* Language + Model row */}
      <div className="mb-4 flex gap-4">
        <div className="flex-1">
          <label className="mb-1 block text-sm font-semibold text-[#495057]">
            {ui.languageLabel}
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as LocaleKey)}
            disabled={isRunning}
            className="w-full rounded-lg border border-[#ced4da] px-3 py-2 text-sm disabled:opacity-50"
          >
            {supportedLocales.map((l) => (
              <option key={l.key} value={l.key}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-sm font-semibold text-[#495057]">
            {ui.generateModelLabel}
          </label>
          <GenerateModelSelect
            provider={provider}
            model={model}
            setModel={setModel}
            disabled={isRunning}
            customLabel={ui.modelCustom}
            customPlaceholder={ui.modelCustomPlaceholder}
          />
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Progress */}
      {step !== 'idle' && step !== 'error' && (
        <div className="mb-4">
          <div className="mb-2 flex items-center gap-2">
            {step !== 'done' && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#f3f3f3] border-t-brand" />
            )}
            <span className="text-sm font-medium text-[#495057]">
              {stepLabel(step, ui)}
            </span>
          </div>
          {message && step !== 'done' && (
            <p className="mb-2 text-xs text-gray-500">{message}</p>
          )}
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-brand transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {step === 'idle' || step === 'error' ? (
          <>
            <button
              type="button"
              onClick={handleSubmit}
              className="cursor-pointer rounded-lg border-0 bg-brand px-5 py-2 font-bold text-white transition-colors hover:bg-brand-dark"
            >
              {ui.generateStart}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-lg border border-[#ced4da] bg-white px-5 py-2 font-medium text-[#495057] transition-colors hover:bg-gray-50"
            >
              {ui.generateCancel}
            </button>
          </>
        ) : step === 'done' ? (
          <button
            type="button"
            onClick={openContent}
            className="cursor-pointer rounded-lg border-0 bg-accent-green px-5 py-2 font-bold text-white transition-colors hover:opacity-90"
          >
            {ui.generateOpenContent}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleCancel}
            className="cursor-pointer rounded-lg border border-red-300 bg-white px-5 py-2 font-medium text-red-600 transition-colors hover:bg-red-50"
          >
            {ui.generateCancel}
          </button>
        )}
      </div>
    </div>
  );
}
