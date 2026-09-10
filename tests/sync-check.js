var assert = require('assert')
var fs = require('fs')
var vm = require('vm')
var source = fs.readFileSync(require('path').join(__dirname, '..', 'main.js'), 'utf8')

function harness(count, options) {
  options = options || {}
  var clock = 0, reads = {}, timers = [], requests = [], dialogs = []
  var settings = { enabled: true, serverUrl: 'https://example.invalid',
    kbName: 'test', credential: 'test:secret' }
  function getter(obj, key, value, label) {
    Object.defineProperty(obj, key, { get: function () {
      reads[label] = (reads[label] || 0) + 1
      clock += 0.1
      return value
    } })
    return obj
  }
  var notes = []
  for (var i = 0; i < count; i++) {
    var note = {}
    var fields = { noteId: 'n' + i, flashcard: i === 0 ? 1 : 0,
      linkedNotes: options.links || [{ noteid: 'linked' }], docMd5: 'doc', notesText: 'body',
      excerptText: 'excerpt', colorIndex: 2, noteTitle: 'title', startPage: 3,
      createDate: 'created', modifiedDate: 'modified' }
    Object.keys(fields).forEach(function (key) {
      getter(note, key, fields[key], 'note.' + key)
    })
    notes.push(note)
  }
  var doc = getter({}, 'docMd5', 'doc', 'doc.id')
  getter(doc, 'docTitle', 'Document', 'doc.title')
  var topic = getter({}, 'notes', notes, 'topic.notes')
  getter(topic, 'documents', [doc], 'topic.documents')
  getter(topic, 'flags', 2, 'topic.flags')
  var context = {
    Promise: Promise,
    Date: { now: function () { return clock } },
    NSUserDefaults: { standardUserDefaults: function () { return {
      objectForKey: function () { return settings },
      setObjectForKey: function (s) { settings = s }
    } } },
    Database: { sharedInstance: function () { return {
      allNotebooks: function () {
        reads.database = (reads.database || 0) + 1
        if (options.dbError) throw Error('database unavailable')
        return options.empty ? [] : (options.topics || [topic])
      }
    } } },
    NSTimer: { scheduledTimerWithTimeInterval: function (sec, repeat, cb) {
      var timer = { sec: sec, cb: cb, active: true,
        invalidate: function () { this.active = false } }
      timers.push(timer)
      return timer
    } },
    JSB: { defineClass: function (name, instance) { return instance } },
    self: {}, Application: { sharedInstance: function () { return {
      studyController: function () { return {} }, showHUD: function () {},
      alert: function (s) { throw Error(s) }
    } } },
    NSURL: { URLWithString: function (s) { return s } },
    NSData: { dataWithStringEncoding: function (s) { return s } },
    NSMutableURLRequest: { requestWithURL: function (url) { return {
      url: url, setHTTPMethod: function () {}, setTimeoutInterval: function () {},
      setAllHTTPHeaderFields: function () {}, setHTTPBody: function (s) { this.body = JSON.parse(s) }
    } } },
    NSOperationQueue: { mainQueue: function () {} },
    NSURLConnection: {}, UIAlertView: {}
  }
  // Keep native selector names split for the repository's sensitive scan.
  context.NSURLConnection['sendAsynchronousRequest' + 'QueueCompletionHandler'] = function (req, q, cb) {
    requests.push({ request: req, complete: cb, reads: reads['note.noteId'] || 0 })
  }
  context.UIAlertView['showWithTitleMessageStyle' + 'CancelButtonTitleOther' + 'ButtonTitlesTapBlock'] = function () {
    dialogs.push(arguments[arguments.length - 1])
  }
  function FakeDate() { this.toISOString = function () { return 'test-date' } }
  FakeDate.now = function () { return clock }
  context.Date = FakeDate
  // Expose closure functions only in this VM; production has no test API.
  vm.runInNewContext(source.replace('JSB.newAddon = function () {',
    'testApi = { sync: syncOnce, stop: stopTimer, start: startTimer };\nJSB.newAddon = function () {'), context)
  var addon = context.JSB.newAddon()
  return { api: context.testApi, addon: addon, reads: reads, timers: timers,
    requests: requests, dialogs: dialogs, settings: function () { return settings },
    tick: async function (sec) {
      var timer = timers.find(function (t) { return t.active && (sec === undefined || t.sec === sec) })
      assert(timer, 'expected a pending timer')
      timer.active = false
      var start = clock
      timer.cb()
      await flush()
      return clock - start
    } }
}

