import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeTeams,parseTeamNames,numberedTeamNames,schoolTeamRoster} from '../public/team-engine.js';
import {teamReport,teamText} from '../public/teams.js';
const names=n=>Array.from({length:n},(_,i)=>(i+1)+'번');
function seeded(seed=7){return ()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}}
function verify(result,expected,rules=[]){
 const found=result.teams.flatMap(t=>t.members.map(p=>p.name));assert.equal(found.length,expected.length);assert.equal(new Set(found).size,expected.length);assert.deepEqual([...found].sort(),[...expected].sort());
 const sizes=result.teams.map(t=>t.members.length);assert.ok(Math.max(...sizes)-Math.min(...sizes)<=1);
 const where=new Map();result.teams.forEach((t,i)=>t.members.forEach(p=>where.set(p.name,i)));
 for(const rule of rules){const assigned=rule.members.map(n=>where.get(n));assert.equal(new Set(assigned).size,rule.type==='together'?1:rule.members.length)}
 for(const t of result.teams)assert.equal(t.skill,t.members.reduce((n,p)=>n+p.skill,0));
}

test('roster parsing supports names/numbers/exclusions and rejects ambiguous or invalid input',()=>{
 assert.deepEqual(parseTeamNames('김민지\n 이서준,박지우 '),['김민지','이서준','박지우']);assert.throws(()=>parseTeamNames('김민지\n김민지'),/같은 이름/);assert.throws(()=>parseTeamNames('가\n가'),/같은 이름/);
 assert.deepEqual(numberedTeamNames(6,'2, 4-5'),['1번','3번','6번']);assert.throws(()=>numberedTeamNames(5,'1-5'),/두 명/);assert.throws(()=>numberedTeamNames(5,'7'),/범위/);assert.throws(()=>numberedTeamNames(5,'4-2'),/범위/);assert.throws(()=>numberedTeamNames(201),/200/);
});

test('random count and team-size modes preserve all students and balance uneven class sizes',()=>{
 for(const n of [2,7,30,31,200])for(const amount of [1,2,Math.min(n,6)])for(const method of ['count','size']){
  const list=names(n),result=makeTeams({names:list,method,amount},seeded(n+amount));verify(result,list);
  assert.equal(result.teams.length,method==='count'?amount:Math.ceil(n/amount));if(method==='size')assert.ok(result.teams.every(t=>t.members.length<=amount));
 }
 assert.throws(()=>makeTeams({names:names(3),amount:4}),/참여 학생/);
});

test('together and apart groups obey overlapping and transitive constraints across repeated seeds',()=>{
 const list=names(12),rules=[{type:'together',members:['1번','2번']},{type:'together',members:['2번','3번']},{type:'apart',members:['1번','4번','5번']}];
 for(let seed=1;seed<=20;seed++)verify(makeTeams({names:list,amount:3,rules},seeded(seed)),list,rules);
});

test('contradictions, stale roster references, capacity conflicts and non-colorable separation are rejected',()=>{
 const run=rules=>makeTeams({names:names(8),amount:3,rules},seeded());
 assert.throws(()=>run([{type:'together',members:['1번','2번']},{type:'apart',members:['1번','2번']}]),/동시에/);
 assert.throws(()=>run([{type:'together',members:['1번','9번']}]),/명단/);
 assert.throws(()=>run([{type:'apart',members:['1번','2번','3번','4번']}]),/4개/);
 assert.throws(()=>run([{type:'together',members:['1번','2번','3번','4번']}]),/인원보다/);
 const pairs=[['1번','2번'],['3번','4번'],['5번','6번'],['7번','8번']].map(members=>({type:'together',members}));assert.throws(()=>run(pairs),/만족할 수 없/);
 const triangle=[['1번','2번'],['2번','3번'],['1번','3번']].map(members=>({type:'apart',members}));assert.throws(()=>makeTeams({names:names(6),amount:2,rules:triangle},seeded()),/만족할 수 없/);
});

test('ability balancing reduces a representative class to equal totals while keeping constraints',()=>{
 const list=names(8),skills=Object.fromEntries(list.map((n,i)=>[n,i+1]));
 for(let seed=1;seed<=10;seed++){
  const rules=[{type:'together',members:['1번','8번']},{type:'apart',members:['2번','3번']}];
  const result=makeTeams({names:list,amount:2,balance:true,skills,rules},seeded(seed));verify(result,list,rules);assert.deepEqual(result.teams.map(t=>t.skill),[18,18]);
 }
 assert.throws(()=>makeTeams({names:list,amount:2,balance:true,skills:{'1번':11}}),/1~10/);
});

