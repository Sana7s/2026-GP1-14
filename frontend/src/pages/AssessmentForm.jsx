/**
 * BurnCare shared assessment — integrated staff edition.
 * Adapted from the supplied AssessmentForm.jsx and AssessmentForm.css.
 * Preserves emergency check / contextual questions / photo picker / report presentation;
 * replaces the unfinished body map, client-side Report ID, mock triage logic, and login
 * link with the existing Flask API and working React body map.
 */
import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import { prefersReducedMotion } from "../components/animations.jsx";
import { Chevron } from "../components/Chevron.jsx";
import './healthcare-staff/components/AssessmentForm.css';
import './healthcare-staff/components/assessment-staff.css';
import TbsaCalculator from '../components/TbsaCalculator.jsx';
export const EMERGENCY_QUESTIONS = [
 {key:'breathing',label:'Is the person struggling to breathe, or does their voice sound rough?',options:['Yes','No','Not sure']},
 {key:'smoke',label:'Did the burn happen in a fire inside a room or car, or is there black soot around the nose or mouth?',options:['Yes','No','Not sure']},
 {key:'responsive',label:'Is the person not awake, or not responding normally?',options:['Yes','No']}
];
export const CONDITIONS = ['Diabetes','Heart or blood vessel disease','Kidney disease','Weak immune system','Other','None'];
export const BURN_CAUSES = ['Hot liquid or steam','Fire or flame','Hot object','Electricity','Chemical','Friction','Cold injury (frostbite)','Sun','Other'];
const TIMES = ['Less than 2 hours','2 to 6 hours','6 to 24 hours','More than 24 hours'];
const EMPTY_EMERGENCY = {breathing:'',smoke:'',responsive:''};
const EMPTY_EXTRAS = {circumferential:'',conditions:[],notHealed:'',childUnwell:''};
const emptyCase = () => ({patient_code:'',injury_date:new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10),age:'',pain:'',mechanism:'',time_since:'',diabetes:'',medical_history:'',notes:'',tbsa_final:'',tbsa_reason:''});
const risky = state => Object.values(state).some(v=>v==='Yes'||v==='Not sure');
const percentage = number => number == null?'Not calculated':`${Number(number).toFixed(2).replace(/\.?0+$/,'')}%`;