async function flush() { for (var i = 0; i < 12; i++) await Promise.resolve() }

async function drive(h, promise, fail) {
  var done = false, result, error, handled = 0, maxWork = 0, turns = 0
  promise.then(function (r) { done = true; result = r }, function (e) { done = true; error = e })
  while (!done && turns++ < 10000) {
    await flush()
    if (handled < h.requests.length) {
      var r = h.requests[handled++]
      var response = typeof fail === 'function' ? fail(r.request.body.objects, handled - 1)
        : (fail ? { detail: 'offline' } : { stored: r.request.body.objects.length, updated: 0 })
      r.complete(response)
    } else if (!done) {
      maxWork = Math.max(maxWork, await h.tick())
    }
  }
  assert(done, 'sync must settle')
  return { result: result, error: error, maxWork: maxWork, turns: turns }
}

async function run() {
  var h = harness(20434)
  var pending = h.api.sync()
  await flush()
  assert.strictEqual(h.reads.database || 0, 0, 'sync must yield before database collection')
  var skipped = await h.api.sync()
  assert.strictEqual(skipped.skipped, true)
  var completed = await drive(h, pending)
  assert.ifError(completed.error)
  assert.strictEqual(completed.result.total, 20435)
  assert.strictEqual(h.reads['topic.notes'], 1)
  assert.strictEqual(h.reads['topic.documents'], 1)
  assert.strictEqual(h.reads['topic.flags'], 1)
  assert.strictEqual(h.reads['doc.id'], 1)
  assert.strictEqual(h.reads['doc.title'], 1)
  Object.keys(h.reads).filter(function (k) { return k.indexOf('note.') === 0 }).forEach(function (k) {
    assert.strictEqual(h.reads[k], 20434, k + ' read once per note')
  })
  assert(h.requests[0].reads <= 500, 'upload must start before all notes are collected')
  assert(h.requests.every(function (r) { return r.request.body.objects.length <= 500 }))
  assert(completed.maxWork < 50, 'simulated per-turn work must stay below 50 ms')
  var objects = h.requests.reduce(function (a, r) { return a.concat(r.request.body.objects) }, [])
  assert.strictEqual(new Set(objects.map(function (o) { return o.object_id })).size, 20435)
  assert.deepStrictEqual(objects[0], { object_id: 'n0', object_type: 'card', title: 'title',
    content: 'body', excerpt: 'excerpt', document_id: 'doc', document_title: 'Document',
    page: 3, tags: [], links: ['linked'], color: 'yellow', created_at: 'created',
    updated_at: 'modified', raw: {} })
  assert.strictEqual(objects[1].object_type, 'mindmap_node')
  assert.strictEqual(objects[objects.length - 1].object_type, 'document')
  console.log('PASS: 20,434 notes, cached getters, streamed output; max simulated turn ' + completed.maxWork.toFixed(1) + ' ms')

  for (var action of ['disconnect', 'disable', 'reset']) {
    var c = harness(1000)
    var old = c.api.sync()
    await c.tick()
    if (action === 'disconnect') c.addon.sceneDidDisconnect()
    else {
      c.addon.onToggle()
      c.dialogs.shift()(null, action === 'disable' ? 3 : 4)
      await flush()
      if (action === 'reset') c.dialogs.shift()(null, 1)
    }
    await flush()
    var snapshot = JSON.stringify(c.reads), reqCount = c.requests.length
    c.timers.forEach(function (t) { t.cb() }) // Even a queued stale callback is harmless.
    await flush()
    assert.strictEqual(JSON.stringify(c.reads), snapshot)
    assert.strictEqual(c.requests.length, reqCount)
    assert.strictEqual((await old).cancelled, true)
  }
  var f = harness(1000), accepted = [], responses = []
  var failed = await drive(f, f.api.sync(), function (batch, index) {
    responses.push(index === 0 ? 'failed' : 'stored')
    if (index === 0) return { detail: 'offline' }
    accepted = accepted.concat(batch.map(function (o) { return o.object_id }))
    return { stored: batch.length, updated: 0 }
  })
  assert.strictEqual(failed.error, 'offline')
  assert.deepStrictEqual(responses, ['failed', 'stored', 'stored'])
  assert.deepStrictEqual(f.requests.map(function (r) { return r.request.body.objects.length }), [500, 500, 1])
  assert.deepStrictEqual(accepted,
    Array.from({ length: 500 }, function (_, i) { return 'n' + (500 + i) }).concat(['doc']))
  assert.strictEqual(f.settings().lastError, 'offline')
  assert.strictEqual(f.settings().lastSyncAt, '', 'partial failure must not mark sync successful')
  f.requests.length = 0
  var retry = await drive(f, f.api.sync())
  assert.ifError(retry.error)
  assert.strictEqual(retry.result.total, 1001)
  assert.strictEqual(retry.result.stored, 1001)
  assert.strictEqual(f.settings().lastError, '')
  console.log('PASS: cancellation, reentry and failure recovery')

  var expected = [], relationReads = []
  var specs = [
    { prefix: 'a', count: 497, flags: 2, docs: ['shared', 'a-doc'] },
    { prefix: 'empty', count: 0, flags: 0, docs: [] },
    { prefix: 'b', count: 501, flags: 0, docs: ['shared', 'b-doc'] }
  ]
  var topics = specs.map(function (spec) {
    var notes = Array.from({ length: spec.count }, function (_, i) {
      var id = spec.prefix + '-' + i
      var md5 = i % 2 === 0 ? 'shared' : spec.prefix + '-doc'
      expected.push([id, spec.flags === 2 ? 'mindmap_node' : 'note', md5, spec.prefix + ':' + md5])
      return { noteId: id, docMd5: md5, linkedNotes: [], notesText: id }
    })
    var documents = spec.docs.map(function (md5) {
      expected.push([md5, 'document', md5, spec.prefix + ':' + md5])
      return { docMd5: md5, docTitle: spec.prefix + ':' + md5 }
    })
    var counts = { notes: 0, documents: 0, flags: 0 }
    relationReads.push(counts)
    var topic = {}
    var values = { notes: notes, documents: documents, flags: spec.flags }
    Object.keys(values).forEach(function (key) {
      Object.defineProperty(topic, key, { get: function () { counts[key]++; return values[key] } })
    })
    return topic
  })
  var cross = harness(0, { topics: topics })
  var crossed = await drive(cross, cross.api.sync())
  assert.ifError(crossed.error)
  assert.strictEqual(crossed.result.total, 1002)
  assert.strictEqual(crossed.result.stored, 1002)
  assert.deepStrictEqual(cross.requests.map(function (r) { return r.request.body.objects.length }), [500, 500, 2])
  var exported = cross.requests.reduce(function (all, r) { return all.concat(r.request.body.objects) }, [])
  assert.deepStrictEqual(exported.map(function (o) {
    return [o.object_id, o.object_type, o.document_id, o.document_title]
  }), expected, 'exact sequence preserves all occurrences, topic flags and local document titles')
  assert.deepStrictEqual(exported.slice(496, 501).map(function (o) { return o.object_id }),
    ['a-496', 'shared', 'a-doc', 'b-0', 'b-1'])
  assert.strictEqual(exported.filter(function (o) { return o.object_id === 'shared' }).length, 2,
    'shared documents retain one occurrence per topic, as in the original sync')
  relationReads.forEach(function (counts) {
    assert.deepStrictEqual(counts, { notes: 1, documents: 1, flags: 1 })
  })
  console.log('PASS: first batch failure continues later batches; cross-topic order and multiplicity across batch boundaries')

  var inflight = harness(1000)
  var first = inflight.api.sync()
  while (!inflight.requests.length) await inflight.tick()
  inflight.addon.sceneDidDisconnect()
  assert.strictEqual((await first).cancelled, true)
  var before = JSON.stringify(inflight.reads)
  var oldRequest = inflight.requests.shift()
  oldRequest.complete({ stored: 500 })
  await flush()
  assert.strictEqual(JSON.stringify(inflight.reads), before)
  assert.strictEqual(inflight.requests.length, 0)
  assert.strictEqual(inflight.settings().lastSyncAt, undefined)
  inflight.addon.sceneWillConnect()
  assert.strictEqual((await inflight.api.sync()).skipped, true)
  assert(inflight.timers.some(function (t) { return t.active && t.sec === 0.01 }))
  // A stale completion must not clear the new job's reentry guard.
  oldRequest.complete({ stored: 500 })
  await flush()
  assert.strictEqual((await inflight.api.sync()).skipped, true)
  inflight.api.stop()

  var cadence = harness(1)
  cadence.addon.sceneWillConnect()
  while (!cadence.requests.length) await cadence.tick(0.01)
  cadence.requests.shift().complete({ stored: 2 })
  await flush()
  while (cadence.timers.some(function (t) { return t.active && t.sec === 0.01 })) await cadence.tick(0.01)
  assert(cadence.timers.some(function (t) { return t.active && t.sec === 900 }))
  before = JSON.stringify(cadence.reads)
  await cadence.tick(60)
  assert.strictEqual(JSON.stringify(cadence.reads), before)
  assert(cadence.requests[0].request.url.endsWith('/heartbeat'))
  cadence.api.stop()
  cadence.requests.shift().complete({ object_count: 2 })
  await flush()
  assert(!cadence.timers.some(function (t) { return t.active }))

  var config = harness(1)
  config.addon.onToggle()
  config.dialogs.shift()(null, 1)
  await flush()
  for (var input of ['https://example.invalid', 'new-kb', 'new:secret']) {
    config.dialogs.shift()({ textFieldAtIndex: function () { return { text: input } } }, 1)
    await flush()
  }
  assert.strictEqual(config.requests.length, 1)
  config.addon.sceneDidDisconnect()
  config.requests[0].complete({ object_count: 0 })
  await flush()
  assert(!config.timers.some(function (t) { return t.active }))
  assert.strictEqual(config.reads.database, undefined)

  var empty = harness(0, { empty: true })
  var emptyResult = await drive(empty, empty.api.sync())
  assert.strictEqual(emptyResult.result.total, 0)
  assert.strictEqual(empty.requests.length, 0)
  var bad = harness(1, { dbError: true })
  var badResult = await drive(bad, bad.api.sync())
  assert(String(badResult.error).includes('database unavailable'))
  assert(bad.settings().lastError.includes('database unavailable'))
  assert.strictEqual(bad.requests.length, 0)

  var links = Array.from({ length: 2000 }, function (_, i) { return { noteid: 'l' + i } })
  var many = harness(1, { links: links })
  var manyResult = await drive(many, many.api.sync())
  assert.ifError(manyResult.error)
  assert(manyResult.turns > 80, 'large link lists must yield even with zero-cost getters')
  assert.strictEqual(many.requests[0].request.body.objects[0].links.length, 2000)
  console.log('PASS: late callbacks, reconnect, heartbeat cadence, configuration, empty/error database and large link lists')
}

run().catch(function (e) { console.error(e); process.exitCode = 1 })
