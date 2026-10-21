#!/usr/bin/env node
// 批次呼叫 Codex CLI 產生卡圖與角色立繪
// 用法: node tools/gen-art.mjs [--only id1,id2] [--limit N] [--concurrency N] [--dry-run]
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, copyFileSync, appendFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CODEX = process.env.CODEX_BIN || '/Users/sunnywu/.bun/bin/codex';
const GEN_DIR = join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'generated_images');
const LOG = join(ROOT, 'tools', 'gen-art.log');
const REFS = ['role1.png', 'role2.png'];
const SIZE = 1024;
const FIT = 0.7;
const TIMEOUT_MS = 10 * 60 * 1000;
// 配額或速率限制的訊號，命中就停止整批
const LIMIT_RE = /rate.?limit|usage limit|quota|too many requests|\b429\b/i;
let halted = false;

const FACTIONS = {
  leaf: { name: 'Leaf', colors: 'leaf green #9CC48A and cherry-blossom pink #F2B6C6', effects: 'tiny leaves, petals, sprouts' },
  tide: { name: 'Tide', colors: 'pale sea blue #9CCBE6 and mint cyan #9EDBD2', effects: 'bubbles, water splashes, ripples' },
  frost: { name: 'Frost', colors: 'ice white #EEF3FA and pale periwinkle #B8C2E8', effects: 'snowflakes, ice crystals, frosty mist' },
  light: { name: 'Light', colors: 'butter yellow #F6DE8D and warm gold #E8C27A', effects: 'star sparkles, light dots, halos' },
  neutral: { name: 'Neutral', colors: 'cream #F7F1E6 and soft beige #E8DCC8', effects: 'pebbles, small shells, sand grains' },
};

const STYLE_PREFIX = [
  'A single chibi sticker illustration in the exact style of the attached reference sticker sheets:',
  'hand-painted watercolor with colored-pencil texture, thin soft purple-grey outlines (no black lines),',
  'gentle soft lighting with lavender-tinted shadows, muted pastel macaron palette',
  '(cream white, leaf green, lavender purple, soft pink, with touches of pale blue and butter yellow).',
  'The character is an anthropomorphic, round, chubby sea creature with NO facial features',
  '(no eyes, no mouth, no nose); emotion is shown only through antenna/tentacle pose and small effect marks.',
  'The character has a clean white die-cut sticker border around its silhouette and a faint soft drop shadow.',
].join(' ');

const SPEC_SUFFIX = [
  'Composition: square 1:1, character centered, occupying about 70% of the frame, empty margins.',
  'Background: fully transparent (alpha).',
  'Do NOT include: text, letters, numbers, logos, watermark, card frame, border frame, scenery, ground, horizon, faces, eyes, mouths.',
].join(' ');

function parseArgs(argv) {
  const opts = { only: null, limit: Infinity, concurrency: 2, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--only') opts.only = new Set(argv[++i].split(',').map((s) => s.trim()).filter(Boolean));
    else if (a === '--limit') opts.limit = Number(argv[++i]);
    else if (a === '--concurrency') opts.concurrency = Math.max(1, Number(argv[++i]));
    else if (a === '--dry-run') opts.dryRun = true;
    else throw new Error(`未知參數 ${a}`);
  }
  return opts;
}

function readJson(rel) {
  const p = join(ROOT, rel);
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null;
}

function asList(data, key) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return Array.isArray(data[key]) ? data[key] : [];
}

const SPELL_NOTE = 'This is a spell card: the magical effect itself is the subject, drawn as one compact sticker vignette'
  + ' (a small creature from the series may appear); keep a single die-cut sticker silhouette, no full-background scenery.';

// artHint 裡的五官描述與「無五官」衝突，組 prompt 前移除
const FACE_RE = /(?:\bwith\s+)?(?:\b(?:a|an)\s+)?(?:\b[\w-]+\s+)?(?:\b\w+-)?\b(?:smil\w*|grin\w*|wink\w*|eyes?|eyed|eyelash\w*|mouths?|faces?|facial|cheeks?|blush\w*|noses?|teeth|tongue|frown\w*|pout\w*|tears?|crying|expressions?)\b/gi;

export function stripFaceWords(text) {
  return String(text || '')
    .split(',')
    .map((seg) => seg.replace(FACE_RE, '').replace(/\s{2,}/g, ' ').trim())
    .filter(Boolean)
    .join(', ');
}

const HERO_LOCK = 'Hero lock (must match the reference sheets exactly): purple rabbit-ear rhinophores,'
  + ' cream-white round body, green leaf cerata with pink tips.';

function isHero(species, id) {
  return String(species || '').includes('葉羊') || id === 'xiaoye';
}

