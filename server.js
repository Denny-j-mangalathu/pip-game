import http from 'node:http';
import {readFileSync,writeFileSync,renameSync,mkdirSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import path from 'node:path';
const root=path.resolve(fileURLToPath(new URL('./public/',import.meta.url)));
const dataDir=process.env.PIP_DATA_DIR||fileURLToPath(new URL('./data/',import.meta.url));
mkdirSync(dataDir,{recursive:true});
const dataFile=path.join(dataDir,'rooms.json');
// Fail at startup if persisted data is damaged rather than silently discarding it.
let rooms=existsSync(dataFile)?JSON.parse(readFileSync(dataFile,'utf8')):{};
function persist(next){writeFileSync(dataFile+'.tmp',JSON.stringify(next),{mode:0o600});renameSync(dataFile+'.tmp',dataFile);rooms=next;}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
async function body(req){let value='';for await(const chunk of req){value+=chunk;if(value.length>4096)throw new Error('Request too large');}return JSON.parse(value||'{}');}
function authorized(req,room){const supplied=Buffer.from((req.headers.authorization||'').replace(/^Bearer /,''));const token=Buffer.from(room.token);return supplied.length===token.length&&timingSafeEqual(supplied,token);}
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/api/rooms'&&req.method==='POST'){
      await body(req);
      if(Object.keys(rooms).length>=1000)return json(res,503,{error:'This server has reached its home limit.'});
      const id=randomBytes(12).toString('hex');const token=randomBytes(24).toString('hex');
      const pet={fullness:65,joy:70,energy:80,sleeping:false,leaves:0,version:0};
      persist({...rooms,[id]:{token,pet,actions:{},lastAction:0}});
      return json(res,201,{id,token,pet});
    }
    const match=url.pathname.match(/^\/api\/rooms\/([a-f0-9]{24})$/);
    if(match){
      const id=match[1];let room=rooms[id];
      if(!room||!authorized(req,room))return json(res,403,{error:'That invite is invalid. Ask your friend for a new copy.'});
      if(req.method==='GET')return json(res,200,{pet:room.pet});
      if(req.method==='POST'){
        const action=await body(req);
        room=rooms[id];
        if(!['feed','play','rest','leaf'].includes(action.type)||typeof action.actionId!=='string'||!/^[a-f0-9-]{36}$/.test(action.actionId)||!Number.isInteger(action.version))return json(res,400,{error:'Invalid care action.'});
        if(room.actions[action.actionId])return json(res,200,{pet:room.pet});
        if(action.version!==room.pet.version)return json(res,409,{error:'Pip just changed. Take a look and try again.',pet:room.pet});
        if(Date.now()-room.lastAction<300)return json(res,429,{error:'One moment. Pip is catching up.'});
        if(action.type==='play'&&room.pet.sleeping)return json(res,409,{error:'Pip is sleeping. Wake Pip first.',pet:room.pet});
        const pet={...room.pet,version:room.pet.version+1};
        if(action.type==='feed'){pet.fullness=Math.min(100,pet.fullness+20);pet.sleeping=false;}
        if(action.type==='play'){pet.joy=Math.min(100,pet.joy+15);pet.energy=Math.max(0,pet.energy-8);}
        if(action.type==='rest'){pet.sleeping=!pet.sleeping;if(pet.sleeping)pet.energy=Math.min(100,pet.energy+25);}
        if(action.type==='leaf')pet.leaves++;
        // A version check protects against old retries even after their IDs are pruned.
        const entries=Object.entries(room.actions).slice(-499);
        persist({...rooms,[id]:{...room,pet,lastAction:Date.now(),actions:{...Object.fromEntries(entries),[action.actionId]:pet.version}}});
        return json(res,200,{pet});
      }
      return json(res,405,{error:'Method not allowed'});
    }
    if(url.pathname.startsWith('/api/'))return json(res,404,{error:'Unknown endpoint'});
    if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'Method not allowed'});
    const relative=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);
    const file=path.resolve(root,'.'+relative);
    if(!file.startsWith(root+path.sep)&&file!==path.join(root,'index.html'))return json(res,403,{error:'Forbidden'});
    try{const content=readFileSync(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'"});res.end(req.method==='HEAD'?undefined:content);}
    catch{return json(res,404,{error:'File not found'});}
  }catch(error){console.error(error.message);json(res,400,{error:'Could not save that action. Please try again.'});}
});
server.listen(Number(process.env.PORT)||3000,process.env.HOST||'127.0.0.1',()=>console.log('Pip is ready at http://localhost:'+(process.env.PORT||3000)));
