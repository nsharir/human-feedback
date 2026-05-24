#!/usr/bin/env node
'use strict';

const { Command } = require('commander');
const pc          = require('picocolors');
const path        = require('path');
const fs          = require('fs');
const { compile, detectTool } = require('../lib/compiler');

const pkg = require('../package.json');

// ── Formatting helpers ────────────────────────────────────────────────────────

const sym = {
  ok:   pc.green('✓'),
  err:  pc.red('✗'),
  info: pc.dim('·'),
  arr:  pc.dim('→'),
};

function printBanner() {
  console.log('');
  console.log(pc.bold('  agent-feedback') + pc.dim(` v${pkg.version}`));
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
  .name('agent-feedback')
  .version(pkg.version, '-v, --version')
  .description(pkg.description)
  .addHelpText('after', `
${pc.bold('Examples:')}
  ${pc.dim('# Auto-detect tool from extension (use either `afb` or `agent-feedback`)')}
  $ afb compile page.html      -o page.annotated.html
  $ afb compile docs.md        -o docs-review.html
  $ afb compile questions.json -o feedback.html

  ${pc.dim('# Install hooks into your agent harness (auto-wraps every file the agent writes)')}
  $ afb install                ${pc.dim('# interactive — detects what is present')}
  $ afb install --claude-code  ${pc.dim('# targeted')}
  $ afb install --all          ${pc.dim('# every detected harness')}

  ${pc.dim('# Override tool detection')}
  $ afb compile input.html --tool annotator -o out.html

${pc.bold('Supported tools:')}
  ${pc.cyan('annotator')}     .html / .htm        Wraps a static HTML page with the annotation UI
  ${pc.cyan('md-annotator')}  .md / .markdown     Bakes markdown into a rendered, annotatable preview
  ${pc.cyan('feedback')}      .json               Bakes a questions config into the agent-feedback form

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
  .description('Install agent-feedback hooks into one or more agent harnesses')
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
    const explicit = Object.keys(HARNESS_FLAGS).filter(k => opts[k.replace(/-/g, '')] || opts[k.split('-')[0]]);
    // Commander camel-cases: --claude-code → opts.claudeCode
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
      // Every harness detected at the chosen scope
      targets = Object.keys(detected).filter(k => detected[k][scope]);
      if (targets.length === 0) {
        printError(`No agent harnesses detected at ${scope} scope.\n  Looked for: ${Object.values(installer.HARNESSES).map(h => scope === 'global' ? h.globalMarker : h.projectMarker).join(', ')}`);
        process.exit(1);
      }
    } else {
      // Interactive mode
      console.log(`  ${pc.bold('Detected agent harnesses')} ${pc.dim('(' + scope + ' scope)')}:`);
      console.log('');
      const candidates = [];
      for (const [key, label] of Object.entries(HARNESS_FLAGS)) {
        if (detected[key][scope]) {
          console.log(`    ${sym.ok} ${pc.cyan(label.padEnd(14))} ${pc.dim(scope === 'global' ? installer.HARNESSES[key].globalMarker : installer.HARNESSES[key].projectMarker)}`);
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
        : await readlineQuestion(`  Install hooks into all ${candidates.length} detected? ${pc.dim('[Y/n] ')}`);
      if (answer && answer.trim().toLowerCase().startsWith('n')) {
        console.log('  Cancelled.\n');
        process.exit(0);
      }
      targets = candidates;
    }

    console.log('');
    console.log(`  ${pc.bold('Installing hooks…')}`);
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
      console.log(`  ${sym.ok} ${pc.bold('Done.')} Restart your agent for hooks to take effect.`);
    } else {
      console.log(`  ${pc.dim('Nothing to do.')}`);
    }
    console.log('');
  });

// ── uninstall command ─────────────────────────────────────────────────────────

program
  .command('uninstall')
  .description('Remove agent-feedback hooks from one or more agent harnesses')
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
          console.log(`  ${sym.ok} ${pc.cyan(HARNESS_FLAGS[key])}  ${pc.dim('removed from')} ${pc.dim(result.target)}`);
        } else {
          console.log(`  ${pc.dim('·')} ${pc.cyan(HARNESS_FLAGS[key])}  ${pc.dim('nothing to remove' + (result.note ? ' (' + result.note + ')' : ''))}`);
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
  .description('Show which agent harnesses are detected and whether the hook is installed')
  .action(() => {
    printBanner();
    const d = installer.detectAll();
    console.log(`  ${pc.bold('Detected agent harnesses:')}`);
    console.log('');
    for (const [key, label] of Object.entries(HARNESS_FLAGS)) {
      const proj = d[key].project ? pc.green('✓') : pc.dim('·');
      const glob = d[key].global  ? pc.green('✓') : pc.dim('·');
      console.log(`  ${pc.cyan(label.padEnd(14))}  project ${proj}   global ${glob}`);
    }
    console.log('');
  });

// ── hidden __hook command (invoked by hook scripts) ───────────────────────────

program
  .command('__hook', { hidden: true })
  .description('Internal: run the post-write hook (invoked by harness hook configs)')
  .action(() => {
    // Delegate to the shared hook script
    require('../plugins/shared/post-write-hook.js');
  });

program.parse(process.argv);

// Show help if no args
if (!process.argv.slice(2).length) {
  printBanner();
  program.outputHelp();
}
