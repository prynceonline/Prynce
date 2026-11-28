import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Search, Menu, Download, ShieldCheck, ChevronRight, Sparkles, Grid2X2, ArrowUpRight, Globe2, X } from 'lucide-react';
import './styles.css';

const apps = [
 {id:'news',name:'PRYNCE NEWS 24',category:'News',icon:'📰',tone:'coral',summary:'News, opportunities and updates from Ghana and around the world.',status:'Website preview',url:'https://headless-bkznydlmefs-prynceonline-140c.wix-site-host.com/'},
 {id:'tv',name:'PRYNCE TV',category:'Entertainment',icon:'📺',tone:'blue',summary:'A home for Ghanaian television, sports and entertainment.',status:'Coming soon'},
 {id:'market',name:'PRYNCE Marketplace',category:'Shopping',icon:'🛍️',tone:'gold',summary:'Discover products, sellers and services in one marketplace.',status:'In development'},
 {id:'jewelry',name:'STEP IN JEWELRIES',category:'Shopping',icon:'💎',tone:'rose',summary:'Explore a premium jewellery shopping experience.',status:'Visit website',url:'https://prynceonline.wixsite.com/step-in-jewelries'},
 {id:'school',name:'School Management',category:'Education',icon:'🎓',tone:'green',summary:'A digital school experience for students, parents and teachers.',status:'In development'},
 {id:'rider',name:'Rider Connect',category:'Lifestyle',icon:'🏍️',tone:'violet',summary:'Connect riders with opportunities and delivery services.',status:'In development'}
];
const categories=['All apps','News','Entertainment','Shopping','Education','Lifestyle'];

function AppCard({app,onOpen}) {
 return <article className="app-card">
  <button className="app-main" onClick={()=>onOpen(app)}><span className={'app-icon '+app.tone}>{app.icon}</span><span className="app-copy"><b>{app.name}</b><small>{app.category} · Prynce</small><span>{app.summary}</span></span><ChevronRight size={18}/></button>
  <div className="app-foot"><span>● {app.status}</span>{app.url&&<a href={app.url} target="_blank" rel="noreferrer">Open <ArrowUpRight size={13}/></a>}</div>
 </article>;
}

function AppStore(){
 const [query,setQuery]=useState('');
 const [category,setCategory]=useState('All apps');
 const [selected,setSelected]=useState(null);
 const [menu,setMenu]=useState(false);
 const filtered=useMemo(()=>apps.filter(a=>(category==='All apps'||a.category===category)&&(a.name+' '+a.category+' '+a.summary).toLowerCase().includes(query.toLowerCase())),[query,category]);
 return <div className="shell">
  <header className="header"><a className="brand" href="#"><span className="logo">A<span>✦</span></span><span>ACTIVE<small>BY PRYNCE</small></span></a><nav className={menu?'nav show':'nav'}><a href="#apps">Explore apps</a><a href="#categories">Categories</a><a href="#publish">Publish an app</a></nav><button className="menu" onClick={()=>setMenu(!menu)}><Menu/></button><a className="developer" href="#publish">For developers</a></header>
  <main>
   <section className="hero"><div className="hero-copy"><div className="eyebrow"><Sparkles size={14}/> THE PRYNCE APP DISCOVERY PLATFORM</div><h1>Find your next<br/><em>favourite app.</em></h1><p>Discover useful apps, entertainment and digital services from Prynce and independent developers. One place to explore. Free apps for everyone.</p><a className="primary" href="#apps">Explore apps <ChevronRight size={18}/></a><div className="trust"><ShieldCheck size={16}/> Public access <i>·</i> Free downloads <i>·</i> Curated listings</div></div>
    <div className="art"><div className="orb one"></div><div className="orb two"></div><div className="phone"><div className="phone-status">9:41 <span>● ● ▰</span></div><div className="phone-brand"><b>A</b> ACTIVE <Search size={15}/></div><h3>Discover apps<br/><em>made for more.</em></h3><div className="phone-search"><Search size={13}/> Search apps</div><small className="popular">POPULAR ON ACTIVE</small>{apps.slice(0,3).map(a=><div className="phone-row" key={a.id}><span className={'mini '+a.tone}>{a.icon}</span><span><b>{a.name}</b><small>{a.category}</small></span><strong>VIEW</strong></div>)}<div className="phone-bottom">⌂　▦　♡<small>HOME　 EXPLORE　 SAVED</small></div></div><div className="float"><ShieldCheck size={17}/> Free to explore</div></div>
   </section>
   <section className="benefits"><div><Globe2/><span><b>Open to everyone</b><small>Browse from anywhere</small></span></div><div><Download/><span><b>Free app listings</b><small>No charge to discover</small></span></div><div><ShieldCheck/><span><b>Reviewed releases</b><small>Safety-first publishing</small></span></div></section>
   <section className="catalogue" id="apps"><div className="section-head"><div><div className="eyebrow dark">DISCOVER SOMETHING NEW</div><h2>Explore apps</h2><p>Find your next useful tool, service or entertainment experience.</p></div><span>{filtered.length} listings</span></div>
    <label className="search"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search apps, games and more…"/>{query&&<button onClick={()=>setQuery('')}><X size={16}/></button>}</label>
    <div className="categories" id="categories">{categories.map(c=><button key={c} className={category===c?'active':''} onClick={()=>setCategory(c)}>{c}</button>)}</div>
    <div className="grid">{filtered.map(a=><AppCard key={a.id} app={a} onOpen={setSelected}/>)}</div>
    {!filtered.length&&<div className="empty">No apps found. Try another search.</div>}
   </section>
   <section className="publish" id="publish"><div className="publish-icon"><Grid2X2/></div><div><div className="eyebrow">BUILD WITH ACTIVE</div><h2>Have an app to share?</h2><p>Developer submissions and release uploads will open after review, security and account workflows are ready.</p></div><a href="mailto:apps@prynceonline.com?subject=ACTIVE%20developer%20enquiry">Developer enquiry <ArrowUpRight size={16}/></a></section>
  </main>
  <footer><a className="brand" href="#"><span className="logo">A<span>✦</span></span><span>ACTIVE<small>BY PRYNCE</small></span></a><p>Discover more. Do more. All in one place.</p><small>© {new Date().getFullYear()} Prynce · Independent app discovery platform</small></footer>
  {selected&&<div className="backdrop" onClick={()=>setSelected(null)}><div className="modal" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setSelected(null)}><X/></button><div className={'app-icon modal-icon '+selected.tone}>{selected.icon}</div><div className="eyebrow dark">{selected.category.toUpperCase()}</div><h2>{selected.name}</h2><p>{selected.summary}</p><div className="notice"><ShieldCheck size={17}/>{selected.url?'This listing opens the current project website.':'This app is not downloadable yet. A verified release will be added after review.'}</div>{selected.url?<a className="primary modal-action" href={selected.url} target="_blank" rel="noreferrer">Open app <ArrowUpRight size={16}/></a>:<button className="primary modal-action" onClick={()=>setSelected(null)}>Back to store</button>}</div></div>}
 </div>;
}
createRoot(document.getElementById('root')).render(<AppStore/>);
