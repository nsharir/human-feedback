#!/usr/bin/env node
'use strict';

const { Command } = require('commander');
const pc          = require('picocolors');
const path        = require('path');
const fs          = require('fs');
const { spawnSync } = require('child_process');
const { compile, detectTool } = require('../lib/compiler');
const versionCheck = require('../lib/version-check');

const pkg = require('../package.json');

// ── Formatting helpers ────────────────────────────────────────────────────────

const sym = {
  ok:   pc.green('✓'),
  err:  pc.red('✗'),
  info: pc.dim('·'),
  arr:  pc.dim('→'),
  warn: pc.yellow('⚠'),
};

function printBanner() {
  console.log('');
  console.log(pc.bold('  human-feedback') + pc.dim(` v${pkg.version}`));
  console.log(pc.dim('  close the loop on AI agent output'));
  console.log('');
}

function printResult(result, inputPath, outputPath, elapsed) {
  const sizeKB = (fs.statSync(outputPath).size / 1024).toFixed(1);
  console.log(`  ${sym.ok} ${pc.bold('Compiled successfully')}`);
  console.log('');
  console.log(`  ${sym.info} tool      ${pc.cyan(result.tool)}`);
  console.log(`  ${sym.info} input     ${pc.dim(path.resolve(inputPath))}`);
  console.log(`  ${sym.info} output    ${pc.green(path.resolve(outputPath))}`);
  console.log(`  ${sym.info} size      ${pc.dim(sizeKB + ' KB')}`);
  if (result.questions)  console.log(`  ${sym.info} questions ${pc.dim(result.questions + ' loaded')}`);
  if (result.title)      console.log(`  ${sym.info} title     ${pc.dim(result.title)}`);
  console.log(`  ${sym.info} time      ${pc.dim(elapsed + 'ms')}`);
  console.log('');
}

function printError(msg) {
  console.error('');
  console.error(`  ${sym.err} ${pc.red(pc.bold('Error:'))} ${msg}`);
  console.error('');
}

// ── CLI definition ────────────────────────────────────────────────────────────

const program = new Command();

program
  .name('human-feedback')
  .version(pkg.version, '-v, --version')
  .description(pkg.description)
  .addHelpText('after', `
${pc.bold('Examples:')}
  ${pc.dim('# Auto-detect tool from extension')}
  $ human-feedback compile page.html      -o page.annotated.html
  $ human-feedback compile docs.md        -o docs-review.html
  $ human-feedback compile questions.json -o feedback.html

  ${pc.dim('# Install the /human-feedback command into your agent harness')}
  $ human-feedback install                ${pc.dim('# interactive — detects what is present')}
  $ human-feedback install --claude-code  ${pc.dim('# targeted')}
  $ human-feedback install --all          ${pc.dim('# every detected harness')}

  ${pc.dim('# Override tool detection')}
  $ human-feedback compile input.html --tool annotator -o out.html

${pc.bold('Supported tools:')}
  ${pc.cyan('annotator')}     .html / .htm        Wraps a static HTML page with the annotation UI
  ${pc.cyan('md-annotator')}  .md / .markdown     Bakes markdown into a rendered, annotatable preview
  ${pc.cyan('feedback')}      .json               Bakes a questions config into the human-feedback form

${pc.bold('Feedback JSON schema:')}
  {
    "title": "string",           // optional
    "description": "string",     // optional
    "questions": [
      {
        "id": "q1",              // required, unique
        "text": "Question?",     // required
        "type": "text",          // text|textarea|radio|checkbox|select|boolean|scale|range|date
        "hint": "...",           // optional helper text
        "required": true,        // optional, default false
        "options": ["A","B"],    // required for radio/checkbox/select
        "other": true,           // adds "Other…" + free text (radio/checkbox/select)
        "allowImage": true,      // enables image upload on this question
        "min": 1, "max": 10,     // for scale and range
        "step": 1,               // for range
        "unit": "kg",            // for range display
        "minLabel": "Low",       // for scale
        "maxLabel": "High"       // for scale
      }
    ]
  }
`);

