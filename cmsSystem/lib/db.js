"use strict";
/**
 * lib/db.js
 * ---------------------------------------------------------------------------
 * Wires up every persisted collection/document used by the app. Everything
 * lives under CMS_DATA_DIR, which is deliberately a *separate* directory
 * tree from the website root (CMS_ROOT) so admin data (users, sessions,
 * versions, drafts...) is never inside the publicly-servable folder and can
 * never be returned by the static file server, no matter what path someone
 * requests.
 */

const path = require("path");
const { Collection, Document, Counters } = require("./store");
const { makeSessionModule } = require("./sessions");

const DEFAULT_TOKENS = {
  colors: {
    primary: "#7C5CFF",
    secondary: "#22D3EE",
    accent: "#F472B6",
    background: "#0F1016",
    surface: "#17181F",
    text: "#F7F7FB",
    mutedText: "#9295A5",
  },
  typography: {
    headingFont: "'Fraunces', Georgia, 'Times New Roman', serif",
    bodyFont: "-apple-system, 'Segoe UI', Inter, Roboto, sans-serif",
    baseSize: "16px",
    scaleRatio: "1.25",
  },
  spacing: { xs: "4px", sm: "8px", md: "16px", lg: "24px", xl: "48px" },
  radius: { sm: "6px", md: "12px", lg: "20px" },
  shadow: {
    sm: "0 1px 2px rgba(15,16,22,.10)",
    md: "0 8px 24px rgba(15,16,22,.16)",
    lg: "0 24px 64px rgba(15,16,22,.28)",
  },
  container: { maxWidth: "1200px", gutter: "24px" },
};

const DEFAULT_SETTINGS = {
  siteName: "Studio Site",
  breakpoints: { tablet: 991, mobile: 640 },
};

function createDb(dataDir) {
  const usersCol = new Collection(path.join(dataDir, "users.json"));
  const sessionsCol = new Collection(path.join(dataDir, "sessions.json"));
  const versionsCol = new Collection(path.join(dataDir, "versions.json"));
  const pagesMetaCol = new Collection(path.join(dataDir, "pages-meta.json"));
  const mediaCol = new Collection(path.join(dataDir, "media.json"));
  const activityCol = new Collection(path.join(dataDir, "activity.json"));
  const componentsCol = new Collection(path.join(dataDir, "components.json"));
  const tokensDoc = new Document(path.join(dataDir, "design-tokens.json"), DEFAULT_TOKENS);
  const settingsDoc = new Document(path.join(dataDir, "settings.json"), DEFAULT_SETTINGS);
  const counters = new Counters(path.join(dataDir, "counters.json"));
  const sessions = makeSessionModule(sessionsCol);

  return {
    dataDir,
    usersCol,
    sessionsCol,
    versionsCol,
    pagesMetaCol,
    mediaCol,
    activityCol,
    componentsCol,
    tokensDoc,
    settingsDoc,
    counters,
    sessions,
  };
}

module.exports = { createDb, DEFAULT_TOKENS, DEFAULT_SETTINGS };
