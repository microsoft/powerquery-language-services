"use strict";
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const powerquery_format_1 = require("@microsoft/powerquery-format");
const LanguageServices = require("@microsoft/powerquery-language-services");
const Library = require("@microsoft/powerquery-library");
const powerquery_parser_1 = require("@microsoft/powerquery-parser");
const LS = require("vscode-languageserver");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = LS.createConnection(LS.ProposedFeatures.all);
const documents = new LS.TextDocuments(vscode_languageserver_textdocument_1.TextDocument);
let analysisOptions;
connection.onInitialize(() => {
    return {
        capabilities: {
            textDocumentSync: LS.TextDocumentSyncKind.Incremental,
            documentFormattingProvider: true,
            completionProvider: {
                // TODO: is it better to return the first pass without documention to reduce message size?
                resolveProvider: false,
            },
            hoverProvider: true,
            signatureHelpProvider: {
                triggerCharacters: ["(", ","],
            },
        },
    };
});
connection.onInitialized(() => {
    analysisOptions = {
        librarySymbolProvider: Library.createLibraryProvider(),
    };
});
documents.onDidClose(event => {
    LanguageServices.documentClosed(event.document);
});
// TODO: Support incremental lexing.
// TextDocuments uses the connection's onDidChangeTextDocument, and I can't see a way to provide a second
// one to intercept incremental changes. TextDocuments.OnDidChangeContent only provides the full document.
documents.onDidChangeContent(event => {
    LanguageServices.documentUpdated(event.document);
    validateDocument(event.document).catch(err => connection.console.error(`validateDocument err: ${JSON.stringify(err, undefined, 4)}`));
});
function validateDocument(document) {
    return __awaiter(this, void 0, void 0, function* () {
        const validationResult = LanguageServices.validate(document);
        connection.sendDiagnostics({
            uri: document.uri,
            diagnostics: validationResult.diagnostics,
        });
    });
}
connection.onDocumentFormatting((documentfomattingParams) => {
    const maybeDocument = documents.get(documentfomattingParams.textDocument.uri);
    if (maybeDocument === undefined) {
        return [];
    }
    const document = maybeDocument;
    const options = documentfomattingParams.options;
    const textEditResult = [];
    let indentationLiteral;
    if (options.insertSpaces) {
        indentationLiteral = "    " /* SpaceX4 */;
    }
    else {
        indentationLiteral = "\t" /* Tab */;
    }
    const formatSettings = Object.assign(Object.assign({}, powerquery_parser_1.DefaultSettings), { indentationLiteral, 
        // TODO: get the newline terminator for the document/workspace
        newlineLiteral: "\r\n" /* Windows */ });
    const formatResult = powerquery_format_1.format(formatSettings, document.getText());
    if (formatResult.kind === "Ok" /* Ok */) {
        textEditResult.push(LS.TextEdit.replace(fullDocumentRange(document), formatResult.value));
    }
    else {
        // TODO: should this go in the failed promise path?
        const error = formatResult.error;
        let message;
        if (powerquery_format_1.FormatError.isTFormatError(error)) {
            message = error.innerError.message;
        }
        else {
            message = "An unknown error occured during formatting.";
        }
        connection.window.showErrorMessage(message);
    }
    return textEditResult;
});
// TODO: is there a better way to do this?
function fullDocumentRange(document) {
    return {
        start: document.positionAt(0),
        end: {
            line: document.lineCount - 1,
            character: Number.MAX_VALUE,
        },
    };
}
connection.onCompletion((textDocumentPosition, _token) => __awaiter(void 0, void 0, void 0, function* () {
    const document = documents.get(textDocumentPosition.textDocument.uri);
    if (document) {
        const analysis = LanguageServices.createAnalysisSession(document, textDocumentPosition.position, analysisOptions);
        return analysis.getCompletionItems().catch(err => {
            connection.console.error(`onCompletion error ${JSON.stringify(err, undefined, 4)}`);
            return [];
        });
    }
    return [];
}));
connection.onHover((textDocumentPosition, _token) => __awaiter(void 0, void 0, void 0, function* () {
    const emptyHover = {
        range: undefined,
        contents: [],
    };
    const document = documents.get(textDocumentPosition.textDocument.uri);
    if (document) {
        const analysis = LanguageServices.createAnalysisSession(document, textDocumentPosition.position, analysisOptions);
        return analysis.getHover().catch(err => {
            connection.console.error(`onHover error ${JSON.stringify(err, undefined, 4)}`);
            return emptyHover;
        });
    }
    return emptyHover;
}));
connection.onSignatureHelp((textDocumentPosition, _token) => __awaiter(void 0, void 0, void 0, function* () {
    const emptySignatureHelp = {
        signatures: [],
        // tslint:disable-next-line: no-null-keyword
        activeParameter: null,
        activeSignature: 0,
    };
    const document = documents.get(textDocumentPosition.textDocument.uri);
    if (document) {
        const analysis = LanguageServices.createAnalysisSession(document, textDocumentPosition.position, analysisOptions);
        return analysis.getSignatureHelp().catch(err => {
            connection.console.error(`onSignatureHelp error ${JSON.stringify(err, undefined, 4)}`);
            return emptySignatureHelp;
        });
    }
    return emptySignatureHelp;
}));
// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);
// Listen on the connection
connection.listen();
//# sourceMappingURL=server.js.map