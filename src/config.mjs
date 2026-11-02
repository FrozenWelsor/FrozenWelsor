export const ICONS = Object.freeze(['go', 'python', 'typescript', 'git', 'docker', 'postgresql', 'redis']);

export function validateConfig(config) {
  if (!config || typeof config !== 'object') throw new Error('Конфигурация должна быть объектом.');
  if (config.animations !== undefined && typeof config.animations !== 'boolean') {
    throw new Error('Поле animations должно быть true или false.');
  }
  if (config.includePrivate !== undefined && typeof config.includePrivate !== 'boolean') {
    throw new Error('Поле includePrivate должно быть true или false.');
  }
  if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(config.username ?? '')) {
    throw new Error('Некорректный GitHub username.');
  }
  for (const [field, max] of [['displayName', 48], ['about', 400]]) {
    if (typeof config[field] !== 'string' || !config[field].trim() ||
        [...config[field]].length > max || /[\u0000-\u001f\u007f]/u.test(config[field])) {
      throw new Error(`Некорректное поле ${field}: нужен непустой текст до ${max} символов.`);
    }
  }
  for (const field of ['stack', 'learning']) {
    if (!Array.isArray(config[field]) || config[field].length > 12) {
      throw new Error(`Поле ${field} должно содержать до 12 технологий.`);
    }
    for (const item of config[field]) {
      if (!item || !ICONS.includes(item.icon) || typeof item.name !== 'string' ||
          !item.name.trim() || [...item.name].length > 40 || /[\u0000-\u001f\u007f]/u.test(item.name)) {
        throw new Error(`Некорректная технология в ${field}. Доступные иконки: ${ICONS.join(', ')}.`);
      }
    }
  }
  for (const theme of ['light', 'dark']) {
    for (const key of ['background', 'foreground', 'muted', 'accent', 'line']) {
      if (!/^#[a-f\d]{6}$/i.test(config.themes?.[theme]?.[key] ?? '')) {
        throw new Error(`Некорректный цвет themes.${theme}.${key}.`);
      }
    }
  }
  return config;
}
