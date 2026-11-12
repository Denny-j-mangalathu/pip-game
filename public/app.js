const $ = selector => document.querySelector(selector);
const storageKey = 'pip-game-v1';
const initialPet = () => ({fullness:65, joy:70, energy:80, sleeping:false, leaves:0, version:0});
let saved;
try { saved = JSON.parse(localStorage.getItem(storageKey)); } catch {}
let pet = {...initialPet(), ...saved?.pet};
let tasks = Array.isArray(saved?.tasks) ? saved.tasks.filter(t => typeof t.text === 'string').slice(0,3) : [];
let room = saved?.room || null;
let personalPet = saved?.personalPet || {...pet};
let busy = false;
let playing = false;
let catches = 0;
let poll;
const uuid = () => crypto.randomUUID();
function save() {
  try { localStorage.setItem(storageKey, JSON.stringify({pet,tasks,room,personalPet})); }
  catch { say('Storage is full or unavailable. This visit’s progress will stay here until you close the page.'); }
}
function say(text) { $('#speech').textContent = text; }
function draw() {
  for (const key of ['fullness','joy','energy']) $('#'+key).value = pet[key];
  const sleeping = pet.sleeping;
  const hungry = pet.fullness < 30;
  $('#face').innerHTML = sleeping
    ? '<path d="M105 158q10 9 20 0M175 158q10 9 20 0M140 182q10 6 20 0" fill="none"/>'
    : '<ellipse cx="115" cy="157" rx="5" ry="7" fill="currentColor"/><ellipse cx="185" cy="157" rx="5" ry="7" fill="currentColor"/>' + (hungry ? '<ellipse cx="150" cy="181" rx="7" ry="9" fill="none"/>' : '<path d="M137 179q13 18 26 0" fill="none"/>');
  $('#pip').setAttribute('aria-label',sleeping ? 'Pip is sleeping' : hungry ? 'Pip is hungry' : 'Pip looks happy');
  $('#rest').innerHTML = '<span>☾</span>' + (sleeping ? 'Wake Pip' : 'Rest');
  $('#feed').disabled = busy || playing;
  $('#play').disabled = busy || playing || sleeping;
  $('#rest').disabled = busy || playing;
  $('#mode').textContent = room ? 'A shared paper home' : 'Your paper home';
  $('#task-count').textContent = tasks.length + ' / 3';
  $('#task-input').disabled = tasks.length >= 3;
  $('#task-form button').disabled = tasks.length >= 3;
  $('#empty').hidden = tasks.length > 0;
  $('#tasks').replaceChildren();
  for (const task of tasks) {
    const row = document.createElement('li');
    row.className = task.done ? 'done' : '';
    const check = document.createElement('button');
    check.className = 'check'; check.textContent = task.done ? '✓' : '';
    check.setAttribute('aria-label', task.done ? 'Completed ' + task.text : 'Complete ' + task.text);
    check.disabled = task.done || busy;
    check.onclick = async () => {
      if (await act('leaf')) { task.done = true; save(); draw(); }
    };
    const label = document.createElement('span'); label.className='task-text'; label.textContent=task.text;
    const remove = document.createElement('button'); remove.textContent='×'; remove.setAttribute('aria-label','Remove '+task.text);
    remove.onclick=()=>{tasks=tasks.filter(t=>t.id!==task.id);save();draw();};
    row.append(check,label,remove); $('#tasks').append(row);
  }
  $('#leaf-count').textContent = pet.leaves + (pet.leaves === 1 ? ' leaf' : ' leaves');
  $('#flowers').replaceChildren();
  for(let i=0;i<Math.min(pet.leaves,12);i++){const flower=document.createElement('span');flower.textContent=i%3===0?'✿':'♧';$('#flowers').append(flower);}
  $('#garden-note').textContent=pet.leaves ? 'A few small things, growing into something.' : 'Finish a small thing. Plant a little leaf.';
}
function localAction(type) {
  if(type==='feed'){pet.fullness=Math.min(100,pet.fullness+20);pet.sleeping=false;}
  if(type==='play'){pet.joy=Math.min(100,pet.joy+15);pet.energy=Math.max(0,pet.energy-8);}
  if(type==='rest'){pet.sleeping=!pet.sleeping;if(pet.sleeping)pet.energy=Math.min(100,pet.energy+25);}
  if(type==='leaf')pet.leaves++;
  pet.version++;
}
async function request(path, options={}) {
  const response=await fetch(path,{...options,headers:{'Content-Type':'application/json',...(room ? {Authorization:'Bearer '+room.token} : {}),...options.headers}});
  const data=await response.json();
  if(!response.ok){const error=new Error(data.error||'Could not connect. Try again.');error.pet=data.pet;throw error;}
  return data;
}
async function act(type) {
  if(busy)return;
  busy=true;draw();
  try {
    if(room){
      const payload={type,version:pet.version,actionId:uuid()};
      let result;
      try { result=await request('/api/rooms/'+room.id,{method:'POST',body:JSON.stringify(payload)}); }
      catch(error){if(error.pet)throw error;result=await request('/api/rooms/'+room.id,{method:'POST',body:JSON.stringify(payload)});}
      pet=result.pet;
    } else localAction(type);
    say({feed:'A berry! That was a good berry.',play:'Again? I almost caught that last one.',rest:pet.sleeping?'Just resting my eyes…':'Oh, you’re back!',leaf:'A little leaf for a little victory.'}[type]);
    save();
    return true;
  } catch(error){if(error.pet){pet=error.pet;save();}say(error.message);}
  finally{busy=false;draw();}
}
$('#feed').onclick=()=>act('feed');
$('#rest').onclick=()=>act('rest');
$('#pet').onclick=()=>{if(pet.sleeping){say('A quiet pat. Pip is still dreaming.');return;}$('#pet').classList.remove('bounce');void $('#pet').offsetWidth;$('#pet').classList.add('bounce');say('That’s the spot.');};
$('#task-form').onsubmit=event=>{event.preventDefault();const text=$('#task-input').value.trim();if(!text||tasks.length>=3)return;tasks.push({id:uuid(),text,done:false});$('#task-input').value='';save();draw();};
function modal(content){$('#modal-content').innerHTML=content;$('#modal').showModal();}
function stopPlay(){playing=false;$('#ball').hidden=true;$('#hint').textContent='A little company, whenever you need it.';draw();}
function moveBall(){const b=$('#ball button');b.style.left=Math.random()*70+'%';b.style.top=Math.random()*55+'%';}
$('#play').onclick=()=>{playing=true;catches=0;$('#ball').hidden=false;$('#hint').textContent='Tap the paper ball. Five catches, at your own pace.';say('Catch? I’ll throw first.');moveBall();draw();$('#ball button').focus();};
$('#ball button').onclick=async()=>{catches++;if(catches>=5){stopPlay();await act('play');}else{say(catches+' / 5. Nice catch!');moveBall();}};
$('#pause').onclick=()=>modal('<h2>A quiet minute</h2><p>Watch the circle for a little while. Breathe at whatever pace feels comfortable.</p><div class="breathing" aria-hidden="true"></div><p>Stay as long as you like. Close this when you’re ready.</p>');
$('#about').onclick=()=>modal('<h2>Hello, I’m Pip.</h2><p>Feed me a berry, play five catches, or let me take a nap. Tap me for a pat.</p><p>Write up to three small tasks. Each finished task plants a leaf in the garden. Remove a task to make room for another.</p><p>Your progress saves in this browser. You can visit whenever you like. Shared homes need the included game server.</p><p>Anyone with a home invite can care for that Pip. Your task list stays on your own device.</p>');
$('.close').onclick=()=>$('#modal').close();
$('#modal').addEventListener('click',event=>{if(event.target===$('#modal'))$('#modal').close();});
$('#share').onclick=()=>{
  modal('<h2>A home to share</h2><p>Create a home, or paste an invite from a friend. Anyone with an invite can care for your shared Pip.</p><button id="create-room">Create a shared home</button><form id="join-form"><input id="invite" aria-label="Home invite" placeholder="Paste an invite" required><button>Join</button></form><p id="room-message" role="status"></p>'+(room?'<button id="copy-invite">Copy invite</button> <button id="leave">Go back to my own Pip</button>':''));
  $('#create-room').onclick=async()=>{
    $('#create-room').disabled=true;
    try{const result=await request('/api/rooms',{method:'POST',body:'{}'});if(!room)personalPet={...pet};room={id:result.id,token:result.token};pet=result.pet;stopPlay();save();draw();startPolling();$('#modal').close();$('#share').click();}
    catch{$('#room-message').textContent='Shared homes need the Node game server. Run npm start, then open its address.';$('#create-room').disabled=false;}
  };
  $('#join-form').onsubmit=async event=>{
    event.preventDefault();const text=$('#invite').value.trim();const match=text.match(/([a-f0-9]{24})\.([a-f0-9]{48})/);
    if(!match){$('#room-message').textContent='Paste the complete invite from your friend.';return;}
    try{const result=await request('/api/rooms/'+match[1],{headers:{Authorization:'Bearer '+match[2]}});if(!room)personalPet={...pet};room={id:match[1],token:match[2]};pet=result.pet;stopPlay();save();draw();startPolling();$('#modal').close();say('There’s room for you here.');}
    catch(error){$('#room-message').textContent=error.message;}
  };
  if(room){
    $('#copy-invite').onclick=async()=>{const invite=room.id+'.'+room.token;try{await navigator.clipboard.writeText(invite);$('#room-message').textContent='Invite copied. Send it to your friend.';}catch{$('#invite').value=invite;$('#invite').select();$('#room-message').textContent='Copy this invite to share it.';}};
    $('#leave').onclick=()=>{room=null;pet={...personalPet};clearInterval(poll);stopPlay();save();draw();$('#modal').close();};
  }
};
function startPolling(){clearInterval(poll);if(!room)return;poll=setInterval(async()=>{if(busy||document.hidden)return;try{const result=await request('/api/rooms/'+room.id);if(result.pet.version>pet.version){pet=result.pet;save();draw();}}catch{$('#hint').textContent='Reconnecting to your shared home…';}},2500);}
$('#day').textContent=new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric'}).format(new Date());
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&playing)stopPlay();});
draw();startPolling();
