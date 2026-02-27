'use client'
import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { supabase } from "@/lib/supabase"

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════
const THEMES: Record<string, Record<string, string>> = {
  dark: {bg:"#111114",card:"#1c1c22",card2:"#24242c",border:"#2e2e3a",borderMed:"#3a3a4a",borderLight:"#4a4a5c",
    gold:"#d4ad5e",goldBright:"#edc46f",goldDim:"rgba(212,173,94,0.12)",goldText:"#e0c06a",
    green:"#5cb85c",greenBright:"#7ed67e",greenDim:"rgba(92,184,92,0.14)",greenGlow:"rgba(92,184,92,0.35)",
    cream:"#eee8df",cream2:"#c8bfb0",muted:"#8888a0",mutedDark:"#5c5c70",
    red:"#d45050",urgent:"#e8543e",scott:"#6ea8d4",filip:"#d4ad5e",
    hdrBg:"rgba(17,17,20,0.95)",tabBg:"rgba(17,17,20,0.96)"},
  light: {bg:"#f5f1eb",card:"#ffffff",card2:"#f9f6f1",border:"#e2dbd0",borderMed:"#d5ccbe",borderLight:"#c8bfb0",
    gold:"#8b6c2f",goldBright:"#a68340",goldDim:"rgba(139,108,47,0.08)",goldText:"#7a5f28",
    green:"#4a8a3e",greenBright:"#5ea04f",greenDim:"rgba(74,138,62,0.08)",greenGlow:"rgba(74,138,62,0.20)",
    cream:"#1a1612",cream2:"#3d352c",muted:"#7a7068",mutedDark:"#a49889",
    red:"#c04535",urgent:"#d43d2a",scott:"#4a7a9a",filip:"#8b6c2f",
    hdrBg:"rgba(245,241,235,0.94)",tabBg:"rgba(245,241,235,0.95)"},
  braveheart: {bg:"#0a0e1a",card:"#111832",card2:"#151d3a",border:"#1e2a52",borderMed:"#2a3968",borderLight:"#3a4d80",
    gold:"#e0c285",goldBright:"#f0d89a",goldDim:"rgba(224,194,133,0.08)",goldText:"#f0d89a",
    green:"#5fa854",greenBright:"#7ec472",greenDim:"rgba(95,168,84,0.10)",greenGlow:"rgba(95,168,84,0.25)",
    cream:"#d8e4f0",cream2:"#8ba4c4",muted:"#5a7494",mutedDark:"#3a5070",
    red:"#c45a48",urgent:"#e8543e",scott:"#4a90d0",filip:"#e0c285",
    hdrBg:"rgba(10,14,26,0.94)",tabBg:"rgba(10,14,26,0.95)",warpaint:"#4a8ae0"},
}
const FD = "'Playfair Display',Georgia,serif"
const FB = "'Source Sans 3',system-ui,sans-serif"
const START = new Date(2026, 1, 26)
const DAYMS = 86400000
const BIBLE: string[] = []
const BOOKS: {name:string,ch:number,s:number}[] = []
const bookList: [string,number][] = [
  ["Galatians",6],["Ephesians",6],["Philippians",4],["Colossians",4],
  ["1 Thessalonians",5],["2 Thessalonians",3],["1 Timothy",6],["2 Timothy",4],
  ["Titus",3],["Philemon",1],["Hebrews",13],["James",5],["1 Peter",5],["2 Peter",3]
]
bookList.forEach(([b,c]) => { BOOKS.push({name:b,ch:c,s:BIBLE.length}); for(let i=1;i<=c;i++) BIBLE.push(`${b} ${i}`) })
BIBLE.push("TBD","TBD")
const DAYS_SHORT = ["Thu","Fri","Sat","Sun","Mon","Tue","Wed"]
const EVENTS_INIT = [
  {id:"e1",title:"Squad #23 Full Meeting",loc:"Angel's House of Pancakes",date:"2026-02-28",time:"7:00 AM",scott:false,filip:false},
  {id:"e2",title:"Mid-Chapter Event",loc:"The Lodge",date:"2026-04-10",time:"11:55 PM",scott:false,filip:false},
  {id:"e3",title:"Fight Club Graduation",loc:"TBD",date:"2026-05-17",time:"6:00 PM",scott:false,filip:false},
]
const NEH = "Remember the Lord who is great and awesome and fight for your brothers your sons your daughters your wives and your homes".split(" ")

// Date helpers
const dn = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); const s = new Date(START); s.setHours(0,0,0,0); return Math.floor((x.getTime()-s.getTime())/DAYMS) }
const wn = (d: Date) => Math.floor(dn(d)/7)+1
const d4d = (n: number) => { const d = new Date(START); d.setDate(d.getDate()+n); return d }
const ds = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const today = () => new Date()
const tds = () => ds(today())
const fmt = (d: Date | string) => new Date(d).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})
const wkDates = (w: number) => Array.from({length:7},(_,i)=>d4d((w-1)*7+i))
const calcEquiv = (m: any) => { const mi = parseFloat(m.miles)||0; return m.type==="biking"?mi/3:m.type==="elliptical"?mi/2:m.type==="swimming"?mi*3:mi }
const hrsLeft = (dayNum: number) => { const eod = new Date(d4d(dayNum)); eod.setHours(23,59,59); return Math.max(0,(eod.getTime()-Date.now())/3600000) }

// ═══════════════════════════════════════════════════════════════
// DATA LAYER — Supabase with merge-safe writes
// ═══════════════════════════════════════════════════════════════
const ROW_ID = "fc30_state"

const initWk = (): any => ({verse:{text:"",scott:false,filip:false},whisper:{text:"",scott:false,filip:false},
  wkOpts:[],wkTarget:3,miTarget:10,miOutMin:5,workouts:{scott:[],filip:[]},mileage:{scott:[],filip:[]},tasks:[]})

const WEEK1_TASKS = [
  {id:"w1_block",name:"Build Your Name Block",subtitle:"Post photo on FC App",type:"once",assignee:"both",comp:{},
    notes:"Take your block, etch/paint/build, put your last name on it. No sharpies. Must be weather resistant, no paper on sides. Pray that your name carries godliness, integrity, and represents Jesus well."},
  {id:"w1_family",name:"Family Dinner Commitment",subtitle:"Post on FC App",type:"once",assignee:"both",comp:{},
    notes:"Gather your family at the dinner table. Look them in the eyes, tell them you love them. Speak clearly your intentions as protector. Pray with them and over your home. Ask forgiveness if needed. If single, make this commitment to God for your future family."},
  {id:"w1_photo",name:"Post Family Photo + Pray for 10 Families",subtitle:"Post on FC App",type:"once",assignee:"both",comp:{},
    notes:"Post a photo of your family on the FC App. As other families appear, pause and pray for 10 different families. Prayer brings heaven stuff down to earth!"},
  {id:"w1_whisper_post",name:"Post Whisper Ch.1 Thoughts",subtitle:"2 things that stuck out",type:"once",assignee:"both",comp:{},
    notes:"Underline things in your Whisper book that hit you hardest. Post 2 thoughts from Chapter 1 on the FC App."},
  {id:"w1_fitness",name:"Fitness Test",subtitle:"Record your baseline",type:"once",assignee:"both",comp:{},
    notes:"Record pushups in 1 minute, sit-ups in 1 minute, and run a timed quarter mile. Write results on your bookmark."},
]

const initWk1 = (): any => ({
  verse:{text:"Exodus 20:6",fullText:"showing steadfast love to thousands of those who love me and keep my commandments",scott:false,filip:false},
  whisper:{text:"Chapter 1 — Whisper",scott:false,filip:false},
  wkOpts:["Full body (arms/chest/abs/legs)","40 pushups, 3min plank, 50 squats"],
  wkTarget:3,miTarget:6,miOutMin:4,
  workouts:{scott:[],filip:[]},mileage:{scott:[],filip:[]},
  tasks:[...WEEK1_TASKS],
})

const DEFAULT_DATA = (): any => ({user:null,theme:"dark",brave:false,strikes:{scott:4,filip:4},streaks:{scott:0,filip:0},
  total:0,crossTaps:{},daily:{},weeks:{},progTasks:[],verseMastery:{},
  growth:{physical:{scott:"",filip:"",comments:[]},spiritual:{scott:"",filip:"",comments:[]},
    relational:{scott:"",filip:"",comments:[]},intellectual:{scott:"",filip:"",comments:[]}},
  giving:{scott:"",filip:""},events:[...EVENTS_INIT],log:[]})

const gw = (d: any, w: number) => {
  if(!d.weeks[w]) {
    if(w===1) { d.weeks[w] = initWk1() }
    else {
      d.weeks[w] = initWk()
      // Carry forward workout options and targets from the most recent configured week
      for(let pw = w - 1; pw >= 1; pw--) {
        const prev = d.weeks[pw]
        if(prev && (prev.wkOpts?.length > 0 || prev.wkTarget > 0)) {
          d.weeks[w].wkOpts = [...(prev.wkOpts || [])]
          d.weeks[w].wkTarget = prev.wkTarget || 3
          d.weeks[w].miTarget = prev.miTarget || 10
          d.weeks[w].miOutMin = prev.miOutMin || 5
          break
        }
      }
    }
  }
  return d.weeks[w]
}
const gd = (d: any, ds2: string) => { if(!d.daily[ds2]) d.daily[ds2] = {bible:{scott:false,filip:false},devotional:{scott:false,filip:false},journal:{scott:false,filip:false}}; return d.daily[ds2] }
const addLog = (d: any, entry: any) => { d.log = [{...entry,time:new Date().toISOString()},...(d.log||[]).slice(0,500)] }
const removeLog = (d: any, user: string, task: string) => { const idx = (d.log||[]).findIndex((e: any) => e.type==="complete" && e.user===user && e.task===task); if(idx>=0) d.log.splice(idx,1) }

// Fetch latest state from Supabase
async function fetchState(): Promise<any> {
  const { data, error } = await supabase
    .from("app_data")
    .select("data")
    .eq("id", ROW_ID)
    .single()
  if (error || !data) return DEFAULT_DATA()
  const d = data.data
  return (d && typeof d === "object" && Object.keys(d).length > 0) ? d : DEFAULT_DATA()
}

// Merge-safe write: fetch latest, apply mutation, save
async function mergeWrite(mutateFn: (current: any) => any): Promise<any> {
  const latest = await fetchState()
  const updated = mutateFn(JSON.parse(JSON.stringify(latest)))
  const { error } = await supabase
    .from("app_data")
    .update({ data: updated, updated_at: new Date().toISOString() })
    .eq("id", ROW_ID)
  if (error) console.error("Save error:", error)
  return updated
}

// Local-only fields: stored in browser localStorage, never in Supabase
const getLocalUser = (): string | null => { try { return localStorage.getItem("fc30_user") } catch { return null } }
const setLocalUser = (u: string) => { try { localStorage.setItem("fc30_user", u) } catch {} }
const getLocalTheme = (): string => { try { return localStorage.getItem("fc30_theme") || "dark" } catch { return "dark" } }
const setLocalTheme = (th: string) => { try { localStorage.setItem("fc30_theme", th) } catch {} }

// Custom hook: manages state + real-time subscription
function useFC30() {
  const [D, setD] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [user, setUserState] = useState<string | null>(getLocalUser)
  const [theme, setThemeState] = useState<string>(getLocalTheme)
  const skipNextRT = useRef(false)

  // Initial load
  useEffect(() => {
    fetchState().then(d => { setD(d); setLoading(false) })
  }, [])

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel("fc30_realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "app_data", filter: `id=eq.${ROW_ID}` },
        (payload) => {
          if (skipNextRT.current) { skipNextRT.current = false; return }
          const newData = payload.new?.data
          if (newData && typeof newData === "object") setD(newData)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // Merge-safe mutate: applies a mutation against latest DB state
  const mutate = useCallback(async (mutateFn: (current: any) => any) => {
    skipNextRT.current = true
    const updated = await mergeWrite(mutateFn)
    setD(updated)
  }, [])

  // Set user (localStorage only)
  const setUser = useCallback((u: string) => { setUserState(u); setLocalUser(u) }, [])

  // Set theme (localStorage only)
  const setTheme = useCallback((th: string) => { setThemeState(th); setLocalTheme(th) }, [])

  return { D, loading, mutate, user, theme, setUser, setTheme }
}

// ═══════════════════════════════════════════════════════════════
// BASE UI COMPONENTS
// ═══════════════════════════════════════════════════════════════
function Shield({on,s=14,t}: {on:boolean,s?:number,t:any}) {
  return <svg width={s} height={s*1.2} viewBox="0 0 22 27"><path d="M11 1.5L2.5 5.5V12c0 6 3.8 9.8 8.5 11.5C15.7 21.8 19.5 18 19.5 12V5.5L11 1.5z" fill={on?t.gold:t.mutedDark} stroke={on?t.goldBright:"none"} strokeWidth=".8" opacity={on?1:.3}/></svg>
}

function XDiv({t,idx,onTap}: {t:any,idx:number,onTap?:(i:number)=>void}) {
  return <div onClick={()=>onTap?.(idx)} style={{display:"flex",alignItems:"center",gap:10,margin:"14px 0",opacity:.25,cursor:"pointer"}}>
    <div style={{flex:1,height:1,background:t.borderMed}}/><svg width="10" height="14" viewBox="0 0 10 14" fill={t.muted}><rect x="3.5" width="3" height="14" rx="1"/><rect y="3.5" width="10" height="3" rx="1"/></svg><div style={{flex:1,height:1,background:t.borderMed}}/></div>
}

function Card({children,style:s,glow,urgent,t,onClick}: {children:any,style?:any,glow?:string|null,urgent?:boolean,t:any,onClick?:()=>void}) {
  return <div onClick={onClick} style={{background:t.card,borderRadius:14,padding:14,marginBottom:8,
    border:`1.5px solid ${urgent?"rgba(232,84,62,0.3)":t.border}`,boxShadow:glow?`0 0 14px ${glow}`:urgent?`0 0 10px rgba(232,84,62,0.15)`:`0 1px 3px rgba(0,0,0,0.2)`,transition:"all 0.3s",...s}}>{children}</div>
}

function SH({children,icon,t,right}: {children:any,icon?:string,t:any,right?:any}) {
  return <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",margin:"14px 0 6px"}}>
    <div style={{display:"flex",alignItems:"center",gap:6}}>{icon&&<span style={{fontSize:15}}>{icon}</span>}<h3 style={{fontFamily:FD,fontSize:17,color:t.cream2,fontWeight:600,margin:0}}>{children}</h3></div>{right}</div>
}

function Prog({v,max,color,h=5,label,t}: {v:number,max:number,color:string,h?:number,label:string,t:any}) {
  const pct = max>0?Math.min((v/max)*100,100):0; const hit = v>=max&&max>0
  return <div><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
    <span style={{fontFamily:FB,fontSize:12,color:t.muted}}>{label}</span>
    <span style={{fontFamily:FB,fontSize:12,fontWeight:700,color:hit?t.greenBright:t.cream2}}>{typeof v==="number"&&v%1?v.toFixed(1):v}/{max}{hit?" ✦":""}</span>
  </div><div style={{height:h,borderRadius:h,background:t.border,overflow:"hidden"}}>
    <div style={{height:"100%",borderRadius:h,width:`${pct}%`,transition:"width 0.5s",background:hit?`linear-gradient(90deg,${color},${t.goldBright})`:color}}/></div></div>
}

function StatIcon({done,sz=28,tap,onTap,t}: {done:boolean,sz?:number,tap?:boolean,onTap?:()=>void,t:any}) {
  const [burst,setBurst] = useState(false)
  const go = () => { if(!tap) return; if(!done) setBurst(true); onTap?.() }
  useEffect(() => { if(burst){ const x = setTimeout(()=>setBurst(false),1200); return ()=>clearTimeout(x) } }, [burst])
  // Generate 16 particles in a radial pattern with varied distances
  const particles = Array.from({length:16},(_,i)=>{
    const angle = (i/16)*Math.PI*2 + (i%2?0.2:-0.2)
    const dist = 18 + (i%3)*8 + (i%2)*4
    const x = Math.cos(angle)*dist, y = Math.sin(angle)*dist
    const size = i%3===0?5:i%2?4:3
    const colors = [t.greenBright,t.goldBright,t.gold,"#fff",t.greenBright,t.goldBright]
    return {x,y,size,color:colors[i%colors.length],delay:i%4*0.03}
  })
  return <div style={{position:"relative",width:sz,height:sz,cursor:tap?"pointer":"default"}} onClick={go}>
    {burst&&<div style={{position:"absolute",inset:-6,borderRadius:14,border:`2.5px solid ${t.green}`,animation:"celRing 0.9s ease forwards",pointerEvents:"none"}}/>}
    {burst&&<div style={{position:"absolute",inset:-10,borderRadius:18,border:`1.5px solid ${t.goldBright}`,animation:"celRing2 1s ease forwards",pointerEvents:"none"}}/>}
    {burst&&<div style={{position:"absolute",inset:-4,borderRadius:12,background:t.greenGlow,animation:"celGlow 0.8s ease forwards",pointerEvents:"none"}}/>}
    {burst&&particles.map((p,i)=><div key={i} style={{position:"absolute",top:"50%",left:"50%",
      width:p.size,height:p.size,borderRadius:p.size,background:p.color,pointerEvents:"none",
      animation:`particleFly 0.9s ${p.delay}s cubic-bezier(0.25,0.46,0.45,0.94) forwards`,
      "--px":`${p.x}px`,"--py":`${p.y}px`} as any}/>)}
    {burst&&[0,1,2,3].map(i=><div key={`spark${i}`} style={{position:"absolute",top:"50%",left:"50%",
      width:2,height:8,borderRadius:1,background:t.goldBright,pointerEvents:"none",
      transform:`translate(-50%,-50%) rotate(${i*90+45}deg)`,
      animation:`sparkFly${i} 0.7s ease forwards`}}/>)}
    <div style={{width:sz,height:sz,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",
      background:done?t.greenDim:tap?t.card2:"rgba(100,100,120,0.06)",
      border:`1.5px solid ${done?t.greenBright:tap?t.borderLight:"rgba(100,100,120,0.15)"}`,
      transform:burst?"scale(1.2)":"scale(1)",transition:"all 0.3s cubic-bezier(0.34,1.56,0.64,1)",
      boxShadow:done?`0 0 12px ${t.greenGlow}`:"none"}}>
      <span style={{fontSize:sz*.5,fontWeight:700,color:done?t.greenBright:tap?t.muted:t.mutedDark,
        transform:burst?"scale(1.3)":"scale(1)",transition:"transform 0.3s cubic-bezier(0.34,1.56,0.64,1)"}}>{done?"✓":"○"}</span></div></div>
}

function Btn({children,onClick,v="primary",sm,t,style:s,disabled:dis}: {children:any,onClick?:()=>void,v?:string,sm?:boolean,t:any,style?:any,disabled?:boolean}) {
  const base: any = {fontFamily:FB,fontWeight:600,border:"none",borderRadius:10,cursor:dis?"default":"pointer",transition:"all 0.2s",opacity:dis?.4:1}
  const vs: any = {primary:{background:`linear-gradient(135deg,${t.gold},${t.goldBright})`,color:"#111114",padding:sm?"7px 16px":"11px 22px",fontSize:sm?12:14,
      boxShadow:`0 2px 8px rgba(0,0,0,0.3)`},
    secondary:{background:"transparent",color:t.gold,padding:sm?"6px 14px":"10px 20px",fontSize:sm?12:14,border:`1.5px solid ${t.borderLight}`,
      boxShadow:`0 1px 4px rgba(0,0,0,0.15)`},
    ghost:{background:t.card2,color:t.cream2,padding:"5px 12px",fontSize:12,border:`1px solid ${t.borderMed}`},
    danger:{background:"rgba(212,80,80,0.1)",color:t.red,padding:sm?"6px 14px":"10px 20px",fontSize:sm?12:14,border:`1px solid rgba(212,80,80,0.25)`}}
  return <button onClick={dis?undefined:onClick} style={{...base,...vs[v],...s}}>{children}</button>
}

function BSheet({open,onClose,title,t,children}: {open:boolean,onClose:()=>void,title:string,t:any,children:any}) {
  if(!open) return null
  return <div style={{position:"fixed",inset:0,zIndex:100}}>
    <div onClick={onClose} style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.6)"}}/>
    <div style={{position:"absolute",bottom:0,left:0,right:0,background:t.card,borderRadius:"20px 20px 0 0",
      padding:"16px 20px 32px",maxHeight:"80vh",overflowY:"auto",zIndex:101}}>
      <div style={{width:36,height:4,borderRadius:2,background:t.borderMed,margin:"0 auto 16px"}}/>
      <h3 style={{fontFamily:FD,fontSize:20,color:t.cream,margin:"0 0 16px"}}>{title}</h3>{children}</div></div>
}

function Inp({value,onChange,placeholder,t,type="text",style:s}: {value:string,onChange:(v:string)=>void,placeholder?:string,t:any,type?:string,style?:any}) {
  return <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
    style={{width:"100%",boxSizing:"border-box",padding:"11px 14px",borderRadius:10,border:`1.5px solid ${t.borderMed}`,
      background:t.card2,color:t.cream,fontFamily:FB,fontSize:15,outline:"none",...s}}/>
}

function TA({value,onChange,placeholder,t,rows=3}: {value:string,onChange:(v:string)=>void,placeholder?:string,t:any,rows?:number}) {
  return <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows}
    style={{width:"100%",boxSizing:"border-box",padding:"11px 14px",borderRadius:10,border:`1.5px solid ${t.borderMed}`,
      background:t.card2,color:t.cream,fontFamily:FB,fontSize:15,outline:"none",resize:"vertical"}}/>
}

