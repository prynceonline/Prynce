import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Search, Menu, Smartphone, Tv, Tablet, ChevronDown, ChevronRight, Download, ShieldCheck, Home, Gamepad2, Grid3X3, UserRound, ArrowUpRight, X, Star, Globe2, CircleHelp } from 'lucide-react';
import './styles.css';

const apps = [
 {id:'news',name:'PRYNCE NEWS 24',category:'News',icon:'📰',summary:'News, opportunities and updates from Ghana and around the world.',status:'Website available',kind:'Prynce app',devices:['This device','Android TV','Tablet'],url:'https://headless-bkznydlmefs-prynceonline-140c.wix-site-host.com/',tone:'news'},
 {id:'tv',name:'PRYNCE TV',category:'Entertainment',icon:'📺',summary:'A home for Ghanaian television, sports and entertainment.',status:'In development',kind:'Prynce app',devices:['This device','Android TV','Tablet'],tone:'tv'},
 {id:'market',name:'PRYNCE Marketplace',category:'Shopping',icon:'🛍️',summary:'Discover products, sellers and services in one marketplace.',status:'In development',kind:'Prynce app',devices:['This device','Tablet'],tone:'market'},
 {id:'jewelry',name:'STEP IN JEWELRIES',category:'Shopping',icon:'💎',summary:'Explore a premium jewellery shopping experience.',status:'Website available',kind:'Prynce project',devices:['This device','Tablet'],url:'https://prynceonline.wixsite.com/step-in-jewelries',tone:'jewel'},
 {id:'school',name:'School Management',category:'Education',icon:'🎓',summary:'A digital school experience for students, parents and teachers.',status:'In development',kind:'Prynce app',devices:['This device','Tablet'],tone:'school'},
 {id:'rider',name:'Rider Connect',category:'Lifestyle',icon:'🏍️',summary:'Connect riders with opportunities and delivery services.',status:'In development',kind:'Prynce app',devices:['This device'],tone:'rider'},
 {id:'online',name:'Prynce Online',category:'Productivity',icon:'🌐',summary:'The central Prynce digital ecosystem and online services.',status:'Website available',kind:'Prynce platform',devices:['This device','Android TV','Tablet'],url:'https://headless-bkznydlmefs-prynceonline-140c.wix-site-host.com/',tone:'online'},
 {id:'prynce-x',name:'PrynceX',category:'Shopping',icon:'✦',summary:'Prynce sales and commerce platform concept.',status:'In development',kind:'Prynce project',devices:['This device','Tablet'],tone:'prynce'}
];
const categories=['For you','Top charts','Categories','News','Entertainment','Shopping','Education'];
const deviceOptions=[{label:'This device',icon:Smartphone},{label:'Android TV',icon:Tv},{label:'Tablet',icon:Tablet}];

