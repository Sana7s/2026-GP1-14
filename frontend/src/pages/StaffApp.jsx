import React, {useEffect, useMemo, useRef, useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {logOut} from '../auth.js'
import BodyMap, { calculateTBSA, names } from "./healthcare-staff/OldBodyMap.jsx";
import AssessmentForm, {
  EMERGENCY_QUESTIONS,
  CONDITIONS
} from "./AssessmentForm.jsx";
import { Reveal } from "../components/animations.jsx";
import "./healthcare-staff/staff-styles.css";

const TODAY = () => new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10)
const ROLES = ['Doctor','Nurse','Paramedic or ambulance crew','Burn specialist','Other']
const MECHANISMS = ['Hot liquid or steam','Fire or flame','Hot object','Electricity','Chemical','Friction','Cold injury (frostbite)','Sun','Other','Flame / Thermal','Scald / Hot Liquid','Contact','Radiation / Other','Unknown']
const TIME = ['Less than 2 hours','2 to 6 hours','6 to 24 hours','More than 24 hours']
const RESULT_TYPES = ['No treatment needed','Treat locally','Treat at a burn unit']
const NOW = {patient_code:'',injury_date:TODAY(),age:'',pain:'',mechanism:'',time_since:'',diabetes:'',medical_history:'',notes:'',tbsa_final:'',tbsa_reason:''}
const fmt = x => x == null || x === '' ? '—' : String(x)
const dateFmt = x => x ? new Date(x).toLocaleString() : '—'
const displayPercent = x => x == null ? 'Not yet estimated' : `${Number(x).toFixed(2).replace(/\.?0+$/,'')}%`

async function api(path, opts={}) {
  let res
  try {res=await fetch('/staff/api'+path,{method:opts.method||'GET',credentials:'same-origin',headers:opts.body instanceof FormData?{}:{'Content-Type':'application/json'},body:opts.body instanceof FormData?opts.body:opts.body!=null?JSON.stringify(opts.body):undefined})}
  catch {throw new Error('Cannot connect to Flask. Start the backend in its own Terminal window on port 5000.')}
  const data=await res.json().catch(()=>({}))
  if(!res.ok) throw new Error(data.error||`Server error ${res.status}`)
  return data
}
function Heading({tag,title,subtitle,action}) {return <div className="page-heading"><div><small className="eyebrow">{tag}</small><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>}
function Card({num,title,description,children}) {return <section className="card"><div className="card-heading"><span className="section-number">{num}</span><div><h2>{title}</h2><p>{description}</p></div></div>{children}</section>}
function Field({label,required,tip,children}) {return <label className="field"><span>{label}{required&&<b className="required"> *</b>}</span>{children}{tip&&<small>{tip}</small>}</label>}
function Msg({error,success}) {return <>{error&&<div className="notice error" role="alert">{error}</div>}{success&&<div className="notice success" role="status">{success}</div>}</>}
function TreatmentChoices({destination}) {return <div className="destination-grid">{RESULT_TYPES.map((x,i)=><div key={x} className={`destination ${destination===x?'is-selected':''}`}><div className="destination-icon">{['⌂','✚','✣'][i]}</div><b>{x}</b><small>{['Minor burn / first aid at home','Care at a nearby clinic or hospital','Transfer to a specialist burn unit'][i]}</small></div>)}</div>}
function VoiceButton({onText,label}) {
  const [active,setActive]=useState(false)
  function speak(){const Speech=window.SpeechRecognition||window.webkitSpeechRecognition; if(!Speech){alert('Speech input is not supported in this browser. Try Chrome, or type instead.');return}
    const rec=new Speech();rec.lang='en-US';rec.interimResults=false;rec.maxAlternatives=1
    rec.onresult=e=>onText(e.results[0][0].transcript);rec.onerror=e=>{setActive(false);alert('Speech recognition: '+e.error)};rec.onend=()=>setActive(false);setActive(true);rec.start()
  }
  return <button type="button" className={'mic '+(active?'recording':'')} onClick={speak} title={`Speak ${label}`}>{active?'● Listening':'♩ Speak'}</button>
}
function VoiceField({title,name,value,set,children,tip,required=true}) {
  return <div className="voice-wrap"><Field label={title} required={required} tip={tip}>{children}</Field><VoiceButton label={title} onText={str=>set(name,str)}/></div>
}
const initialsOf = name => (name||'?').trim().split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()).join('')
// Buttons styled like the patient links (no grey button box).
const NAV_BUTTON={background:'none',border:0,font:'inherit',cursor:'pointer'}
const EMPTY_PROFILE = {name:'',role:'Doctor',specialty:'',organization:'',department:'',license_number:'',email:''}