// ── compile command ───────────────────────────────────────────────────────────

program
  .command('compile <input>')
  .description('Compile an input file into a self-contained HTML tool')
  .requiredOption('-o, --out <file>', 'Output HTML file path')
  .option('--tool <name>', 'Override tool detection (annotator | md-annotator | questioner)')
  .option('--force', 'Overwrite output file if it already exists', false)
  .action((input, opts) => {
    printBanner();

    const inputPath  = path.resolve(input);
    const outputPath = path.resolve(opts.out);

    // Guard: input exists
    if (!fs.existsSync(inputPath)) {
      printError(`Input file not found: ${inputPath}`);
      process.exit(1);
    }

    // Guard: output already exists
    if (fs.existsSync(outputPath) && !opts.force) {
      printError(
        `Output file already exists: ${outputPath}\n` +
        `  Use ${pc.bold('--force')} to overwrite.`
      );
      process.exit(1);
    }

    // Detect / validate tool
    const tool = opts.tool || detectTool(inputPath);
    if (!tool) {
      printError(
        `Cannot auto-detect tool from "${path.extname(inputPath)}" extension.\n` +
        `  Use ${pc.bold('--tool <name>')} to specify: annotator | md-annotator | questioner`
      );
      process.exit(1);
    }

    // Print what we're about to do
    console.log(`  ${sym.arr} ${pc.dim(path.basename(inputPath))}  ${pc.dim('→')}  ${pc.bold(path.basename(outputPath))}`);
    console.log(`  ${sym.info} using tool: ${pc.cyan(tool)}`);
    console.log('');

    // Compile
    const t0 = Date.now();
    let result;
    try {
      result = compile(inputPath, outputPath, opts.tool);
    } catch (err) {
      printError(err.message);
      process.exit(1);
    }

    printResult(result, inputPath, outputPath, Date.now() - t0);
  });

// ── info command ──────────────────────────────────────────────────────────────

program
  .command('info <input>')
  .description('Detect which tool would be used for a given file, without compiling')
  .action((input) => {
    printBanner();
    const ext  = path.extname(input).toLowerCase();
    const tool = detectTool(input);
    if (tool) {
      console.log(`  ${sym.ok} ${pc.dim(input)} ${pc.dim('→')} ${pc.cyan(tool)}`);
    } else {
      console.log(`  ${sym.err} ${pc.dim(input)} ${pc.red('— unknown extension: ' + ext)}`);
    }
    console.log('');
  });

// ── install command ───────────────────────────────────────────────────────────

const installer = require('../lib/installer');

const HARNESS_FLAGS = {
  'claude-code': 'Claude Code',
  'cursor':      'Cursor',
  'codex':       'Codex',
  'hermes':      'Hermes',
};

function printInstallResult(label, scope, result) {
  if (result.changed) {
    console.log(`  ${sym.ok} ${pc.cyan(label)} ${pc.dim('(' + scope + ')')}  ${pc.dim('→')} ${pc.green(result.target)}`);
  } else {
    const note = result.note ? ` ${pc.dim('(' + result.note + ')')}` : '';
    console.log(`  ${pc.dim('·')} ${pc.cyan(label)} ${pc.dim('(' + scope + ')')}  ${pc.dim('already installed')}${note}`);
  }
}

function readlineQuestion(query) {
  return new Promise((resolve) => {
    const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
    rl.question(query, (answer) => { rl.close(); resolve(answer); });
  });
}

