import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDocumentText,recognitionCandidates,fillRecognitionBlanks} from './documentOcr';
import {emptyAgentProfile} from './agentModel';
test('extracts labelled identity fields but never returns identity number or address',()=>{
 const r=parseDocumentText(['居民身份证','姓名 张明德','性别 男 民族 汉','出生 1944年5月16日','住址 浙江省某街道','公民身份号码 330102194405160011']);
 assert.equal(r.documentType,'身份证');assert.deepEqual(r.fields,{name:'张明德',gender:'男',birthDate:'1944-05-16'});
 assert.doesNotMatch(JSON.stringify(r),/330102194405160011|某街道/);
});
test('distinguishes birth, death and certificate date; does not invent time or age',()=>{
 const r=parseDocumentText(['居民死亡医学证明','死者姓名：李明','出生日期：1940-02-29','死亡日期：2026年10月21日','签发日期：2026年10月22日']);
 assert.deepEqual(r.fields,{name:'李明',birthDate:'1940-02-29',deathDate:'2026-10-21'});
 assert.equal(parseDocumentText(['姓名 王明','出生日期 1941-02-29']).fields.birthDate,undefined);
});
test('household page may contain multiple people: refuses ambiguous name and dates',()=>{
 const r=parseDocumentText(['户口簿','姓名 张明','出生日期 1940年1月2日','姓名 李梅','出生日期 1942年3月4日']);
 assert.equal(r.fields.name,undefined);assert.equal(r.fields.birthDate,undefined);assert.ok(r.warnings.length);
});
test('supports split label/value rows and leaves low-confidence empty scan unfilled',()=>{
 assert.equal(parseDocumentText(['姓名','陈明德','出生日期','1944年5月16日']).fields.name,'陈明德');
 assert.deepEqual(parseDocumentText(['模糊无法读取']).fields,{});
});
test('multiple documents preserve conflicting candidates and never overwrite a confirmed profile',()=>{
 const a=parseDocumentText(['姓名 张明','出生日期 1940年1月2日']),b=parseDocumentText(['姓名 李梅']);
 const materials=[{id:'a',name:'身份证',recognition:a},{id:'b',name:'死亡证明',recognition:b}];
 assert.equal(recognitionCandidates(materials).filter(x=>x.key==='name').length,2);
 const p={...emptyAgentProfile(),name:'原姓名',confirmedAt:'2026-10-22'};
 assert.deepEqual(fillRecognitionBlanks(p,a),p);
 const blank=fillRecognitionBlanks(emptyAgentProfile(),a);assert.equal(blank.name,'张明');assert.equal(blank.birthTime,'');assert.equal(blank.confirmedAt,undefined);
 const lunar=fillRecognitionBlanks({...emptyAgentProfile(),calendar:'lunar'},a);assert.equal(lunar.birthDate,'');
});
