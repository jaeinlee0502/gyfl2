import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeBattle,battleAction as act,battleView as view,WRITING_TIME_MS,COMMENT_LIMIT} from '../battle.js';
import {buildBattleReport,battleResultText} from '../public/battle-report.js';
const room=()=>({game:makeBattle(),token:'teacher',closed:false});
const advance=r=>act(r,{action:'advance',token:'teacher'});
const join=(r,id)=>act(r,{action:'join',id});
const idea=(r,id,text)=>act(r,{action:'idea',id,text});
const choose=(r,id,side)=>act(r,{action:'choose',id,side});

test('open-first lifecycle: neutral entry, free comments, first choice, re-discussion, final movement',()=>{
 const r=room();assert.throws(()=>advance(r),/두 명/);assert.throws(()=>act(r,{action:'advance',token:'fake'}),/선생님/);
 for(const id of ['a','b','c'])join(r,id);assert.deepEqual(view(r).totals,[0,0]);assert.equal(view(r).neutralCount,3);assert.equal(view(r,'a').me.side,null);
 advance(r);assert.throws(()=>join(r,'d'),/시작된/);
 for(const [id,text] of [['a','처음 의견 A'],['b','처음 의견 B'],['c','처음 의견 C']])idea(r,id,text);
 assert.ok(view(r).ideas.every(a=>a.side===null&&a.round==='free'));assert.deepEqual(view(r).scores,[0,0]);
 act(r,{action:'like',id:'b',idea:r.game.ideas[0].id});act(r,{action:'like',token:'teacher',idea:r.game.ideas[1].id});
 advance(r);assert.equal(r.game.phase,'choose');assert.throws(()=>advance(r),/모든 학생/);
 choose(r,'a',0);choose(r,'b',1);choose(r,'c',0);assert.throws(()=>choose(r,'a',1),/이미/);assert.deepEqual(view(r).scores,[65,35]);
 advance(r);assert.equal(r.game.phase,'duel');assert.ok(view(r).players.every(p=>p.bubble===''));
 idea(r,'a','재토론 반론');assert.equal(view(r).ideas[3].round,'debate');assert.equal(view(r).ideas[3].side,0);assert.equal(view(r).players[0].bubble,'재토론 반론');assert.equal(view(r).players[0].bubbleRound,'debate');
 assert.equal(view(r).ideas[0].side,null);assert.equal(view(r).ideas[0].round,'free');
 advance(r);assert.equal(r.game.phase,'final');assert.throws(()=>idea(r,'a','마감'),/시간/);
 for(const [id,side] of [['a',1],['b',1],['c',0]])act(r,{action:'final',id,side});
 assert.throws(()=>act(r,{action:'final',id:'a',side:0}),/이미/);assert.equal(view(r).players[0].changed,true);assert.deepEqual(view(r).finalTotals,[1,2]);assert.deepEqual(view(r).scores,[75,85]);
 advance(r);assert.equal(r.closed,true);assert.equal(r.game.phase,'finished');assert.throws(()=>idea(r,'a','종료 후'),/종료/);
});

test('hearts: teacher and opposite-side students may toggle; self, spectators and closed phases explain refusal',()=>{
 const r=room();join(r,'a');join(r,'b');advance(r);idea(r,'a','의견');const aid=r.game.ideas[0].id;
 assert.equal(view(r,'b').ideas[0].canLike,true);assert.equal(view(r,'a').ideas[0].canLike,false);assert.match(view(r,'a').ideas[0].likeReason,/내 댓글/);
 assert.throws(()=>act(r,{action:'like',id:'a',idea:aid}),/내 댓글/);assert.throws(()=>act(r,{action:'like',id:'spectator',token:'fake',idea:aid}),/참가/);
 act(r,{action:'like',id:'b',idea:aid});assert.equal(view(r,'b').ideas[0].liked,true);act(r,{action:'like',id:'b',idea:aid});assert.equal(view(r).ideas[0].likes,0);
 act(r,{action:'like',token:'teacher',idea:aid});assert.equal(view(r,undefined,true).ideas[0].liked,true);act(r,{action:'like',token:'teacher',idea:aid});assert.equal(view(r).ideas[0].likes,0);
 advance(r);choose(r,'a',0);choose(r,'b',1);act(r,{action:'like',id:'b',idea:aid});advance(r);idea(r,'a','팀 의견');const bid=r.game.ideas[1].id;
 act(r,{action:'like',id:'b',idea:bid});assert.equal(view(r,'b').ideas[1].liked,true);
 advance(r);assert.equal(view(r,'b').ideas[1].canLike,false);assert.throws(()=>act(r,{action:'like',token:'teacher',idea:aid}),/단계/);
 advance(r);assert.match(view(r,undefined,true).ideas[0].likeReason,/종료/);
});

