import { removeEditorIds } from './document-dom.js';

export function parseSvgString(source) {
    const parser = new DOMParser();
    const documentNode = parser.parseFromString(source, 'image/svg+xml');
    const root = documentNode.documentElement;

    if (!root || root.tagName.toLowerCase() !== 'svg') {
        throw new Error('File does not contain a valid SVG root.');
    }

    const parserError = root.querySelector('parsererror');
    if (parserError) {
        throw new Error('Unable to parse SVG source.');
    }

    return removeEditorIds(root.cloneNode(true));
}
