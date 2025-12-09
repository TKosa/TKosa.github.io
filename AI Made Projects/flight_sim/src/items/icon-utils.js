const TEXT_PREFIX = 'text:';

const trimString = (value) => (typeof value === 'string' ? value.trim() : '');

const createDescriptor = (type, value) => {
    if (!value) {
        return null;
    }
    return { type, value };
};

const parseIconValue = (value, { forceText = false } = {}) => {
    if (!value) {
        return null;
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }

        if (forceText) {
            return createDescriptor('text', trimmed);
        }

        if (trimmed.startsWith(TEXT_PREFIX)) {
            const payload = trimmed.slice(TEXT_PREFIX.length).trim();
            return createDescriptor('text', payload);
        }

        return createDescriptor('image', trimmed);
    }

    if (typeof value === 'object') {
        const type = value?.type;
        const payload = trimString(value?.value);
        if (!payload) {
            return null;
        }

        if (type === 'text') {
            return createDescriptor('text', payload);
        }
        if (type === 'image') {
            return createDescriptor('image', payload);
        }
    }

    return null;
};

export const getIconDescriptor = (item, { fallbackToId = false } = {}) => {
    if (!item) {
        return null;
    }

    if (typeof item === 'string') {
        if (fallbackToId) {
            const fallbackId = trimString(item);
            if (fallbackId) {
                return createDescriptor('image', fallbackId);
            }
        }
        return null;
    }

    const descriptor =
        parseIconValue(item.icon) ??
        parseIconValue(item.iconText, { forceText: true }) ??
        parseIconValue(item.iconChar, { forceText: true });

    if (descriptor) {
        return descriptor;
    }

    if (fallbackToId) {
        const fallbackId = trimString(item.id);
        if (fallbackId) {
            return createDescriptor('image', fallbackId);
        }
    }

    return null;
};

export const getIconToken = (item, options = {}) => {
    const descriptor = getIconDescriptor(item, options);
    if (!descriptor) {
        return '';
    }
    return descriptor.type === 'image'
        ? `img:${descriptor.value}`
        : descriptor.value;
};

export const getIconSignature = (item, options = {}) => {
    const descriptor = getIconDescriptor(item, options);
    if (!descriptor) {
        return '';
    }
    return `${descriptor.type}:${descriptor.value}`;
};

