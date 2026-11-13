const owner = 'missomisso';
const repo = 'HatchEvent-UAT';
const apiUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/uat.yml/runs?per_page=30`;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return map[char];
  });
}

function timeAgo(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';

  const mins = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function getRunCategory(run) {
  if (run.status !== 'completed') {
    return { label: 'RUNNING', className: 'running' };
  }

  if (run.conclusion === 'success') {
    return { label: 'PASSED', className: 'success' };
  }

  if (run.conclusion === 'cancelled') {
    return { label: 'CANCELLED', className: 'cancelled' };
  }

  return { label: 'FAILED', className: 'failure' };
}

function triggerLabel(run) {
  const map = {
    schedule: 'SCHEDULED',
    workflow_dispatch: 'MANUAL',
    push: 'PUSH',
    pull_request: 'PULL REQUEST'
  };
  return map[run.event] || String(run.event || 'WORKFLOW').toUpperCase().replace(/_/g, ' ');
}

function renderSummary(runs) {
  const summary = {
    success: 0,
    failure: 0,
    running: 0,
    cancelled: 0
  };

  runs.forEach((run) => {
    const { label } = getRunCategory(run);
    if (label === 'PASSED') summary.success += 1;
    if (label === 'FAILED') summary.failure += 1;
    if (label === 'RUNNING') summary.running += 1;
    if (label === 'CANCELLED') summary.cancelled += 1;
  });

  document.querySelector('#stat-passed').textContent = summary.success;
  document.querySelector('#stat-failed').textContent = summary.failure;
  document.querySelector('#stat-running').textContent = summary.running;
  document.querySelector('#stat-cancelled').textContent = summary.cancelled;
}

function renderTrend(runs) {
  const container = document.querySelector('#trend-chart');
  const recent = runs.slice(0, 6).reverse();

  if (!recent.length) {
    container.innerHTML = '<div class="trend-empty">No recent runs yet</div>';
    return;
  }

  const maxHeight = 100;
  const heightByStatus = {
    success: 100,
    failure: 78,
    running: 56,
    cancelled: 32
  };

  container.innerHTML = recent.map((run) => {
    const { label, className } = getRunCategory(run);
    const height = heightByStatus[className] ?? 40;
    return `
      <div class="trend-item">
        <div class="trend-bar-wrap">
          <div class="trend-bar ${className}" style="height: ${height}%"></div>
        </div>
        <small>#${escapeHtml(run.run_number)}</small>
      </div>
    `;
  }).join('');
}

function renderFailureSummary(runs) {
  const panel = document.querySelector('#failure-summary');
  const failure = runs.find((run) => getRunCategory(run).label === 'FAILED');

  if (!failure) {
    panel.className = 'failure-summary success';
    panel.innerHTML = '<strong>All clear</strong><span>No failed runs in the recent activity.</span>';
    return;
  }

  const trigger = triggerLabel(failure);
  panel.className = 'failure-summary failure';
  panel.innerHTML = `
    <strong>${escapeHtml(failure.display_title || 'HatchEvent UAT')}</strong>
    <span>${escapeHtml(trigger)} • ${escapeHtml(timeAgo(failure.updated_at || failure.created_at))}</span>
    <a href="${escapeHtml(failure.html_url)}" target="_blank" rel="noreferrer">View failed run ↗</a>
  `;
}

function renderRuns(runs) {
  const tbody = document.querySelector('#runs');
  const latestStatus = document.querySelector('#latest-status');
  const latestNote = document.querySelector('#latest-note');

  if (!runs.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="placeholder">No workflow runs yet. Start one from GitHub Actions.</td></tr>';
    latestStatus.textContent = 'NO RUNS';
    latestStatus.className = 'latest-status neutral';
    latestNote.textContent = 'Run UAT tests to see results here';
    renderSummary([]);
    renderTrend([]);
    renderFailureSummary([]);
    return;
  }

  const first = runs[0];
  const latest = getRunCategory(first);
  latestStatus.textContent = latest.label;
  latestStatus.className = `latest-status ${latest.className}`;
  latestNote.textContent = `Run #${first.run_number} · ${timeAgo(first.updated_at || first.created_at)}`;

  renderSummary(runs);
  renderTrend(runs);
  renderFailureSummary(runs);

  tbody.innerHTML = runs.map((run) => {
    const status = getRunCategory(run);
    const runTitle = run.display_title || run.name || 'HatchEvent UAT';

    return `
      <tr>
        <td><span class="result ${status.className}">● ${status.label}</span></td>
        <td>
          <span class="run-name">${escapeHtml(runTitle)}</span><br />
          <span class="run-date">#${escapeHtml(run.run_number)}</span>
        </td>
        <td class="run-date">${escapeHtml(triggerLabel(run))}</td>
        <td class="run-date">${escapeHtml(timeAgo(run.updated_at || run.created_at))}</td>
        <td class="open"><a href="${escapeHtml(run.html_url)}" aria-label="Open workflow run ${escapeHtml(run.run_number)}">View ↗</a></td>
      </tr>
    `;
  }).join('');
}

async function loadRuns() {
  const button = document.querySelector('#refresh');
  const tbody = document.querySelector('#runs');

  button.disabled = true;

  try {
    const response = await fetch(apiUrl, {
      headers: { Accept: 'application/vnd.github+json' }
    });

    if (!response.ok) {
      throw new Error(`GitHub API returned ${response.status}`);
    }

    const data = await response.json();
    renderRuns(data.workflow_runs || []);
  } catch (error) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="placeholder">
          Unable to load workflow runs.
          <a href="https://github.com/${owner}/${repo}/actions/workflows/uat.yml">View runs on GitHub ↗</a>
        </td>
      </tr>
    `;
    document.querySelector('#latest-status').textContent = 'UNAVAILABLE';
    document.querySelector('#latest-status').className = 'latest-status failure';
    document.querySelector('#latest-note').textContent = 'GitHub Actions could not be reached';
    renderSummary([]);
    renderTrend([]);
    renderFailureSummary([]);
    console.error(error);
  } finally {
    button.disabled = false;
  }
}

document.querySelector('#refresh').addEventListener('click', loadRuns);
loadRuns();
