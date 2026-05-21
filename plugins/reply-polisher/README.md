# Reply Polisher

Reply Polisher is a SillyTavern server plugin for rewriting the latest assistant reply with a separately configured OpenAI-compatible model.

## Install

1. Copy `plugins/reply-polisher` into the SillyTavern `plugins` directory.
2. Copy `public/scripts/extensions/third-party/reply-polisher` into the SillyTavern `public/scripts/extensions/third-party` directory.
3. In SillyTavern `config.yaml`, set `enableServerPlugins: true`.
4. Restart SillyTavern.
5. Open Extensions settings and configure Reply Polisher.

## Configuration

The UI extension stores only behavior settings such as enabled state, rewrite prompt, timeout, temperature, and max token count.

The server plugin stores Model B settings in `plugins/reply-polisher/config.json`:

```json
{
    "baseUrl": "https://api.example.com/v1",
    "apiKey": "",
    "model": "model-b-name"
}
```

The real API key is never returned by `GET /api/plugins/reply-polisher/settings`; the route only returns `baseUrl`, `model`, and `hasApiKey`.

## Behavior

Model A remains SillyTavern's normal generation model. After an assistant message renders, the UI extension sends only the rewrite prompt and the latest assistant text to the server plugin. The server plugin calls Model B with an OpenAI-compatible Chat Completions request, then the UI extension replaces the original message in place.

If rewriting fails, the original Model A reply is kept and an error notification is shown.