function Tog({opts,value,onChange,t}: {opts:{v:any,l:string}[],value:any,onChange:(v:any)=>void,t:any}) {
  return <div style={{display:"flex",gap:4,background:t.card2,borderRadius:10,padding:3}}>
    {opts.map(o=><button key={String(o.v)} onClick={()=>onChange(o.v)} style={{flex:1,padding:"6px 10px",borderRadius:8,border:"none",fontFamily:FB,fontSize:12,
      fontWeight:600,cursor:"pointer",transition:"all 0.2s",background:value===o.v?t.gold:"transparent",color:value===o.v?"#111114":t.muted}}>{o.l}</button>)}</div>
}

function UBadge({hrs,type="daily",t}: {hrs:number,type?:string,t:any}) {
  const show = type==="daily"?hrs<=6:hrs<=48; if(!show) return null
  const crit = type==="daily"?hrs<=2:hrs<=24; const h = Math.floor(hrs)
  const label = type==="daily"?(h<=0?"Due now!":h+"h left"):(h<=24?h+"h left":Math.ceil(hrs/24)+"d left")
  return <span style={{fontSize:10,fontFamily:FB,fontWeight:700,padding:"2px 7px",borderRadius:12,
    background:crit?"rgba(232,84,62,0.12)":"rgba(196,90,72,0.08)",color:crit?t.urgent:t.red,
    animation:crit?"urgPulse 1.5s ease infinite":"none"}}>⏱ {label}</span>
}

function SwipeRow({children,onComplete,done,t}: {children:any,onComplete?:()=>void,done:boolean,t:any}) {
  const startX = useRef(0); const [dx,setDx] = useState(0); const [undo,setUndo] = useState(false)
  const onTS = (e: any) => { if(done) return; startX.current = e.touches[0].clientX }
  const onTM = (e: any) => { if(done) return; const d = Math.max(0,e.touches[0].clientX-startX.current); setDx(Math.min(d,120)) }
  const onTE = () => { if(dx>80){ onComplete?.(); setUndo(true); setTimeout(()=>setUndo(false),3000) } setDx(0) }
  return <div style={{position:"relative",overflow:"hidden",borderRadius:14,marginBottom:8}}>
    <div style={{position:"absolute",inset:0,background:t.green,borderRadius:14,display:"flex",alignItems:"center",paddingLeft:16,
      opacity:dx>0?.8:0,transition:dx>0?"none":"opacity 0.3s"}}>
      <span style={{color:"#fff",fontFamily:FB,fontSize:13,fontWeight:700}}>✓ Complete</span></div>
    <div onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}
      style={{transform:`translateX(${dx}px)`,transition:dx>0?"none":"transform 0.3s",position:"relative",zIndex:1}}>{children}</div>
    {undo&&<div style={{position:"fixed",bottom:80,left:"50%",transform:"translateX(-50%)",zIndex:200,
      padding:"8px 20px",borderRadius:10,background:t.card,border:`1px solid ${t.borderMed}`,boxShadow:"0 4px 20px rgba(0,0,0,0.3)"}}>
      <span style={{fontFamily:FB,fontSize:13,color:t.cream}}>Completed · </span>
      <button onClick={()=>setUndo(false)} style={{fontFamily:FB,fontSize:13,fontWeight:700,color:t.gold,background:"none",border:"none",cursor:"pointer"}}>Undo</button></div>}
  </div>
}

// ═══════════════════════════════════════════════════════════════
// EASTER EGGS & OVERLAYS
// ═══════════════════════════════════════════════════════════════
function Overlay({show,onDone,ms=2500,children}: {show:boolean,onDone:()=>void,ms?:number,children:any}) {
  useEffect(()=>{ if(show){ const x=setTimeout(onDone,ms); return ()=>clearTimeout(x) } },[show])
  if(!show) return null
  return <div style={{position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",
    background:"rgba(0,0,0,0.85)",animation:"fadeIn 0.3s ease"}}>{children}</div>
}

function LionRoars({show,onDone,t}: {show:boolean,onDone:()=>void,t:any}) {
  return <Overlay show={show} onDone={onDone}><div style={{textAlign:"center",animation:"lionPulse 2s ease"}}>
    <div style={{fontSize:80,marginBottom:16}}>🦁</div>
    <div style={{fontFamily:FD,fontSize:28,color:t.goldBright,textShadow:`0 0 30px ${t.gold}`,marginBottom:8}}>THE LION ROARS</div>
    <div style={{fontFamily:FB,fontSize:14,color:t.cream2,opacity:.8}}>Both warriors completed all dailies today</div></div></Overlay>
}

function FreedomBanner({show,onDone}: {show:boolean,onDone:()=>void}) {
  return <Overlay show={show} onDone={onDone} ms={3000}>
    <div style={{textAlign:"center"}}><div style={{fontSize:60,marginBottom:8}}>⚔️</div>
    <div style={{fontFamily:FD,fontSize:42,fontWeight:900,color:"#4a8ae0",textShadow:"0 0 40px rgba(74,138,224,0.5)",
      letterSpacing:8,animation:"freedomPulse 1.5s ease infinite"}}>FREEDOM!</div>
    <div style={{fontFamily:FB,fontSize:14,color:"#8ba4c4",marginTop:12,opacity:.8}}>All dailies complete. The field is won.</div></div></Overlay>
}

function Toast({show,onDone,ms=1500,children,t}: {show:boolean,onDone:()=>void,ms?:number,children:any,t:any}) {
  useEffect(()=>{ if(show){ const x=setTimeout(onDone,ms); return ()=>clearTimeout(x) } },[show])
  if(!show) return null
  return <div style={{position:"fixed",top:80,left:"50%",transform:"translateX(-50%)",zIndex:150,
    padding:"8px 20px",borderRadius:10,background:t.card,border:`1px solid ${t.gold}`,
    boxShadow:"0 4px 20px rgba(0,0,0,0.4)",animation:"slideDown 0.3s ease"}}>{children}</div>
}

function MilestoneFlash({n,show,onDone,t}: {n:number,show:boolean,onDone:()=>void,t:any}) {
  return <Overlay show={show} onDone={onDone} ms={2000}>
    <div style={{textAlign:"center"}}><div style={{fontSize:48,marginBottom:12}}>🏆</div>
    <div style={{fontFamily:FD,fontSize:32,color:t.goldBright}}>{n}</div>
    <div style={{fontFamily:FB,fontSize:14,color:t.cream2}}>tasks completed together!</div></div></Overlay>
}

function StreakOverlay({days,show,onDone,t}: {days:number,show:boolean,onDone:()=>void,t:any}) {
  const msg = days>=70?"YOU HELD THE LINE":days>=21?"Habits are forging":"One week strong"
  return <Overlay show={show} onDone={onDone}><div style={{textAlign:"center"}}>
    {days>=70?<div style={{fontSize:80,marginBottom:16}}>🦁</div>:<div style={{fontSize:60,marginBottom:16}}>🔥</div>}
    <div style={{fontFamily:FD,fontSize:days>=70?32:24,color:days>=70?t.goldBright:t.cream,
      textShadow:days>=70?`0 0 30px ${t.gold}`:"none",marginBottom:8}}>{msg}</div>
    <div style={{fontFamily:FB,fontSize:16,color:t.goldText}}>{days} day streak</div></div></Overlay>
}

// ═══════════════════════════════════════════════════════════════
// SMART FOCUS BAR
// ═══════════════════════════════════════════════════════════════
function SmartBar({D,user,dayNum,wk,t,brave}: {D:any,user:string,dayNum:number,wk:number,t:any,brave:boolean}) {
  const s = ds(d4d(dayNum)); const dc = gd(D,s); const p = user==="scott"?"filip":"scott"
  const myDone = dc.bible?.[user]&&dc.devotional?.[user]&&dc.journal?.[user]
  const pDone = dc.bible?.[p]&&dc.devotional?.[p]&&dc.journal?.[p]
  const streak = D.streaks?.[user]||0; const hl = hrsLeft(dayNum)
  let msg = "", icon = "⚔️"
  if(brave) {
    if(myDone&&pDone){msg="Both warriors stand. The line holds.";icon="🏴"}
    else if(myDone){msg=`You've done your part. Will ${p==="scott"?"Scott":"Filip"} answer?`;icon="🏴"}
    else if(hl<2){msg="THEY MAY TAKE OUR LIVES — but finish your tasks first.";icon="⚔️"}
    else if(pDone){msg=`${p==="scott"?"Scott":"Filip"} charged the field. FREEDOM awaits!`;icon="🏴‍☠️"}
    else{msg="Every warrior has a battle to fight today.";icon="⚔️"}
  } else {
    if(myDone&&pDone){msg="Both warriors complete ✦ The line holds.";icon="⚔️"}
    else if(hl<2&&!myDone){const m: string[]=[];if(!dc.bible?.[user])m.push("Bible");if(!dc.devotional?.[user])m.push("Devotional");
      if(!dc.journal?.[user])m.push("Journal");msg=`${Math.floor(hl)}h left — ${m.join(", ")} still incomplete`;icon="⏱"}
    else if(pDone&&!myDone){msg=`${p==="scott"?"Scott":"Filip"} completed all dailies. Your move.`;icon="🔥"}
    else if(streak>=5){msg=`${streak} day streak 🔥 Keep it going`;icon="🔥"}
    else{msg=`Day ${dayNum+1} of 70 — Hold the line.`;icon="⚔️"}
  }
  return <div style={{padding:"10px 14px",background:t.goldDim,borderRadius:10,marginBottom:10,border:`1px solid ${t.gold}33`}}>
    <div style={{fontFamily:FB,fontSize:14,fontWeight:600,color:t.goldText}}><span style={{marginRight:6}}>{icon}</span>{msg}</div></div>
}

// ═══════════════════════════════════════════════════════════════
// TASK ROW
// ═══════════════════════════════════════════════════════════════
function DailyMiniChecks({task,who,user,dayNum,wk,t,onToggle}: any) {
  return <div style={{display:"flex",gap:3}}>
    {DAYS_SHORT.map((d,i)=>{
      const k=`${who}_${i}`;const done=!!task.comp?.[k];const isToday=i===(dayNum-((wk-1)*7))
      return <button key={i} onClick={()=>who===user&&onToggle(task.id,who,i)}
        style={{width:20,height:20,borderRadius:5,border:`1.5px solid ${done?t.green:isToday?t.gold:t.borderMed}`,
          background:done?t.greenDim:"transparent",display:"flex",alignItems:"center",justifyContent:"center",
          cursor:who===user?"pointer":"default",fontSize:8,color:done?t.green:t.mutedDark,padding:0}}>
        {done?"✓":d[0]}</button>})}
  </div>
}