program
  .command('install')
  .description('Install the /human-feedback command into one or more agent harnesses')
  .option('--claude-code', 'Install into Claude Code')
  .option('--cursor',      'Install into Cursor')
  .option('--codex',       'Install into Codex')
  .option('--hermes',      'Install into Hermes')
  .option('--all',         'Install into every detected harness')
  .option('--global',      'Install at user scope (~/) instead of project scope (./)', false)
  .option('-y, --yes',     'Skip interactive confirmation', false)
  .action(async (opts) => {
    printBanner();

    const scope = opts.global ? 'global' : 'project';
    const detected = installer.detectAll();

    // Decide which harnesses to install into
    let targets = [];
    const flagMap = {
      'claude-code': opts.claudeCode,
      'cursor':      opts.cursor,
      'codex':       opts.codex,
      'hermes':      opts.hermes,
    };
    const flaggedTargets = Object.keys(flagMap).filter(k => flagMap[k]);

    if (flaggedTargets.length > 0) {
      targets = flaggedTargets;
    } else if (opts.all) {
      targets = Object.keys(detected).filter(k => detected[k][scope]);
      if (targets.length === 0) {
        printError(`No agent harnesses detected at ${scope} scope.`);
        process.exit(1);
      }
    } else {
      // Interactive mode
      console.log(`  ${pc.bold('Detected agent harnesses')} ${pc.dim('(' + scope + ' scope)')}:`);
      console.log('');
      const candidates = [];
      for (const [key, label] of Object.entries(HARNESS_FLAGS)) {
        if (detected[key][scope]) {
          console.log(`    ${sym.ok} ${pc.cyan(label.padEnd(14))}`);
          candidates.push(key);
        } else {
          console.log(`    ${pc.dim('·')} ${pc.dim(label.padEnd(14))} ${pc.dim('not found')}`);
        }
      }
      if (candidates.length === 0) {
        console.log('');
        printError(`No supported agent harnesses found at ${scope} scope.\n  Try ${pc.bold('--global')} to install at user scope, or install one of: Claude Code, Cursor, Codex, Hermes.`);
        process.exit(1);
      }
      console.log('');
      const answer = opts.yes
        ? 'y'
        : await readlineQuestion(`  Install into all ${candidates.length} detected? ${pc.dim('[Y/n] ')}`);
      if (answer && answer.trim().toLowerCase().startsWith('n')) {
        console.log('  Cancelled.\n');
        process.exit(0);
      }
      targets = candidates;
    }

    console.log('');
    console.log(`  ${pc.bold('Installing…')}`);
    console.log('');

    let anyChange = false;
    for (const key of targets) {
      try {
        const result = installer.install(key, scope);
        printInstallResult(HARNESS_FLAGS[key], scope, result);
        if (result.changed) anyChange = true;
      } catch (err) {
        console.log(`  ${sym.err} ${pc.cyan(HARNESS_FLAGS[key])}: ${pc.red(err.message)}`);
      }
    }

    console.log('');
    if (anyChange) {
      console.log(`  ${sym.ok} ${pc.bold('Done.')} The /human-feedback command is now available.`);
    } else {
      console.log(`  ${pc.dim('Nothing to do.')}`);
    }
    console.log('');
  });

// ── uninstall command ─────────────────────────────────────────────────────────

program
  .command('uninstall')
  .description('Remove the /human-feedback command from one or more agent harnesses')
  .option('--claude-code', 'Uninstall from Claude Code')
  .option('--cursor',      'Uninstall from Cursor')
  .option('--codex',       'Uninstall from Codex')
  .option('--hermes',      'Uninstall from Hermes')
  .option('--all',         'Uninstall from every harness')
  .option('--global',      'Uninstall at user scope (~/) instead of project scope (./)', false)
  .action((opts) => {
    printBanner();
    const scope = opts.global ? 'global' : 'project';

    const flagMap = {
      'claude-code': opts.claudeCode,
      'cursor':      opts.cursor,
      'codex':       opts.codex,
      'hermes':      opts.hermes,
    };
    let targets = Object.keys(flagMap).filter(k => flagMap[k]);
    if (opts.all || targets.length === 0) targets = Object.keys(HARNESS_FLAGS);

    console.log(`  ${pc.bold('Uninstalling…')} ${pc.dim('(' + scope + ' scope)')}`);
    console.log('');

    for (const key of targets) {
      try {
        const result = installer.uninstall(key, scope);
        if (result.changed) {
          console.log(`  ${sym.ok} ${pc.cyan(HARNESS_FLAGS[key])}  ${pc.dim('removed')}`);
        } else {
          console.log(`  ${pc.dim('·')} ${pc.cyan(HARNESS_FLAGS[key])}  ${pc.dim('nothing to remove')}`);
        }
      } catch (err) {
        console.log(`  ${sym.err} ${pc.cyan(HARNESS_FLAGS[key])}: ${pc.red(err.message)}`);
      }
    }
    console.log('');
  });

