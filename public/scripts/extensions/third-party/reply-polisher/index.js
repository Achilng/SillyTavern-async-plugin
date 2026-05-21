import {
    MODULE_NAME,
    buildRewriteBody,
    applyRewriteToMessage,
    createMessageSnapshot,
    getLatestProcessableMessageId,
    getSettings,
    isSnapshotCurrent,
    shouldProcessEventType,
    shouldProcessMessage,
} from './core.js';

const EXTENSION_FOLDER = 'third-party/reply-polisher';
const API_BASE = '/api/plugins/reply-polisher';

let context;
let settings;
let serverSettings = {
    baseUrl: '',
    model: '',
    hasApiKey: false,
};
const activeRewrites = new Set();

function getElement(id) {
    return document.getElementById(id);
}

function setButtonBusy(button, busy) {
    if (!button) {
        return;
    }

    button.disabled = busy;
    button.classList.toggle('disabled', busy);
}

function readNumber(id, fallback) {
    const value = Number(getElement(id)?.value);
    return Number.isFinite(value) ? value : fallback;
}

function syncBehaviorUi() {
    getElement('reply_polisher_enabled').checked = Boolean(settings.enabled);
    getElement('reply_polisher_auto_rewrite').checked = Boolean(settings.autoRewrite);
    getElement('reply_polisher_prompt').value = settings.rewritePrompt;
    getElement('reply_polisher_temperature').value = String(settings.temperature);
    getElement('reply_polisher_max_tokens').value = String(settings.maxTokens);
    getElement('reply_polisher_timeout_ms').value = String(settings.timeoutMs);
}

function syncServerUi() {
    getElement('reply_polisher_base_url').value = serverSettings.baseUrl || '';
    getElement('reply_polisher_model').value = serverSettings.model || '';
    getElement('reply_polisher_api_key').value = '';
    getElement('reply_polisher_clear_api_key').checked = false;
    getElement('reply_polisher_key_status').textContent = serverSettings.hasApiKey ? 'API key saved' : 'No API key saved';
}

function updateBehaviorSetting() {
    settings.enabled = getElement('reply_polisher_enabled').checked;
    settings.autoRewrite = getElement('reply_polisher_auto_rewrite').checked;
    settings.rewritePrompt = getElement('reply_polisher_prompt').value;
    settings.temperature = readNumber('reply_polisher_temperature', settings.temperature);
    settings.maxTokens = readNumber('reply_polisher_max_tokens', settings.maxTokens);
    settings.timeoutMs = readNumber('reply_polisher_timeout_ms', settings.timeoutMs);
    context.saveSettingsDebounced();
}

async function pluginFetch(path, options = {}) {
    const headers = {
        ...(typeof context.getRequestHeaders === 'function' ? context.getRequestHeaders() : {}),
        ...(options.headers || {}),
    };

    if (options.body && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
    });

    let data = null;
    try {
        data = await response.json();
    } catch {
        data = null;
    }

    if (!response.ok) {
        throw new Error(data?.error || `Reply Polisher request failed with HTTP ${response.status}.`);
    }

    return data;
}

async function loadServerSettings() {
    serverSettings = await pluginFetch('/settings');
    syncServerUi();
}

async function saveServerSettings() {
    const button = getElement('reply_polisher_save_connection');
    setButtonBusy(button, true);

    try {
        serverSettings = await pluginFetch('/settings', {
            method: 'POST',
            body: JSON.stringify({
                baseUrl: getElement('reply_polisher_base_url').value,
                model: getElement('reply_polisher_model').value,
                apiKey: getElement('reply_polisher_api_key').value,
                clearApiKey: getElement('reply_polisher_clear_api_key').checked,
            }),
        });
        syncServerUi();
        toastr.success('Model B settings saved.', 'Reply Polisher');
    } catch (error) {
        toastr.error(error.message, 'Reply Polisher');
    } finally {
        setButtonBusy(button, false);
    }
}

async function testServerSettings() {
    updateBehaviorSetting();

    const button = getElement('reply_polisher_test_connection');
    setButtonBusy(button, true);

    try {
        const result = await pluginFetch('/rewrite', {
            method: 'POST',
            body: JSON.stringify(buildRewriteBody({
                prompt: settings.rewritePrompt || 'Return the provided text clearly.',
                text: 'Reply Polisher connection test.',
                temperature: settings.temperature,
                maxTokens: Math.min(Number(settings.maxTokens) || 1024, 128),
                timeoutMs: settings.timeoutMs,
            })),
        });

        toastr.success(result.text ? 'Model B responded.' : 'Model B returned a response.', 'Reply Polisher');
    } catch (error) {
        toastr.error(error.message, 'Reply Polisher');
    } finally {
        setButtonBusy(button, false);
    }
}

