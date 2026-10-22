#!/usr/bin/env node
// batch-20261023-ui 的 UI 素材，並行呼叫 Codex 圖像生成
// 用法: node tools/art/gen-ui-kit.mjs [--only id1,id2] [--jobs 4] [--force] [--dry-run] [--list]
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, statSync, mkdirSync, copyFileSync, appendFileSync, writeFileSync, readFileSync, renameSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CODEX = process.env.CODEX_BIN || '/Users/sunnywu/.bun/bin/codex';
const GEN_DIR = join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'generated_images');
const LOG = join(ROOT, 'tools', 'gen-art.log');
const BATCH_REL = 'assets/pending/batch-20261023-ui';
const RAW = join(ROOT, BATCH_REL, '_raw');
const PROMPT_LOG = join(RAW, 'prompts.json');
const REF_DIR = `${BATCH_REL}/_refs`;
// 角色、已上線圖示、卡框、對戰背景，讓整套與既有素材同系列
const REFS = ['assets/_source/portraits/xiaoye.png', `${REF_DIR}/ref-icons.png`, `${REF_DIR}/ref-card-frame-leaf.png`, `${REF_DIR}/ref-bg-battle.png`];
const TIMEOUT_MS = 10 * 60 * 1000;
const LIMIT_RE = /rate.?limit|usage limit|quota|too many requests|\b429\b/i;
const HEAD = 'Use your built-in image generation tool to create exactly ONE image. Do not run shell commands and do not edit files.';

const STYLE = 'A single static game UI element in the exact painting style of the attached references (the chibi sea slug sticker, the round watercolor badge icons, the soft card frame and the underwater background): hand-painted transparent watercolor with colored-pencil texture and fine paper grain, thin soft purple-grey outlines #6E5F80 (no black lines), gentle soft light from the upper left with lavender-tinted shadows and a soft cream-white inner highlight along the upper edge, muted low-saturation pastel macaron palette. Gentle volume through watercolor shading only, no metallic shine, no glossy plastic, no 3D render look, no neon.';
const STICKER = 'The element has a clean, even white die-cut sticker border around its silhouette and a faint soft lavender-grey drop shadow directly below it.';
const STATIC = 'The element is perfectly static, upright and level: no motion lines, no tilt, no floating or bouncing pose, no sparkles flying around it.';
const SUFFIX = 'Background: fully transparent (alpha). Do NOT include: text, letters, numbers, logos, watermark, characters, creatures, faces, eyes, mouths, hands, scenery, ground, horizon.';
const FLAT = 'Keep the central area perfectly flat and evenly colored with only very faint paper grain, no ornaments and no highlights in it, because text or an image will be placed on top later.';

const VARIANT = {
  a: 'Variant a: soft, smooth watercolor wash with subtle grain; ornaments kept minimal and delicate.',
  b: 'Variant b: slightly more visible colored-pencil hatching on the rim and a slightly richer ornament at the ends, still calm.',
};

