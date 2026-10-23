import React, { useState } from 'react';
import {
  X,
  Key,
  Globe,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Zap,
  Sparkles,
  Server,
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
        message: err.message || 'Connection failed. Check API key, Base URL, and Model.',
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
        {/* Modal Header */}
        <div className="p-4 border-b border-pink-500/20 flex items-center justify-between bg-[#200824]/90 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#2e0d34] border border-pink-500/40 flex items-center justify-center text-rose-300">
              <Sparkles size={18} className="animate-pulse" />
            </div>
            <div>
              <h2
                id="ai-config-title"
                className="text-sm font-bold text-pink-50 tracking-wide flex items-center gap-2"
              >
                AI Intelligence & LLM Setup
              </h2>
              <p className="text-[11px] text-pink-300/70">
                OpenAI-Compatible Multi-Provider Architecture
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close AI settings dialog"
            onClick={() => {
              sound.playAction();
              onClose();
            }}
            className="p-1.5 rounded-xl text-pink-400/60 hover:text-pink-100 hover:bg-pink-900/30 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#18071c]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* 1. Select Provider */}
          <div>
            <label className="block text-[11px] font-semibold text-pink-200 tracking-wide mb-2 flex items-center gap-1.5">
              <Server size={13} className="text-rose-400" />
              <span>1. Select AI Provider</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {AI_PROVIDERS.map((prov) => {
                const isSelected = config.providerId === prov.id;
                return (
                  <button
                    key={prov.id}
                    type="button"
                    onClick={() => handleProviderSelect(prov.id)}
                    className={`p-2.5 rounded-xl text-left transition-all cursor-pointer relative ${
                      isSelected
                        ? 'bg-[#2f0e35] border border-rose-400 text-rose-100 shadow-[0_0_15px_rgba(244,63,94,0.3)]'
                        : 'bg-[#18071c] border border-pink-500/20 text-pink-300/70 hover:border-pink-500/40 hover:text-pink-100'
                    }`}
                  >
                    <div className="font-semibold text-xs truncate flex items-center justify-between">
                      <span>{prov.name.split(' ')[0]}</span>
                      {isSelected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                      )}
                    </div>
                    <p className="text-[10px] text-pink-300/50 truncate mt-0.5">
                      {prov.id === 'vyceai'
                        ? 'Vyce AI (deepseek-v4.1)'
                        : prov.id === 'groq'
                        ? 'Fast & Free Tier'
                        : prov.id === 'ollama'
                        ? 'Offline Local'
                        : prov.id === 'openai'
                        ? 'GPT Models'
                        : prov.id === 'openrouter'
                        ? 'Multi-Model'
                        : prov.id === 'deepseek'
                        ? 'DeepSeek API'
                        : 'Custom Proxy'}
                    </p>
                  </button>
                );
              })}
            </div>

            {currentProvider.hint && (
              <p className="text-[11px] text-rose-300/80 mt-2 flex items-center gap-1.5">
                <Sparkles size={12} className="text-rose-400" />
                <span>{currentProvider.hint}</span>
              </p>
            )}
          </div>

          {/* 2. Endpoint Base URL */}
          <div>
            <label className="block text-[11px] font-semibold text-pink-200 tracking-wide mb-1 flex items-center gap-1.5">
              <Globe size={13} className="text-rose-400" />
              <span>2. Endpoint Base URL</span>
            </label>
            <input
              type="text"
              value={config.baseUrl}
              onChange={(e) => {
                setConfig({ ...config, baseUrl: e.target.value });
                setTestResult(null);
              }}
              placeholder="https://vyceai.com/v1"
              className="w-full bg-[#150518] border border-pink-500/25 rounded-xl px-3 py-1.5 text-xs text-pink-100 focus:outline-none focus:border-rose-400 font-mono"
            />
          </div>

          {/* 3. API Key */}
          {currentProvider.needsApiKey ? (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-semibold text-pink-200 tracking-wide flex items-center gap-1.5">
                  <Key size={13} className="text-rose-400" />
                  <span>3. API Authentication Key</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="text-[11px] text-pink-300/80 hover:text-pink-100 flex items-center gap-1 cursor-pointer"
                >
                  {showKey ? <EyeOff size={11} /> : <Eye size={11} />}
                  <span>{showKey ? 'Hide' : 'Reveal'}</span>
                </button>
              </div>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={config.apiKey || ''}
                  onChange={(e) => {
                    setConfig({ ...config, apiKey: e.target.value });
                    setTestResult(null);
                  }}
                  placeholder="sk-..."
                  className="w-full bg-[#150518] border border-pink-500/25 rounded-xl px-3 py-1.5 text-xs text-pink-100 focus:outline-none focus:border-rose-400 font-mono tracking-wider"
                />
              </div>
              <p className="text-[10px] text-pink-300/60 mt-1">
                🔒 Keys are saved locally in your browser session and never transmitted to third-party tracking servers.
              </p>
            </div>
          ) : (
            <div className="p-2.5 rounded-xl bg-pink-950/30 border border-pink-500/30 text-[11px] text-pink-200">
              ✦ No API Key required for local Ollama server. Ensure `ollama serve` is active on port 11434.
            </div>
          )}

          {/* 4. Model Identifier & Discovery */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
              <label className="text-[11px] font-semibold text-pink-200 tracking-wide flex items-center gap-1.5">
                <Sparkles size={13} className="text-rose-400" />
                <span>4. Model Identifier</span>
              </label>

              <div className="flex items-center gap-2">
                {config.model && (
                  <button
                    type="button"
                    onClick={() => {
                      sound.playAction();
                      setConfig((prev) => ({ ...prev, model: '' }));
                      setTestResult(null);
                    }}
                    className="text-[10.5px] text-pink-300/70 hover:text-rose-300 transition-colors cursor-pointer flex items-center gap-1 px-2 py-0.5 rounded-lg border border-pink-500/20 hover:border-rose-500/40"
                    title="Clear model identifier"
                  >
                    <X size={10} />
                    <span>Clear</span>
                  </button>
                )}

                {/* Model Discovery Button */}
                <button
                  type="button"
                  onClick={handleDiscoverModels}
                  disabled={discovering}
                  className="px-3 py-1 rounded-xl bg-[#2a0c30] hover:bg-[#381040] border border-pink-400/50 hover:border-pink-300 text-rose-200 text-[11px] font-semibold tracking-wide transition-all cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                  title="Query the server /models endpoint to discover available models"
                >
                  <RefreshCw
                    size={11}
                    className={discovering ? 'animate-spin text-rose-300' : 'text-rose-400'}
                  />
                  <span>{discovering ? 'Discovering...' : 'Discover Models'}</span>
                </button>
              </div>
            </div>

            {/* Persistent Model Input - NEVER Disappears */}
            <div className="relative">
              <input
                type="text"
                value={config.model || ''}
                onChange={(e) => {
                  setConfig((prev) => ({ ...prev, model: e.target.value }));
                  setTestResult(null);
                }}
                placeholder="Enter model name (e.g. deepseek-v4.1, gpt-4o) or pick below..."
                className="w-full bg-[#150518] border border-pink-500/35 focus:border-rose-400 rounded-xl px-3 py-2 text-xs text-pink-50 placeholder:text-pink-300/30 focus:outline-none shadow-inner font-mono"
              />
              {config.model && (
                <span className="absolute right-2.5 top-2 text-[9.5px] font-sans px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                  Active
                </span>
              )}
            </div>

            {/* Quick-Pick Model Badges for the selected provider */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[10px] text-pink-300/60 font-sans">Quick Pick:</span>
              {(config.providerId === 'vyceai'
                ? ['deepseek-v4.1', 'deepseek-v4-flash', 'claude-sonnet-4-6', 'gpt-6-luna']
                : config.providerId === 'groq'
                ? ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768']
                : config.providerId === 'openai'
                ? ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo']
                : config.providerId === 'deepseek'
                ? ['deepseek-chat', 'deepseek-reasoner']
                : ['auto', 'gpt-4o', 'claude-3-5-sonnet']
              ).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    sound.playAction();
                    setConfig((prev) => ({ ...prev, model: m }));
                    setTestResult(null);
                  }}
                  className={`px-2.5 py-0.5 rounded-lg text-[10.5px] font-mono transition-all cursor-pointer border ${
                    config.model === m
                      ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white font-bold border-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.35)]'
                      : 'bg-[#220a26] text-pink-200 border-pink-500/25 hover:border-pink-400 hover:text-white'
                  }`}
                  title={`Use model ${m}`}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Discovery Error Badge */}
            {discoveryError && (
              <div className="mt-2 p-2.5 rounded-xl bg-rose-950/50 border border-rose-500/40 text-[11px] text-rose-200 flex items-start gap-2 animate-fade-in">
                <AlertCircle size={14} className="text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Discovery notice:</span> {discoveryError}
                  <div className="text-[10px] text-pink-300/70 mt-0.5">
                    You can still type your model name directly into the input field above.
                  </div>
                </div>
              </div>
            )}

            {/* Discovered Models Interactive List */}
            {discoveredModels.length > 0 && (
              <div className="mt-3 p-3 rounded-2xl bg-[#1b081e] border border-pink-500/30 space-y-2 animate-fade-in">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-rose-300 flex items-center gap-1.5">
                    <Sparkles size={12} className="text-rose-400" />
                    <span>Discovered Models ({discoveredModels.length})</span>
                  </span>
                  {discoveredModels.length > 5 && (
                    <div className="relative">
                      <Search size={11} className="absolute left-2.5 top-2 text-pink-400/60" />
                      <input
                        type="text"
                        value={modelFilter}
                        onChange={(e) => setModelFilter(e.target.value)}
                        placeholder="Filter..."
                        className="w-36 bg-[#130416] border border-pink-500/25 rounded-lg pl-7 pr-2 py-0.5 text-[10.5px] text-pink-100 focus:outline-none focus:border-rose-400 placeholder:text-pink-300/30 font-mono"
                      />
                    </div>
                  )}
                </div>

                <div className="max-h-36 overflow-y-auto pr-1 flex flex-wrap gap-1.5 custom-scrollbar">
                  {filteredModels.length === 0 ? (
                    <span className="text-[10.5px] text-pink-300/50 py-1">
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
                          className={`px-2.5 py-1 rounded-lg text-[10.5px] font-mono transition-all cursor-pointer truncate max-w-full text-left ${
                            isCurrent
                              ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white font-bold shadow-[0_0_12px_rgba(244,63,94,0.4)]'
                              : 'bg-[#220a26] hover:bg-[#2d0e32] text-pink-200 border border-pink-500/25 hover:border-pink-400'
                          }`}
                          title={`Select ${m}`}
                        >
                          {isCurrent && '✓ '}
                          {m}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 5. Temperature */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-semibold text-pink-200 tracking-wide flex items-center gap-1.5">
                <Sliders size={13} className="text-rose-400" />
                <span>5. Creativity / Temperature</span>
              </label>
              <span className="text-[11px] font-bold text-rose-300 font-mono">
                {config.temperature}
              </span>
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
              className="w-full accent-rose-500 cursor-pointer h-1.5 bg-[#120414] rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-pink-300/60 mt-0.5">
              <span>Precise / Factual (0.1)</span>
              <span>Creative / Expressive (1.0)</span>
            </div>
          </div>

          {/* Test Connection Result Box */}
          {testResult && (
            <div
              className={`p-3 rounded-2xl border text-xs flex items-start gap-2.5 ${
                testResult.success
                  ? 'bg-emerald-950/50 border-emerald-500/60 text-emerald-200'
                  : 'bg-rose-950/50 border-rose-500/60 text-rose-200'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
              )}
              <span className="leading-tight">{testResult.message}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 border-t border-pink-500/20 bg-[#200824]/90 flex items-center justify-between">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-[#250d2b] hover:bg-[#32113a] text-rose-200 border border-pink-500/40 transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            <Zap size={13} className={testing ? 'animate-spin' : 'text-rose-400'} />
            <span>{testing ? 'Testing...' : 'Test Connection'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl text-pink-300/70 hover:text-pink-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-rose-500 via-pink-600 to-amber-500 hover:opacity-95 text-white shadow-[0_2px_15px_rgba(244,63,94,0.35)] transition-all cursor-pointer active:scale-95"
            >
              Save Configuration
            </button>
          </div>
        </div>
      </ModalShell>
  );
}
