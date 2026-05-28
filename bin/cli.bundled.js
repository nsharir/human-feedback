#!/usr/bin/env node
/* Built by build/bundle.js — do not edit directly. Edit bin/cli.js and run `npm run build:bundle`. */
"use strict";
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// node_modules/commander/lib/error.js
var require_error = __commonJS({
  "node_modules/commander/lib/error.js"(exports2) {
    var CommanderError = class extends Error {
      /**
       * Constructs the CommanderError class
       * @param {number} exitCode suggested exit code which could be used with process.exit
       * @param {string} code an id string representing the error
       * @param {string} message human-readable description of the error
       */
      constructor(exitCode, code, message) {
        super(message);
        Error.captureStackTrace(this, this.constructor);
        this.name = this.constructor.name;
        this.code = code;
        this.exitCode = exitCode;
        this.nestedError = void 0;
      }
    };
    var InvalidArgumentError = class extends CommanderError {
      /**
       * Constructs the InvalidArgumentError class
       * @param {string} [message] explanation of why argument is invalid
       */
      constructor(message) {
        super(1, "commander.invalidArgument", message);
        Error.captureStackTrace(this, this.constructor);
        this.name = this.constructor.name;
      }
    };
    exports2.CommanderError = CommanderError;
    exports2.InvalidArgumentError = InvalidArgumentError;
  }
});

// node_modules/commander/lib/argument.js
var require_argument = __commonJS({
  "node_modules/commander/lib/argument.js"(exports2) {
    var { InvalidArgumentError } = require_error();
    var Argument = class {
      /**
       * Initialize a new command argument with the given name and description.
       * The default is that the argument is required, and you can explicitly
       * indicate this with <> around the name. Put [] around the name for an optional argument.
       *
       * @param {string} name
       * @param {string} [description]
       */
      constructor(name, description) {
        this.description = description || "";
        this.variadic = false;
        this.parseArg = void 0;
        this.defaultValue = void 0;
        this.defaultValueDescription = void 0;
        this.argChoices = void 0;
        switch (name[0]) {
          case "<":
            this.required = true;
            this._name = name.slice(1, -1);
            break;
          case "[":
            this.required = false;
            this._name = name.slice(1, -1);
            break;
          default:
            this.required = true;
            this._name = name;
            break;
        }
        if (this._name.length > 3 && this._name.slice(-3) === "...") {
          this.variadic = true;
          this._name = this._name.slice(0, -3);
        }
      }
      /**
       * Return argument name.
       *
       * @return {string}
       */
      name() {
        return this._name;
      }
      /**
       * @package
       */
      _concatValue(value, previous) {
        if (previous === this.defaultValue || !Array.isArray(previous)) {
          return [value];
        }
        return previous.concat(value);
      }
      /**
       * Set the default value, and optionally supply the description to be displayed in the help.
       *
       * @param {*} value
       * @param {string} [description]
       * @return {Argument}
       */
      default(value, description) {
        this.defaultValue = value;
        this.defaultValueDescription = description;
        return this;
      }
      /**
       * Set the custom handler for processing CLI command arguments into argument values.
       *
       * @param {Function} [fn]
       * @return {Argument}
       */
      argParser(fn) {
        this.parseArg = fn;
        return this;
      }
      /**
       * Only allow argument value to be one of choices.
       *
       * @param {string[]} values
       * @return {Argument}
       */
      choices(values) {
        this.argChoices = values.slice();
        this.parseArg = (arg, previous) => {
          if (!this.argChoices.includes(arg)) {
            throw new InvalidArgumentError(
              `Allowed choices are ${this.argChoices.join(", ")}.`
            );
          }
          if (this.variadic) {
            return this._concatValue(arg, previous);
          }
          return arg;
        };
        return this;
      }
      /**
       * Make argument required.
       *
       * @returns {Argument}
       */
      argRequired() {
        this.required = true;
        return this;
      }
      /**
       * Make argument optional.
       *
       * @returns {Argument}
       */
      argOptional() {
        this.required = false;
        return this;
      }
    };
    function humanReadableArgName(arg) {
      const nameOutput = arg.name() + (arg.variadic === true ? "..." : "");
      return arg.required ? "<" + nameOutput + ">" : "[" + nameOutput + "]";
    }
    exports2.Argument = Argument;
    exports2.humanReadableArgName = humanReadableArgName;
  }
});

// node_modules/commander/lib/help.js
var require_help = __commonJS({
  "node_modules/commander/lib/help.js"(exports2) {
    var { humanReadableArgName } = require_argument();
    var Help = class {
      constructor() {
        this.helpWidth = void 0;
        this.sortSubcommands = false;
        this.sortOptions = false;
        this.showGlobalOptions = false;
      }
      /**
       * Get an array of the visible subcommands. Includes a placeholder for the implicit help command, if there is one.
       *
       * @param {Command} cmd
       * @returns {Command[]}
       */
      visibleCommands(cmd) {
        const visibleCommands = cmd.commands.filter((cmd2) => !cmd2._hidden);
        const helpCommand = cmd._getHelpCommand();
        if (helpCommand && !helpCommand._hidden) {
          visibleCommands.push(helpCommand);
        }
        if (this.sortSubcommands) {
          visibleCommands.sort((a, b) => {
            return a.name().localeCompare(b.name());
          });
        }
        return visibleCommands;
      }
      /**
       * Compare options for sort.
       *
       * @param {Option} a
       * @param {Option} b
       * @returns {number}
       */
      compareOptions(a, b) {
        const getSortKey = (option) => {
          return option.short ? option.short.replace(/^-/, "") : option.long.replace(/^--/, "");
        };
        return getSortKey(a).localeCompare(getSortKey(b));
      }
      /**
       * Get an array of the visible options. Includes a placeholder for the implicit help option, if there is one.
       *
       * @param {Command} cmd
       * @returns {Option[]}
       */
      visibleOptions(cmd) {
        const visibleOptions = cmd.options.filter((option) => !option.hidden);
        const helpOption = cmd._getHelpOption();
        if (helpOption && !helpOption.hidden) {
          const removeShort = helpOption.short && cmd._findOption(helpOption.short);
          const removeLong = helpOption.long && cmd._findOption(helpOption.long);
          if (!removeShort && !removeLong) {
            visibleOptions.push(helpOption);
          } else if (helpOption.long && !removeLong) {
            visibleOptions.push(
              cmd.createOption(helpOption.long, helpOption.description)
            );
          } else if (helpOption.short && !removeShort) {
            visibleOptions.push(
              cmd.createOption(helpOption.short, helpOption.description)
            );
          }
        }
        if (this.sortOptions) {
          visibleOptions.sort(this.compareOptions);
        }
        return visibleOptions;
      }
      /**
       * Get an array of the visible global options. (Not including help.)
       *
       * @param {Command} cmd
       * @returns {Option[]}
       */
      visibleGlobalOptions(cmd) {
        if (!this.showGlobalOptions) return [];
        const globalOptions = [];
        for (let ancestorCmd = cmd.parent; ancestorCmd; ancestorCmd = ancestorCmd.parent) {
          const visibleOptions = ancestorCmd.options.filter(
            (option) => !option.hidden
          );
          globalOptions.push(...visibleOptions);
        }
        if (this.sortOptions) {
          globalOptions.sort(this.compareOptions);
        }
        return globalOptions;
      }
      /**
       * Get an array of the arguments if any have a description.
       *
       * @param {Command} cmd
       * @returns {Argument[]}
       */
      visibleArguments(cmd) {
        if (cmd._argsDescription) {
          cmd.registeredArguments.forEach((argument) => {
            argument.description = argument.description || cmd._argsDescription[argument.name()] || "";
          });
        }
        if (cmd.registeredArguments.find((argument) => argument.description)) {
          return cmd.registeredArguments;
        }
        return [];
      }
      /**
       * Get the command term to show in the list of subcommands.
       *
       * @param {Command} cmd
       * @returns {string}
       */
      subcommandTerm(cmd) {
        const args = cmd.registeredArguments.map((arg) => humanReadableArgName(arg)).join(" ");
        return cmd._name + (cmd._aliases[0] ? "|" + cmd._aliases[0] : "") + (cmd.options.length ? " [options]" : "") + // simplistic check for non-help option
        (args ? " " + args : "");
      }
      /**
       * Get the option term to show in the list of options.
       *
       * @param {Option} option
       * @returns {string}
       */
      optionTerm(option) {
        return option.flags;
      }
      /**
       * Get the argument term to show in the list of arguments.
       *
       * @param {Argument} argument
       * @returns {string}
       */
      argumentTerm(argument) {
        return argument.name();
      }
      /**
       * Get the longest command term length.
       *
       * @param {Command} cmd
       * @param {Help} helper
       * @returns {number}
       */
      longestSubcommandTermLength(cmd, helper) {
        return helper.visibleCommands(cmd).reduce((max, command) => {
          return Math.max(max, helper.subcommandTerm(command).length);
        }, 0);
      }
      /**
       * Get the longest option term length.
       *
       * @param {Command} cmd
       * @param {Help} helper
       * @returns {number}
       */
      longestOptionTermLength(cmd, helper) {
        return helper.visibleOptions(cmd).reduce((max, option) => {
          return Math.max(max, helper.optionTerm(option).length);
        }, 0);
      }
      /**
       * Get the longest global option term length.
       *
       * @param {Command} cmd
       * @param {Help} helper
       * @returns {number}
       */
      longestGlobalOptionTermLength(cmd, helper) {
        return helper.visibleGlobalOptions(cmd).reduce((max, option) => {
          return Math.max(max, helper.optionTerm(option).length);
        }, 0);
      }
      /**
       * Get the longest argument term length.
       *
       * @param {Command} cmd
       * @param {Help} helper
       * @returns {number}
       */
      longestArgumentTermLength(cmd, helper) {
        return helper.visibleArguments(cmd).reduce((max, argument) => {
          return Math.max(max, helper.argumentTerm(argument).length);
        }, 0);
      }
      /**
       * Get the command usage to be displayed at the top of the built-in help.
       *
       * @param {Command} cmd
       * @returns {string}
       */
      commandUsage(cmd) {
        let cmdName = cmd._name;
        if (cmd._aliases[0]) {
          cmdName = cmdName + "|" + cmd._aliases[0];
        }
        let ancestorCmdNames = "";
        for (let ancestorCmd = cmd.parent; ancestorCmd; ancestorCmd = ancestorCmd.parent) {
          ancestorCmdNames = ancestorCmd.name() + " " + ancestorCmdNames;
        }
        return ancestorCmdNames + cmdName + " " + cmd.usage();
      }
      /**
       * Get the description for the command.
       *
       * @param {Command} cmd
       * @returns {string}
       */
      commandDescription(cmd) {
        return cmd.description();
      }
      /**
       * Get the subcommand summary to show in the list of subcommands.
       * (Fallback to description for backwards compatibility.)
       *
       * @param {Command} cmd
       * @returns {string}
       */
      subcommandDescription(cmd) {
        return cmd.summary() || cmd.description();
      }
      /**
       * Get the option description to show in the list of options.
       *
       * @param {Option} option
       * @return {string}
       */
      optionDescription(option) {
        const extraInfo = [];
        if (option.argChoices) {
          extraInfo.push(
            // use stringify to match the display of the default value
            `choices: ${option.argChoices.map((choice) => JSON.stringify(choice)).join(", ")}`
          );
        }
        if (option.defaultValue !== void 0) {
          const showDefault = option.required || option.optional || option.isBoolean() && typeof option.defaultValue === "boolean";
          if (showDefault) {
            extraInfo.push(
              `default: ${option.defaultValueDescription || JSON.stringify(option.defaultValue)}`
            );
          }
        }
        if (option.presetArg !== void 0 && option.optional) {
          extraInfo.push(`preset: ${JSON.stringify(option.presetArg)}`);
        }
        if (option.envVar !== void 0) {
          extraInfo.push(`env: ${option.envVar}`);
        }
        if (extraInfo.length > 0) {
          return `${option.description} (${extraInfo.join(", ")})`;
        }
        return option.description;
      }
      /**
       * Get the argument description to show in the list of arguments.
       *
       * @param {Argument} argument
       * @return {string}
       */
      argumentDescription(argument) {
        const extraInfo = [];
        if (argument.argChoices) {
          extraInfo.push(
            // use stringify to match the display of the default value
            `choices: ${argument.argChoices.map((choice) => JSON.stringify(choice)).join(", ")}`
          );
        }
        if (argument.defaultValue !== void 0) {
          extraInfo.push(
            `default: ${argument.defaultValueDescription || JSON.stringify(argument.defaultValue)}`
          );
        }
        if (extraInfo.length > 0) {
          const extraDescripton = `(${extraInfo.join(", ")})`;
          if (argument.description) {
            return `${argument.description} ${extraDescripton}`;
          }
          return extraDescripton;
        }
        return argument.description;
      }
      /**
       * Generate the built-in help text.
       *
       * @param {Command} cmd
       * @param {Help} helper
       * @returns {string}
       */
      formatHelp(cmd, helper) {
        const termWidth = helper.padWidth(cmd, helper);
        const helpWidth = helper.helpWidth || 80;
        const itemIndentWidth = 2;
        const itemSeparatorWidth = 2;
        function formatItem(term, description) {
          if (description) {
            const fullText = `${term.padEnd(termWidth + itemSeparatorWidth)}${description}`;
            return helper.wrap(
              fullText,
              helpWidth - itemIndentWidth,
              termWidth + itemSeparatorWidth
            );
          }
          return term;
        }
        function formatList(textArray) {
          return textArray.join("\n").replace(/^/gm, " ".repeat(itemIndentWidth));
        }
        let output = [`Usage: ${helper.commandUsage(cmd)}`, ""];
        const commandDescription = helper.commandDescription(cmd);
        if (commandDescription.length > 0) {
          output = output.concat([
            helper.wrap(commandDescription, helpWidth, 0),
            ""
          ]);
        }
        const argumentList = helper.visibleArguments(cmd).map((argument) => {
          return formatItem(
            helper.argumentTerm(argument),
            helper.argumentDescription(argument)
          );
        });
        if (argumentList.length > 0) {
          output = output.concat(["Arguments:", formatList(argumentList), ""]);
        }
        const optionList = helper.visibleOptions(cmd).map((option) => {
          return formatItem(
            helper.optionTerm(option),
            helper.optionDescription(option)
          );
        });
        if (optionList.length > 0) {
          output = output.concat(["Options:", formatList(optionList), ""]);
        }
        if (this.showGlobalOptions) {
          const globalOptionList = helper.visibleGlobalOptions(cmd).map((option) => {
            return formatItem(
              helper.optionTerm(option),
              helper.optionDescription(option)
            );
          });
          if (globalOptionList.length > 0) {
            output = output.concat([
              "Global Options:",
              formatList(globalOptionList),
              ""
            ]);
          }
        }
        const commandList = helper.visibleCommands(cmd).map((cmd2) => {
          return formatItem(
            helper.subcommandTerm(cmd2),
            helper.subcommandDescription(cmd2)
          );
        });
        if (commandList.length > 0) {
          output = output.concat(["Commands:", formatList(commandList), ""]);
        }
        return output.join("\n");
      }
      /**
       * Calculate the pad width from the maximum term length.
       *
       * @param {Command} cmd
       * @param {Help} helper
       * @returns {number}
       */
      padWidth(cmd, helper) {
        return Math.max(
          helper.longestOptionTermLength(cmd, helper),
          helper.longestGlobalOptionTermLength(cmd, helper),
          helper.longestSubcommandTermLength(cmd, helper),
          helper.longestArgumentTermLength(cmd, helper)
        );
      }
      /**
       * Wrap the given string to width characters per line, with lines after the first indented.
       * Do not wrap if insufficient room for wrapping (minColumnWidth), or string is manually formatted.
       *
       * @param {string} str
       * @param {number} width
       * @param {number} indent
       * @param {number} [minColumnWidth=40]
       * @return {string}
       *
       */
      wrap(str, width, indent, minColumnWidth = 40) {
        const indents = " \\f\\t\\v\xA0\u1680\u2000-\u200A\u202F\u205F\u3000\uFEFF";
        const manualIndent = new RegExp(`[\\n][${indents}]+`);
        if (str.match(manualIndent)) return str;
        const columnWidth = width - indent;
        if (columnWidth < minColumnWidth) return str;
        const leadingStr = str.slice(0, indent);
        const columnText = str.slice(indent).replace("\r\n", "\n");
        const indentString = " ".repeat(indent);
        const zeroWidthSpace = "\u200B";
        const breaks = `\\s${zeroWidthSpace}`;
        const regex = new RegExp(
          `
|.{1,${columnWidth - 1}}([${breaks}]|$)|[^${breaks}]+?([${breaks}]|$)`,
          "g"
        );
        const lines = columnText.match(regex) || [];
        return leadingStr + lines.map((line, i) => {
          if (line === "\n") return "";
          return (i > 0 ? indentString : "") + line.trimEnd();
        }).join("\n");
      }
    };
    exports2.Help = Help;
  }
});

