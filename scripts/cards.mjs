const SANS = 'Noto Sans, Segoe UI, Helvetica, Arial, sans-serif';
const MONO = 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const PALETTE = {
  base: '#0B0B0C',
  raised: '#121214',
  elevated: '#18181B',
  border: '#222226',
  text: '#F4F4F5',
  muted: '#A1A1AA',
  faint: '#6B6B74',
  accent: '#F5A623',
  success: '#34D399',
  warning: '#FACF9E',
  info: '#79C0FF',
};

const LEVEL_COLOR = {
  NONE: PALETTE.border,
  FIRST_QUARTILE: '#5C3D12',
  SECOND_QUARTILE: '#A56B14',
  THIRD_QUARTILE: PALETTE.accent,
  FOURTH_QUARTILE: PALETTE.warning,
};

const TONES = {
  green: { stroke: PALETTE.accent, title: PALETTE.accent, bg: PALETTE.raised },
  blue: { stroke: PALETTE.info, title: PALETTE.info, bg: PALETTE.raised },
  purple: { stroke: PALETTE.success, title: PALETTE.success, bg: PALETTE.raised },
  amber: { stroke: PALETTE.warning, title: PALETTE.warning, bg: PALETTE.raised },
};

const CARD_WIDTH = 960;
const CYCLE_STEP = 3;
const CYCLE_MOVE_CS = 60;
const SLOT_PEEK = 46;
const SLOT_WINDOW = { x: 600, y: 62, width: 316, height: 210 };
const SLOT_CARD = { width: 284, height: 72 };
const SLOT_TOP_PEEK_Y = SLOT_PEEK - SLOT_CARD.height;
const SLOT_BOTTOM_PEEK_Y = SLOT_WINDOW.height - SLOT_PEEK;
const SLOT_HOLD_Y = SLOT_TOP_PEEK_Y + SLOT_CARD.height
  + Math.floor((SLOT_BOTTOM_PEEK_Y - (SLOT_TOP_PEEK_Y + SLOT_CARD.height) - SLOT_CARD.height) / 2);

export const PROJECT_SLOT = {
  x: 16,
  enterY: SLOT_WINDOW.height + 16,
  bottomPeekY: SLOT_BOTTOM_PEEK_Y,
  holdY: SLOT_HOLD_Y,
  topPeekY: SLOT_TOP_PEEK_Y,
  exitY: -(SLOT_CARD.height + 16),
  window: SLOT_WINDOW,
  card: SLOT_CARD,
};

function roundFade(value) {
  return Math.round(value * 1000) / 1000;
}

export function openFadeStops() {
  const { window, card, topPeekY, bottomPeekY } = PROJECT_SLOT;
  return [
    { offset: 0, opacity: 0 },
    { offset: roundFade((topPeekY + card.height) / window.height), opacity: 1 },
    { offset: roundFade(bottomPeekY / window.height), opacity: 1 },
    { offset: 1, opacity: 0 },
  ];
}

export function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function formatDayMonth(iso) {
  const [, month, dayOfMonth] = String(iso).split('-');
  return `${Number(dayOfMonth)} ${MONTHS[Number(month) - 1]}`;
}

export function formatCount(value) {
  return new Intl.NumberFormat('pt-BR').format(Number(value) || 0);
}

export function starsLabel(count) {
  const value = Number(count) || 0;
  const formatted = formatCount(value);
  return value === 1 ? `${formatted} estrela` : `${formatted} estrelas`;
}

export function summarizeContributions(calendar) {
  const weeks = Array.isArray(calendar?.weeks) ? calendar.weeks : [];
  const days = weeks.flatMap((week) => week.contributionDays || []);
  const activeDays = days.filter((item) => Number(item.contributionCount || 0) > 0).length;
  let peak = { date: '', contributionCount: 0 };

  for (const item of days) {
    const contributionCount = Number(item.contributionCount || 0);
    if (contributionCount > peak.contributionCount) {
      peak = { date: item.date || '', contributionCount };
    }
  }

  const last = days.at(-1);
  const latest = last
    ? { date: last.date || '', contributionCount: Number(last.contributionCount || 0) }
    : { date: '', contributionCount: 0 };
  const summed = days.reduce((total, item) => total + Number(item.contributionCount || 0), 0);
  const total = Number.isFinite(calendar?.totalContributions)
    ? Number(calendar.totalContributions)
    : summed;

  return { total, activeDays, peak, latest };
}

