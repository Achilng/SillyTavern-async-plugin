import {
    MODULE_NAME,
    buildRewriteBody,
    applyRewriteToMessage,
    createMessageIdentity,
    createMessageSnapshot,
    getLatestProcessableMessageId,
    getSettings,
    isSameMessageIdentity,
    isSnapshotTargetCurrent,
    runInBackground,
    shouldProcessEventType,
    shouldProcessMessage,
} from './core.js';

const EXTENSION_FOLDER = new URL('.', import.meta.url).pathname
    .replace(/^\/scripts\/extensions\//, '')
    .replace(/\/$/, '');
const API_BASE = '/api/plugins/reply-polisher';
const RUNTIME_KEY = '__replyPolisherRuntime';
const SERVER_PLUGIN_UNAVAILABLE_MESSAGE = 'Reply Polisher 服务端插件不可用或版本过旧：请确认已安装最新服务端插件，已设置 enableServerPlugins: true，并重启 SillyTavern。';

const runtime = window[RUNTIME_KEY] || {
    activeRewrites: new Set(),
    autoRewriteAttempts: new Set(),
    pendingAutoRewriteMessages: new Map(),
    attemptCounter: 0,
};
window[RUNTIME_KEY] = runtime;

let context;
let settings;
let serverSettings = {
    baseUrl: '',
    model: '',
    hasApiKey: false,
};
const activeRewrites = runtime.activeRewrites;
const autoRewriteAttempts = runtime.autoRewriteAttempts;
const pendingAutoRewriteMessages = runtime.pendingAutoRewriteMessages;
let generationState = null;

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

function getConnectionFormSettings() {
    return {
        baseUrl: getElement('reply_polisher_base_url').value,
        model: getElement('reply_polisher_model').value,
        apiKey: getElement('reply_polisher_api_key').value,
        clearApiKey: getElement('reply_polisher_clear_api_key').checked,
    };
}

function hasUnsavedConnectionInput() {
    const connection = getConnectionFormSettings();

    return connection.baseUrl.trim() !== (serverSettings.baseUrl || '')
        || connection.model.trim() !== (serverSettings.model || '')
        || connection.apiKey.length > 0
        || connection.clearApiKey;
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
    getElement('reply_polisher_key_status').textContent = serverSettings.hasApiKey ? 'API key 已保存' : '未保存 API key';
    syncModelList([]);
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

function syncModelList(models) {
    const select = getElement('reply_polisher_model_list');
    if (!select) {
        return;
    }

    const modelInput = getElement('reply_polisher_model');
    const currentModel = modelInput?.value || '';
    select.innerHTML = '';

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = models.length > 0 ? '选择模型...' : '尚未获取模型列表';
    select.append(placeholder);

    for (const model of models) {
        const option = document.createElement('option');
        option.value = model;
        option.textContent = model;
        option.selected = model === currentModel;
        select.append(option);
    }

    select.disabled = models.length === 0;
}

async function pluginFetch(path, options = {}) {
    const headers = {
        ...(typeof context.getRequestHeaders === 'function' ? context.getRequestHeaders() : {}),
        ...(options.headers || {}),
    };

    if (options.body && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }

    let response;
    try {
        response = await fetch(`${API_BASE}${path}`, {
            ...options,
            headers,
        });
    } catch (error) {
        throw new Error(`无法访问 Reply Polisher 服务端插件：${error.message}`);
    }

    let data = null;
    let responseText = '';
    try {
        responseText = await response.text();
        data = responseText ? JSON.parse(responseText) : null;
    } catch {
        data = null;
    }

    if (!response.ok) {
        if (response.status === 404) {
            throw new Error(SERVER_PLUGIN_UNAVAILABLE_MESSAGE);
        }

        const fallbackText = responseText.replace(/\s+/g, ' ').trim().slice(0, 200);
        throw new Error(data?.error || fallbackText || `Reply Polisher 请求失败，HTTP ${response.status}。`);
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
            body: JSON.stringify(getConnectionFormSettings()),
        });
        syncServerUi();
        toastr.success('模型 B 设置已保存。', 'Reply Polisher');
    } catch (error) {
        toastr.error(error.message, 'Reply Polisher');
    } finally {
        setButtonBusy(button, false);
    }
}

