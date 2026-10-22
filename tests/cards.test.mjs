import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  escapeXml,
  formatDayMonth,
  starsLabel,
  summarizeContributions,
  monthLabels,
  wrapItems,
  readCalendar,
  readRepositories,
  selectOpenProjects,
  fitLabel,
  projectCycle,
  openFadeStops,
  PROJECT_SLOT,
  assertProfile,
  renderHeader,
  renderContributions,
  renderTech,
  renderReadme,
} from '../scripts/cards.mjs';

const profile = {
  login: 'nandomoreirame',
  name: 'Fernando Moreira',
  status: 'DISPONÍVEL',
  roles: 'ENGENHEIRO DE IA  ·  FULL CYCLE  ·  PRODUCT BUILDER',
  tagline: 'do dado à produção, em São Paulo',
  promptPath: '~/github/nandomoreirame',
  promptCommand: 'software desde 2011',
  contact: 'github@nandomoreira.dev',
  site: 'https://nandomoreira.dev',
  featured: {
    repo: 'forja',
    badge: 'DESKTOP',
    tags: ['Electron', 'React', 'TypeScript'],
    note: 'cliente para Claude Code, Codex e Gemini',
  },
  ecosystem: {
    title: 'ECOSSISTEMA',
    subtitle: 'as tecnologias com que eu construo software',
    kicker: 'IA  ·  PRODUTO  ·  FULL CYCLE',
    groups: [
      { title: 'IA E AGENTES', tone: 'green', items: ['Claude Code', 'Codex', 'MCP'] },
      { title: 'FRONTEND', tone: 'blue', items: ['TypeScript', 'React'] },
      { title: 'BACKEND E DADOS', tone: 'purple', items: ['Python', 'FastAPI'] },
      { title: 'CLOUD E SISTEMAS', tone: 'amber', items: ['AWS', 'Rust'] },
    ],
  },
};

function day(date, weekday, count, level) {
  return { date, weekday, contributionCount: count, contributionLevel: level };
}

function weeksFrom(start, count) {
  const weeks = [];
  let cursor = new Date(`${start}T00:00:00Z`);
  for (let index = 0; index < count; index += 1) {
    const contributionDays = [];
    for (let weekday = 0; weekday < 7; weekday += 1) {
      contributionDays.push(day(cursor.toISOString().slice(0, 10), weekday, 0, 'NONE'));
      cursor = new Date(cursor.getTime() + 86_400_000);
    }
    weeks.push({ contributionDays });
  }
  return weeks;
}

test('escapeXml escapes markup', () => {
  assert.equal(
    escapeXml(`A & B <C> "D" 'E'`),
    'A &amp; B &lt;C&gt; &quot;D&quot; &apos;E&apos;',
  );
});

test('formatDayMonth reads the calendar date, not the local timezone', () => {
  assert.equal(formatDayMonth('2026-01-07'), '7 jan');
  assert.equal(formatDayMonth('2026-10-22'), '22 out');
});

test('starsLabel pluralizes in pt-BR', () => {
  assert.equal(starsLabel(0), '0 estrelas');
  assert.equal(starsLabel(1), '1 estrela');
  assert.equal(starsLabel(11), '11 estrelas');
  assert.equal(starsLabel(1000), '1.000 estrelas');
});

test('summarizeContributions uses the API total, the earliest peak and the last day', () => {
  const summary = summarizeContributions({
    totalContributions: 100,
    weeks: [
      { contributionDays: [day('2026-01-04', 0, 0, 'NONE'), day('2026-01-05', 1, 5, 'SECOND_QUARTILE'), day('2026-01-06', 2, 5, 'SECOND_QUARTILE')] },
      { contributionDays: [day('2026-01-11', 0, 2, 'FIRST_QUARTILE')] },
    ],
  });

  assert.equal(summary.total, 100);
  assert.equal(summary.activeDays, 3);
  assert.equal(summary.peak.date, '2026-01-05');
  assert.equal(summary.peak.contributionCount, 5);
  assert.equal(summary.latest.date, '2026-01-11');
  assert.equal(summary.latest.contributionCount, 2);
});