// One labelled box in the patient Profile page style.
function ProfileInput({id,label,optional,value,onChange,...props}){
  return <div className="field"><label className="field-label" htmlFor={`staff-${id}`}>{label}{optional&&<span className="optional-mark">Optional</span>}</label>
    <div className="text-input"><input id={`staff-${id}`} value={value} onChange={e=>onChange(id,e.target.value)} {...props}/></div></div>
}
function ProfileSelect({id,label,value,onChange,children,...props}){
  return <div className="field"><label className="field-label" htmlFor={`staff-${id}`}>{label}</label>
    <select id={`staff-${id}`} value={value} onChange={e=>onChange(id,e.target.value)} {...props}>{children}</select></div>
}

// Staff profile — same layout as the patient Profile page (PatientProfilePage.jsx).
function Profile({active,staff,load,onNavigate}) {
  const [draft,setDraft]=useState({...EMPTY_PROFILE})
  const [error,setError]=useState(''),[success,setSuccess]=useState(''),[busy,setBusy]=useState(false)
  function set(k,v){setDraft(d=>({...d,[k]:v}))}
  async function register(e){e.preventDefault();setBusy(true);setError('');setSuccess('');try{
    let data=await api('/staff',{method:'POST',body:draft});await load();setDraft({...EMPTY_PROFILE});setSuccess(data.staff.role==='Burn specialist'?'Specialist profile submitted. Your professional credentials are awaiting review by the BurnCare team.':'Staff profile created successfully. Burn Entry and Burn History are now available.')
  }catch(err){setError(err.message)}finally{setBusy(false)}}
  async function switchTo(id){setError('');setSuccess('');try{await api('/staff/select',{method:'POST',body:{staff_id:id}});await load();setSuccess('Staff profile selected.')}catch(err){setError(err.message)}}
  return <div className="profile-page">
    {/* ===== Header ===== */}
    <header className="profile-header">
      <span className="profile-avatar" aria-hidden="true">{initialsOf(active?.name)}</span>
      <div><h1>Profile</h1><p>{active?`${active.role} · ${active.organization}`:'Create your healthcare staff profile to start using the staff workspace.'}</p></div>
    </header>

    {/* ===== Current profile + switch ===== */}
    {active&&<section className="patient-card profile-card" aria-labelledby="current-title">
      <h2 id="current-title">Current profile</h2>
      <div className="profile-fields">
        <div className="profile-pair">
          <ProfileInput id="current-id" label="Staff ID" value={active.id} onChange={()=>{}} readOnly/>
          <ProfileInput id="current-approval" label="Approval" value={active.approval} onChange={()=>{}} readOnly/>
        </div>
        {staff.length>0&&<ProfileSelect id="switch" label="Switch profile" value={active?.id||''} onChange={(_,v)=>switchTo(v)}>
          {staff.map(p=><option key={p.id} value={p.id}>{p.name} — {p.role}{p.approval==='Waiting for approval'?' (awaiting approval)':''}</option>)}
        </ProfileSelect>}
      </div>
      <p className="patient-note">Consultations: {active.role==='Burn specialist'&&active.approval==='Approved'?'enabled for this profile.':'approved burn specialists only.'} Emergency ambulance: 997.</p>
    </section>}
    {!active&&staff.length>0&&<section className="patient-card profile-card" aria-labelledby="select-title">
      <h2 id="select-title">Select a staff profile</h2>
      <div className="profile-fields"><ProfileSelect id="select" label="Staff profile" value="" onChange={(_,v)=>switchTo(v)}>
        <option value="" disabled>Choose a profile</option>
        {staff.map(p=><option key={p.id} value={p.id}>{p.name} — {p.role}{p.approval==='Waiting for approval'?' (awaiting approval)':''}</option>)}
      </ProfileSelect></div>
    </section>}

    {/* ===== Create a profile ===== */}
    <form onSubmit={register}>
      <section className="patient-card profile-card" aria-labelledby="create-title">
        <h2 id="create-title">{active?'Create another staff profile':'Create healthcare staff profile'}</h2>
        <div className="profile-fields">
          <ProfileInput id="name" label="Full name" required maxLength="100" value={draft.name} onChange={set} placeholder="Staff full name"/>
          <ProfileSelect id="role" label="Professional role" required value={draft.role} onChange={set}>{ROLES.map(r=><option key={r}>{r}</option>)}</ProfileSelect>
          <ProfileInput id="organization" label="Hospital / organization" required maxLength="120" value={draft.organization} onChange={set} placeholder="Hospital or burn unit"/>
          <div className="profile-pair">
            <ProfileInput id="department" label="Department" optional maxLength="120" value={draft.department} onChange={set}/>
            <ProfileInput id="email" label="Email" optional type="email" maxLength="140" value={draft.email} onChange={set}/>
          </div>
          {draft.role==='Burn specialist'&&<>
            <p className="patient-note">Specialist verification is required before the Consultations page becomes available.</p>
            <div className="profile-pair">
              <ProfileSelect id="specialty" label="Specialty" required value={draft.specialty} onChange={set}><option value="">Choose specialty</option><option>Burn surgery</option><option>Plastic surgery</option></ProfileSelect>
              <ProfileInput id="license_number" label="SCFHS license number" required maxLength="80" value={draft.license_number} onChange={set}/>
            </div>
          </>}
        </div>
      </section>
      <div className="profile-save">
        {error&&<p className="field-error" role="alert">{error}</p>}
        <button type="submit" className="button button-primary profile-save-button" disabled={busy}>{busy?'Saving…':'Create staff profile'}</button>
        {success&&<p className="profile-saved" role="status">{success}</p>}
      </div>
    </form>

    {/* ===== Quick actions ===== */}
    {active&&<section className="patient-card profile-account" aria-label="Quick actions">
      <button type="button" className="profile-account-link" style={{...NAV_BUTTON,width:'100%'}} onClick={()=>onNavigate('entry')}><span>New burn assessment</span><span aria-hidden="true">›</span></button>
      <button type="button" className="profile-account-link" style={{...NAV_BUTTON,width:'100%'}} onClick={()=>onNavigate('history')}><span>Patient report history</span><span aria-hidden="true">›</span></button>
    </section>}
  </div>
}
function Entry({onSaved, active}) {
  return (
    <AssessmentForm
      api={api}
      onSaved={onSaved}
      active={active}
    />
  );
}

