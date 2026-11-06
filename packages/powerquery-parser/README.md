<!-- markdownlint-disable -->

# powerquery-parser

Developed in the [Power Query monorepo](../../README.md).

A parser for the [Power Query/M](https://docs.microsoft.com/en-us/power-query/) language, written in TypeScript. Designed to be consumed by other projects.

## How to use

Requires Node.js 22 or later. Install with `npm install @microsoft/powerquery-parser`.

The most common way to consume the project is to interact with the helper functions found in [taskUtils.ts](src/task/taskUtils.ts). There are all-in-one functions, such as `tryLexParse`, which does a full pass on a given document. There are also separate lexing and parsing steps, `tryLex` and `tryParse`. Minimal code samples can be found in [example.ts](example.ts).

### Lexing

`Lexer.tryLex(settings, text)` lexes the complete document and returns `Result<LexerSnapshot, LexError.TLexError>`. It stops at the first lexical error, including unterminated text, quoted identifiers, and multiline comments. Errors contain one localized diagnostic, not a map of line errors. Diagnostic positions include the absolute UTF-16 offset, zero-based line offset, and grapheme column.

The lexer uses function-based token readers. Tokens and comments are emitted directly; line information is used only for source positions and type directives. `TaskUtils.tryLex` and `TaskUtils.tryLexParse` use the same lexer, and parser inputs are `LexerSnapshot` values.

Apply edits to the document text and call `Lexer.tryLex` again. There is no intermediate line state or separate snapshot-validation step.

Snapshots derive directive associations from their comments. Grapheme-position queries index and cache the token's starting line, including for multiline tokens.

```typescript
import { DefaultSettings, Lexer, ResultUtils } from "@microsoft/powerquery-parser";

const updatedDocumentText = "let x = 2 in x";
const result = Lexer.tryLex(DefaultSettings, updatedDocumentText);
if (ResultUtils.isOk(result)) {
    console.log(result.value.tokens, result.value.comments);
} else {
    console.error(result.error.message);
}
```

Cancellation returns a `CommonError` wrapping `CancellationError`; polling occurs at entry and during scanning.

### Localized errors

Set `locale` on each settings object, for example
`Lexer.tryLex({ ...DefaultSettings, locale: "fr-FR" }, text)`.
Locale tags are matched exactly, ignoring case; unsupported tags (including language-only `"fr"`)
fall back to English. Requests using different locales can run concurrently. Cancellation and
invariant errors retain their default-English behavior.

Messages come from `@vscode/l10n` bundles. No VS Code host or call to `l10n.config` is required.
`LocalizationUtils.getLocalizationTemplates(locale)`, `Templates` exports, custom template objects,
and the existing published ID-keyed JSON paths remain supported. See the monorepo
[localization instructions](../../README.md#localization) for bundle maintenance and formatting semantics.

## Related projects

- [powerquery-formatter](../powerquery-formatter/README.md): A code formatter for Power Query which is bundled in the VSCode extension.
- [powerquery-language-services](https://github.com/microsoft/powerquery-language-services): A high level library that wraps the parser for external projects, such as the VSCode extension. Includes features such as Intellisense.
- [vscode-powerquery](https://github.com/microsoft/vscode-powerquery): The VSCode extension for Power Query language support.
- [vscode-powerquery-sdk](https://github.com/microsoft/vscode-powerquery-sdk): The VSCode extension for Power Query connector SDK.

## Things to note

### Parser

The parser implements recursive-descent and combinatorial parsing strategies for the
[Power Query M language specification](https://docs.microsoft.com/en-us/powerquery-m/power-query-m-language-specification).
Document deviations from the language specification in [specification.md](specification.md).

### Style

This project uses [prettier](https://github.com/prettier/prettier) as the primary source of style enforcement. Additional style requirements are located in [style.md](style.md).

## How to build

From the monorepo root, run `npm ci --ignore-scripts` and `npm run build`.
Use `npm run watch --workspace @microsoft/powerquery-parser` for incremental development.

## How to run tests

From the root, run `npm test --workspace @microsoft/powerquery-parser` for library tests and
`npm run test:parser:resources` for the separate resource suite. Root `npm test` includes both.
`script:benchmark` and `script:nodeDump` are available as workspace scripts.

Tests use Mocha's built-in Spec and XUnit reporters through the root shared reporter for readable
console output and CI results. Library tests write `test-results.xml`; resource tests write
`test-results-resources.xml` so both reports are preserved.

## Contributing

This project welcomes contributions and suggestions. Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.microsoft.com.

When you submit a pull request, a CLA-bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., label, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