function Choices({value,options,onChange,multiple=false}){
 return <div className="assessment-choices" role="group">{options.map(option=><button type="button" aria-pressed={multiple?value.includes(option):value===option} key={option}
 className={`assessment-choice ${(multiple?value.includes(option):value===option)?'is-selected':''}`} onClick={()=>onChange(option)}>{option}</button>)}</div>;
}
function CheckField({title,children,sub}){return <div className="assessment-question"><label className="field-label">{title} <span className="required-mark">*</span></label>{sub&&<p className="assessment-hint">{sub}</p>}{children}</div>}
function VoiceControl({onValue,field}){
 const [listening,setListening]=useState(false);const [error,setError]=useState('');
 function start(){const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!Speech){setError('Speech recognition requires a supported browser such as Chrome.');return}
  const recognition=new Speech();recognition.lang='en-US';recognition.interimResults=false;
  recognition.onresult=e=>{onValue(e.results[0][0].transcript);setError('')};recognition.onerror=()=>{setError('Speech recognition was unsuccessful. Enter the value manually.')};recognition.onend=()=>setListening(false);
  setListening(true);try{recognition.start()}catch{setListening(false);setError('Microphone unavailable.')}
 }
 return <div className="assessment-voice"><button type="button" className="assessment-voice-btn" onClick={start} aria-label={`Speak ${field}`}>{listening?'● Listening':'♫ Speak'}</button>{error&&<small role="status">{error}</small>}</div>;
}
function EmergencyModal({close}){
 const button=useRef(null);useEffect(()=>{button.current?.focus();const onKey=e=>{if(e.key==='Escape')close()};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[close]);
 return createPortal(<div className="assessment-modal-overlay" role="presentation"><div className="assessment-modal" role="alertdialog" aria-modal="true" aria-labelledby="emergency-title">
  <span className="assessment-danger-icon">!</span><h2 id="emergency-title">Possible emergency signs</h2>
  <p>These answers may indicate an urgent medical emergency. Contact emergency services immediately. Do not wait for an online assessment.</p>
  <div className="assessment-emergency-number">Saudi ambulance: <strong>997</strong></div>
  <button ref={button} type="button" className="button button-primary" onClick={close}>I understand</button>
 </div></div>,document.body);
}
function PhotoUpload({image,setImage,preview}){
 const ref=useRef(null),[drag,setDrag]=useState(false);
 const select=file=>{if(file)setImage(file)};
 return <div className="assessment-photo"><div className="guest-step-head"><span className="guest-step-label">STEP 2</span><h2 className="guest-step-title">Burn photograph</h2></div>
  <p className="assessment-hint">Use a clear photograph. Accepted formats: JPEG or PNG, maximum 5 MB.</p>
  <div className={`assessment-file-box ${drag?'is-dragging':''}`} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);select(e.dataTransfer.files?.[0])}}>
  <button type="button" className="assessment-file-trigger" onClick={()=>ref.current?.click()}><span className="assessment-upload-icon">⇧</span><b>{image?image.name:'Choose or drop a burn photograph'}</b><small>JPG or PNG · Up to 5 MB</small></button>
  <input ref={ref} type="file" accept="image/jpeg,image/png" aria-label="Burn photograph" required={!image} className="assessment-file-input" onChange={e=>select(e.target.files?.[0])}/>
  {image&&<button type="button" className="text-link" onClick={()=>{setImage(null);ref.current.value=''}}>Remove photograph</button>}</div>
  {preview&&<img src={preview} className="assessment-preview" alt="Selected burn photograph preview"/>}</div>;
}
export default function AssessmentForm({
  api, onSaved, active
}) {
 const [screen,setScreen]=useState('emergency'),[emergency,setEmergency]=useState({...EMPTY_EMERGENCY});
 const [form,setForm] = useState(emptyCase);
const [extra,setExtra] = useState({...EMPTY_EXTRAS});

const [map,setMap] = useState(null);
const [mapKey,setMapKey] = useState(0);
 const [image,setImage]=useState(null),[preview,setPreview]=useState(''),[showCall,setShowCall]=useState(false);
 const [problem,setProblem]=useState(''),[busy,setBusy]=useState(false),[record,setRecord]=useState(null);
const pediatric = form.age !== '' && Number(form.age) < 16;

const estimate = map?.total ?? null;

const tbsa = form.tbsa_final !== ''
  ? Number(form.tbsa_final)
  : estimate;
 useEffect(()=>{if(!image){setPreview('');return undefined}const url=URL.createObjectURL(image);setPreview(url);return()=>URL.revokeObjectURL(url)},[image]);
 const set=(key,val)=>setForm(old=>({...old,[key]:val}));
 const setE=(key,val)=>setExtra(old=>({...old,[key]:val}));
 function emergencyAnswer(key,value){setEmergency(old=>({...old,[key]:value}));if(value==='Yes'||value==='Not sure')setShowCall(true)}
 function toggleCondition(option){setExtra(old=>({...old,conditions:option==='None'?(old.conditions.includes('None')?[]:['None']):old.conditions.includes(option)?old.conditions.filter(i=>i!==option):[...old.conditions.filter(i=>i!=='None'),option]}))}
 const go=next=>{setProblem('');setScreen(next);window.scrollTo({top:0,behavior:prefersReducedMotion()?'auto':'smooth'})};
 function speak(key,text){const s=text.toLowerCase();if(key==='age'||key==='pain'){
   const spelled={zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10};
   const m=s.match(/\d+/);const num=m?m[0]:spelled[s.trim()];if(num!==undefined)set(key,String(num));return}
   if(key==='mechanism'){const val=BURN_CAUSES.find(x=>x.toLowerCase()===s||x.toLowerCase().includes(s)||s.includes(x.toLowerCase()));if(val)set(key,val);return}
   if(key==='time_since'){const val=TIMES.find(x=>x.toLowerCase().includes(s)||s.includes(x.toLowerCase()));if(val)set(key,val);return}
   if(key==='diabetes'){set(key,s.includes('unknown')?'Unknown':s.includes('not')||s.includes('non')||s==='no'?'Non-Diabetic':s.includes('diabetes')||s==='yes'?'Diabetic':'');return}
   set(key,text)
 }
 function toForm(){if(Object.values(emergency).some(v=>!v)){setProblem('Complete all three emergency screening questions.');return}go('form')}
   async function submit(e) {
    e.preventDefault();
    setProblem('');

    if (Object.values(emergency).some(value => !value)) {
      setProblem('Complete the emergency screening questions.');
      return;
    }

    if (
      !extra.circumferential ||
      extra.conditions.length === 0 ||
      !extra.notHealed ||
      (pediatric && !extra.childUnwell)
    ) {
      setProblem('Complete the additional clinical questions before submitting.');
      return;
    }

    if (!map?.breakdown?.length) {
      setProblem('Mark at least one burned area on the body map.');
      return;
    }

    if (
      !image ||
      !['image/jpeg', 'image/png'].includes(image.type) ||
      image.size === 0 ||
      image.size > 5 * 1024 * 1024
    ) {
      setProblem('Choose a JPEG or PNG photograph no larger than 5 MB.');
      return;
    }

    if (tbsa == null || !Number.isFinite(tbsa) || tbsa <= 0 || tbsa > 100) {
      setProblem('TBSA must be more than 0% and no more than 100%.');
      return;
    }

    if (
      Math.abs(tbsa - estimate) > 0.001 &&
      form.tbsa_reason.trim().length < 3
    ) {
      setProblem('Explain the clinical reason for adjusting the body-map estimate.');
      return;
    }

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('image', image);

      const bodyMap = map.breakdown.map(({ id, method, palms, touched }) => ({
        id,
        method,
        palms,
        touched,
      }));

      fd.append('data', JSON.stringify({
        ...form,
        age: Number(form.age),
        pain: Number(form.pain),
        bodyMap,
        tbsa_estimate: estimate,
        tbsa_final: tbsa,
        tbsa_method: map.chartLabel,
        emergency,
        supplemental: extra,
      }));

      const saved = await api('/assessments/staff', {
        method: 'POST',
        body: fd,
      });

      if (!saved?.report) {
        throw new Error('The server did not return a saved assessment report.');
      }

      setRecord(saved.report);
      onSaved?.(saved.report.id);
      go('report');
    } catch (error) {
      console.error('Failed to save BurnCare assessment:', error);
      setProblem(error instanceof Error ? error.message : 'Unable to save the assessment. Please try again.');
    } finally {
      setBusy(false);
    }
  }

 function restart() {
  setEmergency({...EMPTY_EMERGENCY});
  setExtra({...EMPTY_EXTRAS});
  setForm(emptyCase());
  setMap(null);
  setMapKey(k => k + 1);
  setImage(null);
  setRecord(null);
  go('emergency');
}
 const title=<div className="assessment-head"><small className="eyebrow">HEALTHCARE STAFF / ASSESSMENT</small><h1>Burn Entry</h1><p>Complete the emergency check, clinical questions, photograph, and TBSA body map to save an assessment.</p></div>;
 if(screen==='report'&&record)return <div className="assessment-surface">{title}<div className="guest-container report-container"><article className="report-paper">
  <div className="report-head"><div className="report-brand"><img src="/logo.jpeg" alt="BurnCare" className="report-logo"/><div><p className="report-brand-name">BurnCare</p><h2>Burn Assessment Report</h2></div></div></div>
  <dl className="report-meta"><div><dt>Report ID</dt><dd className="report-id">{record.report_id}</dd></div><div><dt>Date created</dt><dd>{new Date(record.created_at).toLocaleString()}</dd></div><div><dt>Recorded by</dt><dd>{active?.name||'Healthcare staff'}</dd></div></dl>
  <section className="report-decision is-pending"><p className="report-decision-label">Decision-support status</p><h2>Treatment recommendation unavailable</h2><p>The AI model and medical decision rules are not connected to this version. No treatment category is assigned to the assessment.</p></section>
  {risky(emergency)&&<div className="assessment-emergency-inline"><b>Emergency screening response recorded.</b> Call 997 for emergency assistance if there are urgent symptoms; do not wait for a model result.</div>}
  <section className="report-section"><h3>Clinical inputs</h3><dl className="report-rows">{[
   ['Patient reference',record.patient_code],['Age',`${record.age} years`],['Pain',`${record.pain}/10`],['Burn mechanism',record.mechanism],['Time since injury',record.time_since],['Diabetes status',record.diabetes],[
  'Affected body regions',
  map?.breakdown?.map(r => r.label).join(', ') || '—'
],['Documented TBSA',percentage(record.tbsa_final)],['Clinical conditions',extra.conditions.join(', ')],['Circumferential burn',extra.circumferential],['Not healed after two weeks',extra.notHealed]
  ].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>
  <section className="report-section"><h3>Burn image</h3>{preview&&<img className="assessment-preview" src={preview} alt="Uploaded burn photograph"/>}<p className="assessment-hint">Grad-CAM is supporting information; it requires integration with the trained AI model.</p></section>
  <footer className="report-foot">Report stored by Flask with a unique UUID. This system supports clinical documentation and does not replace professional assessment.</footer></article>
  <div className="assessment-actions"><button className="btn primary" type="button" onClick={()=>onSaved(record.report_id,true)}>Open in Burn History →</button><a className="btn secondary" href={`/staff/api/reports/${encodeURIComponent(record.report_id)}/pdf`} target="_blank" rel="noreferrer">Download PDF</a><button className="btn secondary" type="button" onClick={restart}>New assessment</button></div></div></div>;
 return <div className="assessment-surface">{title}{showCall&&<EmergencyModal close={()=>setShowCall(false)}/>}
  <div className="assessment-progress"><span className={screen==='emergency'?'current':''}>01 · Emergency check</span><span className={screen==='form'?'current':''}>02 · Assessment</span><span>03 · Report</span></div>
  {screen==='emergency'?<section className="assessment-panel guest-panel"><div className="guest-step-head"><span className="guest-step-label">EMERGENCY SCREENING</span><h2 className="guest-step-title">Three quick safety questions</h2></div><p className="assessment-hint">These responses are recorded with the case. When emergency signs are reported, contact emergency services immediately.</p>
   {EMERGENCY_QUESTIONS.map(q=><CheckField key={q.key} title={q.label}><Choices value={emergency[q.key]} options={q.options} onChange={v=>emergencyAnswer(q.key,v)}/></CheckField>)}
   <div className="assessment-actions"><button className="button button-primary" type="button" onClick={toForm}>Continue to assessment →</button></div>
   {risky(emergency)&&<div className="assessment-emergency-inline" role="alert"><b>Emergency sign identified.</b> Call 997 (Saudi ambulance) and seek immediate clinical evaluation.</div>}
   {problem&&<p className="field-error" role="alert">{problem}</p>}
  </section>:<form className="assessment-panel guest-panel" onSubmit={submit}>
    <section className="guest-step"><div className="guest-step-head"><span className="guest-step-label">STEP 1</span><h2 className="guest-step-title">Clinical questions — typed or spoken</h2></div>
      <div className="assessment-form-grid">
       <label className="field">Patient reference code <span className="required-mark">*</span><input required pattern="[A-Za-z0-9_-]{3,30}" maxLength="30" value={form.patient_code} onChange={e=>set('patient_code',e.target.value)} placeholder="Case reference"/></label>
       <label className="field">Date of injury <span className="required-mark">*</span><input type="date" required max={emptyCase().injury_date} value={form.injury_date} onChange={e=>set('injury_date',e.target.value)}/></label>
       <label className="field">Age (years) <span className="required-mark">*</span><input type="number" required min="0" max="120" step="1" value={form.age} onChange={e=>set('age',e.target.value)}/><VoiceControl field="age" onValue={v=>speak('age',v)}/></label>
       <label className="field">Pain level (0–10) <span className="required-mark">*</span><select required value={form.pain} onChange={e=>set('pain',e.target.value)}><option value="">Select pain level</option>{Array.from({length:11},(_,i)=><option key={i} value={i}>{i}</option>)}</select><VoiceControl field="pain" onValue={v=>speak('pain',v)}/></label>
       <label className="field">Burn mechanism <span className="required-mark">*</span><select required value={form.mechanism} onChange={e=>set('mechanism',e.target.value)}><option value="">Select cause</option>{BURN_CAUSES.map(c=><option key={c}>{c}</option>)}</select><VoiceControl field="burn mechanism" onValue={v=>speak('mechanism',v)}/></label>
       <label className="field">Time since injury <span className="required-mark">*</span><select required value={form.time_since} onChange={e=>set('time_since',e.target.value)}><option value="">Select time</option>{TIMES.map(t=><option key={t}>{t}</option>)}</select><VoiceControl field="time since injury" onValue={v=>speak('time_since',v)}/></label>
       <label className="field">Diabetes status <span className="required-mark">*</span><select required value={form.diabetes} onChange={e=>set('diabetes',e.target.value)}><option value="">Choose status</option>{['Non-Diabetic','Diabetic','Unknown'].map(c=><option key={c}>{c}</option>)}</select><VoiceControl field="diabetes status" onValue={v=>speak('diabetes',v)}/></label>
       <div className="field"><span>Burn location <span className="required-mark">*</span></span><small>Mark the affected areas on the TBSA body map in Step 3.</small></div>
      </div>
      <div className="assessment-extra"><CheckField title="Does the burn go all the way around an arm, leg, or other body part?"><Choices value={extra.circumferential} options={['Yes','No','Not sure']} onChange={v=>setE('circumferential',v)}/></CheckField>
       <CheckField title="Relevant long-term conditions"><Choices value={extra.conditions} multiple options={CONDITIONS} onChange={toggleCondition}/></CheckField>
       <CheckField title="Has the burn remained unhealed for more than two weeks?"><Choices value={extra.notHealed} options={['Yes','No','Not sure']} onChange={v=>setE('notHealed',v)}/></CheckField>
       {pediatric&&<CheckField title="Does the child seem unwell or have a fever?"><Choices value={extra.childUnwell} options={['Yes','No','Not sure']} onChange={v=>setE('childUnwell',v)}/></CheckField>}
      </div>
      <div className="assessment-form-grid"><label className="field">Relevant medical history <small>Optional</small><textarea rows="3" maxLength="700" value={form.medical_history} onChange={e=>set('medical_history',e.target.value)}/></label><label className="field">Clinical observations <small>Optional</small><textarea rows="3" maxLength="1000" value={form.notes} onChange={e=>set('notes',e.target.value)}/><VoiceControl field="clinical observations" onValue={v=>set('notes',v)}/></label></div>
    </section>
    <section className="guest-step"><PhotoUpload image={image} setImage={setImage} preview={preview}/></section>

   <section className="guest-step">
  <div className="guest-step-head">
    <span className="guest-step-label">STEP 3</span>
    <h2 className="guest-step-title">
      Total Body Surface Area (TBSA)
    </h2>
  </div>

  <p className="assessment-hint">
    Mark every burned area. The age chooses the chart:
    Lund and Browder for children under 16,
    Rule of Nines for adults.
  </p>

  <div className="assessment-map">
    <TbsaCalculator
      key={mapKey}
      age={form.age === '' ? null : Number(form.age)}
      depth={null}
      onChange={setMap}
    />
  </div>

  <div className="tbsa-panels">
    <div>
      <small>Body map estimate</small>
      <strong>{percentage(estimate)}</strong>
      <span>{map?.chartLabel || 'Enter the age first'}</span>
    </div>

    <div className="accent">
      <small>Documented TBSA</small>
      <strong>{percentage(tbsa)}</strong>
      <span>Clinician-reviewed value</span>
    </div>
  </div>

  <div className="assessment-form-grid">
    <label className="field">
      Adjusted TBSA (%) — optional
      <input
        min="0.01"
        max="100"
        step="0.01"
        type="number"
        value={form.tbsa_final}
        onChange={e => set('tbsa_final', e.target.value)}
        placeholder="Leave blank to use map estimate"
      />
    </label>

    <label className="field">
      Reason for TBSA adjustment
      <input
        maxLength="250"
        value={form.tbsa_reason}
        onChange={e => set('tbsa_reason', e.target.value)}
        placeholder="Explain the clinical adjustment, if any"
      />
    </label>
  </div>
</section>

    {risky(emergency)&&<div className="assessment-emergency-inline" role="alert"><b>Emergency screening flag:</b> Please seek immediate medical evaluation. Emergency ambulance: 997.</div>}
    {problem&&<p role="alert" className="field-error assessment-error">{problem}</p>}
    <div className="assessment-actions"><button className="btn secondary" type="button" onClick={()=>go('emergency')}>← Review emergency questions</button><button className="button button-primary" type="submit" disabled={busy}>{busy?'Saving assessment…':'Save assessment & create Report ID →'}</button></div>
    <div className="assessment-disclaimer">BurnCare is a clinical decision-support research system. This version records clinical data but does not issue automated treatment recommendations. Use synthetic information for testing.</div>
   </form>}
 </div>
}
