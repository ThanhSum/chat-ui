/**
 * Angular (@angular/build) only auto-loads postcss.config.json or .postcssrc.json — not this file.
 * If Tailwind utilities are missing (styles.css ~26 kB instead of ~50 kB), ensure postcss.config.json exists with the same plugins.
 */
module.exports = {
  plugins: {
    '@tailwindcss/postcss': {},
  }
};
