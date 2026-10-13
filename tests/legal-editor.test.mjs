import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizePresentation,applyLegalStyle,editPresentation,trimPresentation} from '../admin/legal-editor.js';
test('legacy body and malformed styles safely use bundled defaults',()=>{
 for(const p of [null,{font:'remote',fontSize:16,lineHeight:1.4,letterSpacing:0},{font:'munmak',fontSize:999,lineHeight:1.4,letterSpacing:0}]){
  const result=normalizePresentation('<script>plain text</script>',p);assert.equal(result.font,'pretendard');assert.equal(result.fontSize,15.5);assert.equal(result.runs[0].text,'<script>plain text</script>');
 }
});
test('selection font and size preserve emoji graphemes and exact source',()=>{
 const body='안녕 👨‍👩‍👧‍👦 반가워요';let p=normalizePresentation(body,null);p=applyLegalStyle(body,p,4,6,{font:'munmak',fontSize:22});
 assert.equal(p.runs.map(r=>r.text).join(''),body);assert.equal(p.runs[1].text,'👨‍👩‍👧‍👦');assert.equal(p.runs[1].fontSize,22);
 assert.throws(()=>applyLegalStyle(body,p,0,2,{font:'url(http://bad)'}));assert.throws(()=>applyLegalStyle(body,p,0,2,{fontSize:Infinity}));
});
test('editing, auto-footer and trimming retain unedited selection styles',()=>{
 const body='  제1조 내용  ';const p=applyLegalStyle(body,normalizePresentation(body,null),2,5,{font:'munmak',fontSize:20});
 const next=body+'\n버전: 1.1';const edited=editPresentation(body,p,next);assert.equal(edited.runs.find(r=>r.font==='munmak').text,'제1조');
 const trimmed=trimPresentation(next,edited);assert.equal(trimmed.runs.map(r=>r.text).join(''),next.trim());assert.equal(trimmed.runs[0].fontSize,20);
});