// node_modules/commander/lib/option.js
var require_option = __commonJS({
  "node_modules/commander/lib/option.js"(exports2) {
    var { InvalidArgumentError } = require_error();
    var Option = class {
      /**
       * Initialize a new `Option` with the given `flags` and `description`.
       *
       * @param {string} flags
       * @param {string} [description]
       */
      constructor(flags, description) {
        this.flags = flags;
        this.description = description || "";
        this.required = flags.includes("<");
        this.optional = flags.includes("[");
        this.variadic = /\w\.\.\.[>\]]$/.test(flags);
        this.mandatory = false;
        const optionFlags = splitOptionFlags(flags);
        this.short = optionFlags.shortFlag;
        this.long = optionFlags.longFlag;
        this.negate = false;
        if (this.long) {
          this.negate = this.long.startsWith("--no-");
        }
        this.defaultValue = void 0;
        this.defaultValueDescription = void 0;
        this.presetArg = void 0;
        this.envVar = void 0;
        this.parseArg = void 0;
        this.hidden = false;
        this.argChoices = void 0;
        this.conflictsWith = [];
        this.implied = void 0;
      }
      /**
       * Set the default value, and optionally supply the description to be displayed in the help.
       *
       * @param {*} value
       * @param {string} [description]
       * @return {Option}
       */
      default(value, description) {
        this.defaultValue = value;
        this.defaultValueDescription = description;
        return this;
      }
      /**
       * Preset to use when option used without option-argument, especially optional but also boolean and negated.
       * The custom processing (parseArg) is called.
       *
       * @example
       * new Option('--color').default('GREYSCALE').preset('RGB');
       * new Option('--donate [amount]').preset('20').argParser(parseFloat);
       *
       * @param {*} arg
       * @return {Option}
       */
      preset(arg) {
        this.presetArg = arg;
        return this;
      }
      /**
       * Add option name(s) that conflict with this option.
       * An error will be displayed if conflicting options are found during parsing.
       *
       * @example
       * new Option('--rgb').conflicts('cmyk');
       * new Option('--js').conflicts(['ts', 'jsx']);
       *
       * @param {(string | string[])} names
       * @return {Option}
       */
      conflicts(names) {
        this.conflictsWith = this.conflictsWith.concat(names);
        return this;
      }
      /**
       * Specify implied option values for when this option is set and the implied options are not.
       *
       * The custom processing (parseArg) is not called on the implied values.
       *
       * @example
       * program
       *   .addOption(new Option('--log', 'write logging information to file'))
       *   .addOption(new Option('--trace', 'log extra details').implies({ log: 'trace.txt' }));
       *
       * @param {object} impliedOptionValues
       * @return {Option}
       */
      implies(impliedOptionValues) {
        let newImplied = impliedOptionValues;
        if (typeof impliedOptionValues === "string") {
          newImplied = { [impliedOptionValues]: true };
        }
        this.implied = Object.assign(this.implied || {}, newImplied);
        return this;
      }
      /**
       * Set environment variable to check for option value.
       *
       * An environment variable is only used if when processed the current option value is
       * undefined, or the source of the current value is 'default' or 'config' or 'env'.
       *
       * @param {string} name
       * @return {Option}
       */
      env(name) {
        this.envVar = name;
        return this;
      }
      /**
       * Set the custom handler for processing CLI option arguments into option values.
       *
       * @param {Function} [fn]
       * @return {Option}
       */
      argParser(fn) {
        this.parseArg = fn;
        return this;
      }
      /**
       * Whether the option is mandatory and must have a value after parsing.
       *
       * @param {boolean} [mandatory=true]
       * @return {Option}
       */
      makeOptionMandatory(mandatory = true) {
        this.mandatory = !!mandatory;
        return this;
      }
      /**
       * Hide option in help.
       *
       * @param {boolean} [hide=true]
       * @return {Option}
       */
      hideHelp(hide = true) {
        this.hidden = !!hide;
        return this;
      }
      /**
       * @package
       */
      _concatValue(value, previous) {
        if (previous === this.defaultValue || !Array.isArray(previous)) {
          return [value];
        }
        return previous.concat(value);
      }
      /**
       * Only allow option value to be one of choices.
       *
       * @param {string[]} values
       * @return {Option}
       */
      choices(values) {
        this.argChoices = values.slice();
        this.parseArg = (arg, previous) => {
          if (!this.argChoices.includes(arg)) {
            throw new InvalidArgumentError(
              `Allowed choices are ${this.argChoices.join(", ")}.`
            );
          }
          if (this.variadic) {
            return this._concatValue(arg, previous);
          }
          return arg;
        };
        return this;
      }
      /**
       * Return option name.
       *
       * @return {string}
       */
      name() {
        if (this.long) {
          return this.long.replace(/^--/, "");
        }
        return this.short.replace(/^-/, "");
      }
      /**
       * Return option name, in a camelcase format that can be used
       * as a object attribute key.
       *
       * @return {string}
       */
      attributeName() {
        return camelcase(this.name().replace(/^no-/, ""));
      }
      /**
       * Check if `arg` matches the short or long flag.
       *
       * @param {string} arg
       * @return {boolean}
       * @package
       */
      is(arg) {
        return this.short === arg || this.long === arg;
      }
      /**
       * Return whether a boolean option.
       *
       * Options are one of boolean, negated, required argument, or optional argument.
       *
       * @return {boolean}
       * @package
       */
      isBoolean() {
        return !this.required && !this.optional && !this.negate;
      }
    };
    var DualOptions = class {
      /**
       * @param {Option[]} options
       */
      constructor(options) {
        this.positiveOptions = /* @__PURE__ */ new Map();
        this.negativeOptions = /* @__PURE__ */ new Map();
        this.dualOptions = /* @__PURE__ */ new Set();
        options.forEach((option) => {
          if (option.negate) {
            this.negativeOptions.set(option.attributeName(), option);
          } else {
            this.positiveOptions.set(option.attributeName(), option);
          }
        });
        this.negativeOptions.forEach((value, key) => {
          if (this.positiveOptions.has(key)) {
            this.dualOptions.add(key);
          }
        });
      }
      /**
       * Did the value come from the option, and not from possible matching dual option?
       *
       * @param {*} value
       * @param {Option} option
       * @returns {boolean}
       */
      valueFromOption(value, option) {
        const optionKey = option.attributeName();
        if (!this.dualOptions.has(optionKey)) return true;
        const preset = this.negativeOptions.get(optionKey).presetArg;
        const negativeValue = preset !== void 0 ? preset : false;
        return option.negate === (negativeValue === value);
      }
    };
    function camelcase(str) {
      return str.split("-").reduce((str2, word) => {
        return str2 + word[0].toUpperCase() + word.slice(1);
      });
    }
    function splitOptionFlags(flags) {
      let shortFlag;
      let longFlag;
      const flagParts = flags.split(/[ |,]+/);
      if (flagParts.length > 1 && !/^[[<]/.test(flagParts[1]))
        shortFlag = flagParts.shift();
      longFlag = flagParts.shift();
      if (!shortFlag && /^-[^-]$/.test(longFlag)) {
        shortFlag = longFlag;
        longFlag = void 0;
      }
      return { shortFlag, longFlag };
    }
    exports2.Option = Option;
    exports2.DualOptions = DualOptions;
  }
});

// node_modules/commander/lib/suggestSimilar.js
var require_suggestSimilar = __commonJS({
  "node_modules/commander/lib/suggestSimilar.js"(exports2) {
    var maxDistance = 3;
    function editDistance(a, b) {
      if (Math.abs(a.length - b.length) > maxDistance)
        return Math.max(a.length, b.length);
      const d = [];
      for (let i = 0; i <= a.length; i++) {
        d[i] = [i];
      }
      for (let j = 0; j <= b.length; j++) {
        d[0][j] = j;
      }
      for (let j = 1; j <= b.length; j++) {
        for (let i = 1; i <= a.length; i++) {
          let cost = 1;
          if (a[i - 1] === b[j - 1]) {
            cost = 0;
          } else {
            cost = 1;
          }
          d[i][j] = Math.min(
            d[i - 1][j] + 1,
            // deletion
            d[i][j - 1] + 1,
            // insertion
            d[i - 1][j - 1] + cost
            // substitution
          );
          if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
            d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
          }
        }
      }
      return d[a.length][b.length];
    }
    function suggestSimilar(word, candidates) {
      if (!candidates || candidates.length === 0) return "";
      candidates = Array.from(new Set(candidates));
      const searchingOptions = word.startsWith("--");
      if (searchingOptions) {
        word = word.slice(2);
        candidates = candidates.map((candidate) => candidate.slice(2));
      }
      let similar = [];
      let bestDistance = maxDistance;
      const minSimilarity = 0.4;
      candidates.forEach((candidate) => {
        if (candidate.length <= 1) return;
        const distance = editDistance(word, candidate);
        const length = Math.max(word.length, candidate.length);
        const similarity = (length - distance) / length;
        if (similarity > minSimilarity) {
          if (distance < bestDistance) {
            bestDistance = distance;
            similar = [candidate];
          } else if (distance === bestDistance) {
            similar.push(candidate);
          }
        }
      });
      similar.sort((a, b) => a.localeCompare(b));
      if (searchingOptions) {
        similar = similar.map((candidate) => `--${candidate}`);
      }
      if (similar.length > 1) {
        return `
(Did you mean one of ${similar.join(", ")}?)`;
      }
      if (similar.length === 1) {
        return `
(Did you mean ${similar[0]}?)`;
      }
      return "";
    }
    exports2.suggestSimilar = suggestSimilar;
  }
});

