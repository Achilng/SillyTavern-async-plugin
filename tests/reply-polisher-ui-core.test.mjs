import test from 'node:test';
import assert from 'node:assert/strict';

const core = await import('../public/scripts/extensions/third-party/reply-polisher/core.js');

test('filters messages that must not be rewritten automatically', () => {
    assert.equal(core.shouldProcessMessage({ is_user: true, mes: 'user' }), false);
    assert.equal(core.shouldProcessMessage({ is_system: true, mes: 'system' }), false);
    assert.equal(core.shouldProcessMessage({ extra: { isSmallSys: true }, mes: 'small system' }), false);
    assert.equal(core.shouldProcessMessage({ mes: '' }), false);
    assert.equal(core.shouldProcessMessage({ mes: 'done', extra: { reply_polisher: { processed: true } } }), false);
    assert.equal(core.shouldProcessMessage({ mes: 'assistant reply', extra: {} }), true);
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