export function buildPrompt({ subject, faction, isSpell, hero, named }) {
  const f = FACTIONS[faction] || FACTIONS.neutral;
  const color = hero
    ? `Faction mood: ${f.name}; use ${f.colors} for effect marks (${f.effects}).`
    : named
      ? `Faction mood: ${f.name}. Make it a chubby, round chibi creature; keep the body colors exactly as described in the subject,`
        + ` and use ${f.colors} for accessories and effect marks (${f.effects}).`
    : isSpell
      ? `Faction mood: ${f.name}; the effect is painted mainly in ${f.colors} (${f.effects}).`
      : `Faction mood: ${f.name}. Make it a chubby, round chibi creature;`
        + ` paint the creature's own body and fins/tentacles in ${f.colors} so the faction color sits on the character itself,`
        + ` not only in the effects (${f.effects}).`;
  return [
    'Use your built-in image generation tool to create exactly ONE image. Do not run shell commands and do not edit files.',
    STYLE_PREFIX,
    `Subject: ${subject}.`,
    hero ? HERO_LOCK : null,
    color,
    isSpell ? SPELL_NOTE : null,
    SPEC_SUFFIX,
    'Reply with one short line when done.',
  ].filter(Boolean).join('\n\n');
}

// 有名字的劇情角色依 portraitHint／artHint 指定的本體色，不套陣營本體色
function cardJob(c, dir, characterIds) {
  const named = c.type === 'character' || characterIds.some((id) => new RegExp(`\\b${id}\\b`, 'i').test(c.artHint || ''));
  const subject = [c.species, stripFaceWords(c.artHint)].filter(Boolean).join(', ') || c.name;
  return {
    id: c.id,
    out: join(ROOT, dir, `${c.id}.png`),
    prompt: buildPrompt({ subject, faction: c.faction, isSpell: c.type === 'spell', hero: isHero(c.species, c.id), named }),
  };
}

function collectJobs() {
  const jobs = [];
  const cardData = readJson('content/cards.phase1.json');
  const characters = asList(readJson('content/story.json'), 'characters').filter((ch) => ch.id);
  const characterIds = characters.map((ch) => ch.id);
  for (const c of [...asList(cardData, 'cards'), ...asList(cardData, 'tokens')]) {
    if (c.id) jobs.push(cardJob(c, 'assets/_source/cards', characterIds));
  }
  for (const ch of characters) {
    jobs.push(cardJob({ ...ch, artHint: ch.portraitHint, type: 'character' }, 'assets/_source/portraits', characterIds));
  }
  return jobs;
}

function log(line) {
  const text = `${new Date().toISOString()} ${line}`;
  appendFileSync(LOG, text + '\n');
  console.log(text);
}

function runCodex(prompt) {
  return new Promise((resolvePromise) => {
    // -i 會吃掉後面所有非旗標參數，所以放在其他旗標之前
    const args = ['exec', '--skip-git-repo-check', '-C', ROOT];
    for (const r of REFS) args.push('-i', join(ROOT, r));
    args.push('-s', 'read-only', '--json', prompt);
    const child = spawn(CODEX, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    const timer = setTimeout(() => child.kill('SIGTERM'), TIMEOUT_MS);
    child.on('close', (code) => {
      clearTimeout(timer);
      const m = stdout.match(/"thread_id":"([^"]+)"/);
      const limited = LIMIT_RE.test(stderr) || /"type":"(?:error|turn\.failed)"[^\n]*/.test(stdout) && LIMIT_RE.test(stdout);
      resolvePromise({ code, threadId: m && m[1], stderr: stderr.slice(-300), limited });
    });
  });
}

// Codex 把圖存在 ~/.codex/generated_images/<thread_id>/，取最新一張
function findGenerated(threadId) {
  const dir = join(GEN_DIR, threadId);
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((f) => f.endsWith('.png'))
    .map((f) => join(dir, f)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return files[0] || null;
}

function postProcess(file) {
  execFileSync('python3', [join(ROOT, 'tools/remove-bg.py'), file, '--fit', String(FIT), '--size', String(SIZE)], { stdio: 'ignore' });
}

async function generate(job) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const start = Date.now();
    const res = await runCodex(job.prompt);
    const secs = ((Date.now() - start) / 1000).toFixed(0);
    const src = res.threadId && findGenerated(res.threadId);
    if (src) {
      mkdirSync(dirname(job.out), { recursive: true });
      copyFileSync(src, job.out);
      postProcess(job.out);
      log(`OK   ${job.id} attempt=${attempt} ${secs}s -> ${job.out.replace(ROOT + '/', '')}`);
      return true;
    }
    log(`FAIL ${job.id} attempt=${attempt} ${secs}s exit=${res.code} thread=${res.threadId || '-'} ${res.stderr.replace(/\s+/g, ' ')}`);
    if (res.limited) {
      halted = true;
      log(`HALT 偵測到配額或速率限制，停止派新工作`);
      return false;
    }
  }
  return false;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  let jobs = collectJobs();
  if (opts.only) jobs = jobs.filter((j) => opts.only.has(j.id));
  jobs = jobs.filter((j) => !existsSync(j.out)).slice(0, opts.limit);
  console.log(`待產 ${jobs.length} 張，並行 ${opts.concurrency}`);
  if (opts.dryRun) {
    for (const j of jobs) console.log(`\n# ${j.id} -> ${j.out.replace(ROOT + '/', '')}\n${j.prompt}`);
    return;
  }
  const queue = [...jobs];
  let failed = 0;
  const worker = async () => {
    while (queue.length && !halted) {
      if (!(await generate(queue.shift()))) failed++;
    }
  };
  await Promise.all(Array.from({ length: Math.min(opts.concurrency, jobs.length) }, worker));
  log(`DONE total=${jobs.length} failed=${failed} skipped=${queue.length}${halted ? ' halted=limit' : ''}`);
  process.exitCode = failed ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
