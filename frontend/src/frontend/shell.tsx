import { Link, useLocation } from '@tanstack/react-router';
import { useEffect, useState, type ReactNode } from 'react';
import { ArrowUpRight, Moon, Sun, Search, LayoutDashboard, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
export function SeekrMark({large=false}:{large?:boolean}) {return <span className={large?'brand brand-large':'brand'}>seekr<span className="brand-dot">.</span></span>;}
export function AppShell({children}:{children:ReactNode}) {
 const [dark,setDark]=useState(true);
 const location=useLocation();
 useEffect(()=>{const saved=localStorage.getItem('seekr-theme');setDark(saved!=='light');document.documentElement.classList.toggle('dark',saved!=='light');},[]);
 function toggle(){const next=!dark;setDark(next);document.documentElement.classList.toggle('dark',next);localStorage.setItem('seekr-theme',next?'dark':'light');}
 return <div className="app-shell"><header className="app-header"><Link to="/" search={{q:'',page:1,ranker:'bm25',compare:false}} aria-label="Seekr home"><SeekrMark/></Link><nav aria-label="Main navigation"><Link to="/" search={{q:'',page:1,ranker:'bm25',compare:false}} className={location.pathname==='/'?'nav-link active':'nav-link'}><Search size={15}/>Search</Link><Link to="/admin" className={location.pathname==='/admin'?'nav-link active':'nav-link'}><LayoutDashboard size={15}/>Dashboard</Link></nav><div className="header-right"><span className="index-status"><i/>Index online</span><span className="header-divider"/><Button variant="ghost" size="icon" onClick={toggle} aria-label={dark?'Switch to light mode':'Switch to dark mode'} title={dark?'Light mode':'Dark mode'}>{dark?<Sun/>:<Moon/>}</Button></div></header><main>{children}</main><footer className="app-footer"><span>Seekr <span className="footer-muted">/</span> A little more signal. A little less noise.</span><div><span className="footer-status"><i/>All systems operational</span><span className="footer-muted">v0.1.0 <ArrowUpRight size={12}/></span></div></footer></div>;
}
export function Failure({message,retry}:{message:string;retry?:()=>void}) {return <div className="empty-state"><Search size={28}/><h2>Something didn’t connect</h2><p>{message}</p>{retry&&<Button variant="outline" onClick={retry}>Try again <ArrowRight/></Button>}<Button variant="ghost" asChild><Link to="/" search={{q:'',page:1,ranker:'bm25',compare:false}}>Back to search</Link></Button></div>;}