function AppIcon({app,large=false}) { return <span className={'app-icon '+app.tone+(large?' large':'')}>{app.icon}</span>; }
function AppCard({app,onOpen}) {
 return <article className="app-card">
  <button className="app-card-main" onClick={()=>onOpen(app)} aria-label={'View '+app.name}>
   <AppIcon app={app}/>
   <span className="app-info"><b>{app.name}</b><small>{app.category} <i>·</i> {app.kind}</small><span className="app-desc">{app.summary}</span></span>
   <ChevronRight size={18} className="arrow"/>
  </button>
  <div className="app-card-footer"><span className="app-status"><span className={'dot '+(app.url?'live':'pending')}/>{app.status}</span>{app.url?<a href={app.url} target="_blank" rel="noreferrer">Open <ArrowUpRight size={13}/></a>:<span className="free-label">Free listing</span>}</div>
 </article>;
}
function AppStore(){
 const [query,setQuery]=useState('');
 const [category,setCategory]=useState('For you');
 const [device,setDevice]=useState('This device');
 const [deviceOpen,setDeviceOpen]=useState(false);
 const [selected,setSelected]=useState(null);
 const [menuOpen,setMenuOpen]=useState(false);
 const [activeNav,setActiveNav]=useState('Home');
 const [saved,setSaved]=useState([]);
 const filtered=useMemo(()=>apps.filter(a=>(category==='For you'||category==='Top charts'||category==='Categories'||a.category===category)&&(a.name+' '+a.category+' '+a.summary).toLowerCase().includes(query.toLowerCase())&&a.devices.includes(device)),[query,category,device]);
 const save=(id)=>setSaved(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);
 return <div className="store">
  <header className="topbar">
   <a className="brand" href="#"><span className="brand-logo">A<span>✦</span></span><span>ACTIVE<small>by PRYNCE</small></span></a>
   <div className="search-wrap"><Search size={19}/><input aria-label="Search apps" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search apps and games"/>{query&&<button onClick={()=>setQuery('')} aria-label="Clear search"><X size={17}/></button>}</div>
   <button className="profile" aria-label="Account"><UserRound size={19}/></button>
   <button className="mobile-menu" onClick={()=>setMenuOpen(!menuOpen)} aria-label="Menu"><Menu/></button>
  </header>
  <div className="device-row">
   <div className="device-picker-wrap"><button className="device-picker" onClick={()=>setDeviceOpen(!deviceOpen)}><span className="check">✓</span>{device}<ChevronDown size={16}/></button>
   {deviceOpen&&<div className="device-menu">{deviceOptions.map(d=><button key={d.label} onClick={()=>{setDevice(d.label);setDeviceOpen(false)}}><d.icon size={17}/>{d.label}{device===d.label&&<span className="selected-check">✓</span>}</button>)}</div>}</div>
   <span className="secure-note"><ShieldCheck size={14}/> Public app directory</span>
  </div>
  <div className="category-tabs">{categories.map(c=><button key={c} className={category===c?'selected':''} onClick={()=>setCategory(c)}>{c}</button>)}</div>
  <main>
   <section className="welcome">
    <div><span className="eyebrow">WELCOME TO ACTIVE</span><h1>Apps for everything.<br/><em>One place to discover.</em></h1><p>Explore Prynce applications and useful digital experiences. Free to browse, open and download approved releases.</p><a href="#all-apps" className="explore-button">Explore apps <ChevronRight size={17}/></a></div>
    <div className="welcome-art"><div className="art-circle"></div><div className="art-card card-a"><span>📺</span><b>PRYNCE TV</b><small>Entertainment</small></div><div className="art-card card-b"><span>💎</span><b>STEP IN JEWELRIES</b><small>Shopping</small></div><div className="art-card card-c"><span>📰</span><b>NEWS 24</b><small>News</small></div><div className="art-spark">✦</div></div>
   </section>
   <section className="quick-cats"><button onClick={()=>setCategory('Entertainment')}><span className="quick-icon purple"><Tv/></span><span>Entertainment</span></button><button onClick={()=>setCategory('Shopping')}><span className="quick-icon orange"><Grid3X3/></span><span>Shopping</span></button><button onClick={()=>setCategory('Education')}><span className="quick-icon green"><Tablet/></span><span>Education</span></button><button onClick={()=>setCategory('News')}><span className="quick-icon blue"><Globe2/></span><span>News</span></button></section>
   <section className="catalogue" id="all-apps">
    <div className="section-title"><div><span className="eyebrow">DISCOVER THE PRYNCE ECOSYSTEM</span><h2>{category==='For you'?'Apps made for you':category}</h2><p>Explore available projects and follow development of upcoming apps.</p></div><span className="result-count">{filtered.length} results</span></div>
    <div className="filter-line"><span>Apps</span><span className="filter-device"><Smartphone size={14}/>{device}</span></div>
    <div className="app-grid">{filtered.map(a=><AppCard key={a.id} app={a} onOpen={setSelected}/>)}</div>
    {filtered.length===0&&<div className="empty"><Search/><b>No apps found for this device</b><span>Try another search or select a different device.</span></div>}
   </section>
   <section className="developer-banner"><div className="dev-icon"><Grid3X3/></div><div><span className="eyebrow">ACTIVE DEVELOPER HUB</span><h2>Bring your app to ACTIVE</h2><p>App submissions will open after the secure upload, verification and review process is ready.</p></div><a href="mailto:apps@prynceonline.com?subject=ACTIVE%20developer%20enquiry">Developer enquiry <ArrowUpRight size={16}/></a></section>
   <section className="safety"><ShieldCheck/><span><b>Free access. Carefully reviewed releases.</b><small>Only verified app files will receive a download button. Upcoming projects are clearly marked.</small></span><a href="https://f-droid.org/en/docs/Setup_an_F-Droid_App_Repo/" target="_blank" rel="noreferrer">How app releases work</a></section>
  </main>
  <footer><a className="brand" href="#"><span className="brand-logo">A<span>✦</span></span><span>ACTIVE<small>by PRYNCE</small></span></a><span>Discover more. Do more.</span><small>© {new Date().getFullYear()} Prynce · Independent app discovery platform</small></footer>
  <nav className="bottom-nav"><button className={activeNav==='Home'?'on':''} onClick={()=>{setActiveNav('Home');setCategory('For you')}}><Home/><span>Home</span></button><button className={activeNav==='Games'?'on':''} onClick={()=>{setActiveNav('Games');setCategory('Entertainment')}}><Gamepad2/><span>Games</span></button><button className={activeNav==='Apps'?'on':''} onClick={()=>{setActiveNav('Apps');setCategory('Categories')}}><Grid3X3/><span>Apps</span></button><button className={activeNav==='Saved'?'on':''} onClick={()=>{setActiveNav('Saved');setQuery('')}}><UserRound/><span>Saved</span></button></nav>
  {selected&&<div className="modal-backdrop" onClick={()=>setSelected(null)}><div className="app-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setSelected(null)}><X/></button><div className="modal-head"><AppIcon app={selected} large/><div><h2>{selected.name}</h2><span>{selected.category} · {selected.kind}</span></div></div><p>{selected.summary}</p><div className="modal-meta"><span><ShieldCheck size={15}/> {selected.url?'Website available':'Release in development'}</span><span><Globe2 size={15}/> Free to access</span></div><div className="modal-description">ACTIVE listing status: <b>{selected.status}</b>. {selected.url?'You can open the current project website.':'The Android package is not yet published. A download button will appear after a verified release is available.'}</div><div className="modal-actions">{selected.url?<a className="install-button" href={selected.url} target="_blank" rel="noreferrer">Open project <ArrowUpRight size={16}/></a>:<button className="install-button disabled" disabled><Download size={16}/> Not downloadable yet</button>}<button className="save-button" onClick={()=>save(selected.id)}>{saved.includes(selected.id)?'Saved ✓':'Save app'}</button></div></div></div>}
 </div>;
}
createRoot(document.getElementById('root')).render(<AppStore/>);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}
