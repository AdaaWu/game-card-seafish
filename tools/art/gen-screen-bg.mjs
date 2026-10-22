#!/usr/bin/env node
// batch-20261023-screens 非對戰畫面背景，並行呼叫 Codex 圖像生成
// 用法: node tools/art/gen-screen-bg.mjs [--only id1,id2] [--force] [--strict] [--dry-run] [--jobs 3]
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, statSync, mkdirSync, copyFileSync, appendFileSync, writeFileSync, readFileSync, renameSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CODEX = process.env.CODEX_BIN || '/Users/sunnywu/.bun/bin/codex';
const GEN_DIR = join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'generated_images');
const LOG = join(ROOT, 'tools', 'gen-art.log');
const BATCH = join(ROOT, 'assets/pending/batch-20261023-screens');
const RAW = join(BATCH, '_raw');
const PROMPT_LOG = join(RAW, 'prompts.json');
const BATTLE = 'assets/pending/batch-20261022-card/battle-bg';
const REFS = {
  landscape: [`${BATTLE}/bg-battle-landscape-b.png`, 'assets/_source/portraits/xiaoye.png'],
  portrait: [`${BATTLE}/bg-battle-portrait-b.png`, 'assets/_source/portraits/xiaoye.png'],
};
const TIMEOUT_MS = 10 * 60 * 1000;
const LIMIT_RE = /rate.?limit|usage limit|quota|too many requests|\b429\b/i;
const HEAD = 'Use your built-in image generation tool to create exactly ONE image. Do not run shell commands and do not edit files.';

const STYLE = 'A full-bleed background illustration from the SAME SERIES as the first attached image (an underwater coral reef battle background): same series, same painter, same lighting and same color palette and tone. Match its look exactly: hand-painted transparent watercolor washes with colored-pencil hatching and paper grain, thin soft purple-grey outlines #6E5F80 (no black lines), gentle soft diffuse light from the upper left with lavender-tinted shadows, muted low-saturation pastel macaron palette, rich rounded pastel corals in coral pink, apricot and cream, swaying seagrass, scallop shells and smooth lavender-grey reef rocks. The second attached image is only a brushwork and color reference: do NOT draw that character or any character.';
const TONE = 'Overall gradient from #E4F4F1 at the top through #C6E4EE and #B3D2E8 to #C8C1E6 at the bottom, cream #F8F4EC and apricot #F5C9A0 highlights, warm and calm.';
const RULES = 'Lighting must be soft and even: no visible light rays, no god rays, no strong light and dark beams. Do not show the sea surface: no water-surface ripples, no bright caustic glints or sparkling light patterns anywhere, especially in the top 12% and bottom 12% of the image, which must stay soft, smooth and low detail. Everything rests firmly on the seabed or on reef rocks: no floating islands, no floating rocks, no objects hanging in mid-water, no large bubbles.';
const SUFFIX = 'No sticker border, no die-cut outline. Do NOT include: text, letters, numbers, signs with writing, map labels, logos, watermark, characters, creatures, fish, faces, eyes, mouths, people, horizon line, metallic shine, 3D render look, neon colors.';
// 重出時加的構圖收緊句
const STRICT = 'Strict layout: the central area described above must be an almost empty, smooth, even watercolor wash with no objects in it at all. Keep every coral, pillar, house, arch, shelf and rock pushed out to the outermost 15% of the left and right edges and the corners. The top 12% band must be a smooth plain wash with no ripples.';
const VARIANT = {
  a: 'Variant: a slightly more open and airy composition, details pushed further out to the edges and corners.',
  b: 'Variant: more corals along the edges, with slightly warmer cream and apricot tones, closest in mood to the first attached image.',
};

