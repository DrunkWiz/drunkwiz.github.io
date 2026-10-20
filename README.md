# 🧾 drunkwiz.github.io

> **A personal corner of the web that prints you a receipt.**
> 🔗 Live site: [drunkwiz.github.io](https://drunkwiz.github.io/)

---

```
            drunkwiz
           Singapore
        Receipt no. 0001
 ----------------------------------
 Lead Time                Track win
 Recall                         2nd
 Voucher Kaki              Finalist
 +5 more                    Shipped
 ----------------------------------
 TOTAL                   8 projects

      Thank you. Come again.
```

Every visit starts with a thermal receipt printing out of a slot beside a results strip (8 shipped · 1 track win · 1 runner-up · 1 finalist) that is counted from the receipt itself. Below it, every project gets a real screen, three things I built, its stack and a stamped result. The receipt is then yours to tear off. Hand-written HTML, CSS and JS: no framework, no build step, nothing to install.

---

## 🎨 The palette

Each colour comes from the receipt or the table it's printed on.

| Colour | Hex | Where it shows up |
| :--- | :--- | :--- |
| 🟩 **Table green** | `#183F38` | The background, like a laminated counter |
| 🟫 **Slot** | `#123029` | The printer slot and the post slot |
| 📜 **Paper** | `#FBFAF5` | The receipt itself |
| ⬛ **Thermal ink** | `#34333A` | Everything printed on the receipt |
| 🟥 **Stamp red** | `#C9372F` | Result stamps, the headline highlight and hard mode. Always inked on paper, never straight on green, so it stays readable |
| ⬜ **Chalk** | `#EEF0E8` | Headings and buttons on the green |
| 🩶 **Rim** | `#7FA49A` | The lip of the post slot, which flashes when something lands |

Type is [Schibsted Grotesk](https://fonts.google.com/specimen/Schibsted+Grotesk) for the page and [Azeret Mono](https://fonts.google.com/specimen/Azeret+Mono) for anything printed.

---

## ✂️ Tear it off

Under the printer there's a post slot, and its lip has a shape. Tear the receipt in that shape and the piece slides into the slot. Miss, and it falls off the screen.

- **Desktop:** grab the receipt and drag sideways. The tear follows your cursor up and down.
- **Phone:** swipe sideways across the receipt. Swiping up or down still scrolls the page.
- **Tap or click** without dragging and the printer tears the shape for you.
- **Any height works.** Only the shape of your tear is checked, so you can rip through the header, the stats or the barcode.
- After each tear you get a match score, and a new numbered receipt prints a few seconds later with a new slot shape.

| Mode | Slot shapes | Fit needed |
| :--- | :--- | :--- |
| Normal | wave, hill, valley, step, ramp, plateau, notch, twin peaks, swoop, ledge | about 65% |
| 🟥 **Hard** | zigzag, stairs, crown, lightning, ripple, tooth, castle, spike | about 73%, and taps no longer help |

Hard mode is remembered in your browser. To reset it, paste this in the console:

```js
localStorage.removeItem('vk-hard'); location.reload();
```

To make it easier or harder, change `FIT` near the top of `assets/receipt.js`. Higher numbers are more forgiving.

---

## 🚀 What's on the receipt

| Result | Project | What it is |
| :---: | :--- | :--- |
| 🏆 | [Lead Time](https://lead-time-cjnn.onrender.com) | Tells small food businesses which overseas food trends are heading to Singapore. *ForgeHacks Online 2026, Business + AI track winner* |
| 🥈 | **Recall** | Helps card members recognise charges they've forgotten, without ever being sure on their behalf. *American Express AI Hackathon 2026* |
| 🏁 | [Voucher Kaki](https://simplify-ai-hackathon.vercel.app) | Finds CDC-voucher eateries near you, in four languages. *SimplifyNext IGNITE 2026, finalist* |
| 📮 | [AgentShopper](https://agentshopper.streamlit.app/) | Makes a product catalogue readable to AI shopping assistants, then proves it worked. *NUS LifeHack 2026* |
| 📮 | [Pinch](https://pinch-htpl.onrender.com) | Interviews your grandparent while they cook and never guesses an amount. *Build With AI: Basics 2026* |
| 📮 | [ChainCheck](https://chaincheck-dxj5.onrender.com) | Checks an investment offer against the scam playbook and never calls anything safe. *WarriorHacks 2.0* |
| 📮 | [Clause](https://clause-p7uk.onrender.com) | Drafts a health insurance appeal where every sentence quotes the plan it rests on. *ML Build Challenge 3* |
| 📮 | [Fridge Rescue](https://drunkwiz.github.io/fridge-rescue/) | A food-waste app with a pixel pet that sends surplus to a food bank. *RevenueCat Shipaton 2026* |

🏆 track winner · 🥈 placed · 🏁 finalist · 📮 submitted

---

## 🗂 What's where

| File | What it is |
| :--- | :--- |
| `index.html` | Hero, receipt, the top three by result, the rest in a grid, the closing receipt |
| `projects.html` | The ledger, then every project with its full story |
| `404.html` | A voided receipt. Asset paths are absolute because Pages serves it at any missing URL |
| `assets/site.css` | All styles for all three pages |
| `assets/site.js` | Counts the results strip from the receipt, and thunks the stamps in as cards scroll into view |
| `assets/receipt.js` | The tear-off game |
| `assets/shots/` | Real screens as WebP, captured from the live demos or taken from each project's repo |
| `assets/og.png` | The share card, a rendered receipt |

Motion respects `prefers-reduced-motion`: the receipt appears without printing, the stamps are already down, and screens don't scroll.

---

## ➕ Adding a project

1. **Screen:** save a WebP in `assets/shots/` (about 1100px wide for desktop screens, 560px for phones).
2. **`index.html`:** copy an `<article class="mini">` block into the grid. If it placed, it goes in the top section as an `<article class="feat">` instead, ordered by result.
3. **`projects.html`:** add a ledger row and an `<article class="feat">` with the story.
4. **The receipt in `index.html`:** a placed or finalist project gets its own line with `data-result="win|second|finalist"`. Otherwise bump `data-count` and the label on the `+N more` line. The results strip and total update themselves.
5. Bump the counts in the closing receipt, the meta description and `og:description`.

Push to `main` and [the workflow](.github/workflows/static.yml) publishes it in about 20 seconds.

---

## 💻 Local preview

There's nothing to build. Open `index.html` in a browser, or serve the folder:

```sh
python -m http.server 8000
```

Then visit **[http://localhost:8000](http://localhost:8000)**.

---

<div align="center">

Printed in Singapore by Nathan 🧾 · Questions? [github.com/DrunkWiz](https://github.com/DrunkWiz)

*Thank you. Come again.*

</div>
