import {makeTeams} from './team-engine.js';
self.onmessage=event=>{try{self.postMessage({result:makeTeams(event.data)})}catch(error){self.postMessage({error:error.message})}};
