import {randomUUID} from 'node:crypto';
export function makeBattle(){return {phase:'lobby',players:{},ideas:[],votes:{},final:{},deadline:null}}
export function battleView(r,id){const g=r.game,players=Object.values(g.players);const representatives=[0,1].map(side=>g.ideas.filter(a=>a.side===side).sort((a,b)=>b.likes.length-a.likes.length||a.order-b.order).slice(0,3).map(a=>a.id));
 const scores=[0,1].map(side=>g.ideas.filter(a=>a.side===side).reduce((n,a)=>n+10+a.likes.length*5,0)+Object.values(g.votes).filter(x=>x===side).length*20+Object.values(g.final).filter(x=>x===side).length*10+Object.entries(g.final).filter(([pid,s])=>s===side&&g.players[pid].side!==side).length*30);
 const totals=[0,1].map(side=>players.filter(p=>p.side===side).length), finalTotals=[0,1].map(side=>Object.values(g.final).filter(x=>x===side).length);
 return {phase:g.phase,deadline:g.deadline,players:players.map((p,i)=>({label:'참가자 '+(i+1),side:g.final[p.id]??p.side,changed:g.final[p.id]!==undefined&&g.final[p.id]!==p.side})),ideas:g.ideas.map(a=>({id:a.id,side:a.side,text:a.text,likes:a.likes.length,mine:a.author===id,liked:a.likes.includes(id)})),representatives,scores,totals,finalTotals,voteCount:Object.keys(g.votes).length,finalCount:Object.keys(g.final).length,me:g.players[id]?{side:g.players[id].side,idea:g.ideas.some(a=>a.author===id),voted:g.votes[id]!==undefined,final:g.final[id]!==undefined}:null};
}
export function battleAction(r,b){const g=r.game,id=String(b.id||'').slice(0,80),fail=msg=>{throw Error(msg)};
 if(b.action==='advance'){
  if(b.token!==r.token)fail('선생님만 라운드를 진행할 수 있습니다.');
  const phases=['lobby','ideas','duel','vote','final','finished'],i=phases.indexOf(g.phase);
  if(i===phases.length-1||r.closed)fail('이미 종료된 경기입니다.');
  if(g.phase==='lobby'&&Object.keys(g.players).length<2)fail('학생 두 명 이상이 참여해야 시작할 수 있어요.');
  g.phase=phases[i+1];g.deadline=g.phase==='duel'?Date.now()+120000:null;if(g.phase==='finished')r.closed=true;return;
 }
 if(r.closed)fail('종료된 경기입니다.');if(!id)fail('참가자 정보가 없습니다.');
 if(b.action==='join'){
  if(g.players[id])return;if(g.phase!=='lobby')fail('이미 시작된 경기입니다. 다음 경기에 참여해 주세요.');
  if(Object.keys(g.players).length>=100)fail('최대 100명까지 참여할 수 있습니다.');
  const n=Object.keys(g.players).length;g.players[id]={id,side:n%2};return;
 }
 const p=g.players[id];if(!p)fail('먼저 경기에 참여해 주세요.');
 if(b.action==='idea'){
  if(g.phase!=='ideas')fail('지금은 논리를 제출하는 시간이 아닙니다.');if(g.ideas.some(a=>a.author===id))fail('논리는 한 번만 제출할 수 있어요.');
  const text=String(b.text||'').trim().slice(0,300);if(!text)fail('논리를 입력해 주세요.');g.ideas.push({id:randomUUID(),author:id,side:p.side,text,likes:[],order:g.ideas.length});return;
 }
 if(b.action==='like'){
  if(g.phase!=='ideas')fail('공감 투표 시간이 끝났습니다.');const a=g.ideas.find(a=>a.id===b.idea);if(!a||a.side!==p.side||a.author===id)fail('같은 팀 친구의 논리에 공감해 주세요.');
  if(a.likes.includes(id))a.likes=a.likes.filter(v=>v!==id);else a.likes.push(id);return;
 }
 if(b.action==='vote'){
  if(g.phase!=='vote')fail('지금은 대표 대결 투표 시간이 아닙니다.');if(g.votes[id]!==undefined)fail('이미 투표했어요.');if(b.side!==0&&b.side!==1)fail('팀을 선택해 주세요.');g.votes[id]=b.side;return;
 }
 if(b.action==='final'){
  if(g.phase!=='final')fail('지금은 최종 선택 시간이 아닙니다.');if(g.final[id]!==undefined)fail('이미 최종 선택을 했어요.');if(b.side!==0&&b.side!==1)fail('팀을 선택해 주세요.');g.final[id]=b.side;return;
 }
 fail('지원하지 않는 동작입니다.');
}
