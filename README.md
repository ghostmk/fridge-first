# Fridge First

**“Have you eaten?”**

A small way to say you care. Even when you’re only cooking for yourself.

Fridge First is a personal kitchen notebook for what’s in your fridge, what you make with it, and the people you feed. Gemma helps with the first recipe. Your notes make it yours.

The extra lemon that worked. The thing you’d change next time. A simple “come over, I’ll cook.” There’s a place for those here, too.

## A little help with dinner

| When you want to… | Fridge First helps you… |
| --- | --- |
| Use what’s already there | Paste your ingredients, add quantities, and mark the things to use first. |
| Stop wondering what to cook | Ask Gemma for three recipes that fit your time and serving preferences. Let **Pick dinner** choose from the menu. |
| Make something again | Keep the full recipe in your book, with your earlier cooking notes beside it. |
| Remember how it went | Choose **I made this**, leave a note, and keep a dated supper entry. |
| Keep a little of the evening | Turn a supper entry into a postcard you can download as an image or text. |
| Have someone over | Make an invitation, choose what they could bring, and write it in your own words. |

All five main actions are on the homepage. You can start small: a couple of ingredients, one recipe worth keeping, a sentence for next time.

## Try it locally

You’ll need **Node.js 20 or newer**. From this project’s directory:

```sh
npm start
```

Open [localhost:4173](http://localhost:4173). There is no install step, API key, account, or separate inference server to set up.

**Want to look around first?** Choose **Have a peek at an example**. Three clearly labelled sample recipes let you try the recipe book, supper notes, postcards, and invitations without downloading or starting Gemma. These are prepared examples, not generated results.

A good first lap:

1. Open a sample recipe and choose **Keep this recipe**.
2. Choose **I made this** and leave a short note.
3. Keep the supper and open its postcard.
4. Choose **Make again**. Your note is waiting beside the recipe.

Open the served address rather than double-clicking `dist/index.html`; the app uses JavaScript modules that browsers block under `file://`.

## Start with whatever’s there

The ingredient field accepts a single item or a whole list:

```text
2 eggs
400g tomatoes
half a bag of rice
Spinach: 1 bag
```

Commas and semicolons work as separators too. Press **Enter** to add, or **Shift + Enter** for another line. Everyday ingredients also have one-tap buttons. Duplicate entries are skipped without replacing the quantities you already wrote down.

Add up to 16 ingredients, choose 15, 30, or 45 minutes, and set 1–4 servings. Check the oil, salt, and pepper setting against what you actually have. Tick **Use first** for anything you want to cook with sooner.

## Gemma on your device

Recipe generation uses **Gemma 3 1B** through **WebLLM 0.2.85**, running in a browser Web Worker. The selected model is `gemma3-1b-it-q4f16_1-MLC`.

Gemma starts only when you click **What could I cook?** You’ll need a browser with working WebGPU support. Compatible desktop Chrome or Edge configurations are a good starting point.

The first run downloads the model and compiled runtime and can take several minutes. Later visits may reuse cached model files. **Cancel** and **Stop Gemma and free memory** both terminate the worker. Opening the app or browsing saved recipes does not start it.

The app validates generated recipes before showing them and checks ingredient availability against your list in application code. Invalid output shows an error; it is never quietly replaced with the examples.

## Your notebook stays with you

Your ingredients, preferences, menu, recipe book, supper notes, and invitation draft are saved in this browser. Recipe inference runs on your device; the app does not send your ingredient list to a hosted inference API.

There are still network requests for the initial model and runtime downloads, and for Google Fonts. The kitchen illustration is bundled locally. Exported cards use system fonts. Full offline reopening is not guaranteed.

There is no cross-device sync. Clearing browser storage can remove your notebook. Storage failures are reported, and conflicting saves from another tab are checked before writing over newer data. Download recipes or postcards you want to keep outside the browser.

Invitations stay as drafts until you choose a copy, download, or share action. Nothing is sent automatically.

## A few things to know

- **Amounts stay human.** “Half a bag” is fine. After cooking, expand **What did you use?** to remove something you finished or change what’s left. Quantities are not automatically subtracted.
- **Saved recipes keep their quantities.** Changing your serving preference does not resize an existing recipe. Ask for a new menu when you need different portions.
- **Undo respects later edits.** A supper’s fridge changes can be reversed only while doing so would not overwrite newer ingredient changes.
- **Ingredient matching is conservative.** Names are normalized for case and spacing, but differently named ingredients can still appear missing. Being listed does not mean you have enough.
- **Use your cooking judgment.** Times and amounts are estimates. The app does not determine food safety or enforce allergy restrictions.

## Working on the app

The interface is plain HTML, CSS, and JavaScript. There is no build step or installed npm dependency; `dist/` contains the editable app source. WebLLM is loaded at runtime only when requested.

| File | Responsibility |
| --- | --- |
| `dist/app.js` | Interface and cooking flows |
| `dist/core.js` | Recipe prompt, validation, and sample recipes |
| `dist/worker.js` | Gemma loading and inference |
| `dist/entry.js` | Ingredient and quantity parsing |
| `dist/journal.js` | Saved state, recipe book, supper records, and undo |
| `dist/cards.js` | Postcard and invitation images and text exports |
| `dist/index.html`, `dist/style.css` | Page structure and visual design |
| `serve.mjs` | Local development server |

Run the checks with:

```sh
npm run check
npm test
```

The 21 automated tests cover recipe validation, ingredient parsing, save and reload, meal records, safe undo, invitations, storage conflicts, recovery backups, and export text wrapping.

Browser checks have covered sample recipes, saving a recipe, recording a supper, postcard previews, invitations, and returning to a recipe with an earlier note. **Live Gemma inference, native sharing, and optional WebMCP registration still need end-to-end verification.**

Supporting browsers can optionally expose WebMCP tools for reading or replacing the ingredient list. These tools do not start Gemma.

## If something gets stuck

| What you see | What to try |
| --- | --- |
| The HTML opens but buttons do nothing | Run `npm start` and use the localhost address. |
| WebGPU is unavailable | Use the sample recipes, or try a compatible browser with hardware acceleration enabled. |
| A model download or generation takes too long | Choose **Cancel** to stop the worker. Your saved notebook remains. |
| Copy or sharing is unavailable | Use the text or image download. Clipboard failure also exposes selectable text. |
| Another tab saved newer changes | Download this tab’s data using the offered control before reloading if you need to keep its unsaved changes. |

## Credits and license

- [Gemma 3](https://ai.google.dev/gemma/docs/core/model_card_3) by Google. Model weights are downloaded separately and use Gemma’s own terms.
- [WebLLM](https://github.com/mlc-ai/web-llm), licensed under Apache-2.0.
- Newsreader and Caveat, served by Google Fonts.
- Original kitchen table SVG, included in this project.

Application code is [MIT licensed](LICENSE). Third-party models, libraries, and fonts retain their own terms.

Made for the people you feed, with <3
