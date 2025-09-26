// Binary networking helpers and hydration (ES module)
import { netProtocol } from './protocol_router.js';
const api = {};

  api.BIN_TYPE = {
    INPUT: 0x01,
    PING:  0x02,
    PONG:  0x03,
    PLAYERS: 0x10,
    NICK:   0x11,
    CHAT:   0x12,
    NOTIFY: 0x13,
    PWR:    0x14,
    SPAWN:  0x15,
    INIT:   0x20,
    DELTA:  0x21
  };

  api.utf8Encode = function(str){
    str = '' + (str == null ? '' : str);
    var out = new Uint8Array(str.length * 4);
    var o = 0;
    for (var i = 0; i < str.length; i++){
      var code = str.charCodeAt(i);
      if (code < 0x80) { out[o++] = code; }
      else if (code < 0x800) { out[o++] = 0xC0 | (code >> 6); out[o++] = 0x80 | (code & 0x3F); }
      else if (code < 0x10000) { out[o++] = 0xE0 | (code >> 12); out[o++] = 0x80 | ((code >> 6) & 0x3F); out[o++] = 0x80 | (code & 0x3F); }
      else { out[o++] = 0xF0 | (code >> 18); out[o++] = 0x80 | ((code >> 12) & 0x3F); out[o++] = 0x80 | ((code >> 6) & 0x3F); out[o++] = 0x80 | (code & 0x3F); }
    }
    return out.slice(0, o);
  };
  api.utf8Decode = function(bytes){
    var b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || 0);
    var out = '';
    for (var i = 0; i < b.length; i++){
      var c = b[i];
      if (c < 0x80) { out += String.fromCharCode(c); }
      else if ((c & 0xE0) === 0xC0) { var c2 = b[++i]; out += String.fromCharCode(((c & 0x1F) << 6) | (c2 & 0x3F)); }
      else if ((c & 0xF0) === 0xE0) { var c2a = b[++i], c3 = b[++i]; out += String.fromCharCode(((c & 0x0F) << 12) | ((c2a & 0x3F) << 6) | (c3 & 0x3F)); }
      else { var c2b = b[++i], c3b = b[++i], c4 = b[++i]; var cp = ((c & 0x07) << 18) | ((c2b & 0x3F) << 12) | ((c3b & 0x3F) << 6) | (c4 & 0x3F); cp -= 0x10000; out += String.fromCharCode(0xD800 + (cp >> 10), 0xDC00 + (cp & 0x3FF)); }
    }
    return out;
  };

  function W(){ this._a = []; }
  W.prototype.writeU8 = function(v){ this._a.push((v & 0xFF) >>> 0); };
  W.prototype.writeU16 = function(v){ v >>>= 0; this._a.push((v & 0xFF), ((v>>>8)&0xFF)); };
  W.prototype.writeU32 = function(v){ v >>>= 0; this._a.push((v & 0xFF), ((v>>>8)&0xFF), ((v>>>16)&0xFF), ((v>>>24)&0xFF)); };
  W.prototype.writeF32 = function(f){ var buf = new ArrayBuffer(4); new DataView(buf).setFloat32(0, +f||0, true); var b = new Uint8Array(buf); for (var i=0;i<4;i++){ this._a.push(b[i]); } };
  W.prototype.writeBytes = function(bytes){ var b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes||0); for (var i=0;i<b.length;i++){ this._a.push(b[i]); } };
  W.prototype.writeStr8 = function(str){ var b = api.utf8Encode(str||''); var len = Math.min(255, b.length); this.writeU8(len); for (var i=0;i<len;i++){ this._a.push(b[i]); } };
  W.prototype.writeStr16 = function(str){ var b = api.utf8Encode(str||''); var len = Math.min(65535, b.length); this.writeU16(len); for (var i=0;i<len;i++){ this._a.push(b[i]); } };
  W.prototype.toBuffer = function(){ var u = new Uint8Array(this._a.length); for (var i=0;i<u.length;i++){ u[i] = this._a[i]; } return u.buffer; };
  api.ByteWriter = W;

  // Builders
  api.buildInput = function(state){
    var idBytes = api.utf8Encode(state.tankId || '');
    var flags = (state.upPressed?1:0) | ((state.rightPressed?1:0)<<1) | ((state.downPressed?1:0)<<2) | ((state.leftPressed?1:0)<<3) | ((state.shooting?1:0)<<4) | ((state.specialKeyPressed?1:0)<<5);
    var len = Math.min(255, idBytes.length);
    var buf = new Uint8Array(3 + len);
    buf[0] = api.BIN_TYPE.INPUT; buf[1] = len;
    for (var i=0;i<len;i++){ buf[2+i] = idBytes[i]; }
    buf[2+len] = flags & 0x3F;
    return buf.buffer;
  };
  api.buildPing = function(ts){ var buf = new ArrayBuffer(5); var dv = new DataView(buf); dv.setUint8(0, api.BIN_TYPE.PING); dv.setUint32(1, (ts>>>0)); return buf; };
  api.buildPong = function(ts){ var buf = new ArrayBuffer(5); var dv = new DataView(buf); dv.setUint8(0, api.BIN_TYPE.PONG); dv.setUint32(1, (ts>>>0)); return buf; };

  api.buildPlayerList = function(players){ var w = new W(); w.writeU8(api.BIN_TYPE.PLAYERS); var list = Array.isArray(players)?players:[]; var n = Math.min(255, list.length); w.writeU8(n); for (var i=0;i<n;i++){ var p=list[i]||{}; w.writeStr8(p.id||''); w.writeStr8(p.nickname||'Player'); } return w.toBuffer(); };
  api.buildNickname = function(peerId, nickname){ var w = new W(); w.writeU8(api.BIN_TYPE.NICK); w.writeStr8(peerId||''); w.writeStr8(nickname||''); return w.toBuffer(); };
  api.buildChat = function(nickname, text){ var w = new W(); w.writeU8(api.BIN_TYPE.CHAT); w.writeStr8(nickname||''); w.writeStr16(text||''); return w.toBuffer(); };
  api.buildNotify = function(text){ var w = new W(); w.writeU8(api.BIN_TYPE.NOTIFY); w.writeStr16(text||''); return w.toBuffer(); };
  api.buildPowerupEventFromString = function(str){ var parts=(str||'').split(','); if (parts[0] !== 'X') return null; var w = new W(); w.writeU8(api.BIN_TYPE.PWR); w.writeStr8(parts[1]||''); w.writeStr8(parts[2]||''); w.writeStr8(parts[3]||''); w.writeStr8(parts[4]||''); var id=parseInt(parts[5]||'0',10)||0; w.writeU16(id); return w.toBuffer(); };
  api.buildSpawnFromString = function(str){ if (typeof str !== 'string' || str[0] !== 'S') return null; var block=str.substring(2)||''; var f=block.split('|'); var toInt=function(v){var n=parseInt(v,10);return isNaN(n)?0:n;}; var w = new W(); w.writeU8(api.BIN_TYPE.SPAWN); w.writeStr8(f[0]||''); w.writeU16(toInt(f[1]||0)); w.writeU16(toInt(f[2]||0)); w.writeU16(toInt(f[3]||0)); w.writeU16(toInt(f[4]||0)); w.writeU16(toInt(f[5]||0)); w.writeStr8(f[6]||''); w.writeStr8(f[7]||''); return w.toBuffer(); };

  api.buildInitFromString = function(str){ var parts=(str||'').split(','); if (parts[0] !== 'I') return null; var toInt=function(v){var n=parseInt(v,10);return isNaN(n)?0:n;}; var toNum=function(v){var n=parseFloat(v);return isNaN(n)?0:n;}; var w = new W(); w.writeU8(api.BIN_TYPE.INIT); var rows=toInt(parts[1]), cols=toInt(parts[2]), wall=toInt(parts[3]); var mv=toNum(parts[4]), rv=toNum(parts[5]), bv=toNum(parts[6]); var bl=toInt(parts[7]), bo=toInt(parts[8]); var pi=toNum(parts[9]), pl=toInt(parts[10]), pd=toNum(parts[11]); var ff=(parts[12]==='1')?1:0; w.writeU16(rows); w.writeU16(cols); w.writeU16(wall); w.writeF32(mv); w.writeF32(rv); w.writeF32(bv); w.writeU16(bl); w.writeU16(bo); w.writeF32(pi); w.writeU16(pl); w.writeF32(pd); w.writeU8(ff); w.writeStr16(parts[13]||''); var pBlock=parts[14]||''; var pList=pBlock?pBlock.split(';').filter(Boolean):[]; var pc=Math.min(65535,pList.length); w.writeU16(pc); for (var i=0;i<pc;i++){ var f=pList[i].split('|'); w.writeU16(toInt(f[0]||0)); w.writeU16(toInt(f[1]||0)); w.writeU16(toInt(f[2]||0)); w.writeU16(toInt(f[3]||0)); w.writeStr8(f[4]||''); w.writeStr8(f[5]||''); } var tBlock=parts[15]||''; var tList=tBlock?tBlock.split(';').filter(Boolean):[]; var tc=Math.min(65535,tList.length); w.writeU16(tc); for (var j=0;j<tc;j++){ var tf=tList[j].split('|'); w.writeStr8(tf[0]||''); w.writeU16(toInt(tf[1]||0)); w.writeU16(toInt(tf[2]||0)); w.writeF32(toNum(tf[3]||0)); w.writeU16(toInt(tf[4]||0)); w.writeU16(toInt(tf[5]||0)); w.writeStr8(tf[6]||''); w.writeU16(toInt(tf[7]||0)); } return w.toBuffer(); };
  api.buildDeltaFromString = function(str){
    var parts=(str||'').split(','); if (parts[0] !== 'D') return null;
    var toInt=function(v){var n=parseInt(v,10);return isNaN(n)?0:n;};
    var toNum=function(v){var n=parseFloat(v);return isNaN(n)?0:n;};
    var w = new W(); w.writeU8(api.BIN_TYPE.DELTA);
    // Support both legacy D,ts,... and new D,... (no ts). Always write a 0 ts in binary.
    var idx = (parts.length >= 6) ? 2 : 1;
    w.writeU32(0);
    var tBlock=parts[idx]||''; var tList=tBlock?tBlock.split(';').filter(Boolean):[];
    var tc=Math.min(65535,tList.length); w.writeU16(tc);
    for (var i=0;i<tc;i++){ var f=tList[i].split('|'); w.writeStr8(f[0]||''); w.writeU16(toInt(f[1]||0)); w.writeU16(toInt(f[2]||0)); w.writeF32(toNum(f[3]||0)); w.writeU16(toInt(f[4]||0)); w.writeU8(toInt(f[5]||1)); }
    var bBlock=parts[idx+1]||''; var bList=bBlock?bBlock.split(';').filter(Boolean):[]; var bc=Math.min(65535,bList.length); w.writeU16(bc);
    for (var j=0;j<bc;j++){ var bf=bList[j].split('|'); w.writeU16(toInt(bf[0]||0)); w.writeU16(toInt(bf[1]||0)); w.writeF32(toNum(bf[2]||0)); w.writeF32(toNum(bf[3]||0)); w.writeStr8(bf[4]||''); w.writeU8(toInt(bf[5]||1)); }
    var pBlock=parts[idx+2]||''; var pList=pBlock?pBlock.split(';').filter(Boolean):[]; var pc=Math.min(65535,pList.length); w.writeU16(pc);
    for (var k=0;k<pc;k++){ var pf=pList[k].split('|'); w.writeU16(toInt(pf[0]||0)); w.writeU16(toInt(pf[1]||0)); w.writeU16(toInt(pf[2]||0)); w.writeU16(toInt(pf[3]||0)); w.writeStr8(pf[4]||''); w.writeStr8(pf[5]||''); }
    var eBlock=parts[idx+3]||''; var eList=eBlock?eBlock.split(';').filter(Boolean):[]; var ec=Math.min(65535,eList.length); w.writeU16(ec);
    for (var m=0;m<ec;m++){ var ef=eList[m].split('|'); w.writeStr8(ef[0]||''); w.writeStr8(ef[1]||''); w.writeStr8(ef[2]||''); w.writeStr8(ef[3]||''); }
    return w.toBuffer(); };

  // Hydrate (normalize incoming data), re-dispatch Blob -> ArrayBuffer
  api.hydrate = function(data, manager, conn){
    try {
      if (typeof data === 'string') { return data; }
      if (typeof Blob !== 'undefined' && data instanceof Blob && data.arrayBuffer){
        data.arrayBuffer().then(function(buf){ try { netProtocol && netProtocol.handlePeerMessage && netProtocol.handlePeerMessage(manager, buf, conn); } catch(_){} });
        return null;
      }
      var bytes = null;
      if (data && data.byteLength != null && !(data instanceof ArrayBuffer)) { bytes = new Uint8Array(data); }
      else if (data instanceof ArrayBuffer) { bytes = new Uint8Array(data); }
      if (!bytes || bytes.length === 0) { return data; }
      var type = bytes[0];
      var bt = api.BIN_TYPE;
      switch (type) {
        case bt.INPUT: {
          var len = bytes[1]||0; var idBytes = bytes.slice(2, 2+len); var tankId = api.utf8Decode(idBytes); var flags = bytes[2+len]||0; var f=function(bit){ return ((flags>>bit)&1)?'1':'0'; }; return ['C', tankId, f(0), f(1), f(2), f(3), f(4), f(5)].join(',');
        }
        case bt.PING: { var dv1 = new DataView(bytes.buffer, bytes.byteOffset||0, bytes.byteLength); var ts1 = dv1.getUint32(1); return 'Q,'+ts1; }
        case bt.PONG: { var dv2 = new DataView(bytes.buffer, bytes.byteOffset||0, bytes.byteLength); var ts2 = dv2.getUint32(1); return 'q,'+ts2; }
        case bt.PLAYERS: {
          var o=1, n=bytes[o++]||0, parts=[]; for (var i=0;i<n;i++){ var lid=bytes[o++]||0; var id=api.utf8Decode(bytes.slice(o,o+lid)); o+=lid; var lnn=bytes[o++]||0; var nn=api.utf8Decode(bytes.slice(o,o+lnn)); o+=lnn; parts.push(id + '|' + (netProtocol && netProtocol.encodeFreeText ? netProtocol.encodeFreeText(nn) : nn)); } return 'P,' + parts.join(';');
        }
        case bt.NICK: { var o1=1; var rl8=function(){ return bytes[o1++]; }; var rStr8=function(){ var l=rl8(); var s=api.utf8Decode(bytes.slice(o1,o1+l)); o1+=l; return s; }; var id1=rStr8(); var nn1=rStr8(); var e = (netProtocol && netProtocol.encodeFreeText) ? netProtocol.encodeFreeText : function(x){return x;}; return 'N,' + id1 + ',' + e(nn1); }
        case bt.CHAT: { var o2=1; var rU8=function(){ return bytes[o2++]; }; var rU16=function(){ var v=bytes[o2]|(bytes[o2+1]<<8); o2+=2; return v>>>0; }; var rStr8=function(){ var l=rU8(); var s=api.utf8Decode(bytes.slice(o2,o2+l)); o2+=l; return s; }; var rStr16=function(){ var l=rU16(); var s=api.utf8Decode(bytes.slice(o2,o2+l)); o2+=l; return s; }; var nick=rStr8(); var text=rStr16(); var eF = (netProtocol && netProtocol.encodeFreeText) ? netProtocol.encodeFreeText : function(x){return x;}; return 'M,' + eF(nick) + ',' + eF(text); }
        case bt.NOTIFY: { var o3=1; var rU16b=function(){ var v=bytes[o3]|(bytes[o3+1]<<8); o3+=2; return v>>>0; }; var rStr16b=function(){ var l=rU16b(); var s=api.utf8Decode(bytes.slice(o3,o3+l)); o3+=l; return s; }; var text2=rStr16b(); var eF2=(netProtocol && netProtocol.encodeFreeText)?netProtocol.encodeFreeText:function(x){return x;}; return 'E,' + eF2(text2); }
        case bt.PWR: { var o4=1; var rU8b=function(){ return bytes[o4++]; }; var rU16c=function(){ var v=bytes[o4]|(bytes[o4+1]<<8); o4+=2; return v>>>0; }; var rStr8b=function(){ var l=rU8b(); var s=api.utf8Decode(bytes.slice(o4,o4+l)); o4+=l; return s; }; var p=rStr8b(), s1=rStr8b(), t=rStr8b(), id2=rStr8b(); var pid=rU16c(); return ['X', p, s1, t, id2, pid].join(','); }
        case bt.SPAWN: { var o5=1; var rU8c=function(){ return bytes[o5++]; }; var rU16d=function(){ var v=bytes[o5]|(bytes[o5+1]<<8); o5+=2; return v>>>0; }; var rStr8c=function(){ var l=rU8c(); var s=api.utf8Decode(bytes.slice(o5,o5+l)); o5+=l; return s; }; var type=rStr8c(); var id3=rU16d(); var x=rU16d(), y=rU16d(), w=rU16d(), h=rU16d(); var sid=rStr8c(), col=rStr8c(); return 'S,' + [type, id3, x, y, w, h, sid, col].join('|'); }
        case bt.INIT: { var o6=1; var rU16e=function(){ var v=bytes[o6]|(bytes[o6+1]<<8); o6+=2; return v>>>0; }; var rU8d=function(){ return bytes[o6++]; }; var rF32=function(){ var dv3=new DataView(bytes.buffer, (bytes.byteOffset||0)+o6, 4); var f=dv3.getFloat32(0,true); o6+=4; return f; }; var rStr8d=function(){ var l=rU8d(); var s=api.utf8Decode(bytes.slice(o6,o6+l)); o6+=l; return s; }; var rStr16d=function(){ var l=rU16e(); var s=api.utf8Decode(bytes.slice(o6,o6+l)); o6+=l; return s; }; var rows=rU16e(), cols=rU16e(), wall=rU16e(); var mv=rF32(), rv=rF32(), bv=rF32(); var bl=rU16e(), bo=rU16e(); var pi=rF32(), pl=rU16e(), pd=rF32(); var ff=rU8d(); var layout=rStr16d(); var pc=rU16e(); var pParts=[]; for (var pi2=0;pi2<pc;pi2++){ var x2=rU16e(), y2=rU16e(), w2=rU16e(), h2=rU16e(); var sid2=rStr8d(), col2=rStr8d(); pParts.push([x2,y2,w2,h2,sid2,col2].join('|')); } var tc=rU16e(); var tParts=[]; for (var ti=0;ti<tc;ti++){ var idt=rStr8d(); var x3=rU16e(), y3=rU16e(); var rot=rF32(); var w3=rU16e(), h3=rU16e(); var col3=rStr8d(); var score=rU16e(); tParts.push([idt,x3,y3,rot,w3,h3,col3,score].join('|')); } return ['I', rows, cols, wall, mv, rv, bv, bl, bo, pi, pl, pd, (ff?1:0), layout, pParts.join(';'), tParts.join(';')].join(','); }
        case bt.DELTA: { var o7=1; var rU16f=function(){ var v=bytes[o7]|(bytes[o7+1]<<8); o7+=2; return v>>>0; }; var rU8e=function(){ return bytes[o7++]; }; var rU32=function(){ var dv4=new DataView(bytes.buffer, (bytes.byteOffset||0)+o7, 4); var v=dv4.getUint32(0,true); o7+=4; return v>>>0; }; var rF32b=function(){ var dv5=new DataView(bytes.buffer, (bytes.byteOffset||0)+o7, 4); var f=dv5.getFloat32(0,true); o7+=4; return f; }; var rStr8e=function(){ var l=rU8e(); var s=api.utf8Decode(bytes.slice(o7,o7+l)); o7+=l; return s; }; /*ts=*/rU32(); var tc2=rU16f(); var tParts2=[]; for (var ti2=0;ti2<tc2;ti2++){ var id4=rStr8e(); var x4=rU16f(), y4=rU16f(); var rot2=rF32b(); var score2=rU16f(); var alive=rU8e(); tParts2.push([id4,x4,y4,rot2,score2,alive].join('|')); } var bc=rU16f(); var bParts=[]; for (var bi=0;bi<bc;bi++){ var x5=rU16f(), y5=rU16f(); var vx=rF32b(), vy=rF32b(); var col4=rStr8e(); var rad=rU8e(); bParts.push([x5,y5,vx,vy,col4,rad].join('|')); } var pc2=rU16f(); var pParts2=[]; for (var pj=0;pj<pc2;pj++){ var x6=rU16f(), y6=rU16f(), w4=rU16f(), h4=rU16f(); var sid3=rStr8e(), col5=rStr8e(); pParts2.push([x6,y6,w4,h4,sid3,col5].join('|')); } var ec=rU16f(); var eParts=[]; for (var ei=0;ei<ec;ei++){ var p=rStr8e(), s=rStr8e(), t=rStr8e(), id5=rStr8e(); eParts.push([p,s,t,id5].join('|')); } return ['D', tParts2.join(';'), bParts.join(';'), pParts2.join(';'), eParts.join(';')].join(','); }
      }
    } catch(_){}
    return data;
  };
export const netBinary = api;