// 每項：id 前綴、主體描述、構圖
const ITEMS = [
  ['btn-primary', 'a wide horizontal pill-shaped game button base. Fill is muted lavender purple #7A64B0 with a slightly deeper #5E4C94 thickness lip along the bottom edge (about 8% of the height) so it reads as a gently raised button. Rim is a thin #6E5F80 pencil outline with a soft white inner highlight line along the top.', 'Composition: wide 4:1 horizontal pill, centered, filling about 92% of the width, perfectly symmetric left and right. ' + FLAT],
  ['btn-secondary', 'a wide horizontal pill-shaped game button base. Fill is warm cream paper #FFFDF7 with a soft beige #E2D8C8 thickness lip along the bottom edge (about 8% of the height). Rim is a thin #6E5F80 lavender-grey pencil outline with a soft white inner highlight along the top.', 'Composition: wide 4:1 horizontal pill, centered, filling about 92% of the width, perfectly symmetric left and right. ' + FLAT],
  ['btn-danger', 'a wide horizontal pill-shaped game button base. Fill is a muted dusty rose #B04A6A with a deeper #8A3852 thickness lip along the bottom edge (about 8% of the height). Rim is a thin #6E5F80 pencil outline with a soft white inner highlight along the top.', 'Composition: wide 4:1 horizontal pill, centered, filling about 92% of the width, perfectly symmetric left and right. ' + FLAT],
  ['btn-icon', 'a round game icon button base, a circle of warm cream paper #FFFDF7 with a soft beige #E2D8C8 thickness lip along the bottom edge and a thin #6E5F80 pencil outline, a faint lavender #B9A6DB watercolor ring just inside the rim.', 'Composition: square 1:1, one circle centered, occupying about 86% of the frame. ' + FLAT],
  ['menu-item', 'a large rectangular main-menu button panel with generously rounded corners (radius about 30% of the height). Fill is warm cream watercolor paper #FBF6EC; rim is a soft lavender #B9A6DB watercolor band with a thin #6E5F80 pencil outline; a soft beige #E2D8C8 thickness lip along the bottom edge. Small delicate ornaments only at the far left end: a tiny scallop shell and a small sprig of sea grass in pastel green #9CC48A and pink #F2B6C6, tucked on the rim.', 'Composition: wide 5:1 horizontal panel, centered, filling about 94% of the width. The right 80% of the panel and the whole middle must stay flat cream paper. ' + FLAT],
  ['panel', 'a square dialog panel frame. Fill is warm cream watercolor paper #FBF6EC; rim is a soft lavender #B9A6DB watercolor band about 4% of the width with a thin #6E5F80 pencil outline and a soft cream inner highlight; rounded corners. Each of the four corners has one tiny matching ornament (small scallop shell, tiny pearl, small sea grass sprig) sitting on the rim, all four corners identical in size.', 'Composition: square 1:1 panel centered, occupying about 92% of the frame. Ornaments stay inside the outer 12% border band. ' + FLAT],
  ['nameplate', 'a small horizontal name plate for a character name in a dialogue box: a rounded pill tag of warm cream paper #FFFDF7 with a lavender #9B7FC0 watercolor band along the rim and a thin #6E5F80 pencil outline, one tiny scallop shell ornament stuck on the left end.', 'Composition: wide 4:1 horizontal tag, centered, filling about 90% of the width. ' + FLAT],
  ['ribbon', 'a horizontal title banner ribbon with folded swallowtail ends on both sides, soft lavender #B9A6DB watercolor ribbon with lighter cream #F8F4EC center band, thin #6E5F80 pencil outline, the folded ends slightly deeper #8D74C2.', 'Composition: wide 5:1 horizontal ribbon, centered, perfectly symmetric, filling about 94% of the width. ' + FLAT],
  ['title-underlay-lg', 'a single wide horizontal watercolor brush-stroke swash used behind a page title: soft lavender #CFC4D9 to pale sky #CFE6F5 watercolor wash with gently feathered, slightly uneven brush ends and visible paper grain, a faint cream highlight along the top edge, no outline.', 'Composition: wide 6:1 horizontal stroke, centered, filling about 94% of the width, both ends tapered the same way. No sticker border on this one.'],
  ['title-underlay-sm', 'a small horizontal rounded tag-shaped label base for a section heading: pale cream #F8F4EC watercolor paper with a soft lavender #CFC4D9 wash along the bottom half, thin #6E5F80 pencil outline, rounded ends.', 'Composition: wide 4:1 horizontal tag, centered, filling about 92% of the width. ' + FLAT],
  ['node-locked', 'a round story-map stage node medallion, a thick round rim of pale lavender-grey #CFC4D9 watercolor with a thin #6E5F80 pencil outline, slightly muted and desaturated, the inner disc a flat pale grey-lavender #E4DFEA.', 'Composition: square 1:1, one medallion centered, occupying about 88% of the frame. The inner disc covers about 72% of the diameter. ' + FLAT],
  ['node-available', 'a round story-map stage node medallion, a thick round rim of soft sky blue #A9D4EC and mint #9EDBD2 watercolor with a soft white inner highlight and a thin #6E5F80 pencil outline, the inner disc flat warm cream #FFFDF7, a faint warm butter #F6E3A1 halo painted just outside the rim.', 'Composition: square 1:1, one medallion centered, occupying about 88% of the frame. The inner disc covers about 72% of the diameter. ' + FLAT],
  ['node-cleared', 'a round story-map stage node medallion, a thick round rim of soft leaf green #9CC48A watercolor with tiny pink #F2B6C6 petal accents and a thin #6E5F80 pencil outline, the inner disc flat warm cream #FFFDF7, one small pastel green check-mark seal sticker attached on the lower right of the rim.', 'Composition: square 1:1, one medallion centered, occupying about 88% of the frame. The inner disc covers about 72% of the diameter. ' + FLAT],
  ['node-boss', 'a round story-map boss stage node medallion, larger and more ornate: a thick round rim of muted lavender #9B7FC0 watercolor with a small coral crown of butter yellow #F6DE8D and apricot #F5C9A0 sitting on top of the rim and two small shells on the sides, thin #6E5F80 pencil outline, the inner disc flat warm cream #FFFDF7.', 'Composition: square 1:1, one medallion centered, occupying about 90% of the frame including the crown. The inner disc covers about 62% of the frame width. ' + FLAT],
  ['lock', 'a small cute padlock icon, rounded chubby body in pale lavender-grey #CFC4D9 watercolor with a cream #F8F4EC keyhole shape, shackle in soft #9B7FC0, thin #6E5F80 pencil outline.', 'Composition: square 1:1, the padlock centered, occupying about 80% of the frame.'],
  ['knob', 'a small round slider handle knob shaped like a smooth pearl: cream white #F8F4EC pearl with a soft lavender #B9A6DB shadow side, a tiny soft highlight on the upper left, thin #6E5F80 pencil outline.', 'Composition: square 1:1, one pearl knob centered, occupying about 80% of the frame.'],
  ['divider-seaweed', 'one single small sprig of soft sea grass lying horizontally, three gentle leaf blades in leaf green #9CC48A with sprout green #D6E8A8 highlights and a tiny pink #F2B6C6 bud, thin #6E5F80 pencil outline. It is one repeatable ornament unit for a horizontal divider line.', 'Composition: wide 3:1, the sprig lies horizontally across the exact vertical middle and spans about 90% of the width.'],
  ['divider-pearl', 'one single small ornament unit for a horizontal divider: one cream white #F8F4EC pearl with a lavender shadow, flanked by two tiny lavender #CFC4D9 seed beads, all on one horizontal line, thin #6E5F80 pencil outline.', 'Composition: wide 3:1, the beads lie on the exact vertical middle line, the group spans about 80% of the width.'],
  ['ov-bubble', 'a large transparent soap-bubble shield dome: a thin iridescent pastel rim of sky blue #A9D4EC, mint #9EDBD2 and lavender #CFC4D9, one soft white highlight arc on the upper left, the inside of the bubble almost fully see-through with only a faint pale blue tint.', 'Composition: portrait 4:5, one bubble outline centered, occupying about 92% of the frame. No sticker border; the bubble interior must stay mostly transparent.'],
  ['ov-frozen', 'a frost overlay frame: clusters of pale ice crystals and small snowflakes in ice white #EEF3FA, periwinkle #B8C2E8 and ice blue #CFE6F5 growing inward from all four edges and corners of a portrait rectangle, the center 60% left empty and transparent.', 'Composition: portrait 4:5, crystals hug the outer edges only. No sticker border.'],
  ['ov-stealth', 'a soft veil of drifting lavender sea mist, translucent wisps of lavender #CFC4D9 and pale periwinkle #B8C2E8 watercolor, denser at the bottom and edges, very airy and see-through in the middle.', 'Composition: portrait 4:5, mist fills the frame softly. No sticker border, no outline.'],
];

