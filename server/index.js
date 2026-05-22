const fs = require('node:fs');
const path = require('node:path');

const PLUGIN_ID = 'reply-polisher';
const CONFIG_PATH = path.join(__dirname, 'config.json');

const DEFAULT_CONFIG = Object.freeze({
    baseUrl: '',
    apiKey: '',
    model: '',
});

const DEFAULT_REWRITE_OPTIONS = Object.freeze({
    temperature: 0.7,
    maxTokens: 1024,
    timeoutMs: 60000,
});

const SYSTEM_PROMPT = 'You rewrite only the provided text. Do not continue the conversation. Do not add explanations.';
const inFlightRewrites = new Map();

const info = {
    id: PLUGIN_ID,
    name: 'Reply Polisher',
    description: 'Rewrites the latest assistant reply with a separately configured OpenAI-compatible model.',
};

function cloneDefaultConfig() {
    return { ...DEFAULT_CONFIG };
}

function normalizeString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function loadConfig() {
    if (!fs.existsSync(CONFIG_PATH)) {
        return cloneDefaultConfig();
    }

    try {
        const parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        return {
            ...cloneDefaultConfig(),
            ...parsed,
            baseUrl: normalizeString(parsed.baseUrl),
            apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
            model: normalizeString(parsed.model),
        };
    } catch (error) {
        console.error(`[${PLUGIN_ID}] Failed to read config.json: ${error.message}`);
        return cloneDefaultConfig();
    }
}

function saveConfig(config) {
    const normalized = {
        baseUrl: normalizeString(config.baseUrl),
        apiKey: typeof config.apiKey === 'string' ? config.apiKey : '',
        model: normalizeString(config.model),
    };

    fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(normalized, null, 4)}\n`, 'utf8');
    return normalized;
}

function sanitizeSettings(config) {
    return {
        baseUrl: normalizeString(config.baseUrl),
        model: normalizeString(config.model),
        hasApiKey: Boolean(config.apiKey),
    };
}

function mergeSettings(current, patch = {}) {
    const merged = {
        ...cloneDefaultConfig(),
        ...current,
    };

    if (typeof patch.baseUrl === 'string') {
        merged.baseUrl = normalizeString(patch.baseUrl);
    }

    if (typeof patch.model === 'string') {
        merged.model = normalizeString(patch.model);
    }

    if (patch.clearApiKey === true) {
        merged.apiKey = '';
    } else if (typeof patch.apiKey === 'string' && patch.apiKey.length > 0) {
        merged.apiKey = patch.apiKey;
    }

    return merged;
}

function buildChatCompletionsUrl(baseUrl) {
    const trimmed = normalizeString(baseUrl).replace(/\/+$/, '');
    if (!trimmed) {
        throw new Error('Model B base URL is not configured.');
    }

    const normalized = trimmed.replace(/\/chat\/completions$/i, '');
    return `${normalized}/chat/completions`;
}

function buildModelsUrl(baseUrl) {
    const trimmed = normalizeString(baseUrl).replace(/\/+$/, '');
    if (!trimmed) {
        throw new Error('Model B base URL is not configured.');
    }

    const normalized = trimmed
        .replace(/\/chat\/completions$/i, '')
        .replace(/\/models$/i, '');
    return `${normalized}/models`;
}

function finiteNumber(value, fallback) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}

function buildRewritePayload({ model, prompt, text, temperature, maxTokens }) {
    const normalizedModel = normalizeString(model);
    const normalizedPrompt = normalizeString(prompt);
    const normalizedText = normalizeString(text);

    if (!normalizedModel) {
        throw new Error('Model B model is not configured.');
    }

    if (!normalizedPrompt) {
        throw new Error('Rewrite prompt is required.');
    }

    if (!normalizedText) {
        throw new Error('Text to rewrite is required.');
    }

    return {
        model: normalizedModel,
        messages: [
            {
                role: 'system',
                content: SYSTEM_PROMPT,
            },
            {
                role: 'user',
                content: `Rewrite instructions:\n${normalizedPrompt}\n\nText to rewrite:\n${normalizedText}`,
            },
        ],
        temperature: finiteNumber(temperature, DEFAULT_REWRITE_OPTIONS.temperature),
        max_tokens: Math.max(1, Math.floor(finiteNumber(maxTokens, DEFAULT_REWRITE_OPTIONS.maxTokens))),
    };
}

function buildRewriteDedupeKey({ config, prompt, text, temperature, maxTokens }) {
    return JSON.stringify({
        baseUrl: normalizeString(config?.baseUrl),
        model: normalizeString(config?.model),
        prompt: normalizeString(prompt),
        text: normalizeString(text),
        temperature: finiteNumber(temperature, DEFAULT_REWRITE_OPTIONS.temperature),
        maxTokens: Math.max(1, Math.floor(finiteNumber(maxTokens, DEFAULT_REWRITE_OPTIONS.maxTokens))),
    });
}

function extractRewriteText(data) {
    const content = data?.choices?.[0]?.message?.content;
    const text = typeof content === 'string' ? content.trim() : '';

    if (!text) {
        throw new Error('Model B returned an empty rewrite.');
    }

    return text;
}

function extractModelIds(data) {
    const entries = Array.isArray(data) ? data : data?.data;
    if (!Array.isArray(entries)) {
        return [];
    }

    const ids = entries
        .map(entry => normalizeString(entry?.id))
        .filter(Boolean);

    return Array.from(new Set(ids)).sort((a, b) => a.localeCompare(b));
}

function redactSensitiveText(text, config = {}) {
    let message = normalizeString(text);
    const apiKey = typeof config.apiKey === 'string' ? config.apiKey : '';

    if (apiKey) {
        message = message.split(apiKey).join('[redacted]');
    }

    return message;
}

function assertModelConnectionConfigured(config) {
    if (!normalizeString(config.baseUrl)) {
        throw new Error('Model B base URL is not configured.');
    }

    if (!config.apiKey) {
        throw new Error('Model B API key is not configured.');
    }
}

function assertConfigured(config) {
    assertModelConnectionConfigured(config);

    if (!normalizeString(config.model)) {
        throw new Error('Model B model is not configured.');
    }
}

async function callListModels({ config, timeoutMs, fetchImpl = global.fetch }) {
    assertModelConnectionConfigured(config);

    if (typeof fetchImpl !== 'function') {
        throw new Error('Fetch API is not available in this Node.js runtime.');
    }

    const controller = new AbortController();
    const timeout = Math.max(1000, Math.floor(finiteNumber(timeoutMs, DEFAULT_REWRITE_OPTIONS.timeoutMs)));
    const timeoutHandle = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetchImpl(buildModelsUrl(config.baseUrl), {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${config.apiKey}`,
            },
            signal: controller.signal,
        });

        let responseBody = null;
        try {
            responseBody = await response.json();
        } catch {
            responseBody = null;
        }

        if (!response.ok) {
            const upstreamMessage = normalizeString(responseBody?.error?.message);
            throw new Error(upstreamMessage || `Model B model list request failed with HTTP ${response.status}.`);
        }

        return extractModelIds(responseBody);
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error(`Model B model list request timed out after ${timeout}ms.`);
        }

        throw error;
    } finally {
        clearTimeout(timeoutHandle);
    }
}

