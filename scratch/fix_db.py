import sqlite3
import json

conn = sqlite3.connect(r'b:\Projects\TMS\backend\tms.db')
c = conn.cursor()

# Mark past claims as completed
c.execute("""
    UPDATE claim_timelines 
    SET status = 'COMPLETED',
        nva_flags_json = '[]'
    WHERE claim_id IN ('CLM1001', 'CLM1003')
""")

c.execute("""
    UPDATE claim_timelines 
    SET status = 'COMPLETED',
        nva_flags_json = '["APP_SWITCHING"]'
    WHERE claim_id = 'CLM-316'
""")

c.execute("""
    UPDATE claim_timelines 
    SET nva_flags_json = '[]'
    WHERE claim_id = 'CLM1028'
""")

conn.commit()

c.execute("SELECT claim_id, associate_id, status, total_duration_seconds, nva_flags_json FROM claim_timelines")
for row in c.fetchall():
    print(row)

conn.close()
