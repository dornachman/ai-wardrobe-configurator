// Design tokens exported from Stitch (all screens merged). Build-time only: the site ships plain CSS.
// Regenerate frontend/css/styles.css after changing markup classes:
//   npx tailwindcss@3.4.17 -c stitch/tailwind.config.js -i stitch/tailwind.input.css -o frontend/css/styles.css
module.exports = {
  "content": {
    "relative": true,
    "files": [
      "../frontend/**/*.html",
      "../frontend/js/**/*.js"
    ]
  },
  "darkMode": "class",
  "theme": {
    "extend": {
      "colors": {
        "error": "#c0392b",
        "primary-container": "#e08850",
        "secondary-fixed-dim": "#cec6be",
        "surface-container": "#f2ece4",
        "on-secondary": "#ffffff",
        "on-secondary-container": "#605850",
        "surface": "#faf5ee",
        "tertiary": "#8c3c3c",
        "surface-container-low": "#f6f0e8",
        "tertiary-fixed-dim": "#e8a0a0",
        "primary-fixed-dim": "#f0a878",
        "on-secondary-fixed": "#2a2420",
        "on-surface-variant": "#605850",
        "secondary-container": "#eae2da",
        "on-secondary-fixed-variant": "#504840",
        "surface-container-lowest": "#ffffff",
        "surface-container-highest": "#e6e0d6",
        "on-tertiary-fixed": "#2e1515",
        "inverse-primary": "#f0a878",
        "on-background": "#3a302a",
        "background": "#faf5ee",
        "inverse-surface": "#3a302a",
        "on-error-container": "#7a1a10",
        "on-primary-container": "#fbe8d8",
        "surface-variant": "#ece6dc",
        "inverse-on-surface": "#faf5ee",
        "outline": "#9a9088",
        "tertiary-fixed": "#fce0e0",
        "secondary-fixed": "#eae2da",
        "surface-tint": "#c2652a",
        "outline-variant": "#d8d0c8",
        "on-primary-fixed-variant": "#8a4518",
        "tertiary-container": "#d47070",
        "on-error": "#ffffff",
        "primary": "#9e4e1c",
        "secondary": "#675f58",
        "on-tertiary-fixed-variant": "#6e3030",
        "surface-container-high": "#ece6dc",
        "error-container": "#fce4e0",
        "on-primary": "#ffffff",
        "on-tertiary-container": "#3a2020",
        "primary-fixed": "#fbe8d8",
        "on-surface": "#3a302a",
        "surface-dim": "#dcd6cc",
        "on-tertiary": "#ffffff",
        "surface-bright": "#faf5ee",
        "on-primary-fixed": "#401a08",
        "sahara-primary": "#9e4e1c",
        "sahara-primary-hover": "#8a4518",
        "sahara-bg": "#faf5ee",
        "sahara-card": "#ffffff",
        "sahara-text": "#3a302a",
        "sahara-muted": "#605850",
        "sahara-border": "#d8d0c8",
        "sahara-error": "#c0392b",
        "sahara-error-bg": "#fdf2f2",
        "sahara-tag-bg": "#f2ebe0",
        "linen": "#faf5ee",
        "sienna": "#9e4e1c",
        "sienna-hover": "#8a4518",
        "sienna-subtle": "#fbeee6",
        "bark": "#3a302a",
        "muted-text": "#605850",
        "subtle-text": "#675f58",
        "outline-subtle": "#ece6df",
        "error-custom": "#c0392b"
      },
      "borderRadius": {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "full": "9999px",
        "custom": "8px"
      },
      "spacing": {},
      "fontFamily": {
        "headline": [
          "EB Garamond"
        ],
        "display": [
          "EB Garamond"
        ],
        "body": [
          "Manrope"
        ],
        "label": [
          "Manrope"
        ],
        "serif": [
          "\"EB Garamond\"",
          "serif"
        ],
        "sans": [
          "\"Manrope\"",
          "sans-serif"
        ]
      },
      "fontSize": {},
      "boxShadow": {
        "soft": "0 4px 20px -2px rgba(58, 48, 42, 0.05), 0 2px 6px -1px rgba(58, 48, 42, 0.02)",
        "card": "0 4px 20px -4px rgba(58, 48, 42, 0.06), 0 1px 3px rgba(58, 48, 42, 0.03)"
      }
    }
  }
};
