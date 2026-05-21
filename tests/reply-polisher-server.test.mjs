import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const plugin = require('../plugins/reply-polisher/index.js');

test('sanitizes settings without exposing the API key', () => {
    const sanitized = plugin._private.sanitizeSettings({
        baseUrl: 'https://api.example.test/v1',
        apiKey: 'sk-secret',
        model: 'writer-model',
    });

    assert.deepEqual(sanitized, {
        baseUrl: 'https://api.example.test/v1',
        model: 'writer-model',
        hasApiKey: true,
    });
});

test('normalizes OpenAI-compatible chat completions URLs', () => {
    assert.equal(
        plugin._private.buildChatCompletionsUrl('https://api.example.test/v1/'),
        'https://api.example.test/v1/chat/completions',
    );
    assert.equal(
        plugin._private.buildChatCompletionsUrl('https://api.example.test/v1/chat/completions'),
        'https://api.example.test/v1/chat/completions',
    );
});

test('normalizes OpenAI-compatible model list URLs', () => {
    assert.equal(
        plugin._private.buildModelsUrl('https://api.example.test/v1/'),
        'https://api.example.test/v1/models',
    );
    assert.equal(
        plugin._private.buildModelsUrl('https://api.example.test/v1/chat/completions'),
        'https://api.example.test/v1/models',
    );
    assert.equal(
        plugin._private.buildModelsUrl('https://api.example.test/v1/models'),
        'https://api.example.test/v1/models',
    );
});

test('builds a rewrite request with only the prompt and target text', () => {
    const payload = plugin._private.buildRewritePayload({
        model: 'writer-model',
        prompt: 'Make it concise.',
        text: 'The original assistant answer.',
        temperature: 0.3,
        maxTokens: 512,
    });

    assert.equal(payload.model, 'writer-model');
    assert.equal(payload.temperature, 0.3);
    assert.equal(payload.max_tokens, 512);
    assert.deepEqual(payload.messages, [
        {
            role: 'system',
            content: 'You rewrite only the provided text. Do not continue the conversation. Do not add explanations.',
        },
        {
            role: 'user',
            content: 'Rewrite instructions:\nMake it concise.\n\nText to rewrite:\nThe original assistant answer.',
        },
    ]);
    assert.equal(JSON.stringify(payload).includes('chat history'), false);
});

test('extracts non-empty rewrite text and rejects empty model output', () => {
    assert.equal(
        plugin._private.extractRewriteText({
            choices: [{ message: { content: '  Polished answer.  ' } }],
        }),
        'Polished answer.',
    );

    assert.throws(
        () => plugin._private.extractRewriteText({ choices: [{ message: { content: '   ' } }] }),
        /empty rewrite/i,
    );
});

test('extracts unique model ids from OpenAI-compatible model lists', () => {
    assert.deepEqual(
        plugin._private.extractModelIds({
            data: [
                { id: 'z-model' },
                { id: 'a-model' },
                { id: 'z-model' },
                { name: 'ignored-name-without-id' },
            ],
        }),
        ['a-model', 'z-model'],
    );

    assert.deepEqual(
        plugin._private.extractModelIds([{ id: 'direct-array-model' }]),
        ['direct-array-model'],
    );
});

test('lists models without requiring a configured model name', async () => {
    const calls = [];
    const models = await plugin._private.callListModels({
        config: {
            baseUrl: 'https://api.example.test/v1',
            apiKey: 'sk-secret',
            model: '',
        },
        fetchImpl: async (url, options) => {
            calls.push({ url, options });
            return {
                ok: true,
                json: async () => ({ data: [{ id: 'writer-a' }, { id: 'writer-b' }] }),
            };
        },
    });

    assert.deepEqual(models, ['writer-a', 'writer-b']);
    assert.equal(calls[0].url, 'https://api.example.test/v1/models');
    assert.equal(calls[0].options.method, 'GET');
    assert.equal(calls[0].options.headers.Authorization, 'Bearer sk-secret');
});

test('redacts API keys from error messages', () => {
    assert.equal(
        plugin._private.redactSensitiveText('upstream rejected sk-secret for account', { apiKey: 'sk-secret' }),
        'upstream rejected [redacted] for account',
    );
});

test('registers settings and rewrite routes under the plugin router', async () => {
    const routes = [];
    const router = {
        get(path, handler) {
            routes.push({ method: 'GET', path, handler });
        },
        post(path, handler) {
            routes.push({ method: 'POST', path, handler });
        },
    };

    await plugin.init(router);

    assert.deepEqual(
        routes.map(route => `${route.method} ${route.path}`),
        ['GET /settings', 'POST /settings', 'POST /models', 'POST /rewrite'],
    );
});
