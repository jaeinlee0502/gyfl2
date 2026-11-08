import {randomUUID} from 'node:crypto';
export const WRITING_TIME_MS = 5 * 60 * 1000;
export const COMMENT_LIMIT = 20;
const NEW_FLOW = ['lobby','ideas','choose','duel','final','finished'];
const OLD_FLOW = ['lobby','ideas','duel','vote','final','finished'];
export function makeBattle(){return {workflow:'open-first',phase:'lobby',players:{},ideas:[],votes:{},final:{},deadline:null,revision:0}}
const isOpen=g=>g.workflow==='open-first';
const roundOf=(g,a)=>a.round||(isOpen(g)?'free':'debate');
const firstSide=(g,a)=>roundOf(g,a)==='free'?g.players[a.author]?.side:a.side;
function likeReason(r,a,id,isTeacher){
 const g=r.game;
 if(r.closed)return '토론이 종료되어 공감이 마감됐어요.';
 if(!['ideas','choose','duel'].includes(g.phase))return '자유 댓글·첫 선택·재토론 단계에서 공감할 수 있어요.';
 if(g.deadline&&Date.now()>=g.deadline)return '작성 시간이 끝나 공감이 마감됐어요.';
 if(!isTeacher&&!g.players[id])return '토론에 참가하면 공감할 수 있어요.';
 if(!isTeacher&&a.author===id)return '내 댓글에는 공감할 수 없어요.';
 return '';
}
export function battleView(r,id,isTeacher=false){
 const g=r.game,players=Object.values(g.players),open=isOpen(g),liker=isTeacher?'host':id;
 const scores=[0,1].map(side=>new Set(g.ideas.filter(a=>firstSide(g,a)===side).map(a=>a.author)).size*10+g.ideas.filter(a=>firstSide(g,a)===side).reduce((n,a)=>n+a.likes.length*5,0)+Object.values(g.votes).filter(x=>x===side).length*20+Object.values(g.final).filter(x=>x===side).length*10+Object.entries(g.final).filter(([pid,s])=>s===side&&g.players[pid].side!==side).length*30);
 const totals=[0,1].map(side=>players.filter(p=>p.side===side).length),finalTotals=[0,1].map(side=>Object.values(g.final).filter(x=>x===side).length);
 const labels=new Map(players.map((p,i)=>[p.id,'참가자 '+(i+1)]));
 return {
  workflow:g.workflow||'teams-first',phase:g.phase,deadline:g.deadline,revision:g.revision||0,
  players:players.map(p=>{
   const bubble=g.ideas.findLast(a=>a.author===p.id&&(!open||g.phase!=='duel'||roundOf(g,a)==='debate'));
   return {label:labels.get(p.id),side:g.final[p.id]??p.side??null,changed:g.final[p.id]!==undefined&&g.final[p.id]!==p.side,bubble:bubble?.text||'',bubbleRound:bubble?roundOf(g,bubble):null};
  }),
  ideas:g.ideas.map(a=>{
   const reason=likeReason(r,a,id,isTeacher);
   return {id:a.id,side:a.side??null,round:roundOf(g,a),text:a.text,authorLabel:labels.get(a.author)||'참가자',likes:a.likes.length,mine:!isTeacher&&a.author===id,liked:a.likes.includes(liker),canLike:!reason,likeReason:reason};
  }),
  scores,totals,neutralCount:players.filter(p=>p.side!==0&&p.side!==1).length,finalTotals,voteCount:Object.keys(g.votes).length,finalCount:Object.keys(g.final).length,
  me:!isTeacher&&g.players[id]?{side:g.players[id].side??null,idea:g.ideas.some(a=>a.author===id),commentCount:g.ideas.filter(a=>a.author===id).length,voted:g.votes[id]!==undefined,final:g.final[id]!==undefined}:null
 };
}
export function battleAction(r,b){
 const g=r.game,id=String(b.id||'').slice(0,80),open=isOpen(g),isTeacher=b.token===r.token,fail=msg=>{throw Error(msg)};
 const changed=()=>{g.revision=(g.revision||0)+1};
 if(b.action==='advance'){
  if(!isTeacher)fail('선생님만 단계를 진행할 수 있습니다.');
  const phases=open?NEW_FLOW:OLD_FLOW,i=phases.indexOf(g.phase);
  if(i<0||i===phases.length-1||r.closed)fail('이미 종료된 경기입니다.');
  if(g.phase==='lobby'&&Object.keys(g.players).length<2)fail('학생 두 명 이상이 참여해야 시작할 수 있어요.');
  if(g.phase==='choose'&&Object.values(g.players).some(p=>p.side!==0&&p.side!==1))fail('모든 학생이 첫 찬반 선택을 마쳐야 재토론을 시작할 수 있어요.');
  g.phase=phases[i+1];g.deadline=['ideas','duel'].includes(g.phase)?Date.now()+WRITING_TIME_MS:null;
  if(g.phase==='finished')r.closed=true;changed();return;
 }
 if(r.closed)fail('종료된 경기입니다.');
 if(b.action==='like'){
  const a=g.ideas.find(a=>a.id===b.idea);if(!a)fail('댓글을 찾을 수 없어요.');
  const reason=likeReason(r,a,id,isTeacher);if(reason)fail(reason);
  const liker=isTeacher?'host':id;
  if(a.likes.includes(liker))a.likes=a.likes.filter(v=>v!==liker);else a.likes.push(liker);changed();return;
 }
 if(!id)fail('참가자 정보가 없습니다.');
 if(b.action==='join'){
  if(g.players[id])return;if(g.phase!=='lobby')fail('이미 시작된 경기입니다. 다음 경기에 참여해 주세요.');
  if(Object.keys(g.players).length>=100)fail('최대 100명까지 참여할 수 있습니다.');
  const n=Object.keys(g.players).length;g.players[id]={id,side:open?null:n%2};changed();return;
 }
 const p=g.players[id];if(!p)fail('먼저 경기에 참여해 주세요.');
 if(b.action==='idea'){
  if(!['ideas','duel'].includes(g.phase))fail('지금은 댓글을 작성하는 시간이 아닙니다.');
  if(g.deadline&&Date.now()>=g.deadline)fail('작성 시간이 끝났습니다. 선생님이 다음 단계로 넘길 때까지 기다려 주세요.');
  if(open&&g.phase==='duel'&&p.side!==0&&p.side!==1)fail('첫 찬반 선택을 먼저 해 주세요.');
  if(g.ideas.filter(a=>a.author===id).length>=COMMENT_LIMIT)fail('한 경기에서 댓글은 20개까지 작성할 수 있어요.');
  const text=String(b.text||'').trim();if(!text)fail('댓글을 입력해 주세요.');if(Array.from(text).length>300)fail('댓글은 300자 이내로 입력해 주세요.');
  g.ideas.push({id:randomUUID(),author:id,side:open&&g.phase==='ideas'?null:p.side,round:open&&g.phase==='ideas'?'free':'debate',text,likes:[],order:g.ideas.length});changed();return;
 }
 if(b.action==='choose'){
  if(!open||g.phase!=='choose')fail('지금은 첫 찬반 선택 시간이 아닙니다.');
  if(g.votes[id]!==undefined)fail('이미 첫 찬반 선택을 마쳤어요.');
  if(b.side!==0&&b.side!==1)fail('입장을 선택해 주세요.');
  p.side=b.side;g.votes[id]=b.side;changed();return;
 }
 if(b.action==='vote'){
  if(open||g.phase!=='vote')fail('지금은 토론 투표 시간이 아닙니다.');if(g.votes[id]!==undefined)fail('이미 투표했어요.');if(b.side!==0&&b.side!==1)fail('팀을 선택해 주세요.');g.votes[id]=b.side;changed();return;
 }
 if(b.action==='final'){
  if(g.phase!=='final')fail('지금은 최종 선택 시간이 아닙니다.');if(g.final[id]!==undefined)fail('이미 최종 선택을 했어요.');if(b.side!==0&&b.side!==1)fail('팀을 선택해 주세요.');g.final[id]=b.side;changed();return;
 }
 fail('지원하지 않는 동작입니다.');
}