function TaskRow({task,user,t,dayNum,wk,onToggle,onEdit,onXtimes}: any) {
  const p = user==="scott"?"filip":"scott"
  const isXt = task.type==="xtimes"
  const isDailyType = task.type==="daily"
  const [expanded, setExpanded] = useState(false)
  if(task.assignee&&task.assignee!=="both"&&task.assignee!==user&&task.assignee!==p) return null
  let userDone=false, partDone=false
  if(isXt){userDone=(task.comp?.[user]||0)>=(task.target||1);partDone=(task.comp?.[p]||0)>=(task.target||1)}
  else if(isDailyType){const dow=(dayNum-((wk-1)*7));userDone=!!task.comp?.[`${user}_${dow}`];partDone=!!task.comp?.[`${p}_${dow}`]}
  else{userDone=!!task.comp?.[user];partDone=!!task.comp?.[p]}
  const allDone = userDone&&partDone
  const hasExtra = !!(task.notes || (task.choices && task.choices.length > 0))

  const content = <Card t={t} style={{opacity:allDone?.6:1,borderColor:allDone?`${t.green}44`:undefined}} glow={null}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      {isXt?<div style={{display:"flex",alignItems:"center",gap:4}}>
        <button onClick={()=>onXtimes(task.id,"scott",-1)} disabled={user!=="scott"} style={{width:22,height:22,borderRadius:6,
          border:`1px solid ${t.borderMed}`,background:t.card2,color:t.cream,fontSize:13,cursor:user==="scott"?"pointer":"default",
          display:"flex",alignItems:"center",justifyContent:"center",opacity:user!=="scott"?.5:1}}>−</button>
        <span style={{fontFamily:FB,fontSize:13,fontWeight:700,color:t.scott,minWidth:16,textAlign:"center"}}>{task.comp?.scott||0}</span>
        <button onClick={()=>onXtimes(task.id,"scott",1)} disabled={user!=="scott"} style={{width:22,height:22,borderRadius:6,
          border:`1px solid ${t.borderMed}`,background:t.card2,color:t.cream,fontSize:13,cursor:user==="scott"?"pointer":"default",
          display:"flex",alignItems:"center",justifyContent:"center",opacity:user!=="scott"?.5:1}}>+</button>
      </div>
      :isDailyType?<DailyMiniChecks task={task} who="scott" user={user} dayNum={dayNum} wk={wk} t={t} onToggle={onToggle}/>
      :<StatIcon done={!!task.comp?.scott} sz={24} tap={user==="scott"} t={t} onTap={()=>user==="scott"&&onToggle(task.id,"scott")}/>}
      <div style={{textAlign:"center",flex:1,padding:"0 8px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
          <div style={{cursor:"pointer"}} onClick={()=>onEdit?.(task)}>
            <div style={{fontFamily:FB,fontSize:15,fontWeight:600,color:t.cream,textDecoration:allDone?"line-through":"none"}}>{task.name}</div>
          </div>
          {hasExtra&&<button onClick={(e)=>{e.stopPropagation();setExpanded(!expanded)}}
            style={{background:"none",border:"none",color:t.muted,fontSize:10,cursor:"pointer",padding:"2px 4px",
              transform:expanded?"rotate(90deg)":"none",transition:"transform 0.2s"}}>▸</button>}
        </div>
        {task.subtitle&&<div style={{fontFamily:FB,fontSize:13,color:t.muted}}>{task.subtitle}</div>}
        {task.postReq&&task.postReq!=="none"&&<div style={{display:"inline-flex",alignItems:"center",gap:3,
          marginTop:2,padding:"2px 8px",borderRadius:6,background:`${t.gold}18`,border:`1px solid ${t.gold}33`}}>
          <span style={{fontSize:11}}>{task.postReq==="photo"?"📸":task.postReq==="writing"?"⌨️":"📸⌨️"}</span>
          <span style={{fontFamily:FB,fontSize:9,fontWeight:700,color:t.goldText,letterSpacing:0.5}}>
            {task.postReq==="photo"?"PHOTO":task.postReq==="writing"?"POST":"PHOTO + POST"}</span></div>}
        {isXt&&<div style={{fontFamily:FB,fontSize:10,color:t.mutedDark}}>Target: {task.target}×</div>}
      </div>
      {isXt?<div style={{display:"flex",alignItems:"center",gap:4}}>
        <button onClick={()=>onXtimes(task.id,"filip",-1)} disabled={user!=="filip"} style={{width:22,height:22,borderRadius:6,
          border:`1px solid ${t.borderMed}`,background:t.card2,color:t.cream,fontSize:13,cursor:user==="filip"?"pointer":"default",
          display:"flex",alignItems:"center",justifyContent:"center",opacity:user!=="filip"?.5:1}}>−</button>
        <span style={{fontFamily:FB,fontSize:13,fontWeight:700,color:t.filip,minWidth:16,textAlign:"center"}}>{task.comp?.filip||0}</span>
        <button onClick={()=>onXtimes(task.id,"filip",1)} disabled={user!=="filip"} style={{width:22,height:22,borderRadius:6,
          border:`1px solid ${t.borderMed}`,background:t.card2,color:t.cream,fontSize:13,cursor:user==="filip"?"pointer":"default",
          display:"flex",alignItems:"center",justifyContent:"center",opacity:user!=="filip"?.5:1}}>+</button>
      </div>
      :isDailyType?<DailyMiniChecks task={task} who="filip" user={user} dayNum={dayNum} wk={wk} t={t} onToggle={onToggle}/>
      :<StatIcon done={!!task.comp?.filip} sz={24} tap={user==="filip"} t={t} onTap={()=>user==="filip"&&onToggle(task.id,"filip")}/>}
    </div>
    {expanded&&<div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${t.border}`}}>
      {task.choices&&task.choices.length>0&&<div style={{marginBottom:task.notes?8:0}}>
        <div style={{fontFamily:FB,fontSize:10,fontWeight:700,color:t.goldText,marginBottom:4}}>OPTIONS:</div>
        {task.choices.map((c: string,ci: number)=><div key={ci} style={{fontFamily:FB,fontSize:11,color:t.cream2,lineHeight:1.4,
          padding:"4px 8px",marginBottom:3,background:t.card2,borderRadius:6,borderLeft:`2px solid ${t.gold}`}}>
          <span style={{fontWeight:700,color:t.goldText}}>#{ci+1}</span> {c}</div>)}</div>}
      {task.notes&&<div style={{fontFamily:FB,fontSize:11,color:t.cream2,lineHeight:1.5,
        padding:"6px 8px",background:t.card2,borderRadius:6}}>{task.notes}</div>}
    </div>}
  </Card>

  if(!isXt&&!isDailyType) return <SwipeRow done={userDone} t={t} onComplete={()=>onToggle(task.id,user)}>{content}</SwipeRow>
  return content
}

// ═══════════════════════════════════════════════════════════════
// BOTTOM SHEETS (all use merge-safe mutate)
// ═══════════════════════════════════════════════════════════════
function WorkoutSheet({open,onClose,t,mutate,user,wk,wkOpts}: any) {
  const [opt,setOpt] = useState("")
  const log = () => {
    mutate((nd: any) => {
      const w = gw(nd,wk); if(!w.workouts[user]) w.workouts[user] = []
      w.workouts[user].push({opt:opt||"Workout",date:tds()}); nd.total=(nd.total||0)+1
      addLog(nd,{type:"workout",user,detail:opt||"Workout",date:tds()}); return nd
    }); setOpt(""); onClose()
  }
  return <BSheet open={open} onClose={onClose} title="Log Workout" t={t}>
    <div style={{fontFamily:FB,fontSize:13,color:t.muted,marginBottom:8}}>Workout type</div>
    {wkOpts?.length>0?<div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
      {wkOpts.map((o: string,i: number)=><button key={i} onClick={()=>setOpt(o)} style={{padding:"8px 16px",borderRadius:8,fontFamily:FB,fontSize:13,
        cursor:"pointer",border:`1.5px solid ${opt===o?t.gold:t.borderMed}`,background:opt===o?t.goldDim:t.card2,
        color:opt===o?t.goldText:t.cream}}>{o}</button>)}</div>
    :<Inp value={opt} onChange={setOpt} placeholder="e.g. Upper body" t={t}/>}
    <Btn t={t} onClick={log} style={{width:"100%",marginTop:12}}>Log Workout</Btn></BSheet>
}

function MileageSheet({open,onClose,t,mutate,user,wk}: any) {
  const [at,setAt] = useState("running"); const [mi,setMi] = useState(""); const [out,setOut] = useState(true)
  const eq = () => { const m=parseFloat(mi)||0; return at==="biking"?(m/3).toFixed(1):at==="elliptical"?(m/2).toFixed(1):at==="swimming"?(m*3).toFixed(1):m.toFixed(1) }
  const log = () => {
    if(!mi) return
    mutate((nd: any) => {
      const w = gw(nd,wk); if(!w.mileage[user]) w.mileage[user] = []
      w.mileage[user].push({type:at,miles:parseFloat(mi),outdoor:out,date:tds()}); nd.total=(nd.total||0)+1
      addLog(nd,{type:"mileage",user,detail:`${mi}mi ${at} (${eq()} equiv)`,date:tds()}); return nd
    }); setMi(""); onClose()
  }
  return <BSheet open={open} onClose={onClose} title="Log Mileage" t={t}>
    <div style={{fontFamily:FB,fontSize:13,color:t.muted,marginBottom:6}}>Activity type</div>
    <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
      {["running","walking","biking","elliptical","swimming"].map(a=><button key={a} onClick={()=>setAt(a)}
        style={{padding:"8px 14px",borderRadius:8,fontFamily:FB,fontSize:12,cursor:"pointer",textTransform:"capitalize",
          border:`1.5px solid ${at===a?t.gold:t.borderMed}`,background:at===a?t.goldDim:t.card2,color:at===a?t.goldText:t.cream}}>{a}</button>)}</div>
    <div style={{fontFamily:FB,fontSize:13,color:t.muted,marginBottom:6}}>Actual miles</div>
    <Inp value={mi} onChange={setMi} placeholder="0.0" t={t} type="number"/>
    {mi&&<div style={{fontFamily:FB,fontSize:12,color:t.goldText,marginTop:4}}>= {eq()} equivalent miles</div>}
    <div style={{fontFamily:FB,fontSize:13,color:t.muted,margin:"12px 0 6px"}}>Location</div>
    <Tog opts={[{v:true,l:"🌳 Outdoor"},{v:false,l:"🏠 Indoor"}]} value={out} onChange={setOut} t={t}/>
    <Btn t={t} onClick={log} style={{width:"100%",marginTop:16}}>Log Activity</Btn></BSheet>
}

function SetupSheet({open,field,onClose,t,mutate,wk,wkData}: any) {
  const [val,setVal] = useState(""); const [val2,setVal2] = useState(""); const [opts,setOpts] = useState("")
  const [verseBody,setVerseBody] = useState("")
  useEffect(()=>{
    if(field==="verse") {setVal(wkData?.verse?.text||""); setVerseBody(wkData?.verse?.fullText||"")}
    if(field==="whisper") setVal(wkData?.whisper?.text||"")
    if(field==="workout"){setOpts((wkData?.wkOpts||[]).join(", "));setVal(String(wkData?.wkTarget||3))}
    if(field==="mileage"){setVal(String(wkData?.miTarget||10));setVal2(String(wkData?.miOutMin||5))}
  },[field,wk,wkData])
  const doSave = () => {
    mutate((nd: any) => {
      const w = gw(nd,wk)
      if(field==="verse") w.verse={...w.verse,text:val,fullText:verseBody}
      if(field==="whisper") w.whisper={...w.whisper,text:val}
      if(field==="workout"){w.wkOpts=opts.split(",").map((s: string)=>s.trim()).filter(Boolean);w.wkTarget=parseInt(val)||3}
      if(field==="mileage"){w.miTarget=parseFloat(val)||10;w.miOutMin=parseFloat(val2)||5}
      addLog(nd,{type:"edit",detail:`Updated ${field} for week ${wk}`,date:tds()}); return nd
    }); onClose()
  }
  const titles: any = {verse:"Set Memory Verse",whisper:"Set Whisper Reading",workout:"Workout Setup",mileage:"Mileage Setup"}
  return <BSheet open={open} onClose={onClose} title={titles[field]||"Setup"} t={t}>
    {field==="verse"&&<div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div><div style={{fontFamily:FB,fontSize:12,color:t.muted,marginBottom:4}}>Verse reference</div>
        <Inp value={val} onChange={setVal} placeholder="e.g. Romans 8:28" t={t}/></div>
      <div><div style={{fontFamily:FB,fontSize:12,color:t.muted,marginBottom:4}}>Full verse text <span style={{color:t.goldText}}>(for practice)</span></div>
        <TA value={verseBody} onChange={setVerseBody} placeholder='e.g. "And we know that in all things God works for the good..."' t={t} rows={4}/></div></div>}
    {field==="whisper"&&<Inp value={val} onChange={setVal} placeholder="e.g. Chapters 3-4" t={t}/>}
    {field==="workout"&&<div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div><div style={{fontFamily:FB,fontSize:12,color:t.muted,marginBottom:4}}>Options (comma-separated)</div>
        <Inp value={opts} onChange={setOpts} placeholder="Upper body, Cardio, Legs" t={t}/></div>
      <div><div style={{fontFamily:FB,fontSize:12,color:t.muted,marginBottom:4}}>Min workouts/week</div>
        <Inp value={val} onChange={setVal} type="number" t={t}/></div></div>}
    {field==="mileage"&&<div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div><div style={{fontFamily:FB,fontSize:12,color:t.muted,marginBottom:4}}>Total equivalent miles target</div>
        <Inp value={val} onChange={setVal} type="number" t={t}/></div>
      <div><div style={{fontFamily:FB,fontSize:12,color:t.muted,marginBottom:4}}>Minimum outdoor miles</div>
        <Inp value={val2} onChange={setVal2} type="number" t={t}/></div></div>}
    <Btn t={t} onClick={doSave} style={{width:"100%",marginTop:16}}>Save</Btn></BSheet>
}

function AddTaskSheet({open,onClose,t,mutate,wk}: any) {
  const [mode,setMode]=useState("create");const [nm,setNm]=useState("");const [sub,setSub]=useState("");const [notes,setNotes]=useState("")
  const [tp,setTp]=useState("onetime");const [target,setTarget]=useState("3");const [asg,setAsg]=useState("both")
  const [rec,setRec]=useState(false);const [scope,setScope]=useState("this")
  const [selWks,setSelWks]=useState<Record<number,boolean>>({})
  const [ch,setCh]=useState<string[]>([]);const [newCh,setNewCh]=useState("")
  const [postReq,setPostReq]=useState<string>("none")
  const addChoice=()=>{if(newCh.trim()&&ch.length<3){setCh([...ch,newCh.trim()]);setNewCh("")}}
  const togWkSel=(w: number)=>setSelWks(p=>({...p,[w]:!p[w]}))
  const reset=()=>{setMode("create");setNm("");setSub("");setNotes("");setTp("onetime");setTarget("3");
    setAsg("both");setRec(false);setScope("this");setSelWks({});setCh([]);setNewCh("");setPostReq("none")}
  const applyPreset=(p: any)=>{setNm(p.name);setSub(p.subtitle||"");setTp(p.type);setTarget(String(p.target||3));
    setAsg(p.assignee||"both");setScope(p.scope||"this");setRec(p.recurring||false);setMode("create")}
  const PRESETS=[
    {icon:"🏋️",name:"Workout",subtitle:"Hit the gym or exercise",type:"xtimes",target:3,scope:"this",recurring:true},
    {icon:"📞",name:"Accountability Call",subtitle:"Call your partner",type:"onetime",scope:"this",recurring:true},
    {icon:"🙏",name:"Extra Prayer Time",subtitle:"Extended prayer session",type:"xtimes",target:2,scope:"this"},
    {icon:"📕",name:"Book Reading",subtitle:"Read assigned chapters",type:"onetime",scope:"this",recurring:true},
    {icon:"✍️",name:"Gratitude List",subtitle:"Write 5 things daily",type:"daily",scope:"this"},
    {icon:"🚫",name:"No Screen Time",subtitle:"Evening screen fast",type:"daily",scope:"this",recurring:true},
    {icon:"💧",name:"Hydration Goal",subtitle:"Drink 8 glasses",type:"daily",scope:"this"},
    {icon:"🤝",name:"Serve Someone",subtitle:"Act of service this week",type:"onetime",scope:"this"},
    {icon:"💬",name:"Share Faith",subtitle:"Have a faith conversation",type:"xtimes",target:1,scope:"this"},
    {icon:"🏃",name:"Morning Run",subtitle:"Run before 7am",type:"xtimes",target:3,scope:"this"},
    {icon:"📱",name:"Social Media Fast",subtitle:"No scrolling today",type:"daily",scope:"this",recurring:true},
    {icon:"🎯",name:"Custom Goal",subtitle:"Set your own target",type:"xtimes",target:5,scope:"this"},
  ]
  const add=()=>{if(!nm.trim())return
    mutate((nd: any)=>{
      const task: any={id:`t_${Date.now()}`,name:nm.trim(),subtitle:sub.trim(),notes:notes.trim(),type:tp,
        target:tp==="xtimes"?parseInt(target)||3:null,assignee:asg,postReq:postReq||"none",choices:ch.length>0?ch:[],
        choiceSel:{scott:0,filip:0},comp:tp==="xtimes"?{scott:0,filip:0}:tp==="daily"?{}:{scott:false,filip:false},order:999}
      if(scope==="program"){nd.progTasks=[...(nd.progTasks||[]),{...task,type:tp==="xtimes"?"xtimes":"onetime"}]}
      else{const weeks=scope==="all"?Array.from({length:10},(_,i)=>i+1)
        :scope==="specific"?Object.keys(selWks).filter(k=>selWks[parseInt(k)]).map(Number):[wk];
        weeks.forEach((w: number)=>{const wd=gw(nd,w);wd.tasks=[...wd.tasks,{...task,id:`t_${Date.now()}_w${w}`,
          comp:tp==="xtimes"?{scott:0,filip:0}:tp==="daily"?{}:{scott:false,filip:false}}]})
        if(rec){for(let w=Math.max(...weeks)+1;w<=10;w++){const wd=gw(nd,w);if(!wd.tasks.find((x: any)=>x.name===nm.trim())){
          wd.tasks=[...wd.tasks,{...task,id:`t_${Date.now()}_r${w}`,comp:tp==="xtimes"?{scott:0,filip:0}:tp==="daily"?{}:{scott:false,filip:false}}]}}}}
      addLog(nd,{type:"addTask",detail:nm,date:tds()});return nd
    });reset();onClose()}
  return <BSheet open={open} onClose={()=>{reset();onClose()}} title="Add Activity" t={t}>
    <div style={{display:"flex",gap:6,marginBottom:14}}>
      <button onClick={()=>setMode("presets")} style={{flex:1,padding:"8px",borderRadius:8,fontFamily:FB,fontSize:13,fontWeight:600,
        cursor:"pointer",border:`1.5px solid ${mode==="presets"?t.gold:t.borderMed}`,
        background:mode==="presets"?t.goldDim:"transparent",color:mode==="presets"?t.goldText:t.muted}}>⚡ Quick Add</button>
      <button onClick={()=>setMode("create")} style={{flex:1,padding:"8px",borderRadius:8,fontFamily:FB,fontSize:13,fontWeight:600,
        cursor:"pointer",border:`1.5px solid ${mode==="create"?t.gold:t.borderMed}`,
        background:mode==="create"?t.goldDim:"transparent",color:mode==="create"?t.goldText:t.muted}}>✏️ Custom</button>
    </div>
    {mode==="presets"?<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
      {PRESETS.map((p,i)=><button key={i} onClick={()=>applyPreset(p)}
        style={{padding:"10px",borderRadius:10,border:`1px solid ${t.borderMed}`,background:t.card2,cursor:"pointer",textAlign:"left"}}>
        <div style={{fontSize:18,marginBottom:4}}>{p.icon}</div>
        <div style={{fontFamily:FB,fontSize:12,fontWeight:700,color:t.cream,lineHeight:1.2}}>{p.name}</div>
        <div style={{fontFamily:FB,fontSize:10,color:t.muted,marginTop:2}}>{p.subtitle}</div>
        <div style={{display:"flex",gap:4,marginTop:4}}>
          <span style={{fontFamily:FB,fontSize:9,color:t.mutedDark,padding:"1px 5px",borderRadius:4,background:t.card}}>{p.type}</span>
          {p.recurring&&<span style={{fontFamily:FB,fontSize:9,color:t.goldText,padding:"1px 5px",borderRadius:4,background:t.goldDim}}>recurring</span>}
        </div></button>)}</div>
    :<div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div><div style={{fontFamily:FB,fontSize:12,color:t.muted,marginBottom:4}}>Name *</div>
        <Inp value={nm} onChange={setNm} placeholder="e.g. Cold shower, Memorize Psalm 23" t={t}/></div>
      <div><div style={{fontFamily:FB,fontSize:12,color:t.muted,marginBottom:4}}>Description</div>
        <Inp value={sub} onChange={setSub} placeholder="Short subtitle" t={t}/></div>
      <div><div style={{fontFamily:FB,fontSize:12,color:t.muted,marginBottom:4}}>Notes</div>
        <TA value={notes} onChange={setNotes} placeholder="Details, instructions..." t={t} rows={2}/></div>
      <div><div style={{fontFamily:FB,fontSize:12,color:t.muted,marginBottom:6}}>Type</div>
        {[{v:"onetime",icon:"☑️",l:"One-time",desc:"Single checkbox for the week"},
          {v:"xtimes",icon:"🔢",l:"X times",desc:"Counter with a target (e.g. 3×/week)"},
          {v:"daily",icon:"📅",l:"Daily",desc:"7 checkboxes, one per day (Thu–Wed)"}].map(o=>
          <button key={o.v} onClick={()=>setTp(o.v)} style={{display:"flex",alignItems:"center",gap:10,width:"100%",
            padding:"10px 12px",borderRadius:10,marginBottom:4,cursor:"pointer",textAlign:"left",
            border:`1.5px solid ${tp===o.v?t.gold:t.borderMed}`,background:tp===o.v?t.goldDim:t.card2}}>
            <span style={{fontSize:16}}>{o.icon}</span>
            <div><div style={{fontFamily:FB,fontSize:13,fontWeight:600,color:tp===o.v?t.goldText:t.cream}}>{o.l}</div>
              <div style={{fontFamily:FB,fontSize:10,color:t.muted}}>{o.desc}</div></div></button>)}</div>
      {tp==="xtimes"&&<div><div style={{fontFamily:FB,fontSize:12,color:t.muted,marginBottom:4}}>How many times?</div>
        <div style={{display:"flex",gap:6}}>
          {[1,2,3,4,5,6,7].map(n=><button key={n} onClick={()=>setTarget(String(n))}
            style={{width:36,height:36,borderRadius:8,border:`1.5px solid ${String(n)===target?t.gold:t.borderMed}`,
              background:String(n)===target?t.goldDim:t.card2,color:String(n)===target?t.goldText:t.cream,
              fontFamily:FB,fontSize:14,fontWeight:700,cursor:"pointer"}}>{n}</button>)}</div></div>}
      <div><div style={{fontFamily:FB,fontSize:12,color:t.muted,marginBottom:4}}>Choice options <span style={{color:t.mutedDark}}>(optional — e.g. workout variations to pick from)</span></div>
        {ch.map((c,i)=><div key={i} style={{display:"flex",gap:6,marginBottom:6,alignItems:"flex-start",padding:"8px 10px",
          background:t.card2,borderRadius:8,border:`1px solid ${t.border}`}}>
          <span style={{fontFamily:FB,fontSize:11,fontWeight:700,color:t.goldText,marginTop:2}}>#{i+1}</span>
          <span style={{fontFamily:FB,fontSize:12,color:t.cream,flex:1,lineHeight:1.4}}>{c}</span>
          <button onClick={()=>setCh(ch.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:t.mutedDark,cursor:"pointer",fontSize:16,padding:"0 2px",flexShrink:0}}>×</button></div>)}
        {ch.length<3&&<div><TA value={newCh} onChange={setNewCh} placeholder={ch.length===0?"e.g. Full body (Pull ups, Pushups, Air Squats, Lunges, Planks) 3-4x this week":"Describe the next option..."} t={t} rows={2}/>
          <Btn v="secondary" sm t={t} onClick={addChoice} style={{marginTop:6}}>+ Add Option</Btn></div>}</div>
      <div><div style={{fontFamily:FB,fontSize:12,color:t.muted,marginBottom:4}}>Who does this?</div>
        <Tog opts={[{v:"both",l:"👥 Both"},{v:"scott",l:"⚔️ Scott"},{v:"filip",l:"🛡️ Filip"}]} value={asg} onChange={setAsg} t={t}/></div>
      <div><div style={{fontFamily:FB,fontSize:12,color:t.muted,marginBottom:4}}>Band App post required?</div>
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {[{v:"none",icon:"—",l:"None"},{v:"photo",icon:"📸",l:"Photo"},{v:"writing",icon:"⌨️",l:"Post"},{v:"photoAndWriting",icon:"📸⌨️",l:"Photo + Post"}].map(o=>
            <button key={o.v} onClick={()=>setPostReq(o.v)} style={{padding:"8px 12px",borderRadius:8,fontFamily:FB,fontSize:12,fontWeight:600,
              cursor:"pointer",border:`1.5px solid ${postReq===o.v?t.gold:t.borderMed}`,display:"flex",alignItems:"center",gap:4,
              background:postReq===o.v?t.goldDim:t.card2,color:postReq===o.v?t.goldText:t.cream}}>
              <span style={{fontSize:14}}>{o.icon}</span>{o.l}</button>)}</div></div>
      <div><div style={{fontFamily:FB,fontSize:12,color:t.muted,marginBottom:4}}>Applies to</div>
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {[{v:"this",l:"This week"},{v:"all",l:"All 10 weeks"},{v:"specific",l:"Pick weeks"},{v:"program",l:"Full program"}].map(o=>
            <button key={o.v} onClick={()=>setScope(o.v)} style={{padding:"6px 12px",borderRadius:8,fontFamily:FB,fontSize:12,fontWeight:600,
              cursor:"pointer",border:`1.5px solid ${scope===o.v?t.gold:t.borderMed}`,
              background:scope===o.v?t.goldDim:t.card2,color:scope===o.v?t.goldText:t.cream}}>{o.l}</button>)}</div>
        {scope==="specific"&&<div style={{display:"flex",gap:4,marginTop:8,flexWrap:"wrap"}}>
          {Array.from({length:10}).map((_,i)=>{const w=i+1;return <button key={w} onClick={()=>togWkSel(w)}
            style={{width:36,height:36,borderRadius:8,border:`1.5px solid ${selWks[w]?t.gold:t.borderMed}`,
              background:selWks[w]?t.goldDim:t.card2,color:selWks[w]?t.goldText:t.cream,
              fontFamily:FB,fontSize:13,fontWeight:700,cursor:"pointer"}}>W{w}</button>})}</div>}</div>
      {scope!=="program"&&<label style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:10,
        background:rec?t.goldDim:t.card2,border:`1px solid ${rec?t.gold:t.borderMed}`,cursor:"pointer"}}>
        <input type="checkbox" checked={rec} onChange={e=>setRec(e.target.checked)} style={{accentColor:t.gold}}/>
        <div><div style={{fontFamily:FB,fontSize:13,fontWeight:600,color:rec?t.goldText:t.cream}}>🔁 Repeat weekly</div>
          <div style={{fontFamily:FB,fontSize:10,color:t.muted}}>Auto-add to every week after the selected ones</div></div></label>}
      <Btn t={t} onClick={add} disabled={!nm.trim()} style={{width:"100%",marginTop:4}}>Add Task</Btn>
    </div>}
  </BSheet>
}

function EditTaskSheet({open,task,onClose,t,mutate,wk}: any) {
  const [nm,setNm]=useState("");const [sub,setSub]=useState("");const [notes,setNotes]=useState("")
  const [tp,setTp]=useState("onetime");const [target,setTarget]=useState("3");const [asg,setAsg]=useState("both")
  const [ch,setCh]=useState<string[]>([]);const [newCh,setNewCh]=useState("");const [confirm,setConfirm]=useState(false)
  const [postReq,setPostReq]=useState<string>("none")
  useEffect(()=>{if(task){setNm(task.name||"");setSub(task.subtitle||"");setNotes(task.notes||"");
    setTp(task.type||"onetime");setTarget(String(task.target||3));setAsg(task.assignee||"both");
    setCh(task.choices||[]);setConfirm(false);setPostReq(task.postReq||"none")}},[task])
  const addChoice=()=>{if(newCh.trim()&&ch.length<3){setCh([...ch,newCh.trim()]);setNewCh("")}}
  const doSave=()=>{if(!task)return;const changes: string[]=[]
    if(nm!==task.name)changes.push(`name: "${task.name}" → "${nm}"`)
    if(tp!==task.type)changes.push(`type: ${task.type} → ${tp}`)
    if(asg!==task.assignee)changes.push(`assigned: ${task.assignee} → ${asg}`)
    mutate((nd: any)=>{
      const update: any={name:nm,subtitle:sub,notes,type:tp,assignee:asg,postReq,target:tp==="xtimes"?parseInt(target)||3:null,choices:ch}
      if(tp!==task.type) update.comp=tp==="xtimes"?{scott:0,filip:0}:tp==="daily"?{}:{scott:false,filip:false}
      const w=gw(nd,wk);const idx=w.tasks.findIndex((x: any)=>x.id===task.id)
      if(idx>=0) w.tasks[idx]={...w.tasks[idx],...update}
      const pi=(nd.progTasks||[]).findIndex((x: any)=>x.id===task.id)
      if(pi>=0) nd.progTasks[pi]={...nd.progTasks[pi],...update}
      addLog(nd,{type:"edit",detail:changes.length>0?`Edited "${task.name}": ${changes.join(", ")}`:`Edited "${task.name}"`,date:tds()});return nd
    });onClose()}
  const doDuplicate=()=>{if(!task)return;mutate((nd: any)=>{
    const w=gw(nd,wk);const newT={...task,id:`t_${Date.now()}_dup`,name:task.name+" (copy)",
      comp:task.type==="xtimes"?{scott:0,filip:0}:task.type==="daily"?{}:{scott:false,filip:false}}
    w.tasks=[...w.tasks,newT];addLog(nd,{type:"addTask",detail:`Duplicated "${task.name}"`,date:tds()});return nd
  });onClose()}
  const doDelete=()=>{if(!confirm){setConfirm(true);return}mutate((nd: any)=>{
    const w=gw(nd,wk);w.tasks=w.tasks.filter((x: any)=>x.id!==task.id)
    nd.progTasks=(nd.progTasks||[]).filter((x: any)=>x.id!==task.id)
    addLog(nd,{type:"edit",detail:`Deleted "${task.name}"`,date:tds()});return nd
  });onClose()}
  if(!task)return null
  return <BSheet open={open} onClose={onClose} title="Edit Task" t={t}>
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <Inp value={nm} onChange={setNm} placeholder="Name" t={t}/>
      <Inp value={sub} onChange={setSub} placeholder="Description" t={t}/>
      <TA value={notes} onChange={setNotes} placeholder="Notes..." t={t} rows={2}/>
      <div><div style={{fontFamily:FB,fontSize:12,color:t.muted,marginBottom:4}}>Type</div>
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {[{v:"onetime",l:"☑️ One-time"},{v:"xtimes",l:"🔢 X times"},{v:"daily",l:"📅 Daily"}].map(o=>
            <button key={o.v} onClick={()=>setTp(o.v)} style={{padding:"6px 12px",borderRadius:8,fontFamily:FB,fontSize:12,
              cursor:"pointer",border:`1.5px solid ${tp===o.v?t.gold:t.borderMed}`,
              background:tp===o.v?t.goldDim:t.card2,color:tp===o.v?t.goldText:t.cream}}>{o.l}</button>)}</div>
        {tp!==task.type&&<div style={{fontFamily:FB,fontSize:10,color:t.red,marginTop:4}}>⚠ Changing type will reset progress</div>}</div>
      {tp==="xtimes"&&<div><div style={{fontFamily:FB,fontSize:12,color:t.muted,marginBottom:4}}>Target</div>
        <div style={{display:"flex",gap:4}}>
          {[1,2,3,4,5,6,7].map(n=><button key={n} onClick={()=>setTarget(String(n))}
            style={{width:32,height:32,borderRadius:6,border:`1.5px solid ${String(n)===target?t.gold:t.borderMed}`,
              background:String(n)===target?t.goldDim:t.card2,color:String(n)===target?t.goldText:t.cream,
              fontFamily:FB,fontSize:13,fontWeight:700,cursor:"pointer"}}>{n}</button>)}</div></div>}
      <div><div style={{fontFamily:FB,fontSize:12,color:t.muted,marginBottom:4}}>Assigned to</div>
        <Tog opts={[{v:"both",l:"👥 Both"},{v:"scott",l:"⚔️ Scott"},{v:"filip",l:"🛡️ Filip"}]} value={asg} onChange={setAsg} t={t}/></div>
      <div><div style={{fontFamily:FB,fontSize:12,color:t.muted,marginBottom:4}}>Band App post required?</div>
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {[{v:"none",icon:"—",l:"None"},{v:"photo",icon:"📸",l:"Photo"},{v:"writing",icon:"⌨️",l:"Post"},{v:"photoAndWriting",icon:"📸⌨️",l:"Photo + Post"}].map(o=>
            <button key={o.v} onClick={()=>setPostReq(o.v)} style={{padding:"6px 12px",borderRadius:8,fontFamily:FB,fontSize:12,fontWeight:600,
              cursor:"pointer",border:`1.5px solid ${postReq===o.v?t.gold:t.borderMed}`,display:"flex",alignItems:"center",gap:4,
              background:postReq===o.v?t.goldDim:t.card2,color:postReq===o.v?t.goldText:t.cream}}>
              <span style={{fontSize:13}}>{o.icon}</span>{o.l}</button>)}</div></div>
      <div><div style={{fontFamily:FB,fontSize:12,color:t.muted,marginBottom:4}}>Choices</div>
        {ch.map((c,i)=><div key={i} style={{display:"flex",gap:6,marginBottom:6,alignItems:"flex-start",padding:"8px 10px",
          background:t.card2,borderRadius:8,border:`1px solid ${t.border}`}}>
          <span style={{fontFamily:FB,fontSize:11,fontWeight:700,color:t.goldText,marginTop:2}}>#{i+1}</span>
          <span style={{fontFamily:FB,fontSize:12,color:t.cream,flex:1,lineHeight:1.4}}>{c}</span>
          <button onClick={()=>setCh(ch.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:t.mutedDark,cursor:"pointer",fontSize:16,flexShrink:0}}>×</button></div>)}
        {ch.length<3&&<div><TA value={newCh} onChange={setNewCh} placeholder="Describe this option..." t={t} rows={2}/>
          <Btn v="secondary" sm t={t} onClick={addChoice} style={{marginTop:6}}>+ Add Option</Btn></div>}</div>
      <Btn t={t} onClick={doSave} style={{width:"100%"}}>Save Changes</Btn>
      <Btn v="secondary" t={t} onClick={doDuplicate} style={{width:"100%"}}>📋 Duplicate Task</Btn>
      <Btn v="danger" t={t} onClick={doDelete} style={{width:"100%"}}>{confirm?"Tap again to confirm":"🗑 Delete Task"}</Btn>
    </div></BSheet>
}

function PlanSheet({open,onClose,t,mutate,wk,prevTasks,D}: any) {
  const nextWk=wk+1;const [copied,setCopied]=useState<Record<string,boolean>>({})
  const [verse,setVerse]=useState("");const [verseBody,setVerseBody]=useState("");const [whisper,setWhisper]=useState("")
  const [wkTarget,setWkTarget]=useState("3");const [miTarget,setMiTarget]=useState("6");const [miOut,setMiOut]=useState("4")
  const [wkOpts,setWkOpts]=useState("");const [setupCopied,setSetupCopied]=useState(false)
  if(nextWk>10)return null
  const nw=D?.weeks?.[nextWk]
  const hasVerse=!!nw?.verse?.text;const hasWhisper=!!nw?.whisper?.text;const hasSetup=nw?.wkTarget>0
  const taskCount=(nw?.tasks||[]).length

  const copyTask=(task: any)=>{mutate((nd: any)=>{const nw2=gw(nd,nextWk)
    const newT={...task,id:`t_${Date.now()}_c`,comp:task.type==="xtimes"?{scott:0,filip:0}:task.type==="daily"?{}:{scott:false,filip:false}}
    nw2.tasks=[...nw2.tasks,newT];return nd});setCopied({...copied,[task.id]:true})}
  const copyAllTasks=()=>{mutate((nd: any)=>{const nw2=gw(nd,nextWk)
    ;(prevTasks||[]).forEach((task: any)=>{if(!copied[task.id]){
      const newT={...task,id:`t_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
        comp:task.type==="xtimes"?{scott:0,filip:0}:task.type==="daily"?{}:{scott:false,filip:false}}
      nw2.tasks=[...nw2.tasks,newT]}});return nd})
    const allCopied: Record<string,boolean>={};(prevTasks||[]).forEach((t2: any)=>{allCopied[t2.id]=true});setCopied({...copied,...allCopied})}
  const copySetup=()=>{mutate((nd: any)=>{const pw=gw(nd,wk);const nw2=gw(nd,nextWk)
    nw2.wkOpts=[...pw.wkOpts];nw2.wkTarget=pw.wkTarget;nw2.miTarget=pw.miTarget;nw2.miOutMin=pw.miOutMin;return nd});setSetupCopied(true)}
  const saveVerse=()=>{if(!verse.trim())return;mutate((nd: any)=>{const nw2=gw(nd,nextWk);nw2.verse={...nw2.verse,text:verse.trim(),fullText:verseBody.trim()};return nd})}
  const saveWhisper=()=>{if(!whisper.trim())return;mutate((nd: any)=>{const nw2=gw(nd,nextWk);nw2.whisper={...nw2.whisper,text:whisper.trim()};return nd})}
  const saveTargets=()=>{mutate((nd: any)=>{const nw2=gw(nd,nextWk)
    nw2.wkTarget=parseInt(wkTarget)||3;nw2.miTarget=parseInt(miTarget)||6;nw2.miOutMin=parseInt(miOut)||4
    if(wkOpts.trim())nw2.wkOpts=wkOpts.split(",").map((s: string)=>s.trim()).filter(Boolean);return nd})}

  return <BSheet open={open} onClose={onClose} title={`Plan Week ${nextWk}`} t={t}>
    <div style={{fontFamily:FB,fontSize:13,color:t.muted,marginBottom:16}}>
      {fmt(d4d((nextWk-1)*7))} – {fmt(d4d(nextWk*7-1))}</div>

    {/* Status summary */}
    <Card t={t} style={{marginBottom:16,background:t.card2}}>
      <div style={{fontFamily:FB,fontSize:12,fontWeight:700,color:t.cream2,marginBottom:8}}>Week {nextWk} Status</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
        {[{l:"Verse",ok:hasVerse},{l:"Whisper",ok:hasWhisper},{l:"Fitness",ok:hasSetup||setupCopied},{l:`${taskCount} Tasks`,ok:taskCount>0}].map(s=>
          <span key={s.l} style={{fontFamily:FB,fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:6,
            background:s.ok?t.greenDim:t.card,border:`1px solid ${s.ok?t.greenBright:t.borderMed}`,
            color:s.ok?t.greenBright:t.muted}}>{s.ok?"✓ ":"○ "}{s.l}</span>)}</div></Card>

    {/* Memory Verse */}
    <div style={{fontFamily:FB,fontSize:12,fontWeight:700,color:t.cream2,marginBottom:6}}>📖 Memory Verse</div>
    {hasVerse?<div style={{fontFamily:FB,fontSize:13,color:t.green,marginBottom:12}}>✓ Set: {nw.verse.text}{nw.verse.fullText?"":" (add verse text in Verse tab)"}</div>
    :<div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:12}}>
      <Inp value={verse} onChange={setVerse} placeholder="Reference — e.g. Romans 8:28" t={t} style={{padding:"8px 10px",fontSize:12}}/>
      <TA value={verseBody} onChange={setVerseBody} placeholder="Full verse text for practice (optional — can add later)" t={t} rows={2}/>
      <Btn v="primary" sm t={t} onClick={saveVerse}>Set Verse</Btn></div>}

    {/* Whisper Reading */}
    <div style={{fontFamily:FB,fontSize:12,fontWeight:700,color:t.cream2,marginBottom:6}}>📕 Whisper Reading</div>
    {hasWhisper?<div style={{fontFamily:FB,fontSize:13,color:t.green,marginBottom:12}}>✓ Set: {nw.whisper.text}</div>
    :<div style={{display:"flex",gap:6,marginBottom:12}}>
      <Inp value={whisper} onChange={setWhisper} placeholder="e.g. Chapter 2" t={t} style={{flex:1,padding:"8px 10px",fontSize:12}}/>
      <Btn v="primary" sm t={t} onClick={saveWhisper}>Set</Btn></div>}

    {/* Fitness Targets */}
    <div style={{fontFamily:FB,fontSize:12,fontWeight:700,color:t.cream2,marginBottom:6}}>💪 Fitness Setup</div>
    {setupCopied||hasSetup?<div style={{fontFamily:FB,fontSize:13,color:t.green,marginBottom:4}}>
      ✓ Workouts: {nw?.wkTarget||3}x/wk · Mileage: {nw?.miTarget||6} total / {nw?.miOutMin||4} outdoor</div>
    :<Card t={t} style={{marginBottom:4}}>
      <div style={{display:"flex",gap:8,marginBottom:8}}>
        <div style={{flex:1}}><div style={{fontFamily:FB,fontSize:11,color:t.muted,marginBottom:3}}>Workouts/wk</div>
          <Inp value={wkTarget} onChange={setWkTarget} placeholder="3" t={t} type="number" style={{padding:"6px 8px",fontSize:12}}/></div>
        <div style={{flex:1}}><div style={{fontFamily:FB,fontSize:11,color:t.muted,marginBottom:3}}>Total miles</div>
          <Inp value={miTarget} onChange={setMiTarget} placeholder="6" t={t} type="number" style={{padding:"6px 8px",fontSize:12}}/></div>
        <div style={{flex:1}}><div style={{fontFamily:FB,fontSize:11,color:t.muted,marginBottom:3}}>Outdoor mi</div>
          <Inp value={miOut} onChange={setMiOut} placeholder="4" t={t} type="number" style={{padding:"6px 8px",fontSize:12}}/></div></div>
      <div style={{fontFamily:FB,fontSize:11,color:t.muted,marginBottom:3}}>Workout options (comma-separated)</div>
      <Inp value={wkOpts} onChange={setWkOpts} placeholder="e.g. Full body, HIIT, Pushup circuit" t={t} style={{padding:"6px 8px",fontSize:12,marginBottom:8}}/>
      <div style={{display:"flex",gap:8}}>
        <Btn v="primary" sm t={t} onClick={saveTargets}>Set Targets</Btn>
        <Btn v="secondary" sm t={t} onClick={copySetup}>Copy from Week {wk}</Btn></div></Card>}
    <div style={{height:1,background:t.border,margin:"12px 0"}}/>

    {/* Copy Tasks */}
    {(prevTasks||[]).length>0&&<>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <div style={{fontFamily:FB,fontSize:12,fontWeight:700,color:t.cream2}}>📋 Tasks from Week {wk}</div>
        {Object.keys(copied).length<prevTasks.length&&
          <Btn v="ghost" sm t={t} onClick={copyAllTasks}>Copy All</Btn>}</div>
      {prevTasks.map((task: any)=><div key={task.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:`1px solid ${t.border}`}}>
        <span style={{flex:1,fontFamily:FB,fontSize:13,color:t.cream}}>{task.name}</span>
        <span style={{fontFamily:FB,fontSize:10,color:t.mutedDark,padding:"2px 6px",background:t.card2,borderRadius:4}}>{task.type}</span>
        {copied[task.id]?<span style={{fontFamily:FB,fontSize:11,color:t.green,fontWeight:600}}>✓ Added</span>
        :<Btn v="ghost" sm t={t} onClick={()=>copyTask(task)}>+ Copy</Btn>}</div>)}</>}

    <div style={{fontFamily:FB,fontSize:11,color:t.mutedDark,marginTop:16,textAlign:"center"}}>
      You can also add new tasks from the Week {nextWk} tab after navigating there</div>
  </BSheet>
}

