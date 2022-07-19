import PouchDB from 'pouchdb'
import express from 'express'
import memdown from 'memdown'
import createEncryptHelperForNode from 'inkdrop-crypto'
import E2EETransformer from '../src/'
import axios from 'axios'
import TransformPouch from '@craftzdog/transform-pouch'
import InMemAdapter from 'pouchdb-adapter-memory'
import ExpressPouchDB from 'express-pouchdb'
import type { MaskedEncryptionKey } from 'inkdrop-crypto'
global.require = require
PouchDB.plugin(TransformPouch)
PouchDB.plugin(InMemAdapter)
const InMemPouchDB = PouchDB.defaults({
  db: memdown
})
const serverPort = parseInt(process.env.PORT || '3005')

const pouchDBServer = ExpressPouchDB(InMemPouchDB, {
  inMemoryConfig: true
})

const server = express()
const local = new PouchDB('local', {
  adapter: 'memory'
})
const crypto = createEncryptHelperForNode()
const pass = 'foo'
let keyMasked: MaskedEncryptionKey
let key: string
const dbUrl = `http://localhost:${serverPort}/user-test`
const remote = new PouchDB(dbUrl)

// Prepare crypto
beforeAll(async () => {
  keyMasked = await crypto.createEncryptionKey(pass, 128)
  key = await crypto.revealEncryptionKey(pass, keyMasked)
  expect(typeof keyMasked).toBe('object')
  expect(typeof key).toBe('string')
})
// PouchDB loaded
beforeAll(() => {
  expect(typeof remote).toBe('object')
  expect(typeof local).toBe('object')
})
// Launch PouchDB server
beforeAll(async () => {
  server.use('/', pouchDBServer)
  server.listen(serverPort)
})
test('Initialize transformer', async () => {
  const transformer = new E2EETransformer(crypto)
  expect(typeof transformer).toBe('object')
  transformer.setKey(key)
  remote.transform(transformer.getRemoteTransformer())
  local.transform(transformer.getLocalTransformer())
})
test('Encrypt note', async () => {
  await remote.bulkDocs([
    {
      doctype: 'markdown',
      updatedAt: 1476012356532,
      createdAt: 1475495470542,
      tags: [],
      bookId: 'book:Sy8EUpkA',
      title: 'Welcome',
      body: 'For help, please visit:\n\n * The [Inkdrop docs](https://docs.inkdrop.app/) for Guides and the API reference.\n * The Inkdrop forum at [github](https://github.com/inkdropapp/forum). Please report issue or suggest feedback here.\n * The [Inkdropapp org](https://github.com/inkdropapp/). This is where all Inkdrop-created packages can be found.\n\n* * *\n\n### Get to know Inkdrop 🚀\n\n * [👀 Check a note example](inkdrop://note:example)\n * [📓 Create a notebook](command://core:new-book)\n * [✍️ Create a note](command://core:new-note)\n',
      status: 'none',
      migratedBy: null,
      _id: 'note:welcome'
    }
  ])
  const { data: encrypted } = await axios.get(`${dbUrl}/note:welcome`)
  expect(typeof encrypted).toBe('object')
  expect(typeof encrypted.encryptedData).toBe('object')
  expect(encrypted.encryptedData.algorithm).toBe('aes-256-gcm')
  expect(typeof encrypted.encryptedData.content).toBe('string')
  expect(typeof encrypted.encryptedData.iv).toBe('string')
  expect(typeof encrypted.encryptedData.tag).toBe('string')
  expect(typeof encrypted.title).toBe('undefined')
  expect(typeof encrypted.body).toBe('undefined')
  const plain = await remote.get('note:welcome')
  expect(typeof plain.title).toBe('string')
  expect(typeof plain.body).toBe('string')
})
test('Encrypt book', async () => {
  await remote.bulkDocs([
    {
      updatedAt: 1475495470492,
      createdAt: 1475495470493,
      count: 0,
      name: 'First Notebook',
      _id: 'book:Sy8EUpkA'
    }
  ])
  const { data: encrypted } = await axios.get(`${dbUrl}/book:Sy8EUpkA`)
  expect(typeof encrypted).toBe('object')
  expect(typeof encrypted.encryptedData).toBe('object')
  expect(encrypted.encryptedData.algorithm).toBe('aes-256-gcm')
  expect(typeof encrypted.encryptedData.content).toBe('string')
  expect(typeof encrypted.encryptedData.iv).toBe('string')
  expect(typeof encrypted.encryptedData.tag).toBe('string')
  expect(typeof encrypted.name).toBe('undefined')
  const plain = await remote.get('book:Sy8EUpkA')
  expect(typeof plain.name).toBe('string')
})
test('Encrypt tag', async () => {
  await remote.bulkDocs([
    {
      count: 1,
      color: 'red',
      name: 'P1: high',
      _id: 'tag:HyBgJ94gx'
    }
  ])
  const { data: encrypted } = await axios.get(`${dbUrl}/tag:HyBgJ94gx`)
  expect(typeof encrypted).toBe('object')
  expect(typeof encrypted.encryptedData).toBe('object')
  expect(encrypted.encryptedData.algorithm).toBe('aes-256-gcm')
  expect(typeof encrypted.encryptedData.content).toBe('string')
  expect(typeof encrypted.encryptedData.iv).toBe('string')
  expect(typeof encrypted.encryptedData.tag).toBe('string')
  expect(typeof encrypted.name).toBe('undefined')
  const plain = await remote.get('tag:HyBgJ94gx')
  expect(typeof plain.name).toBe('string')
})
test('Encrypt file', async () => {
  const srcFile = {
    _id: 'file:test',
    name: 'test.txt',
    contentType: 'image/png',
    contentLength: 13,
    createdAt: +new Date(),
    publicIn: [],
    _attachments: {
      index: {
        content_type: 'image/png',
        data: 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAZ5JREFUeNrEVottgzAQJRPQDUgnoBu4nYBu4GyQbuBuQDcgG6QbkE5AMwHZgHYCepbOlWX5d9gQS09CYHznu3t3ryjSVg1gxR1XDxjuZbwBzAi+9JBdggMj4AL4ARwAe8DvVrcXgAlQAUp8FlsZrywGj5iKagsHOgx/aUnJeW3jDG/aeL6xtWnXB76PaxnneMM6UB8z1kRWGsp8fwNugPfA3jfAc25aCq3pxKLNSbvZwnPu6YQiJy3PlsJSzadFTGvR0kUtoRl1dcIstBwstFMp6fBwhs+2kCdNS+451FV4LmfJ01LPcWxYXd9cNeJdSwsrVLAk2pndLGbipfzrLRzKzBeO6A2BOfK/bOFqCZRijk6o0kpSO0r5zviuj4zgZAyuiqKaSiykzkgJi6AU1yKlh9wlYoKK1wy97yDTcWac0VDHcY9jVY7gE757wHH7ieNZX0+AV8AHKuVCU8tSPb9QHag1DXBb2E33COncNacApXTTLmUYpWh+saQF+9QQRVxEa8NYTThiHVwi9ytN+JjLARYhRs0l93+FNv0JMADG1qTgmYgmzwAAAABJRU5ErkJggg=='
      }
    }
  }
  await remote.bulkDocs([srcFile])
  const { data: encrypted } = await axios.get(
    `${dbUrl}/file:test?attachments=true`,
    {
      headers: {
        accept: 'application/json'
      }
    }
  )
  expect(typeof encrypted).toBe('object')
  expect(typeof encrypted.encryptionData).toBe('object')
  expect(encrypted.encryptionData.algorithm).toBe('aes-256-gcm')
  expect(typeof encrypted.encryptionData.iv).toBe('string')
  expect(typeof encrypted.encryptionData.tag).toBe('string')
  expect(typeof encrypted._attachments.index.data).toBe('string')
  expect(encrypted.name).toBe(srcFile.name)
  const plain = await remote.get('file:test', {
    attachments: true
  })
  expect(typeof plain.name).toBe('string')
  expect(typeof plain.encryptionData).toBe('undefined')
  expect(plain._attachments.index.data).toBe(srcFile._attachments.index.data)
})
test('Sync', async () => {
  local.transform({
    incoming: (doc: Record<string, any>) => {
      console.log('Store doc in local', doc)
      return doc
    }
  })
  await new Promise((resolve, reject) => {
    local.replicate
      .from(remote, {
        live: false
      })
      .on('complete', resolve)
      .on('error', (err: any) => {
        console.log('Failed to replicate from remote:', err)
        reject(err)
      })
  })
  const plain = await local.get('note:welcome')
  expect(typeof plain.title).toBe('string')
  expect(typeof plain.body).toBe('string')
  expect(typeof plain.encryptedData).toBe('undefined')
  const plainFile = await local.get('file:test', {
    attachments: true
  })
  expect(typeof plainFile.name).toBe('string')
  expect(typeof plainFile.encryptionData).toBe('undefined')
  expect(typeof plainFile._attachments.index.data).toBe('string')
  const srcFile = {
    _id: 'file:test2',
    name: 'test.png',
    contentType: 'image/png',
    contentLength: 13,
    createdAt: +new Date(),
    publicIn: [],
    _attachments: {
      index: {
        content_type: 'image/png',
        data: 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAZ5JREFUeNrEVottgzAQJRPQDUgnoBu4nYBu4GyQbuBuQDcgG6QbkE5AMwHZgHYCepbOlWX5d9gQS09CYHznu3t3ryjSVg1gxR1XDxjuZbwBzAi+9JBdggMj4AL4ARwAe8DvVrcXgAlQAUp8FlsZrywGj5iKagsHOgx/aUnJeW3jDG/aeL6xtWnXB76PaxnneMM6UB8z1kRWGsp8fwNugPfA3jfAc25aCq3pxKLNSbvZwnPu6YQiJy3PlsJSzadFTGvR0kUtoRl1dcIstBwstFMp6fBwhs+2kCdNS+451FV4LmfJ01LPcWxYXd9cNeJdSwsrVLAk2pndLGbipfzrLRzKzBeO6A2BOfK/bOFqCZRijk6o0kpSO0r5zviuj4zgZAyuiqKaSiykzkgJi6AU1yKlh9wlYoKK1wy97yDTcWac0VDHcY9jVY7gE757wHH7ieNZX0+AV8AHKuVCU8tSPb9QHag1DXBb2E33COncNacApXTTLmUYpWh+saQF+9QQRVxEa8NYTThiHVwi9ytN+JjLARYhRs0l93+FNv0JMADG1qTgmYgmzwAAAABJRU5ErkJggg=='
      }
    }
  }
  await local.put(srcFile)
  await new Promise((resolve, reject) => {
    local.replicate
      .to(remote, {
        live: false
      })
      .on('complete', resolve)
      .on('error', err => {
        console.log('Failed to replicate to remote:', err)
        reject(err)
      })
  })
  const { data: encrypted } = await axios.get(
    `${dbUrl}/file:test2?attachments=true`,
    {
      headers: {
        accept: 'application/json'
      }
    }
  )
  expect(typeof encrypted).toBe('object')
  expect(typeof encrypted.encryptionData).toBe('object')
  expect(encrypted.encryptionData.algorithm).toBe('aes-256-gcm')
  expect(typeof encrypted.encryptionData.iv).toBe('string')
  expect(typeof encrypted.encryptionData.tag).toBe('string')
  expect(typeof encrypted._attachments.index.data).toBe('string')
  expect(encrypted.name).toBe(srcFile.name)
  expect(encrypted._attachments.index.data).not.toBe(
    srcFile._attachments.index.data
  )
  const { data } = await axios.get(
    `${dbUrl}/_all_docs?include_docs=true&attachments=true`,
    {
      headers: {
        accept: 'application/json'
      }
    }
  )
  console.log(
    'All docs in remote:',
    data.rows.map(row => row.doc)
  )
})
