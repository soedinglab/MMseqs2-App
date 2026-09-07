<script>
import axios from 'axios'
import { structureRemarkLine } from './lib/structureRemark.js'

export default {
    name : 'AllAtomPredictMixin',
    data() {
        return {
            predictApi: axios.create({
                baseURL: 'https://3di.foldseek.com/cg2all/predict',
                responseType: 'text',
                transformResponse: [(data) => data],
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'Accept': 'text/plain',
                }
            })
        }
    },
    methods: {
        async predictGivenPdb(pdbstr, signal=undefined) {
            const formData = new FormData()
            const blob = new Blob([pdbstr], {type: 'text/plain'})
            formData.append('file', blob, 'tmp.pdb')

            try {
                const response = await this.predictApi.post('', formData, {
                    signal: signal ? signal : undefined,
                    responseType: 'text'
                })
                return this.prependRemark(response.data)
            } catch (e) {
                if (e.response) {
                    console.error('Server error: ', e.response.status, e.response.data);
                } else if (e.request) {
                    console.error('No response: ', e.request);
                } else if (axios.isCancel(e)) {
                    console.error('Aborted');
                } else {
                    console.error('Config error: ', e.message);
                }
                throw e
            }
        },
        prependRemark(pdbstr) {
            return structureRemarkLine(
                pdbstr, 'This model is rebuilt with cg2all(https://github.com/huhlim/cg2all)', 90
            ) + '\n' + pdbstr
        },
    }
}
</script>
