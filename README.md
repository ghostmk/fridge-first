# Fridge First

“Have you eaten?” A small way to say you care, even when you’re only cooking for yourself.

A personal kitchen notebook for the things you have, the meals you make, and the people you feed. Find something to cook, keep the recipes that become yours, and leave a few words for next time.

## Your kitchen

- **Start with what’s there.** Type or paste ingredients into one field. Quantities such as `2 eggs`, `400g tomatoes`, and `half a bag of rice` work too. Mark anything you want to use first.
- **Find dinner.** Ask Gemma for three recipes for your ingredients, time, and number of people. Pick dinner helps choose from your menu when deciding feels like work.
- **Keep your recipes.** Save favourites and return to them with your previous cooking notes alongside. Ingredient availability updates as your fridge changes.
- **Remember the evening.** “I made this” starts with an optional note. Expand the ingredient section to record what you used and update what’s left. Turn the entry into a supper postcard.
- **Ask someone over.** Choose what a friend could bring, add a few words, and save or share an invitation. Nothing is sent automatically.

Your fridge, recipes, supper notes, and invitation draft are saved in this browser. No account is needed. There is no cross-device sync.

## Run locally

Use Node.js 20 or newer:

```sh
npm start
```

Open **http://localhost:4173**. No package installation, API key, or inference server is required. Open the served address rather than the HTML file directly, so the browser can load JavaScript modules.

Choose **Have a peek at an example** to explore the app without loading a model. These three prepared sample recipes are clearly labelled and work with the recipe book, supper notes, postcards, and invitations.

## Gemma on your device

New recipe suggestions use Gemma 3 1B (`gemma3-1b-it-q4f16_1-MLC`) through WebLLM 0.2.85 in a browser Web Worker. Use a browser with working WebGPU support, such as a compatible desktop Chrome or Edge configuration.

Gemma starts only when you click **What could I cook?** The first run downloads the model and compiled runtime, which can take several minutes. **Stop Gemma and free memory** or **Cancel** terminates the worker. Model files can remain cached for later visits.

Inference runs in the browser rather than on a remote inference service. Initial downloads need internet access, and offline reopening is not guaranteed. The interface uses Google Fonts; exported postcards use system fonts and the kitchen illustration is bundled locally.

Recipe output must pass application validation before appearing: three distinct recipes, valid time limits, complete steps, and an ingredient from your list in each recipe. The app checks ingredient availability itself. Invalid model output produces an error rather than being silently replaced with sample recipes.

## A few practical details

Ingredient quantities are free text. The app does not automatically subtract amounts or assume you have enough of something. When recording a meal, you decide whether an ingredient stays, is removed, or has a new remaining quantity. Undo restores fridge changes only when later edits would not be overwritten.

Recipes keep their original amounts and serving counts. Ingredient matching uses normalized names, so differently named ingredients can appear missing. Cooking times and quantities are estimates; the app does not determine food safety or enforce allergy restrictions.

Storage failures are reported, and newer data saved by another tab is protected against stale writes. Recoverable saved data is backed up before repair. Postcards and invitations can be downloaded as PNG or text; clipboard and native sharing depend on browser support.

## Development

Plain HTML, CSS, and JavaScript with no build step or package dependencies. The app is served from `dist/`.

```sh
npm run check
npm test
```

The 21 automated tests cover recipe validation, ingredient entry, save and reload, meal records, safe undo, invitations, storage conflicts, recovery backups, and image-export text wrapping. Browser checks have covered sample recipes, saving a recipe, supper notes, postcard previews, invitations, and returning to a recipe with an earlier note. Live model inference, native sharing, and optional WebMCP registration still need end-to-end verification.

Optional WebMCP tools expose the ingredient list in supporting browsers. They do not start the model.

## Credits and license

- [Gemma 3](https://ai.google.dev/gemma/docs/core/model_card_3) by Google. Model weights are downloaded separately and are subject to Gemma’s terms.
- [WebLLM](https://github.com/mlc-ai/web-llm), Apache-2.0.
- Newsreader and Caveat, served by Google Fonts.
- Original kitchen table SVG, bundled with the app.

Application code is [MIT licensed](LICENSE). Third-party models, libraries, and fonts retain their own terms.
