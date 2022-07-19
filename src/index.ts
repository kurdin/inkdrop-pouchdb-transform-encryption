import { InkdropEncryption, EncryptError, DecryptError } from 'inkdrop-crypto'
import logger from './logger'
import { NOTE_VISIBILITY } from 'inkdrop-model'
import { Disposable, Emitter } from 'event-kit'
type InternalProps = {
  key?: string
}
const map = new WeakMap()

const privateProps = function(object: Record<string, any>): InternalProps {
  if (!map.has(object)) map.set(object, {})
  return map.get(object) || {}
}

export type TransformErrorDetail = {
  error: Error
  doc: Record<string, any>
}
export type TransformErrorCallback = (detail: TransformErrorDetail) => any
export type CustomTransformer = {
  incoming: (
    doc: Record<string, any>
  ) => Promise<Record<string, any>> | Record<string, any>
  outgoing: (
    doc: Record<string, any>
  ) => Promise<Record<string, any>> | Record<string, any>
}
export default class E2EETransformer {
  emitter: Emitter
  crypto: InkdropEncryption

  constructor(crypto: InkdropEncryption) {
    this.crypto = crypto
    this.emitter = new Emitter()
  }

  setKey(key: string) {
    if (typeof key === 'string' && key.match(/^[a-zA-Z0-9+/=]{32}$/)) {
      privateProps(this).key = key
    } else {
      throw new Error(`Invalid encryption key: ${key}`)
    }
  }

  getRemoteTransformer: (...args: Array<any>) => any = (
    customTransformer: CustomTransformer | null | undefined
  ): Record<string, any> => {
    const { incoming: customIncoming, outgoing: customOutgoing } =
      customTransformer || {}
    return {
      incoming: async (doc: Record<string, any>) => {
        try {
          const { key } = privateProps(this)
          if (!key) throw new EncryptError('No encryption key')

          if (customIncoming) {
            doc = await customIncoming(doc)
          }

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
            if (doc.share === NOTE_VISIBILITY.PUBLIC) {
              logger.debug(
                'The note is shared in public. Skip encrypting:',
                doc._id
              )
              return doc
            } else {
              logger.debug('Encrypting doc:', doc._id)
              return this.crypto.encryptDoc(key, doc)
            }
          } else {
            return doc
          }
        } catch (e: any) {
          logger.error(e.stack)
          this.emitter.emit('error:encryption', {
            error: e,
            doc
          })
          throw e
        }
      },
      outgoing: async (doc: Record<string, any>) => {
        try {
          const { key } = privateProps(this)
          if (!key) throw new DecryptError('No encryption key')
          let decryptedDoc: Record<string, any>

          if (doc._id.startsWith('file:')) {
            logger.debug('Decrypting file:', doc._id)

            if (doc._attachments && doc._attachments.index) {
              if (doc._attachments.index.stub) {
                decryptedDoc = doc
              } else {
                decryptedDoc = await this.crypto.decryptFile(key, doc)
              }
            } else {
              decryptedDoc = doc
            }
          } else if (
            doc._id.startsWith('note:') ||
            doc._id.startsWith('book:') ||
            doc._id.startsWith('tag:')
          ) {
            logger.debug('Decrypting doc:', doc._id)
            decryptedDoc = await this.crypto.decryptDoc(key, doc)
          } else {
            decryptedDoc = doc
          }

          return customOutgoing ? customOutgoing(decryptedDoc) : decryptedDoc
        } catch (e: any) {
          logger.error(e.stack)
          this.emitter.emit('error:decryption', {
            error: e,
            doc
          })
          throw e
        }
      }
    }
  }
  getLocalTransformer: (...args: Array<any>) => any = (): Record<
    string,
    any
  > => {
    return {
      incoming: async (doc: Record<string, any>) => {
        try {
          const { key } = privateProps(this)
          if (!key) throw new EncryptError('No encryption key')

          if (doc._id.startsWith('file:')) {
            if (doc._attachments && doc._attachments.index) {
              if (doc._attachments.index.stub) {
                return doc
              } else {
                logger.debug('Decrypting local file:', doc._id)
                return this.crypto.decryptFile(key, doc)
              }
            } else {
              return doc
            }
          } else {
            return doc
          }
        } catch (e: any) {
          logger.error(e.stack)
          this.emitter.emit('error:decryption', {
            error: e,
            doc
          })
          throw e
        }
      }
    }
  }

  onEncryptionError(callback: TransformErrorCallback): Disposable {
    return this.emitter.on('error:encryption', callback)
  }

  onDecryptionError(callback: TransformErrorCallback): Disposable {
    return this.emitter.on('error:decryption', callback)
  }
}
