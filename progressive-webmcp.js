/*!
 * progressive-webmcp
 * Adds declarative WebMCP attributes to existing HTML forms.
 * Version: 0.2.0
 *
 * This helper intentionally keeps form fields mostly untouched.
 * WebMCP can already infer parameter information from native HTML form controls,
 * labels, types, constraints, and optional toolparamdescription attributes.
 */
(function (global) {
  'use strict';

  const DEFAULT_OPTIONS = {
    root: document,
    formSelector: 'form',
    fieldSelector: 'input[name], select[name], textarea[name]',
    ignoreFormSelector: '[data-webmcp-ignore]',
    ignoreFieldSelector: [
      '[data-webmcp-field-ignore]',
      'input[type="hidden"]',
      'input[type="submit"]',
      'input[type="button"]',
      'input[type="reset"]',
      'input[type="image"]'
    ].join(', '),
    overwrite: false,
    autoSubmit: false,
    describeFields: 'configured',
    observe: false,
    defaultToolNamePrefix: 'form',
    forms: {}
  };

  class ProgressiveWebMcp {
    constructor(options = {}) {
      this.options = {
        ...DEFAULT_OPTIONS,
        ...options,
        forms: {
          ...DEFAULT_OPTIONS.forms,
          ...(options.forms || {})
        }
      };

      this.previousAttributes = new WeakMap();
      this.enhancedElements = new Set();
      this.observer = null;
    }

    init(root = this.options.root) {
      this.enhance(root);

      if (this.options.observe) {
        this.observe(root);
      }

      return this;
    }

    enhance(root = this.options.root) {
      const forms = this.getForms(root);
      const usedToolNames = this.collectExistingToolNames(root);

      forms.forEach((form, index) => {
        this.enhanceForm(form, index, usedToolNames);
      });

      return forms;
    }

    refresh(root = this.options.root) {
      return this.enhance(root);
    }

    enhanceForm(form, index, usedToolNames) {
      if (!(form instanceof HTMLFormElement)) {
        return;
      }

      if (form.matches(this.options.ignoreFormSelector)) {
        return;
      }

      const formConfig = this.getFormConfig(form);

      if (formConfig === false) {
        return;
      }

      const toolName = this.getToolName(form, index, formConfig, usedToolNames);
      const toolDescription = this.getToolDescription(form, formConfig);

      if (toolName) {
        this.setAttribute(form, 'toolname', toolName);
      }

      if (toolDescription) {
        this.setAttribute(form, 'tooldescription', toolDescription);
      }

      this.applyAutoSubmit(form, formConfig);
      this.enhanceFields(form, formConfig);
    }

    enhanceFields(form, formConfig) {
      const mode = this.getDescribeFieldsMode(formConfig);

      if (mode === 'none') {
        return;
      }

      this.getFormFields(form).forEach((field) => {
        this.enhanceField(field, form, formConfig, mode);
      });
    }

    enhanceField(field, form, formConfig, mode) {
      if (field.matches(this.options.ignoreFieldSelector)) {
        return;
      }

      const fieldConfig = this.getFieldConfig(field, formConfig);

      if (fieldConfig === false) {
        return;
      }

      const explicitDescription = this.getExplicitFieldDescription(field, fieldConfig);

      if (explicitDescription) {
        this.setAttribute(field, 'toolparamdescription', explicitDescription);
        return;
      }

      if (mode !== 'all') {
        return;
      }

      const inferredDescription = this.getInferredFieldDescription(field, form);

      if (inferredDescription) {
        this.setAttribute(field, 'toolparamdescription', inferredDescription);
      }
    }

    getForms(root) {
      if (root instanceof HTMLFormElement) {
        return [root];
      }

      if (!root || typeof root.querySelectorAll !== 'function') {
        return [];
      }

      return Array.from(root.querySelectorAll(this.options.formSelector));
    }

    getFormFields(form) {
      return Array.from(form.elements).filter((element) => {
        return element.matches && element.matches(this.options.fieldSelector);
      });
    }

    getFormConfig(form) {
      const configKey = form.getAttribute('data-webmcp-config');

      if (configKey && Object.prototype.hasOwnProperty.call(this.options.forms, configKey)) {
        return this.options.forms[configKey];
      }

      for (const [selector, config] of Object.entries(this.options.forms)) {
        try {
          if (form.matches(selector)) {
            return config;
          }
        } catch (error) {
          // Ignore invalid user selectors.
        }
      }

      return {};
    }

    getFieldConfig(field, formConfig) {
      if (!formConfig || !formConfig.fields) {
        return null;
      }

      for (const [reference, config] of Object.entries(formConfig.fields)) {
        if (reference === field.name) {
          return config;
        }

        if (field.id && reference === `#${field.id}`) {
          return config;
        }

        try {
          if (field.matches(reference)) {
            return config;
          }
        } catch (error) {
          // Ignore invalid user selectors.
        }
      }

      return null;
    }

    getToolName(form, index, formConfig, usedToolNames) {
      const existingName = form.getAttribute('toolname');

      if (existingName && !this.options.overwrite) {
        return '';
      }

      const configuredName = formConfig && formConfig.name;
      const dataName = form.getAttribute('data-webmcp-name');
      const rawName = configuredName || dataName || existingName || form.name || form.id || this.getActionName(form) || this.getNearbyHeadingText(form) || `${this.options.defaultToolNamePrefix}_${index + 1}`;
      const cleanName = this.toToolName(rawName);
      const uniqueName = this.makeUniqueToolName(cleanName, usedToolNames);

      usedToolNames.add(uniqueName);

      return uniqueName;
    }

    getToolDescription(form, formConfig) {
      const existingDescription = form.getAttribute('tooldescription');

      if (existingDescription && !this.options.overwrite) {
        return '';
      }

      const configuredDescription = formConfig && formConfig.description;
      const dataDescription = form.getAttribute('data-webmcp-description');
      const ariaLabel = form.getAttribute('aria-label');
      const ariaLabelledBy = this.getTextByIdList(form, form.getAttribute('aria-labelledby'));
      const legend = this.getFirstLegendText(form);
      const heading = this.getNearbyHeadingText(form);
      const submitText = this.getSubmitText(form);

      return this.normalizeText(
        configuredDescription ||
        dataDescription ||
        ariaLabel ||
        ariaLabelledBy ||
        legend ||
        heading ||
        (submitText ? `Submit form: ${submitText}` : 'Submit this form.')
      );
    }

    getDescribeFieldsMode(formConfig) {
      return formConfig && formConfig.describeFields
        ? formConfig.describeFields
        : this.options.describeFields;
    }

    getExplicitFieldDescription(field, fieldConfig) {
      const existingDescription = field.getAttribute('toolparamdescription');

      if (existingDescription && !this.options.overwrite) {
        return '';
      }

      if (typeof fieldConfig === 'string') {
        return this.normalizeText(fieldConfig);
      }

      if (fieldConfig && typeof fieldConfig === 'object' && fieldConfig.description) {
        return this.normalizeText(fieldConfig.description);
      }

      return this.normalizeText(field.getAttribute('data-webmcp-param-description') || '');
    }

    getInferredFieldDescription(field, form) {
      return this.normalizeText(
        this.getLabelText(field) ||
        field.getAttribute('aria-label') ||
        this.getTextByIdList(form, field.getAttribute('aria-labelledby')) ||
        field.getAttribute('aria-description') ||
        field.getAttribute('placeholder') ||
        this.humanizeName(field.name || field.id)
      );
    }

    applyAutoSubmit(form, formConfig) {
      if (form.hasAttribute('toolautosubmit') && !this.options.overwrite) {
        return;
      }

      const dataAutoSubmit = form.getAttribute('data-webmcp-autosubmit');
      let autoSubmit = this.options.autoSubmit;

      if (formConfig && Object.prototype.hasOwnProperty.call(formConfig, 'autoSubmit')) {
        autoSubmit = formConfig.autoSubmit;
      }

      if (dataAutoSubmit === 'true') {
        autoSubmit = true;
      }

      if (dataAutoSubmit === 'false') {
        autoSubmit = false;
      }

      if (dataAutoSubmit === 'get') {
        autoSubmit = 'get';
      }

      if (typeof autoSubmit === 'function') {
        autoSubmit = autoSubmit(form);
      }

      if (autoSubmit === 'get') {
        autoSubmit = this.getFormMethod(form) === 'get';
      }

      if (autoSubmit) {
        this.setAttribute(form, 'toolautosubmit', '');
      }
    }

    collectExistingToolNames(root) {
      const names = new Set();

      this.getForms(root).forEach((form) => {
        const name = form.getAttribute('toolname');

        if (name) {
          names.add(name);
        }
      });

      return names;
    }

    makeUniqueToolName(name, usedToolNames) {
      let uniqueName = name;
      let counter = 2;

      while (usedToolNames.has(uniqueName)) {
        uniqueName = `${name}_${counter}`;
        counter += 1;
      }

      return uniqueName;
    }

    setAttribute(element, name, value) {
      if (!this.options.overwrite && element.hasAttribute(name)) {
        return;
      }

      this.rememberPreviousAttribute(element, name);
      element.setAttribute(name, value);
      element.setAttribute('data-progressive-webmcp-enhanced', '');
      this.enhancedElements.add(element);
    }

    rememberPreviousAttribute(element, name) {
      let attributes = this.previousAttributes.get(element);

      if (!attributes) {
        attributes = {};
        this.previousAttributes.set(element, attributes);
      }

      if (!Object.prototype.hasOwnProperty.call(attributes, name)) {
        attributes[name] = element.hasAttribute(name) ? element.getAttribute(name) : null;
      }
    }

    observe(root = this.options.root) {
      this.disconnect();

      const observedRoot = root === document ? document.documentElement : root;

      this.observer = new MutationObserver((mutations) => {
        const hasNewElement = mutations.some((mutation) => {
          return Array.from(mutation.addedNodes).some((node) => {
            return node.nodeType === Node.ELEMENT_NODE;
          });
        });

        if (hasNewElement) {
          this.enhance(root);
        }
      });

      this.observer.observe(observedRoot, {
        childList: true,
        subtree: true
      });

      return this;
    }

    disconnect() {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }

      return this;
    }

    destroy() {
      this.disconnect();

      this.enhancedElements.forEach((element) => {
        const attributes = this.previousAttributes.get(element);

        if (!attributes) {
          return;
        }

        Object.entries(attributes).forEach(([name, oldValue]) => {
          if (oldValue === null) {
            element.removeAttribute(name);
          } else {
            element.setAttribute(name, oldValue);
          }
        });

        element.removeAttribute('data-progressive-webmcp-enhanced');
      });

      this.enhancedElements.clear();

      return this;
    }

    getFormMethod(form) {
      return String(form.getAttribute('method') || 'get').toLowerCase();
    }

    getActionName(form) {
      const action = form.getAttribute('action');

      if (!action) {
        return '';
      }

      try {
        const url = new URL(action, document.baseURI);
        const parts = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
        return parts.pop() || '';
      } catch (error) {
        return action;
      }
    }

    getSubmitText(form) {
      const submit = form.querySelector('button[type="submit"], input[type="submit"], button:not([type])');

      if (!submit) {
        return '';
      }

      return this.normalizeText(submit.tagName === 'INPUT' ? submit.value : submit.textContent);
    }

    getNearbyHeadingText(form) {
      const previousHeading = this.getPreviousHeading(form);

      if (previousHeading) {
        return this.normalizeText(previousHeading.textContent);
      }

      const parent = form.parentElement;

      if (!parent) {
        return '';
      }

      const heading = parent.querySelector('h1, h2, h3, h4, h5, h6');

      return heading ? this.normalizeText(heading.textContent) : '';
    }

    getPreviousHeading(form) {
      let current = form.previousElementSibling;

      while (current) {
        if (/^H[1-6]$/.test(current.tagName)) {
          return current;
        }

        current = current.previousElementSibling;
      }

      return null;
    }

    getFirstLegendText(form) {
      const legend = form.querySelector('fieldset > legend');
      return legend ? this.normalizeText(legend.textContent) : '';
    }

    getLabelText(field) {
      if (field.labels && field.labels.length > 0) {
        return Array.from(field.labels)
          .map((label) => this.normalizeText(label.textContent))
          .filter(Boolean)
          .join(' ');
      }

      if (field.id) {
        const label = field.ownerDocument.querySelector(`label[for="${this.escapeCssValue(field.id)}"]`);

        if (label) {
          return this.normalizeText(label.textContent);
        }
      }

      const wrappingLabel = field.closest('label');
      return wrappingLabel ? this.normalizeText(wrappingLabel.textContent) : '';
    }

    getTextByIdList(root, idList) {
      if (!idList) {
        return '';
      }

      const ownerDocument = root.ownerDocument || document;

      return idList
        .split(/\s+/)
        .map((id) => {
          const element = ownerDocument.getElementById(id);
          return element ? this.normalizeText(element.textContent) : '';
        })
        .filter(Boolean)
        .join(' ');
    }

    toToolName(value) {
      let name = String(value || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ä/g, 'ae')
        .replace(/ö/g, 'oe')
        .replace(/ü/g, 'ue')
        .replace(/ß/g, 'ss')
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .replace(/_{2,}/g, '_');

      if (!name) {
        name = this.options.defaultToolNamePrefix;
      }

      if (!/^[a-z]/.test(name)) {
        name = `${this.options.defaultToolNamePrefix}_${name}`;
      }

      return name;
    }

    humanizeName(value) {
      return String(value || '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    }

    normalizeText(value) {
      return String(value || '').replace(/\s+/g, ' ').trim();
    }

    escapeCssValue(value) {
      if (global.CSS && typeof global.CSS.escape === 'function') {
        return global.CSS.escape(value);
      }

      return String(value).replace(/["\\]/g, '\\$&');
    }
  }

  function progressiveWebMcp(options = {}) {
    return new ProgressiveWebMcp(options).init();
  }

  function parseAutoSubmit(value) {
    if (value === 'true') {
      return true;
    }

    if (value === 'get') {
      return 'get';
    }

    return false;
  }

  global.ProgressiveWebMcp = ProgressiveWebMcp;
  global.progressiveWebMcp = progressiveWebMcp;

  const currentScript = document.currentScript;

  if (currentScript && currentScript.hasAttribute('data-progressive-webmcp-auto')) {
    const start = () => {
      progressiveWebMcp({
        autoSubmit: parseAutoSubmit(currentScript.getAttribute('data-webmcp-autosubmit')),
        observe: currentScript.getAttribute('data-webmcp-observe') === 'true',
        describeFields: currentScript.getAttribute('data-webmcp-describe-fields') || 'configured'
      });
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
      start();
    }
  }
}(window));
