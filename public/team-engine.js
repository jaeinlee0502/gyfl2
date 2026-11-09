const MAX_PEOPLE=200;
const fail=message=>{throw Error(message)};
const random=()=>{const word=new Uint32Array(1);globalThis.crypto.getRandomValues(word);return word[0]/4294967296};
function shuffle(list,rng){const copy=[...list];for(let i=copy.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]]}return copy}
export function parseTeamNames(text){
 const names=String(text).split(/[\n,]+/).map(n=>n.trim().normalize('NFC')).filter(Boolean);
 if(names.length<2)fail('학생을 두 명 이상 입력해 주세요.');if(names.length>MAX_PEOPLE)fail('학생은 200명까지 입력할 수 있어요.');
 if(names.some(n=>n.length>40))fail('이름은 40자 이내로 입력해 주세요.');
 if(new Set(names).size!==names.length)fail('같은 이름이 있어요. 번호를 붙여 서로 구분해 주세요. 예: 1번 김민지, 12번 김민지');
 return names;
}
export function numberedTeamNames(total,excluded=''){
 total=Number(total);if(!Number.isInteger(total)||total<2||total>MAX_PEOPLE)fail('총 학생 수를 2~200명으로 입력해 주세요.');
 const omitted=new Set();
 for(const token of String(excluded).split(/[\s,]+/).filter(Boolean)){
  const match=token.match(/^(\d+)(?:-(\d+))?$/);if(!match)fail('제외 번호는 3, 7-9처럼 입력해 주세요.');
  const start=Number(match[1]),end=Number(match[2]||match[1]);
  if(start<1||end>total||end<start)fail('제외 번호가 학생 수 범위를 벗어나거나 순서가 잘못됐어요.');
  for(let n=start;n<=end;n++)omitted.add(n);
 }
 const names=Array.from({length:total},(_,i)=>i+1).filter(n=>!omitted.has(n)).map(n=>n+'번');
 if(names.length<2)fail('제외 번호를 빼고 두 명 이상이 남아야 해요.');return names;
}

