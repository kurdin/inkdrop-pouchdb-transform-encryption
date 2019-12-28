// @flow
import test from 'ava'
import PouchDB from 'pouchdb'
import express from 'express'
import memdown from 'memdown'
import createEncryptionHelper from 'inkdrop-crypto'
import E2EETransformer from '../src/'
import axios from 'axios'

PouchDB.plugin(require('transform-pouch'))
PouchDB.plugin(require('pouchdb-adapter-memory'))
const InMemPouchDB = PouchDB.defaults({ db: memdown })

const serverPort = parseInt(process.env.PORT) || 3005
const pouchDBServer = require('express-pouchdb')(InMemPouchDB, {
  inMemoryConfig: true
})
const server = express()

const local = new PouchDB('local', { adapter: 'memory' })

const crypto = createEncryptionHelper(require('crypto'))
const pass = 'foo'
const keyMasked = crypto.createEncryptionKey(pass, 128)
const key = crypto.revealEncryptionKey(pass, keyMasked)

const dbUrl = `http://localhost:${serverPort}/user-test`
const remote = new PouchDB(dbUrl)

test.before('PouchDB loaded', t => {
  t.is(typeof remote, 'object')
  t.is(typeof local, 'object')
})

test.before('Launch PouchDB server', async t => {
  server.use('/', pouchDBServer)
  server.listen(serverPort)
  t.pass()
})

test.serial('Initialize transformer', async t => {
  const transformer = new E2EETransformer(crypto)
  t.is(typeof transformer, 'object')
  transformer.setKey(key)
  remote.transform(transformer.getRemoteTransformer())
  local.transform(transformer.getLocalTransformer())
})

test.serial('Encrypt note', async t => {
  await remote.bulkDocs([
    {
      doctype: 'markdown',
      updatedAt: 1476012356532,
      createdAt: 1475495470542,
      tags: [],
      bookId: 'book:Sy8EUpkA',
      title: 'Welcome',
      body:
        'For help, please visit:\n\n * The [Inkdrop docs](https://docs.inkdrop.app/) for Guides and the API reference.\n * The Inkdrop forum at [github](https://github.com/inkdropapp/forum). Please report issue or suggest feedback here.\n * The [Inkdropapp org](https://github.com/inkdropapp/). This is where all Inkdrop-created packages can be found.\n\n* * *\n\n### Get to know Inkdrop 🚀\n\n * [👀 Check a note example](inkdrop://note:example)\n * [📓 Create a notebook](command://core:new-book)\n * [✍️ Create a note](command://core:new-note)\n',
      status: 'none',
      migratedBy: null,
      _id: 'note:welcome'
    }
  ])
  const { data: encrypted } = await axios.get(`${dbUrl}/note:welcome`)
  t.is(typeof encrypted, 'object')
  t.is(typeof encrypted.encryptedData, 'object')
  t.is(encrypted.encryptedData.algorithm, 'aes-256-gcm')
  t.is(typeof encrypted.encryptedData.content, 'string')
  t.is(typeof encrypted.encryptedData.iv, 'string')
  t.is(typeof encrypted.encryptedData.tag, 'string')
  t.is(typeof encrypted.title, 'undefined')
  t.is(typeof encrypted.body, 'undefined')

  const plain = await remote.get('note:welcome')
  t.is(typeof plain.title, 'string')
  t.is(typeof plain.body, 'string')
})

test.serial('Encrypt book', async t => {
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
  t.is(typeof encrypted, 'object')
  t.is(typeof encrypted.encryptedData, 'object')
  t.is(encrypted.encryptedData.algorithm, 'aes-256-gcm')
  t.is(typeof encrypted.encryptedData.content, 'string')
  t.is(typeof encrypted.encryptedData.iv, 'string')
  t.is(typeof encrypted.encryptedData.tag, 'string')
  t.is(typeof encrypted.name, 'undefined')

  const plain = await remote.get('book:Sy8EUpkA')
  t.is(typeof plain.name, 'string')
})

test.serial('Encrypt tag', async t => {
  await remote.bulkDocs([
    {
      count: 1,
      color: 'red',
      name: 'P1: high',
      _id: 'tag:HyBgJ94gx'
    }
  ])
  const { data: encrypted } = await axios.get(`${dbUrl}/tag:HyBgJ94gx`)
  t.is(typeof encrypted, 'object')
  t.is(typeof encrypted.encryptedData, 'object')
  t.is(encrypted.encryptedData.algorithm, 'aes-256-gcm')
  t.is(typeof encrypted.encryptedData.content, 'string')
  t.is(typeof encrypted.encryptedData.iv, 'string')
  t.is(typeof encrypted.encryptedData.tag, 'string')
  t.is(typeof encrypted.name, 'undefined')

  const plain = await remote.get('tag:HyBgJ94gx')
  t.is(typeof plain.name, 'string')
})

