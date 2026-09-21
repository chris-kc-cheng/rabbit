import { useEffect, useState } from "react";
import { AdminView } from "./AdminView";
import { api } from "./api";
import { Landing, Login } from "./AuthViews";
import { DemoPack } from "./DemoPack";
import { LearnerView } from "./LearnerView";
import { ParentView } from "./ParentView";
import type { User } from "./types";

type PublicView="landing"|"login"|"demo";
export default function App(){
 const [user,setUser]=useState<User|null>(null);const [view,setView]=useState<PublicView>(sessionStorage.getItem("rabbit_token")?"login":"landing");const [checking,setChecking]=useState(Boolean(sessionStorage.getItem("rabbit_token")));
 useEffect(()=>{const expired=()=>{setUser(null);setView("login")};window.addEventListener("rabbit:unauthorized",expired);if(sessionStorage.getItem("rabbit_token")){api.me().then(setUser).catch(()=>setView("login")).finally(()=>setChecking(false))}return()=>window.removeEventListener("rabbit:unauthorized",expired)},[]);
 const logout=async()=>{try{await api.logout()}catch{/* token may already be expired */}sessionStorage.removeItem("rabbit_token");setUser(null);setView("landing")};
 if(checking)return <main className="auth-page"><div className="spinner"/><p>Opening your learning space…</p></main>;
 if(!user){return <div className="app-shell"><PublicHeader view={view} setView={setView}/>{view==="landing"?<Landing onLogin={()=>setView("login")} onDemo={()=>setView("demo")}/>:view==="login"?<Login onBack={()=>setView("landing")} onSuccess={setUser}/>:<DemoPack/>}</div>}
 return <div className="app-shell"><header className="topbar signed-in"><div className="brand"><img className="brand-logo" src="/rabbit-reading-logo.png" alt=""/>rabbit</div><p className="role-chip">{user.role} space</p><div className="account"><span>Hi, <strong>{user.display_name}</strong></span><button className="quiet" onClick={logout}>Log out</button></div></header>{user.role==="admin"?<AdminView/>:user.role==="parent"?<ParentView refreshKey={0}/>:<div className="learner-layout"><aside className="trail"><p className="eyebrow">Your path</p><h2>Math Explorer</h2><ol><li className="done">✓ <span>Ready<small>Signed in</small></span></li><li className="active">✦ <span>Mixed practice<small>In progress</small></span></li></ol></aside><LearnerView learnerId={user.id} onAttemptsChanged={()=>{}}/><aside className="coach"><img className="mascot" src="/rabbit-reading-logo.png" alt="Rabbit reading"/><div><strong>You&apos;ve got this!</strong><p>Every thoughtful try makes your learning stronger.</p></div></aside></div>}</div>;
}
function PublicHeader({view,setView}:{view:PublicView;setView:(v:PublicView)=>void}){return <header className="topbar public-top"><button className="brand" onClick={()=>setView("landing")}><img className="brand-logo" src="/rabbit-reading-logo.png" alt=""/>rabbit</button><nav><button className={view==="landing"?"active":""} onClick={()=>setView("landing")}>Home</button><button className={view==="demo"?"active":""} onClick={()=>setView("demo")}>Demo</button></nav><button className="primary header-login" onClick={()=>setView("login")}>Log in</button></header>}
