import test from 'node:test';
import assert from 'node:assert/strict';
import {selectMedia} from '../app/gallery.mjs';
test('invalid optional gallery data falls back to the campaign image',()=>{
 const c={id:'c',title:'秋フェア',imageUrl:'https://official.example/main.jpg',officialUrl:'https://official.example/fair/'};
 assert.equal(selectMedia([c],'b',null).length,1);
 assert.equal(selectMedia([c],'b',{assets:'invalid'}).length,1);
});
