(function(f) {
    "use strict";
    f(window.CodeMirror, window.XSLTProcessor, window._modules["xslt-schema"]);
})(function(CodeMirror, XSLTProcessor, xsltSchema) {
    "use strict";
    var storagePrefix = "xsltui.";

    var xmlEditor = makeEditor("xml");
    var xsltEditor = makeEditor("xslt", {
        extraKeys: getCodeCompletionKeys(),
        hintOptions: { schemaInfo: xsltSchema }
    });
    var output = CodeMirror.fromTextArea($("#output textarea")[0], {
        /*lineNumbers: true*/
        readOnly: true
    });
    var $outputType = $("#output-type");
    updateResult();

    function makeEditor(editorType, extraConfig) {
        var editor = CodeMirror.fromTextArea($("#" + editorType + " textarea")[0], $.extend(true, {
            mode: "text/xml",
            autoCloseTags: true,
            autoCloseBrackets: true,
            tabSize: 2,

            extraKeys: { Tab: indentWithSpaces }
        }, extraConfig));

        load(editor, editorType);
        editor.on("change", function() {
            save(editor, editorType);
            updateResult();
        });

        return editor;

        function indentWithSpaces(cm) {
            if (cm.somethingSelected()) {
                cm.indentSelection("add");
            } else {
                cm.replaceSelection(new Array(cm.getOption("indentUnit") + 1).join(" "), "end", "+input");
            }
        }

        function save() {
            var value = editor.getValue();
            localStorage.setItem(storagePrefix + editorType, value);
        }

        function load() {
            var value = localStorage.getItem(storagePrefix + editorType);
            if (value === undefined || value === null)
                value = getDefaultValue(editor);

            editor.setValue(value);
        }

        function getDefaultValue() {
            var value = $(editor.getWrapperElement())
                            .siblings("script[data-default]")
                            .text()
                            .trim();
            var lines = value.split(/[\r\n]+/g);
            var indent = lines[lines.length - 1].match(/^\s*/)[0];
            return value.replace(new RegExp(indent, "g"), "");
        }
    }

    function updateResult() {
        clearErrors();
        try {
            var xml = parseXML(xmlEditor.getValue());
            var xslt = parseXML(xsltEditor.getValue());
            if (xml.errors || xslt.errors) {
                reportErrors(xmlEditor,  xml.errors);
                reportErrors(xsltEditor, xslt.errors);
                return;
            }

            var result = transform(xml.document, xslt.document);
            $outputType.text(result.type);
            output.setValue(result.text);
        }
        catch (ex) {
            reportErrors(output, ex.message || ex);
        }
    }

    function transform(xmlDocument, xsltDocument) {
        var processor = new XSLTProcessor();
        processor.importStylesheet(xsltDocument);

        var result = processor.transformToDocument(xmlDocument);
        var outputTag = xsltDocument.getElementsByTagNameNS("http://www.w3.org/1999/XSL/Transform", "output")[0];
        var method = (outputTag ? outputTag.getAttribute("method") : null) || "xml";
        if (method !== "text")
            return { type: method.toUpperCase(), text: (new XMLSerializer()).serializeToString(result) };

        var textElement = result.getElementsByTagNameNS("http://www.mozilla.org/TransforMiix", "result")[0]
                     || result.getElementsByTagName("pre", "result")[0];

        return { type: "Text", text: textElement.textContent };
    }

    function parseXML(xml) {
        var parsed = (new DOMParser()).parseFromString(xml, "text/xml");
        var errors = detectParseErrors(parsed);
        if (errors)
            return { errors: errors };

        return { document: parsed };
    }

    function detectParseErrors(parsed) {
        var error = parsed.getElementsByTagName("parsererror")[0]
                 || parsed.getElementsByTagNameNS("http://www.w3.org/1999/xhtml", "parsererror")[0]
                 || parsed.getElementsByTagNameNS("http://www.mozilla.org/newlayout/xml/parsererror.xml", "parsererror")[0];

        if (!error)
            return;

        var text = error.textContent;
        text = text.replace(/This page contains the following errors:|Below is a rendering of the page up to the first error\./g, "");
        return text;
    }

    function reportErrors(editor, errors) {
        var $errors = $(editor.getWrapperElement()).parents("section").find(".errors");
        $errors.text(errors);
    }

    function clearErrors() {
        $(".errors").text("");
    }

    function getCodeCompletionKeys() {
        return {
            "'<'": completeAfter,
            "'/'": completeIfAfterLt,
            "' '": completeIfInTag,
            "'='": completeIfInTag,
            "Ctrl-Space": "autocomplete"
        };

        function completeAfter(cm, condition) {
            if (!condition || condition()) {
                setTimeout(function() {
                    if (!cm.state.completionActive)
                        cm.showHint({ completeSingle: false });
                }, 100);
            }

            return CodeMirror.Pass;
        }

        function completeIfAfterLt(cm) {
            return completeAfter(cm, function() {
                var cursor = cm.getCursor();
                return cm.getRange(CodeMirror.Pos(cursor.line, cursor.ch - 1), cursor) === "<";
            });
        }

        function completeIfInTag(cm) {
            return completeAfter(cm, function() {
                var token = cm.getTokenAt(cm.getCursor());
                if (token.type === "string" && (!/['"]/.test(token.string.charAt(token.string.length - 1)) || token.string.length === 1))
                    return false;

                var inner = CodeMirror.innerMode(cm.getMode(), token.state).state;
                return inner.tagName;
            });
        }
    }
});