// 標題前綴：三種造型 × 通用與四陣營配色
const PREFIX_SHAPE = {
  leaf: 'a small rounded leaf sprig with two leaves',
  shell: 'a small rounded scallop shell',
  star: 'a small chubby five-point starfish with rounded arms',
};
const PREFIX_COLOR = {
  base: 'in the series base colors: lavender #9B7FC0 and cream #F8F4EC with a touch of pink #F2B6C6',
  leaf: 'in leaf faction colors: leaf green #9CC48A, cherry pink #F2B6C6, sprout green #D6E8A8',
  tide: 'in tide faction colors: pale sea blue #9CCBE6, mint #9EDBD2, foam white #F2FAFB',
  frost: 'in frost faction colors: ice white #EEF3FA, periwinkle #B8C2E8, ice blue #CFE6F5',
  light: 'in light faction colors: butter yellow #F6DE8D, warm gold #E8C27A, apricot #F5C9A0',
};

function jobs() {
  const list = [];
  const make = (id, subject, comp, v, sticker = true) => list.push({
    id: `${id}-${v}`,
    prompt: [HEAD, STYLE, `Subject: ${subject}`, sticker && !/No sticker border/.test(comp) ? STICKER : '', STATIC, comp, VARIANT[v], SUFFIX, 'Reply with one short line when done.'].filter(Boolean).join('\n\n'),
  });
  for (const [id, subject, comp] of ITEMS) for (const v of ['a', 'b']) make(id, subject, comp, v);
  for (const [shape, sd] of Object.entries(PREFIX_SHAPE)) {
    for (const [color, cd] of Object.entries(PREFIX_COLOR)) {
      for (const v of ['a', 'b']) make(`title-prefix-${shape}-${color}`, `a small title prefix icon: ${sd}, ${cd}, thin #6E5F80 pencil outline.`, 'Composition: square 1:1, the icon centered, occupying about 78% of the frame.', v);
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
    // -i 放在其他旗標前面，避免吃掉後面的參數
    const args = ['exec'];
    for (const r of REFS) args.push('-i', join(ROOT, r));
    args.push('--skip-git-repo-check', '-C', ROOT, '-s', 'read-only', '--json', prompt);
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
  const jobsIdx = argv.indexOf('--jobs');
  const parallel = jobsIdx >= 0 ? Number(argv[jobsIdx + 1]) : 4;
  const force = argv.includes('--force');
  const noteIdx = argv.indexOf('--note');
  const note = noteIdx >= 0 ? argv[noteIdx + 1] : '';
  mkdirSync(RAW, { recursive: true });
  let list = jobs();
  if (argv.includes('--list')) { for (const j of list) console.log(j.id); return; }
  if (only) list = list.filter((j) => only.has(j.id));
  if (note) list = list.map((j) => ({ ...j, prompt: j.prompt.replace(SUFFIX, `${note}\n\n${SUFFIX}`) }));
  if (!force) list = list.filter((j) => !existsSync(join(RAW, `${j.id}.png`)));
  console.log(`待產 ${list.length} 張，並行 ${parallel}`);
  if (argv.includes('--dry-run')) {
    for (const j of list) console.log(`\n# ${j.id}\n${j.prompt}`);
    return;
  }
  let halted = false;
  let failed = 0;
  const queue = [...list];
  async function worker() {
    while (queue.length && !halted) {
      const job = queue.shift();
      let ok = false;
      for (let attempt = 1; attempt <= 2 && !ok && !halted; attempt++) {
        const start = Date.now();
        const res = await runCodex(job.prompt);
        const secs = ((Date.now() - start) / 1000).toFixed(0);
        const src = res.threadId && findGenerated(res.threadId);
        if (src) {
          const dst = join(RAW, `${job.id}.png`);
          // 重出時保留前一版
          if (existsSync(dst)) renameSync(dst, join(RAW, `${job.id}.prev-${Date.now()}.png`));
          copyFileSync(src, dst);
          const record = existsSync(PROMPT_LOG) ? JSON.parse(readFileSync(PROMPT_LOG, 'utf8')) : {};
          record[job.id] = { prompt: job.prompt, refs: REFS, thread: res.threadId, attempt, secs: Number(secs), at: new Date().toISOString(), regen: force, note };
          writeFileSync(PROMPT_LOG, JSON.stringify(record, null, 2));
          log(`OK   ${job.id} attempt=${attempt} ${secs}s -> ${BATCH_REL}/_raw/${job.id}.png`);
          ok = true;
        } else {
          log(`FAIL ${job.id} attempt=${attempt} ${secs}s exit=${res.code} thread=${res.threadId || '-'} ${res.stderr.replace(/\s+/g, ' ')}`);
          if (res.limited) {
            log('HALT 偵測到配額或速率限制，停止派新工作');
            halted = true;
            process.exitCode = 1;
          }
        }
      }
      if (!ok) failed++;
    }
  }
  await Promise.all(Array.from({ length: parallel }, worker));
  log(`DONE batch-20261023-ui total=${list.length} failed=${failed}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