async function loadModelList() {
    const button = getElement('reply_polisher_load_models');
    setButtonBusy(button, true);

    try {
        const result = await pluginFetch('/models', {
            method: 'POST',
            body: JSON.stringify({
                baseUrl: getElement('reply_polisher_base_url').value,
                apiKey: getElement('reply_polisher_api_key').value,
                clearApiKey: getElement('reply_polisher_clear_api_key').checked,
                timeoutMs: settings.timeoutMs,
            }),
        });
        const models = Array.isArray(result.models) ? result.models : [];
        syncModelList(models);

        if (models.length === 0) {
            toastr.warning('未获取到模型列表。', 'Reply Polisher');
            return;
        }

        toastr.success(`已获取 ${models.length} 个模型。`, 'Reply Polisher');
    } catch (error) {
        toastr.error(error.message, 'Reply Polisher');
    } finally {
        setButtonBusy(button, false);
    }
}

function selectModelFromList() {
    const value = getElement('reply_polisher_model_list').value;
    if (!value) {
        return;
    }

    getElement('reply_polisher_model').value = value;
}

async function testServerSettings() {
    updateBehaviorSetting();

    const button = getElement('reply_polisher_test_connection');
    setButtonBusy(button, true);

    try {
        const connection = getConnectionFormSettings();
        const result = await pluginFetch('/test', {
            method: 'POST',
            body: JSON.stringify({
                ...buildRewriteBody({
                    prompt: settings.rewritePrompt || '清晰地返回所提供的文本。',
                    text: 'Reply Polisher 连接测试。',
                    temperature: settings.temperature,
                    maxTokens: Math.min(Number(settings.maxTokens) || 1024, 128),
                    timeoutMs: settings.timeoutMs,
                }),
                ...connection,
            }),
        });

        const message = result.text && hasUnsavedConnectionInput()
            ? '模型 B 已响应。请保存模型设置后再自动润色。'
            : '模型 B 已响应。';
        toastr.success(message, 'Reply Polisher');
    } catch (error) {
        toastr.error(error.message, 'Reply Polisher');
    } finally {
        setButtonBusy(button, false);
    }
}

function getMessageById(messageId) {
    return context.chat?.[messageId];
}

function getLatestAssistantIdentity() {
    const messageId = getLatestProcessableMessageId(context, { allowProcessed: true });
    return messageId >= 0 ? createMessageIdentity(context, messageId) : null;
}

function getIdentityKey(identity) {
    return [
        identity?.chatId ?? '',
        identity?.messageId ?? '',
        identity?.swipeId ?? '',
        identity?.textHash ?? '',
        identity?.sendDate ?? '',
        identity?.genFinished ?? '',
    ].join('|');
}

function rememberAutoRewriteAttempt(identity) {
    autoRewriteAttempts.add(getIdentityKey(identity));

    if (autoRewriteAttempts.size > 100) {
        autoRewriteAttempts.delete(autoRewriteAttempts.values().next().value);
    }
}

function nextAttemptId() {
    runtime.attemptCounter += 1;
    return runtime.attemptCounter;
}

function showRewriteStart(attemptId, manual) {
    toastr.info(manual ? `正在润色${attemptId}（手动）` : `正在润色${attemptId}`, 'Reply Polisher');
}

function showRewriteSuccess(attemptId, manual) {
    toastr.success(manual ? `成功${attemptId}：最新回复已润色。` : `成功${attemptId}：自动润色完成。`, 'Reply Polisher');
}

function showRewriteFailure(attemptId, message) {
    toastr.error(`失败${attemptId}：${message}`, 'Reply Polisher');
}

function showRewriteWarning(attemptId, message) {
    toastr.warning(`失败${attemptId}：${message}`, 'Reply Polisher');
}

function getPendingMessageKey(messageId, type) {
    return `${messageId}:${type ?? ''}`;
}

function doesReceivedTypeMatchGeneration(receivedType, generationType) {
    return receivedType === generationType || (generationType === 'regenerate' && receivedType === 'normal');
}

