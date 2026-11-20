# Contributing to Starward

Thanks for helping. Bug reports, ideas and pull requests are all welcome.

- **Bugs and ideas:** [open an issue](https://github.com/CptNope/Starward/issues/new/choose). For bugs, include your device, browser, graphics preset and universe seed if you can.
- **Code:** read the [Developer Guide](docs/DEVELOPMENT.md) first. Most new content (weapons, skills, biomes, hulls) only needs changes in `src/data.js`.
- **Before opening a PR:**
  1. Run `npm run build` and play through the parts you changed.
  2. If you changed game data, run `npm run docs` so the Player Guide stays in sync.
  3. Keep performance in mind: use `mat()` / `litMat()` and `bake()` for new models, and read quality settings from `Q`.
  4. Add a line to `CHANGELOG.md`.

By contributing, you agree your work is released under the [MIT License](LICENSE).

Starward is made by [Jeremy Anderson Tech](https://jeremyanderson.tech/).