// ── doctor command ────────────────────────────────────────────────────────────

program
  .command('doctor')
  .description('Show which agent harnesses are detected and whether /human-feedback is installed')
  .action(() => {
    printBanner();
    const d = installer.detectAll();
    console.log(`  ${pc.bold('Agent harness status:')}`);
    console.log('');
    for (const [key, label] of Object.entries(HARNESS_FLAGS)) {
      const projDetected = d[key].project;
      const globDetected = d[key].global;
      const projInstalled = installer.isInstalled(key, 'project');
      const globInstalled = installer.isInstalled(key, 'global');

      const projStatus = projInstalled ? pc.green('✓ installed')
                       : projDetected  ? pc.dim('not installed')
                       : pc.dim('·');
      const globStatus = globInstalled ? pc.green('✓ installed')
                       : globDetected  ? pc.dim('not installed')
                       : pc.dim('·');

      console.log(`  ${pc.cyan(label.padEnd(14))}  project ${projStatus}   global ${globStatus}`);
    }

    console.log('');
  });

// ── check-for-updates command ────────────────────────────────────────────────

program
  .command('check-for-updates')
  .alias('check-updates')
  .alias('check')
  .description('Check GitHub for a newer version of human-feedback')
  .action(async () => {
    printBanner();
    const result = await versionCheck.fetchLatest();
    if (!result) {
      console.log(`  ${sym.warn} Could not reach GitHub. Try again later or check your network.`);
      console.log('');
      process.exit(0);
    }
    if (result.outdated) {
      console.log(versionCheck.formatBanner(result.current, result.latest));
      console.log(`  Run ${pc.bold('human-feedback update')} to upgrade.`);
      console.log('');
    } else if (result.ahead) {
      console.log(`  ${sym.ok} You're on ${pc.bold('v' + result.current)} — ahead of latest release (${pc.dim('v' + result.latest)}). Looks like a dev build.`);
      console.log('');
    } else {
      console.log(`  ${sym.ok} You're on the latest version (${pc.bold('v' + result.current)}).`);
      console.log('');
    }
  });

// ── update command ───────────────────────────────────────────────────────────

function detectInstallRoot() {
  // The CLI lives at <root>/bin/cli.js — the repo root is one level up.
  // We treat the install as managed by install.sh when that root contains
  // a .git directory (curl|bash clones the repo) AND the root path
  // resembles the install.sh default (HUMAN_FEEDBACK_HOME).
  const root = path.resolve(__dirname, '..');
  const hasGit = fs.existsSync(path.join(root, '.git'));
  return { root, managed: hasGit };
}