function getMessageById(messageId) {
    return context.chat?.[messageId];
}

async function rewriteMessage(messageId, { manual = false, type = undefined } = {}) {
    if (!manual && (!settings.enabled || !settings.autoRewrite)) {
        return;
    }

    if (!shouldProcessEventType(type)) {
        return;
    }

    const message = getMessageById(messageId);
    if (!shouldProcessMessage(message, { allowProcessed: manual })) {
        return;
    }

    const key = `${context.getCurrentChatId?.() || ''}:${messageId}:${message.swipe_id ?? 0}`;
    if (activeRewrites.has(key)) {
        return;
    }

    const prompt = settings.rewritePrompt?.trim();
    if (!prompt) {
        if (manual) {
            toastr.warning('Rewrite prompt is empty.', 'Reply Polisher');
        }
        return;
    }

    const snapshot = createMessageSnapshot(context, messageId);
    activeRewrites.add(key);

    try {
        const result = await pluginFetch('/rewrite', {
            method: 'POST',
            body: JSON.stringify(buildRewriteBody({
                prompt,
                text: snapshot.text,
                temperature: settings.temperature,
                maxTokens: settings.maxTokens,
                timeoutMs: settings.timeoutMs,
            })),
        });

        if (!isSnapshotCurrent(context, snapshot)) {
            toastr.warning('Message changed before rewrite finished. Original reply was kept.', 'Reply Polisher');
            return;
        }

        applyRewriteToMessage(message, result.text);
        context.updateMessageBlock(messageId, message);
        await context.saveChat();

        if (manual) {
            toastr.success('Latest reply rewritten.', 'Reply Polisher');
        }
    } catch (error) {
        toastr.error(error.message, 'Reply Polisher');
    } finally {
        activeRewrites.delete(key);
    }
}

async function handleRenderedMessage(messageId, type) {
    const numericMessageId = Number(messageId);
    if (!Number.isInteger(numericMessageId)) {
        return;
    }

    await rewriteMessage(numericMessageId, { type });
}

async function handleSwipedMessage(messageId) {
    const numericMessageId = Number(messageId);
    if (!Number.isInteger(numericMessageId)) {
        return;
    }

    await rewriteMessage(numericMessageId, { type: 'swipe' });
}

async function manualRewriteLatest() {
    updateBehaviorSetting();

    const messageId = getLatestProcessableMessageId(context);
    if (messageId < 0) {
        toastr.warning('No assistant reply is available to rewrite.', 'Reply Polisher');
        return;
    }

    await rewriteMessage(messageId, { manual: true });
}

function bindUi() {
    for (const id of [
        'reply_polisher_enabled',
        'reply_polisher_auto_rewrite',
        'reply_polisher_prompt',
        'reply_polisher_temperature',
        'reply_polisher_max_tokens',
        'reply_polisher_timeout_ms',
    ]) {
        getElement(id).addEventListener('change', updateBehaviorSetting);
        getElement(id).addEventListener('input', updateBehaviorSetting);
    }

    getElement('reply_polisher_save_connection').addEventListener('click', saveServerSettings);
    getElement('reply_polisher_test_connection').addEventListener('click', testServerSettings);
    getElement('reply_polisher_manual_rewrite').addEventListener('click', manualRewriteLatest);
}

async function initExtension() {
    context = SillyTavern.getContext();
    settings = getSettings(context.extensionSettings);

    const html = await context.renderExtensionTemplateAsync(EXTENSION_FOLDER, 'settings');
    $('#extensions_settings2').append(html);

    syncBehaviorUi();
    bindUi();

    try {
        await loadServerSettings();
    } catch (error) {
        getElement('reply_polisher_key_status').textContent = 'Server plugin unavailable';
        console.warn(`[${MODULE_NAME}] Failed to load server settings:`, error);
    }

    const events = context.eventTypes || context.event_types;
    context.eventSource.makeLast(events.CHARACTER_MESSAGE_RENDERED, handleRenderedMessage);
    context.eventSource.on(events.MESSAGE_SWIPED, handleSwipedMessage);
}

jQuery(async () => {
    try {
        await initExtension();
    } catch (error) {
        console.error(`[${MODULE_NAME}] Initialization failed:`, error);
        toastr.error(error.message, 'Reply Polisher');
    }
});