async function callRewrite({ config, prompt, text, temperature, maxTokens, timeoutMs, fetchImpl = global.fetch }) {
    assertConfigured(config);

    if (typeof fetchImpl !== 'function') {
        throw new Error('Fetch API is not available in this Node.js runtime.');
    }

    const controller = new AbortController();
    const timeout = Math.max(1000, Math.floor(finiteNumber(timeoutMs, DEFAULT_REWRITE_OPTIONS.timeoutMs)));
    const timeoutHandle = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetchImpl(buildChatCompletionsUrl(config.baseUrl), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify(buildRewritePayload({
                model: config.model,
                prompt,
                text,
                temperature,
                maxTokens,
            })),
            signal: controller.signal,
        });

        let responseBody = null;
        try {
            responseBody = await response.json();
        } catch {
            responseBody = null;
        }

        if (!response.ok) {
            const upstreamMessage = normalizeString(responseBody?.error?.message);
            throw new Error(upstreamMessage || `Model B request failed with HTTP ${response.status}.`);
        }

        return extractRewriteText(responseBody);
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error(`Model B request timed out after ${timeout}ms.`);
        }

        throw error;
    } finally {
        clearTimeout(timeoutHandle);
    }
}

async function callRewriteDeduped(args, cache = inFlightRewrites) {
    const key = buildRewriteDedupeKey(args);
    if (cache.has(key)) {
        return cache.get(key);
    }

    const promise = callRewrite(args);
    cache.set(key, promise);

    try {
        return await promise;
    } finally {
        cache.delete(key);
    }
}

function sendError(res, error, config = {}) {
    const message = redactSensitiveText(error?.message, config) || 'Reply Polisher request failed.';
    res.status(400).json({ error: message });
}

async function init(router) {
    router.get('/settings', (_req, res) => {
        res.json(sanitizeSettings(loadConfig()));
    });

    router.post('/settings', (req, res) => {
        try {
            const saved = saveConfig(mergeSettings(loadConfig(), req.body));
            res.json(sanitizeSettings(saved));
        } catch (error) {
            sendError(res, error, loadConfig());
        }
    });

    router.post('/models', async (req, res) => {
        const config = mergeSettings(loadConfig(), {
            baseUrl: req.body?.baseUrl,
            apiKey: req.body?.apiKey,
        });

        try {
            const models = await callListModels({
                config,
                timeoutMs: req.body?.timeoutMs,
            });

            res.json({ models });
        } catch (error) {
            sendError(res, error, config);
        }
    });

    router.post('/rewrite', async (req, res) => {
        const config = loadConfig();
        try {
            const rewrite = await callRewriteDeduped({
                config,
                prompt: req.body?.prompt,
                text: req.body?.text,
                temperature: req.body?.temperature,
                maxTokens: req.body?.maxTokens,
                timeoutMs: req.body?.timeoutMs,
            });

            res.json({ text: rewrite });
        } catch (error) {
            sendError(res, error, config);
        }
    });
}

async function exit() {
    return Promise.resolve();
}

module.exports = {
    init,
    exit,
    info,
    _private: {
        SYSTEM_PROMPT,
        DEFAULT_CONFIG,
        DEFAULT_REWRITE_OPTIONS,
        buildChatCompletionsUrl,
        buildModelsUrl,
        buildRewritePayload,
        callListModels,
        callRewrite,
        callRewriteDeduped,
        extractModelIds,
        extractRewriteText,
        loadConfig,
        mergeSettings,
        redactSensitiveText,
        sanitizeSettings,
        saveConfig,
    },
};