export function makeTeams({names,method='count',amount=6,balance=false,skills={},rules=[]},rng=random){
 if(!Array.isArray(names))fail('명단을 먼저 입력해 주세요.');
 names=parseTeamNames(names.join('\n'));
 if(!['count','size'].includes(method))fail('팀 수 또는 팀당 인원 기준을 선택해 주세요.');
 amount=Number(amount);if(!Number.isInteger(amount)||amount<1||amount>names.length)fail('팀 수 또는 팀당 인원을 참여 학생 수 안에서 정해 주세요.');
 const teamCount=method==='count'?amount:Math.ceil(names.length/amount);
 const capacities=Array.from({length:teamCount},(_,i)=>Math.floor(names.length/teamCount)+(i<names.length%teamCount?1:0));
 const people=names.map(name=>{
  const skill=balance?Number(Object.hasOwn(skills,name)?skills[name]:5):5;
  if(!Number.isInteger(skill)||skill<1||skill>10)fail('능력치는 1~10 사이의 정수로 입력해 주세요.');
  return {name,skill};
 });
 const byName=new Map(people.map((p,i)=>[p.name,i]));
 if(!Array.isArray(rules)||rules.length>50)fail('묶음·분리 조건은 50개까지 설정할 수 있어요.');
 for(const rule of rules){
  if(!['together','apart'].includes(rule.type)||!Array.isArray(rule.members)||new Set(rule.members).size<2||new Set(rule.members).size!==rule.members.length)fail('각 묶음·분리 조건에는 서로 다른 학생을 두 명 이상 골라 주세요.');
  for(const member of rule.members)if(!byName.has(member))fail('조건에 있는 '+member+' 학생이 명단에 없어요. 해당 조건을 지우거나 명단을 수정해 주세요.');
  if(rule.type==='apart'&&rule.members.length>teamCount)fail('분리할 학생 '+rule.members.length+'명을 나누려면 팀이 '+rule.members.length+'개 이상 필요해요.');
 }
 const parent=people.map((_,i)=>i);
 const root=i=>parent[i]===i?i:(parent[i]=root(parent[i]));
 for(const rule of rules.filter(r=>r.type==='together')){
  const first=byName.get(rule.members[0]);for(const member of rule.members)parent[root(byName.get(member))]=root(first);
 }
 const components=new Map();people.forEach((p,i)=>{const key=root(i);if(!components.has(key))components.set(key,[]);components.get(key).push(p)});
 const units=Array.from(components.values(),(members,id)=>({id,members,skill:members.reduce((n,p)=>n+p.skill,0),neighbors:new Set()}));
 const unitOf=new Map();for(const unit of units)for(const p of unit.members)unitOf.set(p.name,unit.id);
 for(const rule of rules.filter(r=>r.type==='apart'))for(const a of rule.members)for(const b of rule.members){
  if(a===b)continue;const i=unitOf.get(a),j=unitOf.get(b);
  if(i===j)fail(a+' 학생과 '+b+' 학생이 묶음·분리 조건에 동시에 들어 있어요. 조건을 조정해 주세요.');
  units[i].neighbors.add(j);
 }
 if(units.some(u=>u.members.length>Math.max(...capacities)))fail('함께 묶은 학생 수가 한 팀 인원보다 많아요. 팀 수를 줄이거나 묶음 조건을 조정해 주세요.');
 const totalSkill=people.reduce((n,p)=>n+p.skill,0),target=totalSkill/names.length;
 let best=null,bestCost=Infinity,hitLimit=false;
 const maxNodes=12000,attempts=balance?(names.length>80?5:10):1;
 for(let attempt=0;attempt<attempts;attempt++){
  const caps=shuffle(capacities,rng),teams=caps.map(()=>[]),counts=caps.map(()=>0),sums=caps.map(()=>0),assignment=Array(units.length).fill(-1);
  let nodes=0,limited=false;
  const allowed=(unit,t)=>counts[t]+unit.members.length<=caps[t]&&![...unit.neighbors].some(n=>assignment[n]===t);
  function search(remaining){
   if(!remaining.length)return true;if(++nodes>maxNodes){limited=true;return false}
   let pick,choices;
   for(const unit of remaining){
    const opts=caps.map((_,i)=>i).filter(t=>allowed(unit,t));if(!opts.length)return false;
    if(!pick||opts.length<choices.length||opts.length===choices.length&&(unit.members.length>pick.members.length||unit.members.length===pick.members.length&&unit.neighbors.size>pick.neighbors.size)){pick=unit;choices=opts}
   }
   choices=shuffle(choices,rng);
   if(balance)choices.sort((a,b)=>(sums[a]+pick.skill)/caps[a]-(sums[b]+pick.skill)/caps[b]);
   const rest=remaining.filter(u=>u!==pick),emptySizes=new Set();
   for(const t of choices){
    if(!counts[t]){if(emptySizes.has(caps[t]))continue;emptySizes.add(caps[t])}
    assignment[pick.id]=t;counts[t]+=pick.members.length;sums[t]+=pick.skill;teams[t].push(pick);
    if(search(rest))return true;
    teams[t].pop();counts[t]-=pick.members.length;sums[t]-=pick.skill;assignment[pick.id]=-1;
    if(limited)return false;
   }
   return false;
  }
  // Order affects unconstrained ties; keep every run random while respecting constraints.
  const order=shuffle(units,rng);if(balance)order.sort((a,b)=>b.skill/b.members.length-a.skill/a.members.length);
  if(!search(order)){hitLimit ||= limited;if(!limited&&!best)break;continue}
  if(balance){
   for(let pass=0;pass<6;pass++){
    let improved=false;
    for(let a=0;a<teams.length;a++)for(let b=a+1;b<teams.length;b++)for(let i=0;i<teams[a].length;i++)for(let j=0;j<teams[b].length;j++){
     const x=teams[a][i],y=teams[b][j];if(x.members.length!==y.members.length)continue;
     if(teams[b].some(u=>u!==y&&x.neighbors.has(u.id))||teams[a].some(u=>u!==x&&y.neighbors.has(u.id)))continue;
     const delta=y.skill-x.skill;
     const before=(sums[a]-target*caps[a])**2+(sums[b]-target*caps[b])**2;
     const after=(sums[a]+delta-target*caps[a])**2+(sums[b]-delta-target*caps[b])**2;
     if(after+1e-9<before){teams[a][i]=y;teams[b][j]=x;sums[a]+=delta;sums[b]-=delta;improved=true}
    }
    if(!improved)break;
   }
  }
  const cost=sums.reduce((n,sum,t)=>n+(sum-target*caps[t])**2,0);
  if(!best||cost<bestCost){bestCost=cost;best=teams.map((team,i)=>({name:(i+1)+'팀',members:shuffle(team.flatMap(u=>u.members),rng),skill:sums[i]}))}
  if(!balance||cost<1e-9)break;
 }
 if(!best)fail(hitLimit?'조건이 복잡해 배정을 찾지 못했어요. 묶음·분리 조건을 줄이거나 팀 수를 바꿔 다시 시도해 주세요.':'현재 팀 수와 인원으로 묶음·분리 조건을 모두 만족할 수 없어요. 조건이나 팀 수를 조정해 주세요.');
 return {teams:best,count:names.length,balance,method,amount,ruleCount:rules.length};
}
