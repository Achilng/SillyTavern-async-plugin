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

export function getTextFingerprint(text) {
    const value = String(text ?? '');
    let hash = 0;

    for (let i = 0; i < value.length; i += 1) {
        hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
    }

    return `${value.length}:${hash >>> 0}`;
}

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

export function isMessageProcessedForCurrentText(message) {
    const marker = message?.extra?.reply_polisher;

    return Boolean(marker?.processed
        && marker.swipeId === message.swipe_id
        && marker.textHash === getTextFingerprint(message.mes));
}

export function shouldProcessMessage(message, { allowProcessed = false } = {}) {
    if (!message || typeof message !== 'object') {
        return false;
    }

    if (message.is_user || message.is_system || message.extra?.isSmallSys || message.extra?.type === 'narrator') {
        return false;
    }

    if (!allowProcessed && isMessageProcessedForCurrentText(message)) {
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

export function createMessageIdentity(context, messageId) {
    const message = context.chat?.[messageId];
    if (!message) {
        return null;
    }

    return {
        chatId: typeof context.getCurrentChatId === 'function' ? context.getCurrentChatId() : context.chatId,
        messageId,
        swipeId: message.swipe_id,
        textHash: getTextFingerprint(message.mes),
        sendDate: String(message.send_date ?? ''),
        genFinished: String(message.gen_finished ?? ''),
    };
}

export function isSameMessageIdentity(left, right) {
    return Boolean(left && right
        && left.chatId === right.chatId
        && left.messageId === right.messageId
        && left.swipeId === right.swipeId
        && left.textHash === right.textHash
        && left.sendDate === right.sendDate
        && left.genFinished === right.genFinished);
}

export function isSnapshotCurrent(context, snapshot) {
    return isSnapshotTargetCurrent(context, snapshot)
        && context.chat?.[snapshot.messageId]?.mes === snapshot.text;
}

export function isSnapshotTargetCurrent(context, snapshot) {
    const message = context.chat?.[snapshot.messageId];
    const chatId = typeof context.getCurrentChatId === 'function' ? context.getCurrentChatId() : context.chatId;

    return Boolean(message)
        && chatId === snapshot.chatId
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
        swipeId: message.swipe_id,
        textHash: getTextFingerprint(text),
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

export function runInBackground(work, onError = console.error) {
    Promise.resolve(work).catch(onError);
}

export function getLatestProcessableMessageId(context, options = {}) {
    const chat = Array.isArray(context.chat) ? context.chat : [];
    for (let i = chat.length - 1; i >= 0; i -= 1) {
        if (shouldProcessMessage(chat[i], options)) {
            return i;
        }
    }

    return -1;
}
