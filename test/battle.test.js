import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeBattle,battleAction as act,battleView as view,WRITING_TIME_MS,COMMENT_LIMIT} from '../battle.js';
import {buildBattleReport,battleResultText} from '../public/battle-report.js';
const room=()=>({game:makeBattle(),token:'teacher',closed:false});
const advance=r=>act(r,{action:'advance',token:'teacher'});
const join=(r,id)=>act(r,{action:'join',id});
const idea=(r,id,text)=>act(r,{action:'idea',id,text});

test('full battle: team balance, threaded comments, votes, final movement, scores',()=>{
 const r=room();assert.throws(()=>advance(r),/두 명/);assert.throws(()=>act(r,{action:'advance',token:'fake'}),/선생님/);
 for(const id of ['a','b','c','d'])join(r,id);assert.deepEqual(view(r).totals,[2,2]);join(r,'a');assert.equal(view(r).players.length,4);
 advance(r);assert.throws(()=>join(r,'e'),/시작된/);
 for(const [id,text] of [['a','근거 A'],['b','근거 B'],['c','근거 C']])idea(r,id,text);
 const aid=view(r,'a').ideas.find(a=>a.mine).id;
 assert.throws(()=>act(r,{action:'like',id:'b',idea:aid}),/같은 팀/);act(r,{action:'like',id:'c',idea:aid});assert.equal(view(r).ideas[0].likes,1);
 assert.equal(view(r).players[0].id,undefined);assert.equal(view(r).ideas[0].author,undefined);
 advance(r);assert.equal(r.game.phase,'duel');idea(r,'a','댓글 반론');assert.equal(view(r).ideas.length,4);assert.deepEqual(view(r).scores,[25,10]);
 assert.equal(view(r).players[0].bubble,'댓글 반론');assert.equal(view(r).ideas[3].authorLabel,'참가자 1');
 advance(r);assert.throws(()=>idea(r,'d','투표 중 댓글'),/시간/);
 for(const id of ['a','b','c'])act(r,{action:'vote',id,side:1});assert.throws(()=>act(r,{action:'vote',id:'a',side:0}),/이미/);
 advance(r);act(r,{action:'final',id:'a',side:1});act(r,{action:'final',id:'b',side:1});act(r,{action:'final',id:'c',side:0});
 assert.throws(()=>act(r,{action:'final',id:'a',side:0}),/이미/);assert.equal(view(r).players[0].changed,true);assert.deepEqual(view(r).finalTotals,[1,2]);assert.deepEqual(view(r).scores,[35,120]);
 advance(r);assert.equal(r.closed,true);assert.equal(r.game.phase,'finished');assert.throws(()=>idea(r,'d','종료 후 댓글'),/종료/);
});

test('both writing rounds last five minutes; teacher can advance early; expiry is enforced on server',()=>{
 const r=room();join(r,'a');join(r,'b');const before=Date.now();advance(r);
 assert.ok(r.game.deadline>=before+WRITING_TIME_MS);assert.ok(r.game.deadline<=Date.now()+WRITING_TIME_MS);
 idea(r,'a','첫 댓글');r.game.deadline=Date.now()-1;
 assert.throws(()=>idea(r,'b','만료 후 댓글'),/작성 시간이 끝/);
 assert.throws(()=>act(r,{action:'like',id:'b',idea:r.game.ideas[0].id}),/시간이 끝/);
 advance(r);assert.equal(r.game.phase,'duel');assert.ok(r.game.deadline>=Date.now()+WRITING_TIME_MS-50);
 idea(r,'b','새 라운드 댓글');advance(r);assert.equal(r.game.phase,'vote');assert.equal(r.game.deadline,null);
});

test('comments can repeat without earning extra base points, and validate length and per-player limit',()=>{
 const r=room();join(r,'a');join(r,'b');advance(r);
 assert.throws(()=>idea(r,'a',' '),/댓글을 입력/);assert.throws(()=>idea(r,'a','가'.repeat(301)),/300자/);
 for(let i=0;i<COMMENT_LIMIT;i++)idea(r,'a','의견 '+i);
 assert.equal(view(r,'a').me.commentCount,20);assert.equal(view(r).scores[0],10);assert.equal(view(r).players[0].bubble,'의견 19');
 assert.throws(()=>idea(r,'a','21번째'),/20개/);assert.equal(view(r).ideas.length,20);
});

test('revision advances on successful mutations only and personal labels survive old stored games',()=>{
 const r=room();delete r.game.revision;join(r,'a');join(r,'b');advance(r);idea(r,'a','테스트');
 assert.equal(view(r).revision,4);assert.equal(view(r,'a').me.commentCount,1);assert.equal(view(r,'b').me.commentCount,0);
 const revision=view(r).revision;assert.throws(()=>act(r,{action:'advance',token:'wrong'}));assert.equal(view(r).revision,revision);
});

test('visual report is standalone, contains readable comments and scores, escapes user text',()=>{
 const r=room();r.question='<script>alert(1)</script>';r.options=[{text:'찬성 <팀>'},{text:'반대 & 팀'}];
 join(r,'a');join(r,'b');advance(r);idea(r,'a','<img src=x onerror=alert(1)>\n두 번째 줄');
 const data={...r,game:view(r),count:2};const report=buildBattleReport(data,'ABC234',{now:new Date('2026-11-08T00:00:00Z')});
 assert.ok(report.startsWith('<!doctype html>'));assert.ok(report.includes('참가자 1'));assert.ok(report.includes('두 번째 줄'));assert.ok(report.includes('&lt;img'));assert.ok(!report.includes('<script>'));assert.ok(!report.includes('<img'));assert.ok(report.includes('인쇄 / PDF로 저장'));assert.ok(report.includes('진행 중인 토론'));assert.ok(report.includes('미선택'));
 assert.ok(!buildBattleReport(data,'ABC234',{printButton:false}).includes('onclick='));
 data.closed=true;data.game.phase='finished';assert.equal(battleResultText(data),'찬성 <팀> 팀 승리');
 data.game.scores=[0,0];assert.equal(battleResultText(data),'무승부');
});
