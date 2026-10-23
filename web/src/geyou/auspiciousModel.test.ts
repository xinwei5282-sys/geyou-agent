import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Solar} from 'lunar-javascript';
import {burialCandidates,branchClash,defaultBurialRange} from './auspiciousModel';
import {calculateAgentBazi,emptyAgentProfile} from './agentModel';
const profile={...emptyAgentProfile(),birthDate:'1940-01-01',birthTime:'08:00'};
test('multiple burial candidates satisfy actual day/time almanac and natal branch filters without birthplace',()=>{
 const result=burialCandidates(profile,'2026-10-24','2026-11-24');assert.ok(result.length>1);
 const chart=calculateAgentBazi({...profile,birthplace:'北京时间'});assert.ok(chart.ready);if(!chart.ready)return;
 for(const c of result){const [y,m,d]=c.date.split('-').map(Number),l=Solar.fromYmdHms(y,m,d,Number(c.start.slice(0,2)),0,0).getLunar();assert.ok(l.getDayYi().includes('安葬'));assert.ok(l.getTimeYi().includes('安葬'));assert.ok(!l.getDayJi().includes('安葬'));assert.ok(!l.getTimeJi().includes('安葬'));assert.ok(chart.pillars.every(p=>!branchClash(p.slice(-1),l.getDayZhi())&&!branchClash(p.slice(-1),l.getTimeZhi())));assert.ok(c.start>='07:00'&&c.end<='18:59');}
 assert.equal(new Set(result.map(c=>c.date+c.start)).size,result.length);
});
test('birth time, invalid ranges and burial before death are rejected; empty results are not fabricated',()=>{
 assert.throws(()=>burialCandidates({...profile,birthTime:''},'2026-10-24','2026-11-24'),/出生日期和出生时间/);
 assert.throws(()=>burialCandidates(profile,'2026-02-30','2026-11-24'),/有效日期/);
 assert.throws(()=>burialCandidates(profile,'2026-11-24','2026-10-24'),/范围/);
 assert.throws(()=>burialCandidates(profile,'2026-10-24','2027-10-24'),/范围/);
 assert.throws(()=>burialCandidates({...profile,deathDate:'2026-11-24'},'2026-10-24','2026-11-24'),/逝世日期/);
 assert.deepEqual(burialCandidates(profile,'2026-10-24','2026-10-24'),[]);
});

test('default range includes death day and covers exactly seven calendar days across month/year boundaries',()=>{assert.deepEqual(defaultBurialRange('2026-10-20'),{from:'2026-10-20',to:'2026-10-26'});assert.deepEqual(defaultBurialRange('2026-12-29'),{from:'2026-12-29',to:'2027-01-04'});assert.throws(()=>defaultBurialRange('2026-02-30'));});