const SCREEN = {
  title: {
    subject: 'The grand panoramic vista of the Warm Light Reef, a coral reef city: majestic tall rounded coral towers and terraced coral cliffs rising on both sides and receding into soft misty blue distance, giving a sense of scale and depth. Lush coral clusters, seagrass and shells fill the lower corners. This is the most majestic and spacious scene of the series.',
    landscape: 'Composition: wide 16:9 landscape. The upper-middle area (from 25% to 75% horizontally, 12% to 45% vertically) is reserved for the game title logo: only an almost empty, very soft light watercolor wash, no detail. The central area (20% to 80% horizontally, 25% to 75% vertically) is low contrast and low detail as well. The tall coral towers stand at the far left and far right edges. Generate at the largest landscape size available.',
    portrait: 'Composition: tall 9:16 portrait. The upper-middle area (from 10% to 90% horizontally, 12% to 40% vertically) is reserved for the game title logo: only an almost empty, very soft light watercolor wash, no detail. The central area (10% to 90% horizontally, 28% to 72% vertically) is low contrast and low detail as well. The tall coral towers stand along the left and right edges and the lower corners. Generate at the largest portrait size available.',
  },
  menu: {
    subject: 'A cozy everyday street district of the Warm Light Reef where the Photosynthesis Office stands: small rounded homes and offices grown from coral and giant shells, round doorways, sea-glass windows with warm cream glow, seagrass awnings, shell mailboxes and little coral garden beds, all firmly built on the reef. Daily life, warm and welcoming, no people.',
    landscape: 'Composition: wide 16:9 landscape. The coral houses line the left and right edges like a street seen in soft perspective. The central area (from 20% to 80% horizontally, 25% to 75% vertically) must be very low contrast and low detail, only soft watercolor wash, because menu buttons will be placed on top. Generate at the largest landscape size available.',
    portrait: 'Composition: tall 9:16 portrait. The coral houses line the left and right edges and the lower corners. The central area (from 10% to 90% horizontally, 28% to 72% vertically) must be very low contrast and low detail, only soft watercolor wash, because menu buttons will be placed on top. Generate at the largest portrait size available.',
  },
  story: {
    subject: 'A gentle high-angle bird\'s-eye view looking down onto the seafloor terrain of the Warm Light Reef, painted like a soft watercolor illustrated map but with no map symbols, no drawn paths, no labels. Three regions blend softly into each other as large gentle color washes: the Tide current shallows in pale blue-cyan #9CCBE6 and #9EDBD2 with sandy channels and flowing water ribbons; the Frost deep valley in icy white and lavender #EEF3FA, #B8C2E8 and #CFC4D9 with frosted pale rocks; the Light reef summit in butter yellow and warm gold #F6DE8D, #E8C27A and #F5C9A0 with warm coral terraces. Corals, seagrass and rocks seen from above frame the outer edges.',
    landscape: 'Composition: wide 16:9 landscape. The Tide region is on the left third, the Frost region in the middle third, the Light region on the right third. The central area (from 15% to 85% horizontally, 20% to 80% vertically) must be very low contrast and low detail, only soft color washes of the three regions, because level nodes will be placed on top. Richer terrain detail only at the outer edges. Generate at the largest landscape size available.',
    portrait: 'Composition: tall 9:16 portrait. The Tide region is at the bottom third, the Frost region in the middle third, the Light region at the top third. The central area (from 10% to 90% horizontally, 18% to 82% vertically) must be very low contrast and low detail, only soft color washes of the three regions, because level nodes will be placed on top. Richer terrain detail only at the outer edges. Generate at the largest portrait size available.',
  },
  deck: {
    subject: 'A cozy underwater shell collection room and coral library inside the Warm Light Reef: shelves carved into coral and reef rock hold scallop shells, sea-glass jars, pearls and rolled kelp scrolls (no writing), framed by coral pillars and seagrass. Calm, tidy and warm.',
    landscape: 'Composition: wide 16:9 landscape. The coral shelves and pillars sit only along the left and right edges and the top corners. The central area (from 15% to 85% horizontally, 18% to 85% vertically) must be a clean, very low contrast, almost empty soft watercolor wash, because it will be fully covered by game cards. Generate at the largest landscape size available.',
    portrait: 'Composition: tall 9:16 portrait. The coral shelves and pillars sit only along the left and right edges and the top and bottom corners. The central area (from 8% to 92% horizontally, 15% to 85% vertically) must be a clean, very low contrast, almost empty soft watercolor wash, because it will be fully covered by game cards. Generate at the largest portrait size available.',
  },
  picker: {
    subject: 'The entrance and waiting area of the underwater arena of the Warm Light Reef: a grand rounded coral archway gate, benches of smooth stones and giant open shells, seagrass garlands and coral pillars, a calm moment before a friendly match, no people.',
    landscape: 'Composition: wide 16:9 landscape. The coral archway pillars and benches frame the left and right edges. The central area (from 20% to 80% horizontally, 25% to 75% vertically) must be very low contrast and low detail, only soft watercolor wash, because opponent selection cards will be placed on top. Generate at the largest landscape size available.',
    portrait: 'Composition: tall 9:16 portrait. The coral archway pillars and benches frame the left and right edges and the lower corners. The central area (from 10% to 90% horizontally, 28% to 72% vertically) must be very low contrast and low detail, only soft watercolor wash, because opponent selection cards will be placed on top. Generate at the largest portrait size available.',
  },
};

