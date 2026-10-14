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
 Pinch                    Submitted
 AgentShopper             Submitted
 ----------------------------------
 TOTAL                   5 projects

      Thank you. Come again.
```

Every visit starts with a thermal receipt printing out of a slot. It lists my hackathon builds and how each one placed, and then it's yours to tear off. The site is one hand-written HTML page plus a projects page: no framework, no build step, nothing to install.

---

## 🎨 The palette

Each colour comes from the receipt or the table it's printed on.

| Colour | Hex | Where it shows up |
| :--- | :--- | :--- |
| 🟩 **Table green** | `#183F38` | The background, like a laminated counter |
| 🟫 **Slot** | `#123029` | The printer slot and the post slot |
| 📜 **Paper** | `#FBFAF5` | The receipt itself |
| ⬛ **Thermal ink** | `#34333A` | Everything printed on the receipt |
| 🟥 **Stamp red** | `#C9372F` | The SHIPPED stamp and hard mode |
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

To make it easier or harder, change `FIT` near the top of the tear script in `index.html`. Higher numbers are more forgiving.

---

## 🚀 What's on the receipt

| Result | Project | What it is |
| :---: | :--- | :--- |
| 🏆 | [Lead Time](https://lead-time-cjnn.onrender.com) | Tells small food businesses which overseas food trends are heading to Singapore. *ForgeHacks Online 2026, Business + AI track winner* |
| 🥈 | **Recall** | Helps card members recognise charges they've forgotten, without ever being sure on their behalf. *American Express AI Hackathon 2026* |
| 🏁 | [Voucher Kaki](https://simplify-ai-hackathon.vercel.app) | Finds CDC-voucher eateries near you, in four languages. *SimplifyNext IGNITE 2026, finalist* |
| 📮 | [AgentShopper](https://agentshopper.streamlit.app/) | Makes a product catalogue readable to AI shopping assistants, then proves it worked. *NUS LifeHack 2026* |
| 📮 | [Pinch](https://pinch-htpl.onrender.com) | Interviews your grandparent while they cook and never guesses an amount. *Build With AI: Basics 2026* |

🏆 track winner · 🥈 placed · 🏁 finalist · 📮 submitted

---

## ➕ Adding a project

The carousel and the projects page hold everything. The receipt is the highlight reel, so it only gets projects that placed or reached finals, which keeps it short enough to tear.

1. **`index.html`, the carousel:** copy one `<li class="card">` block. The counters update themselves.
2. **`projects.html`:** add a row to the ledger table and a `<section class="project">` with the full story.
3. **`index.html`, the receipt (placed or finalist only):** add a line to the list and bump the total.

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

Printed in Singapore by Nathan 🧾

*Thank you. Come again.*

</div>
