export const SVG_NS = 'http://www.w3.org/2000/svg';

export const DEFAULT_DOCUMENT = {
    width: 960,
    height: 640,
    background: '#fffdf8'
};

export const SHAPE_DEFINITIONS = {
    g: {
        label: 'Group',
        defaults: {
            elementId: '',
            opacity: 1,
            fill: 'none',
            stroke: 'none',
            strokeWidth: 0
        }
    },
    rect: {
        label: 'Rectangle',
        defaults: {
            elementId: '',
            x: 120,
            y: 100,
            width: 180,
            height: 120,
            rx: 18,
            fill: '#d9663d',
            stroke: '#1f1b16',
            strokeWidth: 2,
            opacity: 1
        }
    },
    circle: {
        label: 'Circle',
        defaults: {
            elementId: '',
            cx: 240,
            cy: 180,
            r: 72,
            fill: '#f2c14f',
            stroke: '#1f1b16',
            strokeWidth: 2,
            opacity: 1
        }
    },
    ellipse: {
        label: 'Ellipse',
        defaults: {
            elementId: '',
            cx: 260,
            cy: 190,
            rx: 100,
            ry: 64,
            fill: '#5aa89b',
            stroke: '#1f1b16',
            strokeWidth: 2,
            opacity: 1
        }
    },
    line: {
        label: 'Line',
        defaults: {
            elementId: '',
            x1: 120,
            y1: 120,
            x2: 340,
            y2: 260,
            stroke: '#1f1b16',
            strokeWidth: 6,
            opacity: 1
        }
    },
    polygon: {
        label: 'Polygon',
        defaults: {
            elementId: '',
            points: '180,120 320,160 280,300 140,260',
            fill: '#5f8ef2',
            stroke: '#1f1b16',
            strokeWidth: 2,
            opacity: 1
        }
    },
    text: {
        label: 'Text',
        defaults: {
            elementId: '',
            x: 150,
            y: 180,
            content: 'Edit me',
            fill: '#1f1b16',
            stroke: 'none',
            strokeWidth: 0,
            opacity: 1,
            fontSize: 42,
            fontFamily: 'Space Grotesk, sans-serif',
            fontWeight: 700
        }
    }
};
