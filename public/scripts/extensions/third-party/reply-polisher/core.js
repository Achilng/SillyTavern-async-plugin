export const MODULE_NAME = 'reply_polisher';

export const DEFAULT_SETTINGS = Object.freeze({
    enabled: false,
    autoRewrite: true,
    rewritePrompt: 'Rewrite the provided assistant reply to improve style, clarity, and consistency. Preserve the original meaning and do not add explanations.',
    timeoutMs: 60000,
    temperature: 0.7,
    maxTokens: 1024,
});

const SKIPPED_EVENT_TYPES = new Set(['continue', 'append', 'appendFinal', 'impersonate', 'quiet']);

export function getSettings(extensionSettings) {
    if (!extensionSettings[MODULE_NAME] || typeof extensionSettings[MODULE_NAME] !== 'object') {
        extensionSettings[MODULE_NAME] = structuredClone(DEFAULT_SETTINGS);
    }

    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
        if (!Object.hasOwn(extensionSettings[MODULE_NAME], key)) {
            extensionSettings[MODULE_NAME][key] = value;
        }
    }

    delete extensionSettings[MODULE_NAME].apiKey;
    delete extensionSettings[MODULE_NAME].baseUrl;
    delete extensionSettings[MODULE_NAME].model;

    return extensionSettings[MODULE_NAME];
}

export function shouldProcessEventType(type) {
    return !SKIPPED_EVENT_TYPES.has(type);
}

export function shouldProcessMessage(message, { allowProcessed = false } = {}) {
    if (!message || typeof message !== 'object') {
        return false;
    }

    if (message.is_user || message.is_system || message.extra?.isSmallSys || message.extra?.type === 'narrator') {
        return false;
    }

    if (!allowProcessed && message.extra?.reply_polisher?.processed) {
        return false;
    }

    return typeof message.mes === 'string' && message.mes.trim().length > 0;
}

export function createMessageSnapshot(context, messageId) {
    const message = context.chat?.[messageId];
    if (!message) {
        throw new Error(`Message #${messageId} was not found.`);
    }

    return {
        chatId: typeof context.getCurrentChatId === 'function' ? context.getCurrentChatId() : context.chatId,
        messageId,
        text: message.mes,
        swipeId: message.swipe_id,
    };
}

export function isSnapshotCurrent(context, snapshot) {
    const message = context.chat?.[snapshot.messageId];
    const chatId = typeof context.getCurrentChatId === 'function' ? context.getCurrentChatId() : context.chatId;

    return Boolean(message)
        && chatId === snapshot.chatId
        && message.mes === snapshot.text
        && message.swipe_id === snapshot.swipeId;
}

export function applyRewriteToMessage(message, rewriteText) {
    const text = typeof rewriteText === 'string' ? rewriteText.trim() : '';
    if (!text) {
        throw new Error('Rewrite text is empty.');
    }

    message.extra = message.extra && typeof message.extra === 'object' ? message.extra : {};
    message.mes = text;

    if (typeof message.extra.display_text === 'string') {
        message.extra.display_text = text;
    }

    message.extra.reply_polisher = {
        processed: true,
        processedAt: new Date().toISOString(),
    };

    if (Array.isArray(message.swipes) && typeof message.swipe_id === 'number') {
        message.swipes[message.swipe_id] = text;
    }

    if (Array.isArray(message.swipe_info) && typeof message.swipe_id === 'number' && message.swipe_info[message.swipe_id]) {
        message.swipe_info[message.swipe_id].extra = structuredClone(message.extra);
    }

    return message;
}

export function buildRewriteBody({ prompt, text, temperature, maxTokens, timeoutMs }) {
    return {
        prompt,
        text,
        temperature: Number(temperature),
        maxTokens: Number(maxTokens),
        timeoutMs: Number(timeoutMs),
    };
}

export function getLatestProcessableMessageId(context) {
    const chat = Array.isArray(context.chat) ? context.chat : [];
    for (let i = chat.length - 1; i >= 0; i -= 1) {
        if (shouldProcessMessage(chat[i])) {
            return i;
        }
    }

    return -1;
}