test('summarizeContributions sums the visible days when the total is missing', () => {
  const summary = summarizeContributions({
    weeks: [{ contributionDays: [day('2026-01-05', 1, 2, 'FIRST_QUARTILE'), day('2026-01-06', 2, 3, 'FIRST_QUARTILE')] }],
  });

  assert.equal(summary.total, 5);
});

test('summarizeContributions survives an empty calendar', () => {
  const summary = summarizeContributions({ totalContributions: 0, weeks: [] });

  assert.equal(summary.total, 0);
  assert.equal(summary.activeDays, 0);
  assert.equal(summary.peak.contributionCount, 0);
  assert.equal(summary.peak.date, '');
  assert.equal(summary.latest.contributionCount, 0);
  assert.equal(summary.latest.date, '');
});

test('monthLabels drops a partial opening month that would collide and keeps later months', () => {
  const labels = monthLabels(weeksFrom('2025-10-26', 7), 58, 16);

  assert.deepEqual(labels.map((label) => label.text), ['nov', 'dez']);
});

test('monthLabels keeps each month once across a normal span', () => {
  const labels = monthLabels(weeksFrom('2026-01-04', 10), 58, 16);

  assert.deepEqual(labels.map((label) => label.text), ['jan', 'fev', 'mar']);
});

test('wrapItems breaks before the line budget and keeps every item', () => {
  assert.deepEqual(
    wrapItems(['TypeScript', 'React', 'Next.js', 'Vue.js', 'Nuxt', 'Angular', 'Astro', 'Tailwind'], 27),
    ['TypeScript · React', 'Next.js · Vue.js · Nuxt', 'Angular · Astro · Tailwind'],
  );
});

test('wrapItems leaves an oversized item on its own line', () => {
  assert.deepEqual(wrapItems(['Supercalifragilistic'], 8), ['Supercalifragilistic']);
});

test('wrapItems returns an empty list for no items', () => {
  assert.deepEqual(wrapItems([], 28), []);
});

test('readCalendar rejects an error payload', () => {
  assert.throws(() => readCalendar({ errors: [{ message: 'denied' }] }), /denied/);
});

test('readCalendar rejects a payload without a calendar', () => {
  assert.throws(() => readCalendar({ data: { user: {} } }), /calendar/i);
});

test('readCalendar returns the calendar weeks', () => {
  const calendar = readCalendar({
    data: { user: { contributionsCollection: { contributionCalendar: { totalContributions: 1, weeks: [] } } } },
  });

  assert.equal(calendar.totalContributions, 1);
});

test('readRepositories returns the repository nodes', () => {
  const nodes = readRepositories({
    data: { user: { repositories: { nodes: [{ name: 'forja' }] } } },
  });

  assert.equal(nodes[0].name, 'forja');
});

test('readRepositories throws when the list is missing', () => {
  assert.throws(() => readRepositories({ data: { user: {} } }), /repositor/i);
});

test('selectOpenProjects keeps the five newest repos that are not forks, archived, or the profile', () => {
  const selected = selectOpenProjects([
    { name: 'nandomoreirame', pushedAt: '2026-10-21T00:00:00Z', isFork: false, isArchived: false },
    { name: 'sixth', pushedAt: '2026-10-09T00:00:00Z', isFork: false, isArchived: false },
    { name: 'forked', pushedAt: '2026-10-20T00:00:00Z', isFork: true, isArchived: false },
    { name: 'archived', pushedAt: '2026-10-19T00:00:00Z', isFork: false, isArchived: true },
    { name: 'noctalia-gistbar', pushedAt: '2026-10-10T00:00:00Z', isFork: false, isArchived: false },
    { name: 'nandomoreira.dev', pushedAt: '2026-10-22T15:13:00Z', isFork: false, isArchived: false },
    { name: 'terminalnoir', pushedAt: '2026-10-21T19:00:00Z', isFork: false, isArchived: false },
    { name: 'noctalia-daybar', pushedAt: '2026-10-20T00:00:00Z', isFork: false, isArchived: false },
    { name: 'noctalia-aibar', pushedAt: '2026-10-14T00:00:00Z', isFork: false, isArchived: false },
  ], { login: 'nandomoreirame' });

  assert.deepEqual(selected.map((repo) => repo.name), [
    'nandomoreira.dev',
    'terminalnoir',
    'noctalia-daybar',
    'noctalia-aibar',
    'noctalia-gistbar',
  ]);
});

