/* globals CodeMirror:false, XSLTProcessor:false */

$(function() {
  'use strict';
  var storagePrefix = 'xsltui.';
  var editorType = '__xsltui_editorType__';
  
  var xmlEditor = CodeMirror.fromTextArea($('#xml textarea')[0], {
    mode: 'text/xml'/*,
    lineNumbers: true*/
  });
  xmlEditor[editorType] = 'xml';
  
  var xsltEditor = CodeMirror.fromTextArea($('#xslt textarea')[0], {
    mode: 'text/xml'/*,
    lineNumbers: true*/
  });
  xsltEditor[editorType] = 'xslt';
  
  var output = CodeMirror.fromTextArea($('#output textarea')[0], {
    /*lineNumbers: true*/
    readOnly: true
  });
  var $outputType = $('#output-type');
  
  [xmlEditor, xsltEditor].forEach(function(editor) {
    load(editor);
    editor.on('change', function() {
      save(editor);
      updateResult();
    });
  });
  updateResult();
  
  function save(editor) {
    var value = editor.getValue();
    localStorage.setItem(storagePrefix + editor[editorType], value);
  }
  
  function load(editor) {
    var value = localStorage.getItem(storagePrefix + editor[editorType]);
    if (value === undefined || value === null)
      value = getDefaultValue(editor);
    
    editor.setValue(value);
  }
  
  function getDefaultValue(editor) {
    var value = $(editor.getWrapperElement())
                   .siblings('script[data-default]')
                   .text()
                   .trim();
    var lines = value.split(/[\r\n]+/g);
    var indent = lines[lines.length - 1].match(/^\s*/)[0];
    return value.replace(new RegExp(indent, 'g'), '');
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
    var outputTag = xsltDocument.getElementsByTagNameNS('http://www.w3.org/1999/XSL/Transform', 'output')[0];
    var method = (outputTag ? outputTag.getAttribute('method') : null) || 'xml';
    if (method !== 'text')
      return { type: method.toUpperCase(), text: (new XMLSerializer()).serializeToString(result) };
    
    var textElement = result.getElementsByTagNameNS('http://www.mozilla.org/TransforMiix', 'result')[0]
                   || result.getElementsByTagName('pre', 'result')[0];
    
    return { type: 'Text', text: textElement.textContent };
  }
  
  function parseXML(xml) {
    var parsed = (new DOMParser()).parseFromString(xml, 'text/xml');
    var errors = detectParseErrors(parsed);
    if (errors)
      return { errors: errors };
    
    return { document: parsed };
  }
  
  function detectParseErrors(parsed) {
    var error = parsed.getElementsByTagName('parsererror')[0]
             || parsed.getElementsByTagNameNS('http://www.w3.org/1999/xhtml', 'parsererror')[0]
             || parsed.getElementsByTagNameNS('http://www.mozilla.org/newlayout/xml/parsererror.xml', 'parsererror')[0];
    if (!error)
      return;
    
    var text = error.textContent;
    text = text.replace(/This page contains the following errors:|Below is a rendering of the page up to the first error\./g, '');
    return text;
  }
  
  function reportErrors(editor, errors) {
    var $errors = $(editor.getWrapperElement()).parents('section').find('.errors');
    $errors.text(errors);
  }
  
  function clearErrors() {
    $('.errors').text('');
  }
});