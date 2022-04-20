export function convertToQueryUrl(obj) {
    const params = new URLSearchParams(obj);
    for (const [key, value] of Object.entries(obj)) {
        if (Array.isArray(value)) {
            params.delete(key);
            value.forEach((v) => params.append(key + '[]', v));
        }
    }
    return params.toString();
}