export function monthLabels(weeks, left, step) {
  const raw = [];
  let previous = '';

  weeks.forEach((week, index) => {
    const date = week?.contributionDays?.[0]?.date;
    if (!date) return;
    const key = date.slice(0, 7);
    if (key === previous) return;
    previous = key;
    raw.push({
      x: left + index * step,
      text: MONTHS[Number(date.slice(5, 7)) - 1],
    });
  });

  const kept = [];
  for (const label of raw) {
    const previousLabel = kept.at(-1);
    if (previousLabel && label.x - previousLabel.x < 36) kept.pop();
    kept.push(label);
  }
  return kept;
}

export function wrapItems(items, maxChars) {
  if (!Array.isArray(items) || items.length === 0) return [];

  const lines = [];
  let current = [];
  const widthOf = (list) => list.join(' · ').length;

  for (const item of items) {
    if (current.length === 0) {
      current = [item];
      continue;
    }
    const next = [...current, item];
    if (widthOf(next) > maxChars) {
      lines.push(current.join(' · '));
      current = [item];
    } else {
      current = next;
    }
  }

  if (current.length > 0) lines.push(current.join(' · '));
  return lines;
}

export function readCalendar(payload) {
  if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
    const message = payload.errors.map((error) => error.message || 'GitHub error').join('; ');
    throw new Error(message);
  }

  const calendar = payload?.data?.user?.contributionsCollection?.contributionCalendar;
  if (!calendar || !Array.isArray(calendar.weeks)) {
    throw new Error('Contribution calendar not found');
  }
  return calendar;
}

export function readRepositories(payload) {
  const nodes = payload?.data?.user?.repositories?.nodes;
  if (!Array.isArray(nodes)) throw new Error('Open repositories not found');
  return nodes;
}

export function selectOpenProjects(nodes, { login, limit = 5 } = {}) {
  return (Array.isArray(nodes) ? nodes : [])
    .filter((repo) => repo?.name && repo.name !== login && !repo.isFork && !repo.isArchived)
    .map((repo) => ({
      name: repo.name,
      pushedAt: typeof repo.pushedAt === 'string' ? repo.pushedAt : '',
    }))
    .sort((left, right) => {
      if (left.pushedAt === right.pushedAt) return left.name.localeCompare(right.name);
      return left.pushedAt < right.pushedAt ? 1 : -1;
    })
    .slice(0, limit);
}

export function fitLabel(value, maxChars) {
  const label = String(value);
  if (label.length <= maxChars) return label;
  return `${label.slice(0, maxChars - 1)}…`;
}

export function projectCycle(index, total) {
  const count = Number(total);
  if (!Number.isInteger(count) || count < 2) {
    throw new Error('A cycle needs at least two projects');
  }
  if (!Number.isInteger(index) || index < 0 || index >= count) {
    throw new Error('Project index is outside the cycle');
  }

  const durationCs = count * CYCLE_STEP * 100;
  const step = CYCLE_STEP * 100;
  const move = CYCLE_MOVE_CS;
  const {
    x, enterY, bottomPeekY, holdY, topPeekY, exitY,
  } = PROJECT_SLOT;
  const peekFits = durationCs >= step * 3;
  const marks = peekFits
    ? [0, move, step, step + move, step * 2, step * 2 + move, step * 3 - move, step * 3]
    : [0, 75, 180, 405, 510];
  const frames = peekFits
    ? [
      [enterY, 0],
      [bottomPeekY, 1],
      [bottomPeekY, 1],
      [holdY, 1],
      [holdY, 1],
      [topPeekY, 1],
      [topPeekY, 1],
      [exitY, 0],
    ]
    : [
      [enterY, 0],
      [enterY, 0],
      [holdY, 1],
      [holdY, 1],
      [exitY, 0],
    ];
  if (marks[marks.length - 1] < durationCs) {
    marks.push(durationCs);
    frames.push([exitY, 0]);
  }

  return {
    duration: `${count * CYCLE_STEP}s`,
    begin: index === 0 ? '0s' : `-${index * CYCLE_STEP}s`,
    enterY,
    bottomPeekY,
    holdY,
    topPeekY,
    exitY,
    keyTimes: marks
      .map((mark) => String(Math.round((mark / durationCs) * 1000) / 1000))
      .join(';'),
    opacity: frames.map(([, opacity]) => opacity).join(';'),
    values: frames.map(([y]) => `${x} ${y}`).join(';'),
  };
}

