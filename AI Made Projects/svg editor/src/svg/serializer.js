import { removeEditorIds } from './document-dom.js';

export function serializeSvg(svgRoot) {
    return prettyPrintNode(removeEditorIds(svgRoot.cloneNode(true)), 0).trim();
}

export function getElementSourceMarker(element) {
    if (!element) {
        return null;
    }

    return prettyPrintNode(removeEditorIds(element.cloneNode(true)), 0).trim();
}

function prettyPrintNode(node, depth) {
    if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent ?? '';
        return text.trim() ? `${indent(depth)}${text.trim()}\n` : '';
    }

    if (node.nodeType === Node.COMMENT_NODE) {
        return `${indent(depth)}<!--${node.textContent ?? ''}-->\n`;
    }

    if (!(node instanceof Element)) {
        return '';
    }

    const tagName = node.tagName;
    const attributes = Array.from(node.attributes)
        .map((attribute) => `${attribute.name}="${escapeXml(attribute.value)}"`)
        .join(' ');
    const opening = `${indent(depth)}<${tagName}${attributes ? ` ${attributes}` : ''}`;

    if (tagName.toLowerCase() === 'style') {
        const content = node.textContent ?? '';
        return `${opening}>${content}</${tagName}>\n`;
    }

    const childNodes = Array.from(node.childNodes);
    if (childNodes.length === 0) {
        return `${opening} />\n`;
    }

    if (childNodes.length === 1 && childNodes[0].nodeType === Node.TEXT_NODE) {
        const text = escapeXml(childNodes[0].textContent ?? '');
        return `${opening}>${text}</${tagName}>\n`;
    }

    const children = childNodes
        .map((child) => prettyPrintNode(child, depth + 1))
        .join('');

    return `${opening}>\n${children}${indent(depth)}</${tagName}>\n`;
}

function indent(depth) {
    return '  '.repeat(depth);
}

function escapeXml(value) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}