function Pair({label,value}){return <div className="pair"><small>{label}</small><strong>{fmt(value)}</strong></div>}
function ClinicalEditor({report,onSaved,onCancel}) {
  const original = report
  const [draft,setDraft]=useState({
    patient_code:report.patient_code,injury_date:report.injury_date,age:String(report.age),pain:String(report.pain),
    mechanism:report.mechanism,time_since:report.time_since,diabetes:report.diabetes,
    medical_history:report.medical_history||'',notes:report.notes||'',
    tbsa_final:String(report.tbsa_final),reason:''
  })
  const [emergency,setEmergency]=useState({...report.emergency})
  const [supplemental,setSupplemental]=useState({...report.supplemental,conditions:[...(report.supplemental?.conditions||[])]})
  const [regions,setRegions]=useState([...report.regions])
  const [confirmed,setConfirmed]=useState(false)
  const [error,setError]=useState(''),[busy,setBusy]=useState(false)
  const estimate=useMemo(()=>calculateTBSA(draft.age,regions),[draft.age,regions])
  const mapChanged=Number(draft.age)!==report.age||JSON.stringify([...regions].sort())!==JSON.stringify([...report.regions].sort())
  function set(k,value){setDraft(d=>({...d,[k]:value}))}
  async function submit(e){
    e.preventDefault();setError('')
    if(!regions.length){setError('Select at least one affected region on the body map.');return}
    if(mapChanged&&!confirmed){setError('Review and confirm the documented TBSA after changing the age or burn location.');return}
    if(draft.reason.trim().length<3){setError('Enter a reason for the clinical correction.');return}
    setBusy(true)
    try {
      const data=await api(`/reports/${encodeURIComponent(original.report_id)}/clinical`,{
        method:'PATCH',body:{...draft,age:Number(draft.age),pain:Number(draft.pain),
          regions,emergency,supplemental,tbsa_final:Number(draft.tbsa_final),tbsa_reviewed:mapChanged?confirmed:true,expected_revision:report.revision}
      })
      onSaved(data.report)
    } catch(err){setError(err.message)}finally{setBusy(false)}
  }
  return <section className="correction-panel" aria-label="Edit clinical information">
    <div className="correction-heading"><div><small className="eyebrow">CLINICIAN CORRECTION</small><h3>Edit Clinical Information</h3><p className="tiny-muted">Previous entries remain accessible in the correction history. Every saved change is attributed to the selected staff profile.</p></div><button type="button" className="btn secondary" onClick={onCancel}>Cancel</button></div>
    <form onSubmit={submit}>
      <div className="form-grid">
        <Field label="Patient reference code" required><input required pattern="[A-Za-z0-9_-]{3,30}" maxLength="30" value={draft.patient_code} onChange={e=>set('patient_code',e.target.value)}/></Field>
        <Field label="Date of injury" required><input type="date" required max={TODAY()} value={draft.injury_date} onChange={e=>set('injury_date',e.target.value)}/></Field>
        <Field label="Age (years)" required><input type="number" required min="0" max="120" step="1" value={draft.age} onChange={e=>set('age',e.target.value)}/></Field>
        <Field label="Pain level (0–10)" required><select required value={draft.pain} onChange={e=>set('pain',e.target.value)}>{Array.from({length:11},(_,i)=><option key={i} value={String(i)}>{i}</option>)}</select></Field>
        <Field label="Burn mechanism" required><select required value={draft.mechanism} onChange={e=>set('mechanism',e.target.value)}>{MECHANISMS.map(x=><option key={x}>{x}</option>)}</select></Field>
        <Field label="Time since injury" required><select required value={draft.time_since} onChange={e=>set('time_since',e.target.value)}>{TIME.map(x=><option key={x}>{x}</option>)}</select></Field>
        <Field label="Diabetes status" required><select required value={draft.diabetes} onChange={e=>set('diabetes',e.target.value)}>{['Non-Diabetic','Diabetic','Unknown'].map(x=><option key={x}>{x}</option>)}</select></Field>
        <Field label="Relevant medical history"><textarea rows="3" maxLength="700" value={draft.medical_history} onChange={e=>set('medical_history',e.target.value)}/></Field>
        <Field label="Clinical notes"><textarea rows="3" maxLength="1000" value={draft.notes} onChange={e=>set('notes',e.target.value)}/></Field>
      </div>
      <div className="clinical-screening-edit">
        <h4>Emergency screening and additional clinical questions</h4>
        <p className="tiny-muted">Review answers submitted during the original assessment. Changes are preserved in the clinical correction history.</p>
        <div className="form-grid">
          {EMERGENCY_QUESTIONS.map(q=><Field label={q.label} key={q.key}><select value={emergency[q.key]||''} onChange={e=>setEmergency(prev=>({...prev,[q.key]:e.target.value}))}><option value="">Not recorded</option>{q.options.map(o=><option key={o}>{o}</option>)}</select></Field>)}
          {['circumferential','notHealed',...(Number(draft.age)<16?['childUnwell']:[])].map(key=><Field key={key} label={{circumferential:'Burn around a body part',notHealed:'Not healed after two weeks',childUnwell:'Child unwell or feverish'}[key]}><select value={supplemental[key]||''} onChange={e=>setSupplemental(prev=>({...prev,[key]:e.target.value}))}><option value="">Not recorded</option>{['Yes','No','Not sure'].map(o=><option key={o}>{o}</option>)}</select></Field>)}
        </div>
        <div className="clinical-conditions"><b>Relevant long-term conditions</b><div>{CONDITIONS.map(c=><label key={c}><input type="checkbox" checked={(supplemental.conditions||[]).includes(c)} onChange={()=>setSupplemental(prev=>({ ...prev,conditions:c==='None'?(prev.conditions||[]).includes('None')?[]:['None']:(prev.conditions||[]).includes(c)?prev.conditions.filter(x=>x!==c):[...(prev.conditions||[]).filter(x=>x!=='None'),c]}))}/>{c}</label>)}</div></div>
      </div>
      <div className="map-correction"><h4>Burn location · front and back body map</h4><p className="tiny-muted">Select the affected regions accurately. The original selection will be preserved in the audit history if changed.</p><BodyMap chosen={regions} setChosen={setRegions}/></div>
      <div className="tbsa-panels"><div><small>{Number(draft.age)<16?'Pediatric assessment':'Updated body map estimate'}</small><strong>{displayPercent(estimate.value)}</strong><span>{estimate.method}</span></div><div className="accent"><small>Current documented TBSA</small><strong>{displayPercent(original.tbsa_final)}</strong><span>Previously recorded value</span></div></div>
      <div className="form-grid spaced"><Field label="Clinician-confirmed TBSA (%)" required tip="Review this value whenever age or affected regions change. Pediatric values must come from a clinician-led method."><input type="number" required min="0.01" max="100" step="0.01" value={draft.tbsa_final} onChange={e=>set('tbsa_final',e.target.value)}/></Field>
        <Field label="Reason for correction" required><textarea required minLength="3" maxLength="500" rows="2" value={draft.reason} onChange={e=>set('reason',e.target.value)} placeholder="Describe the clinical finding that required correction"/></Field></div>
      {mapChanged&&<label className="correction-confirm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} required/><span>I have reviewed the TBSA after changing age or affected body regions.</span></label>}
      <Msg error={error}/><div className="submit-line"><small>Corrections will be time-stamped; previous values cannot be overwritten in the audit history.</small><button className="btn primary" disabled={busy} type="submit">{busy?'Saving changes…':'Save Clinical Corrections'}</button></div>
    </form>
  </section>
}
function ClinicalAudit({items}) {
  const labels={patient_code:'Patient reference',age:'Age',pain:'Pain level',mechanism:'Burn mechanism',time_since:'Time since injury',
    diabetes:'Diabetes status',regions:'Affected body regions',medical_history:'Medical history',
    notes:'Clinical notes',emergency:'Emergency screening',supplemental:'Additional questions',injury_date:'Injury date',tbsa_estimate:'Body map TBSA estimate',
    tbsa_method:'TBSA method',tbsa_final:'Documented TBSA'}
  const display=(field,x)=>field==='emergency'||field==='supplemental'?JSON.stringify(x,null,1):field==='regions'?(x||[]).map(r=>names[r]||r).join(', ')||'None':
    field.startsWith('tbsa_')&&field!=='tbsa_method'&&x!==null?displayPercent(x):fmt(x)
  return <div className="audit clinical-audit"><h4>Clinical correction history</h4>{items.length===0?<p className="tiny-muted">No corrections have been made to these inputs.</p>:items.map(item=><div key={item.id} className="clinical-change"><div className="audit-top"><b>{dateFmt(item.changed_at)}</b><small>Staff ID: {item.clinician_id}</small></div><p><b>Reason:</b> {item.reason}</p><div className="change-grid">{Object.entries(item.changes).map(([field,change])=><div key={field} className="change-row"><strong>{labels[field]||field}</strong><span><small>Original</small>{display(field,change.before)}</span><span><small>Updated</small>{display(field,change.after)}</span></div>)}</div></div>)}</div>
}
function History({active,jump,clearJump}){
  const [reports,setReports]=useState([]),[query,setQuery]=useState(''),[lookup,setLookup]=useState(''),[current,setCurrent]=useState(null),[error,setError]=useState(''),[success,setSuccess]=useState(''),[busy,setBusy]=useState(false)
  const [tbsa,setTbsa]=useState(''),[reason,setReason]=useState(''),[question,setQuestion]=useState(''),[editingClinical,setEditingClinical]=useState(false)
async function refresh() {
  try {
    const data = await api('/reports');
    setReports(data.reports);
  } catch (err) {
    setError(err.message);
  }
}
  async function open(id){setError('');setSuccess('');setBusy(true);try{const data=await api('/reports/'+encodeURIComponent(id.trim()));setCurrent(data.report);setTbsa(data.report.tbsa_final);setReason('');setLookup(id);setEditingClinical(false);await refresh()}catch(err){setCurrent(null);setError(err.message)}finally{setBusy(false)}}
  useEffect(()=>{refresh()},[]);useEffect(()=>{if(jump){open(jump);clearJump()}},[jump]);
  async function edit(e){e.preventDefault();setError('');setSuccess('');try{const data=await api('/reports/'+encodeURIComponent(current.report_id)+'/tbsa',{method:'PATCH',body:{tbsa:Number(tbsa),reason,expected_revision:current.revision}});setCurrent(data.report);setSuccess('TBSA adjustment saved with clinician ID, previous value, updated value and timestamp.');setReason('');refresh()}catch(err){setError(err.message)}}
  async function ask(e){e.preventDefault();setError('');setSuccess('');try{await api('/reports/'+encodeURIComponent(current.report_id)+'/consultations',{method:'POST',body:{question}});setQuestion('');await open(current.report_id);setSuccess('Consultation added to the shared specialist waiting list.') }catch(err){setError(err.message)}}
  const filtered=reports.filter(r=>(r.report_id+' '+r.patient_code+' '+r.mechanism).toLowerCase().includes(query.toLowerCase()))
  return <><Heading tag="HEALTHCARE STAFF / REPORTS" title="Burn History" subtitle="Open a patient-shared assessment using its unique Report ID, review clinical data or ask a burn specialist." action={<span className="top-tag">Report ID lookup</span>}/>
    <div className="stat-grid"><div className="stat"><small>Saved cases</small><strong>{reports.length}</strong><span>Flask database records</span></div><div className="stat"><small>Treatment destinations</small><strong>3</strong><span>Pending medical model integration</span></div><div className="stat"><small>Emergency number</small><strong>997</strong><span>Saudi ambulance</span></div></div>
    <Card num="⌕" title="Find a report" description="Type the exact UUID. If no report exists, BurnCare shows “Record not found”."><form className="lookup" onSubmit={e=>{e.preventDefault();open(lookup)}}><input required value={lookup} onChange={e=>setLookup(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"/><button className="btn primary" disabled={busy}>{busy?'Searching…':'Find Report'}</button></form></Card>
    <Card num="▤" title="Saved assessment records" description="Open a stored case to see its clinical inputs, photograph, TBSA and consultation replies."><input className="search-filter" placeholder="Filter by Report ID, patient code or mechanism" value={query} onChange={e=>setQuery(e.target.value)}/>{filtered.length?filtered.map(r=><button type="button" onClick={()=>open(r.report_id)} key={r.report_id} className="record-row"><span className="record-symbol">✚</span><span className="record-main"><b>{r.patient_code}</b><small>{r.report_id}</small><small>{r.mechanism} · {dateFmt(r.created_at)}</small></span><span className="record-meta"><b>{displayPercent(r.tbsa_final)}</b><small>View case →</small></span></button>):<p className="empty">No assessment records found.</p>}</Card>{!current&&<Msg error={error} success={success}/>}
    {current&&<section className="card case-details"><div className="case-head"><div><small className="eyebrow">PATIENT REPORT / CASE RECORD</small><h2>{current.patient_code}</h2><code>{current.report_id}</code></div><button className="btn secondary" onClick={()=>setCurrent(null)}>Close ×</button></div><Msg error={error} success={success}/>
      <div className="section-action"><h3>Clinical information</h3><button className="btn secondary" type="button" onClick={()=>setEditingClinical(v=>!v)}>{editingClinical?'Close Editor':'✎ Edit Clinical Information'}</button></div>
      {editingClinical&&<ClinicalEditor key={`${current.report_id}-${current.revision}`} report={current} onCancel={()=>setEditingClinical(false)} onSaved={next=>{setCurrent(next);setTbsa(next.tbsa_final);setEditingClinical(false);setSuccess('Clinical corrections saved. The original values, staff ID, reason and timestamp are recorded.');refresh()}}/>}
      <div className="pairs"><Pair label="Patient age" value={current.age}/><Pair label="Pain level" value={`${current.pain}/10`}/><Pair label="Burn mechanism" value={current.mechanism}/><Pair label="Time since injury" value={current.time_since}/><Pair label="Diabetes status" value={current.diabetes}/><Pair label="Affected regions" value={current.regions.map(x=>names[x]||x).join(', ')}/><Pair label="TBSA estimate" value={displayPercent(current.tbsa_estimate)}/><Pair label="Documented TBSA" value={displayPercent(current.tbsa_final)}/><Pair label="Recorded by staff ID" value={current.created_by}/><Pair label="Injury date" value={current.injury_date}/></div>
      {current.medical_history&&<p><b>Medical history:</b> {current.medical_history}</p>}{current.notes&&<p><b>Clinical notes:</b> {current.notes}</p>}
      {Object.keys(current.emergency||{}).length>0&&<div className="record-screening"><h3>Emergency screening responses</h3><div className="pairs">{EMERGENCY_QUESTIONS.map(q=><Pair key={q.key} label={q.label} value={current.emergency[q.key]||'Not answered'}/>)}</div></div>}
      {Object.keys(current.supplemental||{}).length>0&&<div className="record-screening"><h3>Additional clinical questions</h3><div className="pairs"><Pair label="Circumferential burn" value={current.supplemental.circumferential}/><Pair label="Long-term conditions" value={(current.supplemental.conditions||[]).join(', ')}/><Pair label="Not healed after two weeks" value={current.supplemental.notHealed}/>{current.age<16&&<Pair label="Child unwell or feverish" value={current.supplemental.childUnwell}/>}</div></div>}
      <ClinicalAudit items={current.clinical_audit||[]}/>
      {current.clinical_audit?.length>0&&current.consultations?.some(c=>c.status==='Answered'&&c.answered_revision!=null&&c.answered_revision<current.revision)&&<div className="assessment-pending"><b>Case information has changed since a specialist response.</b><p>Review the updated findings and request fresh specialist advice if necessary. Older replies remain available for reference.</p></div>}
      <h3>Burn image and AI supporting information</h3><div className="media-row"><img alt="Saved burn photograph" src={`/staff/api/reports/${encodeURIComponent(current.report_id)}/image`}/><div className="ai-placeholder"><span>✣</span><b>Grad-CAM · supporting information</b><p>Unavailable until model integration. When provided, this overlay will indicate regions influencing the AI prediction; it is not a measure of burn severity.</p></div></div>
      <h3>BurnCare treatment destination</h3><TreatmentChoices destination={current.destination}/><div className="assessment-pending"><b>Treatment recommendation not available.</b><p>No treatment destination, burn-depth prediction or model confidence is available until the decision engine has been validated and integrated.</p></div>
      <div className="first-aid"><div><b>First-aid information</b><p>Cool the burn under cool running water for 20 minutes. Remove nearby tight items if not stuck to skin, and cover loosely with a clean, non-stick covering. Do not apply ice or oils. Seek prompt professional assessment for concerning injuries.</p></div><div className="emergency">Ambulance<br/><strong>997</strong></div></div>
      <a className="btn primary download-link" target="_blank" rel="noreferrer" href={`/staff/api/reports/${encodeURIComponent(current.report_id)}/pdf`}>↓ Download case report (PDF)</a>
      <div className="line"/><h3>Review or adjust TBSA</h3><p className="tiny-muted">Each adjustment records the original value, new value, staff identifier, reason and timestamp.</p>
      <form onSubmit={edit} className="form-grid"><Field label="Updated TBSA (%)" required><input required min="0.01" max="100" step="0.01" type="number" value={tbsa} onChange={e=>setTbsa(e.target.value)}/></Field><Field label="Reason for adjustment" required><input required minLength="3" maxLength="250" value={reason} onChange={e=>setReason(e.target.value)}/></Field><button className="btn primary full-field">Save TBSA adjustment</button></form>
      {current.audit.length>0&&<div className="audit"><h4>TBSA audit log</h4>{current.audit.map(x=><div key={x.id}><b>{displayPercent(x.old_value)} → {displayPercent(x.new_value)}</b><small>{x.clinician_id} · {dateFmt(x.changed_at)} · {x.reason}</small></div>)}</div>}
      <div className="line"/><h3>Ask a burn specialist</h3>{active.role==='Burn specialist'?<p className="tiny-muted">Approved burn specialists respond to incoming cases on the dedicated Consultations page.</p>:<form onSubmit={ask}><Field label="Your question for the specialist" required><textarea required minLength="1" maxLength="1200" rows="3" value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Describe what advice you need about this burn case…"/></Field><button className="btn primary" type="submit">Send to shared consultation queue →</button></form>}
      <h4>Consultation activity</h4>{current.consultations?.length?current.consultations.map(c=><div className="consultation-line" key={c.id}><span className="status">{c.status}</span><p><b>Question:</b> {c.question}</p>{c.advice&&<p><b>Specialist response:</b> {c.advice}</p>}<small>{dateFmt(c.created_at)} · {c.claimed_by?`Claimed by ${c.claimed_by}`:'Not yet claimed'}</small></div>):<p className="tiny-muted">No consultation requests for this case yet.</p>}
    </section>}
  </>
}
function Consultations({active,onOpenCase}){
  const [queue,setQueue]=useState([]),[error,setError]=useState(''),[success,setSuccess]=useState(''),[advice,setAdvice]=useState({})
  async function refresh(){try{const data=await api('/consultations');setQueue(data.consultations);setError('')}catch(err){setError(err.message)}}
  useEffect(()=>{refresh()},[active.id])
  async function action(path,body){try{await api(path,{method:'POST',body});setSuccess('Consultation updated.');refresh()}catch(err){setError(err.message)}}
  const waiting=queue.filter(x=>x.status==='Waiting').length
  return <><Heading tag="HEALTHCARE STAFF / SPECIALIST ONLY" title="Specialist Consultations" subtitle="One shared waiting list. The first approved burn specialist to claim a case becomes its reviewer." action={<span className="top-tag">Approved specialists only</span>}/><div className="stat-grid"><div className="stat"><small>Waiting requests</small><strong>{waiting}</strong><span>Available to claim</span></div><div className="stat"><small>Claimed cases</small><strong>{queue.filter(x=>x.status==='Claimed').length}</strong><span>Reserved by a specialist</span></div><div className="stat"><small>Answered cases</small><strong>{queue.filter(x=>x.status==='Answered').length}</strong><span>Replies visible to requesting staff</span></div></div><Msg error={error} success={success}/>
    <Card num="✣" title="Shared on-call consultation queue" description="Claim a waiting case, examine its report, then enter advice. Another specialist cannot take your claimed case.">
      {queue.length===0&&<p className="empty">No specialist consultations have been requested yet.</p>}
      {queue.map(c=><div key={c.id} className="queue-row"><div className="queue-top"><div><span className="status">{c.status}</span><h3>{c.patient_code}</h3><small className="monospace">Report ID: {c.report_id}</small></div><button className="btn secondary" onClick={()=>onOpenCase(c.report_id)}>View case →</button></div><p><b>Question:</b> {c.question}</p><small>Submitted {dateFmt(c.created_at)}</small>{c.status==='Waiting'&&<button className="btn primary" onClick={()=>action(`/consultations/${c.id}/claim`)}>Take this case</button>}{c.status==='Claimed'&&c.claimed_by===active.id&&<form onSubmit={e=>{e.preventDefault();action(`/consultations/${c.id}/reply`,{advice:advice[c.id]||''})}}><Field label="Specialist advice" required><textarea required maxLength="2500" rows="3" value={advice[c.id]||''} onChange={e=>setAdvice(a=>({...a,[c.id]:e.target.value}))} placeholder="Advice and suggested next steps for clinician review…"/></Field><button className="btn primary">Submit specialist response →</button></form>}{c.status==='Claimed'&&c.claimed_by!==active.id&&<div className="claim-warning">This case is already reserved by another specialist.</div>}{c.status==='Answered'&&<div className="consultation-line"><b>Specialist response</b><p>{c.advice}</p><small>Answered {dateFmt(c.answered_at)} by {c.claimed_by}</small></div>}</div>)}
    </Card><div className="disclaimer">Consultation access is restricted by role and approval status. Secure identity verification and access controls are required before handling real patient information.</div>
  </>
}
// Profile picture + name in the top bar, with "My profile" and "Log out" (like the patient pages).
function AccountMenu({active,onProfile}){
  const [open,setOpen]=useState(false),ref=useRef(null),navigate=useNavigate()
  useEffect(()=>{if(!open)return undefined
    const click=e=>{if(!ref.current?.contains(e.target))setOpen(false)},key=e=>{if(e.key==='Escape')setOpen(false)}
    document.addEventListener('mousedown',click);document.addEventListener('keydown',key)
    return()=>{document.removeEventListener('mousedown',click);document.removeEventListener('keydown',key)}},[open])
  return <div className="patient-account" ref={ref}>
    <button type="button" className={`account-button${open?' is-open':''}`} onClick={()=>setOpen(o=>!o)} aria-haspopup="menu" aria-expanded={open}>
      <span className="patient-avatar" aria-hidden="true">{initialsOf(active?.name)}</span>
      <span className="patient-name">{active?.name||'Staff'}</span>
      <svg className="account-caret" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </button>
    {open&&<div className="account-menu" role="menu">
      <div className="account-menu-head"><span className="patient-avatar" aria-hidden="true">{initialsOf(active?.name)}</span>
        <div><p className="account-menu-name">{active?.name||'No profile selected'}</p><p className="account-menu-email">{active?.role||'Create your profile'}</p></div></div>
      <button type="button" className="account-menu-item" role="menuitem" onClick={()=>{setOpen(false);onProfile()}}>My profile</button>
      <button type="button" className="account-menu-item account-menu-logout" role="menuitem" onClick={async()=>{await logOut();navigate('/login',{replace:true})}}>Log out</button>
    </div>}
  </div>
}

function App(){
 const [page,setPage]=useState('profile'),[active,setActive]=useState(null),[staff,setStaff]=useState([]),[error,setError]=useState(''),[jump,setJump]=useState('')
 async function load(){try{const data=await api('/staff');setActive(data.active);setStaff(data.staff);setError('')}catch(e){setError(e.message)}}
 useEffect(()=>{load()},[])
 function go(p){setPage(p);window.scrollTo({top:0,behavior:'smooth'})}
 function openCase(id){setJump(id);go('history')}
 const approved=active?.role==='Burn specialist'&&active?.approval==='Approved'
 const links=[['entry','Burn entry'],['history','Burn history'],...(approved?[['consultations','Consultations']]:[])]
 return <div className="site-shell patient-shell">
  {/* ===== 1. Top bar (same as the patient pages) ===== */}
  <header className="patient-header"><div className="patient-header-inner">
    <button type="button" className="brand" style={NAV_BUTTON} onClick={()=>go('profile')} aria-label="BurnCare staff profile">
      <img className="brand-logo" src="/burncare-logo.png" alt="" width="36" height="38"/><span className="brand-name">BurnCare</span>
    </button>
    <div className="patient-nav" role="navigation" aria-label="Staff menu">
      {links.map(([key,label])=><button key={key} type="button" disabled={!active} style={NAV_BUTTON}
        className={`patient-nav-link${page===key?' is-active':''}`} onClick={()=>go(key)}>{label}</button>)}
    </div>
    <AccountMenu active={active} onProfile={()=>go('profile')}/>
  </div></header>

  {/* ===== 2. The page ===== */}
  <main id="main-content" className="patient-main">
    {page==='profile'
      ?<div className="patient-page">{error&&<p className="field-error" role="alert">{error}</p>}<Profile active={active} staff={staff} load={load} onNavigate={go}/></div>
      :<div className="staff-portal"><div className="content">{error&&<div className="notice error">{error}</div>}
        {!active?<div className="card"><h2>Staff profile required</h2><p>Create or select a healthcare staff profile to continue.</p><button className="btn primary" onClick={()=>go('profile')}>Go to Profile</button></div>
        :<>{page==='entry'&&<Reveal><Entry active={active} onSaved={(id,view)=>{if(view)openCase(id)}}/></Reveal>} {page==='history'&&<History active={active} jump={jump} clearJump={()=>setJump('')}/>} {page==='consultations'&&(approved?<Consultations active={active} onOpenCase={openCase}/>:<div className="notice error">Access restricted to approved burn specialists.</div>)}</>}
      </div></div>}
  </main>

  {/* ===== 3. Disclaimer ===== */}
  <footer className="site-footer"><div className="footer-inner"><div className="footer-fineprint">
    <p>BurnCare is a clinical decision-support tool. It does not diagnose burns, prescribe treatment, or decide whether surgery is required.</p>
    <p>Use test information only. Emergency ambulance in Saudi Arabia: 997.</p>
  </div></div></footer>
 </div>
}
export default App