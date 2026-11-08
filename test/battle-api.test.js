import {test} from 'node:test';
import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://127.0.0.1:3000';
async function request(path,body,headers={}){const res=await fetch(base+'/api/'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...headers},body:body?JSON.stringify(body):undefined});return {status:res.status,data:await res.json()}}
test('API authenticates teacher hearts, persists toggles across polling, and enforces first-choice flow',async()=>{
 const {data:r}=await request('rooms',{type:'debate',game:true,question:'API 자유 토론',options:['찬성','반대']});
 const action=b=>request('rooms/'+r.code+'/battle',b);
 for(const id of ['a','b'])await action({action:'join',id});await action({action:'advance',token:r.token});await action({action:'idea',id:'a',text:'자유 의견'});
 const {data:state}=await request('rooms/'+r.code+'?id=b');assert.equal(state.game.me.side,null);const aid=state.game.ideas[0].id;
 assert.equal((await action({action:'like',id:'teacher-browser',token:'wrong',idea:aid})).status,400);
 const teacher=await action({action:'like',id:'teacher-browser',token:r.token,idea:aid});assert.equal(teacher.data.game.ideas[0].liked,true);
 const refreshed=await request('rooms/'+r.code+'?id=teacher-browser',undefined,{'X-Teacher-Token':r.token});assert.equal(refreshed.data.game.ideas[0].liked,true);assert.equal(refreshed.data.game.ideas[0].canLike,true);
 await action({action:'advance',token:r.token});assert.equal((await action({action:'advance',token:r.token})).status,400);
 await action({action:'choose',id:'a',side:0});await action({action:'choose',id:'b',side:1});await action({action:'advance',token:r.token});
 await action({action:'idea',id:'a',text:'재토론 의견'});const {data:discussion}=await request('rooms/'+r.code+'?id=b');assert.deepEqual(discussion.game.ideas.map(a=>a.round),['free','debate']);assert.equal(discussion.game.ideas[1].canLike,true);
 assert.equal((await action({action:'like',id:'b',idea:discussion.game.ideas[1].id})).data.game.ideas[1].liked,true);
});
