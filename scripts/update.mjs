import { fileURLToPath } from 'node:url';
import { createGitHubClient } from '../src/github.mjs';
import { readConfig, updateProject } from '../src/project.mjs';

try {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const config = await readConfig(root);
  const token = config.includePrivate ? process.env.PROFILE_STATS_TOKEN : process.env.GITHUB_TOKEN;
  const data = await updateProject(root, createGitHubClient({ token }));
  console.log(`Профиль ${data.username} обновлён на ${data.updatedOn}. Коммиты: ${data.activity.commits}; PR: ${data.activity.pullRequests}; область: ${data.visibility}.`);
} catch (error) {
  console.error(`Обновление не выполнено: ${error.message}`);
  process.exitCode = 1;
}