// ═══════════════════════════════════════════════════════════════
// TRACK TAB
// ═══════════════════════════════════════════════════════════════
function TrackTab({D,mutate,user,dayNum,setDayNum,wk,t,brave,onLion,onFreedom,onMidnight,crossTap,onStreak,onMilestone}: any) {
  const [wkSheet,setWkSheet]=useState(false);const [miSheet,setMiSheet]=useState(false);const [addSheet,setAddSheet]=useState(false)
  const [editT,setEditT]=useState<any>(null);const [setupF,setSetupF]=useState<string|null>(null);const [planSheet,setPlanSheet]=useState(false)
  const [showMiInfo,setShowMiInfo]=useState(false)
  const s=ds(d4d(dayNum));const w=gw(D,wk);const p=user==="scott"?"filip":"scott";const dc=gd(D,s)
  const maxDay=Math.min(dn(today()),69);const hl=hrsLeft(dayNum)
  const bibleChap=dayNum>=0&&dayNum<BIBLE.length?BIBLE[dayNum]:"Rest Day"

  const togDaily=(field: string)=>mutate((nd: any)=>{
    const dc2=gd(nd,s);const cur=dc2[field]?.[user]||false
    dc2[field]={...dc2[field],[user]:!cur}
    if(!cur){nd.total=(nd.total||0)+1;addLog(nd,{type:"complete",user,task:field,date:s})
      const now=new Date();if(now.getHours()>=23&&now.getMinutes()>=30) onMidnight?.()
      const myAll=dc2.bible?.[user]&&dc2.devotional?.[user]&&dc2.journal?.[user]
      const pAll=dc2.bible?.[p]&&dc2.devotional?.[p]&&dc2.journal?.[p]
      if(myAll&&pAll){brave?onFreedom?.():onLion?.()}
      if(myAll){let stk=1;for(let d=dayNum-1;d>=0;d--){const pds=ds(d4d(d));const pdc=nd.daily?.[pds];
        if(pdc?.bible?.[user]&&pdc?.devotional?.[user]&&pdc?.journal?.[user])stk++;else break}
        nd.streaks={...nd.streaks,[user]:stk};if([7,21,70].includes(stk))onStreak?.(stk)}
      if([100,250,500,1000].includes(nd.total))onMilestone?.(nd.total)
    }else{nd.total=Math.max(0,(nd.total||0)-1);removeLog(nd,user,field)};return nd})

  const togWkly=(field: string)=>mutate((nd: any)=>{
    const w2=gw(nd,wk);const cur=w2[field]?.[user]||false
    w2[field]={...w2[field],[user]:!cur}
    if(!cur){nd.total=(nd.total||0)+1;addLog(nd,{type:"complete",user,task:field,date:s})}
    else{nd.total=Math.max(0,(nd.total||0)-1);removeLog(nd,user,field)};return nd})

  const togTask=(id: string,who: string,dayIdx?: number)=>mutate((nd: any)=>{
    const w2=gw(nd,wk);const task=w2.tasks.find((x: any)=>x.id===id);if(!task)return nd
    if(!task.comp)task.comp={}
    if(task.type==="daily"&&dayIdx!==undefined){const k=`${who}_${dayIdx}`;const was=task.comp[k];task.comp[k]=!was
      if(!was){nd.total=(nd.total||0)+1;addLog(nd,{type:"complete",user:who,task:task.name,date:s})}
      else{nd.total=Math.max(0,(nd.total||0)-1);removeLog(nd,who,task.name)}}
    else{const was=task.comp[who];task.comp[who]=!was
      if(!was){nd.total=(nd.total||0)+1;addLog(nd,{type:"complete",user:who,task:task.name,date:s})}
      else{nd.total=Math.max(0,(nd.total||0)-1);removeLog(nd,who,task.name)}}
    if([100,250,500,1000].includes(nd.total))onMilestone?.(nd.total);return nd})

  const xtTask=(id: string,who: string,delta: number)=>{if(who!==user)return;mutate((nd: any)=>{
    const w2=gw(nd,wk);const task=w2.tasks.find((x: any)=>x.id===id);if(!task)return nd
    if(!task.comp)task.comp={scott:0,filip:0};task.comp[who]=Math.max(0,(task.comp[who]||0)+delta)
    if(delta>0){nd.total=(nd.total||0)+1;addLog(nd,{type:"complete",user:who,task:task.name,date:s})}
    else if(delta<0){nd.total=Math.max(0,(nd.total||0)-1);removeLog(nd,who,task.name)};return nd})}

  const togProg=(id: string,who: string)=>{if(who!==user)return;mutate((nd: any)=>{
    const task=(nd.progTasks||[]).find((x: any)=>x.id===id);if(!task)return nd
    if(!task.comp)task.comp={scott:false,filip:false}
    if(task.type==="xtimes"){task.comp[who]=Math.min((task.comp[who]||0)+1,task.target||99)
      nd.total=(nd.total||0)+1;addLog(nd,{type:"complete",user:who,task:task.name,date:s})}
    else{const was=task.comp[who];task.comp[who]=!was
      if(!was){nd.total=(nd.total||0)+1;addLog(nd,{type:"complete",user:who,task:task.name,date:s})}
      else{nd.total=Math.max(0,(nd.total||0)-1);removeLog(nd,who,task.name)}};return nd})}

  const sDailies=[dc.bible?.scott,dc.devotional?.scott,dc.journal?.scott].filter(Boolean).length
  const fDailies=[dc.bible?.filip,dc.devotional?.filip,dc.journal?.filip].filter(Boolean).length
  const calcWkPct=(u: string)=>{let done=0,tot=0
    if(w.verse?.text){tot++;if(w.verse?.[u])done++}if(w.whisper?.text){tot++;if(w.whisper?.[u])done++}
    if(w.wkTarget>0){tot++;if((w.workouts?.[u]||[]).length>=w.wkTarget)done++}
    if(w.miTarget>0){tot++;if((w.mileage?.[u]||[]).reduce((s: number,m: any)=>s+calcEquiv(m),0)>=w.miTarget)done++}
    ;(w.tasks||[]).forEach((tk: any)=>{if(tk.assignee&&tk.assignee!=="both"&&tk.assignee!==u)return;tot++
      const c=tk.comp?.[u];if(tk.type==="xtimes"){if((c||0)>=(tk.target||1))done++}else if(c)done++})
    return tot>0?Math.round((done/tot)*100):0}

  const sortedTasks=[...(w.tasks||[])].sort((a: any,b: any)=>{
    const aDone=a.type==="xtimes"?(a.comp?.[user]||0)>=(a.target||1):a.type==="daily"?false:!!a.comp?.[user]
    const bDone=b.type==="xtimes"?(b.comp?.[user]||0)>=(b.target||1):b.type==="daily"?false:!!b.comp?.[user]
    if(aDone!==bDone)return aDone?1:-1;return(a.order||0)-(b.order||0)})

  const isWed=d4d(dayNum).getDay()===3&&new Date().getHours()>=17

  return <div>
    <SmartBar D={D} user={user} dayNum={dayNum} wk={wk} t={t} brave={brave}/>
    {isWed&&wk<10&&<div onClick={()=>setPlanSheet(true)} style={{margin:"0 0 10px",padding:"12px 16px",background:`linear-gradient(135deg,${t.goldDim},${t.card2})`,
      borderRadius:12,border:`1.5px solid ${t.gold}44`,cursor:"pointer",animation:"goldPulse 3s ease infinite"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div><div style={{fontFamily:FB,fontSize:14,fontWeight:700,color:t.goldText}}>📋 Plan Week {wk+1}</div>
          <div style={{fontFamily:FB,fontSize:12,color:t.muted,marginTop:2}}>New week starts tomorrow — tap to set up</div></div>
        <span style={{fontSize:20,color:t.gold}}>›</span></div></div>}
    {/* Scoreboard */}
    <Card t={t} style={{marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        {["scott","filip"].map(who=>{
          const builtIn=["bible","devotional","journal"].map(f=>({k:f,done:!!dc[f]?.[who]}))
          const dailyTasks=(w.tasks||[]).filter((tk: any)=>tk.type==="daily"&&(!tk.assignee||tk.assignee==="both"||tk.assignee===who))
            .map((tk: any)=>{const dow=dayNum-((wk-1)*7);return{k:tk.id,done:!!tk.comp?.[`${who}_${dow}`]}})
          const all=[...builtIn,...dailyTasks]
          return <div key={who} style={{textAlign:"center",flex:1}}>
            <div style={{fontFamily:FB,fontSize:12,fontWeight:700,color:t[who],marginBottom:4}}>{who.toUpperCase()}</div>
            <div style={{display:"flex",gap:3,justifyContent:"center",flexWrap:"wrap"}}>
              {all.map(item=><div key={item.k} style={{width:18,height:18,borderRadius:5,display:"flex",alignItems:"center",justifyContent:"center",
                background:item.done?t.greenDim:t.card2,border:`1.5px solid ${item.done?t.greenBright:t.borderMed}`,transition:"all 0.3s"}}>
                <span style={{fontSize:10,color:item.done?t.greenBright:t.mutedDark}}>{item.done?"✓":""}</span></div>)}</div>
          </div>})}
        <div style={{textAlign:"center",padding:"0 8px",minWidth:50}}>
          <div style={{fontFamily:FD,fontSize:12,color:t.muted,marginBottom:2}}>DAILY</div>
          {D.streaks?.[user]>0&&<div style={{fontFamily:FB,fontSize:11,color:t.goldText}}>🔥 {D.streaks[user]}</div>}</div>
      </div>
      <div style={{display:"flex",gap:8}}>
        <div style={{flex:1}}><Prog v={calcWkPct("scott")} max={100} color={t.scott} h={4} label="Week" t={t}/></div>
        <div style={{flex:1}}><Prog v={calcWkPct("filip")} max={100} color={t.filip} h={4} label="Week" t={t}/></div>
      </div></Card>
    {/* Day Nav */}
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",margin:"10px 0"}}>
      <button onClick={()=>setDayNum(Math.max(0,dayNum-1))} disabled={dayNum<=0}
        style={{background:"none",border:"none",color:dayNum<=0?t.mutedDark:t.cream,fontSize:22,cursor:"pointer",padding:"12px 16px",minWidth:48,minHeight:48}}>◀</button>
      <div style={{textAlign:"center"}}>
        <div style={{fontFamily:FD,fontSize:18,color:t.cream}}>{fmt(d4d(dayNum))}</div>
        <div style={{display:"flex",gap:8,justifyContent:"center",alignItems:"center"}}>
          <span style={{fontFamily:FB,fontSize:11,color:t.muted}}>Day {dayNum+1} · Week {wk}</span>
          <UBadge hrs={hl} type="daily" t={t}/></div></div>
      <button onClick={()=>setDayNum(Math.min(maxDay,dayNum+1))} disabled={dayNum>=maxDay}
        style={{background:"none",border:"none",color:dayNum>=maxDay?t.mutedDark:t.cream,fontSize:22,cursor:"pointer",padding:"12px 16px",minWidth:48,minHeight:48}}>▶</button></div>
    {/* Battle Line */}
    <div style={{display:"flex",gap:2,marginBottom:14}}>{Array.from({length:10}).map((_,i)=>{const active=i<wk;const cur=i===wk-1
      return <div key={i} style={{flex:1,height:4,borderRadius:2,transition:"all 0.3s",
        background:active?(cur?t.gold:`${t.gold}88`):t.border,boxShadow:cur?`0 0 8px ${t.gold}`:"none"}}/>})}</div>
    <XDiv t={t} idx={0} onTap={crossTap}/>
    {/* Daily Essentials */}
    <SH icon="📖" t={t} right={<UBadge hrs={hl} type="daily" t={t}/>}>Daily Essentials</SH>
    {[{k:"bible",l:`Bible: ${bibleChap}`,sub:"Read today's chapter"},
      {k:"devotional",l:"Walking with God",sub:"Daily devotional"},
      {k:"journal",l:"Journal",sub:"Write in your notebook"}].map(item=>{
      const bothDone=dc[item.k]?.scott&&dc[item.k]?.filip
      return <SwipeRow key={item.k} done={!!dc[item.k]?.[user]} t={t} onComplete={()=>togDaily(item.k)}>
        <Card t={t} glow={bothDone?t.greenGlow:null} urgent={hl<=2&&!dc[item.k]?.[user]}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <StatIcon done={!!dc[item.k]?.scott} sz={30} tap={user==="scott"} t={t} onTap={()=>user==="scott"&&togDaily(item.k)}/>
            <div style={{textAlign:"center",flex:1,padding:"0 8px"}}>
              <div style={{fontFamily:FB,fontSize:16,fontWeight:600,color:t.cream,textDecoration:bothDone?"line-through":"none",opacity:bothDone?.6:1}}>{item.l}</div>
              <div style={{fontFamily:FB,fontSize:13,color:t.muted}}>{item.sub}</div></div>
            <StatIcon done={!!dc[item.k]?.filip} sz={30} tap={user==="filip"} t={t} onTap={()=>user==="filip"&&togDaily(item.k)}/>
          </div></Card></SwipeRow>})}
    <XDiv t={t} idx={1} onTap={crossTap}/>
    {/* Verse */}
    <SH icon="📜" t={t} right={<Btn v="ghost" sm t={t} onClick={()=>setSetupF("verse")}>{w.verse?.text?"Edit":"+ Set"}</Btn>}>Memory Verse</SH>
    {w.verse?.text?<Card t={t}><div style={{fontFamily:FD,fontSize:15,fontStyle:"italic",color:t.cream2,marginBottom:8,lineHeight:1.5}}>&quot;{w.verse.text}&quot;</div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <StatIcon done={!!w.verse?.scott} sz={28} tap={user==="scott"} t={t} onTap={()=>user==="scott"&&togWkly("verse")}/>
        <span style={{fontFamily:FB,fontSize:13,color:t.muted}}>Memorized?</span>
        <StatIcon done={!!w.verse?.filip} sz={28} tap={user==="filip"} t={t} onTap={()=>user==="filip"&&togWkly("verse")}/>
      </div></Card>
    :<div style={{fontFamily:FB,fontSize:14,color:t.mutedDark,padding:"8px 0"}}>No verse set this week</div>}
    {/* Whisper */}
    <SH icon="📚" t={t} right={<Btn v="ghost" sm t={t} onClick={()=>setSetupF("whisper")}>{w.whisper?.text?"Edit":"+ Set"}</Btn>}>Whisper Reading</SH>
    {w.whisper?.text?<Card t={t}><div style={{fontFamily:FB,fontSize:15,color:t.cream2,marginBottom:8}}>{w.whisper.text}</div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <StatIcon done={!!w.whisper?.scott} sz={28} tap={user==="scott"} t={t} onTap={()=>user==="scott"&&togWkly("whisper")}/>
        <span style={{fontFamily:FB,fontSize:13,color:t.muted}}>Complete?</span>
        <StatIcon done={!!w.whisper?.filip} sz={28} tap={user==="filip"} t={t} onTap={()=>user==="filip"&&togWkly("whisper")}/>
      </div></Card>
    :<div style={{fontFamily:FB,fontSize:14,color:t.mutedDark,padding:"8px 0"}}>No reading assigned</div>}
    <XDiv t={t} idx={2} onTap={crossTap}/>
    {/* Workouts */}
    <SH icon="💪" t={t} right={<Btn v="ghost" sm t={t} onClick={()=>setSetupF("workout")}>⚙ Setup</Btn>}>Workouts</SH>
    <Card t={t}><div style={{display:"flex",gap:12,marginBottom:8}}>
      <div style={{flex:1}}><Prog v={(w.workouts?.scott||[]).length} max={w.wkTarget} color={t.scott} h={5} label="Scott" t={t}/></div>
      <div style={{flex:1}}><Prog v={(w.workouts?.filip||[]).length} max={w.wkTarget} color={t.filip} h={5} label="Filip" t={t}/></div>
    </div>{w.wkOpts?.length>0&&<div style={{marginBottom:8,display:"flex",flexWrap:"wrap",gap:4}}>
      {w.wkOpts.map((o: string,i: number)=><span key={i} style={{fontFamily:FB,fontSize:12,color:t.muted,padding:"3px 10px",borderRadius:6,background:t.card2}}>{o}</span>)}</div>}
    <button onClick={()=>setWkSheet(true)} style={{width:"100%",padding:"10px",borderRadius:10,border:`1.5px solid ${t.gold}`,
      background:t.goldDim,color:t.goldText,fontFamily:FB,fontSize:14,fontWeight:700,cursor:"pointer"}}>💪 Log Workout</button></Card>
    {/* Mileage */}
    <SH icon="🏃" t={t} right={<div style={{display:"flex",gap:4,alignItems:"center"}}>
      <button onClick={()=>setShowMiInfo(!showMiInfo)} style={{background:"none",border:"none",color:t.muted,fontSize:14,cursor:"pointer",padding:"4px"}}>ⓘ</button>
      <Btn v="ghost" sm t={t} onClick={()=>setSetupF("mileage")}>⚙ Setup</Btn></div>}>Mileage</SH>
    {showMiInfo&&<div style={{padding:"8px 12px",background:t.card2,borderRadius:8,marginBottom:8,border:`1px solid ${t.border}`}}>
      <div style={{fontFamily:FB,fontSize:12,fontWeight:700,color:t.cream,marginBottom:4}}>Equivalent Mile Conversions:</div>
      <div style={{fontFamily:FB,fontSize:12,color:t.cream2,lineHeight:1.6}}>
        🏃 Running / Walking = 1:1<br/>🚴 Biking ÷ 3 (3 bike mi = 1 equiv)<br/>🏋️ Elliptical ÷ 2 (2 ellip mi = 1 equiv)<br/>🏊 Swimming × 3 (1 swim mi = 3 equiv)</div></div>}
    <Card t={t}><div style={{display:"flex",gap:12,marginBottom:6}}>
      <div style={{flex:1}}><Prog v={parseFloat(((w.mileage?.scott||[]).reduce((s: number,m: any)=>s+calcEquiv(m),0)).toFixed(1))} max={w.miTarget} color={t.scott} h={5} label="Scott (equiv)" t={t}/></div>
      <div style={{flex:1}}><Prog v={parseFloat(((w.mileage?.filip||[]).reduce((s: number,m: any)=>s+calcEquiv(m),0)).toFixed(1))} max={w.miTarget} color={t.filip} h={5} label="Filip (equiv)" t={t}/></div>
    </div><div style={{display:"flex",gap:12,marginBottom:8}}>
      <div style={{flex:1}}><Prog v={parseFloat(((w.mileage?.scott||[]).filter((m: any)=>m.outdoor).reduce((s: number,m: any)=>s+calcEquiv(m),0)).toFixed(1))} max={w.miOutMin} color={`${t.scott}88`} h={3} label="Outdoor" t={t}/></div>
      <div style={{flex:1}}><Prog v={parseFloat(((w.mileage?.filip||[]).filter((m: any)=>m.outdoor).reduce((s: number,m: any)=>s+calcEquiv(m),0)).toFixed(1))} max={w.miOutMin} color={`${t.filip}88`} h={3} label="Outdoor" t={t}/></div>
    </div>
    <button onClick={()=>setMiSheet(true)} style={{width:"100%",padding:"10px",borderRadius:10,border:`1.5px solid ${t.gold}`,
      background:t.goldDim,color:t.goldText,fontFamily:FB,fontSize:14,fontWeight:700,cursor:"pointer"}}>🏃 Log Mileage</button></Card>
    <XDiv t={t} idx={3} onTap={crossTap}/>
    {/* Weekly Tasks */}
    {sortedTasks.length>0&&<><SH icon="📋" t={t}>Weekly Tasks</SH>
      {sortedTasks.map((task: any)=><TaskRow key={task.id} task={task} user={user} t={t} dayNum={dayNum} wk={wk}
        onToggle={togTask} onEdit={setEditT} onXtimes={xtTask}/>)}</>}
    {/* Program Tasks */}
    {(D.progTasks||[]).length>0&&<><SH icon="🏆" t={t}>Full Program Tasks</SH>
      {(D.progTasks||[]).map((task: any)=>{const isDone=task.type==="xtimes"?(task.comp?.[user]||0)>=(task.target||1):!!task.comp?.[user]
        return <Card key={task.id} t={t} style={{opacity:isDone?.6:1,borderColor:isDone?`${t.green}44`:undefined}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            {task.type==="xtimes"?<span style={{fontFamily:FB,fontSize:13,fontWeight:700,color:t.scott}}>{task.comp?.scott||0}/{task.target}</span>
            :<StatIcon done={!!task.comp?.scott} sz={24} tap={user==="scott"} t={t} onTap={()=>togProg(task.id,"scott")}/>}
            <div style={{textAlign:"center",flex:1,padding:"0 8px"}} onClick={()=>setEditT(task)}>
              <div style={{fontFamily:FB,fontSize:15,fontWeight:600,color:t.cream}}>{task.name}</div>
              {task.subtitle&&<div style={{fontFamily:FB,fontSize:13,color:t.muted}}>{task.subtitle}</div>}</div>
            {task.type==="xtimes"?<span style={{fontFamily:FB,fontSize:13,fontWeight:700,color:t.filip}}>{task.comp?.filip||0}/{task.target}</span>
            :<StatIcon done={!!task.comp?.filip} sz={24} tap={user==="filip"} t={t} onTap={()=>togProg(task.id,"filip")}/>}
          </div></Card>})}</>}
    {sortedTasks.length===0&&(D.progTasks||[]).length===0&&!w.verse?.text&&!w.whisper?.text&&
      <Card t={t} style={{textAlign:"center",padding:24}}>
        <div style={{fontFamily:FB,fontSize:14,color:t.mutedDark,marginBottom:8}}>No tasks yet — set up this week</div>
        <Btn t={t} onClick={()=>setAddSheet(true)}>Set Up Week</Btn></Card>}
    <div style={{marginTop:16,display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
      <Btn t={t} onClick={()=>setAddSheet(true)}>+ Add Activity</Btn>
      {wk<10&&<Btn v="secondary" t={t} onClick={()=>setPlanSheet(true)}>Plan Week {wk+1}</Btn>}</div>
    <WorkoutSheet open={wkSheet} onClose={()=>setWkSheet(false)} t={t} mutate={mutate} user={user} wk={wk} wkOpts={w.wkOpts}/>
    <MileageSheet open={miSheet} onClose={()=>setMiSheet(false)} t={t} mutate={mutate} user={user} wk={wk}/>
    <AddTaskSheet open={addSheet} onClose={()=>setAddSheet(false)} t={t} mutate={mutate} wk={wk}/>
    <EditTaskSheet open={!!editT} task={editT} onClose={()=>setEditT(null)} t={t} mutate={mutate} wk={wk}/>
    <SetupSheet open={!!setupF} field={setupF} onClose={()=>setSetupF(null)} t={t} mutate={mutate} wk={wk} wkData={w}/>
    <PlanSheet open={planSheet} onClose={()=>setPlanSheet(false)} t={t} mutate={mutate} wk={wk} prevTasks={w.tasks} D={D}/>
  </div>
}

// ═══════════════════════════════════════════════════════════════
// THIS WEEK TAB
// ═══════════════════════════════════════════════════════════════
function WeekTab({D,mutate,user,wk,setWk,t,crossTap}: any) {
  const [wkSheet,setWkSheet]=useState(false);const [miSheet,setMiSheet]=useState(false)
  const [addSheet,setAddSheet]=useState(false);const [editT,setEditT]=useState<any>(null)
  const [setupF,setSetupF]=useState<string|null>(null);const [planSheet,setPlanSheet]=useState(false)
  const [showMiInfo,setShowMiInfo]=useState(false)
  const w=gw(D,wk);const dates=wkDates(wk)
  const hrsToEnd=Math.max(0,(new Date(d4d(wk*7-1)).setHours(23,59,59)-Date.now())/3600000)
  const maxWk=Math.min(Math.floor(dn(today())/7)+1,10)

  const calcWkPct=(u: string)=>{let done=0,tot=0
    if(w.verse?.text){tot++;if(w.verse?.[u])done++}if(w.whisper?.text){tot++;if(w.whisper?.[u])done++}
    if(w.wkTarget>0){tot++;if((w.workouts?.[u]||[]).length>=w.wkTarget)done++}
    if(w.miTarget>0){tot++;if((w.mileage?.[u]||[]).reduce((s: number,m: any)=>s+calcEquiv(m),0)>=w.miTarget)done++}
    ;(w.tasks||[]).forEach((tk: any)=>{if(tk.assignee&&tk.assignee!=="both"&&tk.assignee!==u)return;tot++
      const c=tk.comp?.[u];if(tk.type==="xtimes"){if((c||0)>=(tk.target||1))done++}else if(c)done++})
    return tot>0?Math.round((done/tot)*100):0}

  const togWkly=(field: string)=>mutate((nd: any)=>{const w2=gw(nd,wk);const was=w2[field]?.[user];w2[field]={...w2[field],[user]:!was}
    if(!was){nd.total=(nd.total||0)+1;addLog(nd,{type:"complete",user,task:field,date:tds()})}
    else{nd.total=Math.max(0,(nd.total||0)-1);removeLog(nd,user,field)};return nd})
  const togTask=(id: string,who: string,dayIdx?: number)=>{if(who!==user)return;mutate((nd: any)=>{
    const w2=gw(nd,wk);const task=w2.tasks.find((x: any)=>x.id===id);if(!task)return nd
    if(!task.comp)task.comp={};if(task.type==="daily"&&dayIdx!==undefined){const k=`${who}_${dayIdx}`;const was=task.comp[k];task.comp[k]=!was
      if(!was){nd.total=(nd.total||0)+1;addLog(nd,{type:"complete",user:who,task:task.name,date:tds()})}
      else{nd.total=Math.max(0,(nd.total||0)-1);removeLog(nd,who,task.name)}}
    else{const was=task.comp[who];task.comp[who]=!was
      if(!was){nd.total=(nd.total||0)+1;addLog(nd,{type:"complete",user:who,task:task.name,date:tds()})}
      else{nd.total=Math.max(0,(nd.total||0)-1);removeLog(nd,who,task.name)}};return nd})}
  const xtTask=(id: string,who: string,delta: number)=>{if(who!==user)return;mutate((nd: any)=>{
    const w2=gw(nd,wk);const task=w2.tasks.find((x: any)=>x.id===id);if(!task)return nd
    if(!task.comp)task.comp={scott:0,filip:0};task.comp[who]=Math.max(0,(task.comp[who]||0)+delta)
    if(delta>0){nd.total=(nd.total||0)+1;addLog(nd,{type:"complete",user:who,task:task.name,date:tds()})}
    else if(delta<0){nd.total=Math.max(0,(nd.total||0)-1);removeLog(nd,who,task.name)};return nd})}
  const sortedTasks=[...(w.tasks||[])].sort((a: any,b: any)=>{
    const aDone=a.type==="xtimes"?(a.comp?.[user]||0)>=(a.target||1):!!a.comp?.[user]
    const bDone=b.type==="xtimes"?(b.comp?.[user]||0)>=(b.target||1):!!b.comp?.[user];return (aDone?1:0)-(bDone?1:0)})

  return <div>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",margin:"10px 0"}}>
      <button onClick={()=>setWk(Math.max(1,wk-1))} disabled={wk<=1} style={{background:"none",border:"none",color:wk<=1?t.mutedDark:t.cream,fontSize:22,cursor:"pointer",padding:"12px 16px",minWidth:48,minHeight:48}}>◀</button>
      <div style={{textAlign:"center"}}><div style={{fontFamily:FD,fontSize:18,color:t.cream}}>Week {wk}</div>
        <div style={{display:"flex",gap:8,justifyContent:"center",alignItems:"center"}}>
          <span style={{fontFamily:FB,fontSize:11,color:t.muted}}>{fmt(dates[0])} – {fmt(dates[6])}</span>
          <UBadge hrs={hrsToEnd} type="weekly" t={t}/></div></div>
      <button onClick={()=>setWk(Math.min(10,wk+1))} disabled={wk>=10} style={{background:"none",border:"none",color:wk>=10?t.mutedDark:t.cream,fontSize:22,cursor:"pointer",padding:"12px 16px",minWidth:48,minHeight:48}}>▶</button></div>
    <Card t={t} style={{marginBottom:12}}><div style={{display:"flex",gap:8}}>
      <div style={{flex:1}}><Prog v={calcWkPct("scott")} max={100} color={t.scott} h={5} label="Scott" t={t}/></div>
      <div style={{flex:1}}><Prog v={calcWkPct("filip")} max={100} color={t.filip} h={5} label="Filip" t={t}/></div></div></Card>
    <XDiv t={t} idx={8} onTap={crossTap}/>
    <SH icon="📜" t={t} right={<Btn v="ghost" sm t={t} onClick={()=>setSetupF("verse")}>{w.verse?.text?"Edit":"+ Set"}</Btn>}>Memory Verse</SH>
    {w.verse?.text?<Card t={t}><div style={{fontFamily:FD,fontSize:15,fontStyle:"italic",color:t.cream2,marginBottom:8,lineHeight:1.5}}>&quot;{w.verse.text}&quot;</div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <StatIcon done={!!w.verse?.scott} sz={28} tap={user==="scott"} t={t} onTap={()=>user==="scott"&&togWkly("verse")}/>
        <span style={{fontFamily:FB,fontSize:13,color:t.muted}}>Memorized?</span>
        <StatIcon done={!!w.verse?.filip} sz={28} tap={user==="filip"} t={t} onTap={()=>user==="filip"&&togWkly("verse")}/>
      </div></Card>:<div style={{fontFamily:FB,fontSize:14,color:t.mutedDark,padding:"8px 0"}}>No verse set</div>}
    <SH icon="📚" t={t} right={<Btn v="ghost" sm t={t} onClick={()=>setSetupF("whisper")}>{w.whisper?.text?"Edit":"+ Set"}</Btn>}>Whisper Reading</SH>
    {w.whisper?.text?<Card t={t}><div style={{fontFamily:FB,fontSize:15,color:t.cream2,marginBottom:8}}>{w.whisper.text}</div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <StatIcon done={!!w.whisper?.scott} sz={28} tap={user==="scott"} t={t} onTap={()=>user==="scott"&&togWkly("whisper")}/>
        <span style={{fontFamily:FB,fontSize:13,color:t.muted}}>Complete?</span>
        <StatIcon done={!!w.whisper?.filip} sz={28} tap={user==="filip"} t={t} onTap={()=>user==="filip"&&togWkly("whisper")}/>
      </div></Card>:<div style={{fontFamily:FB,fontSize:14,color:t.mutedDark,padding:"8px 0"}}>No reading assigned</div>}
    <XDiv t={t} idx={9} onTap={crossTap}/>
    <SH icon="💪" t={t} right={<Btn v="ghost" sm t={t} onClick={()=>setSetupF("workout")}>⚙ Setup</Btn>}>Workouts</SH>
    <Card t={t}><div style={{display:"flex",gap:12,marginBottom:8}}>
      <div style={{flex:1}}><Prog v={(w.workouts?.scott||[]).length} max={w.wkTarget} color={t.scott} h={5} label="Scott" t={t}/></div>
      <div style={{flex:1}}><Prog v={(w.workouts?.filip||[]).length} max={w.wkTarget} color={t.filip} h={5} label="Filip" t={t}/></div></div>
    <button onClick={()=>setWkSheet(true)} style={{width:"100%",padding:"10px",borderRadius:10,border:`1.5px solid ${t.gold}`,
      background:t.goldDim,color:t.goldText,fontFamily:FB,fontSize:14,fontWeight:700,cursor:"pointer"}}>💪 Log Workout</button></Card>
    <SH icon="🏃" t={t} right={<div style={{display:"flex",gap:4,alignItems:"center"}}>
      <button onClick={()=>setShowMiInfo(!showMiInfo)} style={{background:"none",border:"none",color:t.muted,fontSize:14,cursor:"pointer",padding:"4px"}}>ⓘ</button>
      <Btn v="ghost" sm t={t} onClick={()=>setSetupF("mileage")}>⚙ Setup</Btn></div>}>Mileage</SH>
    {showMiInfo&&<div style={{padding:"8px 12px",background:t.card2,borderRadius:8,marginBottom:8,border:`1px solid ${t.border}`}}>
      <div style={{fontFamily:FB,fontSize:12,fontWeight:700,color:t.cream,marginBottom:4}}>Equivalent Mile Conversions:</div>
      <div style={{fontFamily:FB,fontSize:12,color:t.cream2,lineHeight:1.6}}>
        🏃 Running / Walking = 1:1<br/>🚴 Biking ÷ 3 (3 bike mi = 1 equiv)<br/>🏋️ Elliptical ÷ 2 (2 ellip mi = 1 equiv)<br/>🏊 Swimming × 3 (1 swim mi = 3 equiv)</div></div>}
    <Card t={t}><div style={{display:"flex",gap:12,marginBottom:8}}>
      <div style={{flex:1}}><Prog v={parseFloat(((w.mileage?.scott||[]).reduce((s: number,m: any)=>s+calcEquiv(m),0)).toFixed(1))} max={w.miTarget} color={t.scott} h={5} label="Scott" t={t}/></div>
      <div style={{flex:1}}><Prog v={parseFloat(((w.mileage?.filip||[]).reduce((s: number,m: any)=>s+calcEquiv(m),0)).toFixed(1))} max={w.miTarget} color={t.filip} h={5} label="Filip" t={t}/></div></div>
    <button onClick={()=>setMiSheet(true)} style={{width:"100%",padding:"10px",borderRadius:10,border:`1.5px solid ${t.gold}`,
      background:t.goldDim,color:t.goldText,fontFamily:FB,fontSize:14,fontWeight:700,cursor:"pointer"}}>🏃 Log Mileage</button></Card>
    <XDiv t={t} idx={10} onTap={crossTap}/>
    {sortedTasks.length>0&&<><SH icon="📋" t={t}>Weekly Tasks</SH>
      {sortedTasks.map((task: any)=><TaskRow key={task.id} task={task} user={user} t={t} dayNum={dn(today())} wk={wk}
        onToggle={togTask} onEdit={setEditT} onXtimes={xtTask}/>)}</>}
    {sortedTasks.length===0&&!w.verse?.text&&!w.whisper?.text&&
      <Card t={t} style={{textAlign:"center",padding:24}}><div style={{fontSize:24,marginBottom:8}}>📋</div>
        <div style={{fontFamily:FB,fontSize:14,color:t.mutedDark,marginBottom:8}}>No tasks yet — set up this week</div>
        <Btn t={t} onClick={()=>setAddSheet(true)}>Set Up Week</Btn></Card>}
    <div style={{marginTop:16,display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
      <Btn t={t} onClick={()=>setAddSheet(true)}>+ Add Activity</Btn>
      {wk<10&&<Btn v="secondary" t={t} onClick={()=>setPlanSheet(true)}>Plan Week {wk+1}</Btn>}</div>
    <WorkoutSheet open={wkSheet} onClose={()=>setWkSheet(false)} t={t} mutate={mutate} user={user} wk={wk} wkOpts={w.wkOpts}/>
    <MileageSheet open={miSheet} onClose={()=>setMiSheet(false)} t={t} mutate={mutate} user={user} wk={wk}/>
    <AddTaskSheet open={addSheet} onClose={()=>setAddSheet(false)} t={t} mutate={mutate} wk={wk}/>
    <EditTaskSheet open={!!editT} task={editT} onClose={()=>setEditT(null)} t={t} mutate={mutate} wk={wk}/>
    <SetupSheet open={!!setupF} field={setupF} onClose={()=>setSetupF(null)} t={t} mutate={mutate} wk={wk} wkData={w}/>
    <PlanSheet open={planSheet} onClose={()=>setPlanSheet(false)} t={t} mutate={mutate} wk={wk} prevTasks={w.tasks} D={D}/>
  </div>
}

// ═══════════════════════════════════════════════════════════════
// GROWTH TAB
// ═══════════════════════════════════════════════════════════════
function GrowthTab({D,mutate,user,t,crossTap}: any) {
  const [cArea,setCArea]=useState<string|null>(null);const [cText,setCText]=useState("")
  const [evtSheet,setEvtSheet]=useState(false);const [newEvt,setNewEvt]=useState({title:"",loc:"",date:"",time:""})

  const adjStrike=(who: string,d: number)=>{if(who!==user)return;mutate((nd: any)=>{
    nd.strikes={...nd.strikes,[who]:Math.max(0,(nd.strikes?.[who]||0)+d)}
    addLog(nd,{type:"strike",user:who,detail:d>0?"banked":"lost",date:tds()});return nd})}
  const addComment=(area: string)=>{if(!cText.trim())return;mutate((nd: any)=>{
    nd.growth={...nd.growth};nd.growth[area]={...nd.growth[area]}
    nd.growth[area].comments=[...(nd.growth[area].comments||[]),{user,text:cText.trim(),date:tds()}]
    addLog(nd,{type:"growth",user,detail:`${area} update`,date:tds()});return nd});setCText("");setCArea(null)}
  const updateGrowth=(area: string,field: string,val: string)=>mutate((nd: any)=>{
    nd.growth={...nd.growth};nd.growth[area]={...nd.growth[area],[field]:val};return nd})
  const updateGiving=(val: string)=>mutate((nd: any)=>{nd.giving={...nd.giving,[user]:val};return nd})
  const toggleEvt=(id: string)=>{mutate((nd: any)=>{nd.events=nd.events.map((e: any)=>e.id===id?{...e,[user]:!e[user]}:e);return nd})}
  const addEvt=()=>{if(!newEvt.title)return;mutate((nd: any)=>{
    nd.events=[...nd.events,{id:`e_${Date.now()}`,...newEvt,scott:false,filip:false}];return nd})
    setNewEvt({title:"",loc:"",date:"",time:""});setEvtSheet(false)}

  let chapDone=0;for(let d=0;d<BIBLE.length;d++){const s2=ds(d4d(d));if(D.daily?.[s2]?.bible?.[user])chapDone++}

  return <div>
    <SH icon="🛡️" t={t}>Strikes</SH>
    <Card t={t}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      {["scott","filip"].map(who=><div key={who} style={{textAlign:"center",flex:1}}>
        <div style={{fontFamily:FB,fontSize:12,fontWeight:700,color:t[who],marginBottom:6}}>{who.toUpperCase()}</div>
        <div style={{display:"flex",gap:3,justifyContent:"center",marginBottom:6}}>
          {Array.from({length:Math.max(4,D.strikes?.[who]||0)}).map((_,i)=><Shield key={i} on={i<(D.strikes?.[who]||0)} s={18} t={t}/>)}</div>
        {user===who&&<div style={{display:"flex",gap:4,justifyContent:"center"}}>
          <Btn v="danger" sm t={t} onClick={()=>adjStrike(who,-1)}>Lose</Btn>
          <Btn v="secondary" sm t={t} onClick={()=>adjStrike(who,1)}>Bank</Btn></div>}
      </div>)}</div></Card>
    <XDiv t={t} idx={4} onTap={crossTap}/>
    {/* Bible Bookshelf */}
    <SH icon="📖" t={t}>Bible Reading Progress</SH>
    <Card t={t}><div style={{fontFamily:FB,fontSize:13,color:t.muted,marginBottom:10}}>{chapDone}/{BIBLE.length-2} chapters complete</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(70px,1fr))",gap:6}}>
        {BOOKS.map((book,bi)=>{let bd=0;for(let c=0;c<book.ch;c++){const di=book.s+c;const s2=ds(d4d(di));if(D.daily?.[s2]?.bible?.[user])bd++}
          const pct=book.ch>0?bd/book.ch:0;const done=pct>=1
          const abbrevs: Record<string,string>={"Philippians":"Philip.","Colossians":"Coloss.","1 Thessalonians":"1 Thess.","2 Thessalonians":"2 Thess."}
          const shortName=abbrevs[book.name]||book.name
          return <div key={bi} style={{background:done?t.goldDim:t.card2,borderRadius:8,padding:"6px 8px",
            border:`1px solid ${done?t.gold:t.border}`,position:"relative",overflow:"hidden",minHeight:52}}>
            <div style={{position:"absolute",bottom:0,left:0,right:0,height:`${pct*100}%`,
              background:done?`linear-gradient(0deg,${t.goldDim},rgba(201,169,110,0.15))`:`linear-gradient(0deg,rgba(122,157,186,0.12),rgba(122,157,186,0.04))`,
              transition:"height 0.5s",borderRadius:"0 0 7px 7px"}}/>
            <div style={{position:"relative",zIndex:1}}>
              <div style={{fontFamily:FB,fontSize:10,fontWeight:700,color:done?t.goldBright:t.cream,lineHeight:1.2,marginBottom:3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{shortName}</div>
              <div style={{display:"flex",gap:1,flexWrap:"wrap"}}>
                {Array.from({length:book.ch}).map((_,ci)=>{const di=book.s+ci;const s2=ds(d4d(di));const chDone=!!D.daily?.[s2]?.bible?.[user]
                  return <div key={ci} style={{width:5,height:5,borderRadius:1,background:chDone?t.green:t.border,transition:"background 0.3s"}}/>})}</div>
              <div style={{fontFamily:FB,fontSize:9,color:done?t.goldText:t.mutedDark,marginTop:2}}>{bd}/{book.ch}</div>
            </div></div>})}</div>
      <div style={{display:"flex",gap:12,marginTop:8,justifyContent:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:6,height:6,borderRadius:1,background:t.green}}/><span style={{fontFamily:FB,fontSize:10,color:t.muted}}>Read</span></div>
        <div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:6,height:6,borderRadius:1,background:t.border}}/><span style={{fontFamily:FB,fontSize:10,color:t.muted}}>Remaining</span></div>
        <div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:10,height:10,borderRadius:4,border:`1px solid ${t.gold}`,background:t.goldDim}}/><span style={{fontFamily:FB,fontSize:10,color:t.muted}}>Complete</span></div>
      </div></Card>
    <XDiv t={t} idx={5} onTap={crossTap}/>
    <SH icon="🌱" t={t}>Growth Commitments</SH>
    {(["physical","spiritual","relational","intellectual"] as const).map(area=>{
      const icons: Record<string,string>={physical:"💪",spiritual:"🙏",relational:"🤝",intellectual:"🧠"}
      return <Card key={area} t={t} style={{marginBottom:10}}>
        <div style={{fontFamily:FD,fontSize:16,fontWeight:600,color:t.cream,marginBottom:8}}>{icons[area]} {area[0].toUpperCase()+area.slice(1)}</div>
        <div style={{display:"flex",gap:8,marginBottom:8}}>
          {["scott","filip"].map(who=><div key={who} style={{flex:1}}>
            <div style={{fontFamily:FB,fontSize:12,fontWeight:700,color:t[who],marginBottom:3}}>{who.toUpperCase()}</div>
            {user===who?<TA value={D.growth?.[area]?.[who]||""} onChange={(v: string)=>updateGrowth(area,who,v)} placeholder="Your commitment..." t={t} rows={2}/>
            :<div style={{fontFamily:FB,fontSize:14,color:t.cream2,padding:8,background:t.card2,borderRadius:8,minHeight:40,
              whiteSpace:"pre-wrap",wordWrap:"break-word",overflowWrap:"break-word"}}>
              {D.growth?.[area]?.[who]||<span style={{color:t.mutedDark}}>Not set</span>}</div>}
          </div>)}</div>
        {(D.growth?.[area]?.comments||[]).length>0&&<div style={{borderTop:`1px solid ${t.border}`,paddingTop:6,marginTop:4}}>
          {D.growth[area].comments.map((c: any,ci: number)=><div key={ci} style={{fontFamily:FB,fontSize:13,color:t.cream2,marginBottom:4}}>
            <span style={{color:t[c.user],fontWeight:700}}>{c.user==="scott"?"Scott":"Filip"}</span>
            <span style={{color:t.mutedDark}}> · {c.date}</span>: {c.text}</div>)}</div>}
        {cArea===area?<div style={{marginTop:6,display:"flex",gap:6}}>
          <Inp value={cText} onChange={setCText} placeholder="Add update..." t={t} style={{flex:1,padding:"6px 10px",fontSize:12}}/>
          <Btn v="primary" sm t={t} onClick={()=>addComment(area)}>Add</Btn></div>
        :<button onClick={()=>setCArea(area)} style={{fontFamily:FB,fontSize:11,color:t.gold,background:"none",border:"none",cursor:"pointer",marginTop:4,padding:0}}>+ Add update</button>}
      </Card>})}
    <XDiv t={t} idx={6} onTap={crossTap}/>
    <SH icon="🔥" t={t}>Giving Up</SH>
    <Card t={t}><div style={{display:"flex",gap:8}}>
      {["scott","filip"].map(who=><div key={who} style={{flex:1}}>
        <div style={{fontFamily:FB,fontSize:12,fontWeight:700,color:t[who],marginBottom:3}}>{who.toUpperCase()}</div>
        {user===who?<TA value={D.giving?.[who]||""} onChange={updateGiving} placeholder="What are you giving up?" t={t} rows={2}/>
        :<div style={{fontFamily:FB,fontSize:14,color:t.cream2,padding:8,background:t.card2,borderRadius:8,minHeight:40,
          whiteSpace:"pre-wrap",wordWrap:"break-word",overflowWrap:"break-word"}}>
          {D.giving?.[who]||<span style={{color:t.mutedDark}}>Not set</span>}</div>}
      </div>)}</div></Card>
    <XDiv t={t} idx={7} onTap={crossTap}/>
    <SH icon="📅" t={t} right={<Btn v="ghost" sm t={t} onClick={()=>setEvtSheet(true)}>+ Add</Btn>}>Special Events</SH>
    {(D.events||[]).map((evt: any)=><Card key={evt.id} t={t} style={{borderLeft:`3px solid ${t.gold}`}}>
      <div style={{fontFamily:FD,fontSize:17,fontWeight:600,color:t.cream,marginBottom:4}}>{evt.title}</div>
      <div style={{fontFamily:FB,fontSize:13,color:t.muted,marginBottom:3}}>{evt.date} · {evt.time}</div>
      <div style={{fontFamily:FB,fontSize:13,color:t.mutedDark,marginBottom:8}}>📍 {evt.loc}</div>
      <div style={{display:"flex",gap:8,marginTop:4}}>
        {["scott","filip"].map(who=>{const attending=!!evt[who];const isMe=user===who
          return <button key={who} onClick={()=>isMe&&toggleEvt(evt.id)} disabled={!isMe}
            style={{flex:1,padding:"10px 0",borderRadius:10,cursor:isMe?"pointer":"default",
              border:`1.5px solid ${attending?t[who]:t.borderMed}`,
              background:attending?`${t[who]}22`:"transparent",opacity:isMe?1:0.7,
              fontFamily:FB,fontSize:13,fontWeight:700,color:attending?t[who]:t.muted}}>
            {attending?"✓ ":"○ "}{who==="scott"?"Scott":"Filip"}{attending?" — Going":" — Not set"}
          </button>})}</div></Card>)}
    <BSheet open={evtSheet} onClose={()=>setEvtSheet(false)} title="Add Event" t={t}>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <Inp value={newEvt.title} onChange={(v: string)=>setNewEvt({...newEvt,title:v})} placeholder="Event name" t={t}/>
        <Inp value={newEvt.loc} onChange={(v: string)=>setNewEvt({...newEvt,loc:v})} placeholder="Location" t={t}/>
        <Inp value={newEvt.date} onChange={(v: string)=>setNewEvt({...newEvt,date:v})} placeholder="YYYY-MM-DD" t={t}/>
        <Inp value={newEvt.time} onChange={(v: string)=>setNewEvt({...newEvt,time:v})} placeholder="e.g. 7:00 PM" t={t}/>
        <Btn t={t} onClick={addEvt} style={{width:"100%"}}>Add Event</Btn></div></BSheet>
  </div>
}

// ═══════════════════════════════════════════════════════════════
// HISTORY TAB
// ═══════════════════════════════════════════════════════════════
function HistoryTab({D,mutate,t,brave,onBrave}: any) {
  const [filter,setFilter]=useState("all");const [typeF,setTypeF]=useState("all");const [wkF,setWkF]=useState("all")
  const [bTaps,setBTaps]=useState(0);const bRef=useRef<any>(null)

  const handleBTap=()=>{const n=bTaps+1;setBTaps(n);if(bRef.current)clearTimeout(bRef.current)
    bRef.current=setTimeout(()=>setBTaps(0),2000);if(n>=5){onBrave();setBTaps(0)}}

  const log=(D.log||[]).filter((e: any)=>{
    if(filter!=="all"&&e.user!==filter)return false
    if(typeF!=="all"&&e.type!==typeF)return false
    if(wkF!=="all"){const eWk=wn(new Date(e.time));if(eWk!==parseInt(wkF))return false};return true})
  const icons: Record<string,string>={complete:"✓",workout:"💪",mileage:"🏃",strike:"🛡️",growth:"🌱",edit:"✏️",addTask:"📋"}
  const total=D.total||0;const milestones=[100,250,500,1000];const next=milestones.find((m: number)=>m>total)||"∞"

  return <div>
    <div onClick={handleBTap} style={{cursor:"default",userSelect:"none"}}><SH icon="📜" t={t}>Activity Log</SH></div>
    {brave&&<div style={{padding:"8px 14px",background:"rgba(42,90,154,0.15)",borderRadius:10,marginBottom:10,border:"1px solid rgba(74,138,224,0.2)"}}>
      <div style={{fontFamily:FB,fontSize:12,fontWeight:600,color:(THEMES.braveheart as any).warpaint}}>🏴 Braveheart Mode Active — FREEDOM!</div></div>}
    <Card t={t} style={{textAlign:"center",marginBottom:12}}>
      <div style={{fontFamily:FB,fontSize:11,color:t.mutedDark}}>Combined tasks completed</div>
      <div style={{fontFamily:FD,fontSize:28,fontWeight:700,color:t.gold}}>{total}</div>
      <div style={{fontFamily:FB,fontSize:10,color:t.mutedDark}}>Next milestone: {next}</div></Card>
    <div style={{display:"flex",gap:4,marginBottom:8,flexWrap:"wrap"}}>
      {[{v:"all",l:"All"},{v:"scott",l:"Scott"},{v:"filip",l:"Filip"}].map(f=>
        <button key={f.v} onClick={()=>setFilter(f.v)} style={{padding:"6px 14px",borderRadius:8,fontFamily:FB,fontSize:12,fontWeight:600,cursor:"pointer",
          border:`1.5px solid ${filter===f.v?t.gold:t.borderMed}`,background:filter===f.v?t.goldDim:"transparent",color:filter===f.v?t.goldText:t.muted}}>{f.l}</button>)}
      <span style={{width:1,height:20,background:t.border,margin:"0 2px"}}/>
      {[{v:"all",l:"All types"},{v:"complete",l:"Completed"},{v:"workout",l:"Workouts"},{v:"edit",l:"Edits"}].map(f=>
        <button key={f.v} onClick={()=>setTypeF(f.v)} style={{padding:"6px 14px",borderRadius:8,fontFamily:FB,fontSize:12,fontWeight:600,cursor:"pointer",
          border:`1.5px solid ${typeF===f.v?t.gold:t.borderMed}`,background:typeF===f.v?t.goldDim:"transparent",color:typeF===f.v?t.goldText:t.muted}}>{f.l}</button>)}</div>
    <div style={{display:"flex",gap:4,marginBottom:12,flexWrap:"wrap"}}>
      <button onClick={()=>setWkF("all")} style={{padding:"6px 14px",borderRadius:8,fontFamily:FB,fontSize:12,fontWeight:600,cursor:"pointer",
        border:`1.5px solid ${wkF==="all"?t.gold:t.borderMed}`,background:wkF==="all"?t.goldDim:"transparent",color:wkF==="all"?t.goldText:t.muted}}>All weeks</button>
      {Array.from({length:10}).map((_,i)=><button key={i} onClick={()=>setWkF(String(i+1))}
        style={{padding:"6px 10px",borderRadius:8,fontFamily:FB,fontSize:12,fontWeight:600,cursor:"pointer",minWidth:28,
          border:`1.5px solid ${wkF===String(i+1)?t.gold:t.borderMed}`,background:wkF===String(i+1)?t.goldDim:"transparent",
          color:wkF===String(i+1)?t.goldText:t.muted}}>{i+1}</button>)}</div>
    {log.length===0&&<div style={{textAlign:"center",padding:30}}><div style={{fontSize:24,marginBottom:8}}>📜</div>
      <div style={{fontFamily:FB,fontSize:14,color:t.mutedDark}}>No activity yet</div></div>}
    {log.slice(0,80).map((entry: any,i: number)=><div key={i} style={{display:"flex",gap:10,padding:"10px 0",borderBottom:`1px solid ${t.border}`}}>
      <div style={{width:32,height:32,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",
        background:entry.type==="complete"?t.greenDim:entry.type==="strike"?"rgba(196,90,72,0.1)":t.goldDim,fontSize:15,flexShrink:0}}>
        {icons[entry.type]||"•"}</div>
      <div style={{flex:1}}>
        <div style={{fontFamily:FB,fontSize:14,color:t.cream}}>
          {entry.user&&<span style={{color:t[entry.user],fontWeight:700}}>{entry.user==="scott"?"Scott":"Filip"} </span>}
          {entry.type==="complete"&&<>completed <strong>{entry.task}</strong></>}
          {entry.type==="workout"&&<>logged workout: {entry.detail}</>}
          {entry.type==="mileage"&&<>logged {entry.detail}</>}
          {entry.type==="strike"&&<>{entry.detail} a strike</>}
          {entry.type==="growth"&&<>updated {entry.detail}</>}
          {entry.type==="edit"&&<>{entry.detail}</>}
          {entry.type==="addTask"&&<>added task: {entry.detail}</>}
        </div>
        <div style={{fontFamily:FB,fontSize:11,color:t.mutedDark}}>{entry.date} · {new Date(entry.time).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</div>
      </div></div>)}
  </div>
}

// ═══════════════════════════════════════════════════════════════
// MEMORY VERSE PRACTICE
// ═══════════════════════════════════════════════════════════════
const parseWords = (text: string): {word:string,punct:string}[] => {
  return text.split(/\s+/).filter(Boolean).map(w => {
    const m = w.match(/^([\w''-]+)([^a-zA-Z0-9]*)$/)
    return m ? {word:m[1],punct:m[2]} : {word:w,punct:""}
  })
}
const levenshtein = (a: string, b: string): number => {
  const m = a.length, n = b.length; const d: number[][] = Array.from({length:m+1},(_,i)=>Array.from({length:n+1},(_,j)=>i===0?j:j===0?i:0))
  for(let i=1;i<=m;i++) for(let j=1;j<=n;j++) d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1))
  return d[m][n]
}
const COMMON_WORDS = new Set(["a","an","the","and","or","but","of","in","to","is","for","it","he","she","we","his","her","my","by","on","at","as","so","if","no","not","be","do","up","all","who","that","this","with","from","will","are","was","had","has","have","them","they","your","been","were"])
const getMastery = (vm: any, wk: number): number => {
  const m = vm?.[wk]; if(!m) return 0
  const modes = [m.progressive, m.firstLetters, m.fillBlank, m.typeOut?.completed].filter(Boolean).length
  if(modes>=4 && (m.typeOut?.best||0)>=90) return 4
  if(modes>=3) return 3; if(modes>=2) return 2; if(modes>=1) return 1; return 0
}
const MASTERY_ICONS = ["○","◔","◑","◕","●"]
const MASTERY_LABELS = ["Not Started","Familiar","Practicing","Strong","Memorized"]
const MASTERY_COLORS = (t: any) => [t.mutedDark,t.muted,t.goldText,t.greenBright,t.goldBright]

function VersePracticeModal({open,onClose,verse,weekNum,t,mastery,onMasteryUpdate}: 
  {open:boolean,onClose:()=>void,verse:{text:string,fullText:string},weekNum:number,t:any,mastery:any,onMasteryUpdate:(wk:number,mode:string,data?:any)=>void}) {
  const [mode,setMode]=useState(0) // 0=progressive, 1=firstLetter, 2=fillBlank, 3=typeOut
  const [stage,setStage]=useState(0)
  const [flShow,setFlShow]=useState(false) // first letter: show full verse
  const [fbSel,setFbSel]=useState<number|null>(null) // fill blank: selected blank
  const [fbAns,setFbAns]=useState<Record<number,string>>({}) // fill blank: placed answers
  const [fbChecked,setFbChecked]=useState(false)
  const [fbCorrect,setFbCorrect]=useState<Record<number,boolean>>({})
  const [typed,setTyped]=useState("")
  const [typeChecked,setTypeChecked]=useState(false)
  const [typePeek,setTypePeek]=useState(false)
  const [peekTimer,setPeekTimer]=useState(0)

  const fullText = verse.fullText || ""
  const words = useMemo(()=>parseWords(fullText),[fullText])

  // Progressive: determine which indices to hide at each stage
  const hiddenAt = useMemo(()=>{
    if(!words.length) return [[],[],[],[],[]]
    const scored = words.map((w,i)=>({i,common:COMMON_WORDS.has(w.word.toLowerCase())}))
    const nonCommon = scored.filter(x=>!x.common).map(x=>x.i)
    const common = scored.filter(x=>x.common).map(x=>x.i)
    // Shuffle deterministically using word index as seed
    const shuffle = (arr: number[]) => arr.slice().sort((a,b)=>((a*7+3)%13)-((b*7+3)%13))
    const ordered = [...shuffle(nonCommon),...shuffle(common)]
    const s1 = Math.ceil(words.length*0.25), s2 = Math.ceil(words.length*0.5), s3 = Math.ceil(words.length*0.75)
    return [
      [] as number[],
      ordered.slice(0,s1),
      ordered.slice(0,s2),
      ordered.slice(0,s3),
      ordered.map((_,i)=>ordered[i]) // all
    ]
  },[words])

  // Fill-in-blank: select words to blank and distractors
  const fbData = useMemo(()=>{
    if(!words.length) return {blanks:[],bank:[],distractors:[]}
    const candidates = words.map((w,i)=>({i,w:w.word,common:COMMON_WORDS.has(w.word.toLowerCase())}))
      .filter(x=>!x.common && x.i>0)
    const selected = candidates.slice().sort((a,b)=>((a.i*11+5)%17)-((b.i*11+5)%17)).slice(0,Math.min(7,Math.max(4,Math.ceil(words.length*0.2))))
      .sort((a,b)=>a.i-b.i)
    const blankIndices = selected.map(s=>s.i)
    const correctWords = selected.map(s=>s.w)
    const distractors = ["grace","mercy","peace","truth","spirit","glory","faith","righteousness","salvation","kingdom"]
      .filter(d=>!correctWords.map(c=>c.toLowerCase()).includes(d)).slice(0,3)
    const bank = [...correctWords,...distractors].sort((a,b)=>((a.charCodeAt(0)*7)%13)-((b.charCodeAt(0)*7)%13))
    return {blanks:blankIndices,bank,distractors}
  },[words])

  // Type-it-out comparison
  const typeResults = useMemo(()=>{
    if(!typeChecked || !typed.trim()) return null
    const typedWords = typed.trim().split(/\s+/)
    const expected = words.map(w=>w.word)
    const results: {expected:string,got:string,status:"correct"|"typo"|"wrong"|"missing"|"extra"}[] = []
    let ei=0, ti=0
    while(ei<expected.length || ti<typedWords.length){
      if(ei<expected.length && ti<typedWords.length){
        if(expected[ei].toLowerCase()===typedWords[ti].toLowerCase().replace(/[^a-zA-Z0-9'-]/g,"")){
          results.push({expected:expected[ei],got:typedWords[ti],status:"correct"}); ei++; ti++
        } else if(levenshtein(expected[ei].toLowerCase(),typedWords[ti].toLowerCase().replace(/[^a-zA-Z0-9'-]/g,""))<=2){
          results.push({expected:expected[ei],got:typedWords[ti],status:"typo"}); ei++; ti++
        } else { results.push({expected:expected[ei],got:typedWords[ti],status:"wrong"}); ei++; ti++ }
      } else if(ei<expected.length){ results.push({expected:expected[ei],got:"",status:"missing"}); ei++ }
      else { results.push({expected:"",got:typedWords[ti],status:"extra"}); ti++ }
    }
    const correct = results.filter(r=>r.status==="correct"||r.status==="typo").length
    const pct = expected.length>0?Math.round((correct/expected.length)*100):0
    return {results,pct,correct,total:expected.length}
  },[typeChecked,typed,words])

  // Peek timer
  useEffect(()=>{
    if(!typePeek) return
    setPeekTimer(10)
    const iv=setInterval(()=>setPeekTimer(p=>{if(p<=1){setTypePeek(false);clearInterval(iv);return 0}return p-1}),1000)
    return ()=>clearInterval(iv)
  },[typePeek])

  const resetMode = ()=>{setStage(0);setFlShow(false);setFbSel(null);setFbAns({});setFbChecked(false);setFbCorrect({})
    setTyped("");setTypeChecked(false);setTypePeek(false)}
  const switchMode = (m: number)=>{setMode(m);resetMode()}

  if(!open || !fullText) return null

  const modes = [{icon:"📖",label:"Remove"},{icon:"🔤",label:"Letters"},{icon:"✏️",label:"Blanks"},{icon:"⌨️",label:"Type"}]
  const m = mastery?.[weekNum] || {}

  return <div style={{position:"fixed",inset:0,zIndex:200,background:t.bg,overflowY:"auto",display:"flex",flexDirection:"column"}}>
    {/* Header */}
    <div style={{padding:"12px 16px",borderBottom:`1px solid ${t.border}`,background:t.hdrBg,backdropFilter:"blur(12px)"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <button onClick={onClose} style={{background:"none",border:"none",color:t.cream,fontSize:16,cursor:"pointer",padding:"4px 8px"}}>← Back</button>
        <div style={{textAlign:"center"}}><div style={{fontFamily:FD,fontSize:16,color:t.cream}}>Week {weekNum}</div>
          <div style={{fontFamily:FB,fontSize:12,color:t.goldText}}>{verse.text}</div></div>
        <div style={{width:50}}/>
      </div>
      <div style={{display:"flex",gap:4}}>
        {modes.map((md,i)=>{
          const done = i===0?m.progressive:i===1?m.firstLetters:i===2?m.fillBlank:m.typeOut?.completed
          return <button key={i} onClick={()=>switchMode(i)} style={{flex:1,padding:"8px 4px",borderRadius:8,border:`1.5px solid ${mode===i?t.gold:done?`${t.green}66`:t.borderMed}`,
            background:mode===i?t.goldDim:done?t.greenDim:"transparent",cursor:"pointer",textAlign:"center"}}>
            <div style={{fontSize:14}}>{md.icon}</div>
            <div style={{fontFamily:FB,fontSize:10,fontWeight:600,color:mode===i?t.goldText:done?t.greenBright:t.muted}}>{md.label}</div>
            {done&&<div style={{fontSize:8,color:t.greenBright}}>✓</div>}
          </button>})}
      </div>
    </div>
    {/* Content */}
    <div style={{flex:1,padding:"16px",overflowY:"auto"}}>
      {/* MODE 0: Progressive Word Removal */}
      {mode===0&&<div>
        <div style={{display:"flex",gap:4,marginBottom:16}}>
          {[0,1,2,3,4].map(s=><div key={s} style={{flex:1,height:4,borderRadius:2,
            background:s<=stage?t.gold:t.border,transition:"all 0.3s"}}/>)}</div>
        <div style={{fontFamily:FB,fontSize:12,color:t.muted,marginBottom:12,textAlign:"center"}}>
          {stage===0?"Read the full verse":stage===4?"Recite from memory!":
            `${Math.round((hiddenAt[stage]?.length/Math.max(words.length,1))*100)}% hidden`}</div>
        <Card t={t} style={{padding:20}}>
          <div style={{fontFamily:FD,fontSize:18,color:t.cream,lineHeight:1.7,textAlign:"center"}}>
            {words.map((w,i)=>{const hidden=(hiddenAt[stage]||[]).includes(i)
              return <span key={i}>{hidden?<span style={{display:"inline-block",minWidth:w.word.length*9,borderBottom:`2px solid ${t.borderMed}`,
                margin:"0 2px"}}>&nbsp;</span>:<span>{w.word}</span>}{w.punct}<span> </span></span>})}
          </div>
        </Card>
        <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:16}}>
          {stage>0&&<Btn v="secondary" t={t} onClick={()=>setStage(stage-1)}>← Back</Btn>}
          {stage<4?<Btn t={t} onClick={()=>setStage(stage+1)}>Next Stage →</Btn>
          :<div style={{display:"flex",gap:8}}>
            <Btn v="secondary" t={t} onClick={()=>setStage(0)}>Try Again</Btn>
            <Btn t={t} onClick={()=>onMasteryUpdate(weekNum,"progressive")}>✓ I Got It!</Btn></div>}
        </div>
      </div>}
      {/* MODE 1: First Letter Method */}
      {mode===1&&<div>
        <div style={{fontFamily:FB,fontSize:13,color:t.muted,marginBottom:12,textAlign:"center"}}>
          {flShow?"Full verse shown — study it":"Each word reduced to its first letter"}</div>
        <Card t={t} style={{padding:20}}>
          <div style={{fontFamily:flShow?FD:"monospace",fontSize:flShow?18:20,color:t.cream,lineHeight:1.8,textAlign:"center",letterSpacing:flShow?0:2}}>
            {flShow?words.map((w,i)=><span key={i}>{w.word}{w.punct} </span>)
            :words.map((w,i)=><span key={i}><span style={{color:t.goldText,fontWeight:700}}>{w.word[0]}</span><span style={{color:t.mutedDark}}>.</span>{w.punct} </span>)}
          </div>
        </Card>
        <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:16}}>
          <Btn v="secondary" t={t} onClick={()=>setFlShow(!flShow)}>{flShow?"Hide Verse":"Show Verse"}</Btn>
          <Btn t={t} onClick={()=>onMasteryUpdate(weekNum,"firstLetters")}>✓ I've Got It!</Btn>
        </div>
      </div>}
      {/* MODE 2: Fill in the Blank */}
      {mode===2&&<div>
        <div style={{fontFamily:FB,fontSize:13,color:t.muted,marginBottom:12,textAlign:"center"}}>
          Tap a blank, then tap a word from the bank</div>
        <Card t={t} style={{padding:16}}>
          <div style={{fontFamily:FD,fontSize:16,color:t.cream,lineHeight:2,textAlign:"center"}}>
            {words.map((w,i)=>{
              const blankIdx = fbData.blanks.indexOf(i)
              if(blankIdx===-1) return <span key={i}>{w.word}{w.punct} </span>
              const ans = fbAns[i]
              const isCorrect = fbChecked ? fbCorrect[i] : null
              return <span key={i}><button onClick={()=>{if(fbChecked)return;if(ans){const na={...fbAns};delete na[i];setFbAns(na)}else setFbSel(i)}}
                style={{display:"inline-block",minWidth:50,padding:"2px 8px",margin:"0 2px",borderRadius:6,cursor:"pointer",
                  border:`2px ${fbSel===i?"dashed":"solid"} ${isCorrect===true?t.green:isCorrect===false?t.red:fbSel===i?t.gold:t.borderMed}`,
                  background:isCorrect===true?t.greenDim:isCorrect===false?"rgba(212,80,80,0.15)":ans?t.goldDim:"transparent",
                  fontFamily:FB,fontSize:14,fontWeight:600,color:ans?(isCorrect===false?t.red:t.goldText):t.mutedDark}}>
                {ans||`__${blankIdx+1}__`}</button>{w.punct} </span>})}
          </div>
        </Card>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:12,justifyContent:"center"}}>
          {fbData.bank.map((w,i)=>{const used=Object.values(fbAns).includes(w)
            return <button key={i} onClick={()=>{if(fbChecked||used||fbSel===null)return;setFbAns({...fbAns,[fbSel]:w});setFbSel(null)}}
              style={{padding:"8px 14px",borderRadius:8,fontFamily:FB,fontSize:14,fontWeight:600,cursor:used?"default":"pointer",
                border:`1.5px solid ${used?t.borderMed:t.gold}`,background:used?t.card2:t.goldDim,
                color:used?t.mutedDark:t.goldText,opacity:used?.4:1}}>{w}</button>})}
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:16}}>
          {!fbChecked?<>
            <Btn v="secondary" t={t} onClick={()=>{setFbAns({});setFbSel(null);setFbChecked(false);setFbCorrect({})}}>Reset</Btn>
            <Btn t={t} disabled={Object.keys(fbAns).length<fbData.blanks.length} onClick={()=>{
              const corr: Record<number,boolean>={}; let allRight=true
              fbData.blanks.forEach(idx=>{const ok=fbAns[idx]?.toLowerCase()===words[idx].word.toLowerCase();corr[idx]=ok;if(!ok)allRight=false})
              setFbCorrect(corr);setFbChecked(true)
              if(allRight) onMasteryUpdate(weekNum,"fillBlank")
            }}>Check Answers</Btn></>
          :<><Btn v="secondary" t={t} onClick={()=>{setFbAns({});setFbSel(null);setFbChecked(false);setFbCorrect({})}}>Try Again</Btn>
            {Object.values(fbCorrect).every(Boolean)&&
              <div style={{fontFamily:FB,fontSize:14,fontWeight:700,color:t.greenBright}}>✓ All correct!</div>}</>}
        </div>
      </div>}
      {/* MODE 3: Type It Out */}
      {mode===3&&<div>
        <div style={{fontFamily:FD,fontSize:18,color:t.goldText,textAlign:"center",marginBottom:12}}>{verse.text}</div>
        {!typeChecked?<>
          {!typePeek&&<div style={{textAlign:"center",marginBottom:12}}>
            <button onClick={()=>setTypePeek(true)} style={{fontFamily:FB,fontSize:12,color:t.muted,background:t.card2,border:`1px solid ${t.borderMed}`,
              borderRadius:8,padding:"6px 14px",cursor:"pointer"}}>👁 Peek at verse (10s)</button></div>}
          {typePeek&&<Card t={t} style={{padding:14,marginBottom:12,borderColor:`${t.gold}44`}}>
            <div style={{fontFamily:FD,fontSize:15,fontStyle:"italic",color:t.cream2,lineHeight:1.5,textAlign:"center"}}>{fullText}</div>
            <div style={{fontFamily:FB,fontSize:11,color:t.urgent,textAlign:"center",marginTop:6}}>Hiding in {peekTimer}s...</div></Card>}
          <textarea value={typed} onChange={e=>setTyped(e.target.value)} placeholder="Type the verse from memory..."
            style={{width:"100%",boxSizing:"border-box",minHeight:120,padding:14,borderRadius:12,border:`1.5px solid ${t.borderMed}`,
              background:t.card2,color:t.cream,fontFamily:FB,fontSize:16,lineHeight:1.6,outline:"none",resize:"vertical"}}/>
          <div style={{fontFamily:FB,fontSize:11,color:t.muted,marginTop:4}}>{typed.trim().split(/\s+/).filter(Boolean).length}/{words.length} words</div>
          <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:12}}>
            <Btn t={t} disabled={!typed.trim()} onClick={()=>setTypeChecked(true)}>Check</Btn></div>
        </>:<>
          {typeResults&&<div>
            <div style={{textAlign:"center",marginBottom:12}}>
              <div style={{fontFamily:FD,fontSize:32,color:typeResults.pct>=90?t.greenBright:typeResults.pct>=70?t.goldBright:t.red}}>{typeResults.pct}%</div>
              <div style={{fontFamily:FB,fontSize:13,color:t.muted}}>{typeResults.correct}/{typeResults.total} words correct</div></div>
            <Card t={t} style={{padding:14}}>
              <div style={{lineHeight:1.8}}>
                {typeResults.results.map((r,i)=>{
                  const col = r.status==="correct"?t.greenBright:r.status==="typo"?t.goldBright:r.status==="extra"?t.mutedDark:t.red
                  const bg = r.status==="correct"?t.greenDim:r.status==="typo"?t.goldDim:r.status==="extra"?"transparent":"rgba(212,80,80,0.12)"
                  const icon = r.status==="correct"?"":"✗"
                  return <span key={i} style={{display:"inline",padding:"1px 4px",borderRadius:4,margin:"1px",
                    background:bg,fontFamily:FB,fontSize:15,color:col}} title={r.status==="wrong"||r.status==="missing"?`Expected: ${r.expected}`:""}>
                    {r.got||r.expected}{r.status==="wrong"&&<span style={{fontSize:10,marginLeft:2}}>{icon}</span>} </span>})}
              </div>
            </Card>
            <div style={{fontFamily:FB,fontSize:12,color:t.muted,marginTop:8,textAlign:"center"}}>
              <span style={{color:t.greenBright}}>■</span> Correct &nbsp;
              <span style={{color:t.goldBright}}>■</span> Close &nbsp;
              <span style={{color:t.red}}>■</span> Wrong/Missing</div>
            <div style={{marginTop:12,padding:10,background:t.card2,borderRadius:10,border:`1px solid ${t.border}`}}>
              <div style={{fontFamily:FB,fontSize:11,fontWeight:700,color:t.muted,marginBottom:4}}>CORRECT VERSE:</div>
              <div style={{fontFamily:FD,fontSize:14,fontStyle:"italic",color:t.cream2,lineHeight:1.5}}>{fullText}</div></div>
            {typeResults.pct>=80&&!m.typeOut?.completed&&
              <div style={{textAlign:"center",marginTop:8}}><Btn t={t} onClick={()=>onMasteryUpdate(weekNum,"typeOut",{best:typeResults.pct})}>✓ Mark Complete</Btn></div>}
          </div>}
          <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:12}}>
            <Btn v="secondary" t={t} onClick={()=>{setTyped("");setTypeChecked(false)}}>Try Again</Btn></div>
        </>}
      </div>}
    </div>
  </div>
}

