import { gzip } from 'pako';

export function AxiosCompressRequest(axios) {
    return axios.defaults.transformRequest.concat(
        (data, headers) => {
            if (typeof data === 'string' && data.length > 1024) {
                headers['Content-Encoding'] = 'gzip';
                return gzip(data);
            } else {
                headers['Content-Encoding'] = undefined;
                return data;
            }
        }
    )
}