// node_modules/commander/lib/command.js
var require_command = __commonJS({
  "node_modules/commander/lib/command.js"(exports2) {
    var EventEmitter = require("node:events").EventEmitter;
    var childProcess = require("node:child_process");
    var path2 = require("node:path");
    var fs2 = require("node:fs");
    var process2 = require("node:process");
    var { Argument, humanReadableArgName } = require_argument();
    var { CommanderError } = require_error();
    var { Help } = require_help();
    var { Option, DualOptions } = require_option();
    var { suggestSimilar } = require_suggestSimilar();
    var Command2 = class _Command extends EventEmitter {
      /**
       * Initialize a new `Command`.
       *
       * @param {string} [name]
       */
      constructor(name) {
        super();
        this.commands = [];
        this.options = [];
        this.parent = null;
        this._allowUnknownOption = false;
        this._allowExcessArguments = true;
        this.registeredArguments = [];
        this._args = this.registeredArguments;
        this.args = [];
        this.rawArgs = [];
        this.processedArgs = [];
        this._scriptPath = null;
        this._name = name || "";
        this._optionValues = {};
        this._optionValueSources = {};
        this._storeOptionsAsProperties = false;
        this._actionHandler = null;
        this._executableHandler = false;
        this._executableFile = null;
        this._executableDir = null;
        this._defaultCommandName = null;
        this._exitCallback = null;
        this._aliases = [];
        this._combineFlagAndOptionalValue = true;
        this._description = "";
        this._summary = "";
        this._argsDescription = void 0;
        this._enablePositionalOptions = false;
        this._passThroughOptions = false;
        this._lifeCycleHooks = {};
        this._showHelpAfterError = false;
        this._showSuggestionAfterError = true;
        this._outputConfiguration = {
          writeOut: (str) => process2.stdout.write(str),
          writeErr: (str) => process2.stderr.write(str),
          getOutHelpWidth: () => process2.stdout.isTTY ? process2.stdout.columns : void 0,
          getErrHelpWidth: () => process2.stderr.isTTY ? process2.stderr.columns : void 0,
          outputError: (str, write) => write(str)
        };
        this._hidden = false;
        this._helpOption = void 0;
        this._addImplicitHelpCommand = void 0;
        this._helpCommand = void 0;
        this._helpConfiguration = {};
      }
      /**
       * Copy settings that are useful to have in common across root command and subcommands.
       *
       * (Used internally when adding a command using `.command()` so subcommands inherit parent settings.)
       *
       * @param {Command} sourceCommand
       * @return {Command} `this` command for chaining
       */
      copyInheritedSettings(sourceCommand) {
        this._outputConfiguration = sourceCommand._outputConfiguration;
        this._helpOption = sourceCommand._helpOption;
        this._helpCommand = sourceCommand._helpCommand;
        this._helpConfiguration = sourceCommand._helpConfiguration;
        this._exitCallback = sourceCommand._exitCallback;
        this._storeOptionsAsProperties = sourceCommand._storeOptionsAsProperties;
        this._combineFlagAndOptionalValue = sourceCommand._combineFlagAndOptionalValue;
        this._allowExcessArguments = sourceCommand._allowExcessArguments;
        this._enablePositionalOptions = sourceCommand._enablePositionalOptions;
        this._showHelpAfterError = sourceCommand._showHelpAfterError;
        this._showSuggestionAfterError = sourceCommand._showSuggestionAfterError;
        return this;
      }
      /**
       * @returns {Command[]}
       * @private
       */
      _getCommandAndAncestors() {
        const result = [];
        for (let command = this; command; command = command.parent) {
          result.push(command);
        }
        return result;
      }
      /**
       * Define a command.
       *
       * There are two styles of command: pay attention to where to put the description.
       *
       * @example
       * // Command implemented using action handler (description is supplied separately to `.command`)
       * program
       *   .command('clone <source> [destination]')
       *   .description('clone a repository into a newly created directory')
       *   .action((source, destination) => {
       *     console.log('clone command called');
       *   });
       *
       * // Command implemented using separate executable file (description is second parameter to `.command`)
       * program
       *   .command('start <service>', 'start named service')
       *   .command('stop [service]', 'stop named service, or all if no name supplied');
       *
       * @param {string} nameAndArgs - command name and arguments, args are `<required>` or `[optional]` and last may also be `variadic...`
       * @param {(object | string)} [actionOptsOrExecDesc] - configuration options (for action), or description (for executable)
       * @param {object} [execOpts] - configuration options (for executable)
       * @return {Command} returns new command for action handler, or `this` for executable command
       */
      command(nameAndArgs, actionOptsOrExecDesc, execOpts) {
        let desc = actionOptsOrExecDesc;
        let opts = execOpts;
        if (typeof desc === "object" && desc !== null) {
          opts = desc;
          desc = null;
        }
        opts = opts || {};
        const [, name, args] = nameAndArgs.match(/([^ ]+) *(.*)/);
        const cmd = this.createCommand(name);
        if (desc) {
          cmd.description(desc);
          cmd._executableHandler = true;
        }
        if (opts.isDefault) this._defaultCommandName = cmd._name;
        cmd._hidden = !!(opts.noHelp || opts.hidden);
        cmd._executableFile = opts.executableFile || null;
        if (args) cmd.arguments(args);
        this._registerCommand(cmd);
        cmd.parent = this;
        cmd.copyInheritedSettings(this);
        if (desc) return this;
        return cmd;
      }
      /**
       * Factory routine to create a new unattached command.
       *
       * See .command() for creating an attached subcommand, which uses this routine to
       * create the command. You can override createCommand to customise subcommands.
       *
       * @param {string} [name]
       * @return {Command} new command
       */
      createCommand(name) {
        return new _Command(name);
      }
      /**
       * You can customise the help with a subclass of Help by overriding createHelp,
       * or by overriding Help properties using configureHelp().
       *
       * @return {Help}
       */
      createHelp() {
        return Object.assign(new Help(), this.configureHelp());
      }
      /**
       * You can customise the help by overriding Help properties using configureHelp(),
       * or with a subclass of Help by overriding createHelp().
       *
       * @param {object} [configuration] - configuration options
       * @return {(Command | object)} `this` command for chaining, or stored configuration
       */
      configureHelp(configuration) {
        if (configuration === void 0) return this._helpConfiguration;
        this._helpConfiguration = configuration;
        return this;
      }
      /**
       * The default output goes to stdout and stderr. You can customise this for special
       * applications. You can also customise the display of errors by overriding outputError.
       *
       * The configuration properties are all functions:
       *
       *     // functions to change where being written, stdout and stderr
       *     writeOut(str)
       *     writeErr(str)
       *     // matching functions to specify width for wrapping help
       *     getOutHelpWidth()
       *     getErrHelpWidth()
       *     // functions based on what is being written out
       *     outputError(str, write) // used for displaying errors, and not used for displaying help
       *
       * @param {object} [configuration] - configuration options
       * @return {(Command | object)} `this` command for chaining, or stored configuration
       */
      configureOutput(configuration) {
        if (configuration === void 0) return this._outputConfiguration;
        Object.assign(this._outputConfiguration, configuration);
        return this;
      }
      /**
       * Display the help or a custom message after an error occurs.
       *
       * @param {(boolean|string)} [displayHelp]
       * @return {Command} `this` command for chaining
       */
      showHelpAfterError(displayHelp = true) {
        if (typeof displayHelp !== "string") displayHelp = !!displayHelp;
        this._showHelpAfterError = displayHelp;
        return this;
      }
      /**
       * Display suggestion of similar commands for unknown commands, or options for unknown options.
       *
       * @param {boolean} [displaySuggestion]
       * @return {Command} `this` command for chaining
       */
      showSuggestionAfterError(displaySuggestion = true) {
        this._showSuggestionAfterError = !!displaySuggestion;
        return this;
      }
      /**
       * Add a prepared subcommand.
       *
       * See .command() for creating an attached subcommand which inherits settings from its parent.
       *
       * @param {Command} cmd - new subcommand
       * @param {object} [opts] - configuration options
       * @return {Command} `this` command for chaining
       */
      addCommand(cmd, opts) {
        if (!cmd._name) {
          throw new Error(`Command passed to .addCommand() must have a name
- specify the name in Command constructor or using .name()`);
        }
        opts = opts || {};
        if (opts.isDefault) this._defaultCommandName = cmd._name;
        if (opts.noHelp || opts.hidden) cmd._hidden = true;
        this._registerCommand(cmd);
        cmd.parent = this;
        cmd._checkForBrokenPassThrough();
        return this;
      }
      /**
       * Factory routine to create a new unattached argument.
       *
       * See .argument() for creating an attached argument, which uses this routine to
       * create the argument. You can override createArgument to return a custom argument.
       *
       * @param {string} name
       * @param {string} [description]
       * @return {Argument} new argument
       */
      createArgument(name, description) {
        return new Argument(name, description);
      }
      /**
       * Define argument syntax for command.
       *
       * The default is that the argument is required, and you can explicitly
       * indicate this with <> around the name. Put [] around the name for an optional argument.
       *
       * @example
       * program.argument('<input-file>');
       * program.argument('[output-file]');
       *
       * @param {string} name
       * @param {string} [description]
       * @param {(Function|*)} [fn] - custom argument processing function
       * @param {*} [defaultValue]
       * @return {Command} `this` command for chaining
       */
      argument(name, description, fn, defaultValue) {
        const argument = this.createArgument(name, description);
        if (typeof fn === "function") {
          argument.default(defaultValue).argParser(fn);
        } else {
          argument.default(fn);
        }
        this.addArgument(argument);
        return this;
      }
      /**
       * Define argument syntax for command, adding multiple at once (without descriptions).
       *
       * See also .argument().
       *
       * @example
       * program.arguments('<cmd> [env]');
       *
       * @param {string} names
       * @return {Command} `this` command for chaining
       */
      arguments(names) {
        names.trim().split(/ +/).forEach((detail) => {
          this.argument(detail);
        });
        return this;
      }
      /**
       * Define argument syntax for command, adding a prepared argument.
       *
       * @param {Argument} argument
       * @return {Command} `this` command for chaining
       */
      addArgument(argument) {
        const previousArgument = this.registeredArguments.slice(-1)[0];
        if (previousArgument && previousArgument.variadic) {
          throw new Error(
            `only the last argument can be variadic '${previousArgument.name()}'`
          );
        }
        if (argument.required && argument.defaultValue !== void 0 && argument.parseArg === void 0) {
          throw new Error(
            `a default value for a required argument is never used: '${argument.name()}'`
          );
        }
        this.registeredArguments.push(argument);
        return this;
      }
      /**
       * Customise or override default help command. By default a help command is automatically added if your command has subcommands.
       *
       * @example
       *    program.helpCommand('help [cmd]');
       *    program.helpCommand('help [cmd]', 'show help');
       *    program.helpCommand(false); // suppress default help command
       *    program.helpCommand(true); // add help command even if no subcommands
       *
       * @param {string|boolean} enableOrNameAndArgs - enable with custom name and/or arguments, or boolean to override whether added
       * @param {string} [description] - custom description
       * @return {Command} `this` command for chaining
       */
      helpCommand(enableOrNameAndArgs, description) {
        if (typeof enableOrNameAndArgs === "boolean") {
          this._addImplicitHelpCommand = enableOrNameAndArgs;
          return this;
        }
        enableOrNameAndArgs = enableOrNameAndArgs ?? "help [command]";
        const [, helpName, helpArgs] = enableOrNameAndArgs.match(/([^ ]+) *(.*)/);
        const helpDescription = description ?? "display help for command";
        const helpCommand = this.createCommand(helpName);
        helpCommand.helpOption(false);
        if (helpArgs) helpCommand.arguments(helpArgs);
        if (helpDescription) helpCommand.description(helpDescription);
        this._addImplicitHelpCommand = true;
        this._helpCommand = helpCommand;
        return this;
      }
      /**
       * Add prepared custom help command.
       *
       * @param {(Command|string|boolean)} helpCommand - custom help command, or deprecated enableOrNameAndArgs as for `.helpCommand()`
       * @param {string} [deprecatedDescription] - deprecated custom description used with custom name only
       * @return {Command} `this` command for chaining
       */
      addHelpCommand(helpCommand, deprecatedDescription) {
        if (typeof helpCommand !== "object") {
          this.helpCommand(helpCommand, deprecatedDescription);
          return this;
        }
        this._addImplicitHelpCommand = true;
        this._helpCommand = helpCommand;
        return this;
      }
      /**
       * Lazy create help command.
       *
       * @return {(Command|null)}
       * @package
       */
      _getHelpCommand() {
        const hasImplicitHelpCommand = this._addImplicitHelpCommand ?? (this.commands.length && !this._actionHandler && !this._findCommand("help"));
        if (hasImplicitHelpCommand) {
          if (this._helpCommand === void 0) {
            this.helpCommand(void 0, void 0);
          }
          return this._helpCommand;
        }
        return null;
      }
      /**
       * Add hook for life cycle event.
       *
       * @param {string} event
       * @param {Function} listener
       * @return {Command} `this` command for chaining
       */
      hook(event, listener) {
        const allowedValues = ["preSubcommand", "preAction", "postAction"];
        if (!allowedValues.includes(event)) {
          throw new Error(`Unexpected value for event passed to hook : '${event}'.
Expecting one of '${allowedValues.join("', '")}'`);
        }
        if (this._lifeCycleHooks[event]) {
          this._lifeCycleHooks[event].push(listener);
        } else {
          this._lifeCycleHooks[event] = [listener];
        }
        return this;
      }
      /**
       * Register callback to use as replacement for calling process.exit.
       *
       * @param {Function} [fn] optional callback which will be passed a CommanderError, defaults to throwing
       * @return {Command} `this` command for chaining
       */
      exitOverride(fn) {
        if (fn) {
          this._exitCallback = fn;
        } else {
          this._exitCallback = (err) => {
            if (err.code !== "commander.executeSubCommandAsync") {
              throw err;
            } else {
            }
          };
        }
        return this;
      }
      /**
       * Call process.exit, and _exitCallback if defined.
       *
       * @param {number} exitCode exit code for using with process.exit
       * @param {string} code an id string representing the error
       * @param {string} message human-readable description of the error
       * @return never
       * @private
       */
      _exit(exitCode, code, message) {
        if (this._exitCallback) {
          this._exitCallback(new CommanderError(exitCode, code, message));
        }
        process2.exit(exitCode);
      }
      /**
       * Register callback `fn` for the command.
       *
       * @example
       * program
       *   .command('serve')
       *   .description('start service')
       *   .action(function() {
       *      // do work here
       *   });
       *
       * @param {Function} fn
       * @return {Command} `this` command for chaining
       */
      action(fn) {
        const listener = (args) => {
          const expectedArgsCount = this.registeredArguments.length;
          const actionArgs = args.slice(0, expectedArgsCount);
          if (this._storeOptionsAsProperties) {
            actionArgs[expectedArgsCount] = this;
          } else {
            actionArgs[expectedArgsCount] = this.opts();
          }
          actionArgs.push(this);
          return fn.apply(this, actionArgs);
        };
        this._actionHandler = listener;
        return this;
      }
      /**
       * Factory routine to create a new unattached option.
       *
       * See .option() for creating an attached option, which uses this routine to
       * create the option. You can override createOption to return a custom option.
       *
       * @param {string} flags
       * @param {string} [description]
       * @return {Option} new option
       */
      createOption(flags, description) {
        return new Option(flags, description);
      }
      /**
       * Wrap parseArgs to catch 'commander.invalidArgument'.
       *
       * @param {(Option | Argument)} target
       * @param {string} value
       * @param {*} previous
       * @param {string} invalidArgumentMessage
       * @private
       */
      _callParseArg(target, value, previous, invalidArgumentMessage) {
        try {
          return target.parseArg(value, previous);
        } catch (err) {
          if (err.code === "commander.invalidArgument") {
            const message = `${invalidArgumentMessage} ${err.message}`;
            this.error(message, { exitCode: err.exitCode, code: err.code });
          }
          throw err;
        }
      }
      /**
       * Check for option flag conflicts.
       * Register option if no conflicts found, or throw on conflict.
       *
       * @param {Option} option
       * @private
       */
      _registerOption(option) {
        const matchingOption = option.short && this._findOption(option.short) || option.long && this._findOption(option.long);
        if (matchingOption) {
          const matchingFlag = option.long && this._findOption(option.long) ? option.long : option.short;
          throw new Error(`Cannot add option '${option.flags}'${this._name && ` to command '${this._name}'`} due to conflicting flag '${matchingFlag}'
-  already used by option '${matchingOption.flags}'`);
        }
        this.options.push(option);
      }
      /**
       * Check for command name and alias conflicts with existing commands.
       * Register command if no conflicts found, or throw on conflict.
       *
       * @param {Command} command
       * @private
       */
      _registerCommand(command) {
        const knownBy = (cmd) => {
          return [cmd.name()].concat(cmd.aliases());
        };
        const alreadyUsed = knownBy(command).find(
          (name) => this._findCommand(name)
        );
        if (alreadyUsed) {
          const existingCmd = knownBy(this._findCommand(alreadyUsed)).join("|");
          const newCmd = knownBy(command).join("|");
          throw new Error(
            `cannot add command '${newCmd}' as already have command '${existingCmd}'`
          );
        }
        this.commands.push(command);
      }
      /**
       * Add an option.
       *
       * @param {Option} option
       * @return {Command} `this` command for chaining
       */
      addOption(option) {
        this._registerOption(option);
        const oname = option.name();
        const name = option.attributeName();
        if (option.negate) {
          const positiveLongFlag = option.long.replace(/^--no-/, "--");
          if (!this._findOption(positiveLongFlag)) {
            this.setOptionValueWithSource(
              name,
              option.defaultValue === void 0 ? true : option.defaultValue,
              "default"
            );
          }
        } else if (option.defaultValue !== void 0) {
          this.setOptionValueWithSource(name, option.defaultValue, "default");
        }
        const handleOptionValue = (val, invalidValueMessage, valueSource) => {
          if (val == null && option.presetArg !== void 0) {
            val = option.presetArg;
          }
          const oldValue = this.getOptionValue(name);
          if (val !== null && option.parseArg) {
            val = this._callParseArg(option, val, oldValue, invalidValueMessage);
          } else if (val !== null && option.variadic) {
            val = option._concatValue(val, oldValue);
          }
          if (val == null) {
            if (option.negate) {
              val = false;
            } else if (option.isBoolean() || option.optional) {
              val = true;
            } else {
              val = "";
            }
          }
          this.setOptionValueWithSource(name, val, valueSource);
        };
        this.on("option:" + oname, (val) => {
          const invalidValueMessage = `error: option '${option.flags}' argument '${val}' is invalid.`;
          handleOptionValue(val, invalidValueMessage, "cli");
        });
        if (option.envVar) {
          this.on("optionEnv:" + oname, (val) => {
            const invalidValueMessage = `error: option '${option.flags}' value '${val}' from env '${option.envVar}' is invalid.`;
            handleOptionValue(val, invalidValueMessage, "env");
          });
        }
        return this;
      }
      /**
       * Internal implementation shared by .option() and .requiredOption()
       *
       * @return {Command} `this` command for chaining
       * @private
       */
      _optionEx(config, flags, description, fn, defaultValue) {
        if (typeof flags === "object" && flags instanceof Option) {
          throw new Error(
            "To add an Option object use addOption() instead of option() or requiredOption()"
          );
        }
        const option = this.createOption(flags, description);
        option.makeOptionMandatory(!!config.mandatory);
        if (typeof fn === "function") {
          option.default(defaultValue).argParser(fn);
        } else if (fn instanceof RegExp) {
          const regex = fn;
          fn = (val, def) => {
            const m = regex.exec(val);
            return m ? m[0] : def;
          };
          option.default(defaultValue).argParser(fn);
        } else {
          option.default(fn);
        }
        return this.addOption(option);
      }
      /**
       * Define option with `flags`, `description`, and optional argument parsing function or `defaultValue` or both.
       *
       * The `flags` string contains the short and/or long flags, separated by comma, a pipe or space. A required
       * option-argument is indicated by `<>` and an optional option-argument by `[]`.
       *
       * See the README for more details, and see also addOption() and requiredOption().
       *
       * @example
       * program
       *     .option('-p, --pepper', 'add pepper')
       *     .option('-p, --pizza-type <TYPE>', 'type of pizza') // required option-argument
       *     .option('-c, --cheese [CHEESE]', 'add extra cheese', 'mozzarella') // optional option-argument with default
       *     .option('-t, --tip <VALUE>', 'add tip to purchase cost', parseFloat) // custom parse function
       *
       * @param {string} flags
       * @param {string} [description]
       * @param {(Function|*)} [parseArg] - custom option processing function or default value
       * @param {*} [defaultValue]
       * @return {Command} `this` command for chaining
       */
      option(flags, description, parseArg, defaultValue) {
        return this._optionEx({}, flags, description, parseArg, defaultValue);
      }
      /**
       * Add a required option which must have a value after parsing. This usually means
       * the option must be specified on the command line. (Otherwise the same as .option().)
       *
       * The `flags` string contains the short and/or long flags, separated by comma, a pipe or space.
       *
       * @param {string} flags
       * @param {string} [description]
       * @param {(Function|*)} [parseArg] - custom option processing function or default value
       * @param {*} [defaultValue]
       * @return {Command} `this` command for chaining
       */
      requiredOption(flags, description, parseArg, defaultValue) {
        return this._optionEx(
          { mandatory: true },
          flags,
          description,
          parseArg,
          defaultValue
        );
      }
      /**
       * Alter parsing of short flags with optional values.
       *
       * @example
       * // for `.option('-f,--flag [value]'):
       * program.combineFlagAndOptionalValue(true);  // `-f80` is treated like `--flag=80`, this is the default behaviour
       * program.combineFlagAndOptionalValue(false) // `-fb` is treated like `-f -b`
       *
       * @param {boolean} [combine] - if `true` or omitted, an optional value can be specified directly after the flag.
       * @return {Command} `this` command for chaining
       */
      combineFlagAndOptionalValue(combine = true) {
        this._combineFlagAndOptionalValue = !!combine;
        return this;
      }
      /**
       * Allow unknown options on the command line.
       *
       * @param {boolean} [allowUnknown] - if `true` or omitted, no error will be thrown for unknown options.
       * @return {Command} `this` command for chaining
       */
      allowUnknownOption(allowUnknown = true) {
        this._allowUnknownOption = !!allowUnknown;
        return this;
      }
      /**
       * Allow excess command-arguments on the command line. Pass false to make excess arguments an error.
       *
       * @param {boolean} [allowExcess] - if `true` or omitted, no error will be thrown for excess arguments.
       * @return {Command} `this` command for chaining
       */
      allowExcessArguments(allowExcess = true) {
        this._allowExcessArguments = !!allowExcess;
        return this;
      }
      /**
       * Enable positional options. Positional means global options are specified before subcommands which lets
       * subcommands reuse the same option names, and also enables subcommands to turn on passThroughOptions.
       * The default behaviour is non-positional and global options may appear anywhere on the command line.
       *
       * @param {boolean} [positional]
       * @return {Command} `this` command for chaining
       */
      enablePositionalOptions(positional = true) {
        this._enablePositionalOptions = !!positional;
        return this;
      }
      /**
       * Pass through options that come after command-arguments rather than treat them as command-options,
       * so actual command-options come before command-arguments. Turning this on for a subcommand requires
       * positional options to have been enabled on the program (parent commands).
       * The default behaviour is non-positional and options may appear before or after command-arguments.
       *
       * @param {boolean} [passThrough] for unknown options.
       * @return {Command} `this` command for chaining
       */
      passThroughOptions(passThrough = true) {
        this._passThroughOptions = !!passThrough;
        this._checkForBrokenPassThrough();
        return this;
      }
      /**
       * @private
       */
      _checkForBrokenPassThrough() {
        if (this.parent && this._passThroughOptions && !this.parent._enablePositionalOptions) {
          throw new Error(
            `passThroughOptions cannot be used for '${this._name}' without turning on enablePositionalOptions for parent command(s)`
          );
        }
      }
      /**
       * Whether to store option values as properties on command object,
       * or store separately (specify false). In both cases the option values can be accessed using .opts().
       *
       * @param {boolean} [storeAsProperties=true]
       * @return {Command} `this` command for chaining
       */
      storeOptionsAsProperties(storeAsProperties = true) {
        if (this.options.length) {
          throw new Error("call .storeOptionsAsProperties() before adding options");
        }
        if (Object.keys(this._optionValues).length) {
          throw new Error(
            "call .storeOptionsAsProperties() before setting option values"
          );
        }
        this._storeOptionsAsProperties = !!storeAsProperties;
        return this;
      }
      /**
       * Retrieve option value.
       *
       * @param {string} key
       * @return {object} value
       */
      getOptionValue(key) {
        if (this._storeOptionsAsProperties) {
          return this[key];
        }
        return this._optionValues[key];
      }
      /**
       * Store option value.
       *
       * @param {string} key
       * @param {object} value
       * @return {Command} `this` command for chaining
       */
      setOptionValue(key, value) {
        return this.setOptionValueWithSource(key, value, void 0);
      }
      /**
       * Store option value and where the value came from.
       *
       * @param {string} key
       * @param {object} value
       * @param {string} source - expected values are default/config/env/cli/implied
       * @return {Command} `this` command for chaining
       */
      setOptionValueWithSource(key, value, source) {
        if (this._storeOptionsAsProperties) {
          this[key] = value;
        } else {
          this._optionValues[key] = value;
        }
        this._optionValueSources[key] = source;
        return this;
      }
      /**
       * Get source of option value.
       * Expected values are default | config | env | cli | implied
       *
       * @param {string} key
       * @return {string}
       */
      getOptionValueSource(key) {
        return this._optionValueSources[key];
      }
      /**
       * Get source of option value. See also .optsWithGlobals().
       * Expected values are default | config | env | cli | implied
       *
       * @param {string} key
       * @return {string}
       */
      getOptionValueSourceWithGlobals(key) {
        let source;
        this._getCommandAndAncestors().forEach((cmd) => {
          if (cmd.getOptionValueSource(key) !== void 0) {
            source = cmd.getOptionValueSource(key);
          }
        });
        return source;
      }
      /**
       * Get user arguments from implied or explicit arguments.
       * Side-effects: set _scriptPath if args included script. Used for default program name, and subcommand searches.
       *
       * @private
       */
      _prepareUserArgs(argv, parseOptions) {
        if (argv !== void 0 && !Array.isArray(argv)) {
          throw new Error("first parameter to parse must be array or undefined");
        }
        parseOptions = parseOptions || {};
        if (argv === void 0 && parseOptions.from === void 0) {
          if (process2.versions?.electron) {
            parseOptions.from = "electron";
          }
          const execArgv = process2.execArgv ?? [];
          if (execArgv.includes("-e") || execArgv.includes("--eval") || execArgv.includes("-p") || execArgv.includes("--print")) {
            parseOptions.from = "eval";
          }
        }
        if (argv === void 0) {
          argv = process2.argv;
        }
        this.rawArgs = argv.slice();
        let userArgs;
        switch (parseOptions.from) {
          case void 0:
          case "node":
            this._scriptPath = argv[1];
            userArgs = argv.slice(2);
            break;
          case "electron":
            if (process2.defaultApp) {
              this._scriptPath = argv[1];
              userArgs = argv.slice(2);
            } else {
              userArgs = argv.slice(1);
            }
            break;
          case "user":
            userArgs = argv.slice(0);
            break;
          case "eval":
            userArgs = argv.slice(1);
            break;
          default:
            throw new Error(
              `unexpected parse option { from: '${parseOptions.from}' }`
            );
        }
        if (!this._name && this._scriptPath)
          this.nameFromFilename(this._scriptPath);
        this._name = this._name || "program";
        return userArgs;
      }
      /**
       * Parse `argv`, setting options and invoking commands when defined.
       *
       * Use parseAsync instead of parse if any of your action handlers are async.
       *
       * Call with no parameters to parse `process.argv`. Detects Electron and special node options like `node --eval`. Easy mode!
       *
       * Or call with an array of strings to parse, and optionally where the user arguments start by specifying where the arguments are `from`:
       * - `'node'`: default, `argv[0]` is the application and `argv[1]` is the script being run, with user arguments after that
       * - `'electron'`: `argv[0]` is the application and `argv[1]` varies depending on whether the electron application is packaged
       * - `'user'`: just user arguments
       *
       * @example
       * program.parse(); // parse process.argv and auto-detect electron and special node flags
       * program.parse(process.argv); // assume argv[0] is app and argv[1] is script
       * program.parse(my-args, { from: 'user' }); // just user supplied arguments, nothing special about argv[0]
       *
       * @param {string[]} [argv] - optional, defaults to process.argv
       * @param {object} [parseOptions] - optionally specify style of options with from: node/user/electron
       * @param {string} [parseOptions.from] - where the args are from: 'node', 'user', 'electron'
       * @return {Command} `this` command for chaining
       */
      parse(argv, parseOptions) {
        const userArgs = this._prepareUserArgs(argv, parseOptions);
        this._parseCommand([], userArgs);
        return this;
      }
      /**
       * Parse `argv`, setting options and invoking commands when defined.
       *
       * Call with no parameters to parse `process.argv`. Detects Electron and special node options like `node --eval`. Easy mode!
       *
       * Or call with an array of strings to parse, and optionally where the user arguments start by specifying where the arguments are `from`:
       * - `'node'`: default, `argv[0]` is the application and `argv[1]` is the script being run, with user arguments after that
       * - `'electron'`: `argv[0]` is the application and `argv[1]` varies depending on whether the electron application is packaged
       * - `'user'`: just user arguments
       *
       * @example
       * await program.parseAsync(); // parse process.argv and auto-detect electron and special node flags
       * await program.parseAsync(process.argv); // assume argv[0] is app and argv[1] is script
       * await program.parseAsync(my-args, { from: 'user' }); // just user supplied arguments, nothing special about argv[0]
       *
       * @param {string[]} [argv]
       * @param {object} [parseOptions]
       * @param {string} parseOptions.from - where the args are from: 'node', 'user', 'electron'
       * @return {Promise}
       */
      async parseAsync(argv, parseOptions) {
        const userArgs = this._prepareUserArgs(argv, parseOptions);
        await this._parseCommand([], userArgs);
        return this;
      }
      /**
       * Execute a sub-command executable.
       *
       * @private
       */
      _executeSubCommand(subcommand, args) {
        args = args.slice();
        let launchWithNode = false;
        const sourceExt = [".js", ".ts", ".tsx", ".mjs", ".cjs"];
        function findFile(baseDir, baseName) {
          const localBin = path2.resolve(baseDir, baseName);
          if (fs2.existsSync(localBin)) return localBin;
          if (sourceExt.includes(path2.extname(baseName))) return void 0;
          const foundExt = sourceExt.find(
            (ext) => fs2.existsSync(`${localBin}${ext}`)
          );
          if (foundExt) return `${localBin}${foundExt}`;
          return void 0;
        }
        this._checkForMissingMandatoryOptions();
        this._checkForConflictingOptions();
        let executableFile = subcommand._executableFile || `${this._name}-${subcommand._name}`;
        let executableDir = this._executableDir || "";
        if (this._scriptPath) {
          let resolvedScriptPath;
          try {
            resolvedScriptPath = fs2.realpathSync(this._scriptPath);
          } catch (err) {
            resolvedScriptPath = this._scriptPath;
          }
          executableDir = path2.resolve(
            path2.dirname(resolvedScriptPath),
            executableDir
          );
        }
        if (executableDir) {
          let localFile = findFile(executableDir, executableFile);
          if (!localFile && !subcommand._executableFile && this._scriptPath) {
            const legacyName = path2.basename(
              this._scriptPath,
              path2.extname(this._scriptPath)
            );
            if (legacyName !== this._name) {
              localFile = findFile(
                executableDir,
                `${legacyName}-${subcommand._name}`
              );
            }
          }
          executableFile = localFile || executableFile;
        }
        launchWithNode = sourceExt.includes(path2.extname(executableFile));
        let proc;
        if (process2.platform !== "win32") {
          if (launchWithNode) {
            args.unshift(executableFile);
            args = incrementNodeInspectorPort(process2.execArgv).concat(args);
            proc = childProcess.spawn(process2.argv[0], args, { stdio: "inherit" });
          } else {
            proc = childProcess.spawn(executableFile, args, { stdio: "inherit" });
          }
        } else {
          args.unshift(executableFile);
          args = incrementNodeInspectorPort(process2.execArgv).concat(args);
          proc = childProcess.spawn(process2.execPath, args, { stdio: "inherit" });
        }
        if (!proc.killed) {
          const signals = ["SIGUSR1", "SIGUSR2", "SIGTERM", "SIGINT", "SIGHUP"];
          signals.forEach((signal) => {
            process2.on(signal, () => {
              if (proc.killed === false && proc.exitCode === null) {
                proc.kill(signal);
              }
            });
          });
        }
        const exitCallback = this._exitCallback;
        proc.on("close", (code) => {
          code = code ?? 1;
          if (!exitCallback) {
            process2.exit(code);
          } else {
            exitCallback(
              new CommanderError(
                code,
                "commander.executeSubCommandAsync",
                "(close)"
              )
            );
          }
        });
        proc.on("error", (err) => {
          if (err.code === "ENOENT") {
            const executableDirMessage = executableDir ? `searched for local subcommand relative to directory '${executableDir}'` : "no directory for search for local subcommand, use .executableDir() to supply a custom directory";
            const executableMissing = `'${executableFile}' does not exist
 - if '${subcommand._name}' is not meant to be an executable command, remove description parameter from '.command()' and use '.description()' instead
 - if the default executable name is not suitable, use the executableFile option to supply a custom name or path
 - ${executableDirMessage}`;
            throw new Error(executableMissing);
          } else if (err.code === "EACCES") {
            throw new Error(`'${executableFile}' not executable`);
          }
          if (!exitCallback) {
            process2.exit(1);
          } else {
            const wrappedError = new CommanderError(
              1,
              "commander.executeSubCommandAsync",
              "(error)"
            );
            wrappedError.nestedError = err;
            exitCallback(wrappedError);
          }
        });
        this.runningCommand = proc;
      }
      /**
       * @private
       */
      _dispatchSubcommand(commandName, operands, unknown) {
        const subCommand = this._findCommand(commandName);
        if (!subCommand) this.help({ error: true });
        let promiseChain;
        promiseChain = this._chainOrCallSubCommandHook(
          promiseChain,
          subCommand,
          "preSubcommand"
        );
        promiseChain = this._chainOrCall(promiseChain, () => {
          if (subCommand._executableHandler) {
            this._executeSubCommand(subCommand, operands.concat(unknown));
          } else {
            return subCommand._parseCommand(operands, unknown);
          }
        });
        return promiseChain;
      }
      /**
       * Invoke help directly if possible, or dispatch if necessary.
       * e.g. help foo
       *
       * @private
       */
      _dispatchHelpCommand(subcommandName) {
        if (!subcommandName) {
          this.help();
        }
        const subCommand = this._findCommand(subcommandName);
        if (subCommand && !subCommand._executableHandler) {
          subCommand.help();
        }
        return this._dispatchSubcommand(
          subcommandName,
          [],
          [this._getHelpOption()?.long ?? this._getHelpOption()?.short ?? "--help"]
        );
      }
      /**
       * Check this.args against expected this.registeredArguments.
       *
       * @private
       */
      _checkNumberOfArguments() {
        this.registeredArguments.forEach((arg, i) => {
          if (arg.required && this.args[i] == null) {
            this.missingArgument(arg.name());
          }
        });
        if (this.registeredArguments.length > 0 && this.registeredArguments[this.registeredArguments.length - 1].variadic) {
          return;
        }
        if (this.args.length > this.registeredArguments.length) {
          this._excessArguments(this.args);
        }
      }
      /**
       * Process this.args using this.registeredArguments and save as this.processedArgs!
       *
       * @private
       */
      _processArguments() {
        const myParseArg = (argument, value, previous) => {
          let parsedValue = value;
          if (value !== null && argument.parseArg) {
            const invalidValueMessage = `error: command-argument value '${value}' is invalid for argument '${argument.name()}'.`;
            parsedValue = this._callParseArg(
              argument,
              value,
              previous,
              invalidValueMessage
            );
          }
          return parsedValue;
        };
        this._checkNumberOfArguments();
        const processedArgs = [];
        this.registeredArguments.forEach((declaredArg, index) => {
          let value = declaredArg.defaultValue;
          if (declaredArg.variadic) {
            if (index < this.args.length) {
              value = this.args.slice(index);
              if (declaredArg.parseArg) {
                value = value.reduce((processed, v) => {
                  return myParseArg(declaredArg, v, processed);
                }, declaredArg.defaultValue);
              }
            } else if (value === void 0) {
              value = [];
            }
          } else if (index < this.args.length) {
            value = this.args[index];
            if (declaredArg.parseArg) {
              value = myParseArg(declaredArg, value, declaredArg.defaultValue);
            }
          }
          processedArgs[index] = value;
        });
        this.processedArgs = processedArgs;
      }
      /**
       * Once we have a promise we chain, but call synchronously until then.
       *
       * @param {(Promise|undefined)} promise
       * @param {Function} fn
       * @return {(Promise|undefined)}
       * @private
       */
      _chainOrCall(promise, fn) {
        if (promise && promise.then && typeof promise.then === "function") {
          return promise.then(() => fn());
        }
        return fn();
      }
      /**
       *
       * @param {(Promise|undefined)} promise
       * @param {string} event
       * @return {(Promise|undefined)}
       * @private
       */
      _chainOrCallHooks(promise, event) {
        let result = promise;
        const hooks = [];
        this._getCommandAndAncestors().reverse().filter((cmd) => cmd._lifeCycleHooks[event] !== void 0).forEach((hookedCommand) => {
          hookedCommand._lifeCycleHooks[event].forEach((callback) => {
            hooks.push({ hookedCommand, callback });
          });
        });
        if (event === "postAction") {
          hooks.reverse();
        }
        hooks.forEach((hookDetail) => {
          result = this._chainOrCall(result, () => {
            return hookDetail.callback(hookDetail.hookedCommand, this);
          });
        });
        return result;
      }
      /**
       *
       * @param {(Promise|undefined)} promise
       * @param {Command} subCommand
       * @param {string} event
       * @return {(Promise|undefined)}
       * @private
       */
      _chainOrCallSubCommandHook(promise, subCommand, event) {
        let result = promise;
        if (this._lifeCycleHooks[event] !== void 0) {
          this._lifeCycleHooks[event].forEach((hook) => {
            result = this._chainOrCall(result, () => {
              return hook(this, subCommand);
            });
          });
        }
        return result;
      }
      /**
       * Process arguments in context of this command.
       * Returns action result, in case it is a promise.
       *
       * @private
       */
      _parseCommand(operands, unknown) {
        const parsed = this.parseOptions(unknown);
        this._parseOptionsEnv();
        this._parseOptionsImplied();
        operands = operands.concat(parsed.operands);
        unknown = parsed.unknown;
        this.args = operands.concat(unknown);
        if (operands && this._findCommand(operands[0])) {
          return this._dispatchSubcommand(operands[0], operands.slice(1), unknown);
        }
        if (this._getHelpCommand() && operands[0] === this._getHelpCommand().name()) {
          return this._dispatchHelpCommand(operands[1]);
        }
        if (this._defaultCommandName) {
          this._outputHelpIfRequested(unknown);
          return this._dispatchSubcommand(
            this._defaultCommandName,
            operands,
            unknown
          );
        }
        if (this.commands.length && this.args.length === 0 && !this._actionHandler && !this._defaultCommandName) {
          this.help({ error: true });
        }
        this._outputHelpIfRequested(parsed.unknown);
        this._checkForMissingMandatoryOptions();
        this._checkForConflictingOptions();
        const checkForUnknownOptions = () => {
          if (parsed.unknown.length > 0) {
            this.unknownOption(parsed.unknown[0]);
          }
        };
        const commandEvent = `command:${this.name()}`;
        if (this._actionHandler) {
          checkForUnknownOptions();
          this._processArguments();
          let promiseChain;
          promiseChain = this._chainOrCallHooks(promiseChain, "preAction");
          promiseChain = this._chainOrCall(
            promiseChain,
            () => this._actionHandler(this.processedArgs)
          );
          if (this.parent) {
            promiseChain = this._chainOrCall(promiseChain, () => {
              this.parent.emit(commandEvent, operands, unknown);
            });
          }
          promiseChain = this._chainOrCallHooks(promiseChain, "postAction");
          return promiseChain;
        }
        if (this.parent && this.parent.listenerCount(commandEvent)) {
          checkForUnknownOptions();
          this._processArguments();
          this.parent.emit(commandEvent, operands, unknown);
        } else if (operands.length) {
          if (this._findCommand("*")) {
            return this._dispatchSubcommand("*", operands, unknown);
          }
          if (this.listenerCount("command:*")) {
            this.emit("command:*", operands, unknown);
          } else if (this.commands.length) {
            this.unknownCommand();
          } else {
            checkForUnknownOptions();
            this._processArguments();
          }
        } else if (this.commands.length) {
          checkForUnknownOptions();
          this.help({ error: true });
        } else {
          checkForUnknownOptions();
          this._processArguments();
        }
      }
      /**
       * Find matching command.
       *
       * @private
       * @return {Command | undefined}
       */
      _findCommand(name) {
        if (!name) return void 0;
        return this.commands.find(
          (cmd) => cmd._name === name || cmd._aliases.includes(name)
        );
      }
      /**
       * Return an option matching `arg` if any.
       *
       * @param {string} arg
       * @return {Option}
       * @package
       */
      _findOption(arg) {
        return this.options.find((option) => option.is(arg));
      }
      /**
       * Display an error message if a mandatory option does not have a value.
       * Called after checking for help flags in leaf subcommand.
       *
       * @private
       */
      _checkForMissingMandatoryOptions() {
        this._getCommandAndAncestors().forEach((cmd) => {
          cmd.options.forEach((anOption) => {
            if (anOption.mandatory && cmd.getOptionValue(anOption.attributeName()) === void 0) {
              cmd.missingMandatoryOptionValue(anOption);
            }
          });
        });
      }
      /**
       * Display an error message if conflicting options are used together in this.
       *
       * @private
       */
      _checkForConflictingLocalOptions() {
        const definedNonDefaultOptions = this.options.filter((option) => {
          const optionKey = option.attributeName();
          if (this.getOptionValue(optionKey) === void 0) {
            return false;
          }
          return this.getOptionValueSource(optionKey) !== "default";
        });
        const optionsWithConflicting = definedNonDefaultOptions.filter(
          (option) => option.conflictsWith.length > 0
        );
        optionsWithConflicting.forEach((option) => {
          const conflictingAndDefined = definedNonDefaultOptions.find(
            (defined) => option.conflictsWith.includes(defined.attributeName())
          );
          if (conflictingAndDefined) {
            this._conflictingOption(option, conflictingAndDefined);
          }
        });
      }
      /**
       * Display an error message if conflicting options are used together.
       * Called after checking for help flags in leaf subcommand.
       *
       * @private
       */
      _checkForConflictingOptions() {
        this._getCommandAndAncestors().forEach((cmd) => {
          cmd._checkForConflictingLocalOptions();
        });
      }
      /**
       * Parse options from `argv` removing known options,
       * and return argv split into operands and unknown arguments.
       *
       * Examples:
       *
       *     argv => operands, unknown
       *     --known kkk op => [op], []
       *     op --known kkk => [op], []
       *     sub --unknown uuu op => [sub], [--unknown uuu op]
       *     sub -- --unknown uuu op => [sub --unknown uuu op], []
       *
       * @param {string[]} argv
       * @return {{operands: string[], unknown: string[]}}
       */
      parseOptions(argv) {
        const operands = [];
        const unknown = [];
        let dest = operands;
        const args = argv.slice();
        function maybeOption(arg) {
          return arg.length > 1 && arg[0] === "-";
        }
        let activeVariadicOption = null;
        while (args.length) {
          const arg = args.shift();
          if (arg === "--") {
            if (dest === unknown) dest.push(arg);
            dest.push(...args);
            break;
          }
          if (activeVariadicOption && !maybeOption(arg)) {
            this.emit(`option:${activeVariadicOption.name()}`, arg);
            continue;
          }
          activeVariadicOption = null;
          if (maybeOption(arg)) {
            const option = this._findOption(arg);
            if (option) {
              if (option.required) {
                const value = args.shift();
                if (value === void 0) this.optionMissingArgument(option);
                this.emit(`option:${option.name()}`, value);
              } else if (option.optional) {
                let value = null;
                if (args.length > 0 && !maybeOption(args[0])) {
                  value = args.shift();
                }
                this.emit(`option:${option.name()}`, value);
              } else {
                this.emit(`option:${option.name()}`);
              }
              activeVariadicOption = option.variadic ? option : null;
              continue;
            }
          }
          if (arg.length > 2 && arg[0] === "-" && arg[1] !== "-") {
            const option = this._findOption(`-${arg[1]}`);
            if (option) {
              if (option.required || option.optional && this._combineFlagAndOptionalValue) {
                this.emit(`option:${option.name()}`, arg.slice(2));
              } else {
                this.emit(`option:${option.name()}`);
                args.unshift(`-${arg.slice(2)}`);
              }
              continue;
            }
          }
          if (/^--[^=]+=/.test(arg)) {
            const index = arg.indexOf("=");
            const option = this._findOption(arg.slice(0, index));
            if (option && (option.required || option.optional)) {
              this.emit(`option:${option.name()}`, arg.slice(index + 1));
              continue;
            }
          }
          if (maybeOption(arg)) {
            dest = unknown;
          }
          if ((this._enablePositionalOptions || this._passThroughOptions) && operands.length === 0 && unknown.length === 0) {
            if (this._findCommand(arg)) {
              operands.push(arg);
              if (args.length > 0) unknown.push(...args);
              break;
            } else if (this._getHelpCommand() && arg === this._getHelpCommand().name()) {
              operands.push(arg);
              if (args.length > 0) operands.push(...args);
              break;
            } else if (this._defaultCommandName) {
              unknown.push(arg);
              if (args.length > 0) unknown.push(...args);
              break;
            }
          }
          if (this._passThroughOptions) {
            dest.push(arg);
            if (args.length > 0) dest.push(...args);
            break;
          }
          dest.push(arg);
        }
        return { operands, unknown };
      }
      /**
       * Return an object containing local option values as key-value pairs.
       *
       * @return {object}
       */
      opts() {
        if (this._storeOptionsAsProperties) {
          const result = {};
          const len = this.options.length;
          for (let i = 0; i < len; i++) {
            const key = this.options[i].attributeName();
            result[key] = key === this._versionOptionName ? this._version : this[key];
          }
          return result;
        }
        return this._optionValues;
      }
      /**
       * Return an object containing merged local and global option values as key-value pairs.
       *
       * @return {object}
       */
      optsWithGlobals() {
        return this._getCommandAndAncestors().reduce(
          (combinedOptions, cmd) => Object.assign(combinedOptions, cmd.opts()),
          {}
        );
      }
      /**
       * Display error message and exit (or call exitOverride).
       *
       * @param {string} message
       * @param {object} [errorOptions]
       * @param {string} [errorOptions.code] - an id string representing the error
       * @param {number} [errorOptions.exitCode] - used with process.exit
       */
      error(message, errorOptions) {
        this._outputConfiguration.outputError(
          `${message}
`,
          this._outputConfiguration.writeErr
        );
        if (typeof this._showHelpAfterError === "string") {
          this._outputConfiguration.writeErr(`${this._showHelpAfterError}
`);
        } else if (this._showHelpAfterError) {
          this._outputConfiguration.writeErr("\n");
          this.outputHelp({ error: true });
        }
        const config = errorOptions || {};
        const exitCode = config.exitCode || 1;
        const code = config.code || "commander.error";
        this._exit(exitCode, code, message);
      }
      /**
       * Apply any option related environment variables, if option does
       * not have a value from cli or client code.
       *
       * @private
       */
      _parseOptionsEnv() {
        this.options.forEach((option) => {
          if (option.envVar && option.envVar in process2.env) {
            const optionKey = option.attributeName();
            if (this.getOptionValue(optionKey) === void 0 || ["default", "config", "env"].includes(
              this.getOptionValueSource(optionKey)
            )) {
              if (option.required || option.optional) {
                this.emit(`optionEnv:${option.name()}`, process2.env[option.envVar]);
              } else {
                this.emit(`optionEnv:${option.name()}`);
              }
            }
          }
        });
      }
      /**
       * Apply any implied option values, if option is undefined or default value.
       *
       * @private
       */
      _parseOptionsImplied() {
        const dualHelper = new DualOptions(this.options);
        const hasCustomOptionValue = (optionKey) => {
          return this.getOptionValue(optionKey) !== void 0 && !["default", "implied"].includes(this.getOptionValueSource(optionKey));
        };
        this.options.filter(
          (option) => option.implied !== void 0 && hasCustomOptionValue(option.attributeName()) && dualHelper.valueFromOption(
            this.getOptionValue(option.attributeName()),
            option
          )
        ).forEach((option) => {
          Object.keys(option.implied).filter((impliedKey) => !hasCustomOptionValue(impliedKey)).forEach((impliedKey) => {
            this.setOptionValueWithSource(
              impliedKey,
              option.implied[impliedKey],
              "implied"
            );
          });
        });
      }
      /**
       * Argument `name` is missing.
       *
       * @param {string} name
       * @private
       */
      missingArgument(name) {
        const message = `error: missing required argument '${name}'`;
        this.error(message, { code: "commander.missingArgument" });
      }
      /**
       * `Option` is missing an argument.
       *
       * @param {Option} option
       * @private
       */
      optionMissingArgument(option) {
        const message = `error: option '${option.flags}' argument missing`;
        this.error(message, { code: "commander.optionMissingArgument" });
      }
      /**
       * `Option` does not have a value, and is a mandatory option.
       *
       * @param {Option} option
       * @private
       */
      missingMandatoryOptionValue(option) {
        const message = `error: required option '${option.flags}' not specified`;
        this.error(message, { code: "commander.missingMandatoryOptionValue" });
      }
      /**
       * `Option` conflicts with another option.
       *
       * @param {Option} option
       * @param {Option} conflictingOption
       * @private
       */
      _conflictingOption(option, conflictingOption) {
        const findBestOptionFromValue = (option2) => {
          const optionKey = option2.attributeName();
          const optionValue = this.getOptionValue(optionKey);
          const negativeOption = this.options.find(
            (target) => target.negate && optionKey === target.attributeName()
          );
          const positiveOption = this.options.find(
            (target) => !target.negate && optionKey === target.attributeName()
          );
          if (negativeOption && (negativeOption.presetArg === void 0 && optionValue === false || negativeOption.presetArg !== void 0 && optionValue === negativeOption.presetArg)) {
            return negativeOption;
          }
          return positiveOption || option2;
        };
        const getErrorMessage = (option2) => {
          const bestOption = findBestOptionFromValue(option2);
          const optionKey = bestOption.attributeName();
          const source = this.getOptionValueSource(optionKey);
          if (source === "env") {
            return `environment variable '${bestOption.envVar}'`;
          }
          return `option '${bestOption.flags}'`;
        };
        const message = `error: ${getErrorMessage(option)} cannot be used with ${getErrorMessage(conflictingOption)}`;
        this.error(message, { code: "commander.conflictingOption" });
      }
      /**
       * Unknown option `flag`.
       *
       * @param {string} flag
       * @private
       */
      unknownOption(flag) {
        if (this._allowUnknownOption) return;
        let suggestion = "";
        if (flag.startsWith("--") && this._showSuggestionAfterError) {
          let candidateFlags = [];
          let command = this;
          do {
            const moreFlags = command.createHelp().visibleOptions(command).filter((option) => option.long).map((option) => option.long);
            candidateFlags = candidateFlags.concat(moreFlags);
            command = command.parent;
          } while (command && !command._enablePositionalOptions);
          suggestion = suggestSimilar(flag, candidateFlags);
        }
        const message = `error: unknown option '${flag}'${suggestion}`;
        this.error(message, { code: "commander.unknownOption" });
      }
      /**
       * Excess arguments, more than expected.
       *
       * @param {string[]} receivedArgs
       * @private
       */
      _excessArguments(receivedArgs) {
        if (this._allowExcessArguments) return;
        const expected = this.registeredArguments.length;
        const s = expected === 1 ? "" : "s";
        const forSubcommand = this.parent ? ` for '${this.name()}'` : "";
        const message = `error: too many arguments${forSubcommand}. Expected ${expected} argument${s} but got ${receivedArgs.length}.`;
        this.error(message, { code: "commander.excessArguments" });
      }
      /**
       * Unknown command.
       *
       * @private
       */
      unknownCommand() {
        const unknownName = this.args[0];
        let suggestion = "";
        if (this._showSuggestionAfterError) {
          const candidateNames = [];
          this.createHelp().visibleCommands(this).forEach((command) => {
            candidateNames.push(command.name());
            if (command.alias()) candidateNames.push(command.alias());
          });
          suggestion = suggestSimilar(unknownName, candidateNames);
        }
        const message = `error: unknown command '${unknownName}'${suggestion}`;
        this.error(message, { code: "commander.unknownCommand" });
      }
      /**
       * Get or set the program version.
       *
       * This method auto-registers the "-V, --version" option which will print the version number.
       *
       * You can optionally supply the flags and description to override the defaults.
       *
       * @param {string} [str]
       * @param {string} [flags]
       * @param {string} [description]
       * @return {(this | string | undefined)} `this` command for chaining, or version string if no arguments
       */
      version(str, flags, description) {
        if (str === void 0) return this._version;
        this._version = str;
        flags = flags || "-V, --version";
        description = description || "output the version number";
        const versionOption = this.createOption(flags, description);
        this._versionOptionName = versionOption.attributeName();
        this._registerOption(versionOption);
        this.on("option:" + versionOption.name(), () => {
          this._outputConfiguration.writeOut(`${str}
`);
          this._exit(0, "commander.version", str);
        });
        return this;
      }
      /**
       * Set the description.
       *
       * @param {string} [str]
       * @param {object} [argsDescription]
       * @return {(string|Command)}
       */
      description(str, argsDescription) {
        if (str === void 0 && argsDescription === void 0)
          return this._description;
        this._description = str;
        if (argsDescription) {
          this._argsDescription = argsDescription;
        }
        return this;
      }
      /**
       * Set the summary. Used when listed as subcommand of parent.
       *
       * @param {string} [str]
       * @return {(string|Command)}
       */
      summary(str) {
        if (str === void 0) return this._summary;
        this._summary = str;
        return this;
      }
      /**
       * Set an alias for the command.
       *
       * You may call more than once to add multiple aliases. Only the first alias is shown in the auto-generated help.
       *
       * @param {string} [alias]
       * @return {(string|Command)}
       */
      alias(alias) {
        if (alias === void 0) return this._aliases[0];
        let command = this;
        if (this.commands.length !== 0 && this.commands[this.commands.length - 1]._executableHandler) {
          command = this.commands[this.commands.length - 1];
        }
        if (alias === command._name)
          throw new Error("Command alias can't be the same as its name");
        const matchingCommand = this.parent?._findCommand(alias);
        if (matchingCommand) {
          const existingCmd = [matchingCommand.name()].concat(matchingCommand.aliases()).join("|");
          throw new Error(
            `cannot add alias '${alias}' to command '${this.name()}' as already have command '${existingCmd}'`
          );
        }
        command._aliases.push(alias);
        return this;
      }
      /**
       * Set aliases for the command.
       *
       * Only the first alias is shown in the auto-generated help.
       *
       * @param {string[]} [aliases]
       * @return {(string[]|Command)}
       */
      aliases(aliases) {
        if (aliases === void 0) return this._aliases;
        aliases.forEach((alias) => this.alias(alias));
        return this;
      }
      /**
       * Set / get the command usage `str`.
       *
       * @param {string} [str]
       * @return {(string|Command)}
       */
      usage(str) {
        if (str === void 0) {
          if (this._usage) return this._usage;
          const args = this.registeredArguments.map((arg) => {
            return humanReadableArgName(arg);
          });
          return [].concat(
            this.options.length || this._helpOption !== null ? "[options]" : [],
            this.commands.length ? "[command]" : [],
            this.registeredArguments.length ? args : []
          ).join(" ");
        }
        this._usage = str;
        return this;
      }
      /**
       * Get or set the name of the command.
       *
       * @param {string} [str]
       * @return {(string|Command)}
       */
      name(str) {
        if (str === void 0) return this._name;
        this._name = str;
        return this;
      }
      /**
       * Set the name of the command from script filename, such as process.argv[1],
       * or require.main.filename, or __filename.
       *
       * (Used internally and public although not documented in README.)
       *
       * @example
       * program.nameFromFilename(require.main.filename);
       *
       * @param {string} filename
       * @return {Command}
       */
      nameFromFilename(filename) {
        this._name = path2.basename(filename, path2.extname(filename));
        return this;
      }
      /**
       * Get or set the directory for searching for executable subcommands of this command.
       *
       * @example
       * program.executableDir(__dirname);
       * // or
       * program.executableDir('subcommands');
       *
       * @param {string} [path]
       * @return {(string|null|Command)}
       */
      executableDir(path3) {
        if (path3 === void 0) return this._executableDir;
        this._executableDir = path3;
        return this;
      }
      /**
       * Return program help documentation.
       *
       * @param {{ error: boolean }} [contextOptions] - pass {error:true} to wrap for stderr instead of stdout
       * @return {string}
       */
      helpInformation(contextOptions) {
        const helper = this.createHelp();
        if (helper.helpWidth === void 0) {
          helper.helpWidth = contextOptions && contextOptions.error ? this._outputConfiguration.getErrHelpWidth() : this._outputConfiguration.getOutHelpWidth();
        }
        return helper.formatHelp(this, helper);
      }
      /**
       * @private
       */
      _getHelpContext(contextOptions) {
        contextOptions = contextOptions || {};
        const context = { error: !!contextOptions.error };
        let write;
        if (context.error) {
          write = (arg) => this._outputConfiguration.writeErr(arg);
        } else {
          write = (arg) => this._outputConfiguration.writeOut(arg);
        }
        context.write = contextOptions.write || write;
        context.command = this;
        return context;
      }
      /**
       * Output help information for this command.
       *
       * Outputs built-in help, and custom text added using `.addHelpText()`.
       *
       * @param {{ error: boolean } | Function} [contextOptions] - pass {error:true} to write to stderr instead of stdout
       */
      outputHelp(contextOptions) {
        let deprecatedCallback;
        if (typeof contextOptions === "function") {
          deprecatedCallback = contextOptions;
          contextOptions = void 0;
        }
        const context = this._getHelpContext(contextOptions);
        this._getCommandAndAncestors().reverse().forEach((command) => command.emit("beforeAllHelp", context));
        this.emit("beforeHelp", context);
        let helpInformation = this.helpInformation(context);
        if (deprecatedCallback) {
          helpInformation = deprecatedCallback(helpInformation);
          if (typeof helpInformation !== "string" && !Buffer.isBuffer(helpInformation)) {
            throw new Error("outputHelp callback must return a string or a Buffer");
          }
        }
        context.write(helpInformation);
        if (this._getHelpOption()?.long) {
          this.emit(this._getHelpOption().long);
        }
        this.emit("afterHelp", context);
        this._getCommandAndAncestors().forEach(
          (command) => command.emit("afterAllHelp", context)
        );
      }
      /**
       * You can pass in flags and a description to customise the built-in help option.
       * Pass in false to disable the built-in help option.
       *
       * @example
       * program.helpOption('-?, --help' 'show help'); // customise
       * program.helpOption(false); // disable
       *
       * @param {(string | boolean)} flags
       * @param {string} [description]
       * @return {Command} `this` command for chaining
       */
      helpOption(flags, description) {
        if (typeof flags === "boolean") {
          if (flags) {
            this._helpOption = this._helpOption ?? void 0;
          } else {
            this._helpOption = null;
          }
          return this;
        }
        flags = flags ?? "-h, --help";
        description = description ?? "display help for command";
        this._helpOption = this.createOption(flags, description);
        return this;
      }
      /**
       * Lazy create help option.
       * Returns null if has been disabled with .helpOption(false).
       *
       * @returns {(Option | null)} the help option
       * @package
       */
      _getHelpOption() {
        if (this._helpOption === void 0) {
          this.helpOption(void 0, void 0);
        }
        return this._helpOption;
      }
      /**
       * Supply your own option to use for the built-in help option.
       * This is an alternative to using helpOption() to customise the flags and description etc.
       *
       * @param {Option} option
       * @return {Command} `this` command for chaining
       */
      addHelpOption(option) {
        this._helpOption = option;
        return this;
      }
      /**
       * Output help information and exit.
       *
       * Outputs built-in help, and custom text added using `.addHelpText()`.
       *
       * @param {{ error: boolean }} [contextOptions] - pass {error:true} to write to stderr instead of stdout
       */
      help(contextOptions) {
        this.outputHelp(contextOptions);
        let exitCode = process2.exitCode || 0;
        if (exitCode === 0 && contextOptions && typeof contextOptions !== "function" && contextOptions.error) {
          exitCode = 1;
        }
        this._exit(exitCode, "commander.help", "(outputHelp)");
      }
      /**
       * Add additional text to be displayed with the built-in help.
       *
       * Position is 'before' or 'after' to affect just this command,
       * and 'beforeAll' or 'afterAll' to affect this command and all its subcommands.
       *
       * @param {string} position - before or after built-in help
       * @param {(string | Function)} text - string to add, or a function returning a string
       * @return {Command} `this` command for chaining
       */
      addHelpText(position, text) {
        const allowedValues = ["beforeAll", "before", "after", "afterAll"];
        if (!allowedValues.includes(position)) {
          throw new Error(`Unexpected value for position to addHelpText.
Expecting one of '${allowedValues.join("', '")}'`);
        }
        const helpEvent = `${position}Help`;
        this.on(helpEvent, (context) => {
          let helpStr;
          if (typeof text === "function") {
            helpStr = text({ error: context.error, command: context.command });
          } else {
            helpStr = text;
          }
          if (helpStr) {
            context.write(`${helpStr}
`);
          }
        });
        return this;
      }
      /**
       * Output help information if help flags specified
       *
       * @param {Array} args - array of options to search for help flags
       * @private
       */
      _outputHelpIfRequested(args) {
        const helpOption = this._getHelpOption();
        const helpRequested = helpOption && args.find((arg) => helpOption.is(arg));
        if (helpRequested) {
          this.outputHelp();
          this._exit(0, "commander.helpDisplayed", "(outputHelp)");
        }
      }
    };
    function incrementNodeInspectorPort(args) {
      return args.map((arg) => {
        if (!arg.startsWith("--inspect")) {
          return arg;
        }
        let debugOption;
        let debugHost = "127.0.0.1";
        let debugPort = "9229";
        let match;
        if ((match = arg.match(/^(--inspect(-brk)?)$/)) !== null) {
          debugOption = match[1];
        } else if ((match = arg.match(/^(--inspect(-brk|-port)?)=([^:]+)$/)) !== null) {
          debugOption = match[1];
          if (/^\d+$/.test(match[3])) {
            debugPort = match[3];
          } else {
            debugHost = match[3];
          }
        } else if ((match = arg.match(/^(--inspect(-brk|-port)?)=([^:]+):(\d+)$/)) !== null) {
          debugOption = match[1];
          debugHost = match[3];
          debugPort = match[4];
        }
        if (debugOption && debugPort !== "0") {
          return `${debugOption}=${debugHost}:${parseInt(debugPort) + 1}`;
        }
        return arg;
      });
    }
    exports2.Command = Command2;
  }
});

