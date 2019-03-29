// @flow
import { InkdropEncryption, EncryptError, DecryptError } from 'inkdrop-crypto'
import logger from './logger'

type InternalProps = {
  key?: string
}
const map = new WeakMap()
const privateProps = function(object: Object): InternalProps {
  if (!map.has(object)) map.set(object, {})
  return map.get(object) || {}
}

export default class E2EETransformer {
  crypto: InkdropEncryption

  constructor(crypto: InkdropEncryption) {
    this.crypto = crypto
  }
  setKey(key: string) {
    privateProps(this).key = key
  }

  getRemoteTransformer = () => {
    return {
      incoming: (doc: Object) => {
        const { key } = privateProps(this)
        if (!key) throw new EncryptError('No encryption key')
        if (doc._id.startsWith('file:')) {
          if (doc.publicIn && doc.publicIn.length > 0) {
            logger.debug('The file is in public. Skip encrypting:', doc._id)
            return doc
          } else {
            logger.debug('Encrypting file:', doc._id)
            return this.crypto.encryptFile(key, doc)
          }
        } else if (
          doc._id.startsWith('note:') ||
          doc._id.startsWith('book:') ||
          doc._id.startsWith('tag:')
        ) {
          logger.debug('Encrypting doc:', doc._id)
          return this.crypto.encryptDoc(key, doc)
        } else {
          return doc
        }
      },

      outgoing: (doc: Object) => {
        const { key } = privateProps(this)
        if (!key) throw new DecryptError('No encryption key')
        if (doc._id.startsWith('file:')) {
          logger.debug('Decrypting file:', doc._id)
          if (doc._attachments && doc._attachments.index) {
            if (doc._attachments.index.stub) {
              return doc
            } else {
              return this.crypto.decryptFile(key, doc)
            }
          } else {
            return doc
          }
        } else if (
          doc._id.startsWith('note:') ||
          doc._id.startsWith('book:') ||
          doc._id.startsWith('tag:')
        ) {
          logger.debug('Decrypting doc:', doc._id)
          return this.crypto.decryptDoc(key, doc)
        } else {
          return doc
        }
      }
    }
  }

  getLocalTransformer = () => {
    return {
      incoming: (doc: Object) => {
        const { key } = privateProps(this)
        if (!key) throw new EncryptError('No encryption key')
        if (doc._id.startsWith('file:')) {
          logger.debug('Decrypting local file:', doc._id)
          if (doc._attachments && doc._attachments.index) {
            if (doc._attachments.index.stub) {
              return doc
            } else {
              return this.crypto.decryptFile(key, doc)
            }
          } else {
            return doc
          }
        } else {
          return doc
        }
      }
    }
  }
}