function MemoryVerseTab({D,mutate,user,t}: any) {
  const [practiceWk,setPracticeWk]=useState<number|null>(null)
  const maxWk = Math.min(Math.floor(dn(today())/7)+1,10)
  const currentWk = maxWk
  const vm = D?.verseMastery || {}

  // Collect all verses from weeks 1 to current
  const verses: {wk:number,verse:any}[] = []
  for(let w=1;w<=maxWk;w++){
    const wk = D?.weeks?.[w]; if(wk?.verse?.text) verses.push({wk:w,verse:wk.verse})
  }

  const onMasteryUpdate = (wk: number, mode: string, data?: any) => {
    mutate((nd: any) => {
      if(!nd.verseMastery) nd.verseMastery = {}
      if(!nd.verseMastery[wk]) nd.verseMastery[wk] = {}
      if(mode==="progressive") nd.verseMastery[wk].progressive = true
      if(mode==="firstLetters") nd.verseMastery[wk].firstLetters = true
      if(mode==="fillBlank") nd.verseMastery[wk].fillBlank = true
      if(mode==="typeOut"){
        const prev = nd.verseMastery[wk].typeOut || {completed:false,best:0}
        nd.verseMastery[wk].typeOut = {completed:true,best:Math.max(prev.best,data?.best||0)}
      }
      addLog(nd,{type:"complete",user,task:`verse_${mode}`,date:tds()})
      return nd
    })
  }

  const practiceVerse = practiceWk ? D?.weeks?.[practiceWk]?.verse : null

  return <div>
    <VersePracticeModal open={!!practiceWk && !!practiceVerse?.fullText} onClose={()=>setPracticeWk(null)}
      verse={practiceVerse||{text:"",fullText:""}} weekNum={practiceWk||1} t={t} mastery={vm} onMasteryUpdate={onMasteryUpdate}/>

    <SH icon="📖" t={t}>Memory Verses</SH>
    <div style={{fontFamily:FB,fontSize:13,color:t.muted,marginBottom:12}}>Practice this week's verse or review any past verse</div>

    {verses.length===0&&<Card t={t} style={{textAlign:"center",padding:24}}>
      <div style={{fontSize:24,marginBottom:8}}>📖</div>
      <div style={{fontFamily:FB,fontSize:14,color:t.mutedDark}}>No verses set yet — add a verse in the Track or Week tab</div></Card>}

    {verses.slice().reverse().map(({wk,verse})=>{
      const isCurrent = wk===currentWk
      const mastery = getMastery(vm,wk)
      const mColors = MASTERY_COLORS(t)
      const hasFull = !!verse.fullText
      return <Card key={wk} t={t} style={{borderColor:isCurrent?`${t.gold}44`:undefined,
        boxShadow:isCurrent?`0 0 12px ${t.goldDim}`:`0 1px 3px rgba(0,0,0,0.2)`}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:6}}>
          <div>
            {isCurrent&&<span style={{fontFamily:FB,fontSize:10,fontWeight:700,color:t.goldText,background:t.goldDim,
              padding:"2px 8px",borderRadius:4,marginBottom:4,display:"inline-block"}}>THIS WEEK</span>}
            <div style={{fontFamily:FD,fontSize:16,color:t.cream,marginTop:isCurrent?4:0}}>Week {wk}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontFamily:FB,fontSize:16,color:mColors[mastery]}}>{MASTERY_ICONS[mastery]}</div>
            <div style={{fontFamily:FB,fontSize:10,color:mColors[mastery]}}>{MASTERY_LABELS[mastery]}</div>
          </div>
        </div>
        <div style={{fontFamily:FD,fontSize:15,color:t.goldText,marginBottom:2}}>{verse.text}</div>
        {hasFull&&<div style={{fontFamily:FB,fontSize:13,color:t.cream2,lineHeight:1.4,marginBottom:8,
          display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical" as any,overflow:"hidden"}}>
          {verse.fullText}</div>}
        {hasFull?<button onClick={()=>setPracticeWk(wk)} style={{width:"100%",padding:"10px",borderRadius:10,
          border:`1.5px solid ${t.gold}`,background:t.goldDim,color:t.goldText,fontFamily:FB,fontSize:14,fontWeight:700,cursor:"pointer"}}>
          📖 Practice</button>
        :<div style={{fontFamily:FB,fontSize:12,color:t.mutedDark,fontStyle:"italic",padding:"6px 0"}}>
          Add full verse text to enable practice — tap Edit on the Track tab</div>}
        {/* Mini mastery dots */}
        {hasFull&&<div style={{display:"flex",gap:6,marginTop:8,justifyContent:"center"}}>
          {["Remove","Letters","Blanks","Type"].map((ml,mi)=>{
            const m2 = vm[wk]||{}
            const done = mi===0?m2.progressive:mi===1?m2.firstLetters:mi===2?m2.fillBlank:m2.typeOut?.completed
            return <div key={mi} style={{display:"flex",alignItems:"center",gap:3}}>
              <div style={{width:8,height:8,borderRadius:4,background:done?t.greenBright:t.borderMed}}/>
              <span style={{fontFamily:FB,fontSize:10,color:done?t.greenBright:t.mutedDark}}>{ml}</span></div>})}
        </div>}
      </Card>})}
  </div>
}

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
export default function FC30App() {
  const { D, loading, mutate, user, theme, setUser, setTheme } = useFC30()
  const [tab,setTab] = useState("track")
  const [dayNum,setDayNum] = useState(()=>Math.max(0,Math.min(dn(today()),69)))
  const [weekView,setWeekView] = useState(()=>Math.floor(Math.max(0,Math.min(dn(today()),69))/7)+1)
  const [showLion,setShowLion] = useState(false);const [showFreedom,setShowFreedom] = useState(false)
  const [showMidnight,setShowMidnight] = useState(false);const [nehWord,setNehWord] = useState<string|null>(null);const [showNeh,setShowNeh] = useState(false)
  const [streakMs,setStreakMs] = useState<number|null>(null);const [mileMs,setMileMs] = useState<number|null>(null)
  useFavicon()

  const wk = Math.floor(dayNum/7)+1
  const brave = D?.brave || false
  const themeKey = brave?"braveheart":(theme||"dark")
  const t = THEMES[themeKey] || THEMES.dark

  const crossTap = useCallback((idx: number) => {
    if(!D) return
    const rev = Object.keys(D.crossTaps||{}).length
    if(D.crossTaps?.[idx] || rev >= NEH.length) return
    mutate((nd: any) => { if(!nd.crossTaps) nd.crossTaps = {}; nd.crossTaps[idx] = true; return nd })
    setNehWord(NEH[rev]); setShowNeh(true)
  }, [D, mutate])

  const toggleBrave = () => mutate((nd: any) => { nd.brave = !nd.brave; return nd })

  if(loading) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",
    background:"#111114",fontFamily:FD,color:"#d4ad5e",fontSize:20}}><div style={{textAlign:"center"}}>
    <div style={{fontSize:32,marginBottom:8}}>⚔️</div>Hold the Line...</div></div>

  if(!D) return null

  if(!user) return <div style={{minHeight:"100vh",background:THEMES.dark.bg,display:"flex",flexDirection:"column",
    alignItems:"center",justifyContent:"center",padding:30}}>
    <style>{CSS}</style>
    <div style={{textAlign:"center",marginBottom:40}}>
      <div style={{fontSize:48,marginBottom:12}}>⚔️</div>
      <h1 style={{fontFamily:FD,fontSize:28,color:THEMES.dark.cream,margin:0}}>Fight Club</h1>
      <h2 style={{fontFamily:FD,fontSize:18,color:THEMES.dark.gold,fontWeight:400,margin:"4px 0 0"}}>Chapter 30</h2>
      <div style={{fontFamily:FB,fontSize:12,color:THEMES.dark.muted,marginTop:8}}>Hold the Line — Nehemiah 4:14</div></div>
    <div style={{fontFamily:FB,fontSize:14,color:THEMES.dark.cream2,marginBottom:16}}>Who are you?</div>
    <div style={{display:"flex",gap:16}}>
      {(["scott","filip"] as const).map(name=><button key={name} onClick={()=>setUser(name)}
        style={{width:120,padding:"20px 16px",borderRadius:16,border:`2px solid ${THEMES.dark[name]}`,background:THEMES.dark.card,cursor:"pointer",textAlign:"center"}}>
        <div style={{fontSize:28,marginBottom:6}}>{name==="scott"?"⚔️":"🛡️"}</div>
        <div style={{fontFamily:FD,fontSize:18,color:THEMES.dark[name]}}>{name[0].toUpperCase()+name.slice(1)}</div>
      </button>)}</div></div>

  return <div style={{minHeight:"100vh",background:t.bg,paddingBottom:70}}>
    <style>{CSS}</style>
    <LionRoars show={showLion} onDone={()=>setShowLion(false)} t={t}/>
    <FreedomBanner show={showFreedom} onDone={()=>setShowFreedom(false)}/>
    <Toast show={showNeh} onDone={()=>setShowNeh(false)} t={t}><span style={{fontFamily:FD,fontSize:18,color:t.goldBright}}>&quot;{nehWord}&quot;</span></Toast>
    <Toast show={showMidnight} onDone={()=>setShowMidnight(false)} ms={3000} t={t}>
      <div style={{fontFamily:FD,fontSize:14,color:t.goldBright,textAlign:"center"}}>🌙 Under the wire.<br/>
        <span style={{color:t.cream2,fontSize:12}}>A warrior finishes what he starts.</span></div></Toast>
    {streakMs&&<StreakOverlay days={streakMs} show={true} onDone={()=>setStreakMs(null)} t={t}/>}
    {mileMs&&<MilestoneFlash n={mileMs} show={true} onDone={()=>setMileMs(null)} t={t}/>}
    {/* Header */}
    <div style={{position:"sticky",top:0,zIndex:50,background:t.hdrBg,backdropFilter:"blur(12px)",
      padding:"12px 16px 8px",borderBottom:`1px solid ${t.border}`}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:18}}>⚔️</span>
          <div><h1 style={{fontFamily:FD,fontSize:18,color:t.cream,margin:0,lineHeight:1}}>
            {brave?"BRAVEHEART":"Hold the Line"}</h1>
          <div style={{fontFamily:FB,fontSize:11,color:t.muted}}>{brave?"They may take our lives...":"Chapter 30 — Nehemiah 4:14"}</div></div></div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <div style={{display:"flex",gap:1}}>{Array.from({length:4}).map((_,i)=><Shield key={i} on={i<(D.strikes?.[user]||0)} s={10} t={t}/>)}</div>
          <button onClick={()=>{if(brave){toggleBrave();return}setTheme(theme==="dark"?"light":"dark")}}
            style={{background:"none",border:"none",color:t.muted,fontSize:16,cursor:"pointer",padding:4}}>{theme==="dark"?"☀️":"🌙"}</button>
          <button onClick={()=>setUser(user==="scott"?"filip":"scott")}
            style={{fontFamily:FB,fontSize:11,fontWeight:700,color:t[user],background:t.card2,border:`1px solid ${t.borderMed}`,
              borderRadius:8,padding:"5px 10px",cursor:"pointer"}}>{user.toUpperCase()} ↔</button>
        </div></div></div>
    {/* Content */}
    <div style={{padding:"12px 16px"}}>
      {tab==="track"&&<TrackTab D={D} mutate={mutate} user={user} dayNum={dayNum} setDayNum={(d: number)=>{setDayNum(d);setWeekView(Math.floor(d/7)+1)}}
        wk={wk} t={t} brave={brave} onLion={()=>setShowLion(true)} onFreedom={()=>setShowFreedom(true)}
        onMidnight={()=>setShowMidnight(true)} crossTap={crossTap} onStreak={(d: number)=>setStreakMs(d)} onMilestone={(n: number)=>setMileMs(n)}/>}
      {tab==="week"&&<WeekTab D={D} mutate={mutate} user={user} wk={weekView} setWk={setWeekView} t={t} crossTap={crossTap}/>}
      {tab==="growth"&&<GrowthTab D={D} mutate={mutate} user={user} t={t} crossTap={crossTap}/>}
      {tab==="verse"&&<MemoryVerseTab D={D} mutate={mutate} user={user} t={t}/>}
      {tab==="history"&&<HistoryTab D={D} mutate={mutate} t={t} brave={brave} onBrave={toggleBrave}/>}
    </div>
    {/* Bottom Tabs */}
    <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:50,background:t.tabBg,backdropFilter:"blur(12px)",
      borderTop:`1px solid ${t.border}`,display:"flex",padding:"6px 0 env(safe-area-inset-bottom, 8px)"}}>
      {[{id:"track",icon:"⚔️",label:"Track"},{id:"week",icon:"📅",label:"Week"},
        {id:"verse",icon:"📖",label:"Verse"},{id:"growth",icon:"🌱",label:"Growth"},{id:"history",icon:"📜",label:"History"}].map(tb=>
        <button key={tb.id} onClick={()=>setTab(tb.id)}
          style={{flex:1,background:"none",border:"none",cursor:"pointer",padding:"8px 0",textAlign:"center"}}>
          <div style={{fontSize:20,marginBottom:2,opacity:tab===tb.id?1:.5}}>{tb.icon}</div>
          <div style={{fontFamily:FB,fontSize:11,fontWeight:tab===tb.id?700:400,color:tab===tb.id?t.gold:t.muted}}>{tb.label}</div>
        </button>)}</div>
  </div>
}