test('fitLabel keeps short names and truncates long ones', () => {
  assert.equal(fitLabel('forja', 24), 'forja');
  assert.equal(fitLabel('noctalia-desktop-sticky-notes', 24), 'noctalia-desktop-sticky…');
});

test('assertProfile accepts a complete profile', () => {
  assert.doesNotThrow(() => assertProfile(profile));
});

test('assertProfile rejects a profile without a name', () => {
  assert.throws(() => assertProfile({ ...profile, name: '' }), /name/);
});

test('profile.json is a complete profile', () => {
  const stored = JSON.parse(fs.readFileSync(new URL('../profile.json', import.meta.url), 'utf8'));

  assert.doesNotThrow(() => assertProfile(stored));
  assert.equal(stored.contact, 'github@nandomoreira.dev');
  assert.equal(stored.featured, undefined);
});

test('renderHeader lists the open projects and escapes their names', () => {
  const svg = renderHeader({ ...profile, name: 'A & B', tagline: 'diz "oi"' }, [
    { name: 'A & B', pushedAt: '2026-10-22T15:13:00Z' },
    { name: 'terminalnoir', pushedAt: '2026-10-21T19:00:00Z' },
  ]);

  assert.match(svg, /A &amp; B/);
  assert.doesNotMatch(svg, /A & B/);
  assert.match(svg, /aria-label="[^"]*diz &quot;oi&quot;/);
  assert.match(svg, /aria-label="[^"]*terminalnoir/);
  assert.match(svg, />22 out</);
  assert.match(svg, />21 out</);
  assert.match(svg, /DISPONÍVEL/);
  assert.match(svg, /github@nandomoreira\.dev/);
  assert.doesNotMatch(svg, /[—–]/);
});

test('renderHeader says when there is no open project', () => {
  const svg = renderHeader(profile, []);

  assert.match(svg, /nenhum repositório público/);
  assert.doesNotMatch(svg, /animateTransform/);
  assert.match(svg, /values="1;0;1" dur="1s"/);
});

test('projectCycle keeps a sliver of the card above and the card below while one rests', () => {
  const first = projectCycle(0, 5);
  const second = projectCycle(1, 5);
  const last = projectCycle(4, 5);
  const { window, card } = PROJECT_SLOT;

  assert.equal(first.duration, '15s');
  assert.equal(first.begin, '0s');
  assert.equal(second.begin, '-3s');
  assert.equal(last.begin, '-12s');
  assert.ok(first.bottomPeekY < window.height);
  assert.ok(first.bottomPeekY + card.height > window.height);
  assert.ok(first.topPeekY < 0);
  assert.ok(first.topPeekY + card.height > 0);
  assert.ok(first.holdY >= first.topPeekY + card.height);
  assert.ok(first.holdY + card.height <= first.bottomPeekY);
  assert.ok(first.enterY > window.height);
  assert.ok(first.exitY + card.height <= 0);

  const times = first.keyTimes.split(';').map(Number);
  const ys = first.values.split(';').map((pair) => Number(pair.split(' ')[1]));
  const opacity = first.opacity.split(';').map(Number);
  const rests = [];
  for (let index = 0; index < ys.length - 1; index += 1) {
    if (ys[index] === ys[index + 1]) {
      rests.push({ y: ys[index], start: times[index], opacity: opacity[index] });
    }
  }
  const bottom = rests.find((item) => item.y === first.bottomPeekY);
  const center = rests.find((item) => item.y === first.holdY);
  const top = rests.find((item) => item.y === first.topPeekY);
  const duration = Number.parseFloat(first.duration);

  assert.ok(bottom, 'bottom sliver rests');
  assert.ok(center, 'center card rests');
  assert.ok(top, 'top sliver rests');
  assert.equal(bottom.opacity, 1);
  assert.equal(center.opacity, 1);
  assert.equal(top.opacity, 1);
  assert.ok(Math.abs((center.start - bottom.start) * duration - 3) < 0.05);
  assert.ok(Math.abs((top.start - center.start) * duration - 3) < 0.05);
  assert.throws(() => projectCycle(0, 1), /cycle/i);
  assert.throws(() => projectCycle(5, 5), /index/i);
});

