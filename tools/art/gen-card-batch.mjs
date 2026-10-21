#!/usr/bin/env node
// batch-20261022-card 的四角圖示與對戰背景，依序呼叫 Codex 圖像生成
// 用法: node tools/art/gen-card-batch.mjs [--only id1,id2] [--dry-run]
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, statSync, mkdirSync, copyFileSync, appendFileSync, writeFileSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CODEX = process.env.CODEX_BIN || '/Users/sunnywu/.bun/bin/codex';
const GEN_DIR = join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'generated_images');
const LOG = join(ROOT, 'tools', 'gen-art.log');
const BATCH = join(ROOT, 'assets/pending/batch-20261022-card');
const RAW = join(BATCH, '_raw');
const PROMPT_LOG = join(RAW, 'prompts.json');
const REFS = ['assets/_source/portraits/xiaoye.png', 'assets/_source/cards/tide-003.png', 'assets/_source/cards/frost-001.png'];
const TIMEOUT_MS = 10 * 60 * 1000;
const LIMIT_RE = /rate.?limit|usage limit|quota|too many requests|\b429\b/i;
const HEAD = 'Use your built-in image generation tool to create exactly ONE image. Do not run shell commands and do not edit files.';

const ICON_STYLE = 'A single game UI badge icon in the exact style of the attached reference sticker sheets: hand-painted watercolor with colored-pencil texture, thin soft purple-grey outlines #6E5F80 (no black lines), gentle soft lighting from the upper left with lavender-tinted shadows and a soft white rim highlight on the upper-left edge, muted pastel macaron palette. The badge has a clean white die-cut sticker border and a faint soft drop shadow. Gentle volume through watercolor shading only, no metallic shine, no 3D render look.';
const ICON_SUBJECT = {
  cost: 'a water-droplet shaped mana gem, pale sky blue #A9D4EC with deep blue #2F5F8A shading and foam white #F2FAFB sparkles',
  attack: 'a coral-spike star shaped badge, butter yellow #F6E3A1 with warm gold #E8C27A shading',
  health: 'a droplet-heart shaped badge, soft pink #F2B8C6 with cherry-blossom pink #F2B6C6 accents',
  'faction-leaf': 'a round emblem with a leaf, leaf green #9CC48A, pink #F2B6C6, sprout green #D6E8A8',
  'faction-tide': 'a round emblem with a curling wave, pale sea blue #9CCBE6, mint #9EDBD2, foam white #F2FAFB',
  'faction-frost': 'a round emblem with a snowflake, ice white #EEF3FA, periwinkle #B8C2E8, ice blue #CFE6F5',
  'faction-light': 'a round emblem with a four-point star sparkle, butter yellow #F6DE8D, warm gold #E8C27A, apricot #F5C9A0',
  'faction-neutral': 'a round emblem with a scallop shell, cream #F7F1E6, beige #E8DCC8, lavender grey #CFC4D9',
};
const NUMBER_AREA = 'Leave a flat, evenly colored circular area in the exact center covering about 60% of the badge diameter, with no texture and no highlight, so a number can be printed on top later.';
const ICON_SUFFIX = 'Composition: square 1:1, badge centered, occupying about 90% of the frame. Background: fully transparent (alpha). Do NOT include: text, letters, numbers, logos, watermark, faces, eyes, mouths, characters.';
const ICON_VARIANT = {
  a: 'Variant: a rounder, softer silhouette with gentle, smooth watercolor shading.',
  b: 'Variant: a more pronounced soft white rim highlight along the upper-left edge.',
  c: 'Variant: more visible colored-pencil hatching texture across the badge.',
};

const BG_STYLE = 'A full-bleed background illustration in the exact painting style of the attached reference sticker sheets: hand-painted transparent watercolor washes with colored-pencil hatching and paper grain, thin soft purple-grey outlines #6E5F80 (no black lines), gentle soft light from the upper left with lavender-tinted shadows, muted low-saturation pastel macaron palette, cool-neutral overall color temperature with warm cream highlights.';
const BG_SUBJECT = 'A calm shallow-water coral reef town called the Warm Light Reef, sunlight filtering down from the sea surface in very soft light rays. Rounded pastel corals, swaying seagrass, small shells and smooth reef rocks gathered along the left and right edges and corners. Gentle hints of the four factions spread evenly: leafy seagrass in #9CC48A, flowing water ribbons in #9CCBE6 and #9EDBD2, pale cool rocks in #B8C2E8, tiny warm light specks in #F6DE8D.';
const BG_TONE = 'Overall gradient from #E4F4F1 at the top through #C6E4EE and #B3D2E8 to #C8C1E6 at the bottom, cream #F8F4EC highlights.';
const BG_COMP = {
  landscape: 'Composition: wide 16:9 landscape. The central area (from 20% to 80% horizontally, 25% to 75% vertically) must be very low contrast and low detail, only soft watercolor wash, because game cards will be placed on top. Keep the top 12% and bottom 12% low detail as well. Put all richer details at the left and right edges. Generate at the largest landscape size available.',
  portrait: 'Composition: tall 9:16 portrait. The central area (from 10% to 90% horizontally, 28% to 72% vertically) must be very low contrast and low detail, only soft watercolor wash. Keep the top 12% and bottom 12% low detail as well. Put richer details at the edges and corners. Generate at the largest portrait size available.',
};
const BG_VARIANT = {
  a: 'Variant: the soft light rays from the sea surface are slightly more visible, still gentle and low contrast.',
  b: 'Variant: more corals along the edges, with slightly warmer cream and apricot tones.',
  c: 'Variant: more flowing water ribbons and seagrass along the edges, with slightly cooler tones.',
};
const BG_SUFFIX = 'No sticker border, no die-cut outline. Do NOT include: text, letters, numbers, logos, watermark, characters, creatures, faces, eyes, mouths, people, horizon line, large bubbles in the center, metallic shine, 3D render look, neon colors.';