test('saved team report escapes names, includes every team and omits personal ability scores',()=>{
 const list=['<script>alert(1)</script>','김민지 & 친구','가영','나영'];const result=makeTeams({names:list,amount:2},seeded());
 const html=teamReport(result);assert.ok(html.startsWith('<!doctype html>'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('김민지 &amp; 친구'));assert.ok(html.includes('인쇄 / PDF로 저장'));assert.ok(html.includes('1팀'));assert.ok(html.includes('2팀'));assert.equal((html.match(/<li>/g)||[]).length,4);assert.ok(!html.includes('5점'));assert.ok(teamText(result).includes('1팀 (2명)'));
});


test('school roster uses separate fixed number starts and actual counts without filling gaps',()=>{
 const roster=schoolTeamRoster(20,10);
 assert.equal(roster.names.length,30);assert.deepEqual(roster.names.slice(18,23),['19번','20번','31번','32번','33번']);assert.ok(!roster.names.includes('21번'));assert.ok(!roster.names.includes('30번'));
 assert.equal(roster.genders['20번'],'female');assert.equal(roster.genders['31번'],'male');assert.equal(roster.names.at(-1),'40번');
 const absent=schoolTeamRoster(20,10,'3, 35-37');assert.equal(absent.names.length,26);assert.ok(!absent.names.includes('3번'));assert.ok(!absent.names.includes('36번'));assert.equal(Object.values(absent.genders).filter(g=>g==='female').length,19);assert.equal(Object.values(absent.genders).filter(g=>g==='male').length,7);
 const full=schoolTeamRoster(30,20);assert.equal(full.names.length,50);assert.equal(full.genders['30번'],'female');assert.equal(full.genders['50번'],'male');assert.deepEqual(schoolTeamRoster(0,3).names,['31번','32번','33번']);
 for(const [f,m] of [['',10],[20,''],[31,0],[0,21],[-1,10],[1.5,10],[0,1]])assert.throws(()=>schoolTeamRoster(f,m));
 assert.throws(()=>schoolTeamRoster(20,10,'25'),/실제 명단/);assert.throws(()=>schoolTeamRoster(20,10,'19-32'),/실제 명단/);
});

function verifyGenders(result){
 for(const gender of ['female','male']){
  const counts=result.teams.map(t=>t.members.filter(p=>p.gender===gender).length);assert.ok(Math.max(...counts)-Math.min(...counts)<=1,JSON.stringify(counts));
  result.teams.forEach((t,i)=>assert.equal(t[gender],counts[i]));
 }
}

test('gender balance preserves total and per-gender fairness across uneven classes, one-sex classes and different team counts',()=>{
 for(const [f,m,amount] of [[20,10,6],[15,8,5],[0,10,3],[30,20,6],[1,20,6],[7,4,3],[30,1,7]])for(let seed=1;seed<=12;seed++){
  const roster=schoolTeamRoster(f,m),result=makeTeams({...roster,amount,genderBalance:true},seeded(seed));verify(result,roster.names);verifyGenders(result);assert.equal(result.hasGenders,true);assert.equal(result.genderBalance,true);
 }
 const roster=schoolTeamRoster(20,10,'3,35-37'),result=makeTeams({...roster,amount:5,method:'size',genderBalance:true},seeded());verify(result,roster.names);verifyGenders(result);assert.ok(result.teams.every(t=>t.members.length<=5));
});

test('gender balance survives together/apart constraints and ability-improving swaps',()=>{
 const roster=schoolTeamRoster(8,4),rules=[{type:'together',members:['1번','31번']},{type:'apart',members:['2번','3번','4번']}],skills=Object.fromEntries(roster.names.map((name,i)=>[name,i%10+1]));
 for(let seed=1;seed<=15;seed++){
  const result=makeTeams({...roster,amount:3,genderBalance:true,balance:true,skills,rules},seeded(seed));verify(result,roster.names,rules);verifyGenders(result);
 }
});

test('impossible gender/group combinations explain the conflict and permit opting out',()=>{
 const roster=schoolTeamRoster(4,4),rules=[{type:'together',members:['1번','2번','3번']}];
 assert.throws(()=>makeTeams({...roster,amount:2,genderBalance:true,rules}),/성별 균형/);
 const result=makeTeams({...roster,amount:2,genderBalance:false,rules},seeded());verify(result,roster.names,rules);assert.equal(result.hasGenders,true);
 assert.throws(()=>makeTeams({names:['김민지','이서준'],amount:2,genderBalance:true}),/학교 번호/);
});

test('saved school team report shows aggregate gender counts without inventing unused numbers',()=>{
 const roster=schoolTeamRoster(4,2),result=makeTeams({...roster,amount:2,genderBalance:true},seeded());const html=teamReport(result);
 assert.ok(html.includes('여학생 2명 · 남학생 1명'));assert.ok(html.includes('여학생 수와 남학생 수 차이도 각각 최대 1명'));assert.ok(!html.includes('<li>5번</li>'));assert.ok(html.includes('<li>31번</li>'));
});