test('both writing rounds last five minutes with early advance and server-enforced expiry',()=>{
 const r=room();join(r,'a');join(r,'b');const before=Date.now();advance(r);
 assert.ok(r.game.deadline>=before+WRITING_TIME_MS);assert.ok(r.game.deadline<=Date.now()+WRITING_TIME_MS);
 idea(r,'a','첫 댓글');r.game.deadline=Date.now()-1;
 assert.throws(()=>idea(r,'b','만료 후 댓글'),/작성 시간이 끝/);assert.throws(()=>act(r,{action:'like',token:'teacher',idea:r.game.ideas[0].id}),/시간이 끝/);
 advance(r);assert.equal(r.game.deadline,null);choose(r,'a',0);choose(r,'b',1);advance(r);assert.ok(r.game.deadline>=Date.now()+WRITING_TIME_MS-50);
 idea(r,'b','재토론 댓글');advance(r);assert.equal(r.game.phase,'final');assert.equal(r.game.deadline,null);
});

test('comment validation, per-player limit, and one base award per author after first choice',()=>{
 const r=room();join(r,'a');join(r,'b');advance(r);
 assert.throws(()=>idea(r,'a',' '),/댓글을 입력/);assert.throws(()=>idea(r,'a','가'.repeat(301)),/300자/);
 for(let i=0;i<COMMENT_LIMIT;i++)idea(r,'a','의견 '+i);
 assert.equal(view(r,'a').me.commentCount,20);assert.equal(view(r).players[0].bubble,'의견 19');assert.throws(()=>idea(r,'a','21번째'),/20개/);
 advance(r);choose(r,'a',0);choose(r,'b',1);assert.deepEqual(view(r).scores,[30,20]);
});

test('revision and old stored game compatibility',()=>{
 const r=room();delete r.game.workflow;delete r.game.revision;join(r,'a');join(r,'b');assert.deepEqual(view(r).totals,[1,1]);advance(r);idea(r,'a','옛 방 의견');delete r.game.ideas[0].round;
 assert.equal(view(r).revision,4);assert.equal(view(r).ideas[0].round,'debate');assert.equal(view(r,'a').me.commentCount,1);assert.equal(view(r).players[0].id,undefined);assert.equal(view(r).ideas[0].author,undefined);
 const rev=view(r).revision;assert.throws(()=>act(r,{action:'advance',token:'fake'}));assert.equal(view(r).revision,rev);
 advance(r);assert.equal(r.game.phase,'duel');advance(r);assert.equal(r.game.phase,'vote');act(r,{action:'vote',id:'a',side:1});advance(r);act(r,{action:'final',id:'a',side:1});advance(r);assert.equal(r.closed,true);
});

test('report separates free and re-discussion comments, preserves escaping and choice summaries',()=>{
 const r=room();r.question='<script>alert(1)</script>';r.options=[{text:'찬성 <팀>'},{text:'반대 & 팀'}];
 join(r,'a');join(r,'b');advance(r);idea(r,'a','<img src=x onerror=alert(1)>\n자유 댓글 본문');advance(r);choose(r,'a',0);choose(r,'b',1);advance(r);idea(r,'a','재토론 본문');
 const data={...r,game:view(r),count:2};const report=buildBattleReport(data,'ABC234',{now:new Date('2026-11-08T00:00:00Z')});
 assert.ok(report.startsWith('<!doctype html>'));for(const t of ['참가자 1','자유 댓글 본문','재토론 본문','첫 찬반 선택','인쇄 / PDF로 저장','진행 중인 토론','미선택'])assert.ok(report.includes(t),t);
 assert.ok(report.indexOf('자유 댓글 본문')<report.indexOf('3. 재토론'));assert.ok(report.includes('&lt;img'));assert.ok(!report.includes('<script>'));assert.ok(!report.includes('<img'));assert.ok(!buildBattleReport(data,'ABC234',{printButton:false}).includes('onclick='));
 data.closed=true;data.game.phase='finished';assert.equal(battleResultText(data),'찬성 <팀> 팀 승리');data.game.scores=[0,0];assert.equal(battleResultText(data),'무승부');
});
