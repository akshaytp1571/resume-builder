import React, { useState } from 'react';
import {
  X,
  Eye,
  EyeOff,
  Zap,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  AI_PROVIDERS,
  getSavedAiConfig,
  saveAiConfig,
  testAiConnection,
  discoverAiModels,
  cleanApiKey,
  normalizeBaseUrl,
  isAiConfigReady,
} from '../../utils/aiService';
import { sound } from '../../utils/soundEffects';
import ModalShell from './ModalShell';
import { Button, Field } from './primitives';

/** One-line note per provider, shown beside the radio row. */
const PROVIDER_NOTE = {
  vyceai: 'Vyce AI (deepseek-v4.1)',
  groq: 'Fast & Free Tier',
  ollama: 'Offline Local',
  openai: 'GPT Models',
  openrouter: 'Multi-Model',
  deepseek: 'DeepSeek API',
};

const QUICK_PICKS = {
  vyceai: ['deepseek-v4.1', 'deepseek-v4-flash', 'claude-sonnet-4-6', 'gpt-6-luna'],
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
};

export default function AiConfigModal({ isOpen, onClose, onConfigSaved }) {
  const [config, setConfig] = useState(getSavedAiConfig);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Model discovery state
  const [discovering, setDiscovering] = useState(false);
  const [discoveredModels, setDiscoveredModels] = useState([]);
  const [discoveryError, setDiscoveryError] = useState(null);
  const [modelFilter, setModelFilter] = useState('');

  // Reload the saved config each time the modal opens, so edits abandoned in
  // a previous session never reappear. Done during render to avoid a
  // cascading render.
  const [loadedFor, setLoadedFor] = useState(null);
  if (isOpen && loadedFor !== isOpen) {
    setLoadedFor(isOpen);
    setConfig(getSavedAiConfig());
    setTestResult(null);
    setDiscoveryError(null);
  }

  if (!isOpen) return null;

  const currentProvider =
    AI_PROVIDERS.find((p) => p.id === config.providerId) || AI_PROVIDERS[0];

  const handleProviderSelect = (providerId) => {
    sound.playAction();
    const provider = AI_PROVIDERS.find((p) => p.id === providerId);
    if (provider) {
      setConfig((prev) => {
        // A model from the previous provider is almost certainly wrong on the
        // new one, so drop it unless the user is staying on the custom
        // endpoint (where the model is their own business).
        const keepModel = prev.providerId === 'custom' && providerId === 'custom';
        return {
          ...prev,
          providerId: provider.id,
          baseUrl: provider.baseUrl,
          model: keepModel ? prev.model : '',
        };
      });
      setDiscoveredModels([]);
      setDiscoveryError(null);
      setTestResult(null);
    }
  };

  const handleDiscoverModels = async () => {
    sound.playAction();
    setDiscovering(true);
    setDiscoveryError(null);
    setTestResult(null);

    try {
      const models = await discoverAiModels({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
      });
      sound.playSuccess();
      setDiscoveredModels(models);
      setDiscoveryError(null);
    } catch (err) {
      console.error('Discovery error:', err);
      setDiscoveryError(err.message || 'Failed to discover models from endpoint.');
      setDiscoveredModels([]);
    } finally {
      setDiscovering(false);
    }
  };

  const handleTestConnection = async () => {
    sound.playAction();
    if (!config.model?.trim()) {
      setTestResult({
        success: false,
        message: 'MODEL IDENTIFIER REQUIRED: Please enter a model name or click [DISCOVER_MODELS] first.',
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      await testAiConnection(config);
      sound.playSuccess();
      setTestResult({
        success: true,
        message: `HANDSHAKE VERIFIED: Connection successfully established with "${config.model}"!`,
      });
    } catch (err) {
      setTestResult({
        success: false,
        message: err.message || 'Connection failed. Check API Key, Base URL, and Model.',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    sound.playSuccess();
    const sanitized = {
      ...config,
      apiKey: cleanApiKey(config.apiKey),
      // saveAiConfig normalises this too, but doing it here means the value
      // handed back to App is already the canonical one.
      baseUrl: normalizeBaseUrl(config.baseUrl?.trim()),
      model: config.model?.trim(),
    };

    // Warn rather than block: an incomplete config is still worth keeping so
    // the user does not lose what they typed.
    if (!isAiConfigReady(sanitized)) {
      setTestResult({
        success: false,
        message:
          'Saved, but this configuration is incomplete. Set the endpoint, a model name, and (if the provider needs one) an API key before using AI features.',
      });
    }

    saveAiConfig(sanitized);
    if (onConfigSaved) onConfigSaved(sanitized);
    onClose();
  };

  const filteredModels = discoveredModels.filter(
    (m) => !modelFilter.trim() || m.toLowerCase().includes(modelFilter.toLowerCase().trim())
  );

  return (
    <ModalShell onClose={onClose} labelledBy="ai-config-title" className="max-w-xl">
      {/* Header: mono kicker + title + 32px close, on a hairline. */}
      <div className="flex items-start justify-between border-b border-rule bg-housing px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2.5">
            <span className="dt-serif text-[13px] text-signal">LLM</span>
            <h2 id="ai-config-title" className="dt-label text-bone">
              AI Intelligence &amp; LLM Setup
            </h2>
          </div>
          <p className="dt-data mt-1 text-bone-32">
            OpenAI-Compatible Multi-Provider Architecture
          </p>
        </div>
        <button
          type="button"
          aria-label="Close AI settings dialog"
          onClick={() => {
            sound.playAction();
            onClose();
          }}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[2px] border border-transparent text-bone-52 transition-colors duration-[90ms] hover:bg-[rgba(237,232,220,0.05)] hover:text-bone"
        >
          <X size={15} aria-hidden="true" />
        </button>
      </div>

      {/* Body */}
      <div className="space-y-5 overflow-y-auto p-4 text-[13px] sm:p-5">
        {/* 1. Provider: hairline radio rows, one square box each. */}
        <div>
          <span className="dt-label mb-2 block text-bone-52">1. Select AI Provider</span>
          <div className="divide-y divide-[var(--rule)] border-t border-rule">
            {AI_PROVIDERS.map((prov) => {
              const isSelected = config.providerId === prov.id;
              return (
                <button
                  key={prov.id}
                  type="button"
                  onClick={() => handleProviderSelect(prov.id)}
                  aria-pressed={isSelected}
                  className="flex w-full cursor-pointer items-center gap-2.5 py-2 text-left"
                >
                  <span
                    aria-hidden="true"
                    className={`flex h-3 w-3 shrink-0 items-center justify-center border ${
                      isSelected ? 'border-signal' : 'border-rule-2'
                    }`}
                  >
                    {isSelected && <span className="h-[5px] w-[5px] bg-signal" />}
                  </span>
                  <span
                    className={`font-sans text-[13px] ${isSelected ? 'text-signal' : 'text-bone-70'}`}
                  >
                    {prov.name.split(' ')[0]}
                  </span>
                  <span className="dt-data ml-auto truncate text-bone-32">
                    {PROVIDER_NOTE[prov.id] || 'Custom Proxy'}
                  </span>
                </button>
              );
            })}
          </div>

          {currentProvider.hint && (
            <p className="dt-data mt-2 text-bone-52">{currentProvider.hint}</p>
          )}
        </div>

        {/* 2. Endpoint */}
        <div className="border-t border-rule pt-3">
          <Field
            label="2. Endpoint Base URL"
            type="text"
            value={config.baseUrl}
            onChange={(e) => {
              setConfig({ ...config, baseUrl: e.target.value });
              setTestResult(null);
            }}
            placeholder="https://vyceai.com/v1"
            inputClassName="font-mono"
          />
        </div>

        {/* 3. API key */}
        <div className="border-t border-rule pt-3">
          {currentProvider.needsApiKey ? (
            <>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="dt-label text-bone-52">3. API Authentication Key</span>
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="dt-data inline-flex cursor-pointer items-center gap-1 text-bone-52 transition-colors duration-[90ms] hover:text-bone"
                >
                  {showKey ? <EyeOff size={11} aria-hidden="true" /> : <Eye size={11} aria-hidden="true" />}
                  <span>{showKey ? 'Hide' : 'Reveal'}</span>
                </button>
              </div>
              <input
                type={showKey ? 'text' : 'password'}
                value={config.apiKey || ''}
                onChange={(e) => {
                  setConfig({ ...config, apiKey: e.target.value });
                  setTestResult(null);
                }}
                placeholder="sk-..."
                aria-label="3. API Authentication Key"
                className="w-full border-0 border-b bg-transparent px-0 py-2 font-mono text-[16px] tracking-wider text-bone placeholder:text-bone-32 focus:outline-none"
                style={{ borderBottomColor: 'var(--rule-2)' }}
              />
              <p className="dt-data mt-1 text-bone-32">
                Keys are saved locally in your browser session and never transmitted to third-party tracking servers.
              </p>
            </>
          ) : (
            <p className="border-l-2 border-rule-2 py-1 pl-2 font-sans text-[12px] text-bone-52">
              No API Key required for local Ollama server. Ensure `ollama serve` is active on port 11434.
            </p>
          )}
        </div>

        {/* 4. Model identifier */}
        <div className="border-t border-rule pt-3">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <span className="dt-label text-bone-52">4. Model Identifier</span>
            <div className="flex items-center gap-2">
              {config.model && (
                <Button
                  size="sm"
                  onClick={() => {
                    sound.playAction();
                    setConfig((prev) => ({ ...prev, model: '' }));
                    setTestResult(null);
                  }}
                  title="Clear model identifier"
                >
                  Clear
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleDiscoverModels}
                disabled={discovering}
                title="Query the server /models endpoint to discover available models"
              >
                <RefreshCw size={11} aria-hidden="true" />
                <span>{discovering ? 'Discovering...' : 'Discover Models'}</span>
              </Button>
            </div>
          </div>

          <input
            type="text"
            value={config.model || ''}
            onChange={(e) => {
              setConfig((prev) => ({ ...prev, model: e.target.value }));
              setTestResult(null);
            }}
            placeholder="Enter model name (e.g. deepseek-v4.1, gpt-4o) or pick below..."
            aria-label="4. Model Identifier"
            className="w-full border-0 border-b bg-transparent px-0 py-2 font-mono text-[16px] text-bone placeholder:text-bone-32 focus:outline-none"
            style={{ borderBottomColor: 'var(--rule-2)' }}
          />

          {config.model && (
            <span className="dt-label mt-1 inline-flex items-center gap-1.5 text-signal">
              <span aria-hidden="true" className="h-[5px] w-[5px] bg-signal" />
              Active
            </span>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="dt-label text-bone-32">Quick Pick:</span>
            {(QUICK_PICKS[config.providerId] || ['auto', 'gpt-4o', 'claude-3-5-sonnet']).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  sound.playAction();
                  setConfig((prev) => ({ ...prev, model: m }));
                  setTestResult(null);
                }}
                title={`Use model ${m}`}
                className={`cursor-pointer rounded-[2px] border px-1.5 py-0.5 font-mono text-[10px] transition-colors duration-[90ms] ${
                  config.model === m
                    ? 'border-signal/60 text-signal'
                    : 'border-rule-2 text-bone-70 hover:text-bone'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {discoveryError && (
            <div className="mt-2">
              <p className="border-l-2 border-alarm py-1 pl-2 font-sans text-[12px] text-alarm">
                <span className="font-semibold">Discovery notice:</span> {discoveryError}
              </p>
              <p className="dt-data mt-1 pl-2 text-bone-32">
                You can still type your model name directly into the input field above.
              </p>
            </div>
          )}

          {discoveredModels.length > 0 && (
            <div className="mt-3 border-t border-rule pt-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="dt-label text-bone-52">
                  Discovered Models ({discoveredModels.length})
                </span>
                {discoveredModels.length > 5 && (
                  <div className="flex items-center gap-1.5">
                    <Search size={11} className="shrink-0 text-bone-32" aria-hidden="true" />
                    <input
                      type="text"
                      value={modelFilter}
                      onChange={(e) => setModelFilter(e.target.value)}
                      placeholder="Filter..."
                      aria-label="Filter discovered models"
                      className="w-32 border-0 border-b bg-transparent px-0 py-1 font-mono text-[16px] text-bone placeholder:text-bone-32 focus:outline-none"
                      style={{ borderBottomColor: 'var(--rule-2)' }}
                    />
                  </div>
                )}
              </div>

              <div className="max-h-36 divide-y divide-[var(--rule)] overflow-y-auto border-t border-rule">
                {filteredModels.length === 0 ? (
                  <span className="dt-data block py-1 text-bone-32">
                    No models matching "{modelFilter}"
                  </span>
                ) : (
                  filteredModels.map((m) => {
                    const isCurrent = config.model === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          sound.playAction();
                          setConfig((prev) => ({ ...prev, model: m }));
                          setTestResult(null);
                        }}
                        title={`Select ${m}`}
                        className={`flex w-full cursor-pointer items-center gap-2 py-[6px] text-left font-mono text-[11px] ${
                          isCurrent ? 'text-signal' : 'text-bone-70 hover:text-bone'
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`h-[5px] w-[5px] shrink-0 ${
                            isCurrent ? 'bg-signal' : 'bg-bone-32'
                          }`}
                        />
                        <span className="truncate">{m}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* 5. Temperature */}
        <div className="border-t border-rule pt-3">
          <div className="mb-1 flex items-baseline justify-between">
            <span className="dt-label text-bone-52">5. Creativity / Temperature</span>
            <span className="dt-data text-bone-70">{config.temperature}</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            value={config.temperature}
            onChange={(e) =>
              setConfig({ ...config, temperature: parseFloat(e.target.value) })
            }
            aria-label="5. Creativity / Temperature"
            className="h-[3px] w-full cursor-pointer appearance-none bg-[var(--rule)]"
            style={{ accentColor: 'var(--signal)' }}
          />
          <div className="mt-1 flex justify-between font-mono text-[10px] text-bone-32">
            <span>Precise / Factual (0.1)</span>
            <span>Creative / Expressive (1.0)</span>
          </div>
        </div>

        {/* Test-connection output: a hairline notice, never a filled box. */}
        {testResult && (
          <p
            className={`flex items-start gap-2 border-l-2 py-1 pl-2 font-sans text-[12px] ${
              testResult.success ? 'border-signal text-signal' : 'border-alarm text-alarm'
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
            ) : (
              <AlertCircle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
            )}
            <span className="leading-tight">{testResult.message}</span>
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 border-t border-rule bg-housing px-4 py-2.5">
        <Button
          onClick={handleTestConnection}
          disabled={testing}
          className="mr-auto"
        >
          <Zap size={12} aria-hidden="true" />
          <span>{testing ? 'Testing...' : 'Test Connection'}</span>
        </Button>

        <Button onClick={onClose}>Cancel</Button>

        <Button variant="signal" onClick={handleSave}>
          Save Configuration
        </Button>
      </div>
    </ModalShell>
  );
}
