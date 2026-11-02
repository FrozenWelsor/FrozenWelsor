const API = 'https://api.github.com';
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export function dateWindow(now = new Date()) {
  if (!(now instanceof Date) || Number.isNaN(now.valueOf())) throw new Error('Некорректная дата.');
  const end = new Date(now.toISOString().slice(0, 10));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 29);
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10), days: 30 };
}

export function isPublicOwnedRepo(repo, username) {
  return repo?.private === false && (!repo.visibility || repo.visibility === 'public') &&
    repo.owner?.login?.toLowerCase() === username.toLowerCase();
}

function isOwnedRepo(repo, username, includePrivate) {
  if (!includePrivate) return isPublicOwnedRepo(repo, username);
  return typeof repo?.private === 'boolean' &&
    (!repo.visibility || repo.visibility === (repo.private ? 'private' : 'public')) &&
    repo.owner?.login?.toLowerCase() === username.toLowerCase();
}

export function aggregateLanguages(results) {
  const totals = new Map();
  for (const languages of results) {
    if (!languages || typeof languages !== 'object' || Array.isArray(languages)) {
      throw new Error('GitHub вернул некорректную статистику языков.');
    }
    for (const [name, bytes] of Object.entries(languages)) {
      if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error('Некорректный объём кода.');
      if (bytes) totals.set(name, (totals.get(name) ?? 0) + bytes);
    }
  }
  return [...totals].map(([name, bytes]) => ({ name, bytes }))
    .sort((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name, 'en'));
}

function safeCount(result) {
  if (result?.incomplete_results !== false || !Number.isSafeInteger(result.total_count) || result.total_count < 0) {
    throw new Error('GitHub вернул неполные результаты поиска. Предыдущие данные сохранены.');
  }
  return result.total_count;
}

export function validateAvatar(buffer, mimeType) {
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX_AVATAR_BYTES) {
    throw new Error('Размер аватара должен быть от 1 байта до 2 МБ.');
  }
  const png = buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (!(mimeType === 'image/png' && png) && !(mimeType === 'image/jpeg' && jpeg)) {
    throw new Error('Аватар должен быть PNG или JPEG с корректной сигнатурой.');
  }
  return { buffer, mimeType };
}

export function createGitHubClient({ token = '', fetchImpl = fetch, now = () => new Date() } = {}) {
  async function api(path, params) {
    const url = new URL(path, API);
    if (params) url.search = new URLSearchParams(params).toString();
    const headers = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2026-03-10',
      'User-Agent': 'wels-profile/1.0'
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    let response;
    try {
      response = await fetchImpl(url, { headers, redirect: 'error', signal: AbortSignal.timeout(20_000) });
    } catch {
      throw new Error('Не удалось соединиться с GitHub API. Проверьте сеть и повторите обновление.');
    }
    if (!response.ok) {
      const limit = response.status === 403 || response.status === 429 ? ' Возможно, достигнут лимит запросов.' : '';
      throw new Error(`GitHub API: HTTP ${response.status}.${limit}`);
    }
    try { return await response.json(); }
    catch { throw new Error('GitHub API вернул некорректный JSON.'); }
  }

  async function avatar(urlString) {
    let url;
    try { url = new URL(urlString); } catch { throw new Error('GitHub не вернул адрес аватара.'); }
    if (url.protocol !== 'https:' || url.hostname !== 'avatars.githubusercontent.com' || url.username || url.password || url.port) {
      throw new Error('Неподдерживаемый источник аватара.');
    }
    url.searchParams.set('s', '256');
    let response;
    try {
      // Авторизация GitHub API никогда не передаётся серверу изображений.
      response = await fetchImpl(url, { redirect: 'error', signal: AbortSignal.timeout(20_000) });
    } catch { throw new Error('Не удалось загрузить аватар. Предыдущее изображение сохранено.'); }
    if (!response.ok) throw new Error(`Не удалось загрузить аватар: HTTP ${response.status}.`);
    if (Number(response.headers.get('content-length')) > MAX_AVATAR_BYTES) throw new Error('Аватар больше 2 МБ.');
    const chunks = [];
    let size = 0;
    if (!response.body) throw new Error('Сервер вернул пустой аватар.');
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > MAX_AVATAR_BYTES) throw new Error('Аватар больше 2 МБ.');
      chunks.push(Buffer.from(chunk));
    }
    return validateAvatar(Buffer.concat(chunks), response.headers.get('content-type')?.split(';')[0].trim());
  }

  return {
    async collect(username, { includePrivate = false } = {}) {
      if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(username ?? '')) throw new Error('Некорректный GitHub username.');
      if (typeof includePrivate !== 'boolean') throw new Error('includePrivate должен быть true или false.');
      if (includePrivate) {
        if (!token) throw new Error('Для приватной статистики добавьте секрет PROFILE_STATS_TOKEN. Предыдущие данные сохранены.');
        const authenticated = await api('/user');
        if (authenticated.login?.toLowerCase() !== username.toLowerCase()) throw new Error('Владелец PROFILE_STATS_TOKEN не совпадает с владельцем профиля.');
      }
      const window = dateWindow(now());
      const user = await api(`/users/${username}`);
      if (user.login?.toLowerCase() !== username.toLowerCase()) throw new Error('GitHub вернул другой профиль.');
      const repositories = [];
      for (let page = 1; ; page++) {
        const batch = await api(includePrivate ? '/user/repos' : `/users/${username}/repos`, {
          ...(includePrivate ? { affiliation: 'owner', visibility: 'all' } : { type: 'owner' }),
          per_page: '100', page: String(page), sort: 'full_name'
        });
        if (!Array.isArray(batch)) throw new Error('GitHub вернул некорректный список репозиториев.');
        repositories.push(...batch.filter(repo => isOwnedRepo(repo, username, includePrivate)));
        if (batch.length < 100) break;
        if (page >= 100) throw new Error('Слишком много страниц репозиториев. Данные не усечены и не сохранены.');
      }
      const languageResults = [];
      for (const repo of repositories) {
        if (repo.fork || repo.archived || repo.name.toLowerCase() === username.toLowerCase()) continue;
        if (!/^[\w.-]+$/.test(repo.name)) throw new Error('Некорректное имя репозитория.');
        languageResults.push(await api(`/repos/${username}/${repo.name}/languages`));
      }
      const range = `${window.from}..${window.to}`;
      // Публичный вклад учитываем в любых репозиториях, приватный — только в личных.
      // Две непересекающиеся выборки не удваивают коммиты и PR.
      const count = async (path, query) => {
        let total = safeCount(await api(path, { q: `${query} is:public`, per_page: '1' }));
        if (includePrivate) total += safeCount(await api(path, { q: `${query} user:${username} is:private`, per_page: '1' }));
        if (!Number.isSafeInteger(total)) throw new Error('Слишком большой счётчик активности.');
        return total;
      };
      const commits = await count('/search/commits', `author:${username} author-date:${range}`);
      const pullRequests = await count('/search/issues', `is:pr author:${username} created:${range}`);
      const image = await avatar(user.avatar_url);
      return {
        data: { version: 1, username, visibility: includePrivate ? 'all' : 'public', updatedOn: window.to, window, activity: { commits, pullRequests }, languages: aggregateLanguages(languageResults), avatarMimeType: image.mimeType },
        avatar: image.buffer
      };
    }
  };
}