// node_modules/commander/index.js
var require_commander = __commonJS({
  "node_modules/commander/index.js"(exports2) {
    var { Argument } = require_argument();
    var { Command: Command2 } = require_command();
    var { CommanderError, InvalidArgumentError } = require_error();
    var { Help } = require_help();
    var { Option } = require_option();
    exports2.program = new Command2();
    exports2.createCommand = (name) => new Command2(name);
    exports2.createOption = (flags, description) => new Option(flags, description);
    exports2.createArgument = (name, description) => new Argument(name, description);
    exports2.Command = Command2;
    exports2.Option = Option;
    exports2.Argument = Argument;
    exports2.Help = Help;
    exports2.CommanderError = CommanderError;
    exports2.InvalidArgumentError = InvalidArgumentError;
    exports2.InvalidOptionArgumentError = InvalidArgumentError;
  }
});

// node_modules/picocolors/picocolors.js
var require_picocolors = __commonJS({
  "node_modules/picocolors/picocolors.js"(exports2, module2) {
    var p = process || {};
    var argv = p.argv || [];
    var env = p.env || {};
    var isColorSupported = !(!!env.NO_COLOR || argv.includes("--no-color")) && (!!env.FORCE_COLOR || argv.includes("--color") || p.platform === "win32" || (p.stdout || {}).isTTY && env.TERM !== "dumb" || !!env.CI);
    var formatter = (open, close, replace = open) => (input) => {
      let string = "" + input, index = string.indexOf(close, open.length);
      return ~index ? open + replaceClose(string, close, replace, index) + close : open + string + close;
    };
    var replaceClose = (string, close, replace, index) => {
      let result = "", cursor = 0;
      do {
        result += string.substring(cursor, index) + replace;
        cursor = index + close.length;
        index = string.indexOf(close, cursor);
      } while (~index);
      return result + string.substring(cursor);
    };
    var createColors = (enabled = isColorSupported) => {
      let f = enabled ? formatter : () => String;
      return {
        isColorSupported: enabled,
        reset: f("\x1B[0m", "\x1B[0m"),
        bold: f("\x1B[1m", "\x1B[22m", "\x1B[22m\x1B[1m"),
        dim: f("\x1B[2m", "\x1B[22m", "\x1B[22m\x1B[2m"),
        italic: f("\x1B[3m", "\x1B[23m"),
        underline: f("\x1B[4m", "\x1B[24m"),
        inverse: f("\x1B[7m", "\x1B[27m"),
        hidden: f("\x1B[8m", "\x1B[28m"),
        strikethrough: f("\x1B[9m", "\x1B[29m"),
        black: f("\x1B[30m", "\x1B[39m"),
        red: f("\x1B[31m", "\x1B[39m"),
        green: f("\x1B[32m", "\x1B[39m"),
        yellow: f("\x1B[33m", "\x1B[39m"),
        blue: f("\x1B[34m", "\x1B[39m"),
        magenta: f("\x1B[35m", "\x1B[39m"),
        cyan: f("\x1B[36m", "\x1B[39m"),
        white: f("\x1B[37m", "\x1B[39m"),
        gray: f("\x1B[90m", "\x1B[39m"),
        bgBlack: f("\x1B[40m", "\x1B[49m"),
        bgRed: f("\x1B[41m", "\x1B[49m"),
        bgGreen: f("\x1B[42m", "\x1B[49m"),
        bgYellow: f("\x1B[43m", "\x1B[49m"),
        bgBlue: f("\x1B[44m", "\x1B[49m"),
        bgMagenta: f("\x1B[45m", "\x1B[49m"),
        bgCyan: f("\x1B[46m", "\x1B[49m"),
        bgWhite: f("\x1B[47m", "\x1B[49m"),
        blackBright: f("\x1B[90m", "\x1B[39m"),
        redBright: f("\x1B[91m", "\x1B[39m"),
        greenBright: f("\x1B[92m", "\x1B[39m"),
        yellowBright: f("\x1B[93m", "\x1B[39m"),
        blueBright: f("\x1B[94m", "\x1B[39m"),
        magentaBright: f("\x1B[95m", "\x1B[39m"),
        cyanBright: f("\x1B[96m", "\x1B[39m"),
        whiteBright: f("\x1B[97m", "\x1B[39m"),
        bgBlackBright: f("\x1B[100m", "\x1B[49m"),
        bgRedBright: f("\x1B[101m", "\x1B[49m"),
        bgGreenBright: f("\x1B[102m", "\x1B[49m"),
        bgYellowBright: f("\x1B[103m", "\x1B[49m"),
        bgBlueBright: f("\x1B[104m", "\x1B[49m"),
        bgMagentaBright: f("\x1B[105m", "\x1B[49m"),
        bgCyanBright: f("\x1B[106m", "\x1B[49m"),
        bgWhiteBright: f("\x1B[107m", "\x1B[49m")
      };
    };
    module2.exports = createColors();
    module2.exports.createColors = createColors;
  }
});