program
  .command('update')
  .alias('upgrade')
  .alias('self-update')
  .description('Update human-feedback to the latest version')
  .option('--ref <ref>', 'Git ref to update to (default: main)', 'main')
  .option('--dry-run', 'Print the commands that would run without executing', false)
  .action(async (opts) => {
    printBanner();
    const { root, managed } = detectInstallRoot();

    if (!managed) {
      console.log(`  ${sym.warn} This human-feedback install is not managed by ${pc.bold('install.sh')}.`);
      console.log('');
      console.log(`  Install path: ${pc.dim(root)}`);
      console.log('');
      console.log(`  To update, either:`);
      console.log(`    ${sym.info} from a dev clone:  ${pc.bold('cd ' + root + ' && git pull && npm install && npm run build')}`);
      console.log(`    ${sym.info} switch to the standard install:`);
      console.log(`        ${pc.bold('curl -fsSL https://raw.githubusercontent.com/nsharir/human-feedback/main/install.sh | bash')}`);
      console.log('');
      process.exit(0);
    }

    const ref = opts.ref;
    const dry = opts.dryRun;

    const before = pkg.version;
    console.log(`  ${sym.info} updating from ${pc.bold('v' + before)} (ref: ${pc.cyan(ref)})…`);
    console.log('');

    const steps = [
      ['git', ['-C', root, 'fetch', '--tags', '--quiet', 'origin']],
      ['git', ['-C', root, 'checkout', '--quiet', ref]],
      // Try reset --hard only if we're on a branch (not detached HEAD on a tag)
      ['__maybeReset', [root, ref]],
      ['npm', ['--prefix', root, 'install', '--omit=dev', '--no-audit', '--no-fund', '--silent']],
      ['npm', ['--prefix', root, 'run', 'build', '--silent']],
    ];

    for (const [cmd, args] of steps) {
      if (cmd === '__maybeReset') {
        const [r, refName] = args;
        const sym1 = spawnSync('git', ['-C', r, 'symbolic-ref', '-q', 'HEAD'], { stdio: 'ignore' });
        if (sym1.status === 0) {
          const resetArgs = ['-C', r, 'reset', '--hard', '--quiet', `origin/${refName}`];
          console.log(`  ${pc.dim('$')} git ${resetArgs.join(' ')}`);
          if (!dry) {
            const r2 = spawnSync('git', resetArgs, { stdio: 'inherit' });
            if (r2.status !== 0) { printError('git reset failed.'); process.exit(1); }
          }
        }
        continue;
      }
      console.log(`  ${pc.dim('$')} ${cmd} ${args.join(' ')}`);
      if (dry) continue;
      const r = spawnSync(cmd, args, { stdio: 'inherit' });
      if (r.status !== 0) {
        printError(`${cmd} failed (exit ${r.status}).`);
        process.exit(1);
      }
    }

    if (dry) {
      console.log('');
      console.log(`  ${sym.info} ${pc.dim('(dry run — no changes made)')}`);
      console.log('');
      return;
    }

    // Re-read package.json from disk to pick up the new version.
    let after = before;
    try {
      after = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
    } catch (_) { /* ignore */ }

    console.log('');
    if (after !== before) {
      console.log(`  ${sym.ok} Updated ${pc.bold('v' + before)} → ${pc.bold(pc.green('v' + after))}`);
    } else {
      console.log(`  ${sym.ok} Already at ${pc.bold('v' + after)}.`);
    }
    console.log('');
    console.log(`  ${pc.dim('Tip:')} re-run ${pc.bold('human-feedback install')} to refresh installed skills with the latest content.`);
    console.log('');
  });

// ── help-agents command ──────────────────────────────────────────────────────
//
// Single canonical playbook for AI coding agents installing or using
// human-feedback. README, AGENTS.md, and every plugins/*/INSTALL.md point
// here so we never duplicate the playbook text in N places again.