function requiredText(profile, key) {
  if (typeof profile?.[key] !== 'string' || profile[key].trim() === '') {
    throw new Error(`Missing profile.${key}`);
  }
}

export function assertProfile(profile) {
  for (const key of ['login', 'name', 'status', 'roles', 'tagline', 'promptPath', 'promptCommand', 'contact', 'site']) {
    requiredText(profile, key);
  }

  const groups = profile?.ecosystem?.groups;
  if (!Array.isArray(groups) || groups.length !== 4) {
    throw new Error('Profile needs 4 ecosystem groups');
  }
  for (const group of groups) {
    if (typeof group?.title !== 'string' || group.title.trim() === '') {
      throw new Error('Missing ecosystem group title');
    }
    if (!Object.hasOwn(TONES, group.tone)) throw new Error(`Unknown tone: ${group.tone}`);
    if (!Array.isArray(group.items) || group.items.length === 0) {
      throw new Error(`Missing items for ${group.title}`);
    }
    if (group.maxChars !== undefined && (!Number.isInteger(group.maxChars) || group.maxChars < 8)) {
      throw new Error(`Invalid maxChars for ${group.title}`);
    }
  }
}

function attrs(map) {
  return Object.entries(map)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}="${escapeXml(value)}"`)
    .join(' ');
}

function text(map, value) {
  return `<text ${attrs(map)}>${escapeXml(value)}</text>`;
}

function pushedLabel(pushedAt) {
  const iso = String(pushedAt || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  return formatDayMonth(iso);
}

function headerLabel(profile, projects) {
  const list = projects.length > 0
    ? projects.map((repo) => `${repo.name} (${pushedLabel(repo.pushedAt)})`).join(', ')
    : 'nenhum repositório público recente';
  return [
    profile.name,
    profile.roles,
    profile.tagline,
    `Contato: ${profile.contact}`,
    `Últimos repositórios: ${list}`,
  ].join('. ');
}

function contributionsLabel(summary) {
  const days = summary.activeDays === 1
    ? '1 dia ativo'
    : `${formatCount(summary.activeDays)} dias ativos`;
  const peak = summary.peak.date
    ? `pico de ${formatCount(summary.peak.contributionCount)} em ${formatDayMonth(summary.peak.date)}`
    : 'sem pico';
  return `${formatCount(summary.total)} contribuições nos últimos 12 meses, ${days}, ${peak}.`;
}

function techLabel(profile) {
  const groups = profile.ecosystem.groups
    .map((group) => `${group.title}: ${group.items.join(', ')}`)
    .join('. ');
  return `${profile.ecosystem.title}. ${profile.ecosystem.subtitle}. ${groups}.`;
}

function gridLines(width, height) {
  const lines = [];
  for (let x = 0; x <= width; x += 32) {
    lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="${PALETTE.border}" stroke-width="1"/>`);
  }
  for (let y = 0; y <= height; y += 32) {
    lines.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="${PALETTE.border}" stroke-width="1"/>`);
  }
  return lines.join('');
}

function svgDocument({ width, height, label, body, clipId }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(label)}">
<title>${escapeXml(label)}</title>
<defs>
<clipPath id="${clipId}"><rect width="${width}" height="${height}" rx="18"/></clipPath>
</defs>
<g clip-path="url(#${clipId})">
<rect width="${width}" height="${height}" fill="${PALETTE.base}"/>
<g opacity="0.65">${gridLines(width, height)}</g>
<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="18" fill="none" stroke="${PALETTE.border}"/>
${body}
</g>
</svg>
`;
}

function projectCard(repo) {
  const { width, height } = PROJECT_SLOT.card;
  const baseline = height / 2 + 5;
  return [
    `<rect width="${width}" height="${height}" rx="12" fill="${PALETTE.elevated}" stroke="${PALETTE.accent}" stroke-opacity="0.58"/>`,
    `<circle cx="22" cy="${height / 2}" r="4" fill="${PALETTE.accent}"/>`,
    text({
      x: 38,
      y: baseline,
      fill: PALETTE.text,
      'font-family': SANS,
      'font-size': 15,
      'font-weight': 700,
    }, fitLabel(repo.name, 24)),
    text({
      x: width - 16,
      y: baseline,
      fill: PALETTE.muted,
      'font-family': SANS,
      'font-size': 12,
      'text-anchor': 'end',
    }, pushedLabel(repo.pushedAt)),
  ].join('\n');
}