async function rewriteMessage(messageId, { manual = false, type = undefined, attemptId = undefined } = {}) {
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
            toastr.warning('改写提示词为空。', 'Reply Polisher');
        }
        return;
    }

    activeRewrites.add(key);
    const rewriteAttemptId = attemptId ?? nextAttemptId();
    showRewriteStart(rewriteAttemptId, manual);

    try {
        const snapshot = createMessageSnapshot(context, messageId);
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

        const currentMessage = getMessageById(messageId);
        if (!isSnapshotTargetCurrent(context, snapshot)) {
            showRewriteWarning(rewriteAttemptId, '目标回复或 swipe 已变化，已保留当前回复。');
            return;
        }

        if (currentMessage.mes !== snapshot.text) {
            showRewriteWarning(rewriteAttemptId, '回复在润色期间已变化，已保留当前回复。');
            return;
        }

        applyRewriteToMessage(currentMessage, result.text);
        context.updateMessageBlock(messageId, currentMessage);
        await context.saveChat();

        showRewriteSuccess(rewriteAttemptId, manual);
    } catch (error) {
        showRewriteFailure(rewriteAttemptId, error.message);
    } finally {
        activeRewrites.delete(key);
    }
}

function handleGenerationStarted(type, _options, dryRun) {
    if (dryRun) {
        generationState = null;
        return;
    }

    generationState = {
        type,
        stopped: false,
        previousLatestAssistant: getLatestAssistantIdentity(),
    };
}

function handleGenerationStopped() {
    if (generationState) {
        generationState.stopped = true;
    }
}

function handleMessageReceived(messageId, type) {
    const numericMessageId = Number(messageId);
    if (!Number.isInteger(numericMessageId)) {
        return;
    }

    const state = generationState;
    if (!state || state.stopped || !doesReceivedTypeMatchGeneration(type, state.type) || !shouldProcessEventType(type)) {
        return;
    }

    const message = getMessageById(numericMessageId);
    if (!shouldProcessMessage(message)) {
        return;
    }

    const identity = createMessageIdentity(context, numericMessageId);
    if (isSameMessageIdentity(identity, state.previousLatestAssistant)) {
        return;
    }

    const identityKey = getIdentityKey(identity);
    if (autoRewriteAttempts.has(identityKey)) {
        return;
    }

    pendingAutoRewriteMessages.set(getPendingMessageKey(numericMessageId, type), {
        identity,
        type,
    });

    if (generationState === state) {
        generationState = null;
    }
}

function runAutoRewriteForRenderedMessage(messageId, type) {
    const key = getPendingMessageKey(messageId, type);
    const pending = pendingAutoRewriteMessages.get(key);
    if (!pending) {
        return;
    }

    pendingAutoRewriteMessages.delete(key);

    const currentIdentity = createMessageIdentity(context, messageId);
    if (!isSameMessageIdentity(currentIdentity, pending.identity)) {
        return;
    }

    const identityKey = getIdentityKey(currentIdentity);
    if (autoRewriteAttempts.has(identityKey)) {
        return;
    }

    rememberAutoRewriteAttempt(currentIdentity);
    const attemptId = nextAttemptId();

    runInBackground(rewriteMessage(messageId, { type: pending.type, attemptId }), error => {
        console.error(`[${MODULE_NAME}] Auto rewrite failed:`, error);
    });

}

function handleRenderedMessage(messageId, type) {
    const numericMessageId = Number(messageId);
    if (!Number.isInteger(numericMessageId)) {
        return;
    }

    setTimeout(() => runAutoRewriteForRenderedMessage(numericMessageId, type), 100);
}

async function manualRewriteLatest() {
    updateBehaviorSetting();

    const messageId = getLatestProcessableMessageId(context, { allowProcessed: true });
    if (messageId < 0) {
        toastr.warning('没有可润色的助手回复。', 'Reply Polisher');
        return;
    }

    await rewriteMessage(messageId, { manual: true, attemptId: nextAttemptId() });
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
    getElement('reply_polisher_load_models').addEventListener('click', loadModelList);
    getElement('reply_polisher_model_list').addEventListener('change', selectModelFromList);
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
        const status = getElement('reply_polisher_key_status');
        status.textContent = '服务器插件不可用';
        status.title = error.message;
        console.warn(`[${MODULE_NAME}] Failed to load server settings:`, error);
    }

    const events = context.eventTypes || context.event_types;
    context.eventSource.on(events.GENERATION_STARTED, handleGenerationStarted);
    context.eventSource.on(events.GENERATION_STOPPED, handleGenerationStopped);
    context.eventSource.on(events.MESSAGE_RECEIVED, handleMessageReceived);
    context.eventSource.makeLast(events.CHARACTER_MESSAGE_RENDERED, handleRenderedMessage);
}

jQuery(async () => {
    try {
        await initExtension();
    } catch (error) {
        console.error(`[${MODULE_NAME}] Initialization failed:`, error);
        toastr.error(error.message, 'Reply Polisher');
    }
});
