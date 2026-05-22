# Reply Polisher

Reply Polisher is a SillyTavern server plugin for rewriting the latest assistant reply with a separately configured OpenAI-compatible model.

## Install

1. Copy this server plugin folder to `SillyTavern/plugins/reply-polisher`.
2. Install the UI extension from the repository URL, or copy `public/scripts/extensions/third-party/reply-polisher` into the SillyTavern `public/scripts/extensions/third-party` directory.
3. In SillyTavern `config.yaml`, set `enableServerPlugins: true`.
4. Restart SillyTavern.
5. Open Extensions settings and configure Reply Polisher.

From the repository root, you can also run:

```bash
bash install-server-plugin.sh /path/to/SillyTavern
```

On Windows, run it in Git Bash and quote Windows paths:

```bash
bash install-server-plugin.sh "D:\path\to\SillyTavern"
```

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

Model A remains SillyTavern's normal generation model. After SillyTavern receives and renders the generated assistant message, the UI extension sends only the rewrite prompt and that assistant text to the server plugin once. The server plugin calls Model B with an OpenAI-compatible Chat Completions request, then the UI extension replaces the original message in place.

Runtime notifications are numbered as `正在润色N`, `成功N`, and `失败N` so a single rewrite attempt can be traced through the UI.

If rewriting fails, the original Model A reply is kept and an error notification is shown.

## Troubleshooting

HTTP 404 from `/api/plugins/reply-polisher/...` means the UI extension is loaded but the server plugin route is missing or outdated. Confirm `SillyTavern/plugins/reply-polisher/index.js` exists, `enableServerPlugins: true` is set in `config.yaml`, the latest server plugin files were copied in, and SillyTavern has been restarted.

If the route exists but Model B still cannot be reached, remember the request is sent by the SillyTavern server process, not by the browser. Configure SillyTavern's `requestProxy` on that server if the model provider requires a proxy or a different network path.
