import test from 'node:test';
import assert from 'node:assert/strict';

const core = await import('../public/scripts/extensions/third-party/reply-polisher/core.js');

test('filters messages that must not be rewritten automatically', () => {
    assert.equal(core.shouldProcessMessage({ is_user: true, mes: 'user' }), false);
    assert.equal(core.shouldProcessMessage({ is_system: true, mes: 'system' }), false);
    assert.equal(core.shouldProcessMessage({ extra: { isSmallSys: true }, mes: 'small system' }), false);
    assert.equal(core.shouldProcessMessage({ mes: '' }), false);
    assert.equal(core.shouldProcessMessage({
        mes: 'done',
        swipe_id: 0,
        extra: { reply_polisher: { processed: true, swipeId: 0, textHash: core.getTextFingerprint('done') } },
    }), false);
    assert.equal(core.shouldProcessMessage({ mes: 'assistant reply', extra: {} }), true);
});

test('allows stale processed markers copied to a new swipe', () => {
    const message = {
        mes: 'new swipe text',
        swipe_id: 2,
        extra: {
            reply_polisher: {
                processed: true,
                swipeId: 1,
                textHash: core.getTextFingerprint('old swipe text'),
            },
        },
    };

    assert.equal(core.shouldProcessMessage(message), true);
});

test('skips continue events while allowing normal and swipe events', () => {
    assert.equal(core.shouldProcessEventType('continue'), false);
    assert.equal(core.shouldProcessEventType('swipe'), true);
    assert.equal(core.shouldProcessEventType(undefined), true);
});

test('captures and validates the latest message snapshot', () => {
    const context = {
        getCurrentChatId: () => 'chat-a',
        chat: [{ mes: 'hello', swipe_id: 1 }],
    };

    const snapshot = core.createMessageSnapshot(context, 0);

    assert.deepEqual(snapshot, {
        chatId: 'chat-a',
        messageId: 0,
        text: 'hello',
        swipeId: 1,
    });
    assert.equal(core.isSnapshotCurrent(context, snapshot), true);

    context.chat[0].mes = 'edited';
    assert.equal(core.isSnapshotCurrent(context, snapshot), false);
    assert.equal(core.isSnapshotTargetCurrent(context, snapshot), true);

    context.chat[0].swipe_id = 2;
    assert.equal(core.isSnapshotTargetCurrent(context, snapshot), false);
});

test('message identity detects whether generation produced a new target', () => {
    const context = {
        getCurrentChatId: () => 'chat-a',
        chat: [{
            mes: 'old reply',
            swipe_id: 0,
            send_date: '2026-05-22T10:00:00',
            gen_finished: '2026-05-22T10:00:01',
        }],
    };

    const before = core.createMessageIdentity(context, 0);
    const same = core.createMessageIdentity(context, 0);

    assert.equal(core.isSameMessageIdentity(before, same), true);

    context.chat[0].mes = 'regenerated reply';
    context.chat[0].gen_finished = '2026-05-22T10:01:01';

    const after = core.createMessageIdentity(context, 0);
    assert.equal(core.isSameMessageIdentity(before, after), false);
});

test('detects processed markers for the current text only', () => {
    const message = {
        mes: 'polished',
        swipe_id: 1,
        extra: { reply_polisher: { processed: true, swipeId: 1, textHash: core.getTextFingerprint('polished') } },
    };

    assert.equal(core.isMessageProcessedForCurrentText(message), true);

    message.mes = 'changed by another handler';
    assert.equal(core.isMessageProcessedForCurrentText(message), false);
});

test('applies rewrite in place and syncs active swipe metadata', () => {
    const message = {
        mes: 'draft',
        swipe_id: 1,
        swipes: ['old a', 'draft'],
        swipe_info: [{ extra: {} }, { extra: { model: 'a' } }],
        extra: { model: 'a' },
    };

    core.applyRewriteToMessage(message, 'polished');

    assert.equal(message.mes, 'polished');
    assert.equal(message.swipes[1], 'polished');
    assert.equal(message.extra.reply_polisher.processed, true);
    assert.equal(message.extra.reply_polisher.swipeId, 1);
    assert.equal(message.extra.reply_polisher.textHash, core.getTextFingerprint('polished'));
    assert.equal(message.swipe_info[1].extra.reply_polisher.processed, true);
});

test('builds rewrite body without chat context fields', () => {
    const body = core.buildRewriteBody({
        prompt: 'Improve style.',
        text: 'Only this text.',
        temperature: 0.8,
        maxTokens: 1000,
        timeoutMs: 30000,
    });

    assert.deepEqual(body, {
        prompt: 'Improve style.',
        text: 'Only this text.',
        temperature: 0.8,
        maxTokens: 1000,
        timeoutMs: 30000,
    });
    assert.equal(Object.hasOwn(body, 'chat'), false);
    assert.equal(Object.hasOwn(body, 'history'), false);
    assert.equal(Object.hasOwn(body, 'character'), false);
});

test('runs asynchronous work without returning a blocking promise', async () => {
    let completed = false;
    const returned = core.runInBackground(
        Promise.resolve().then(() => {
            completed = true;
        }),
        () => {},
    );

    assert.equal(returned, undefined);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(completed, true);
});

test('can find the latest assistant reply for manual rewriting even if already processed', () => {
    const context = {
        chat: [{
            is_user: false,
            mes: 'processed reply',
            swipe_id: 0,
            extra: { reply_polisher: { processed: true, swipeId: 0, textHash: core.getTextFingerprint('processed reply') } },
        }],
    };

    assert.equal(core.getLatestProcessableMessageId(context), -1);
    assert.equal(core.getLatestProcessableMessageId(context, { allowProcessed: true }), 0);
});
