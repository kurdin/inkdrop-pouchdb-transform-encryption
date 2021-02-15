const fs = require('fs')
const babelrc = JSON.parse(
  fs.readFileSync(__dirname + '/../.babelrc', { encoding: 'utf-8' })
)
require('@babel/register')(
  Object.assign(babelrc, {
    // These patterns are relative to the project directory (where the `package.json` file lives):
    ignore: [
      /node_modules\/(?!@craftzdog\/(inkdrop-logger|inkdrop-pouchdb|inkdrop-search-utils|pouchdb-quick-search|pouchdb-mapreduce-no-ddocs|inkdrop-task-list-utils|inkdrop-pouchdb-fts-sqlite3|inkdrop-tokenize))/,
      /test/
    ]
  })
)