test('renderHeader fades the cards above and below toward the window edges', () => {
  const stops = openFadeStops();
  const { holdY, window, card } = PROJECT_SLOT;

  assert.deepEqual(stops.map((stop) => stop.opacity), [0, 1, 1, 0]);
  assert.ok(stops[1].offset > 0 && stops[1].offset < stops[2].offset && stops[2].offset < 1);
  assert.ok(holdY / window.height >= stops[1].offset);
  assert.ok((holdY + card.height) / window.height <= stops[2].offset);

  const svg = renderHeader(profile, [
    { name: 'nandomoreira.dev', pushedAt: '2026-10-22T15:13:00Z' },
    { name: 'terminalnoir', pushedAt: '2026-10-21T19:00:00Z' },
    { name: 'noctalia-daybar', pushedAt: '2026-10-20T12:00:00Z' },
  ]);

  assert.match(svg, /gradientUnits="userSpaceOnUse"/);
  assert.match(svg, new RegExp(`y2="${window.height}"`));
  for (const stop of stops) {
    assert.match(svg, new RegExp(`offset="${stop.offset}" stop-color="#ffffff" stop-opacity="${stop.opacity}"`));
  }
  assert.match(svg, /mask="url\(#header-open-mask\)"/);
  assert.doesNotMatch(renderHeader(profile, []), /header-open-mask/);
});

test('renderHeader cycles several projects inside a clipped window and blinks the cursor', () => {
  const svg = renderHeader(profile, [
    { name: 'nandomoreira.dev', pushedAt: '2026-10-22T15:13:00Z' },
    { name: 'terminalnoir', pushedAt: '2026-10-21T19:00:00Z' },
  ]);
  const cycle = projectCycle(1, 2);

  assert.match(svg, /overflow="hidden"/);
  assert.match(svg, new RegExp(`type="translate" values="${cycle.values}"`));
  assert.match(svg, new RegExp(`begin="${cycle.begin}"`));
  assert.match(svg, new RegExp(`dur="${cycle.duration}"`));
  assert.match(svg, /values="1;0;1" dur="1s"/);
  assert.match(svg, />nandomoreira\.dev</);
  assert.match(svg, />terminalnoir</);
});

test('renderHeader shows one open project in place', () => {
  const svg = renderHeader(profile, [{ name: 'forja', pushedAt: '2026-10-22T15:13:00Z' }]);

  assert.match(svg, />forja</);
  assert.match(svg, />22 out</);
  assert.doesNotMatch(svg, /animateTransform/);
});