function jobs() {
  const list = [];
  for (const s of Object.keys(SCREEN)) {
    for (const o of ['landscape', 'portrait']) {
      for (const v of ['a', 'b']) {
        list.push({ id: `bg-${s}-${o}-${v}`, orient: o, prompt: [HEAD, STYLE, `Subject: ${SCREEN[s].subject}`, TONE, SCREEN[s][o], RULES, VARIANT[v], SUFFIX, 'Reply with one short line when done.'].join('\n\n') });
      }
    }
  }
  return list;
}

function log(line) {
  const text = `${new Date().toISOString()} ${line}`;
  appendFileSync(LOG, text + '\n');
  console.log(text);
}

function runCodex(prompt, refs) {
  return new Promise((done) => {
    // -i 放在其他旗標前面，避免吃掉後面的參數
    const args = ['exec'];
    for (const r of refs) args.push('-i', join(ROOT, r));
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
  const parallel = jobsIdx >= 0 ? Number(argv[jobsIdx + 1]) : 3;
  const force = argv.includes('--force');
  const strict = argv.includes('--strict');
  mkdirSync(RAW, { recursive: true });
  let list = jobs();
  if (only) list = list.filter((j) => only.has(j.id));
  if (strict) list = list.map((j) => ({ ...j, prompt: j.prompt.replace(SUFFIX, `${STRICT}\n\n${SUFFIX}`) }));
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
        const res = await runCodex(job.prompt, REFS[job.orient]);
        const secs = ((Date.now() - start) / 1000).toFixed(0);
        const src = res.threadId && findGenerated(res.threadId);
        if (src) {
          const dst = join(RAW, `${job.id}.png`);
          // 重出時保留前一版
          if (existsSync(dst)) renameSync(dst, join(RAW, `${job.id}.prev-${Date.now()}.png`));
          copyFileSync(src, dst);
          const record = existsSync(PROMPT_LOG) ? JSON.parse(readFileSync(PROMPT_LOG, 'utf8')) : {};
          record[job.id] = { prompt: job.prompt, refs: REFS[job.orient], thread: res.threadId, attempt, secs: Number(secs), at: new Date().toISOString(), regen: force, strict };
          writeFileSync(PROMPT_LOG, JSON.stringify(record, null, 2));
          log(`OK   ${job.id} attempt=${attempt} ${secs}s -> assets/pending/batch-20261023-screens/_raw/${job.id}.png`);
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
  log(`DONE batch-20261023-screens total=${list.length} failed=${failed}${halted ? ' halted' : ''}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
