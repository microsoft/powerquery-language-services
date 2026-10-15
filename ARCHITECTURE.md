<!-- markdownlint-disable -->

# Power Query Language Services architecture

This document describes the implementation and its current contracts. For the feature overview,
installation, and a usage example, see the [README](README.md).

## Contents

- [System boundaries and dependencies](#system-boundaries-and-dependencies)
- [Source map and public entry points](#source-map-and-public-entry-points)
- [Analysis lifecycle and result contracts](#analysis-lifecycle-and-result-contracts)
- [Request orchestration and providers](#request-orchestration-and-providers)
- [Inspection and incomplete documents](#inspection-and-incomplete-documents)
- [Scope construction and identifier resolution](#scope-construction-and-identifier-resolution)
- [Type inference and lazy scope types](#type-inference-and-lazy-scope-types)
- [Libraries and external types](#libraries-and-external-types)
- [Validation pipeline](#validation-pipeline)
- [Caching, invalidation, and disposal](#caching-invalidation-and-disposal)
- [Formatting and editor-facing structures](#formatting-and-editor-facing-structures)
- [Cancellation, tracing, and localization](#cancellation-tracing-and-localization)
- [Tests and development infrastructure](#tests-and-development-infrastructure)
- [Extension and maintenance guide](#extension-and-maintenance-guide)

## System boundaries and dependencies

`@microsoft/powerquery-language-services` is a TypeScript library for implementing Power Query / M
editor features. It does not run queries, implement an LSP transport, or manage an editor's document
store. The host supplies documents, settings, cancellation tokens, and environment-specific library
metadata, then consumes results and applies edits.

```text
Editor / language-server host
  | supplies TextDocument, positions, settings, library, cancellation
  v
AnalysisUtils.analysis                 validate                   tryFormat
  |                                      |                           |
DocumentAnalysis <-----------------------+                           |
  |                                                                  |
MemoizedAnalysis                                                     |
  |                                                                  |
AnalysisBase                                                         |
  +-- parser lex/parse task                                          |
  +-- Inspection: cursor context, scopes, types, calls, autocomplete |
  +-- language / library / local-document providers                  |
                                                                     |
                                             powerquery-formatter <--+

Shared contracts: parser Result/types/tracing + LSP value objects
```

The dependency boundary is important:

| Dependency | Responsibility |
| --- | --- |
| `@microsoft/powerquery-parser` | Lexing, parsing, AST and parse-context nodes, node-ID indexes, Power Query types and type utilities, `Result`, cancellation, and tracing contracts. |
| `@microsoft/powerquery-formatter` | Formatting M source; this library adapts its result to document edits. |
| `vscode-languageserver-textdocument` | Document text, URI, version, and offset/position operations. |
| `vscode-languageserver-types` | Editor-facing structures such as completion items, diagnostics, hover, symbols, ranges, and signatures. |

See [package.json](package.json) for dependency versions and the supported Node.js version rather
than treating versions in architecture prose as authoritative. Much of the implementation imports
parser submodules directly, so parser upgrades affect more than the top-level lex/parse call.

## Source map and public entry points

The package's runtime and declaration entry points are
`lib\powerquery-language-services\index.js` and `lib\powerquery-language-services\index.d.ts`.
The corresponding [source barrel](src/powerquery-language-services/index.ts) exports analysis,
providers, libraries, validation, formatting, document symbols, settings, and supporting utilities.
[src\index.ts](src/index.ts) re-exports that barrel for the source tree.

| Area | Principal source | Role |
| --- | --- | --- |
| Analysis | [analysis\analysisBase.ts](src/powerquery-language-services/analysis/analysisBase.ts) | Owns one document's parse task, provider instances, and shared type cache; orchestrates editor requests. |
| Memoization | [analysis\memoizedAnalysis.ts](src/powerquery-language-services/analysis/memoizedAnalysis.ts) | Reuses intermediate inspection promises across requests. |
| Inspection | [inspection\task.ts](src/powerquery-language-services/inspection/task.ts) | Lower-level inspection facade over parse state and cursor position. |
| Scope | [inspection\scope\scopeInspection.ts](src/powerquery-language-services/inspection/scope/scopeInspection.ts) | Builds lexical environments for node IDs. |
| Types | [inspection\type\task.ts](src/powerquery-language-services/inspection/type/task.ts) | Entry points for expression and scope type inference. |
| Providers | [providers\commonTypes.ts](src/powerquery-language-services/providers/commonTypes.ts) | Feature interfaces and request-context contracts. |
| Libraries | [library\library.ts](src/powerquery-language-services/library/library.ts) | Host-supplied symbol metadata and external type resolution. |
| Validation | [validate\validate.ts](src/powerquery-language-services/validate/validate.ts) | Collects syntax and semantic diagnostics using analysis state. |
| Formatting | [formatter.ts](src/powerquery-language-services/formatter.ts) | Adapts formatter output to a full-document edit. |
| Localization | [localization\templates.ts](src/powerquery-language-services/localization/templates.ts) | Localized message templates and locale mapping. |

`textDocument(id, version, content)` creates a `TextDocument` with language ID `"powerquery"`.
The [common types barrel](src/powerquery-language-services/commonTypes.ts) also re-exports commonly
used LSP types. These are data contracts, not a dependency on a running VS Code process.

## Analysis lifecycle and result contracts

### Ownership and construction

The class chain is `DocumentAnalysis extends MemoizedAnalysis extends AnalysisBase`.
`DocumentAnalysis` adds a protected `getText(range?)` wrapper; it is not a document manager.

[AnalysisUtils.analysis(document, settings)](src/powerquery-language-services/analysis/analysisUtils.ts)
is the normal factory. It either returns a cached analysis for a matching URI/version or constructs
a new `DocumentAnalysis`.

Construction of `AnalysisBase`:

1. Retains the document and inspection settings, plus analysis-level tracing settings.
2. Creates language, library, and local-document providers using optional factories or built-in defaults.
3. Shares its initially empty `TypeCache` with the local-document provider.
4. Immediately starts `PQP.TaskUtils.tryLexParse(settings, document.getText())` and retains its promise.

Subsequent requests await that same lex/parse attempt. There is no document-update method or
incremental reparse path in these analysis classes. Treat an analysis as belonging to one document
snapshot; do not mutate the supplied document and expect its parse state to update.

### Results are not just values or failures

The feature methods in the [Analysis interface](src/powerquery-language-services/analysis/analysis.ts)
return `Promise<Result<T | undefined, CommonError>>`:

| Result | Meaning |
| --- | --- |
| `Ok(value)` | The request completed and produced a value; arrays may be empty. |
| `Ok(undefined)` | No applicable result or insufficient context, without a non-recoverable error. |
| `Error(CommonError)` | An operation failed through the parser's common-error abstraction. |

`ResultUtils.ensureResultAsync` wraps the high-level feature implementations. Protected helpers
may throw and their callers convert those failures at the public request boundary. This is not a
blanket guarantee for every exported utility: some are synchronous, some throw, and some return
different `Result` error types.

The helpers `getActiveNode`, `getParseState`, and `getParseError` also return wrapped results.
`getTypeCache()` returns the mutable cache itself, and `dispose()` returns `void`.

### Parse failure is not always absence of parse state

`getParseState()` returns state from both successful parses and parser-error tasks. Partially parsed
documents can therefore still support editor features. A lexer-stage failure has no parse state
through this API and produces `Ok(undefined)` from `getParseState()`. A parse-stage common error is
propagated as an error result.

`getParseError()` reports a parser error when one exists, but returns `undefined` both when parsing
succeeded and when no parse phase was reached. It is not a general lexer-error accessor.

## Request orchestration and providers

`AnalysisBase` builds the context for each feature before invoking providers. Contexts contain
trace/correlation information and a cancellation token; feature-specific fields carry scopes, types,
the selected identifier, parse state, or invocation information. Providers do not each parse the text.

### Routing and precedence

| Request | Execution and combination policy |
| --- | --- |
| Autocomplete | Starts language, library, and local-document providers together with `Promise.all`. Concatenates successful, defined arrays in that order; provider error results are skipped. |
| Hover | Starts local-document and library providers together. Chooses the first defined successful result in local-then-library order. If neither succeeds with a value, propagates the first provider error, if any. |
| Signature help | Starts local-document and library providers together. Chooses the first defined successful result in that order; provider error results are skipped. |
| Definition | Calls only the local-document provider and propagates its error result. |
| Folding ranges | Calls only the local-document provider and propagates its error result. |
| Partial semantic tokens | Calls only the local-document provider and propagates its error result. |
| Document symbols | Traverses the node indexes directly in `AnalysisBase`; not a provider interface. |
| Rename edits | Resolves declarations and references directly in `AnalysisBase`; not a provider interface. |

These policies concern providers that fulfill their promise with a `Result`. A rejected provider
promise can still fail `Promise.all` and become an error at the outer request boundary.

Provider precedence is not a race: hover and signature help await both providers before selecting a
result. There is no built-in provider timeout or early return when the local result becomes available.
Autocomplete aggregation does not globally sort or deduplicate the returned items.

### Built-in provider responsibilities

[LanguageAutocompleteItemProvider](src/powerquery-language-services/providers/languageCompletionItemProvider.ts)
turns inspected keywords, language constants, and primitive types into completion items. It excludes
hash-prefixed constructor keywords such as `#table` from its keyword results so they can be supplied
as library symbols. It also adds snippet items when relevant keywords are available.

[LibraryProvider](src/powerquery-language-services/providers/libraryProvider.ts) supplies completion,
hover, and signature help from host library definitions. Library completion requires identifier text
and a replacement range in its context. Signatures are cached by label inside the provider.

[LocalDocumentProvider](src/powerquery-language-services/providers/localDocumentProvider/localDocumentProvider.ts)
supplies field and scope completion, local definitions, local hover and signatures, folding, and
semantic tokens. Local definitions point to the creator's range in the same document URI. There is no
cross-document definition resolver in the built-in provider.

`ILibraryProvider` combines completion, hover, and signature interfaces. `ILocalDocumentProvider`
combines those with definition, folding, and semantic-token interfaces.
[NullSymbolProvider](src/powerquery-language-services/providers/nullSymbolProvider.ts) is a reusable
no-op implementation for disabling provider features or building test setups.

The optional factories on
[AnalysisSettings](src/powerquery-language-services/analysis/analysisSettings.ts) replace these
providers at construction time:

| Factory | Inputs |
| --- | --- |
| `languageAutocompleteItemProviderFactory` | Locale. |
| `libraryProviderFactory` | Host library and locale. |
| `localDocumentProviderFactory` | Document URI, the analysis's shared `TypeCache`, host library, and locale. |

These factories are not a general plugin registry: adding a new feature also requires explicit
orchestration and an appropriate public contract. Replacing providers does not replace the direct
symbol-extraction or rename implementations.

### Completion-specific data

An [AutocompleteItem](src/powerquery-language-services/inspection/autocomplete/autocompleteItem/autocompleteItem.ts)
extends an LSP `CompletionItem` with `powerQueryType` and `jaroWinklerScore`.
[AutocompleteItemUtils](src/powerquery-language-services/inspection/autocomplete/autocompleteItem/autocompleteItemUtils.ts)
constructs items, replacement edits, commit characters, and snippets. Its `comparer` orders by
descending similarity score and then by label, but callers must opt into sorting.

The context builder suppresses completion while editing a binding key. Field completion first checks
whether the cursor is in an eligible field selector/projection, then infers the accessed expression's
type. It enumerates fields from defined records, defined tables, and supported union members rather
than trying expensive inference at arbitrary positions.

## Inspection and incomplete documents

Inspection operates on the parser's `NodeIdMap.Collection`. Important indexes include completed AST
nodes, parse-context nodes, parent/child relationships, node IDs grouped by kind, and leaf IDs.
`TXorNode` represents either a completed AST node or an unfinished parse-context node. Algorithms
must handle both instead of assuming an error-free AST.

### Cursor interpretation

[ActiveNodeUtils.activeNode](src/powerquery-language-services/inspection/activeNode/activeNodeUtils.ts)
searches leaves before, on, and after the cursor, considers unfinished parse contexts, and selects the
node matching the expected editing context. Operators and delimiters influence which adjacent node
is selected. The result is a discriminated union:

| Variant | Information |
| --- | --- |
| `ActiveNode` | Leaf-to-root ancestry, leaf relationship to the cursor, binding-key context, and identifiers under the cursor. |
| `OutOfBoundPosition` | Cursor position without a selected AST/context ancestry, including empty-document cases. |

The [active-node types](src/powerquery-language-services/inspection/activeNode/activeNode.ts) distinguish
inclusive identifier bounds `[start, end]` from exclusive-start bounds `(start, end]`.
Completion and rename use inclusive identifiers; hover and definition use exclusive identifiers and
exclude parameter-declaration hover contexts. These boundaries explain why moving one character can
change feature availability.

### Inspection facade versus high-level analysis

[Inspection.inspect](src/powerquery-language-services/inspection/task.ts) accepts existing parse state,
an optional parse error, a position, and an optional reusable `TypeCache`. It creates an
`InspectionInstance` containing autocomplete, invocation/scope/type promises, expected-type
information, and helpers for scope lookup and identifier collection.

`Inspection.tryInspect` first lexes/parses text. Its successful result contains a
`Promise<Inspected>` inside the outer asynchronous `Result`; it is not the same return shape as an
`Analysis` feature method. Parse errors can still feed partial state into inspection.

`AnalysisBase` calls individual inspection operations as needed; it does not create a full
`InspectionInstance` for every request.

[Autocomplete inspection](src/powerquery-language-services/inspection/autocomplete/task.ts) combines
field-access, keyword, language-constant, and primitive-type strategies. It awaits field-access
inspection and then keyword inspection; the remaining strategies are synchronous. This is distinct
from the parallel provider fan-out. A parse-error token can become a trailing-token hint for
completion in incomplete or invalid text.

[Expected-type inspection](src/powerquery-language-services/inspection/expectedType.ts) walks ancestry
and child attribute positions to infer what kind of expression is expected. That information is
available on `InspectionInstance`, but `AnalysisBase` does not currently use it to filter or rank the
combined completion results.

## Scope construction and identifier resolution

[Scope inspection](src/powerquery-language-services/inspection/scope/scopeInspection.ts) builds scopes
top-down along a node's ancestry, reusing entries from `scopeById` when available.
A [NodeScope](src/powerquery-language-services/inspection/scope/scope.ts) maps identifier spellings to
scope items, not directly to types.

Scope items represent let variables, record fields, section members, function parameters, the
implicit `each` parameter, or undefined values. Each records its creator node ID and whether the
reference is recursive.

Key rules implemented here:

- Children without new bindings can share the parent's `NodeScope` object. New bindings create a
  merged map, with the newer entries taking precedence.
- Function bodies receive parameter bindings. `each` bodies receive `_`, whose contextual type can
  be supplied through `InspectionSettings.eachScopeById`.
- Let bindings, record fields, and section members populate scopes with allowed identifier forms,
  including quoted spellings. Within a binding's own value, its recursive spelling is distinguished
  from an ordinary reference to the same name.
- Field selectors and projections inherit only `Each` items from their parent scope, not all lexical
  bindings. Their field names are not ordinary variable references.

[Identifier dereferencing](src/powerquery-language-services/inspection/dereferencedIdentifier/dereferencedIdentifierUtils.ts)
follows aliases until it reaches a value, parameter, external identifier, recursive reference, or
undefined endpoint. It tracks visited node IDs to stop mutual-recursion cycles and preserves the
distinction between `name` and `@name` when resolving shadowed bindings.

Rename uses these creator relationships rather than replacing every equal string. It finds the
selected declaration, walks identifiers beneath the enclosing scope, and retains references resolving
to that same creator. It returns document-local `TextEdit[]`; it does not apply edits, produce a
workspace edit, or perform a host-level rename transaction. When no related set is found, the
implementation can fall back to an edit for the selected identifier alone. The replacement text is
the supplied `newName`, so the API is not a complete rename-validation service.

## Type inference and lazy scope types

[tryType](src/powerquery-language-services/inspection/type/task.ts) creates an `InspectTypeState` from
inspection settings, the parser indexes, and a `TypeCache`, then calls
[`inspectXor`](src/powerquery-language-services/inspection/type/inspectType/common.ts).
The dispatcher selects an expression-specific inspector and caches computed types by node ID.

Inspectors cover constants and literals, identifiers, lists, records, tables, functions, invocation,
field/item access, operators, conditionals, null coalescing, ranges, and error handling. They use
parser `Type` and `TypeUtils` contracts rather than evaluating M expressions.

The type system distinguishes unknown/incomplete information (`Unknown`), unconstrained information
(`Any`), incompatible expressions (`None`), and nodes to which typing does not apply
(`NotApplicable`). Do not collapse these into a single missing-value case.

### Type strategy and contextual information

`TypeStrategy.Extended` retains richer structure such as list element types, record/table fields,
defined function signatures, and unions where implemented. `Primitive` uses reduced inference paths
in the relevant inspectors; it is not a final global conversion pass. For example, list inference
returns a primitive list without inspecting every element, while function-expression handling has
its own strategy-specific behavior.

The helpers in [InspectionUtils](src/powerquery-language-services/inspectionUtils.ts) build inspection
settings from parser settings, defaulting to an empty library, extended inference, and workspace-cache
permission. `eachScopeById` lets a host supply the implicit row/parameter type for individual `each`
nodes when local syntax alone cannot determine it.

### Lazy scope-type resolution

`tryScopeType` builds a `ScopeTypeByKey` around a `NodeScope` and a resolver closure capturing the
inspection state. It does not eagerly infer every binding.

| Operation | Behavior |
| --- | --- |
| `has`, `keys`, `size` | Inspect the full scope without resolving types. |
| `resolveType(key)` | Resolve one binding, cache the successful type by key, or return `undefined` for a missing key. |
| `resolveAll()` | Resolve remaining keys, grouping aliases by creator node ID so each unique node is resolved once in that batch. |
| `entries`, `values`, `forEach` | Asynchronously resolve all types before enumeration. |
| `resolvedSize` | Report how many identifier keys have cached types. |

Resolver failures propagate to the caller; a failed key is not cached in `ScopeTypeByKey`.
Unlike `MemoizedAnalysis`, this class caches completed types rather than in-flight promises.
Its resolver also populates the analysis's shared `typeById` map.

`getOrCreateScopeItemType` tracks currently computing node IDs and returns `Any` to break recursive
type computation. Alias grouping in `resolveAll()` avoids falsely treating two spellings of the same
node as a recursion cycle.

Laziness is feature-dependent: hover can resolve only the relevant identifier, whereas local scope
completion currently loops through the visible scope and resolves each candidate's type.

### Function calls

[Invocation inspection](src/powerquery-language-services/inspection/invokeExpression/invokeExpression.ts)
infers the callable's type, identifies whether the name is local, and, for a `DefinedFunction`, collects
argument nodes/types, expected argument counts, and type-check results.
An empty trailing parse-context argument is not counted as a supplied argument.

[Current-invocation inspection](src/powerquery-language-services/inspection/invokeExpression/currentInvokeExpression.ts)
adds the cursor's argument ordinal for the innermost containing call. Signature-help context requires
a function name and argument ordinal; not every callable expression yields signature help.

Return-type inference is separate from argument validation:
[inspectTypeInvokeExpression](src/powerquery-language-services/inspection/type/inspectType/inspectTypeInvokeExpression.ts)
first tries an external invocation resolver when appropriate, then falls back to the callable's type
and a defined function's return type.

## Libraries and external types

The library does not bundle a fixed runtime standard library. Different Power Query hosts expose
different symbols, so the host supplies an `ILibrary` with two complementary surfaces:

| Surface | Used for |
| --- | --- |
| `libraryDefinitions` | Completion labels, documentation, signature metadata, semantic classification, and known-name checks. |
| `externalTypeResolver` | Static type resolution for external values and calls, including host-specific behavior based on argument types. |

`LibraryDefinitions` contains a stable `staticLibraryDefinitions` map and a
`dynamicLibraryDefinitions()` callback. Definition lookup checks static entries first, then dynamic
entries. Key enumeration and completion enumerate both collections, so duplicate names are not
automatically deduplicated. The callback may run repeatedly; avoid expensive recomputation if the
host can provide a stable snapshot.

[External type requests](src/powerquery-language-services/externalType/externalType.ts) distinguish:

- `Value`: the type of the external identifier itself, such as a function signature.
- `Invocation`: the result type of calling that identifier, with inferred argument types supplied.

`ILibrary.externalTypeResolver` is synchronous. Although asynchronous resolver type aliases also
exist, they are not the function contract stored on `ILibrary`.
[Resolver composition](src/powerquery-language-services/externalType/externalTypeUtils.ts) uses the
first resolver that returns a defined type.

[LibraryDefinitionUtils.externalTypeResolver](src/powerquery-language-services/library/libraryDefinitionUtils.ts)
adapts definition metadata: value requests receive `asPowerQueryType`; invocation requests receive a
defined function's return type, or `Any` when a known definition has no defined-function return type.
A custom resolver can model transformations such as adding a column to the type of a table argument.

[LibrarySymbolUtils.createLibrary](src/powerquery-language-services/library/librarySymbolUtils.ts)
converts serialized `LibrarySymbol` metadata into definitions and composes a custom resolver before
the metadata-derived fallback. Conversion can partially succeed: an error result includes the usable
library and `failedLibrarySymbolConversions`, not just an exception. Consumers must inspect that
result rather than assuming every input symbol was converted.

`Library.NoOpLibrary` provides empty definitions and a resolver that returns `undefined`. A host using
it should not expect runtime-library completion or externally resolved types.

## Validation pipeline

[`validate(document, analysisSettings, validationSettings)`](src/powerquery-language-services/validate/validate.ts)
returns `Promise<Result<ValidateOk | undefined, CommonError>>`, where `ValidateOk` contains
`diagnostics` and `hasSyntaxError`.

```text
Acquire Analysis through AnalysisUtils
  -> obtain parse state and parse error
  -> no parse state? return undefined
  -> parse error + semantic checks disabled on parse errors?
       return parse diagnostics only, hasSyntaxError = true
  -> if checkInvokeExpressions:
       check duplicate function parameters
       await invocation checks
  -> if checkUnknownIdentifiers:
       await unknown-identifier checks
  -> assemble duplicate-binding, parse, function, invocation, unknown diagnostics
```

The top-level validators do not run as a four-way `Promise.all`. Invocation validation does fan out
individual invocation inspections and diagnostic conversion with `Promise.all`. Type and scope state
are reused through the acquired analysis's `TypeCache`.

[ValidationSettings](src/powerquery-language-services/validate/validationSettings/validationSettings.ts)
extends `InspectionSettings`. The
[settings factory](src/powerquery-language-services/validate/validationSettings/validationSettingsUtils.ts)
enables all four checks below by default and uses `"Unknown Source"` unless overridden.

| Setting | Current effect |
| --- | --- |
| `checkDiagnosticsOnParseError` | Whether semantic validation continues on available partial parse state; otherwise only parse diagnostics are returned. |
| `checkForDuplicateIdentifiers` | Checks repeated bindings in let expressions, records, record types, and sections. |
| `checkInvokeExpressions` | Enables both duplicate function-parameter checks and invocation argument count/type checks. |
| `checkUnknownIdentifiers` | Checks value references against local scopes, library definitions, and the external value resolver. |
| `source` | Populates the diagnostic source field. |

There is no separate function-definition-validation switch. Duplicate function parameters are gated
by `checkInvokeExpressions`, not `checkForDuplicateIdentifiers`.

Unknown-name diagnostics can suggest a nearby local/library name using Jaro-Winkler similarity.
The current suggestion threshold is strictly greater than `0.9`; library keys are collected once per
validation run and candidate lists are reused per `NodeScope` object.

[Parse diagnostics](src/powerquery-language-services/validate/validateParse.ts) use the parser message
and offending-token range, or a rightmost parsed leaf when no error token exists. If no usable range
exists, that conversion can produce no diagnostic even though `hasSyntaxError` is true.
`DiagnosticErrorCode` includes a lex-error code, but this pipeline does not convert lexer-stage
failures into diagnostics: without parse state, `validate` returns `undefined`.

Analysis settings control parsing and provider construction; validation settings control validation
inspection and diagnostic generation. Keep their libraries, type strategy, contextual `each` types,
and parser-related settings consistent when sharing cached state.

## Caching, invalidation, and disposal

There are several distinct cache lifetimes, not one global type cache:

| Owner | Key | Cached value / lifetime |
| --- | --- | --- |
| Module-level `AnalysisUtils` registry | Document URI, with version compared separately | One `Analysis` per cached URI until replaced; module lifetime. |
| `AnalysisBase` | The analysis instance | One lex/parse promise for that document snapshot. |
| `MemoizedAnalysis.activeNodeCache` | `"line:character"` | Active-node result promise. |
| `MemoizedAnalysis.currentInvokeExpressionCache` | `"line:character"` | Current-invocation inspection promise. |
| `MemoizedAnalysis.autocompleteCache` | Selected leaf node ID, or `undefined` | Autocomplete inspection promise, not the final merged completion array. |
| `MemoizedAnalysis.nodeScopeCache` / `scopeTypeCache` | Selected leaf node ID, or `undefined` | Scope and lazy scope-type inspection promises. |
| `AnalysisBase.typeCache` | Parser node ID | `NodeScope` objects and inferred Power Query types shared by that analysis's requests and validation. |
| `ScopeTypeByKey` | Identifier key | Successfully resolved scope types within that resolver object. |
| `LibraryProvider` | Signature label | Generated signature information for that provider instance. |

### Invalidation constraints

`AnalysisSettings.isWorkspaceCacheAllowed` controls reuse in `AnalysisUtils`. With reuse enabled,
the same URI and version returns the existing object. A different version removes the old registry
entry and installs a new analysis. With reuse disabled, each factory call creates a new analysis.

The registry key does not include text, settings, library contents, or provider factories. Changing
any of these without changing the URI/version can leave the old analysis in use. For such changes,
use a fresh analysis with registry reuse disabled or manage a new instance directly.

`InspectionSettings.isWorkspaceCacheAllowed` is carried through inspection settings, but does not
disable the five promise caches in `MemoizedAnalysis` or the analysis's shared type cache. Those are
per-instance mechanisms, separate from factory reuse.

Memoization keys also omit request cancellation tokens and correlation IDs. Repeated calls reuse the
first promise for that key, including cached failure/undefined outcomes. They do not necessarily
repeat inspection under the newest request's token. Node-ID caches must stay paired with the parse
state that created those IDs; they are not cross-document or cross-version caches.

Dynamic library lookup is not full cache invalidation. Types and signature information already
computed in an existing analysis/provider can still reflect older metadata.

### Disposal is cache clearing, not registry eviction

`MemoizedAnalysis.dispose()` clears its five maps and calls `AnalysisBase.dispose()`, which clears the
scope/type maps. It does not cancel work already running, discard the lex/parse promise, dispose
providers, or remove the analysis from `AnalysisUtils`' module-level registry.

The registry currently exposes no close-document eviction or clear API, and replacing a version does
not dispose the previous analysis automatically. Hosts needing explicit lifetime control should
manage analysis instances themselves or avoid registry reuse. Do not treat `dispose()` as a
terminal-state or document-close protocol enforced by this library.

## Formatting and editor-facing structures

[tryFormat](src/powerquery-language-services/formatter.ts) is independent of analysis and its caches.
It merges formatter defaults with supplied settings and formats the complete document. Success
returns one full-document replacement edit, not a minimal edit set or range-formatting operation.
Formatter lexer/parser failures produce `Ok(undefined)`; common errors go through the outer result
wrapper.

Document symbols are generated from completed identifier-paired expressions and records using parent
node IDs to build hierarchy. Symbol extraction is present both in `AnalysisBase.getDocumentSymbols`
and the exported [documentSymbols.ts](src/powerquery-language-services/documentSymbols.ts) helper;
changes to symbol behavior should account for both paths.

[Folding ranges](src/powerquery-language-services/providers/localDocumentProvider/foldingRanges.ts)
come from multi-line completed AST nodes of selected kinds, including functions, conditionals, calls,
lets, lists, records, section members, metadata, and type-primary expressions. This is AST-based
folding, not a general comment-region scanner.

[Partial semantic tokens](src/powerquery-language-services/providers/localDocumentProvider/partialSemanticToken.ts)
are gathered in a deliberate priority order, with identifier-expression classification last.
Each output contains an absolute `Range`, a `SemanticTokenTypes` value, and modifiers. The host must
adapt these partial tokens to its protocol, including any sorting, overlap resolution, legend lookup,
and delta encoding required by its semantic-token implementation.

Positions and ranges are zero-based line/character coordinates. Conversion utilities map parser token
positions using `lineNumber` and `lineCodeUnit`; preserve code-unit semantics when integrating with an
editor rather than treating columns as byte offsets.

## Cancellation, tracing, and localization

### Cancellation is cooperative

Feature requests accept an optional token override. Provider contexts and individual inspection
operations generally select that token over `inspectionSettings.cancellationToken`; parse-state and
active-node helper calls still depend on the original parse task/settings.
Validation uses its own settings token.

Cancellation is observed through `throwIfCancelled()` checkpoints in traversals, inference, and
providers. It is not preemptive interruption, a worker-thread scheduler, or a provider deadline.
Synchronous loops can occupy the event loop between checkpoints, and externally signaled
cancellation may not be observed promptly without an opportunity to yield.

The constructor-started parse task is not restarted under a later request's token. Reused inspection
promises also retain their original work, as described in the caching section. Provider aggregation
can skip error results for some features, so callers should not infer that every cancelled subtask
must become a top-level cancellation error.

### Tracing

Operations commonly use the parser's `TraceManager.entry(category, operation, correlationId)`,
pass the resulting `trace.id` to nested work, and call `trace.exit(details)`.
[Trace categories](src/powerquery-language-services/trace.ts) separate analysis/validation, providers,
autocomplete, and inspection. [TraceUtils](src/powerquery-language-services/traceUtils.ts) adds compact
node/type metadata. This instrumentation helps distinguish parsing, scope construction, type
inference, and provider latency; it is not a performance benchmark.

### Localization

[Localization templates](src/powerquery-language-services/localization/templates.ts) are backed by
JSON resources. Locale lookup lowercases the requested locale and falls back to the default English
templates. Validation helpers construct localized messages; parse diagnostics reuse the parser's
message. Library-symbol conversion also uses templates for parameter documentation.

## Tests and development infrastructure

Tests use Mocha, Chai, and TypeScript through `ts-node/register`.
[.mocharc.json](.mocharc.json) discovers `src\test\**\*.test.ts`; the
[reporter configuration](mochaReporterConfig.json) emits console and JUnit results. The build is not
required merely to discover the source tests, though CI builds before running them.

| Test area | Architectural contract exercised |
| --- | --- |
| [analysis.test.ts](src/test/analysis.test.ts) | High-level provider composition and local/library precedence, including delayed providers. |
| [externalConsumption.test.ts](src/test/externalConsumption.test.ts) | Consumption through the public source barrel and re-exported contracts. |
| [inspection tests](src/test/inspection) | Cursor boundaries, incomplete syntax, scope/alias behavior, expression types, invocation context, completion strategies, and rename edits. |
| [scopeTypeByKey.test.ts](src/test/inspection/scopeTypeByKey.test.ts) | Lazy resolution, caching, missing keys, bulk enumeration, and resolver failure/retry behavior. |
| [provider tests](src/test/providers) | Local and library feature behavior and multi-provider contexts. |
| [validation tests](src/test/validation) | Duplicate bindings/parameters, argument mismatches, unknown names, and semantic checks on parse errors. |
| [library tests](src/test/library.test.ts) and [documentation tests](src/test/library/buildParameterDocumentation.test.ts) | Symbol conversion, external resolution, and parameter documentation. |
| [documentSymbols.test.ts](src/test/documentSymbols.test.ts) | Symbol extraction and nesting. |

[TestConstants](src/test/testConstants.ts) supplies small mock libraries and inspection/analysis
settings, plus a standard-library JSON fixture. [TestUtils](src/test/testUtils) provides parse,
inspection, analysis, and validation assertions. Cursor-oriented cases commonly use `|` in source
text to mark a position; test helpers remove the marker before analysis.

The `slow*Provider` files define delayed provider test doubles. They are not standalone benchmarks,
and timeout-named tests should not be read as evidence of a production provider-timeout mechanism.
There is no benchmark script in `package.json`; performance claims need separate measurements.
The focused `ScopeTypeByKey` tests do not currently cover alias grouping in `resolveAll()`; preserve
that invariant with dedicated regression cases when changing bulk-resolution concurrency.

[tsconfig.json](tsconfig.json) builds strict TypeScript to CommonJS/ES2022, with declarations and
source maps under `lib`. It enables incremental builds and writes `tsconfig.tsbuildinfo`.
The npm package's `files` selection includes the compiled language-services subtree rather than
the test subtree.

The [GitHub gated-PR workflow](.github/workflows/pr-gated.yml) runs on Windows, selects Node from
`package.json`, installs with `npm ci`, then lints, builds, tests, and publishes JUnit results. The
[Azure PR pipeline](.pipelines/pr-pipeline.yml) is a separate Windows definition and still specifies
Node 16, unlike the package's Node 22-or-later requirement; do not assume the configurations match.

Some package scripts (`prepublishOnly` and local linking helpers) invoke `git clean -xdf`.
They are destructive packaging/development helpers, not substitutes for ordinary build/test commands.

## Extension and maintenance guide

| Change | Primary implementation surfaces | Related verification |
| --- | --- | --- |
| Add or replace an editor provider | `AnalysisSettings` factories, provider interfaces/contexts, and request routing in `AnalysisBase`. | Provider composition, precedence, error results, rejection, and cancellation behavior. |
| Add an expression type or change inference | Parser node contract, `inspectXor` dispatch, expression-specific inspector, and strategy handling. | Type tests plus downstream field completion, hover, invocation checks, and signatures. |
| Change lexical binding behavior | Scope construction, allowed identifier forms, and dereferencing/creator helpers. | Scope, alias/recursion, definition, rename, and unknown-name cases. |
| Model host functions and values | Library definitions, serialized symbol conversion, and external value/invocation resolver composition. | Library metadata, return-type inference, parameter documentation, and validation consistency. |
| Add a diagnostic | Validation settings/gating, orchestration, diagnostic code, message templates, and range conversion. | Complete and partial documents, disabled flags, source/locale, and cancellation checkpoints. |
| Change cache lifetime or keys | URI/version registry, promise memoization, node-ID type cache, provider caches, and disposal. | Same-version reuse, version/settings/library changes, cancelled results, concurrent work, and document close. |
| Change syntax-derived editor structures | Both symbol-extraction paths, folding helpers, or semantic-token passes. | Nested symbols, partial nodes, multi-line ranges, token priority, and host encoding assumptions. |

For performance work, measure the relevant phase before changing it. Construction starts a full
lex/parse; cursor lookup searches parser leaves; scope building walks ancestry and binding maps;
extended inference recursively visits expressions; scope completion resolves visible candidate types;
library completion enumerates definitions; unknown-name suggestions compare against known names.

Preserve shared-cache and recursive-resolution invariants when changing concurrency. In particular,
`ScopeTypeByKey.resolveAll()` groups aliases for correctness, and an async return type alone does not
mean a traversal yields often enough for responsive cancellation. Tests of result values should be
complemented by explicit latency/cancellation measurements when those properties are the goal.
