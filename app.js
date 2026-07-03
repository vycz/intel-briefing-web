const REPO = "vycz/intel-briefing-web";
const REPORT_DIR = "data/daily_briefings";
const API_URL = `https://api.github.com/repos/${REPO}/contents/${REPORT_DIR}`;

const state = {
  reports: [],
  selected: null,
};

const listEl = document.querySelector("#report-list");
const countEl = document.querySelector("#report-count");
const titleEl = document.querySelector("#report-title");
const contentEl = document.querySelector("#content");
const rawLinkEl = document.querySelector("#raw-link");
const searchEl = document.querySelector("#search");

marked.use({
  gfm: true,
  breaks: false,
});

function parseReportDate(name) {
  const match = name.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : name.replace(/\.md$/i, "");
}

function formatReportTitle(report) {
  return `Morning Report ${parseReportDate(report.name)}`;
}

function setQuery(reportName) {
  const url = new URL(window.location.href);
  url.searchParams.set("report", reportName);
  window.history.replaceState({}, "", url);
}

function renderList() {
  const query = searchEl.value.trim().toLowerCase();
  const reports = state.reports.filter((report) =>
    report.name.toLowerCase().includes(query)
  );

  countEl.textContent = `${state.reports.length} reports`;
  listEl.replaceChildren(
    ...reports.map((report) => {
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.className = `report-card${state.selected?.name === report.name ? " active" : ""}`;
      button.type = "button";
      button.innerHTML = `
        <span class="mini-bars" aria-hidden="true"><span></span><span></span><span></span></span>
        <span>
          <span class="report-name">${formatReportTitle(report)}</span>
          <span class="report-date">${parseReportDate(report.name)}</span>
        </span>
      `;
      button.addEventListener("click", () => loadReport(report));
      li.append(button);
      return li;
    })
  );
}

async function loadReports() {
  try {
    const response = await fetch(API_URL, {
      headers: { Accept: "application/vnd.github+json" },
    });

    if (response.status === 404) {
      state.reports = [];
      renderList();
      contentEl.innerHTML = `<div class="empty">No reports yet</div>`;
      titleEl.textContent = "No reports yet";
      rawLinkEl.removeAttribute("href");
      return;
    }

    if (!response.ok) {
      throw new Error(`GitHub API ${response.status}`);
    }

    const files = await response.json();
    state.reports = files
      .filter((file) => file.type === "file" && file.name.endsWith(".md"))
      .sort((a, b) => b.name.localeCompare(a.name));

    renderList();

    const params = new URLSearchParams(window.location.search);
    const requested = params.get("report");
    const initial =
      state.reports.find((report) => report.name === requested) ||
      state.reports[0];

    if (initial) {
      await loadReport(initial, { updateQuery: false });
    } else {
      contentEl.innerHTML = `<div class="empty">No reports yet</div>`;
      titleEl.textContent = "No reports yet";
    }
  } catch (error) {
    titleEl.textContent = "Unable to load reports";
    contentEl.innerHTML = `<div class="error">${error.message}</div>`;
  }
}

async function loadReport(report, options = {}) {
  state.selected = report;
  renderList();
  titleEl.textContent = formatReportTitle(report);
  rawLinkEl.href = report.download_url;
  contentEl.innerHTML = `<div class="empty">Loading</div>`;

  try {
    const response = await fetch(report.download_url);
    if (!response.ok) {
      throw new Error(`Report ${response.status}`);
    }

    const markdown = await response.text();
    const html = marked.parse(markdown);
    contentEl.innerHTML = DOMPurify.sanitize(html, {
      ADD_ATTR: ["target", "rel"],
    });

    contentEl.querySelectorAll("a[href^='http']").forEach((link) => {
      link.target = "_blank";
      link.rel = "noreferrer";
    });

    if (options.updateQuery !== false) {
      setQuery(report.name);
    }
  } catch (error) {
    contentEl.innerHTML = `<div class="error">${error.message}</div>`;
  }
}

searchEl.addEventListener("input", renderList);
loadReports();
