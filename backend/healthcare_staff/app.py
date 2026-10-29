"""BurnCare Flask classroom implementation based on 'BurnCare Project Division'.
WHO the staff member is now comes from the BurnCare login (Lana's login
page, /api/auth/me) — not from a list of staff profiles. Staff sign up on
the Register page and are approved by the admin, so nobody can create or
switch staff profiles here.
Never upload actual patient data or expose this server to a network.
"""
import io, json, os, re, uuid
import urllib.error, urllib.request
from pathlib import Path
from datetime import date
from flask import Flask, request, jsonify, send_file
from PIL import Image, UnidentifiedImageError
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as PDFImage, KeepTogether
from xml.sax.saxutils import escape
from .database import initialize, connect, ident, now, dictrow, report_obj, ROLES

HERE = Path(__file__).resolve().parent
IMAGE_DIR = HERE / 'instance' / 'uploads'
MAX_IMAGE = 5 * 1024 * 1024
VALID_DESTINATIONS = ['No treatment needed', 'Treat locally', 'Treat at a burn unit']
VALID_REGIONS = {'head_front','head_back','trunk_front','trunk_back','buttocks','arm_left_front','arm_left_back','arm_right_front','arm_right_back','leg_left_front','leg_left_back','leg_right_front','leg_right_back','perineum'}
METHODS = {'Flame / Thermal','Scald / Hot Liquid','Chemical','Electrical','Contact','Radiation / Other','Unknown',
           'Hot liquid or steam','Fire or flame','Hot object','Electricity','Friction','Cold injury (frostbite)','Sun','Other'}
TIMES = {'Less than 2 hours','2 to 6 hours','6 to 24 hours','More than 24 hours'}
DIABETES = {'Non-Diabetic','Diabetic','Unknown'}
# Frontend map uses the same adult whole-region weights. Neither this nor the
# entered pediatric estimate substitutes for a clinician's TBSA assessment.
REGION_LABELS = {
 'head_front':'Head and neck (front)','head_back':'Head and neck (back)',
 'trunk_front':'Chest and abdomen','trunk_back':'Back','buttocks':'Buttocks',
 'arm_left_front':'Left arm (front)','arm_left_back':'Left arm (back)',
 'arm_right_front':'Right arm (front)','arm_right_back':'Right arm (back)',
 'leg_left_front':'Left leg (front)','leg_left_back':'Left leg (back)',
 'leg_right_front':'Right leg (front)','leg_right_back':'Right leg (back)',
 'perineum':'Perineum'
}
ADULT_WEIGHTS = {'head_front':4.5, 'head_back':4.5, 'trunk_front':18,
    'trunk_back':13, 'buttocks':5, 'arm_left_front':4.5, 'arm_left_back':4.5,
    'arm_right_front':4.5, 'arm_right_back':4.5, 'leg_left_front':9,
    'leg_left_back':9, 'leg_right_front':9, 'leg_right_back':9, 'perineum':1}
EDIT_FIELDS = ('patient_code','injury_date','age','pain','mechanism','time_since','diabetes',
               'regions','medical_history','notes')
EMERGENCY_KEYS = ('breathing','smoke','responsive')
SUPPLEMENTAL_KEYS = ('circumferential','conditions','notHealed','childUnwell')
CONDITIONS = {'Diabetes','Heart or blood vessel disease','Kidney disease','Weak immune system','Other','None'}

def check_assessment_details(emergency, supplemental):
    if not isinstance(emergency,dict) or not isinstance(supplemental,dict):
        raise Invalid('Emergency screening and supplementary answers must be objects.')
    if any(k not in EMERGENCY_KEYS for k in emergency):
        raise Invalid('Unknown emergency screening field.')
    for key,value in emergency.items():
        if value not in (('Yes','No') if key=='responsive' else ('Yes','No','Not sure')):
            raise Invalid('Choose a valid emergency screening answer.')
    if any(k not in SUPPLEMENTAL_KEYS for k in supplemental):
        raise Invalid('Unknown supplementary assessment field.')
    for key in ('circumferential','notHealed','childUnwell'):
        if key in supplemental and supplemental[key] not in ('Yes','No','Not sure',''):
            raise Invalid('Choose a valid supplementary assessment answer.')
    conditions=supplemental.get('conditions',[])
    if not isinstance(conditions,list) or len(conditions)!=len(set(conditions)) or not set(conditions)<=CONDITIONS:
        raise Invalid('Choose valid long-term conditions.')
    if 'None' in conditions and len(conditions)>1:
        raise Invalid('None cannot be selected with another condition.')
    return emergency,supplemental