test('profile cards use the Terminal Noir dark palette', () => {
  const header = renderHeader(profile, [{ name: 'terminalnoir', pushedAt: '2026-10-21T19:00:00Z' }]);
  const activity = renderContributions({ totalContributions: 1, weeks: [] }, 'nandomoreirame');
  const tech = renderTech(profile);
  const forbidden = /#3ddc84|#0c1016|#bc8cff|#26a641|#161d27|#58a6ff|#6cb6ff/i;

  for (const svg of [header, activity, tech]) {
    assert.match(svg, /#0B0B0C/);
    assert.match(svg, /#F5A623/);
    assert.match(svg, /#F4F4F5/);
    assert.doesNotMatch(svg, forbidden);
  }
  assert.match(header, /#34D399/);
  assert.match(tech, /fill="#F5A623"[^>]*>IA E AGENTES</);
  assert.match(tech, /fill="#79C0FF"[^>]*>FRONTEND</);
  assert.match(tech, /fill="#34D399"[^>]*>BACKEND E DADOS</);
  assert.match(tech, /fill="#FACF9E"[^>]*>CLOUD E SISTEMAS</);
});

test('renderContributions places each day on its weekday and colors the level', () => {
  const svg = renderContributions({
    totalContributions: 9,
    weeks: [{
      contributionDays: [
        day('2026-01-04', 0, 0, 'NONE'),
        day('2026-01-05', 1, 4, 'THIRD_QUARTILE'),
        day('2026-01-09', 5, 1, 'NOT_A_LEVEL'),
      ],
    }],
  }, 'nandomoreirame');

  const yOf = (date) => {
    const match = svg.match(new RegExp(`data-day="${date}"[^>]*\\sy="([\\d.]+)"`));
    assert.ok(match, date);
    return Number(match[1]);
  };

  assert.ok(yOf('2026-01-09') > yOf('2026-01-05'));
  assert.ok(yOf('2026-01-05') > yOf('2026-01-04'));
  assert.match(svg, /data-day="2026-01-05"[^>]*fill="#F5A623"/);
  assert.match(svg, /data-day="2026-01-09"[^>]*fill="#222226"/);
  assert.match(svg, /4 contribuições em 2026-01-05/);
  assert.match(svg, /PICO · 5 jan/);
  assert.match(svg, /ÚLTIMO · 9 jan/);
  assert.match(svg, />9</);
  assert.match(svg, /Seg/);
  assert.doesNotMatch(svg, /[—–]/);
});

test('renderContributions renders an empty calendar', () => {
  const svg = renderContributions({ totalContributions: 0, weeks: [] }, 'nandomoreirame');

  assert.match(svg, /<svg/);
  assert.match(svg, />0</);
  assert.match(svg, /PICO</);
});

test('renderTech wraps a group at its own maxChars', () => {
  const custom = structuredClone(profile);
  custom.ecosystem.groups[3].items = ['AWS', 'Google Cloud', 'Docker', 'GitHub Actions', 'Rust', 'Go', 'Linux'];
  custom.ecosystem.groups[3].maxChars = 23;
  const svg = renderTech(custom);

  assert.match(svg, /AWS · Google Cloud/);
  assert.match(svg, /Docker · GitHub Actions/);
  assert.match(svg, /Rust · Go · Linux/);
  assert.doesNotMatch(svg, /Google Cloud · Docker/);
});

test('renderTech prints every group and technology', () => {
  const svg = renderTech(profile);

  for (const group of profile.ecosystem.groups) {
    assert.match(svg, new RegExp(group.title));
    for (const item of group.items) assert.match(svg, new RegExp(item));
  }
  assert.doesNotMatch(svg, /[—–]/);
});

test('renderReadme links the three cards, the site and the view counter', () => {
  const readme = renderReadme(profile, [
    { name: 'terminalnoir', pushedAt: '2026-10-21T19:00:00Z' },
  ], {
    total: 100,
    activeDays: 3,
    peak: { date: '2026-01-05', contributionCount: 5 },
    latest: { date: '2026-01-11', contributionCount: 2 },
  });

  assert.match(readme, /href="https:\/\/nandomoreira\.dev"/);
  assert.match(readme, /assets\/profile-header\.svg\?v=2026-01-11-100/);
  assert.match(readme, /assets\/contributions\.svg\?v=2026-01-11-100/);
  assert.match(readme, /assets\/tech-ecosystem\.svg\?v=2026-01-11-100/);
  assert.match(readme, /100 contribuições/);
  assert.match(readme, /3 dias ativos/);
  assert.match(readme, /komarev\.com\/ghpvc\/\?username=nandomoreirame/);
  assert.match(readme, /color=F5A623/);
  assert.match(readme, /VISUALIZA%C3%87%C3%95ES/);
  assert.doesNotMatch(readme, /[—–]/);
});
