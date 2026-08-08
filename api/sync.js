'use strict';
var rooms = {};
function deepMerge(local, remote) {
  if (remote === undefined || remote === null) return local;
  if (local === undefined || local === null) return remote;
  if (typeof local !== 'object' || typeof remote !== 'object') {
    if (typeof local === 'number' && typeof remote === 'number') return Math.max(local, remote);
    return remote;
  }
  if (Array.isArray(local) || Array.isArray(remote)) return remote;
  var out = {};
  for (var k in local) if (local.hasOwnProperty(k)) out[k] = local[k];
  for (var k in remote) if (remote.hasOwnProperty(k)) {
    out[k] = out.hasOwnProperty(k) ? deepMerge(out[k], remote[k]) : remote[k];
  }
  return out;
}
function roomIdOf(url) {
  var p = url.pathname.split('/').filter(Boolean);
  if (p.length >= 3) return p[2];
  if (p.length === 2 && p[1] === 'sync') return 'main';
  return p.length >= 2 ? p[1] : 'main';
}
function json(res, code, obj) {
  var body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}
function handler(req, res) {
  var url = new URL(req.url, 'http://localhost');
  var pathname = url.pathname;
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }
  if (req.method === 'POST' && pathname.indexOf('/create') !== -1) {
    var rid = 'room_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    rooms[rid] = { v: 1, updatedAt: Date.now(), keys: {} };
    var base = 'https://' + (req.headers.host || 'localhost');
    json(res, 200, { ok: true, url: base + '/api/sync/' + rid });
    return;
  }
  var id = roomIdOf(url);
  if (req.method === 'GET' && pathname.indexOf('/stats') !== -1) {
    var total = 0;
    for (var k in rooms) if (rooms.hasOwnProperty(k)) total += Object.keys(rooms[k].keys || {}).length;
    json(res, 200, { ok: true, rooms: Object.keys(rooms).length, keysTotal: total });
    return;
  }
  if (req.method === 'GET') {
    if (!rooms[id]) rooms[id] = { v: 1, updatedAt: Date.now(), keys: {} };
    json(res, 200, rooms[id]);
    return;
  }
  if (req.method === 'PUT') {
    var chunks = [];
    req.on('data', function (c) { chunks.push(c); });
    req.on('end', function () {
      try {
        var body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        if (!body || typeof body !== 'object') throw new Error('bad json');
        var existing = rooms[id] || { v: 1, keys: {} };
        var newKeys = {};
        for (var kk in existing.keys) if (existing.keys.hasOwnProperty(kk)) newKeys[kk] = existing.keys[kk];
        for (var kk in (body.keys || {})) if (body.keys.hasOwnProperty(kk)) {
          newKeys[kk] = deepMerge(newKeys[kk], body.keys[kk]);
        }
        rooms[id] = { v: (existing.v || 0) + 1, updatedAt: Date.now(), keys: newKeys };
        json(res, 200, { ok: true, v: rooms[id].v });
      } catch (e) {
        json(res, 400, { ok: false, msg: 'JSON 解析失败' });
      }
    });
    return;
  }
  json(res, 405, { ok: false, msg: '不支持的请求' });
}
module.exports = handler;
