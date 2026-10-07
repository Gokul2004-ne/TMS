import sqlite3

conn = sqlite3.connect("tms.db")
c = conn.cursor()
c.execute("SELECT DISTINCT claim_id FROM events")
print("Distinct claim_ids in events:", c.fetchall())

c.execute("SELECT DISTINCT app_name FROM events")
print("Distinct app_names in events:", c.fetchall())

c.execute("SELECT count(*) FROM events")
print("Total events:", c.fetchone()[0])