// lib/compiler.js
var require_compiler = __commonJS({
  "lib/compiler.js"(exports2, module2) {
    "use strict";
    var fs2 = require("fs");
    var path2 = require("path");
    var TEMPLATES = path2.join(__dirname, "templates");
    function readTemplate(name) {
      return fs2.readFileSync(path2.join(TEMPLATES, name), "utf8");
    }
    function readInput(inputPath) {
      if (!fs2.existsSync(inputPath)) {
        throw new Error(`Input file not found: ${inputPath}`);
      }
      return fs2.readFileSync(inputPath, "utf8");
    }
    function writeOutput(outputPath, content) {
      const dir = path2.dirname(outputPath);
      if (dir && dir !== ".") fs2.mkdirSync(dir, { recursive: true });
      fs2.writeFileSync(outputPath, content, "utf8");
    }
    function humanizeStem(stem) {
      return stem.replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();
    }
    function escapeHtml(s) {
      return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
    function buildCacheHeader(sourceBasename) {
      const builtAt = (/* @__PURE__ */ new Date()).toISOString();
      return [
        "<!-- @human-feedback build-stamp: " + builtAt + " | source: " + sourceBasename + " -->",
        '<meta http-equiv="Cache-Control" content="no-store, no-cache, must-revalidate, max-age=0">',
        '<meta http-equiv="Pragma" content="no-cache">',
        '<meta http-equiv="Expires" content="0">',
        '<meta name="human-feedback-built-at" content="' + builtAt + '">',
        ""
      ].join("\n");
    }
    function injectCacheHeader(html, sourceBasename) {
      const header = buildCacheHeader(sourceBasename);
      const headOpen = html.match(/<head\b[^>]*>/i);
      if (headOpen) {
        return html.replace(headOpen[0], headOpen[0] + "\n" + header);
      }
      if (/<body\b/i.test(html)) {
        return html.replace(/<body\b/i, "<head>\n" + header + "\n</head>\n<body");
      }
      return "<head>\n" + header + "\n</head>\n" + html;
    }
    function setHtmlTitle(html, title) {
      const safe = escapeHtml(title);
      if (/<title\b[^>]*>[\s\S]*?<\/title>/i.test(html)) {
        return html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, "<title>" + safe + "</title>");
      }
      if (/<head\b[^>]*>/i.test(html)) {
        return html.replace(/<head\b[^>]*>/i, (m) => m + "\n<title>" + safe + "</title>");
      }
      return html;
    }
    function deriveTitle(inputPath, override) {
      if (override && String(override).trim()) return String(override).trim();
      const stem = path2.basename(inputPath, path2.extname(inputPath));
      return humanizeStem(stem);
    }
    function extractMarkdownH1(md) {
      const m = md.match(/^[ \t]*#[ \t]+(.+?)\s*$/m);
      return m ? m[1].trim() : null;
    }
    function extractHtmlTitle(html) {
      const m = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
      if (!m) return null;
      const t = m[1].replace(/\s+/g, " ").trim();
      return t || null;
    }
    function detectTool2(inputPath) {
      const ext = path2.extname(inputPath).toLowerCase();
      switch (ext) {
        case ".html":
        case ".htm":
          return "annotator";
        case ".md":
        case ".markdown":
          return "md-annotator";
        case ".json":
          return "feedback";
        default:
          return null;
      }
    }
    function compileAnnotator(inputPath, outputPath) {
      const html = readInput(inputPath);
      const script = readTemplate("annotator-script.js");
      const safeScript = script.replace(/<\/script>/gi, "<\\/script>");
      const injected = `<script>
/* \u2500\u2500 human-feedback: annotator.js \u2500\u2500 */
${safeScript}
</script>`;
      let output;
      if (html.includes("</body>")) {
        output = html.replace("</body>", `${injected}
</body>`);
      } else {
        output = html + "\n" + injected;
      }
      const title = extractHtmlTitle(html) || deriveTitle(inputPath);
      output = setHtmlTitle(output, title);
      output = injectCacheHeader(output, path2.basename(inputPath));
      const banner = `<!-- compiled by @nsharir/human-feedback | tool: html-annotator | source: ${path2.basename(inputPath)} -->
`;
      output = banner + output;
      writeOutput(outputPath, output);
      return { tool: "html-annotator", title, linesIn: html.split("\n").length, linesOut: output.split("\n").length };
    }
    function compileMdAnnotator(inputPath, outputPath) {
      const markdown = readInput(inputPath);
      let template = readTemplate("md-annotator.html");
      const escaped = markdown.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
      const autoLoad = `
<script>
/* \u2500\u2500 human-feedback: baked markdown \u2500\u2500 */
(function () {
  var baked = \`${escaped}\`;
  // Wait for the engine to be ready
  document.addEventListener('DOMContentLoaded', function () {
    if (typeof renderMarkdown === 'function') {
      renderMarkdown(baked);
    }
  });
})();
</script>`;
      let output;
      if (template.includes("</body>")) {
        output = template.replace("</body>", autoLoad + "\n</body>");
      } else {
        output = template + autoLoad;
      }
      const title = extractMarkdownH1(markdown) || deriveTitle(inputPath);
      output = setHtmlTitle(output, title);
      output = injectCacheHeader(output, path2.basename(inputPath));
      const banner = `<!-- compiled by @nsharir/human-feedback | tool: md-annotator | source: ${path2.basename(inputPath)} -->
`;
      output = banner + output;
      writeOutput(outputPath, output);
      return { tool: "md-annotator", title, linesIn: markdown.split("\n").length, linesOut: output.split("\n").length };
    }
    function compileFeedback(inputPath, outputPath) {
      const raw = readInput(inputPath);
      let template = readTemplate("feedback.html");
      let config;
      try {
        config = JSON.parse(raw);
      } catch (e) {
        throw new Error(`Invalid JSON in ${inputPath}: ${e.message}`);
      }
      if (!config.questions || !Array.isArray(config.questions)) {
        throw new Error(`JSON must have a "questions" array. See README for schema.`);
      }
      if (config.questions.length === 0) {
        throw new Error(`"questions" array is empty.`);
      }
      const validTypes = ["text", "textarea", "radio", "checkbox", "select", "boolean", "scale", "range", "date"];
      config.questions.forEach((q, i) => {
        if (!q.id) throw new Error(`Question at index ${i} is missing "id".`);
        if (!q.text) throw new Error(`Question "${q.id}" is missing "text".`);
        const t = q.type || "text";
        if (!validTypes.includes(t)) throw new Error(`Question "${q.id}" has unknown type "${t}". Valid: ${validTypes.join(", ")}`);
        if (["radio", "checkbox", "select"].includes(t) && (!q.options || !q.options.length)) {
          throw new Error(`Question "${q.id}" (type: ${t}) requires an "options" array.`);
        }
      });
      const placeholder = "const QUESTIONS = null;";
      if (!template.includes(placeholder)) {
        throw new Error(`Template is missing the injection point: "${placeholder}"`);
      }
      const injected = `const QUESTIONS = ${JSON.stringify(config, null, 2)};`;
      let output = template.replace(placeholder, injected);
      const title = deriveTitle(inputPath, config.title);
      output = setHtmlTitle(output, title);
      output = injectCacheHeader(output, path2.basename(inputPath));
      const banner = `<!-- compiled by @nsharir/human-feedback | tool: feedback | source: ${path2.basename(inputPath)} -->
`;
      output = banner + output;
      writeOutput(outputPath, output);
      return {
        tool: "feedback",
        questions: config.questions.length,
        title,
        linesOut: output.split("\n").length
      };
    }
    function compile2(inputPath, outputPath, forceTool) {
      const tool = forceTool || detectTool2(inputPath);
      if (!tool) {
        throw new Error(
          `Cannot detect tool from extension "${path2.extname(inputPath)}". Supported: .html/.htm \u2192 annotator, .md/.markdown \u2192 md-annotator, .json \u2192 feedback.
Use --tool <name> to override.`
        );
      }
      switch (tool) {
        case "annotator":
        case "html-annotator":
          return compileAnnotator(inputPath, outputPath);
        case "md-annotator":
        case "markdown":
          return compileMdAnnotator(inputPath, outputPath);
        case "feedback":
        case "questioner":
          return compileFeedback(inputPath, outputPath);
        default:
          throw new Error(`Unknown tool: "${tool}". Valid values: annotator, md-annotator, feedback.`);
      }
    }
    module2.exports = { compile: compile2, detectTool: detectTool2 };
  }
});

// package.json
var require_package = __commonJS({
  "package.json"(exports2, module2) {
    module2.exports = {
      name: "@nsharir/human-feedback",
      version: "0.2.7",
      description: "Close the loop on AI agent output \u2014 compile .md / .html / .json files into interactive feedback surfaces. Install the /human-feedback command into Claude Code, Cursor, Codex, or Hermes.",
      main: "lib/compiler.js",
      bin: {
        "human-feedback": "./bin/cli.bundled.js"
      },
      scripts: {
        build: "node build/build.js",
        "build:bundle": "node build/bundle.js",
        "build:all": "npm run build && npm run build:bundle",
        test: "npm run build:all && node test/run.js && node test/annotator.js && node test/md-annotator.js && node test/installer.js && node test/version-check.js && node test/help-agents.js",
        prepack: "npm run build:all",
        "compile:examples": "node scripts/compile-examples.js"
      },
      files: [
        "bin/",
        "lib/",
        "plugins/",
        "src/",
        "build/",
        "README.md",
        "LICENSE"
      ],
      keywords: [
        "agent",
        "ai",
        "feedback",
        "annotator",
        "markdown",
        "human-in-the-loop",
        "cli",
        "claude",
        "anthropic"
      ],
      repository: {
        type: "git",
        url: "git+https://github.com/nsharir/human-feedback.git"
      },
      bugs: {
        url: "https://github.com/nsharir/human-feedback/issues"
      },
      homepage: "https://github.com/nsharir/human-feedback#readme",
      license: "MIT",
      engines: {
        node: ">=18"
      },
      dependencies: {
        commander: "^12.1.0",
        picocolors: "^1.1.1"
      },
      devDependencies: {
        esbuild: "^0.28.0",
        jsdom: "^24.1.0"
      }
    };
  }
});

// lib/version-check.js
var require_version_check = __commonJS({
  "lib/version-check.js"(exports2, module2) {
    "use strict";
    var https = require("https");
    var http = require("http");
    var fs2 = require("fs");
    var path2 = require("path");
    var os = require("os");
    var url = require("url");
    var pc2 = require_picocolors();
    var DEFAULT_API_BASE = "https://api.github.com";
    var DEFAULT_OWNER = "nsharir";
    var DEFAULT_REPO = "human-feedback";
    var REQUEST_TIMEOUT = 1500;
    var DISK_CACHE_TTL = 24 * 60 * 60 * 1e3;
    var USER_AGENT = "human-feedback-cli (https://github.com/nsharir/human-feedback)";
    function isCheckDisabled() {
      return process.env.HUMAN_FEEDBACK_NO_UPDATE_CHECK === "1" || process.env.NO_UPDATE_NOTIFIER === "1" || // Standard CI heuristic — skip in non-interactive automation
      process.env.CI === "true" || process.env.CI === "1";
    }
    function parseSemver(v) {
      if (typeof v !== "string") return null;
      const cleaned = v.trim().replace(/^v/, "");
      const m = cleaned.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
      if (!m) return null;
      return {
        major: parseInt(m[1], 10),
        minor: parseInt(m[2], 10),
        patch: parseInt(m[3], 10),
        pre: m[4] || null
      };
    }
    function compareSemver(a, b) {
      const A = parseSemver(a);
      const B = parseSemver(b);
      if (!A && !B) return 0;
      if (!A) return -1;
      if (!B) return 1;
      if (A.major !== B.major) return A.major < B.major ? -1 : 1;
      if (A.minor !== B.minor) return A.minor < B.minor ? -1 : 1;
      if (A.patch !== B.patch) return A.patch < B.patch ? -1 : 1;
      if (A.pre && !B.pre) return -1;
      if (!A.pre && B.pre) return 1;
      if (A.pre && B.pre) {
        const ap = A.pre.split(".");
        const bp = B.pre.split(".");
        const len = Math.max(ap.length, bp.length);
        for (let i = 0; i < len; i++) {
          const x = ap[i];
          const y = bp[i];
          if (x === void 0) return -1;
          if (y === void 0) return 1;
          const xn = /^\d+$/.test(x);
          const yn = /^\d+$/.test(y);
          if (xn && yn) {
            const d = parseInt(x, 10) - parseInt(y, 10);
            if (d !== 0) return d < 0 ? -1 : 1;
          } else {
            if (x < y) return -1;
            if (x > y) return 1;
          }
        }
      }
      return 0;
    }
    function diskCachePath() {
      const base = process.env.HUMAN_FEEDBACK_CACHE || process.env.XDG_CACHE_HOME || path2.join(os.homedir(), ".cache");
      return path2.join(base, "human-feedback", "version-check.json");
    }
    function sessionCachePath() {
      return path2.join(os.tmpdir(), `human-feedback-vc-${process.ppid}.json`);
    }
    function readJSON(p) {
      try {
        return JSON.parse(fs2.readFileSync(p, "utf8"));
      } catch (_) {
        return null;
      }
    }
    function writeJSON(p, data) {
      try {
        fs2.mkdirSync(path2.dirname(p), { recursive: true });
        fs2.writeFileSync(p, JSON.stringify(data), { mode: 384 });
      } catch (_) {
      }
    }
    function httpGetJSON(targetUrl, timeoutMs) {
      return new Promise((resolve) => {
        let settled = false;
        const done = (v) => {
          if (!settled) {
            settled = true;
            resolve(v);
          }
        };
        let req;
        try {
          const u = new url.URL(targetUrl);
          const transport = u.protocol === "http:" ? http : https;
          req = transport.request({
            protocol: u.protocol,
            hostname: u.hostname,
            port: u.port || (u.protocol === "https:" ? 443 : 80),
            path: u.pathname + (u.search || ""),
            method: "GET",
            headers: {
              "User-Agent": USER_AGENT,
              "Accept": "application/vnd.github+json"
            },
            timeout: timeoutMs
          }, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
              res.resume();
              const loc = res.headers.location;
              if (loc) return httpGetJSON(loc, timeoutMs).then(done);
              return done(null);
            }
            if (res.statusCode < 200 || res.statusCode >= 300) {
              res.resume();
              return done({ __status: res.statusCode });
            }
            let body = "";
            res.setEncoding("utf8");
            res.on("data", (c) => {
              body += c;
              if (body.length > 1024 * 1024) {
                req.destroy();
                done(null);
              }
            });
            res.on("end", () => {
              try {
                done(JSON.parse(body));
              } catch (_) {
                done(null);
              }
            });
          });
          req.on("timeout", () => {
            req.destroy();
            done(null);
          });
          req.on("error", () => done(null));
          req.end();
        } catch (_) {
          done(null);
        }
      });
    }
    async function fetchLatest(opts) {
      opts = opts || {};
      const currentVersion = opts.current || require_package().version;
      const owner = opts.owner || DEFAULT_OWNER;
      const repo = opts.repo || DEFAULT_REPO;
      const apiBase = opts.apiBase || process.env.HUMAN_FEEDBACK_API_BASE || DEFAULT_API_BASE;
      const timeoutMs = opts.timeout || REQUEST_TIMEOUT;
      let release = await httpGetJSON(`${apiBase}/repos/${owner}/${repo}/releases/latest`, timeoutMs);
      let latestVersion = null;
      if (release && typeof release === "object" && release.tag_name) {
        latestVersion = release.tag_name;
      } else {
        const tags = await httpGetJSON(`${apiBase}/repos/${owner}/${repo}/tags?per_page=30`, timeoutMs);
        if (Array.isArray(tags)) {
          const versions = tags.map((t) => t && t.name).filter((n) => typeof n === "string" && parseSemver(n)).sort((a, b) => compareSemver(b, a));
          if (versions.length) latestVersion = versions[0];
        }
      }
      if (!latestVersion) return null;
      const cmp = compareSemver(currentVersion, latestVersion);
      return {
        current: currentVersion,
        latest: latestVersion.replace(/^v/, ""),
        outdated: cmp < 0,
        ahead: cmp > 0,
        checkedAt: Date.now()
      };
    }
    async function checkOnce(opts) {
      if (isCheckDisabled()) return null;
      opts = opts || {};
      const current = opts.current || opts.pkg && opts.pkg.version || require_package().version;
      const sessPath = sessionCachePath();
      const session = readJSON(sessPath);
      if (session && session.current === current) {
        return session;
      }
      const diskPath = diskCachePath();
      const disk = readJSON(diskPath);
      if (disk && disk.current === current && Date.now() - (disk.checkedAt || 0) < DISK_CACHE_TTL) {
        writeJSON(sessPath, disk);
        return disk;
      }
      const fresh = await fetchLatest({ ...opts, current });
      if (fresh) {
        writeJSON(diskPath, fresh);
        writeJSON(sessPath, fresh);
      }
      return fresh;
    }
    function visibleLength(s) {
      return s.replace(/\x1b\[[0-9;]*m/g, "").length;
    }
    function pad(s, width) {
      const padLen = Math.max(0, width - visibleLength(s));
      return s + " ".repeat(padLen);
    }
    function formatBanner(current, latest, opts) {
      opts = opts || {};
      const width = 60;
      const title = `${pc2.bold("Update available")}  ${pc2.dim(current)}  \u2192  ${pc2.bold(pc2.green(latest))}`;
      const line1 = `Run  ${pc2.bold(pc2.cyan("human-feedback update"))}  to upgrade`;
      const line2 = pc2.dim(`or ask the agent: "update human-feedback to latest"`);
      const horiz = "\u2500".repeat(width - 2);
      const top = pc2.dim("\u256D" + horiz + "\u256E");
      const bottom = pc2.dim("\u2570" + horiz + "\u256F");
      const empty = pc2.dim("\u2502") + " ".repeat(width - 2) + pc2.dim("\u2502");
      const inner = (content) => pc2.dim("\u2502") + "  " + pad(content, width - 4) + pc2.dim("\u2502");
      return [
        "",
        top,
        empty,
        inner(title),
        empty,
        inner(line1),
        inner(line2),
        empty,
        bottom,
        ""
      ].join("\n");
    }
    function machineMarker(current, latest) {
      return `[human-feedback:update-available current=${current} latest=${latest}]`;
    }
    module2.exports = {
      fetchLatest,
      checkOnce,
      formatBanner,
      machineMarker,
      compareSemver,
      parseSemver,
      // exposed for tests
      _internal: {
        diskCachePath,
        sessionCachePath,
        isCheckDisabled,
        DISK_CACHE_TTL
      }
    };
  }
});