def calculated_tbsa(age, regions):
    if age < 16: return None, 'Pediatric Lund–Browder — clinician estimate'
    return round(sum(ADULT_WEIGHTS[region] for region in regions), 2), 'Adult Rule of Nines — approximate whole-region selection'

def check_revision(data, rep):
    if 'expected_revision' in data:
        try: expected = int(data['expected_revision'])
        except (ValueError, TypeError): raise Invalid('Refresh the report before editing.')
        if expected != rep['revision']:
            return False
    return True

class Invalid(Exception): pass

class NotAllowed(Exception):
    """Not logged in (401) or not allowed (403)."""
    def __init__(self, message, status=403):
        super().__init__(message); self.status = status


# ----- The logged-in BurnCare account ---------------------------------
# The browser sends the BurnCare login cookie with every /staff/api call
# (same website). We pass it on to the main BurnCare backend and ask who
# it belongs to: GET /api/auth/me. Set BURNCARE_API in .env if the main
# backend is not on port 5000.
BURNCARE_API = os.environ.get('BURNCARE_API', 'http://127.0.0.1:5000')

# BurnCare role names → the role names used on the staff pages.
ROLE_FROM_ACCOUNT = {'Doctor': 'Doctor', 'Nurse': 'Nurse', 'EMS staff (paramedic)': 'Paramedic or ambulance crew',
                     'Burn specialist': 'Burn specialist'}
APPROVAL_FROM_STATUS = {'approved': 'Approved', 'pending': 'Waiting for approval', 'changes_requested': 'Changes requested'}


def logged_in_account():
    cookie = request.headers.get('Cookie')
    if not cookie:
        return None
    ask = urllib.request.Request(BURNCARE_API + '/api/auth/me', headers={'Cookie': cookie})
    try:
        with urllib.request.urlopen(ask, timeout=5) as answer:
            return json.loads(answer.read()).get('user')
    except urllib.error.HTTPError:
        return None  # 401: not logged in
    except (urllib.error.URLError, ValueError, OSError):
        raise NotAllowed('Cannot reach the BurnCare server. Make sure the main Flask backend is running.', 503)


def staff_account():
    """The logged-in staff account, as a staff profile (read-only)."""
    account = logged_in_account()
    if not account:
        raise NotAllowed('Please log in again.', 401)
    if account.get('role') != 'staff':
        raise NotAllowed('Only healthcare staff can use this page.', 403)
    label = account.get('staffRole') or 'Other'
    return dict(
        id=f"account-{account['id']}",       # the BurnCare account number
        name=account['fullName'],
        role=ROLE_FROM_ACCOUNT.get(label, 'Other'),
        role_label=label,                     # e.g. "Other: Pharmacist"
        approval=APPROVAL_FROM_STATUS.get(account.get('staffStatus'), 'Waiting for approval'),
        email=account['email'],
        license_number=account.get('scfhsNumber') or '',
        specialty='', organization='', department='',
    )

def req_text(v, name, max_len=200):
    if not isinstance(v,str) or not v.strip() or len(v.strip())>max_len: raise Invalid(f'{name} is required (maximum {max_len} characters).')
    return v.strip()

def check_tbsa(v, label='TBSA'):
    try: x=float(v)
    except (ValueError, TypeError): raise Invalid(f'{label} must be a number.')
    if not 0<x<=100: raise Invalid(f'{label} must be greater than 0 and at most 100%.')
    return round(x,2)

