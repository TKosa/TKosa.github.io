# Vector Workshop

Lightweight browser-based SVG editor focused on preserving imported SVG fidelity while allowing direct interaction with selected elements.

## What It Does

- Imports arbitrary SVG and lets the browser render it natively
- Selects common visual elements like `rect`, `circle`, `ellipse`, `line`, `text`, `path`, `polygon`, `polyline`, and `g`
- Drags selected elements on the canvas
- Edits the selected element's real SVG attributes in a property panel
- Keeps a live SVG source textarea synchronized with the canvas
- Exports the current SVG
- Supports duplicate/delete and `Ctrl+C` / `Ctrl+V` duplication

## Run It

From this folder:

```powershell
py -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

If `py` is not available:

```powershell
python -m http.server 8000
```

## Architecture

The app is intentionally SVG-native.

- The live SVG DOM is the source of truth
- The browser handles actual SVG rendering
- The editor adds interaction on top of selected elements
- Unknown SVG markup is preserved instead of being translated into a custom internal graphics model

Core files:

- `src/app/editor-app.js`: application bootstrap, controller composition, and app-level command wiring
- `src/app/editor-commands.js`: editor commands shared by the toolbar and keyboard shortcuts
- `src/state/document-model.js`: store lifecycle and SVG mutation orchestration
- `src/svg/document-dom.js`: SVG DOM construction, lookup helpers, and editor-id management
- `src/svg/element-operations.js`: duplication, clipboard insertion, and transform/position mutations
- `src/svg/parser.js` and `src/svg/serializer.js`: import/export and source-marker generation
- `src/ui/canvas-controller.js`: rendering into the visible canvas, drag behavior, zoom, selection box
- `src/ui/property-panel.js`: generic attribute editor for the selected element
- `src/ui/source-controller.js`: debounced source sync and source scrolling/highlighting
- `src/ui/toolbar-controller.js`: toolbar and document-size inputs bound to shared editor commands

## Current Behavior

- Selecting an element shows a dashed blue selection box
- Selection also scrolls the source textarea to the matching element
- When an edit changes the source, the changed element block is briefly selected with yellow textarea highlight
- Pasted duplicates receive fresh integer SVG `id` values

## Limitations

- The property panel is generic, but not every SVG construct has specialized editing UX
- Dragging is implemented directly against element attributes/transforms and is basic for complex SVG structures
- Animated SVG is preserved, but there is no animation-aware editing logic
- Selection bounds are overlay-based and may be imperfect for some edge cases involving complex filters/masks/clipping

## Why This Approach

This editor does not try to be Figma or maintain a full custom scene graph.

That is deliberate. For real SVG files, preserving the original markup and letting the browser render it is much more robust than trying to re-model the full SVG feature set internally.