// lib/installer.js
var require_installer = __commonJS({
  "lib/installer.js"(exports2, module2) {
    "use strict";
    var fs2 = require("fs");
    var path2 = require("path");
    var os = require("os");
    var TEMPLATE_DIR = path2.join(__dirname, "..", "plugins");
    var HARNESSES = {
      "claude-code": {
        label: "Claude Code",
        get projectTarget() {
          return path2.join(process.cwd(), ".claude", "commands", "human-feedback.md");
        },
        get globalTarget() {
          return path2.join(os.homedir(), ".claude", "commands", "human-feedback.md");
        },
        get projectMarker() {
          return path2.join(process.cwd(), ".claude");
        },
        get globalMarker() {
          return path2.join(os.homedir(), ".claude");
        },
        template: path2.join(TEMPLATE_DIR, "claude-code", "human-feedback.command.md"),
        install: installFile,
        uninstall: uninstallFile
      },
      "cursor": {
        label: "Cursor",
        get projectTarget() {
          return path2.join(process.cwd(), ".cursor", "rules", "human-feedback.mdc");
        },
        get globalTarget() {
          return path2.join(os.homedir(), ".cursor", "rules", "human-feedback.mdc");
        },
        get projectMarker() {
          return path2.join(process.cwd(), ".cursor");
        },
        get globalMarker() {
          return path2.join(os.homedir(), ".cursor");
        },
        template: path2.join(TEMPLATE_DIR, "cursor", "human-feedback.rule.mdc"),
        install: installFile,
        uninstall: uninstallFile
      },
      "codex": {
        label: "Codex",
        get projectTarget() {
          return path2.join(process.cwd(), "AGENTS.md");
        },
        get globalTarget() {
          return path2.join(os.homedir(), "AGENTS.md");
        },
        get projectMarker() {
          return path2.join(process.cwd(), ".codex");
        },
        get globalMarker() {
          return path2.join(os.homedir(), ".codex");
        },
        template: path2.join(TEMPLATE_DIR, "codex", "human-feedback.agents-section.md"),
        install: installCodex,
        uninstall: uninstallCodex
      },
      "hermes": {
        label: "Hermes",
        get projectTarget() {
          return path2.join(process.cwd(), ".hermes", "skills", "human-feedback", "SKILL.md");
        },
        get globalTarget() {
          return path2.join(os.homedir(), ".hermes", "skills", "human-feedback", "SKILL.md");
        },
        get projectMarker() {
          return path2.join(process.cwd(), ".hermes");
        },
        get globalMarker() {
          return path2.join(os.homedir(), ".hermes");
        },
        template: path2.join(TEMPLATE_DIR, "hermes", "human-feedback.skill.md"),
        install: installFile,
        uninstall: uninstallHermes
      }
    };
    function detectHarness(name, scope) {
      const h = HARNESSES[name];
      if (!h) return false;
      const marker = scope === "global" ? h.globalMarker : h.projectMarker;
      return fs2.existsSync(marker);
    }
    function detectAll() {
      const result = {};
      for (const key of Object.keys(HARNESSES)) {
        result[key] = {
          project: detectHarness(key, "project"),
          global: detectHarness(key, "global")
        };
      }
      return result;
    }
    var VERSION_RE = /<!-- human-feedback v([\d.]+)/;
    function versionFromContent(content) {
      const m = content.match(VERSION_RE);
      return m ? m[1] : null;
    }
    function installFile(scope, harness) {
      const h = HARNESSES[harness];
      const target = scope === "global" ? h.globalTarget : h.projectTarget;
      const templateContent = fs2.readFileSync(h.template, "utf8");
      if (fs2.existsSync(target)) {
        const existing = fs2.readFileSync(target, "utf8");
        if (existing === templateContent) {
          return { changed: false, target, note: "already up to date" };
        }
        const existingVer = versionFromContent(existing);
        const templateVer = versionFromContent(templateContent);
        if (existingVer && templateVer && existingVer === templateVer) {
          return { changed: false, target, note: "same version" };
        }
      }
      fs2.mkdirSync(path2.dirname(target), { recursive: true });
      fs2.writeFileSync(target, templateContent, "utf8");
      return { changed: true, target };
    }
    function uninstallFile(scope, harness) {
      const h = HARNESSES[harness];
      const target = scope === "global" ? h.globalTarget : h.projectTarget;
      if (!fs2.existsSync(target)) {
        return { changed: false, target };
      }
      fs2.unlinkSync(target);
      return { changed: true, target };
    }
    function uninstallHermes(scope) {
      const h = HARNESSES["hermes"];
      const target = scope === "global" ? h.globalTarget : h.projectTarget;
      const skillDir = path2.dirname(target);
      if (!fs2.existsSync(skillDir)) {
        return { changed: false, target };
      }
      fs2.rmSync(skillDir, { recursive: true, force: true });
      return { changed: true, target };
    }
    var CODEX_BEGIN = "<!-- human-feedback:begin";
    var CODEX_END = "<!-- human-feedback:end -->";
    function installCodex(scope) {
      const h = HARNESSES["codex"];
      const target = scope === "global" ? h.globalTarget : h.projectTarget;
      const templateContent = fs2.readFileSync(h.template, "utf8");
      const templateVer = versionFromContent(templateContent);
      if (fs2.existsSync(target)) {
        const existing = fs2.readFileSync(target, "utf8");
        if (existing.includes(CODEX_BEGIN)) {
          const blockRe = new RegExp(
            CODEX_BEGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[\\s\\S]*?" + CODEX_END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
          );
          const currentBlock = (existing.match(blockRe) || [])[0];
          if (currentBlock === templateContent.trim()) {
            return { changed: false, target, note: "already up to date" };
          }
          const existingVer = versionFromContent(currentBlock || "");
          if (existingVer && templateVer && existingVer === templateVer) {
            return { changed: false, target, note: "same version" };
          }
          const updated = existing.replace(blockRe, templateContent.trim());
          fs2.writeFileSync(target, updated, "utf8");
          return { changed: true, target };
        }
        const separator = existing.endsWith("\n") ? "\n" : "\n\n";
        fs2.writeFileSync(target, existing + separator + templateContent.trim() + "\n", "utf8");
        return { changed: true, target };
      }
      fs2.writeFileSync(target, templateContent.trim() + "\n", "utf8");
      return { changed: true, target };
    }
    function uninstallCodex(scope) {
      const h = HARNESSES["codex"];
      const target = scope === "global" ? h.globalTarget : h.projectTarget;
      if (!fs2.existsSync(target)) {
        return { changed: false, target };
      }
      const existing = fs2.readFileSync(target, "utf8");
      if (!existing.includes(CODEX_BEGIN)) {
        return { changed: false, target };
      }
      const blockRe = new RegExp(
        "\\n?" + CODEX_BEGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[\\s\\S]*?" + CODEX_END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\n?",
        "g"
      );
      let updated = existing.replace(blockRe, "");
      if (updated.trim() === "") {
        fs2.unlinkSync(target);
      } else {
        fs2.writeFileSync(target, updated, "utf8");
      }
      return { changed: true, target };
    }
    function isInstalled(harness, scope) {
      const h = HARNESSES[harness];
      if (!h) return false;
      const target = scope === "global" ? h.globalTarget : h.projectTarget;
      if (harness === "codex") {
        if (!fs2.existsSync(target)) return false;
        const content = fs2.readFileSync(target, "utf8");
        return content.includes(CODEX_BEGIN);
      }
      return fs2.existsSync(target);
    }
    function install(harness, scope) {
      const h = HARNESSES[harness];
      if (!h) throw new Error(`Unknown harness: ${harness}`);
      return h.install(scope || "project", harness);
    }
    function uninstall(harness, scope) {
      const h = HARNESSES[harness];
      if (!h) throw new Error(`Unknown harness: ${harness}`);
      return h.uninstall(scope || "project", harness);
    }
    module2.exports = {
      HARNESSES,
      detectAll,
      detectHarness,
      install,
      uninstall,
      isInstalled
    };
  }
});