// Favicon - Shield with Cross
const FAVICON_SVG = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f0d89a"/><stop offset="100%" stop-color="#b8932e"/></linearGradient><linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1c1c22"/><stop offset="100%" stop-color="#111114"/></linearGradient></defs><path d="M32 2L6 14v18c0 16 11 24 26 28 15-4 26-12 26-28V14L32 2z" fill="url(#b)" stroke="url(#g)" stroke-width="2.5"/><path d="M32 2L6 14v18c0 16 11 24 26 28 15-4 26-12 26-28V14L32 2z" fill="none" stroke="#d4ad5e" stroke-width="1" opacity="0.3" transform="translate(0,1)"/><rect x="29" y="16" width="6" height="30" rx="1.5" fill="url(#g)"/><rect x="19" y="22" width="26" height="6" rx="1.5" fill="url(#g)"/></svg>')}`

function useFavicon() {
  useEffect(() => {
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link) }
    link.href = FAVICON_SVG
    link.type = 'image/svg+xml'
    // Also set the page title
    document.title = 'FC30 — Hold the Line'
  }, [])
}

// ═══════════════════════════════════════════════════════════════
// CSS
// ═══════════════════════════════════════════════════════════════
const CSS = `
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
body{overscroll-behavior:none}
input,textarea,button{font-family:'Source Sans 3',system-ui,sans-serif}
@keyframes celRing{0%{transform:scale(0.5);opacity:1}40%{opacity:0.7}100%{transform:scale(2.2);opacity:0}}
@keyframes celRing2{0%{transform:scale(0.3);opacity:0.8}100%{transform:scale(2.8);opacity:0}}
@keyframes celGlow{0%{opacity:0.6;transform:scale(0.8)}50%{opacity:0.3}100%{opacity:0;transform:scale(2.5)}}
@keyframes particleFly{0%{transform:translate(-50%,-50%) scale(1.2);opacity:1}30%{opacity:1}100%{transform:translate(calc(-50% + var(--px)),calc(-50% + var(--py))) scale(0);opacity:0}}
@keyframes sparkFly0{0%{opacity:1;transform:translate(-50%,-50%) rotate(45deg) scaleY(1)}100%{opacity:0;transform:translate(calc(-50% - 14px),calc(-50% - 14px)) rotate(45deg) scaleY(2.5)}}
@keyframes sparkFly1{0%{opacity:1;transform:translate(-50%,-50%) rotate(135deg) scaleY(1)}100%{opacity:0;transform:translate(calc(-50% + 14px),calc(-50% - 14px)) rotate(135deg) scaleY(2.5)}}
@keyframes sparkFly2{0%{opacity:1;transform:translate(-50%,-50%) rotate(225deg) scaleY(1)}100%{opacity:0;transform:translate(calc(-50% - 14px),calc(-50% + 14px)) rotate(225deg) scaleY(2.5)}}
@keyframes sparkFly3{0%{opacity:1;transform:translate(-50%,-50%) rotate(315deg) scaleY(1)}100%{opacity:0;transform:translate(calc(-50% + 14px),calc(-50% + 14px)) rotate(315deg) scaleY(2.5)}}
@keyframes fadeIn{0%{opacity:0}100%{opacity:1}}
@keyframes slideDown{0%{transform:translateX(-50%) translateY(-20px);opacity:0}100%{transform:translateX(-50%) translateY(0);opacity:1}}
@keyframes lionPulse{0%{transform:scale(.5);opacity:0}50%{transform:scale(1.1);opacity:1}100%{transform:scale(1);opacity:1}}
@keyframes freedomPulse{0%,100%{text-shadow:0 0 40px rgba(74,138,224,.5)}50%{text-shadow:0 0 60px rgba(74,138,224,.8)}}
@keyframes urgPulse{0%,100%{opacity:1}50%{opacity:.6}}
@keyframes goldPulse{0%,100%{border-color:rgba(212,173,94,.2)}50%{border-color:rgba(212,173,94,.4)}}
`
