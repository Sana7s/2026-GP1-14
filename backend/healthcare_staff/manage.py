"""Team approval via local backend CLI — not an end-user self-approval button."""
import sys
from database import connect,initialize
initialize()
if len(sys.argv)!=3 or sys.argv[1]!='approve-specialist':
    print('Usage: python manage.py approve-specialist <STAFF-ID>')
    sys.exit(2)
with connect() as db:
    row=db.execute("SELECT id,name,role,approval FROM staff WHERE id=?",(sys.argv[2],)).fetchone()
    if not row or row['role']!='Burn specialist' or row['approval']!='Waiting for approval':
        print('No waiting specialist found for that ID.');sys.exit(1)
    db.execute("UPDATE staff SET approval='Approved' WHERE id=?",(sys.argv[2],))
    print('DEMO APPROVAL COMPLETE for',row['name'],'— actual SCFHS license verification must occur outside this prototype.')
