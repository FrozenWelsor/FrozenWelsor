import { validateConfig } from './config.mjs';
import { validateAvatar } from './github.mjs';
import { shape } from './shapes.mjs';

const SANS = 'WelsSans, Arial, Helvetica, sans-serif';

function mix(first, second, ratio) {
  const channels = [1, 3, 5].map(index => Math.round(parseInt(first.slice(index, index + 2), 16) * (1 - ratio) + parseInt(second.slice(index, index + 2), 16) * ratio));
  return '#' + channels.map(value => value.toString(16).padStart(2, '0')).join('');
}

function surfaces(theme) {
  const light = parseInt(theme.background.slice(1, 3), 16) > 127;
  return {
    card: light ? mix(theme.background, '#ffffff', .65) : mix(theme.background, theme.accent, .045),
    tile: mix(theme.background, theme.accent, light ? .065 : .09),
    tonal: mix(theme.background, theme.accent, light ? .12 : .19),
    outline: mix(theme.background, theme.accent, light ? .25 : .23)
  };
}

export function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);
}

function textWidth(value, size, mono) {
  return [...value].reduce((sum, char) => sum + (mono ? 0.64 : /[MWmw@]/.test(char) ? 1 : /[A-Z]/.test(char) ? 0.75 : /[ilI.,'! :;]/.test(char) ? 0.36 : /[a-z\d]/.test(char) ? 0.6 : 1), 0) * size;
}

export function wrapText(value, maxWidth, fontSize, mono = false) {
  const lines = [];
  let current = '';
  for (const word of String(value).trim().split(/\s+/u)) {
    if (current && textWidth(`${current} ${word}`, fontSize, mono) <= maxWidth) {
      current += ` ${word}`;
      continue;
    }
    if (current) { lines.push(current); current = ''; }
    for (const char of word) {
      if (current && textWidth(current + char, fontSize, mono) > maxWidth) { lines.push(current); current = ''; }
      current += char;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function text(x, y, value, { size = 30, fill, weight = 400, anchor = 'start' } = {}) {
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="${SANS}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}">${escapeXml(value)}</text>`;
}

function reveal(body, delay = 0, variant = 'enter') {
  return `<g class="${variant}" style="animation-delay:${delay}ms">${body}</g>`;
}

function sectionTitle(value, theme, kind) {
  const badge = `<path d="${shape('cookie', 59, 49, 25)}" fill="${surfaces(theme).tonal}"/>`;
  const glyph = kind === 'stack' ? '<path d="M48 43L59 37L70 43L59 49ZM48 49L59 55L70 49M48 55L59 61L70 55"/>' : '<path d="M49 58V47M59 58V39M69 58V43"/>';
  return reveal(badge + `<g fill="none" stroke="${theme.accent}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>` + text(101, 61, value, { fill: theme.foreground, size: 34, weight: 700 }), 120);
}

function motionStyles(config, section) {
  if (config.animations === false) return '';
  const styles = {
    header: `.avatar-motion{transform-box:fill-box;transform-origin:center;animation:sway 7s ease-in-out infinite}
@keyframes sway{0%,100%{transform:translateY(0) rotate(-.8deg)}50%{transform:translateY(-3px) rotate(.8deg)}}`,
    stack: `.tech-float{transform-box:fill-box;transform-origin:center;animation:nudge 9s ease-in-out infinite both}
@keyframes nudge{0%,78%,100%{transform:translateY(0) rotate(0)}84%{transform:translateY(-2px) rotate(-3deg)}91%{transform:translateY(0) rotate(2deg)}}`,
    activity: `.language-fill{transform-box:fill-box;transform-origin:left center;animation:fill-in 1.2s cubic-bezier(.2,.8,.2,1) .55s both}
@keyframes fill-in{from{transform:scaleX(0)}to{transform:scaleX(1)}}`
  };
  return `.enter{animation:enter .95s cubic-bezier(.2,.8,.2,1) both}
.pop-in{transform-box:fill-box;transform-origin:center;animation:pop-in .85s cubic-bezier(.2,.8,.2,1) both}
@keyframes enter{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
@keyframes pop-in{from{opacity:0;transform:scale(.86)}to{opacity:1;transform:scale(1)}}
${styles[section]}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}`;
}

function svg(id, height, theme, title, description, body, defs = '', styles = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="850" height="${height + 16}" viewBox="0 0 850 ${height + 16}" role="img" aria-labelledby="${id}-title ${id}-desc">
<title id="${id}-title">${escapeXml(title)}</title>
<desc id="${id}-desc">${escapeXml(description)}</desc>
<defs><clipPath id="${id}-card"><rect width="850" height="${height}" rx="32"/></clipPath>${defs}</defs>
<style>@font-face{font-family:WelsSans;src:url(data:font/woff2;base64,${theme.font});font-weight:100 900}text{font-variation-settings:'ROND' 80}${styles}</style>
<rect width="850" height="${height}" rx="32" fill="${surfaces(theme).card}"/>
<g clip-path="url(#${id}-card)">${body}</g>
</svg>
`;
}

function header(config, theme, avatar) {
  const lines = wrapText(config.displayName, 510, 96);
  const palette = surfaces(theme);
  const dataUrl = `data:${avatar.mimeType};base64,${avatar.buffer.toString('base64')}`;
  let body = `<path aria-hidden="true" d="${shape('clover', 828, 342, 66)}" fill="${palette.tile}"/>`;
  body += reveal(`<path d="${shape('sunny', 700, 168, 110)}" fill="${palette.tonal}"/>
<g class="avatar-motion"><image x="596" y="64" width="208" height="208" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatar-crop)" xlink:href="${dataUrl}"/></g>`, 180, 'pop-in');
  body += reveal(text(44, 65, "Hi, I'm", { size: 30, fill: theme.muted }), 150);
  lines.forEach((line, index) => { body += reveal(text(40, 151 + index * 100, line, { size: 96, weight: 700, fill: theme.foreground }), 320 + index * 70); });
  const aboutY = 204 + (lines.length - 1) * 100;
  const aboutLines = wrapText(config.about, 510, 30);
  aboutLines.forEach((line, index) => { body += reveal(text(44, aboutY + index * 40, line, { size: 30, fill: theme.foreground }), 680 + index * 110); });
  const handles = wrapText(`@${config.username}`, 470, 28);
  const handleY = aboutY + (aboutLines.length - 1) * 40 + 32;
  const handleWidth = Math.min(510, Math.max(...handles.map(line => textWidth(line, 28))) + 32);
  const handleHeight = Math.max(50, handles.length * 34 + 16);
  let handle = `<rect x="44" y="${handleY}" width="${handleWidth.toFixed(1)}" height="${handleHeight}" rx="14" fill="${palette.tile}"/>`;
  handles.forEach((line, index) => { handle += text(60, handleY + 34 + index * 34, line, { size: 28, fill: theme.muted }); });
  body += reveal(handle, 1050);
  const finalHeight = Math.max(354, handleY + handleHeight + 28);
  return svg('header', finalHeight, theme, config.displayName, `GitHub profile of ${config.username}. ${config.about}`, body,
    `<clipPath id="avatar-crop"><path d="${shape('cookie12', 700, 168, 98)}"/></clipPath>`, motionStyles(config, 'header'));
}

function technology(item, x, y, width, height, theme, icons, index) {
  const paths = icons[item.icon];
  if (!paths) throw new Error(`Не найдена иконка ${item.icon}.`);
  const lines = wrapText(item.name, width - 76, 28);
  const palette = surfaces(theme);
  let body = `<rect class="tech-chip" x="${x}" y="${y}" width="${width}" height="${height}" rx="14" fill="${index === 0 ? palette.tonal : palette.card}" stroke="${palette.outline}"/>`;
  body += `<g transform="translate(${x + 18} ${y + (height - 32) / 2}) scale(1.33333)" fill="${theme.accent}"><g class="tech-float" style="animation-delay:${800 + index * 750}ms">${paths}</g></g>`;
  lines.forEach((line, index) => { body += text(x + 64, y + (height - (lines.length - 1) * 34) / 2 + 10 + index * 34, line, { size: 28, fill: theme.foreground }); });
  return reveal(body, 240 + index * 95, 'pop-in');
}

function stack(config, theme, icons) {
  let body = sectionTitle('Tech stack', theme, 'stack');
  let x = 36;
  let y = 104;
  let rowHeight = 64;
  const items = [...config.stack, ...config.learning];
  items.forEach((item, index) => {
    const width = Math.max(124, Math.min(778, Math.ceil(textWidth(item.name, 28) + 80)));
    const height = Math.max(64, wrapText(item.name, width - 76, 28).length * 34 + 24);
    if (x + width > 814) { x = 36; y += rowHeight + 14; rowHeight = 64; }
    body += technology(item, x, y, width, height, theme, icons, index);
    x += width + 14;
    rowHeight = Math.max(rowHeight, height);
  });
  if (!items.length) {
    body += text(36, 144, 'Stack to be added.', { size: 28, fill: theme.muted });
  }
  return svg('stack', y + rowHeight + 36, theme, 'Technology stack', items.map(item => item.name).join(', '), body, '', motionStyles(config, 'stack'));
}

export function validateData(data, username) {
  const validDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  if (data?.version !== 1 || data.username?.toLowerCase() !== username.toLowerCase() ||
      (data.visibility !== undefined && !['public', 'all'].includes(data.visibility)) ||
      !validDay(data.updatedOn) || !validDay(data.window?.from) || !validDay(data.window?.to) ||
      data.window.days !== 30 || data.updatedOn !== data.window.to ||
      (Date.parse(data.window.to) - Date.parse(data.window.from)) !== 29 * 86_400_000) {
    throw new Error('Некорректный снимок GitHub-данных. Выполните npm run update.');
  }
  for (const field of ['commits', 'pullRequests']) {
    if (!Number.isSafeInteger(data.activity?.[field]) || data.activity[field] < 0) throw new Error('Некорректный счётчик активности.');
  }
  if (!Array.isArray(data.languages) || !['image/png', 'image/jpeg'].includes(data.avatarMimeType)) throw new Error('Некорректный снимок профиля.');
  const seen = new Set();
  let totalBytes = 0;
  for (const language of data.languages) {
    if (typeof language?.name !== 'string' || !language.name.trim() || language.name.length > 100 ||
        /[\u0000-\u001f\u007f]/u.test(language.name) || !Number.isSafeInteger(language.bytes) || language.bytes <= 0 || seen.has(language.name)) {
      throw new Error('Некорректная статистика языков.');
    }
    seen.add(language.name);
    totalBytes += language.bytes;
  }
  if (!Number.isSafeInteger(totalBytes)) throw new Error('Слишком большой объём статистики языков.');
  return data;
}

function activity(config, data, theme) {
  const number = value => new Intl.NumberFormat('en', { notation: value >= 10_000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value);
  const palette = surfaces(theme);
  let body = sectionTitle('GitHub activity', theme, 'activity');
  const includePrivate = data.visibility === 'all';
  body += reveal(text(814, 58, `30 days · ${includePrivate ? 'public + private' : 'public'}`, { size: 28, fill: theme.muted, anchor: 'end' }), 180);
  [[data.activity.commits, 'Commits'], [data.activity.pullRequests, 'PRs opened']].forEach(([value, label], index) => {
    const x = 36 + index * 401;
    let tile = `<rect class="metric-tile" x="${x}" y="96" width="377" height="78" rx="24" fill="${palette.tile}"/>`;
    tile += `<path d="${shape(index ? 'sunny' : 'clover', x + 43, 135, 24)}" fill="${palette.tonal}"/>`;
    tile += index ? `<path d="M${x + 36} 122V146M${x + 37} 130Q${x + 54} 130 ${x + 54} 143" fill="none" stroke="${theme.accent}" stroke-width="3" stroke-linecap="round"/>` : `<path d="M${x + 30} 135H${x + 56}" stroke="${theme.accent}" stroke-width="3"/><circle cx="${x + 43}" cy="135" r="7" fill="${palette.tonal}" stroke="${theme.accent}" stroke-width="3"/>`;
    tile += `<text x="${x + 82}" y="151" fill="${theme.foreground}" font-family="${SANS}" font-size="48" font-weight="700">${escapeXml(number(value))}<tspan dx="16" fill="${theme.muted}" font-size="30" font-weight="400">${label}</tspan></text>`;
    body += reveal(tile, 230 + index * 140, 'pop-in');
  });
  const total = data.languages.reduce((sum, language) => sum + language.bytes, 0);
  const languages = [...data.languages].sort((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name, 'en')).slice(0, 3);
  const colors = [theme.accent, mix(theme.accent, theme.foreground, .25), mix(theme.accent, theme.background, .35)];
  let offset = 0;
  if (languages.length) {
    body += reveal(text(36, 218, `Languages across ${includePrivate ? 'all' : 'public'} repositories`, { size: 30, fill: theme.muted }), 350);
    body += `<rect x="36" y="238" width="778" height="20" rx="10" fill="${palette.outline}"/><g clip-path="url(#language-track)"><g class="language-fill">`;
    languages.forEach((language, index) => {
      const percent = language.bytes / total * 100;
      const width = percent * 778 / 100;
      body += `<rect class="language-segment" x="${(36 + offset).toFixed(6)}" y="238" width="${width.toFixed(6)}" height="20" fill="${colors[index]}"/>`;
      offset += width;
    });
    body += '</g></g>';
  }
  if (!languages.length) {
    body += reveal(text(36, 218, includePrivate ? 'No language data yet.' : 'No public language data yet.', { size: 30, fill: theme.muted }), 350);
  }
  let x = 36;
  let baseline = 262;
  let rowHeight = 48;
  for (const [index, language] of languages.entries()) {
    const percent = language.bytes / total * 100;
    const label = percent < 0.1 ? '<0.1%' : `${Number(percent.toFixed(1))}%`;
    const labelWidth = textWidth(label, 30);
    const lines = wrapText(language.name, 600 - labelWidth, 30);
    const nameWidth = Math.max(...lines.map(line => textWidth(line, 30)));
    const width = Math.ceil(nameWidth + labelWidth + 62);
    const height = Math.max(48, lines.length * 36 + 12);
    if (x + width > 814) { x = 36; baseline += rowHeight + 12; rowHeight = 48; }
    let legend = `<circle cx="${x + 6}" cy="${baseline + 24}" r="5" fill="${colors[index]}"/>`;
    lines.forEach((line, row) => {
      const percentage = row === lines.length - 1 ? `<tspan dx="10" fill="${theme.muted}">${escapeXml(label)}</tspan>` : '';
      legend += `<text x="${x + 20}" y="${baseline + 34 + row * 36}" fill="${theme.foreground}" font-family="${SANS}" font-size="30">${escapeXml(line)}${percentage}</text>`;
    });
    body += reveal(legend, 650 + index * 80);
    x += width + 12;
    rowHeight = Math.max(rowHeight, height);
  }
  const from = new Date(`${data.window.from}T00:00:00Z`).toLocaleDateString('en', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const to = new Date(`${data.window.to}T00:00:00Z`).toLocaleDateString('en', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const footerY = languages.length ? baseline + rowHeight + 28 : 274;
  body += text(36, footerY, `${from} – ${to}`, { size: 30, fill: theme.muted });
  body += text(814, footerY, `Updated ${data.updatedOn}`, { size: 30, fill: theme.muted, anchor: 'end' });
  const visibility = includePrivate ? 'public and private' : 'public';
  const description = `${data.activity.commits} ${visibility} commits and ${data.activity.pullRequests} ${visibility} pull requests opened from ${data.window.from} to ${data.window.to}. Private activity covers owned repositories. Languages are measured by bytes of code, not proficiency.`;
  return svg('activity', footerY + 30, theme, `${config.displayName}'s ${visibility} GitHub activity`, description, body,
    '<clipPath id="language-track"><rect x="36" y="238" width="778" height="20" rx="10"/></clipPath>', motionStyles(config, 'activity'));
}

export function renderProfile(config, data, avatarBuffer, icons) {
  validateConfig(config);
  validateData(data, config.username);
  const avatar = validateAvatar(avatarBuffer, data.avatarMimeType);
  const files = {};
  for (const name of ['dark', 'light']) {
    const theme = { ...config.themes[name], font: icons.font };
    files[`header-${name}.svg`] = header(config, theme, avatar);
    files[`stack-${name}.svg`] = stack(config, theme, icons);
    files[`activity-${name}.svg`] = activity(config, data, theme);
  }
  return files;
}

export function renderReadme(config, data) {
  validateConfig(config);
  const descriptions = {
    header: `${config.displayName} (@${config.username}). ${config.about}`,
    stack: [...config.stack, ...config.learning].map(item => item.name).join(', '),
    activity: data?.visibility === 'all'
      ? 'Public and private GitHub activity in the last 30 days and languages in owned repositories'
      : 'Public GitHub activity in the last 30 days and languages in public repositories'
  };
  return Object.entries(descriptions).map(([section, alt]) => `<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/${section}-dark.svg">
  <img src="assets/${section}-light.svg" width="100%" alt="${escapeXml(alt)}">
</picture>`).join('\n\n') + `\n\n[All repositories](https://github.com/${config.username}?tab=repositories)\n`;
}