def validate(data):
    if not isinstance(data,dict): raise Invalid('Assessment details are required.')
    code=req_text(data.get('patient_code'), 'Patient reference code',30)
    if not re.fullmatch(r'[A-Za-z0-9_-]{3,30}',code): raise Invalid('Patient code needs 3–30 letters, numbers, hyphens or underscores.')
    try:
        age=int(data['age']); pain=int(data['pain'])
        if str(data['age']).strip() != str(age) and data['age'] != age: raise ValueError()
        if str(data['pain']).strip() != str(pain) and data['pain'] != pain: raise ValueError()
    except (ValueError,TypeError,KeyError): raise Invalid('Age and pain must be whole numbers.')
    if not 0<=age<=120: raise Invalid('Age must be from 0 to 120.')
    if not 0<=pain<=10: raise Invalid('Pain must be from 0 to 10.')
    for key, options in [('mechanism',METHODS),('time_since',TIMES),('diabetes',DIABETES)]:
        if data.get(key) not in options: raise Invalid('Choose a valid ' + key.replace('_',' ') + '.')
    region=data.get('regions')
    if not isinstance(region,list) or not region or len(region)!=len(set(region)) or not set(region)<=VALID_REGIONS: raise Invalid('Choose at least one valid region on the body map.')
    try:
        injury=date.fromisoformat(str(data['injury_date']))
        if injury>date.today(): raise ValueError()
    except (ValueError,KeyError): raise Invalid('Choose a valid injury date, not in the future.')
    current=check_tbsa(data.get('tbsa_final'))
    raw_estimate=data.get('tbsa_estimate')
    estimate=check_tbsa(raw_estimate,'Map estimate') if raw_estimate is not None else None
    method=req_text(data.get('tbsa_method'),'TBSA method',120)
    if age<16 and estimate is not None: raise Invalid('Pediatric TBSA requires clinician-entered Lund–Browder estimate; automatic map estimation is not supported.')
    if age>=16 and estimate is None: raise Invalid('TBSA map estimate is required for adults.')
    if age>=16 and abs(estimate-calculated_tbsa(age,region)[0])>0.001:
        raise Invalid('The TBSA map estimate does not match the selected adult regions.')
    if age<16 and 'pediatric' not in method.lower(): raise Invalid('Select a pediatric TBSA method.')
    if estimate is not None and abs(estimate-current)>0.001:
        req_text(data.get('tbsa_reason'), 'Reason for TBSA adjustment',250)
    if len(str(data.get('medical_history','')).strip()) > 700:
        raise Invalid('Medical history must be 700 characters or fewer.')
    if len(str(data.get('notes','')).strip()) > 1000:
        raise Invalid('Clinical notes must be 1,000 characters or fewer.')
    emergency,supplemental=check_assessment_details(data.get('emergency',{}),data.get('supplemental',{}))
    return dict(emergency=emergency,supplemental=supplemental,patient_code=code,age=age,pain=pain,injury_date=str(injury),tbsa_final=current,tbsa_estimate=estimate,tbsa_method=method,
         mechanism=data['mechanism'],time_since=data['time_since'],diabetes=data['diabetes'],regions=region,
         medical_history=str(data.get('medical_history','')).strip(),notes=str(data.get('notes','')).strip(),tbsa_reason=str(data.get('tbsa_reason','')).strip()[:250])

