import sqlite3
import sys

def main():
    if len(sys.argv) < 2:
        print("Usage: python check_db.py <db_path>")
        return
    
    db_path = sys.argv[1]
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get all tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    
    print("Tables in the database:")
    for table in tables:
        table_name = table[0]
        cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
        row_count = cursor.fetchone()[0]
        print(f"  {table_name}: {row_count} rows")
    
    # Check Project Table IDs and Distribution
    print("\nAnalyzing Project IDs Distribution:")
    try:
        cursor.execute("SELECT MIN(id), MAX(id) FROM Project")
        min_id, max_id = cursor.fetchone()
        print(f"Project ID range: {min_id} to {max_id}")
        
        # Count projects by ID ranges
        cursor.execute("SELECT COUNT(*) FROM Project WHERE id <= 30")
        count_1_30 = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM Project WHERE id > 30")
        count_31_plus = cursor.fetchone()[0]
        
        print(f"Projects with ID <= 30: {count_1_30}")
        print(f"Projects with ID > 30: {count_31_plus}")
        
        # Show sample records from different ranges
        print("\nSample Project records (ID <= 30):")
        cursor.execute("SELECT * FROM Project WHERE id <= 30 ORDER BY id LIMIT 5")
        for row in cursor.fetchall():
            print(f"  {row}")
            
        print("\nSample Project records (ID > 30):")
        cursor.execute("SELECT * FROM Project WHERE id > 30 ORDER BY id LIMIT 5")
        for row in cursor.fetchall():
            print(f"  {row}")
    except sqlite3.OperationalError as e:
        print(f"Error analyzing Project table: {e}")
    
    # Check Deliverable Table and its relationship with Projects
    print("\nAnalyzing Deliverable Table:")
    try:
        cursor.execute("SELECT MIN(id), MAX(id) FROM Deliverable")
        min_id, max_id = cursor.fetchone()
        print(f"Deliverable ID range: {min_id} to {max_id}")
        
        cursor.execute("SELECT MIN(project_id), MAX(project_id) FROM Deliverable")
        min_project_id, max_project_id = cursor.fetchone()
        print(f"Project IDs referenced in Deliverables: {min_project_id} to {max_project_id}")
        
        # Check if any Deliverables reference Projects with ID <= 30
        cursor.execute("SELECT COUNT(*) FROM Deliverable WHERE project_id <= 30")
        low_project_count = cursor.fetchone()[0]
        print(f"Deliverables referencing Projects with ID <= 30: {low_project_count}")
        
        # Show sample Deliverable records
        print("\nSample Deliverable records:")
        cursor.execute("SELECT * FROM Deliverable ORDER BY id LIMIT 5")
        for row in cursor.fetchall():
            print(f"  {row}")
        
        # Count Deliverables by project_id
        print("\nDeliverables by Project:")
        cursor.execute("""
            SELECT project_id, COUNT(*) as deliverable_count
            FROM Deliverable
            GROUP BY project_id
            ORDER BY project_id
            LIMIT 10
        """)
        for row in cursor.fetchall():
            print(f"  Project {row[0]}: {row[1]} deliverables")
    except sqlite3.OperationalError as e:
        print(f"Error analyzing Deliverable table: {e}")
    
    # Check Entity Arrivals
    print("\nAnalyzing Entity Arrivals:")
    try:
        cursor.execute("""
            SELECT entity_id, entity_table, arrival_time, arrival_datetime  
            FROM sim_entity_arrivals
            ORDER BY arrival_time
            LIMIT 10
        """)
        print("First 10 entity arrivals:")
        for row in cursor.fetchall():
            print(f"  Entity {row[0]} (Table: {row[1]}) arrived at {row[2]} minutes ({row[3]})")
    except sqlite3.OperationalError as e:
        print(f"Error analyzing sim_entity_arrivals: {e}")
    
    # Check Event Processing
    print("\nAnalyzing Event Processing:")
    try:
        cursor.execute("""
            SELECT event_id, entity_id, start_time, end_time, duration  
            FROM sim_event_processing
            ORDER BY start_time
            LIMIT 10
        """)
        print("First 10 processed events:")
        for row in cursor.fetchall():
            print(f"  Event {row[0]} for Entity {row[1]} processed from {row[2]} to {row[3]} (Duration: {row[4]/60:.2f} hours)")
    except sqlite3.OperationalError as e:
        print(f"Error analyzing sim_event_processing: {e}")
    
    print("\nChecking sim_resource_allocations table...")
    try:
        cursor.execute("SELECT COUNT(*) FROM sim_resource_allocations")
        count = cursor.fetchone()[0]
        print(f"Found {count} records in sim_resource_allocations")
        
        if count > 0:
            cursor.execute("SELECT * FROM sim_resource_allocations LIMIT 5")
            rows = cursor.fetchall()
            print("Sample records:")
            for row in rows:
                print(f"  {row}")
        else:
            print("No records found in sim_resource_allocations")
    except sqlite3.OperationalError as e:
        print(f"Error querying sim_resource_allocations: {e}")
    
    print("\nChecking Deliverable_Consultant table...")
    try:
        cursor.execute("SELECT COUNT(*) FROM Deliverable_Consultant")
        count = cursor.fetchone()[0]
        print(f"Found {count} records in Deliverable_Consultant")
        
        if count > 0:
            cursor.execute("SELECT * FROM Deliverable_Consultant LIMIT 5")
            rows = cursor.fetchall()
            print("Sample records:")
            for row in rows:
                print(f"  {row}")
        else:
            print("No records found in Deliverable_Consultant")
    except sqlite3.OperationalError as e:
        print(f"Error querying Deliverable_Consultant: {e}")
    
    conn.close()

if __name__ == "__main__":
    main() 