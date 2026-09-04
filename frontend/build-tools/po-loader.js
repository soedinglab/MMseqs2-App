const parsePo = require('./po-reader');

module.exports = function (source) {
    var result = parsePo(source);
    // const logger = this.getLogger('po-loader');
    // logger.error(result);
    return `export default ${JSON.stringify(result.translations)}`;
}