def new_app():
    initialize(); IMAGE_DIR.mkdir(parents=True,exist_ok=True)
    app=Flask(__name__)
    # (No sessions are written here any more: the login belongs to the main BurnCare backend.)
    app.secret_key=os.environ.get('BURNCARE_DEMO_SESSION_KEY','local-demo-only-not-an-authentication-key')
    app.config['MAX_CONTENT_LENGTH']=MAX_IMAGE+160_000

    @app.errorhandler(Invalid)
    def invalid(exc): return jsonify(error=str(exc)),400

    @app.errorhandler(413)
    def too_big(_): return jsonify(error='Image must not exceed 5 MB.'),413

    @app.errorhandler(NotAllowed)
    def not_allowed(exc): return jsonify(error=str(exc)),exc.status

    def actor(db):
        """The logged-in, admin-approved staff member (from the BurnCare login)."""
        profile=staff_account()
        if profile['approval']!='Approved':
            raise NotAllowed('Your account is waiting for admin approval.', 403)
        # A copy in the staff table, so reports and consultations can show who did what.
        db.execute('''INSERT INTO staff (id,name,role,specialty,organization,department,license_number,email,approval,created_at)
                      VALUES (?,?,?,?,?,?,?,?,?,?)
                      ON CONFLICT(id) DO UPDATE SET name=excluded.name,role=excluded.role,email=excluded.email,
                        license_number=excluded.license_number,approval=excluded.approval''',
                   (profile['id'],profile['name'],profile['role'],'','','',profile['license_number'],profile['email'],profile['approval'],now()))
        return profile

    def specialist(db):
        user=actor(db)
        if user['role']!='Burn specialist' or user['approval']!='Approved': return None
        return user

    @app.get('/api/health')
    def health(): return jsonify(status='ok',mode='local staff workspace')

    @app.get('/api/staff')
    def staff():
        """The logged-in staff member's profile (read-only). There is no
        "create profile" or "switch profile" any more: staff register on the
        Register page and the admin approves them."""
        return jsonify(active=staff_account())

    @app.get('/api/reports')
    def report_list():
        with connect() as db:
            actor(db)  # approved staff only
            rows=[dict(r) for r in db.execute('''SELECT r.id AS report_id,r.patient_code,r.created_at,r.mechanism,r.tbsa_final,
                       r.destination,(SELECT COUNT(*) FROM consultations c WHERE c.report_id=r.id) AS consultation_count
                       FROM reports r ORDER BY r.created_at DESC''')]
            return jsonify(reports=rows)

    @app.post('/api/reports')
    def create_report():
        try: raw_data=json.loads(request.form.get('data',''))
        except (TypeError,ValueError): raise Invalid('Provide assessment JSON data.')
        data=validate(raw_data)
        file=request.files.get('image')
        if not file or not file.filename: raise Invalid('A burn photograph is required.')
        binary=file.read(MAX_IMAGE+1)
        if not binary or len(binary)>MAX_IMAGE: raise Invalid('Image must be non-empty and 5 MB or less.')
        fmt='PNG' if binary.startswith(b'\x89PNG\r\n\x1a\n') else 'JPEG' if binary.startswith(b'\xff\xd8\xff') else None
        if not fmt: raise Invalid('Use an actual JPEG or PNG photograph.')
        try:
            im=Image.open(io.BytesIO(binary))
            if im.format!=fmt or im.width*im.height>20_000_000: raise Invalid('Image is not valid or has excessive dimensions.')
            im.verify()
        except (UnidentifiedImageError,ValueError,OSError,SyntaxError): raise Invalid('Image could not be verified.')
        filename=Path(file.filename.replace('\\','/')).name[:120]
        if not filename.lower().endswith(('.png',) if fmt=='PNG' else ('.jpg','.jpeg')): raise Invalid('Image extension does not match its contents.')
        ext='.png' if fmt=='PNG' else '.jpg'; image_file=uuid.uuid4().hex+ext
        (IMAGE_DIR/image_file).write_bytes(binary)
        try:
            with connect() as db:
                who=actor(db); report_id=ident()
                db.execute('''INSERT INTO reports (id,patient_code,created_by,injury_date,age,pain,mechanism,time_since,diabetes,regions,tbsa_method,
                  tbsa_estimate,tbsa_final,medical_history,notes,emergency_json,supplemental_json,image_file,image_name,image_mime,created_at,updated_at)
                  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',
                  (report_id,data['patient_code'],who['id'],data['injury_date'],data['age'],data['pain'],data['mechanism'],data['time_since'],data['diabetes'],json.dumps(data['regions']),data['tbsa_method'],data['tbsa_estimate'],data['tbsa_final'],data['medical_history'],data['notes'],json.dumps(data['emergency']),json.dumps(data['supplemental']),image_file,filename,'image/png' if fmt=='PNG' else 'image/jpeg',now(),now()))
                if data['tbsa_estimate'] is not None and abs(data['tbsa_estimate']-data['tbsa_final'])>.001:
                    db.execute('INSERT INTO tbsa_changes (report_id,clinician_id,old_value,new_value,reason,changed_at) VALUES (?,?,?,?,?,?)',
                     (report_id,who['id'],data['tbsa_estimate'],data['tbsa_final'],data['tbsa_reason'],now()))
                result=report_obj(db,report_id)
            return jsonify(report=result),201
        except:
            (IMAGE_DIR/image_file).unlink(missing_ok=True)
            raise

    @app.get('/api/reports/<report_id>')
    def read_report(report_id):
        with connect() as db:
            actor(db)  # approved staff only
            rep=report_obj(db,report_id)
            return (jsonify(report=rep),200) if rep else (jsonify(error='Record not found'),404)

    @app.get('/api/reports/<report_id>/image')
    def image(report_id):
        with connect() as db:
            actor(db)  # approved staff only
            rep=report_obj(db,report_id)
            if not rep: return jsonify(error='Record not found'),404
            path=IMAGE_DIR/rep['image_file']
            if not path.exists(): return jsonify(error='Image missing'),404
            res=send_file(path,mimetype=rep['image_mime']);res.headers['Cache-Control']='no-store';res.headers['X-Content-Type-Options']='nosniff';return res

    @app.patch('/api/reports/<report_id>/clinical')
    def clinical_edit(report_id):
        """Clinician corrections preserve each replaced value and its provenance."""
        payload=request.get_json(silent=True) or {}
        if not isinstance(payload,dict): raise Invalid('Provide updated clinical information.')
        reason=req_text(payload.get('reason'),'Reason for clinical correction',500)
        if len(reason)<3: raise Invalid('Explain the clinical correction (at least three characters).')
        with connect() as db:
            previous=report_obj(db,report_id)
            if not previous: return jsonify(error='Record not found'),404
            if not check_revision(payload,previous): return jsonify(error='This report has changed. Reload it before making corrections.'),409
            clinician=actor(db)
            # A complete edit form avoids accidentally clearing clinical fields.
            if any(field not in payload for field in EDIT_FIELDS):
                raise Invalid('Complete all clinical fields before saving corrections.')
            age_raw=payload['age']
            try: age=int(age_raw)
            except (ValueError,TypeError): raise Invalid('Age must be a whole number.')
            regions=payload['regions']
            if not isinstance(regions,list) or not regions or len(regions)!=len(set(regions)) or not set(regions)<=VALID_REGIONS:
                raise Invalid('Select at least one valid affected region.')
            estimate,method=calculated_tbsa(age,regions) if 0<=age<=120 else (None,'')
            # A correction to age or the selected regions requires clinician review of TBSA.
            if age!=previous['age'] or set(regions)!=set(previous['regions']):
                if payload.get('tbsa_final') in ('',None) or payload.get('tbsa_reviewed') is not True:
                    raise Invalid('Review and confirm the documented TBSA after changing age or burn location.')
            proposed_tbsa=payload.get('tbsa_final',previous['tbsa_final'])
            submitted={**payload,
                'emergency':payload.get('emergency',previous['emergency']),
                'supplemental':payload.get('supplemental',previous['supplemental']),
                'tbsa_final':proposed_tbsa,'tbsa_estimate':estimate,'tbsa_method':method,
                'tbsa_reason': reason}
            normalized=validate(submitted)
            if abs(normalized['tbsa_final']-previous['tbsa_final'])>.001 and len(reason)<3:
                raise Invalid('A reason for the TBSA correction is required.')
            changes={field:{'before':previous[field],'after':normalized[field]}
                for field in (*EDIT_FIELDS,'tbsa_estimate','tbsa_method')
                if (set(previous[field])!=set(normalized[field]) if field=='regions' else previous[field]!=normalized[field])}
            for field in ('emergency','supplemental'):
                if previous[field]!=normalized[field]:
                    changes[field]={'before':previous[field],'after':normalized[field]}
            tbsa_changed=abs(previous['tbsa_final']-normalized['tbsa_final'])>.001
            if tbsa_changed:
                changes['tbsa_final']={'before':previous['tbsa_final'],'after':normalized['tbsa_final']}
            if not changes: raise Invalid('No changes were made to the report.')
            edited_at=now()
            applied=db.execute('''UPDATE reports SET patient_code=?,injury_date=?,age=?,pain=?,mechanism=?,time_since=?,diabetes=?,
                regions=?,medical_history=?,notes=?,tbsa_estimate=?,tbsa_method=?,tbsa_final=?,emergency_json=?,supplemental_json=?,
                updated_at=?,revision=revision+1,depth=NULL,destination=NULL,confidence=NULL,heatmap_file=NULL
                WHERE id=? AND revision=?''',
                (normalized['patient_code'],normalized['injury_date'],normalized['age'],normalized['pain'],normalized['mechanism'],
                 normalized['time_since'],normalized['diabetes'],json.dumps(normalized['regions']),
                 normalized['medical_history'],normalized['notes'],normalized['tbsa_estimate'],
                 normalized['tbsa_method'],normalized['tbsa_final'],json.dumps(normalized['emergency']),json.dumps(normalized['supplemental']),edited_at,report_id,previous['revision']))
            if applied.rowcount!=1:
                return jsonify(error='This report changed during editing. Reload and try again.'),409
            db.execute('''INSERT INTO clinical_changes (report_id,clinician_id,changes_json,reason,changed_at)
                          VALUES (?,?,?,?,?)''',
                       (report_id,clinician['id'],json.dumps(changes),reason,edited_at))
            if tbsa_changed:
                db.execute('''INSERT INTO tbsa_changes
                     (report_id,clinician_id,old_value,new_value,reason,changed_at)
                     VALUES (?,?,?,?,?,?)''',
                  (report_id,clinician['id'],previous['tbsa_final'],normalized['tbsa_final'],reason,edited_at))
            return jsonify(report=report_obj(db,report_id))

    @app.patch('/api/reports/<report_id>/tbsa')
    def tbsa_edit(report_id):
        data=request.get_json(silent=True) or {}; changed=check_tbsa(data.get('tbsa'))
        reason=req_text(data.get('reason'),'Reason for adjustment',250)
        with connect() as db:
            rep=report_obj(db,report_id)
            if not rep: return jsonify(error='Record not found'),404
            if not check_revision(data,rep): return jsonify(error='This report has changed. Reload it before adjusting TBSA.'),409
            if abs(rep['tbsa_final']-changed)<.001: raise Invalid('Enter a different TBSA value.')
            who=actor(db)
            applied=db.execute('''UPDATE reports SET tbsa_final=?,updated_at=?,revision=revision+1,
               depth=NULL,destination=NULL,confidence=NULL,heatmap_file=NULL WHERE id=? AND revision=?''',
               (changed,now(),report_id,rep['revision']))
            if applied.rowcount!=1:
                return jsonify(error='This report changed during editing. Reload and try again.'),409
            db.execute('INSERT INTO tbsa_changes (report_id,clinician_id,old_value,new_value,reason,changed_at) VALUES (?,?,?,?,?,?)',
                       (report_id,who['id'],rep['tbsa_final'],changed,reason,now()))
            return jsonify(report=report_obj(db,report_id))

    @app.post('/api/reports/<report_id>/consultations')
    def ask_specialist(report_id):
        data=request.get_json(silent=True) or {}; question=req_text(data.get('question'),'Question for specialist',1200)
        with connect() as db:
            who=actor(db)
            if who['role']=='Burn specialist': return jsonify(error='Use the specialist queue to review requests.'),403
            if not report_obj(db,report_id): return jsonify(error='Record not found'),404
            cid=ident()
            db.execute('''INSERT INTO consultations (id,report_id,requested_by,question,created_at) VALUES (?,?,?,?,?)''',
                    (cid,report_id,who['id'],question,now()))
            return jsonify(consultation=dict(id=cid,status='Waiting',report_id=report_id)),201

    @app.get('/api/consultations')
    def queue():
        with connect() as db:
            if not specialist(db): return jsonify(error='Only approved burn specialists can access consultations.'),403
            rows=[dict(row) for row in db.execute('''SELECT c.*,r.patient_code FROM consultations c
                   JOIN reports r ON r.id=c.report_id ORDER BY CASE c.status WHEN 'Waiting' THEN 0 WHEN 'Claimed' THEN 1 ELSE 2 END,c.created_at''')]
            return jsonify(consultations=rows)

    @app.post('/api/consultations/<cid>/claim')
    def claim(cid):
        with connect() as db:
            who=specialist(db)
            if not who: return jsonify(error='Only approved burn specialists can claim cases.'),403
            # Atomic UPDATE ensures only one specialist can claim a waiting case.
            cursor=db.execute('''UPDATE consultations SET status='Claimed',claimed_by=?,claimed_at=? WHERE id=? AND status='Waiting' ''',(who['id'],now(),cid))
            if cursor.rowcount!=1: return jsonify(error='Case unavailable or already claimed.'),409
            return jsonify(consultation=dict(db.execute('SELECT * FROM consultations WHERE id=?',(cid,)).fetchone()))

    @app.post('/api/consultations/<cid>/reply')
    def reply(cid):
        data=request.get_json(silent=True) or {}; advice=req_text(data.get('advice'),'Specialist advice',2500)
        with connect() as db:
            who=specialist(db)
            if not who: return jsonify(error='Only approved burn specialists can reply.'),403
            current=db.execute('''SELECT r.revision FROM reports r JOIN consultations c ON c.report_id=r.id
                         WHERE c.id=?''',(cid,)).fetchone()
            if not current: return jsonify(error='Consultation not found'),404
            updated=db.execute("UPDATE consultations SET status='Answered',advice=?,answered_at=?,answered_revision=? WHERE id=? AND status='Claimed' AND claimed_by=?",
                         (advice,now(),current['revision'],cid,who['id']))
            if updated.rowcount!=1: return jsonify(error='Only the specialist who claimed this case can answer.'),403
            return jsonify(consultation=dict(db.execute('SELECT * FROM consultations WHERE id=?',(cid,)).fetchone()))

    @app.get('/api/reports/<report_id>/pdf')
    def report_pdf(report_id):
        with connect() as db:
            actor(db)  # approved staff only
            rep=report_obj(db,report_id)
            if not rep: return jsonify(error='Record not found'),404

        buffer=io.BytesIO()
        crimson=colors.HexColor('#c85342')
        light=colors.HexColor('#fff5f1')
        ink=colors.HexColor('#302a2a')
        muted=colors.HexColor('#6e6666')
        sheet=SimpleDocTemplate(buffer,pagesize=A4,rightMargin=42,leftMargin=42,
                                topMargin=42,bottomMargin=44,
                                title='BurnCare - Assessment '+report_id,
                                author='BurnCare Healthcare Staff')
        body=ParagraphStyle('Body',fontName='Helvetica',fontSize=9.1,leading=14,textColor=ink,spaceAfter=5)
        small=ParagraphStyle('Small',parent=body,fontSize=8,leading=11,textColor=muted)
        header=ParagraphStyle('Heading',parent=body,fontName='Helvetica-Bold',fontSize=17,leading=23,textColor=crimson,spaceAfter=7)
        section=ParagraphStyle('Section',parent=body,fontName='Helvetica-Bold',fontSize=11.2,leading=16,
                               textColor=ink,spaceBefore=17,spaceAfter=8)
        label=ParagraphStyle('CellLabel',parent=body,fontName='Helvetica-Bold',fontSize=8.3,leading=12)
        cell=ParagraphStyle('Cell',parent=body,fontSize=8.4,leading=12)
        def para(value,style=body):
            return Paragraph(escape('' if value is None else str(value)).replace('\n','<br/>'),style)
        def table(rows):
            entries=[[para(key,label),para(value,cell)] for key,value in rows]
            t=Table(entries,colWidths=[153,358],hAlign='LEFT',repeatRows=0)
            t.setStyle(TableStyle([
                ('VALIGN',(0,0),(-1,-1),'TOP'),('BACKGROUND',(0,0),(0,-1),light),
                ('LINEBELOW',(0,0),(-1,-1),.35,colors.HexColor('#ead9d5')),
                ('LEFTPADDING',(0,0),(-1,-1),10),('RIGHTPADDING',(0,0),(-1,-1),10),
                ('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7),
            ]))
            return t
        def section_title(text): return Paragraph(text,section)
        flow=[]
        logo=HERE.parent/'frontend'/'public'/'logo.jpeg'
        if logo.exists():
            flow.append(PDFImage(str(logo),width=51,height=51))
        flow.append(Paragraph('BurnCare | Burn Assessment Report',header))
        flow.append(para('Case documentation and clinical review',small))
        flow.append(Spacer(1,10))
        flow.append(table([
            ('Report ID',rep['report_id']),('Patient reference',rep['patient_code']),
            ('Created',rep['created_at']),('Last updated',rep['updated_at'] or rep['created_at']),
            ('Staff profile ID',rep['created_by']),('Report revision',rep['revision'])
        ]))
        flow.append(section_title('Recorded clinical information'))
        flow.append(table([
            ('Age (years)',rep['age']),('Pain level',f"{rep['pain']}/10"),
            ('Injury date',rep['injury_date']),('Burn mechanism',rep['mechanism']),
            ('Time since injury',rep['time_since']),('Diabetes status',rep['diabetes']),
            ('Affected body regions',', '.join(REGION_LABELS.get(r,r) for r in rep['regions'])),
            ('TBSA estimation method',rep['tbsa_method']),
            ('Body map estimate',f"{rep['tbsa_estimate']}%" if rep['tbsa_estimate'] is not None else 'Not calculated'),
            ('Clinician documented TBSA',f"{rep['tbsa_final']}%"),
            ('Relevant medical history',rep['medical_history'] or 'Not entered'),
            ('Clinical notes',rep['notes'] or 'Not entered'),
        ]))
        if rep['emergency']:
            flow.append(section_title('Emergency screening'))
            flow.append(table([(key.capitalize(),rep['emergency'].get(key,'Not answered')) for key in EMERGENCY_KEYS]))
        if rep['supplemental']:
            extras=rep['supplemental']
            flow.append(section_title('Additional assessment questions'))
            flow.append(table([('Circumferential burn',extras.get('circumferential','Not answered')),
                ('Long-term conditions',', '.join(extras.get('conditions',[])) or 'Not answered'),
                ('Not healed after two weeks',extras.get('notHealed','Not answered')),
                ('Child unwell',extras.get('childUnwell','Not applicable'))]))
        path=IMAGE_DIR/rep['image_file']
        if path.exists():
            try:
                with Image.open(path) as im:
                    iw,ih=im.size
                w=min(410,310*iw/max(ih,1));h=w*ih/max(iw,1)
                flow.append(KeepTogether([section_title('Submitted burn photograph'),
                                          PDFImage(str(path),width=w,height=h)]))
            except (OSError,ValueError):
                flow.append(section_title('Submitted burn photograph'))
                flow.append(para('The photograph is not available in this report.'))
        flow.append(section_title('Decision-support status'))
        flow.append(table([
            ('Treatment destination',rep['destination'] or 'Not available - decision engine not connected'),
            ('AI burn-depth prediction',rep['depth'] or 'Not available'),
            ('AI confidence score',rep['confidence'] if rep['confidence'] is not None else 'Not available'),
            ('Grad-CAM: supporting information','Not available - model integration required'),
        ]))
        flow.append(Spacer(1,9))
        flow.append(para('BurnCare treatment categories: No treatment needed; Treat locally; Treat at a burn unit. No category is assigned without validated medical rules and the AI model.',small))
        flow.append(para('General first aid: cool under cool running water for 20 minutes, remove nearby items only if not stuck, cover loosely with a clean non-stick covering, and avoid ice and oils. For urgent assistance in Saudi Arabia, call 997.',small))
        if rep['clinical_audit']:
            first_clinical=True
            names={'patient_code':'Patient reference','age':'Age','pain':'Pain level','mechanism':'Burn mechanism','time_since':'Time since injury',
                   'diabetes':'Diabetes status','regions':'Affected regions','medical_history':'Medical history',
                   'notes':'Clinical notes','emergency':'Emergency screening','supplemental':'Additional assessment','injury_date':'Injury date','tbsa_estimate':'Body map estimate',
                   'tbsa_method':'TBSA estimation method','tbsa_final':'Documented TBSA'}
            for edit in rep['clinical_audit']:
                details=[]
                for field,change in edit['changes'].items():
                    old=change['before'];new=change['after']
                    if isinstance(old,list): old=', '.join(old)
                    if isinstance(new,list): new=', '.join(new)
                    if isinstance(old,dict): old=json.dumps(old,ensure_ascii=False)
                    if isinstance(new,dict): new=json.dumps(new,ensure_ascii=False)
                    details.append((names.get(field,field),str(old if old is not None and old!='' else 'Not entered')+'  ->  '+str(new if new is not None and new!='' else 'Not entered')))
                items=[para(f"{edit['changed_at']} | Staff ID: {edit['clinician_id']}",label),
                       para('Reason: '+edit['reason'],small),table(details),Spacer(1,10)]
                if first_clinical:
                    items.insert(0,section_title('Clinical corrections and audit history'))
                    first_clinical=False
                flow.append(KeepTogether(items))
        if rep['audit']:
            first_tbsa=True
            for row in rep['audit']:
                items=[para(f"{row['changed_at']} | Staff: {row['clinician_id']} | {row['old_value']}% to {row['new_value']}%",label),
                       para('Reason: '+row['reason'],small)]
                if first_tbsa:
                    items.insert(0,section_title('TBSA adjustment history'))
                    first_tbsa=False
                flow.append(KeepTogether(items))
        if rep['consultations']:
            flow.append(section_title('Specialist consultations'))
            for c in rep['consultations']:
                flow.append(para(f"Status: {c['status']} | Requested: {c['created_at']}",label))
                flow.append(para('Question: '+c['question']))
                if c['advice']:
                    flow.append(para('Specialist response: '+c['advice']))
                    if c['answered_revision'] is not None and c['answered_revision']<rep['revision']:
                        flow.append(para('The clinical record was revised after this response. Re-review may be necessary.',small))
        flow.append(Spacer(1,18))
        flow.append(para('CLINICAL NOTICE: BurnCare is a decision-support research project. In this version, no automated treatment decision or diagnosis is generated. Clinical information must be reviewed by a qualified healthcare professional.',small))
        def footer(pdf,doc):
            pdf.saveState();pdf.setFont('Helvetica',8);pdf.setFillColor(muted)
            pdf.drawString(42,26,'BurnCare  |  Clinical documentation  |  Development use: test information only')
            pdf.drawRightString(A4[0]-42,26,f'Page {doc.page}')
            pdf.restoreState()
        sheet.build(flow,onFirstPage=footer,onLaterPages=footer)
        buffer.seek(0)
        response=send_file(buffer,mimetype='application/pdf',download_name='BurnCare-'+report_id+'.pdf',as_attachment=True)
        response.headers['Cache-Control']='no-store'
        return response

    return app

if __name__=='__main__':
    new_app().run(host='127.0.0.1',port=5000,debug=False)