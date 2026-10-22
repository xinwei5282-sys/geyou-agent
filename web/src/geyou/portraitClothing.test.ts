import test from 'node:test';
import assert from 'node:assert/strict';
import {recommendPortraitClothing,portraitClothingPrompt} from './portraitClothing';
test('age suggests a clothing style without fabricating missing age or imposing adult wear on children',()=>{
 assert.equal(recommendPortraitClothing('82').style,'tang');assert.equal(recommendPortraitClothing('42').style,'suit');
 for(const age of ['', '未知','200','6'])assert.equal(recommendPortraitClothing(age).style,'original');
});
test('explicit family choice controls only garments and overrides default',()=>{
 assert.match(portraitClothingPrompt('tang'),/唐装/);assert.match(portraitClothingPrompt('suit'),/西服/);
 assert.match(portraitClothingPrompt('original'),/不换装/);assert.match(portraitClothingPrompt('plain'),/素色/);
 assert.match(portraitClothingPrompt('suit'),/优先于前文默认/);assert.match(portraitClothingPrompt('suit'),/不改变脸型/);
});
