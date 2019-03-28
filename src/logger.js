// @flow
import debug from 'debug'
const logger = {}

logger.debug = debug('inkdrop-crypto:debug')
logger.info = debug('inkdrop-crypto:info')
logger.error = debug('inkdrop-crypto:error')

export default logger
