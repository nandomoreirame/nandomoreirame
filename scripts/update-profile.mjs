import fs from 'node:fs';
import path from 'node:path';
import {
  assertProfile,
  readCalendar,
  readRepositories,
  renderContributions,
  selectOpenProjects,
  renderHeader,
  renderReadme,
  renderTech,
  summarizeContributions,
} from './cards.mjs';

const root = path.resolve(import.meta.dirname, '..');
const profile = JSON.parse(fs.readFileSync(path.join(root, 'profile.json'), 'utf8'));
assertProfile(profile);

const token = process.env.GITHUB_TOKEN;
if (!token) throw new Error('GITHUB_TOKEN is missing');

const query = `
  query($login: String!) {
    user(login: $login) {
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              contributionCount
              contributionLevel
              date
              weekday
            }
          }
        }
      }
      repositories(
        first: 30
        privacy: PUBLIC
        ownerAffiliations: OWNER
        isFork: false
        orderBy: { field: PUSHED_AT, direction: DESC }
      ) {
        nodes {
          name
          isFork
          isArchived
          pushedAt
        }
      }
    }
  }
`;

const response = await fetch('https://api.github.com/graphql', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'nandomoreirame-profile',
  },
  body: JSON.stringify({
    query,
    variables: { login: profile.login },
  }),
});

if (!response.ok) {
  throw new Error(`GitHub GraphQL responded ${response.status}`);
}

const payload = await response.json();
const calendar = readCalendar(payload);
const projects = selectOpenProjects(readRepositories(payload), { login: profile.login });
const summary = summarizeContributions(calendar);
const assets = path.join(root, 'assets');

fs.mkdirSync(assets, { recursive: true });
fs.writeFileSync(path.join(assets, 'profile-header.svg'), renderHeader(profile, projects));
fs.writeFileSync(path.join(assets, 'contributions.svg'), renderContributions(calendar, profile.login));
fs.writeFileSync(path.join(assets, 'tech-ecosystem.svg'), renderTech(profile));
fs.writeFileSync(path.join(root, 'README.md'), renderReadme(profile, projects, summary));

console.log(`Rendered profile cards: ${summary.total} contributions. Open: ${projects.map((repo) => repo.name).join(', ')}.`);