test.serial('Encrypt file', async t => {
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
        data:
          'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAZ5JREFUeNrEVottgzAQJRPQDUgnoBu4nYBu4GyQbuBuQDcgG6QbkE5AMwHZgHYCepbOlWX5d9gQS09CYHznu3t3ryjSVg1gxR1XDxjuZbwBzAi+9JBdggMj4AL4ARwAe8DvVrcXgAlQAUp8FlsZrywGj5iKagsHOgx/aUnJeW3jDG/aeL6xtWnXB76PaxnneMM6UB8z1kRWGsp8fwNugPfA3jfAc25aCq3pxKLNSbvZwnPu6YQiJy3PlsJSzadFTGvR0kUtoRl1dcIstBwstFMp6fBwhs+2kCdNS+451FV4LmfJ01LPcWxYXd9cNeJdSwsrVLAk2pndLGbipfzrLRzKzBeO6A2BOfK/bOFqCZRijk6o0kpSO0r5zviuj4zgZAyuiqKaSiykzkgJi6AU1yKlh9wlYoKK1wy97yDTcWac0VDHcY9jVY7gE757wHH7ieNZX0+AV8AHKuVCU8tSPb9QHag1DXBb2E33COncNacApXTTLmUYpWh+saQF+9QQRVxEa8NYTThiHVwi9ytN+JjLARYhRs0l93+FNv0JMADG1qTgmYgmzwAAAABJRU5ErkJggg=='
      }
    }
  }
  await remote.bulkDocs([srcFile])
  const { data: encrypted } = await axios.get(
    `${dbUrl}/file:test?attachments=true`,
    {
      headers: { accept: 'application/json' }
    }
  )
  t.is(typeof encrypted, 'object')
  t.is(typeof encrypted.encryptionData, 'object')
  t.is(encrypted.encryptionData.algorithm, 'aes-256-gcm')
  t.is(typeof encrypted.encryptionData.iv, 'string')
  t.is(typeof encrypted.encryptionData.tag, 'string')
  t.is(typeof encrypted._attachments.index.data, 'string')
  t.is(encrypted.name, srcFile.name)

  const plain = await remote.get('file:test', { attachments: true })
  t.is(typeof plain.name, 'string')
  t.is(typeof plain.encryptionData, 'undefined')
  t.is(plain._attachments.index.data, srcFile._attachments.index.data)
})

test.serial('Sync', async t => {
  local.transform({
    incoming: (doc: Object) => {
      t.log('Store doc in local', doc)
      return doc
    }
  })

  await new Promise((resolve, reject) => {
    local.replicate
      .from(remote, { live: false })
      .on('complete', resolve)
      .on('error', reject)
  })

  const plain = await local.get('note:welcome')
  t.is(typeof plain.title, 'string')
  t.is(typeof plain.body, 'string')
  t.is(typeof plain.encryptedData, 'undefined')

  const plainFile = await local.get('file:test', { attachments: true })
  t.is(typeof plainFile.name, 'string')
  t.is(typeof plainFile.encryptionData, 'undefined')
  t.is(typeof plainFile._attachments.index.data, 'string')

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
        data:
          'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAZ5JREFUeNrEVottgzAQJRPQDUgnoBu4nYBu4GyQbuBuQDcgG6QbkE5AMwHZgHYCepbOlWX5d9gQS09CYHznu3t3ryjSVg1gxR1XDxjuZbwBzAi+9JBdggMj4AL4ARwAe8DvVrcXgAlQAUp8FlsZrywGj5iKagsHOgx/aUnJeW3jDG/aeL6xtWnXB76PaxnneMM6UB8z1kRWGsp8fwNugPfA3jfAc25aCq3pxKLNSbvZwnPu6YQiJy3PlsJSzadFTGvR0kUtoRl1dcIstBwstFMp6fBwhs+2kCdNS+451FV4LmfJ01LPcWxYXd9cNeJdSwsrVLAk2pndLGbipfzrLRzKzBeO6A2BOfK/bOFqCZRijk6o0kpSO0r5zviuj4zgZAyuiqKaSiykzkgJi6AU1yKlh9wlYoKK1wy97yDTcWac0VDHcY9jVY7gE757wHH7ieNZX0+AV8AHKuVCU8tSPb9QHag1DXBb2E33COncNacApXTTLmUYpWh+saQF+9QQRVxEa8NYTThiHVwi9ytN+JjLARYhRs0l93+FNv0JMADG1qTgmYgmzwAAAABJRU5ErkJggg=='
      }
    }
  }
  await local.put(srcFile)

  await new Promise((resolve, reject) => {
    local.replicate
      .to(remote, { live: false })
      .on('complete', resolve)
      .on('error', reject)
  })

  const { data: encrypted } = await axios.get(
    `${dbUrl}/file:test2?attachments=true`,
    {
      headers: { accept: 'application/json' }
    }
  )
  t.is(typeof encrypted, 'object')
  t.is(typeof encrypted.encryptionData, 'object')
  t.is(encrypted.encryptionData.algorithm, 'aes-256-gcm')
  t.is(typeof encrypted.encryptionData.iv, 'string')
  t.is(typeof encrypted.encryptionData.tag, 'string')
  t.is(typeof encrypted._attachments.index.data, 'string')
  t.is(encrypted.name, srcFile.name)
  t.not(encrypted._attachments.index.data, srcFile._attachments.index.data)

  const { data } = await axios.get(
    `${dbUrl}/_all_docs?include_docs=true&attachments=true`,
    {
      headers: { accept: 'application/json' }
    }
  )
  t.log(
    'All docs in remote:',
    data.rows.map(row => row.doc)
  )
})
