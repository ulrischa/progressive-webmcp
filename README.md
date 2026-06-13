# progressive-webmcp

Small progressive enhancement helper for declarative WebMCP forms.

`progressive-webmcp` adds declarative WebMCP attributes to existing HTML forms. It is intentionally small: by default it only adds `toolname` and `tooldescription` to forms. It does not duplicate field descriptions, because WebMCP can already infer parameters from normal form fields, labels, types, and constraints.

Use it when you want to make existing forms more agent-ready without rewriting templates or replacing your current frontend.

## What it does

By default, the helper:

- finds all forms on the page
- adds a safe generated `toolname`
- adds a `tooldescription` from config, `data-*`, `aria-label`, heading, legend, or submit button text
- respects existing WebMCP attributes
- does not add `toolautosubmit` unless configured
- does not add field descriptions unless configured

## What it does not do

It does not replace HTML semantics. Good labels, names, input types, validation attributes, and accessible form structure still matter.

It also does not truly remove named fields from the WebMCP schema. A field config value of `false` only prevents this helper from adding extra field metadata. If a field should not be exposed as a normal form parameter, solve that in the actual HTML and form design.

## Basic usage

```html
<script src="progressive-webmcp.js" defer data-progressive-webmcp-auto></script>
```

Example input:

```html
<form id="site-search" action="/search" method="get">
  <label for="q">Search term</label>
  <input id="q" name="q">
  <button>Search</button>
</form>
```

After enhancement, the form is similar to:

```html
<form
  id="site-search"
  action="/search"
  method="get"
  toolname="site_search"
  tooldescription="Submit form: Search">
  <label for="q">Search term</label>
  <input id="q" name="q">
  <button>Search</button>
</form>
```

## Manual initialization

```html
<script src="progressive-webmcp.js" defer></script>
<script>
  window.addEventListener('DOMContentLoaded', () => {
    progressiveWebMcp();
  });
</script>
```

## Configured usage

```js
progressiveWebMcp({
  autoSubmit: false,

  forms: {
    '#report-search': {
      name: 'search_reports',
      description: 'Searches public reports by keyword, year, and category.',
      autoSubmit: true,

      fields: {
        q: 'Full-text search term.',
        year: 'Publication year as a four-digit number.',
        category: 'Report category.'
      }
    }
  }
});
```

## Auto-submit

`toolautosubmit` is disabled by default.

Enable it only for safe forms, such as search and filter forms:

```js
progressiveWebMcp({
  autoSubmit: 'get'
});
```

Supported values:

| Value | Meaning |
| --- | --- |
| `false` | Never add `toolautosubmit` automatically. |
| `true` | Add `toolautosubmit` to all enhanced forms. |
| `'get'` | Add `toolautosubmit` only to GET forms. |
| function | Custom decision per form. |

## Field descriptions

By default, field descriptions are only added when configured explicitly.

```js
progressiveWebMcp({
  forms: {
    '#search': {
      fields: {
        q: 'Full-text search term.',
        year: { description: 'Publication year as a four-digit number.' }
      }
    }
  }
});
```

You can also set descriptions directly in HTML:

```html
<input
  id="year"
  name="year"
  data-webmcp-param-description="Publication year as a four-digit number.">
```

If you really want to generate `toolparamdescription` for every field, use:

```js
progressiveWebMcp({
  describeFields: 'all'
});
```

This is not recommended as the default, because WebMCP can already use native labels and form semantics.

## Ignore forms or fields

Ignore a full form:

```html
<form data-webmcp-ignore>
  ...
</form>
```

Prevent this helper from adding extra field metadata:

```html
<input name="internal_id" data-webmcp-field-ignore>
```

Again, this does not remove the field from the browser's understanding of the form. It only prevents `progressive-webmcp` from adding metadata to that field.

## Data attributes

Set metadata directly on a form:

```html
<form
  data-webmcp-name="search_reports"
  data-webmcp-description="Searches public reports."
  data-webmcp-autosubmit="true">
  ...
</form>
```

Available attributes:

| Attribute | Purpose |
| --- | --- |
| `data-webmcp-ignore` | Ignore the form completely. |
| `data-webmcp-name` | Tool name for this form. |
| `data-webmcp-description` | Tool description for this form. |
| `data-webmcp-autosubmit="true"` | Add `toolautosubmit` to this form. |
| `data-webmcp-autosubmit="false"` | Do not add `toolautosubmit` to this form. |
| `data-webmcp-autosubmit="get"` | Add `toolautosubmit` only if this form uses GET. |
| `data-webmcp-param-description` | Explicit field description. |
| `data-webmcp-field-ignore` | Do not add extra field metadata. |

## Options

```js
progressiveWebMcp({
  root: document,
  formSelector: 'form',
  fieldSelector: 'input[name], select[name], textarea[name]',
  ignoreFormSelector: '[data-webmcp-ignore]',
  ignoreFieldSelector: '[data-webmcp-field-ignore], input[type="hidden"], input[type="submit"], input[type="button"], input[type="reset"], input[type="image"]',
  overwrite: false,
  autoSubmit: false,
  describeFields: 'configured',
  observe: false,
  defaultToolNamePrefix: 'form',
  forms: {}
});
```

## API

### `progressiveWebMcp(options)`

Convenience function. Creates an instance and calls `.init()`.

```js
const instance = progressiveWebMcp();
```

### `new ProgressiveWebMcp(options)`

Class API for more control.

```js
const webmcp = new ProgressiveWebMcp({
  autoSubmit: 'get'
});

webmcp.init();
```

### `.refresh(root)`

Enhance forms again. Useful after content was added dynamically.

```js
webmcp.refresh();
```

### `.observe(root)`

Start watching dynamically added content.

```js
webmcp.observe();
```

### `.disconnect()`

Stop the mutation observer.

```js
webmcp.disconnect();
```

### `.destroy()`

Remove attributes that were added by this helper and stop observing.

```js
webmcp.destroy();
```

## Recommended use

Prefer static HTML attributes when you control the template:

```html
<form
  toolname="search_reports"
  tooldescription="Searches public reports by keyword and year.">
  ...
</form>
```

Use `progressive-webmcp` when you want progressive enhancement for existing forms, CMS output, legacy templates, or many pages at once.

## Security notes

Be conservative with `toolautosubmit`.

Good candidates:

- search forms
- filter forms
- read-only lookup forms

Avoid automatic submit for:

- contact forms
- account changes
- bookings
- purchases
- delete actions
- forms that change server-side state

## Browser support

WebMCP is an emerging browser feature. This helper only adds HTML attributes; it does not polyfill WebMCP agent behavior. In browsers without WebMCP support, the forms continue to work normally.
