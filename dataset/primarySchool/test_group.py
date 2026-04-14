import json
import re
from collections import defaultdict

# --- Configuration ---
DAY1_START = 0
DAY1_END = 1554
MACRO_W = 1554
MICRO_W = 200
MICRO_STEP = 1 # High-resolution 1-unit traversal

def clean_and_load_js(filepath):
    """Deep-cleans JS format for Python JSON parsing."""
    print(f"🛠️  Cleaning and Loading: {filepath}...")
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        start = content.find('{')
        end = content.rfind('}')
        if start == -1 or end == -1: return None
        
        js_obj = content[start : end + 1]
        js_obj = js_obj.replace("'", '"')
        js_obj = re.sub(r'(\s+|{)([a-zA-Z_][a-zA-Z0-9_]*)\s*:', r'\1"\2":', js_obj)
        js_obj = re.sub(r',\s*([\]\}])', r'\1', js_obj)

        return json.loads(js_obj)
    except Exception as e:
        print(f"❌ Load Error: {e}")
        return None

def hunt_group_mtup_1554_200(data):
    """
    ULTIMATE COMMUNITY TEST: 
    Compares the full school day against 200-unit windows.
    Finds groups that are 'Hidden' in the daily average but 'King' of a 200-unit slice.
    """
    nodes = {str(n['id']): n for n in data['nodes']}
    node_to_group = {str(n['id']): n['group'] for n in data['nodes']}
    links = data['links']

    print(f"\n{'='*60}")
    print(f"👥 ULTIMATE GROUP MTUP: FULL DAY (1554) vs. MICRO (200)")
    print(f"{'='*60}")

    # 1. Calculate Static "All Day" Group Rankings for Day 1
    macro_activity = defaultdict(int)
    for l in links:
        # Filter only for Day 1
        c = len([ts for ts in l['times'] if DAY1_START <= ts < DAY1_END])
        if c > 0:
            g_src = node_to_group.get(str(l['source']), "N/A")
            g_tgt = node_to_group.get(str(l['target']), "N/A")
            macro_activity[g_src] += c
            macro_activity[g_tgt] += c
            
    sorted_m = sorted(macro_activity.items(), key=lambda x: x[1], reverse=True)
    top_3_day_groups = [g[0] for g in sorted_m[:3]]
    
    print(f"📊 Day 1 Static Top 3 Groups: {', '.join(top_3_day_groups)}")
    print(f"🔍 Searching for 200-unit group bursts that beat these leaders...")

    anomalies = []

    # 2. Traverse Day 1 with a 200-unit window (1-unit steps)
    # Total iterations: ~1354
    for t_micro in range(DAY1_START, DAY1_END - MICRO_W, MICRO_STEP):
        micro_activity = defaultdict(int)
        for l in links:
            c = len([ts for ts in l['times'] if t_micro <= ts < t_micro + MICRO_W])
            if c > 0:
                g_src = node_to_group.get(str(l['source']), "N/A")
                g_tgt = node_to_group.get(str(l['target']), "N/A")
                micro_activity[g_src] += c
                micro_activity[g_tgt] += c
        
        if not micro_activity: continue
        
        # Who is #1 in this 200-unit slice?
        winner_group = max(micro_activity, key=micro_activity.get)
        
        # CRITERIA: Winner group was NOT in the Top 3 of the whole day
        if winner_group not in top_3_day_groups:
            # Find their all-day rank
            day_rank = 99
            for i, (gname, _) in enumerate(sorted_m):
                if gname == winner_group:
                    day_rank = i + 1
                    break
            
            anomalies.append({
                'group': winner_group,
                'time': t_micro,
                'day_rank': day_rank,
                'micro_count': micro_activity[winner_group]
            })

    # Sort by how "surprising" it is (Highest all-day rank that hit #1)
    anomalies = sorted(anomalies, key=lambda x: x['day_rank'], reverse=True)
    
    seen = set()
    found = 0
    for a in anomalies:
        # Unique check: We only care about the best burst for each unique group
        if a['group'] not in seen and found < 5:
            print(f" [COMMUNITY ANOMALY] Group: {a['group']}")
            print(f"   - Burst Interval: T={a['time']} to T={a['time']+200}")
            print(f"   - All-Day Static Rank: #{a['day_rank']} (Ignored by overview)")
            print(f"   - Status at this moment: RANK #1 (Most active community)")
            print("-" * 45)
            seen.add(a['group'])
            found += 1
            
    if found == 0:
        print("   No groups met the '#1 vs Not Top 3' criteria for Day 1.")

# ==========================================
# EXECUTION
# ==========================================
if __name__ == "__main__":
    dataset = clean_and_load_js('graph-data-times.js')
    if dataset:
        hunt_group_mtup_1554_200(dataset)