const owner = 'missomisso';
const repo = 'HatchEvent-UAT';
const apiUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/uat.yml/runs?per_page=6`;

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

function statusInfo(run) {
  if (run.status !== 'completed') {
    return ['RUNNING', 'running'];
  }
  if (run.conclusion === 'success') {
    return ['PASSED', 'success'];
  }
  if (run.conclusion === 'cancelled') {
    return ['CANCELLED', 'cancelled'];
  }
  return ['FAILED', 'failure'];
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

function renderRuns(runs) {
  const tbody = document.querySelector('#runs');
  const latestStatus = document.querySelector('#latest-status');
  const latestNote = document.querySelector('#latest-note');

  if (!runs.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="placeholder">No workflow runs yet. Start one from GitHub Actions.</td></tr>';
    latestStatus.textContent = 'NO RUNS';
    latestNote.textContent = 'Run UAT tests to see results here';
    return;
  }

  const first = runs[0];
  const [label, cls] = statusInfo(first);
  latestStatus.textContent = label;
  latestStatus.style.color = cls === 'success' ? '#c8f169' : cls === 'running' ? '#ffc36a' : '#ff8980';
  latestNote.textContent = `#${first.run_number} · ${timeAgo(first.updated_at || first.created_at)}`;

  tbody.innerHTML = runs.map((run) => {
    const [stateLabel, stateClass] = statusInfo(run);

    return `
      <tr>
        <td><span class="result ${stateClass}">● ${stateLabel}</span></td>
        <td>
          <span class="run-name">HatchEvent UAT</span><br />
          <span class="run-date">#${escapeHtml(run.run_number)}</span>
        </td>
        <td class="run-date">${escapeHtml(triggerLabel(run))}</td>
        <td class="run-date">${escapeHtml(timeAgo(run.updated_at || run.created_at))}</td>
        <td class="open"><a href="${escapeHtml(run.html_url)}" aria-label="Open workflow run">↗</a></td>
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
          <a href="https://github.com/${owner}/${repo}/actions/workflows/uat.yml" style="color:#c8f169;">View on GitHub ↗</a>
        </td>
      </tr>
    `;
    document.querySelector('#latest-status').textContent = 'UNAVAILABLE';
    document.querySelector('#latest-note').textContent = 'GitHub Actions could not be reached';
    console.error(error);
  } finally {
    button.disabled = false;
  }
}

document.querySelector('#refresh').addEventListener('click', loadRuns);
loadRuns();