function openProjectRows(projects) {
  const list = projects.slice(0, 5);
  if (list.length === 0) {
    return text({
      x: 610,
      y: 96,
      fill: PALETTE.muted,
      'font-family': SANS,
      'font-size': 13,
    }, 'nenhum repositório público');
  }

  const { x, holdY, enterY, window } = PROJECT_SLOT;
  const cards = list.map((repo, index) => {
    if (list.length === 1) {
      return `<g transform="translate(${x} ${holdY})">\n${projectCard(repo)}\n</g>`;
    }
    const cycle = projectCycle(index, list.length);
    const baseY = index === 0 ? holdY : enterY;
    return `<g transform="translate(${x} ${baseY})">
<animateTransform attributeName="transform" type="translate" values="${cycle.values}" keyTimes="${cycle.keyTimes}" dur="${cycle.duration}" begin="${cycle.begin}" repeatCount="indefinite"/>
<animate attributeName="opacity" values="${cycle.opacity}" keyTimes="${cycle.keyTimes}" dur="${cycle.duration}" begin="${cycle.begin}" repeatCount="indefinite"/>
${projectCard(repo)}
</g>`;
  });

  const stops = openFadeStops()
    .map((stop) => `<stop offset="${stop.offset}" stop-color="#ffffff" stop-opacity="${stop.opacity}"/>`)
    .join('');
  return `<svg x="${window.x}" y="${window.y}" width="${window.width}" height="${window.height}" viewBox="0 0 ${window.width} ${window.height}" overflow="hidden">
<defs>
<linearGradient id="header-open-fade" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${window.height}">
${stops}
</linearGradient>
<mask id="header-open-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${window.width}" height="${window.height}">
<rect x="0" y="0" width="${window.width}" height="${window.height}" fill="url(#header-open-fade)"/>
</mask>
</defs>
<g mask="url(#header-open-mask)">
${cards.join('\n')}
</g>
</svg>`;
}

