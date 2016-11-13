<template>
    <tr>
        <td>{{ item.dbKey }}</td>
        <td>{{ item.seqId }}</td>
        <td>{{ item.score }}</td>
        <td>{{ item.eval }}</td>
        <td>{{ item.qStartPos }}-{{ item.qEndPos }}</td>
        <td>{{ item.dbStartPos }}-{{ item.dbEndPos }}</td>
        <td></td>
    </tr>
</template>

<script>
export default {
    name: 'search-result-item',
    props: ['item']
};
</script>