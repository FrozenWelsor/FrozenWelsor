import { readFile, writeFile, mkdir, mkdtemp, rename, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { ICONS, validateConfig } from './config.mjs';
import { renderProfile, renderReadme } from './render.mjs';

export async function readConfig(root) {
  return validateConfig(JSON.parse(await readFile(join(root, 'profile.json'), 'utf8')));
}

export async function readIcons(root) {
  const icons = {};
  icons.font = (await readFile(join(root, 'resources', 'fonts', 'GoogleSansFlex-subset.woff2'))).toString('base64');
  for (const name of ICONS) {
    const source = await readFile(join(root, 'resources', 'icons', `${name}.svg`), 'utf8');
    const paths = [...source.matchAll(/<path\s+d="([a-z\d.,\s+\-]+)"\s*\/?\s*>/gi)];
    if (!paths.length || !source.includes('viewBox="0 0 24 24"')) throw new Error(`Некорректная локальная иконка ${name}.`);
    icons[name] = paths.map(match => `<path d="${match[1]}"/>`).join('');
  }
  return icons;
}

export function avatarFilename(data) {
  return data.avatarMimeType === 'image/jpeg' ? 'avatar.jpg' : 'avatar.png';
}

export async function readSnapshot(root) {
  let data;
  try { data = JSON.parse(await readFile(join(root, 'data', 'github.json'), 'utf8')); }
  catch (error) {
    if (error.code === 'ENOENT') throw new Error('Нет локальных GitHub-данных. Сначала выполните npm run update.');
    throw error;
  }
  return { data, avatar: await readFile(join(root, 'data', avatarFilename(data))) };
}

async function exists(path) {
  try { await stat(path); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

export async function writeBundle(root, config, snapshot, { move = rename, remove = rm } = {}) {
  // Валидация и рендер проходят до первой записи; затем заменяется целый набор.
  const icons = await readIcons(root);
  const images = renderProfile(config, snapshot.data, snapshot.avatar, icons);
  const readme = renderReadme(config, snapshot.data);
  const stage = await mkdtemp(join(root, '.profile-stage-'));
  const changes = [];
  let preserveStage = false;
  try {
    await mkdir(join(stage, 'new', 'assets'), { recursive: true });
    await mkdir(join(stage, 'new', 'data'), { recursive: true });
    for (const [name, content] of Object.entries(images)) {
      await writeFile(join(stage, 'new', 'assets', name), content);
    }
    await writeFile(join(stage, 'new', 'data', 'github.json'), `${JSON.stringify(snapshot.data, null, 2)}\n`);
    await writeFile(join(stage, 'new', 'data', avatarFilename(snapshot.data)), snapshot.avatar);
    await writeFile(join(stage, 'new', 'README.md'), readme);
    for (const name of ['assets', 'data', 'README.md']) {
      const target = join(root, name);
      const backup = join(stage, `backup-${name}`);
      const change = { target, backup, hadBackup: false, installed: false };
      changes.push(change);
      if (await exists(target)) { await move(target, backup); change.hadBackup = true; }
      await move(join(stage, 'new', name), target);
      change.installed = true;
    }
  } catch (error) {
    // При ошибке файловой системы возвращаем уже заменённые части набора.
    const rollbackErrors = [];
    for (const change of changes.reverse()) {
      try {
        if (change.installed) await remove(change.target, { recursive: true, force: true });
        if (change.hadBackup) await move(change.backup, change.target);
      } catch (rollbackError) { rollbackErrors.push(rollbackError); }
    }
    if (rollbackErrors.length) {
      preserveStage = true;
      throw new Error(`Не удалось полностью восстановить файлы. Резервные копии сохранены в ${stage}.`, {
        cause: new AggregateError([error, ...rollbackErrors])
      });
    }
    throw error;
  } finally {
    if (!preserveStage) await rm(stage, { recursive: true, force: true });
  }
}

export async function renderProject(root) {
  const config = await readConfig(root);
  const snapshot = await readSnapshot(root);
  await writeBundle(root, config, snapshot);
}

export async function updateProject(root, client) {
  const config = await readConfig(root);
  const snapshot = await client.collect(config.username, { includePrivate: config.includePrivate ?? false });
  if ((snapshot.data.visibility ?? 'public') !== (config.includePrivate ? 'all' : 'public')) {
    throw new Error('Область полученной статистики не совпадает с конфигурацией. Предыдущие данные сохранены.');
  }
  await writeBundle(root, config, snapshot);
  return snapshot.data;
}
