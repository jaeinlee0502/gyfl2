import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeTeams,parseTeamNames,numberedTeamNames} from '../public/team-engine.js';
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
