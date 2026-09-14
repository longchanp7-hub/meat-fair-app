import test from 'node:test';
import assert from 'node:assert/strict';
import {dimensions} from '../scripts/gallery-extract.mjs';
test('JPEG dimensions remain readable after a large ICC color profile',()=>{
 const app=Buffer.alloc(65537);app[0]=255;app[1]=226;app.writeUInt16BE(65535,2);app.write('ICC_PROFILE',4);
 const sof=Buffer.from([255,192,0,8,8,1,104,2,72,0,255,217]);
 const jpeg=Buffer.concat([Buffer.from([255,216]),...Array(12).fill(app),sof]);
 assert.equal(dimensions(jpeg.subarray(0,512000)),null);
 assert.deepEqual(dimensions(jpeg),{width:584,height:360});
});
