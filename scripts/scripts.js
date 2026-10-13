let allIssues = [];
let roadmapIssues = [];
let selectedView = new Date().getFullYear().toString(); // Default to current year
let isInitialLoad = true;

async function init() {
  await fetchChangelog();
  setupModuleParamNotice();
  setupYearSwitcher();
  setupCheckboxFilters();
}

// Utility: Read query params from URL
function getUrlParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

// Configure "View all release notes" reset link if ?module= parameter is present
function setupModuleParamNotice() {
  const moduleParam = getUrlParam('module');
  const noticeEl = document.getElementById('module-filter-notice');
  const textEl = document.getElementById('module-filter-text');
  const clearLink = document.getElementById('clear-module-filter');

  if (moduleParam && noticeEl && textEl && clearLink) {
    textEl.innerHTML = `Showing updates for module: <strong>${escapeHtml(moduleParam.toUpperCase())}</strong>`;
    noticeEl.style.display = 'flex';

    clearLink.addEventListener('click', () => {
      // Remove 'module' parameter and reload page cleanly
      const url = new URL(window.location.href);
      url.searchParams.delete('module');
      window.location.href = url.pathname + url.search;
    });
  }
}

function setupYearSwitcher() {
  const container = document.getElementById('year-switcher');
  if (!container) return;

  container.innerHTML = '';
  const currentYear = new Date().getFullYear();

  // 1. Conditionally add "Coming soon" button ONLY if roadmap issues exist
  if (roadmapIssues && roadmapIssues.length > 0) {
    const comingSoonBtn = document.createElement('button');
    comingSoonBtn.className = `year-btn roadmap-btn ${selectedView === 'roadmap' ? 'active' : ''}`;
    comingSoonBtn.textContent = 'Coming soon';
    comingSoonBtn.addEventListener('click', () => {
      selectedView = 'roadmap';
      updateActiveButton(comingSoonBtn);
      isInitialLoad = false;
      renderFeed();
    });
    container.appendChild(comingSoonBtn);
  }

  // 2. Add Year buttons
  for (let y = currentYear; y >= 2020; y--) {
    const btn = document.createElement('button');
    btn.className = `year-btn ${selectedView === y.toString() ? 'active' : ''}`;
    btn.textContent = y;
    btn.addEventListener('click', () => {
      selectedView = y.toString();
      updateActiveButton(btn);
      isInitialLoad = false;
      renderFeed();
    });
    container.appendChild(btn);
  }
}

function updateActiveButton(activeBtn) {
  document.querySelectorAll('.year-btn').forEach(b => b.classList.remove('active'));
  activeBtn.classList.add('active');
}

function setupCheckboxFilters() {
  const checkboxes = document.querySelectorAll('#category-filters input[type="checkbox"]');
  checkboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      isInitialLoad = false;
      renderFeed();
    });
  });
}

function getSelectedCategories() {
  const checked = document.querySelectorAll('#category-filters input[type="checkbox"]:checked');
  return Array.from(checked).map(cb => cb.value.toLowerCase().trim());
}

async function fetchChangelog() {
  const feed = document.getElementById('changelog-feed');
  try {
    const res = await fetch('data.json');
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    
    const data = await res.json();
    
    if (data.published || data.roadmap) {
      allIssues = data.published || [];
      roadmapIssues = data.roadmap || [];
    } else if (Array.isArray(data)) {
      allIssues = data;
      roadmapIssues = [];
    }

    updateMonthStats();
    renderFeed();
  } catch (e) {
    console.error("Error fetching changelog:", e);
    if (feed) {
      feed.innerHTML = '<div class="no-updates">Unable to load changelog data. Check browser console for details.</div>';
    }
  }
}

