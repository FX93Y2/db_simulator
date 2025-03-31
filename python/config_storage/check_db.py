import sqlite3
import os

# Get the current directory
current_dir = os.path.dirname(os.path.abspath(__file__))
db_path = os.path.join(current_dir, 'configs.db')

print(f"Checking database at: {db_path}")
print(f"Database exists: {os.path.exists(db_path)}")

# Connect to the database
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# List all tables
print("\n--- Tables in the database ---")
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()
for table in tables:
    print(table[0])

# Check table schema
print("\n--- Table schemas ---")
for table in tables:
    cursor.execute(f"PRAGMA table_info({table[0]})")
    columns = cursor.fetchall()
    print(f"\nTable: {table[0]}")
    for col in columns:
        print(f"  Column: {col[1]}, Type: {col[2]}, Not Null: {col[3]}, Default: {col[4]}, Primary Key: {col[5]}")

# Count records in each table
print("\n--- Record counts ---")
for table in tables:
    cursor.execute(f"SELECT COUNT(*) FROM {table[0]}")
    count = cursor.fetchone()[0]
    print(f"Table {table[0]}: {count} records")

# Check for duplicate project configs
print("\n--- Checking for duplicate project configs ---")
cursor.execute("""
SELECT project_id, type, COUNT(*) as count
FROM configs
WHERE project_id IS NOT NULL
GROUP BY project_id, type
HAVING COUNT(*) > 1
""")
duplicates = cursor.fetchall()
if duplicates:
    print("Found duplicate project configs:")
    for dup in duplicates:
        print(f"  Project ID: {dup[0]}, Config Type: {dup[1]}, Count: {dup[2]}")
        
        # Show details of the duplicates
        cursor.execute("""
        SELECT id, name, created_at, updated_at
        FROM configs
        WHERE project_id = ? AND type = ?
        """, (dup[0], dup[1]))
        details = cursor.fetchall()
        for detail in details:
            print(f"    Config ID: {detail[0]}, Name: {detail[1]}, Created: {detail[2]}, Updated: {detail[3]}")
else:
    print("No duplicate project configs found.")

# Close the connection
conn.close() 