program
  .command('help-agents')
  .description('Print the install + usage playbook for AI coding agents')
  .action(() => {
    const B = pc.bold;
    const D = pc.dim;
    const lines = [
      '',
      `${B('human-feedback')} ${D('v' + pkg.version)} ${D('— playbook for AI agents')}`,
      '',
      B('When the user asks you to install human-feedback:'),
      '',
      '  1. Run the bootstrap (idempotent — safe on existing installs):',
      `       ${B('curl -fsSL https://raw.githubusercontent.com/nsharir/human-feedback/main/install.sh | bash')}`,
      '',
      `  2. ${B('STOP')}. Ask the user two questions before proceeding:`,
      `       a) ${B('Scope')}    — global (~/) or project-local (this repo)?`,
      `       b) ${B('Harness')}  — claude-code | cursor | codex | hermes | --all`,
      '',
      '  3. Run the matching install command, for example:',
      `       ${B('human-feedback install --codex')}            ${D('# project-local')}`,
      `       ${B('human-feedback install --codex --global')}   ${D('# global')}`,
      `       ${B('human-feedback install --all --global')}     ${D('# every detected harness, globally')}`,
      '',
      '  4. Verify:',
      `       ${B('human-feedback doctor')}`,
      '',
      '  5. Tell the user: most harnesses need a new session or skill reload',
      `     before ${B('/human-feedback')} is available.`,
      '',
      B('When the user asks for feedback on something:'),
      '',
      '  1. Identify the artifact (most recent .md / .html, or write a questions.json).',
      `  2. Run: ${B('human-feedback compile <input> -o <output> --force')}`,
      `  3. Share a ${B('file://')} link to the output.`,
      `  4. ${B('WAIT')} for the user's structured response before continuing.`,
      '  5. If you edit the source file later, recompile immediately and re-share.',
      '',
      B('Update flow:'),
      '',
      `  - If you see  ${D('[human-feedback:update-available current=X latest=Y]')}  in`,
      '    any CLI output, mention it to the user ONCE per conversation.',
      `  - User can run:  ${B('human-feedback update')}`,
      '',
      D(`Full reference: https://github.com/nsharir/human-feedback#readme`),
      '',
    ];
    console.log(lines.join('\n'));
  });

// ── once-per-session version-check hook ──────────────────────────────────────
//
// Fires before every command runs. Races with the command (~5-50ms),
// banner emitted at process exit on stderr (so it doesn't pollute stdout
// that scripts may parse). Stdout gets a machine-readable marker line so
// the agent can detect outdated state deterministically.
//
// Skipped for: update, check-for-updates, --version, --help, uninstall.

const SKIP_AUTO_CHECK = new Set(['update', 'upgrade', 'self-update', 'check-for-updates', 'check-updates', 'check', 'uninstall', 'help-agents']);

function maybeAttachVersionCheck(argv) {
  // Cheap arg parsing: find the first non-flag token as the subcommand.
  let sub = null;
  for (const a of argv.slice(2)) {
    if (a === '--version' || a === '-v' || a === '--help' || a === '-h') return;
    if (a.startsWith('-')) continue;
    sub = a;
    break;
  }
  if (sub && SKIP_AUTO_CHECK.has(sub)) return;

  // Kick off the check immediately; emit banner at process exit if outdated.
  const checkPromise = versionCheck.checkOnce({ current: pkg.version });
  let printed = false;
  const emit = (result) => {
    if (printed || !result || !result.outdated) return;
    printed = true;
    // Banner on stderr to avoid breaking stdout consumers
    process.stderr.write(versionCheck.formatBanner(result.current, result.latest));
    // Machine marker on stdout so agents can detect outdated state
    process.stdout.write(versionCheck.machineMarker(result.current, result.latest) + '\n');
  };
  process.on('beforeExit', async () => {
    // beforeExit can fire repeatedly while the event loop has work; await once.
    try { emit(await checkPromise); } catch (_) { /* silent */ }
  });
  process.on('exit', () => {
    // Last-chance synchronous emit if the promise has already resolved by exit.
    // (beforeExit may not fire if process.exit() is called from a handler.)
    if (printed) return;
    // We can't await here, but if checkPromise already resolved synchronously
    // (cache hit), emit() above will have already fired via beforeExit.
  });
}

maybeAttachVersionCheck(process.argv);

program.parse(process.argv);

// Show help if no args
if (!process.argv.slice(2).length) {
  printBanner();
  program.outputHelp();
}
