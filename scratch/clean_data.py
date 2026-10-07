import sqlite3
import os

db_paths = [
    r"b:\Projects\TMS\backend\tms.db",
    r"b:\Projects\TMS\tms.db"
]

for db_path in db_paths:
    if os.path.exists(db_path):
        print(f"Cleaning database: {db_path}")
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        
        # Clear default / test data
        cur.execute("DELETE FROM claim_timelines")
        cur.execute("DELETE FROM events")
        cur.execute("DELETE FROM sessions")
        
        # Ensure clean associate record exists
        cur.execute("""
            INSERT OR REPLACE INTO associates (id, name, email, role, target_daily_claims)
            VALUES ('EMP101', 'Associate EMP101', 'emp101@organization.com', 'ASSOCIATE', 40)
        """)
        
        conn.commit()
        cur.execute("VACUUM")
        conn.close()
        print(f"Cleaned {db_path} successfully!")

print("All databases cleaned.")