export function renderHeader(profile, projects = []) {
  const width = CARD_WIDTH;
  const height = 308;
  const label = headerLabel(profile, projects);
  const promptSize = 13;
  const site = profile.site.replace(/^https:\/\//, '');

  const body = [
    `<rect x="32" y="28" width="138" height="28" rx="14" fill="${PALETTE.raised}" stroke="${PALETTE.border}"/>`,
    `<circle cx="50" cy="42" r="4.5" fill="${PALETTE.success}" opacity="1"><animate attributeName="opacity" values="1;0.35;1" dur="1.8s" repeatCount="indefinite"/></circle>`,
    text({ x: 62, y: 47, fill: PALETTE.success, 'font-family': SANS, 'font-size': 11, 'font-weight': 700, 'letter-spacing': 1.2 }, profile.status),
    text({ x: 32, y: 114, fill: PALETTE.text, 'font-family': SANS, 'font-size': 40, 'font-weight': 700 }, profile.name),
    `<rect x="32" y="128" width="236" height="4" rx="2" fill="${PALETTE.accent}"/>`,
    text({ x: 32, y: 164, fill: PALETTE.muted, 'font-family': SANS, 'font-size': 13, 'font-weight': 700, 'letter-spacing': 0.6 }, profile.roles),
    text({ x: 32, y: 192, fill: PALETTE.accent, 'font-family': MONO, 'font-size': 15 }, '>'),
    text({ x: 50, y: 192, fill: PALETTE.text, 'font-family': SANS, 'font-size': 16 }, profile.tagline),
    text({ x: 32, y: 216, fill: PALETTE.faint, 'font-family': SANS, 'font-size': 13 }, `${profile.contact}   ·   ${site}`),
    `<rect x="32" y="234" width="528" height="42" rx="10" fill="${PALETTE.raised}" stroke="${PALETTE.border}"/>`,
    `<text x="48" y="260" font-family="${escapeXml(MONO)}" font-size="${promptSize}">`,
    `<tspan fill="${PALETTE.accent}">${escapeXml(profile.promptPath)}</tspan>`,
    `<tspan fill="${PALETTE.faint}"> $ </tspan>`,
    `<tspan fill="${PALETTE.text}">${escapeXml(profile.promptCommand)}</tspan>`,
    `<tspan fill="${PALETTE.accent}"> ▌<animate attributeName="opacity" values="1;0;1" dur="1s" repeatCount="indefinite"/></tspan>`,
    `</text>`,
    `<rect x="588" y="24" width="340" height="260" rx="14" fill="${PALETTE.raised}" stroke="${PALETTE.border}"/>`,
    text({ x: 610, y: 52, fill: PALETTE.muted, 'font-family': SANS, 'font-size': 11, 'font-weight': 700, 'letter-spacing': 1.6 }, 'ABERTOS'),
    `<circle cx="896" cy="48" r="4" fill="${PALETTE.success}" opacity="1"><animate attributeName="opacity" values="1;0.35;1" dur="1.8s" repeatCount="indefinite"/></circle>`,
    openProjectRows(projects),
  ].join('\n');

  return svgDocument({ width, height, label, body, clipId: 'header' });
}

export function renderContributions(calendar, login) {
  const summary = summarizeContributions(calendar);
  const weeks = Array.isArray(calendar?.weeks) ? calendar.weeks : [];
  const cell = 13;
  const left = 58;
  const right = 28;
  const top = 172;
  const gaps = Math.max(1, weeks.length - 1);
  let step = (CARD_WIDTH - left - right - cell) / gaps;
  if (step > 18) step = 16;

  const height = Math.ceil(top + 6 * step + cell + 42);
  const label = `Atividade de ${login}. ${contributionsLabel(summary)}`;
  const peakLabel = summary.peak.date ? `PICO · ${formatDayMonth(summary.peak.date)}` : 'PICO';
  const latestLabel = summary.latest.date ? `ÚLTIMO · ${formatDayMonth(summary.latest.date)}` : 'ÚLTIMO';
  const cells = [];

  weeks.forEach((week, column) => {
    for (const item of week.contributionDays || []) {
      const count = Number(item.contributionCount || 0);
      const weekday = Number(item.weekday || 0);
      const fill = LEVEL_COLOR[item.contributionLevel] || LEVEL_COLOR.NONE;
      const x = left + column * step;
      const y = top + weekday * step;
      const title = `${count} ${count === 1 ? 'contribuição' : 'contribuições'} em ${item.date}`;
      cells.push(
        `<g><title>${escapeXml(title)}</title><rect data-day="${escapeXml(item.date)}" data-level="${escapeXml(item.contributionLevel || 'NONE')}" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${cell}" height="${cell}" rx="2" fill="${fill}" shape-rendering="crispEdges"/></g>`,
      );
    }
  });

  const months = monthLabels(weeks, left, step)
    .map((item) => text({
      x: item.x.toFixed(2),
      y: top - 16,
      fill: PALETTE.faint,
      'font-family': SANS,
      'font-size': 11,
    }, item.text));

  const weekdays = [['Seg', 1], ['Qua', 3], ['Sex', 5]]
    .map(([name, weekday]) => text({
      x: 24,
      y: top + weekday * step + 11,
      fill: PALETTE.faint,
      'font-family': SANS,
      'font-size': 11,
    }, name));

  const legendX = CARD_WIDTH - 168;
  const legendY = height - 20;
  const legend = Object.values(LEVEL_COLOR)
    .map((fill, index) => `<rect x="${legendX + 36 + index * 16}" y="${legendY - 10}" width="11" height="11" rx="2" fill="${fill}"/>`)
    .join('');

  const stat = (x, value, caption) => [
    text({ x, y: 104, fill: PALETTE.text, 'font-family': SANS, 'font-size': 26, 'font-weight': 700 }, formatCount(value)),
    text({ x, y: 124, fill: PALETTE.faint, 'font-family': SANS, 'font-size': 10, 'font-weight': 700, 'letter-spacing': 0.7 }, caption),
  ].join('\n');

  const body = [
    `<rect x="28" y="24" width="92" height="4" rx="2" fill="${PALETTE.accent}"/>`,
    text({ x: 28, y: 52, fill: PALETTE.text, 'font-family': SANS, 'font-size': 18, 'font-weight': 700, 'letter-spacing': 0.8 }, 'ATIVIDADE'),
    text({ x: 28, y: 72, fill: PALETTE.muted, 'font-family': SANS, 'font-size': 13 }, 'contribuições diárias nos últimos 12 meses'),
    `<circle cx="${CARD_WIDTH - 214}" cy="40" r="4" fill="${PALETTE.success}" opacity="1"><animate attributeName="opacity" values="1;0.35;1" dur="1.8s" repeatCount="indefinite"/></circle>`,
    text({ x: CARD_WIDTH - 202, y: 44, fill: PALETTE.success, 'font-family': SANS, 'font-size': 11, 'font-weight': 700, 'letter-spacing': 0.8 }, 'ATUALIZADO DIARIAMENTE'),
    stat(28, summary.total, 'TOTAL EM 12 MESES'),
    stat(250, summary.activeDays, 'DIAS ATIVOS'),
    stat(430, summary.peak.contributionCount, peakLabel),
    stat(650, summary.latest.contributionCount, latestLabel),
    months.join('\n'),
    weekdays.join('\n'),
    cells.join('\n'),
    text({ x: 28, y: legendY, fill: PALETTE.faint, 'font-family': SANS, 'font-size': 11 }, 'cada quadrado é um dia  ·  a cor mostra o volume'),
    text({ x: legendX, y: legendY, fill: PALETTE.faint, 'font-family': SANS, 'font-size': 11 }, 'Menos'),
    legend,
    text({ x: legendX + 124, y: legendY, fill: PALETTE.faint, 'font-family': SANS, 'font-size': 11 }, 'Mais'),
  ].join('\n');

  return svgDocument({ width: CARD_WIDTH, height, label, body, clipId: 'activity' });
}

export function renderTech(profile) {
  const width = CARD_WIDTH;
  const pad = 24;
  const gap = 14;
  const cardWidth = (width - pad * 2 - gap * 3) / 4;
  const wrapped = profile.ecosystem.groups.map((group) => {
    const limit = Number.isFinite(Number(group.maxChars)) ? Number(group.maxChars) : 30;
    return wrapItems(group.items, limit);
  });
  const maxLines = Math.max(...wrapped.map((lines) => lines.length));
  const cardHeight = 36 + maxLines * 22 + 18;
  const cardY = 92;
  const height = cardY + cardHeight + 24;
  const label = techLabel(profile);

  const cards = profile.ecosystem.groups.map((group, index) => {
    const tone = TONES[group.tone];
    const x = pad + index * (cardWidth + gap);
    const lines = wrapped[index].map((line, lineIndex) => text({
      x: x + 16,
      y: cardY + 58 + lineIndex * 22,
      fill: PALETTE.text,
      'font-family': SANS,
      'font-size': 13,
    }, line));

    return [
      `<rect x="${x}" y="${cardY}" width="${cardWidth}" height="${cardHeight}" rx="14" fill="${tone.bg}" stroke="${tone.stroke}"/>`,
      `<circle cx="${x + 22}" cy="${cardY + 24}" r="4" fill="${tone.title}"/>`,
      text({
        x: x + 34,
        y: cardY + 28,
        fill: tone.title,
        'font-family': SANS,
        'font-size': 11,
        'font-weight': 700,
        'letter-spacing': 0.7,
      }, group.title),
      lines.join('\n'),
    ].join('\n');
  });

  const body = [
    `<rect x="24" y="22" width="92" height="4" rx="2" fill="${PALETTE.accent}"/>`,
    text({ x: 24, y: 50, fill: PALETTE.text, 'font-family': SANS, 'font-size': 18, 'font-weight': 700, 'letter-spacing': 0.8 }, profile.ecosystem.title),
    text({ x: 24, y: 70, fill: PALETTE.muted, 'font-family': SANS, 'font-size': 13 }, profile.ecosystem.subtitle),
    text({
      x: width - 24,
      y: 50,
      fill: PALETTE.muted,
      'font-family': SANS,
      'font-size': 11,
      'font-weight': 700,
      'letter-spacing': 0.8,
      'text-anchor': 'end',
    }, profile.ecosystem.kicker),
    cards.join('\n'),
  ].join('\n');

  return svgDocument({ width, height, label, body, clipId: 'tech' });
}

export function renderReadme(profile, projects, summary) {
  const cacheKey = `${summary.latest.date || '0'}-${summary.total}`;
  const version = `?v=${cacheKey}`;

  return `<div align="center">

<a href="${escapeXml(profile.site)}">
  <img src="./assets/profile-header.svg${version}" alt="${escapeXml(headerLabel(profile, projects))}" width="100%" />
</a>

<br/>

<a href="https://github.com/${escapeXml(profile.login)}">
  <img src="./assets/contributions.svg${version}" alt="${escapeXml(contributionsLabel(summary))}" width="100%" />
</a>

<br/>

<img src="./assets/tech-ecosystem.svg${version}" alt="${escapeXml(techLabel(profile))}" width="100%" />

</div>
`;
}