function updateMonthStats() {
  const targetModule = getUrlParam('module')?.toLowerCase().trim();
  
  // 1. Update Stats Section Title based on module presence
  const statsTitleEl = document.querySelector('.stats-title');
  if (statsTitleEl) {
    const titleText = targetModule ? 'Stats in brief' : 'Last month in brief';
    statsTitleEl.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
      ${titleText}
    `;
  }

  let issuesForStats = [];

  if (targetModule) {
    // 2. Module param present: calculate stats for ALL displayed items matching this module
    issuesForStats = allIssues.filter(issue => {
      const issueModule = (issue.module || '').toLowerCase().trim();
      return issueModule === targetModule;
    });
  } else {
    // 3. No module param: calculate stats for the latest release month
    let targetMonth, targetYear;
    if (allIssues && allIssues.length > 0) {
      const latestDate = new Date(allIssues[0].inProductionAt || allIssues[0].closedAt);
      targetMonth = latestDate.getMonth();
      targetYear = latestDate.getFullYear();
    } else {
      const now = new Date();
      targetMonth = now.getMonth();
      targetYear = now.getFullYear();
    }

    issuesForStats = allIssues.filter(issue => {
      const d = new Date(issue.inProductionAt || issue.closedAt);
      return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
    });
  }

  // 4. Calculate counts by category
  let countFeatures = 0;
  let countEnhancements = 0;
  let countUX = 0;
  let countBugs = 0;

  issuesForStats.forEach(issue => {
    const cats = getIssueCategories(issue).map(c => c.toLowerCase().trim());

    cats.forEach(cat => {
      if (cat.includes('feature')) countFeatures++;
      else if (cat.includes('enhancement')) countEnhancements++;
      else if (cat.includes('ux') || cat.includes('ui')) countUX++;
      else if (cat.includes('bug')) countBugs++;
    });
  });

  const totalEl = document.getElementById('stat-total');
  const featEl = document.getElementById('stat-features');
  const enhEl = document.getElementById('stat-enhancements');
  const uxEl = document.getElementById('stat-ux');
  const bugEl = document.getElementById('stat-bugs');

  if (totalEl) totalEl.textContent = issuesForStats.length;
  if (featEl) featEl.textContent = countFeatures;
  if (enhEl) enhEl.textContent = countEnhancements;
  if (uxEl) uxEl.textContent = countUX;
  if (bugEl) bugEl.textContent = countBugs;
}

function getIssueCategories(issue) {
  if (issue.categories && Array.isArray(issue.categories)) {
    return issue.categories;
  }
  if (issue.category) {
    return issue.category.split(',').map(c => c.trim());
  }
  return ["General"];
}

function normalizeCategoryGroup(catStr) {
  const lower = catStr.toLowerCase().trim();
  if (lower.includes('feature')) return 'Features';
  if (lower.includes('enhancement')) return 'Enhancements';
  if (lower.includes('bug')) return 'Bug fixes';
  if (lower.includes('ux') || lower.includes('ui')) return 'UX/UI';
  return 'Updates';
}

// Format date into full string: "Oct 12, 2026"
function formatFullDate(dateStr) {
  if (!dateStr) return 'Roadmap';
  const dateObj = new Date(dateStr);
  if (isNaN(dateObj.getTime())) return dateStr;
  
  return dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function renderFeed() {
  const feed = document.getElementById('changelog-feed');
  if (!feed) return;

  const selectedCats = getSelectedCategories();
  const isRoadmapMode = selectedView === 'roadmap';
  const targetDataset = isRoadmapMode ? roadmapIssues : allIssues;
  
  // Read module URL parameter (e.g., ?module=api)
  const targetModule = getUrlParam('module')?.toLowerCase().trim();

  const filtered = targetDataset.filter(issue => {
    let matchesTime = true;
    if (!isRoadmapMode) {
      const issueYear = new Date(issue.inProductionAt || issue.closedAt).getFullYear();
      matchesTime = (issueYear.toString() === selectedView);
    }

    // Module parameter filter
    let matchesModule = true;
    if (targetModule) {
      const issueModule = (issue.module || '').toLowerCase().trim();
      matchesModule = issueModule === targetModule;
    }

    const issueCats = getIssueCategories(issue).map(c => c.toLowerCase().trim());
    const isGeneral = issueCats.some(c => c === 'general' || c === '');
    
    const matchesCategory = isGeneral || issueCats.some(c => {
      if (c.includes('feature') && selectedCats.includes('feature')) return true;
      if (c.includes('enhancement') && selectedCats.includes('enhancement')) return true;
      if ((c.includes('ux') || c.includes('ui')) && selectedCats.includes('ux/ui')) return true;
      if (c.includes('bug') && selectedCats.includes('bug fix')) return true;
      return selectedCats.includes(c);
    });
    
    return matchesTime && matchesModule && matchesCategory;
  });

  if (filtered.length === 0) {
    const emptyLabel = isRoadmapMode ? 'coming soon items' : `updates for ${selectedView}`;
    const moduleNotice = targetModule ? ` in module "${targetModule.toUpperCase()}"` : '';
    feed.innerHTML = `<div class="no-updates">No ${emptyLabel}${moduleNotice} matching selected categories.</div>`;
    return;
  }

  const groupedByDate = {};
  filtered.forEach(issue => {
    let dateKey = 'Roadmap';
    if (!isRoadmapMode) {
      dateKey = formatFullDate(issue.inProductionAt || issue.closedAt);
    }

    if (!groupedByDate[dateKey]) {
      groupedByDate[dateKey] = [];
    }
    groupedByDate[dateKey].push(issue);
  });

  feed.innerHTML = '';

  const dateKeys = Object.keys(groupedByDate);
  const firstDateKey = dateKeys.length > 0 ? dateKeys[0] : null;

  dateKeys.forEach(dateLabel => {
    const groupEl = document.createElement('div');
    groupEl.className = 'timeline-group';

    const dateEl = document.createElement('div');
    dateEl.className = 'timeline-date';
    dateEl.textContent = dateLabel;

    const stackEl = document.createElement('div');
    stackEl.className = 'tiles-stack';

    // Auto-expand top release group ONLY on initial page load
    const isLatestReleaseDate = (dateLabel === firstDateKey) && isInitialLoad && !isRoadmapMode;

    const categoryOrder = ['Features', 'Enhancements', 'Bug fixes', 'UX/UI', 'Updates'];
    const categorizedIssues = {};

    groupedByDate[dateLabel].forEach(issue => {
      const mainCat = getIssueCategories(issue)[0] || 'General';
      const groupName = normalizeCategoryGroup(mainCat);
      if (!categorizedIssues[groupName]) {
        categorizedIssues[groupName] = [];
      }
      categorizedIssues[groupName].push(issue);
    });

    categoryOrder.forEach(categoryName => {
      if (!categorizedIssues[categoryName] || categorizedIssues[categoryName].length === 0) {
        return;
      }

      const sectionHeading = document.createElement('h4');
      sectionHeading.className = 'category-section-title';
      sectionHeading.textContent = categoryName;
      stackEl.appendChild(sectionHeading);

      categorizedIssues[categoryName].forEach(issue => {
        const rawDetails = (issue.resolutionText || '').trim();
        const hasDetails = rawDetails.length > 0;

        let badgesHtml = '';
        if (issue.module && issue.module.trim().length > 0) {
          badgesHtml = `<span class="badge badge-module">${escapeHtml(issue.module)}</span>`;
        }

        const tileEl = document.createElement('div');
        const shouldExpand = isLatestReleaseDate && hasDetails;
        tileEl.className = `tile-content ${shouldExpand ? 'open' : ''}`;

        tileEl.innerHTML = `
          <div class="tile-summary ${hasDetails ? 'expandable' : ''}">
            <div>
              ${badgesHtml ? `<div class="badge-container">${badgesHtml}</div>` : ''}
              <h3 class="issue-title">${escapeHtml(issue.title)}</h3>
            </div>
            ${hasDetails ? `
              <button class="expand-btn" aria-label="Toggle details">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
              </button>
            ` : ''}
          </div>
          ${hasDetails ? `
            <div class="tile-details">
              ${formatMarkdown(rawDetails)}
            </div>
          ` : ''}
        `;

        if (hasDetails) {
          const summaryEl = tileEl.querySelector('.tile-summary');
          summaryEl.addEventListener('click', () => {
            tileEl.classList.toggle('open');
          });
        }

        stackEl.appendChild(tileEl);
      });
    });

    groupEl.appendChild(dateEl);
    groupEl.appendChild(stackEl);
    feed.appendChild(groupEl);
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatMarkdown(text) {
  if (!text) return '';
  let html = escapeHtml(text);

  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  html = html.replace(/^\s*-\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

  return html.split(/\n\n+/).map(p => {
    if (p.startsWith('<ul>') || p.startsWith('<img')) return p;
    return `<p>${p.replace(/\n/g, '<br>')}</p>`;
  }).join('');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