// bin/cli.js
var { Command } = require_commander();
var pc = require_picocolors();
var path = require("path");
var fs = require("fs");
var { spawnSync } = require("child_process");
var { compile, detectTool } = require_compiler();
var versionCheck = require_version_check();
var pkg = require_package();
var sym = {
  ok: pc.green("\u2713"),
  err: pc.red("\u2717"),
  info: pc.dim("\xB7"),
  arr: pc.dim("\u2192"),
  warn: pc.yellow("\u26A0")
};
function printBanner() {
  console.log("");
  console.log(pc.bold("  human-feedback") + pc.dim(` v${pkg.version}`));
  console.log(pc.dim("  close the loop on AI agent output"));
  console.log("");
}
function printResult(result, inputPath, outputPath, elapsed) {
  const sizeKB = (fs.statSync(outputPath).size / 1024).toFixed(1);
  console.log(`  ${sym.ok} ${pc.bold("Compiled successfully")}`);
  console.log("");
  console.log(`  ${sym.info} tool      ${pc.cyan(result.tool)}`);
  console.log(`  ${sym.info} input     ${pc.dim(path.resolve(inputPath))}`);
  console.log(`  ${sym.info} output    ${pc.green(path.resolve(outputPath))}`);
  console.log(`  ${sym.info} size      ${pc.dim(sizeKB + " KB")}`);
  if (result.questions) console.log(`  ${sym.info} questions ${pc.dim(result.questions + " loaded")}`);
  if (result.title) console.log(`  ${sym.info} title     ${pc.dim(result.title)}`);
  console.log(`  ${sym.info} time      ${pc.dim(elapsed + "ms")}`);
  console.log("");
}
function printError(msg) {
  console.error("");
  console.error(`  ${sym.err} ${pc.red(pc.bold("Error:"))} ${msg}`);
  console.error("");
}
var program = new Command();
program.name("human-feedback").version(pkg.version, "-v, --version").description(pkg.description).addHelpText("after", `
${pc.bold("Examples:")}
  ${pc.dim("# Auto-detect tool from extension")}
  $ human-feedback compile page.html      -o page.annotated.html
  $ human-feedback compile docs.md        -o docs-review.html
  $ human-feedback compile questions.json -o feedback.html

  ${pc.dim("# Install the /human-feedback command into your agent harness")}
  $ human-feedback install                ${pc.dim("# interactive \u2014 detects what is present")}
  $ human-feedback install --claude-code  ${pc.dim("# targeted")}
  $ human-feedback install --all          ${pc.dim("# every detected harness")}

  ${pc.dim("# Override tool detection")}
  $ human-feedback compile input.html --tool annotator -o out.html

${pc.bold("Supported tools:")}
  ${pc.cyan("annotator")}     .html / .htm        Wraps a static HTML page with the annotation UI
  ${pc.cyan("md-annotator")}  .md / .markdown     Bakes markdown into a rendered, annotatable preview
  ${pc.cyan("feedback")}      .json               Bakes a questions config into the human-feedback form

${pc.bold("Feedback JSON schema:")}
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
        "other": true,           // adds "Other\u2026" + free text (radio/checkbox/select)
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
program.command("compile <input>").description("Compile an input file into a self-contained HTML tool").requiredOption("-o, --out <file>", "Output HTML file path").option("--tool <name>", "Override tool detection (annotator | md-annotator | questioner)").option("--force", "Overwrite output file if it already exists", false).action((input, opts) => {
  printBanner();
  const inputPath = path.resolve(input);
  const outputPath = path.resolve(opts.out);
  if (!fs.existsSync(inputPath)) {
    printError(`Input file not found: ${inputPath}`);
    process.exit(1);
  }
  if (fs.existsSync(outputPath) && !opts.force) {
    printError(
      `Output file already exists: ${outputPath}
  Use ${pc.bold("--force")} to overwrite.`
    );
    process.exit(1);
  }
  const tool = opts.tool || detectTool(inputPath);
  if (!tool) {
    printError(
      `Cannot auto-detect tool from "${path.extname(inputPath)}" extension.
  Use ${pc.bold("--tool <name>")} to specify: annotator | md-annotator | questioner`
    );
    process.exit(1);
  }
  console.log(`  ${sym.arr} ${pc.dim(path.basename(inputPath))}  ${pc.dim("\u2192")}  ${pc.bold(path.basename(outputPath))}`);
  console.log(`  ${sym.info} using tool: ${pc.cyan(tool)}`);
  console.log("");
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
program.command("info <input>").description("Detect which tool would be used for a given file, without compiling").action((input) => {
  printBanner();
  const ext = path.extname(input).toLowerCase();
  const tool = detectTool(input);
  if (tool) {
    console.log(`  ${sym.ok} ${pc.dim(input)} ${pc.dim("\u2192")} ${pc.cyan(tool)}`);
  } else {
    console.log(`  ${sym.err} ${pc.dim(input)} ${pc.red("\u2014 unknown extension: " + ext)}`);
  }
  console.log("");
});
var installer = require_installer();
var HARNESS_FLAGS = {
  "claude-code": "Claude Code",
  "cursor": "Cursor",
  "codex": "Codex",
  "hermes": "Hermes"
};
function printInstallResult(label, scope, result) {
  if (result.changed) {
    console.log(`  ${sym.ok} ${pc.cyan(label)} ${pc.dim("(" + scope + ")")}  ${pc.dim("\u2192")} ${pc.green(result.target)}`);
  } else {
    const note = result.note ? ` ${pc.dim("(" + result.note + ")")}` : "";
    console.log(`  ${pc.dim("\xB7")} ${pc.cyan(label)} ${pc.dim("(" + scope + ")")}  ${pc.dim("already installed")}${note}`);
  }
}
function readlineQuestion(query) {
  return new Promise((resolve) => {
    const rl = require("readline").createInterface({ input: process.stdin, output: process.stdout });
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}
program.command("install").description("Install the /human-feedback command into one or more agent harnesses").option("--claude-code", "Install into Claude Code").option("--cursor", "Install into Cursor").option("--codex", "Install into Codex").option("--hermes", "Install into Hermes").option("--all", "Install into every detected harness").option("--global", "Install at user scope (~/) instead of project scope (./)", false).option("-y, --yes", "Skip interactive confirmation", false).action(async (opts) => {
  printBanner();
  const scope = opts.global ? "global" : "project";
  const detected = installer.detectAll();
  let targets = [];
  const flagMap = {
    "claude-code": opts.claudeCode,
    "cursor": opts.cursor,
    "codex": opts.codex,
    "hermes": opts.hermes
  };
  const flaggedTargets = Object.keys(flagMap).filter((k) => flagMap[k]);
  if (flaggedTargets.length > 0) {
    targets = flaggedTargets;
  } else if (opts.all) {
    targets = Object.keys(detected).filter((k) => detected[k][scope]);
    if (targets.length === 0) {
      printError(`No agent harnesses detected at ${scope} scope.`);
      process.exit(1);
    }
  } else {
    console.log(`  ${pc.bold("Detected agent harnesses")} ${pc.dim("(" + scope + " scope)")}:`);
    console.log("");
    const candidates = [];
    for (const [key, label] of Object.entries(HARNESS_FLAGS)) {
      if (detected[key][scope]) {
        console.log(`    ${sym.ok} ${pc.cyan(label.padEnd(14))}`);
        candidates.push(key);
      } else {
        console.log(`    ${pc.dim("\xB7")} ${pc.dim(label.padEnd(14))} ${pc.dim("not found")}`);
      }
    }
    if (candidates.length === 0) {
      console.log("");
      printError(`No supported agent harnesses found at ${scope} scope.
  Try ${pc.bold("--global")} to install at user scope, or install one of: Claude Code, Cursor, Codex, Hermes.`);
      process.exit(1);
    }
    console.log("");
    const answer = opts.yes ? "y" : await readlineQuestion(`  Install into all ${candidates.length} detected? ${pc.dim("[Y/n] ")}`);
    if (answer && answer.trim().toLowerCase().startsWith("n")) {
      console.log("  Cancelled.\n");
      process.exit(0);
    }
    targets = candidates;
  }
  console.log("");
  console.log(`  ${pc.bold("Installing\u2026")}`);
  console.log("");
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
  console.log("");
  if (anyChange) {
    console.log(`  ${sym.ok} ${pc.bold("Done.")} The /human-feedback command is now available.`);
  } else {
    console.log(`  ${pc.dim("Nothing to do.")}`);
  }
  console.log("");
});
program.command("uninstall").description("Remove the /human-feedback command from one or more agent harnesses").option("--claude-code", "Uninstall from Claude Code").option("--cursor", "Uninstall from Cursor").option("--codex", "Uninstall from Codex").option("--hermes", "Uninstall from Hermes").option("--all", "Uninstall from every harness").option("--global", "Uninstall at user scope (~/) instead of project scope (./)", false).action((opts) => {
  printBanner();
  const scope = opts.global ? "global" : "project";
  const flagMap = {
    "claude-code": opts.claudeCode,
    "cursor": opts.cursor,
    "codex": opts.codex,
    "hermes": opts.hermes
  };
  let targets = Object.keys(flagMap).filter((k) => flagMap[k]);
  if (opts.all || targets.length === 0) targets = Object.keys(HARNESS_FLAGS);
  console.log(`  ${pc.bold("Uninstalling\u2026")} ${pc.dim("(" + scope + " scope)")}`);
  console.log("");
  for (const key of targets) {
    try {
      const result = installer.uninstall(key, scope);
      if (result.changed) {
        console.log(`  ${sym.ok} ${pc.cyan(HARNESS_FLAGS[key])}  ${pc.dim("removed")}`);
      } else {
        console.log(`  ${pc.dim("\xB7")} ${pc.cyan(HARNESS_FLAGS[key])}  ${pc.dim("nothing to remove")}`);
      }
    } catch (err) {
      console.log(`  ${sym.err} ${pc.cyan(HARNESS_FLAGS[key])}: ${pc.red(err.message)}`);
    }
  }
  console.log("");
});
program.command("doctor").description("Show which agent harnesses are detected and whether /human-feedback is installed").action(() => {
  printBanner();
  const d = installer.detectAll();
  console.log(`  ${pc.bold("Agent harness status:")}`);
  console.log("");
  for (const [key, label] of Object.entries(HARNESS_FLAGS)) {
    const projDetected = d[key].project;
    const globDetected = d[key].global;
    const projInstalled = installer.isInstalled(key, "project");
    const globInstalled = installer.isInstalled(key, "global");
    const projStatus = projInstalled ? pc.green("\u2713 installed") : projDetected ? pc.dim("not installed") : pc.dim("\xB7");
    const globStatus = globInstalled ? pc.green("\u2713 installed") : globDetected ? pc.dim("not installed") : pc.dim("\xB7");
    console.log(`  ${pc.cyan(label.padEnd(14))}  project ${projStatus}   global ${globStatus}`);
  }
  console.log("");
});
program.command("check-for-updates").alias("check-updates").alias("check").description("Check GitHub for a newer version of human-feedback").action(async () => {
  printBanner();
  const result = await versionCheck.fetchLatest();
  if (!result) {
    console.log(`  ${sym.warn} Could not reach GitHub. Try again later or check your network.`);
    console.log("");
    process.exit(0);
  }
  if (result.outdated) {
    console.log(versionCheck.formatBanner(result.current, result.latest));
    console.log(`  Run ${pc.bold("human-feedback update")} to upgrade.`);
    console.log("");
  } else if (result.ahead) {
    console.log(`  ${sym.ok} You're on ${pc.bold("v" + result.current)} \u2014 ahead of latest release (${pc.dim("v" + result.latest)}). Looks like a dev build.`);
    console.log("");
  } else {
    console.log(`  ${sym.ok} You're on the latest version (${pc.bold("v" + result.current)}).`);
    console.log("");
  }
});
function detectInstallRoot() {
  const root = path.resolve(__dirname, "..");
  const hasGit = fs.existsSync(path.join(root, ".git"));
  return { root, managed: hasGit };
}
program.command("update").alias("upgrade").alias("self-update").description("Update human-feedback to the latest version").option("--ref <ref>", "Git ref to update to (default: main)", "main").option("--dry-run", "Print the commands that would run without executing", false).action(async (opts) => {
  printBanner();
  const { root, managed } = detectInstallRoot();
  if (!managed) {
    console.log(`  ${sym.warn} This human-feedback install is not managed by ${pc.bold("install.sh")}.`);
    console.log("");
    console.log(`  Install path: ${pc.dim(root)}`);
    console.log("");
    console.log(`  To update, either:`);
    console.log(`    ${sym.info} from a dev clone:  ${pc.bold("cd " + root + " && git pull && npm install && npm run build")}`);
    console.log(`    ${sym.info} switch to the standard install:`);
    console.log(`        ${pc.bold("curl -fsSL https://raw.githubusercontent.com/nsharir/human-feedback/main/install.sh | bash")}`);
    console.log("");
    process.exit(0);
  }
  const ref = opts.ref;
  const dry = opts.dryRun;
  const before = pkg.version;
  console.log(`  ${sym.info} updating from ${pc.bold("v" + before)} (ref: ${pc.cyan(ref)})\u2026`);
  console.log("");
  const steps = [
    ["git", ["-C", root, "fetch", "--tags", "--quiet", "origin"]],
    ["git", ["-C", root, "checkout", "--quiet", ref]],
    // Try reset --hard only if we're on a branch (not detached HEAD on a tag)
    ["__maybeReset", [root, ref]],
    ["npm", ["--prefix", root, "install", "--omit=dev", "--no-audit", "--no-fund", "--silent"]],
    ["npm", ["--prefix", root, "run", "build", "--silent"]]
  ];
  for (const [cmd, args] of steps) {
    if (cmd === "__maybeReset") {
      const [r2, refName] = args;
      const sym1 = spawnSync("git", ["-C", r2, "symbolic-ref", "-q", "HEAD"], { stdio: "ignore" });
      if (sym1.status === 0) {
        const resetArgs = ["-C", r2, "reset", "--hard", "--quiet", `origin/${refName}`];
        console.log(`  ${pc.dim("$")} git ${resetArgs.join(" ")}`);
        if (!dry) {
          const r22 = spawnSync("git", resetArgs, { stdio: "inherit" });
          if (r22.status !== 0) {
            printError("git reset failed.");
            process.exit(1);
          }
        }
      }
      continue;
    }
    console.log(`  ${pc.dim("$")} ${cmd} ${args.join(" ")}`);
    if (dry) continue;
    const r = spawnSync(cmd, args, { stdio: "inherit" });
    if (r.status !== 0) {
      printError(`${cmd} failed (exit ${r.status}).`);
      process.exit(1);
    }
  }
  if (dry) {
    console.log("");
    console.log(`  ${sym.info} ${pc.dim("(dry run \u2014 no changes made)")}`);
    console.log("");
    return;
  }
  let after = before;
  try {
    after = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
  } catch (_) {
  }
  console.log("");
  if (after !== before) {
    console.log(`  ${sym.ok} Updated ${pc.bold("v" + before)} \u2192 ${pc.bold(pc.green("v" + after))}`);
  } else {
    console.log(`  ${sym.ok} Already at ${pc.bold("v" + after)}.`);
  }
  console.log("");
  console.log(`  ${pc.dim("Tip:")} re-run ${pc.bold("human-feedback install")} to refresh installed skills with the latest content.`);
  console.log("");
});
program.command("help-agents").description("Print the install + usage playbook for AI coding agents").action(() => {
  const B = pc.bold;
  const D = pc.dim;
  const lines = [
    "",
    `${B("human-feedback")} ${D("v" + pkg.version)} ${D("\u2014 playbook for AI agents")}`,
    "",
    B("When the user asks you to install human-feedback:"),
    "",
    "  1. Run the bootstrap (idempotent \u2014 safe on existing installs):",
    `       ${B("curl -fsSL https://raw.githubusercontent.com/nsharir/human-feedback/main/install.sh | bash")}`,
    "",
    `  2. ${B("STOP")}. Ask the user two questions before proceeding:`,
    `       a) ${B("Scope")}    \u2014 global (~/) or project-local (this repo)?`,
    `       b) ${B("Harness")}  \u2014 claude-code | cursor | codex | hermes | --all`,
    "",
    "  3. Run the matching install command, for example:",
    `       ${B("human-feedback install --codex")}            ${D("# project-local")}`,
    `       ${B("human-feedback install --codex --global")}   ${D("# global")}`,
    `       ${B("human-feedback install --all --global")}     ${D("# every detected harness, globally")}`,
    "",
    "  4. Verify:",
    `       ${B("human-feedback doctor")}`,
    "",
    "  5. Tell the user: most harnesses need a new session or skill reload",
    `     before ${B("/human-feedback")} is available.`,
    "",
    B("When the user asks for feedback on something:"),
    "",
    "  1. Identify the artifact (most recent .md / .html, or write a questions.json).",
    `  2. Run: ${B("human-feedback compile <input> -o <output> --force")}`,
    `  3. Share a ${B("file://")} link to the output.`,
    `  4. ${B("WAIT")} for the user's structured response before continuing.`,
    "  5. If you edit the source file later, recompile immediately and re-share.",
    "",
    B("Update flow:"),
    "",
    `  - If you see  ${D("[human-feedback:update-available current=X latest=Y]")}  in`,
    "    any CLI output, mention it to the user ONCE per conversation.",
    `  - User can run:  ${B("human-feedback update")}`,
    "",
    D(`Full reference: https://github.com/nsharir/human-feedback#readme`),
    ""
  ];
  console.log(lines.join("\n"));
});
var SKIP_AUTO_CHECK = /* @__PURE__ */ new Set(["update", "upgrade", "self-update", "check-for-updates", "check-updates", "check", "uninstall", "help-agents"]);
function maybeAttachVersionCheck(argv) {
  let sub = null;
  for (const a of argv.slice(2)) {
    if (a === "--version" || a === "-v" || a === "--help" || a === "-h") return;
    if (a.startsWith("-")) continue;
    sub = a;
    break;
  }
  if (sub && SKIP_AUTO_CHECK.has(sub)) return;
  const checkPromise = versionCheck.checkOnce({ current: pkg.version });
  let printed = false;
  const emit = (result) => {
    if (printed || !result || !result.outdated) return;
    printed = true;
    process.stderr.write(versionCheck.formatBanner(result.current, result.latest));
    process.stdout.write(versionCheck.machineMarker(result.current, result.latest) + "\n");
  };
  process.on("beforeExit", async () => {
    try {
      emit(await checkPromise);
    } catch (_) {
    }
  });
  process.on("exit", () => {
    if (printed) return;
  });
}
maybeAttachVersionCheck(process.argv);
program.parse(process.argv);
if (!process.argv.slice(2).length) {
  printBanner();
  program.outputHelp();
}
