import test from 'node:test';
import assert from 'node:assert/strict';
import {dimensions} from '../scripts/gallery-extract.mjs';
test('actual GIF/AVIF signatures are accepted independently of the URL extension',()=>{
 const gif=Buffer.alloc(10);gif.write('GIF89a');gif.writeUInt16LE(584,6);gif.writeUInt16LE(360,8);assert.deepEqual(dimensions(gif),{width:584,height:360});
 const avif=Buffer.alloc(52);avif.writeUInt32BE(24,0);avif.write('ftypavif',4);avif.writeUInt32BE(20,32);avif.write('ispe',36);avif.writeUInt32BE(584,44);avif.writeUInt32BE(360,48);assert.deepEqual(dimensions(avif),{width:584,height:360});
});
