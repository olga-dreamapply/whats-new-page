let allIssues = [];
let selectedYear = new Date().getFullYear();

async function init() {
  setupYearSwitcher();
  setupCheckboxFilters();
  await fetchChangelog();
}

function setupYearSwitcher() {
  const container = document.getElementById('year-switcher');
  if (!container) return;

  container.innerHTML = '';
  const currentYear = new Date().getFullYear();
  
  for (let y = currentYear; y >= 2020; y--) {
    const btn = document.createElement('button');
    btn.className = `year-btn ${y === selectedYear ? 'active' : ''}`;
    btn.textContent = y;
    btn.addEventListener('click', () => {
      selectedYear = y;
      document.querySelectorAll('.year-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderFeed();
    });
    container.appendChild(btn);
  }
}

function setupCheckboxFilters() {
  const checkboxes = document.querySelectorAll('#category-filters input[type="checkbox"]');
  checkboxes.forEach(cb => {
    cb.addEventListener('change', () => {
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
    
    allIssues = await res.json();
    
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
  let targetMonth, targetYear, monthName;
  
  if (allIssues && allIssues.length > 0) {
    const latestDate = new Date(allIssues[0].closedAt);
    targetMonth = latestDate.getMonth();
    targetYear = latestDate.getFullYear();
    monthName = latestDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  } else {
    const now = new Date();
    targetMonth = now.getMonth();
    targetYear = now.getFullYear();
    monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  const labelEl = document.getElementById('stats-month-label');
  if (labelEl) {
    labelEl.textContent = `Our engineering team stayed busy continuously improving DreamApply. Here is what was delivered in ${monthName}:`;
  }

  const currentMonthIssues = allIssues.filter(issue => {
    const d = new Date(issue.closedAt);
    return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
  });

  let countFeatures = 0;
  let countEnhancements = 0;
  let countUX = 0;
  let countBugs = 0;

  currentMonthIssues.forEach(issue => {
    const cats = getIssueCategories(issue).map(c => c.toLowerCase().trim());

    cats.forEach(cat => {
      if (cat.includes('feature')) countFeatures++;
      else if (cat.includes('enhancement')) countEnhancements++;
      else if (cat.includes('ux') || cat.includes('ui')) countUX++;
      else if (cat.includes('bug')) countBugs++;
    });
  });

  const featEl = document.getElementById('stat-features');
  const enhEl = document.getElementById('stat-enhancements');
  const uxEl = document.getElementById('stat-ux');
  const bugEl = document.getElementById('stat-bugs');

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

function renderFeed() {
  const feed = document.getElementById('changelog-feed');
  if (!feed) return;

  const selectedCats = getSelectedCategories();

  const filtered = allIssues.filter(issue => {
    const issueYear = new Date(issue.closedAt).getFullYear();
    const matchesYear = issueYear === selectedYear;

    const issueCats = getIssueCategories(issue).map(c => c.toLowerCase().trim());
    const matchesCategory = issueCats.some(c => {
      if (c.includes('feature') && selectedCats.includes('feature')) return true;
      if (c.includes('enhancement') && selectedCats.includes('enhancement')) return true;
      if ((c.includes('ux') || c.includes('ui')) && selectedCats.includes('ux/ui')) return true;
      if (c.includes('bug') && selectedCats.includes('bug fix')) return true;
      return selectedCats.includes(c);
    });
    
    return matchesYear && matchesCategory;
  });

  if (filtered.length === 0) {
    feed.innerHTML = `<div class="no-updates">No updates found for ${selectedYear} matching selected categories.</div>`;
    return;
  }

  const groupedByDate = {};
  filtered.forEach(issue => {
    const dateObj = new Date(issue.closedAt);
    const dateKey = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (!groupedByDate[dateKey]) {
      groupedByDate[dateKey] = [];
    }
    groupedByDate[dateKey].push(issue);
  });

  feed.innerHTML = '';

  Object.keys(groupedByDate).forEach(dateLabel => {
    const groupEl = document.createElement('div');
    groupEl.className = 'timeline-group';

    const dateEl = document.createElement('div');
    dateEl.className = 'timeline-date';
    dateEl.textContent = dateLabel;

    const stackEl = document.createElement('div');
    stackEl.className = 'tiles-stack';

    groupedByDate[dateLabel].forEach(issue => {
      const hasDetails = issue.resolutionText && issue.resolutionText.trim().length > 0;
      const cats = getIssueCategories(issue);

      let badgesHtml = '';
      if (issue.module && issue.module.trim().length > 0) {
        badgesHtml = `<span class="badge badge-module">${escapeHtml(issue.module)}</span>`;
      } else {
        badgesHtml = cats.map(c => `<span class="badge">${escapeHtml(c)}</span>`).join('');
      }

      const tileEl = document.createElement('div');
      tileEl.className = 'tile-content';

      tileEl.innerHTML = `
        <div class="tile-summary ${hasDetails ? 'expandable' : ''}">
          <div>
            <div class="badge-container">${badgesHtml}</div>
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
            ${formatMarkdown(issue.resolutionText)}
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

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
