// The "Open Source" section and footer links.
// All values are written with textContent / safe DOM APIs.

import { h, appendContent } from "../lib/dom.js";
import { GITHUB_ICON, GITHUB_LINKS, fetchRepoStats, getCachedRepoStats } from "../lib/github.js";

const EXTERNAL = { target: "_blank", rel: "noopener noreferrer" };

function externalLink(text, href, className, { icon = false, label } = {}) {
  const link = h("a", { class: className, href, ...EXTERNAL, "aria-label": label });
  if (icon) link.insertAdjacentHTML("beforeend", GITHUB_ICON); // static, trusted SVG
  link.append(document.createTextNode(text));
  return link;
}

function formatAge(timestamp) {
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

function formatUpdated(isoDate) {
  const date = new Date(isoDate);
  return Number.isNaN(date.getTime())
    ? "Unknown"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

export function renderOpenSourceSection(container) {
  const statsArea = h("div", { class: "opensource-stats", "aria-live": "polite" });

  const links = [
    ["Repository", GITHUB_LINKS.repository],
    ["README", GITHUB_LINKS.readme],
    ["Issues", GITHUB_LINKS.issues],
    ["Pull requests", GITHUB_LINKS.pullRequests],
  ];
  if (GITHUB_LINKS.discussions) links.push(["Discussions", GITHUB_LINKS.discussions]);

  const section = h(
    "section",
    { class: "opensource-section", id: "open-source", "aria-labelledby": "opensource-title" },
    h(
      "div",
      { class: "opensource-copy" },
      h("span", { class: "opensource-badge" }, "Open Source"),
      h("h2", { id: "opensource-title" }, "Free to use. Open to inspect."),
      h(
        "p",
        {},
        "FileForge is free to use and open source. You can read exactly how your files are handled, report bugs, suggest features, and contribute improvements on GitHub."
      ),
      h(
        "div",
        { class: "opensource-actions" },
        externalLink("View on GitHub", GITHUB_LINKS.repository, "button button-primary github-cta", { icon: true }),
        externalLink("Contribute", GITHUB_LINKS.contributing, "button button-secondary"),
        externalLink("Report a bug or suggest a feature", GITHUB_LINKS.newIssue, "opensource-text-link")
      ),
      h(
        "ul",
        { class: "opensource-links", "aria-label": "Repository links" },
        links.map(([text, href]) => h("li", {}, externalLink(text, href)))
      )
    ),
    statsArea
  );

  container.replaceChildren(section);
  renderStats(statsArea, getCachedRepoStats());
}

function renderStats(area, result, message = "") {
  area.replaceChildren();

  const askButton = (label) =>
    h("button", {
      class: "button button-quiet opensource-stats-button",
      type: "button",
      onClick: () => loadStats(area, result ? true : false),
    }, label);

  if (!result || !result.data) {
    area.append(
      h("p", { class: "opensource-stats-note" },
        "Repository statistics are not loaded automatically. Loading them contacts GitHub (api.github.com); no files or personal data are sent."),
      askButton("Show repository stats")
    );
    if (message) area.append(h("p", { class: "opensource-stats-error", role: "status" }, message));
    return;
  }

  const { data } = result;
  const live = result.status === "live";

  appendContent(
    area,
    h("dl", { class: "opensource-stat-list" },
      stat("Stars", data.stars.toLocaleString()),
      stat("Forks", data.forks.toLocaleString()),
      stat("Open issues + PRs", data.openIssuesAndPulls.toLocaleString()),
      stat("Last push", data.pushedAt ? formatUpdated(data.pushedAt) : "Unknown")
    ),
    h("p", { class: `opensource-stats-source ${live ? "is-live" : "is-cached"}` },
      live
        ? "Live from GitHub · fetched just now"
        : `Cached copy · fetched ${formatAge(result.fetchedAt)}`),
    message ? h("p", { class: "opensource-stats-error", role: "status" }, message) : null,
    askButton("Refresh from GitHub")
  );
}

function stat(label, value) {
  return h("div", { class: "opensource-stat" }, h("dt", {}, label), h("dd", {}, value));
}

async function loadStats(area, force) {
  const buttons = area.querySelectorAll("button");
  buttons.forEach((button) => { button.disabled = true; });
  const note = h("p", { class: "opensource-stats-note", role: "status" }, "Contacting GitHub…");
  area.append(note);

  const result = await fetchRepoStats({ force });
  renderStats(area, result.data ? result : null, result.message);
}

export function renderFooterLinks(container) {
  container.replaceChildren(
    h("span", { class: "opensource-badge opensource-badge-small" }, "Open Source"),
    externalLink("View on GitHub", GITHUB_LINKS.repository, "footer-link", { icon: true }),
    externalLink("Contribute", GITHUB_LINKS.contributing, "footer-link"),
    externalLink("Issues", GITHUB_LINKS.issues, "footer-link")
  );
}
