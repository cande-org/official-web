import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRuns,applyFont,editRuns,trimmedRuns} from '../admin/announcement-editor.js';
test('selected font survives surrounding edits, save trim and re-open',()=>{
 const body='  안녕 강조 문장  ',runs=applyFont(body,null,5,7,'munmak');
 assert.equal(runs.map(r=>r.text).join(''),body);
 const next='  안녕 강조 긴 문장  ',edited=editRuns(body,runs,next);
 assert.equal(edited.find(r=>r.font==='munmak').text,'강조');
 assert.deepEqual(normalizeRuns(next.trim(),trimmedRuns(next,edited)),trimmedRuns(next,edited));
 assert.deepEqual(applyFont(next,edited,0,next.length,'pretendard'),[{text:next,font:'pretendard'}]);
});
test('emoji and combining sequences remain whole even with partial selection and replacement',()=>{
 const body='a👨‍👩‍👧‍👦b',runs=applyFont(body,null,2,3,'munmak');
 assert.equal(runs[1].text,'👨‍👩‍👧‍👦');
 assert.deepEqual(editRuns('😀',[{text:'😀',font:'munmak'}],'😁'),[{text:'😁',font:'pretendard'}]);
 assert.equal(applyFont('a가\u0301b',null,2,3,'munmak')[1].text,'가\u0301');
});
test('invalid/legacy runs fall back to exact plain text; no HTML interpretation',()=>{
 const text='<script>plain & unchanged</script>';
 for(const value of [null,[],[{text:'changed',font:'munmak'}],[{text,font:'remote'}]])assert.deepEqual(normalizeRuns(text,value),[{text,font:'pretendard'}]);
});