function jobs() {
  const list = [];
  for (const k of ['cost', 'attack', 'health']) {
    for (const v of ['a', 'b', 'c']) {
      list.push({ id: `icon-${k}-${v}`, prompt: [HEAD, ICON_STYLE, `Subject: ${ICON_SUBJECT[k]}.`, NUMBER_AREA, ICON_VARIANT[v], ICON_SUFFIX, 'Reply with one short line when done.'].join('\n\n') });
    }
  }
  // 派系徽記依派工上限每陣營取 a、b 兩個變體
  for (const f of ['leaf', 'tide', 'frost', 'light', 'neutral']) {
    for (const v of ['a', 'b']) {
      list.push({ id: `icon-faction-${f}-${v}`, prompt: [HEAD, ICON_STYLE, `Subject: ${ICON_SUBJECT['faction-' + f]}.`, ICON_VARIANT[v], ICON_SUFFIX, 'Reply with one short line when done.'].join('\n\n') });
    }
  }
  for (const o of ['landscape', 'portrait']) {
    for (const v of ['a', 'b', 'c']) {
      list.push({ id: `bg-battle-${o}-${v}`, prompt: [HEAD, BG_STYLE, `Subject: ${BG_SUBJECT}`, BG_TONE, BG_COMP[o], BG_VARIANT[v], BG_SUFFIX, 'Reply with one short line when done.'].join('\n\n') });
    }
  }
  return list;
}

function log(line) {
  const text = `${new Date().toISOString()} ${line}`;
  appendFileSync(LOG, text + '\n');
  console.log(text);
}

function runCodex(prompt) {
  return new Promise((done) => {
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
      const limited = LIMIT_RE.test(stderr) || (/"type":"(?:error|turn\.failed)"/.test(stdout) && LIMIT_RE.test(stdout));
      done({ code, threadId: m && m[1], stderr: stderr.slice(-300), limited });
    });
  });
}

function findGenerated(threadId) {
  const dir = join(GEN_DIR, threadId);
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((f) => f.endsWith('.png'))
    .map((f) => join(dir, f)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return files[0] || null;
}

async function main() {
  const argv = process.argv.slice(2);
  const onlyIdx = argv.indexOf('--only');
  const only = onlyIdx >= 0 ? new Set(argv[onlyIdx + 1].split(',')) : null;
  mkdirSync(RAW, { recursive: true });
  const record = existsSync(PROMPT_LOG) ? JSON.parse(readFileSync(PROMPT_LOG, 'utf8')) : {};
  let list = jobs();
  if (only) list = list.filter((j) => only.has(j.id));
  list = list.filter((j) => !existsSync(join(RAW, `${j.id}.png`)));
  console.log(`待產 ${list.length} 張，依序執行`);
  if (argv.includes('--dry-run')) {
    for (const j of list) console.log(`\n# ${j.id}\n${j.prompt}`);
    return;
  }
  let failed = 0;
  for (const job of list) {
    let ok = false;
    for (let attempt = 1; attempt <= 2 && !ok; attempt++) {
      const start = Date.now();
      const res = await runCodex(job.prompt);
      const secs = ((Date.now() - start) / 1000).toFixed(0);
      const src = res.threadId && findGenerated(res.threadId);
      if (src) {
        copyFileSync(src, join(RAW, `${job.id}.png`));
        record[job.id] = { prompt: job.prompt, refs: REFS, thread: res.threadId, attempt, secs: Number(secs), at: new Date().toISOString() };
        writeFileSync(PROMPT_LOG, JSON.stringify(record, null, 2));
        log(`OK   ${job.id} attempt=${attempt} ${secs}s -> assets/pending/batch-20261022-card/_raw/${job.id}.png`);
        ok = true;
      } else {
        log(`FAIL ${job.id} attempt=${attempt} ${secs}s exit=${res.code} thread=${res.threadId || '-'} ${res.stderr.replace(/\s+/g, ' ')}`);
        if (res.limited) {
          log('HALT 偵測到配額或速率限制，停止派新工作');
          process.exitCode = 1;
          return;
        }
      }
    }
    if (!ok) failed++;
  }
  log(`DONE batch-20261022-card total=${list.length} failed=${failed}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
