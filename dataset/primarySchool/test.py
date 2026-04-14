import json
import re
import os
from collections import defaultdict

# ==========================================
# 1. THE GAP-AWARE CONVERTER
# ==========================================
def clean_and_load_js(filepath):
    print(f"🛠️  Processing {filepath}...")
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

# --- Configuration ---
GAP_START = 1554
GAP_END = 4301
MACRO_W = 500   
MICRO_W = 50    
MACRO_STEP = 50 
MICRO_STEP = 1  # Full high-res traversal

def get_active_duration(start, end):
    overlap = max(0, min(end, GAP_END) - max(start, GAP_START))
    return (end - start) - overlap

# ==========================================
# 2. THE HIGH-RES BURST HUNTER
# ==========================================
def hunt_mtup_anomalies_500_50(data):
    nodes = {str(n['id']): n for n in data['nodes']}
    links = data['links']
    max_t = int(data['meta']['T'])
    
    anomalies = []
    
    print(f"🚀 Initializing High-Resolution Scan (Macro: {MACRO_W}, Micro: {MICRO_W})")
    print(f"🔍 Traversal: {MICRO_STEP}-unit steps inside {MACRO_STEP}-unit shifts.")

    for t in range(0, max_t - MACRO_W, MACRO_STEP):
        macro_end = t + MACRO_W
        
        if get_active_duration(t, macro_end) < (MACRO_W * 0.5):
            continue

        macro_degrees = defaultdict(int)
        for link in links:
            count = len([ts for ts in link['times'] if t <= ts < macro_end])
            if count > 0:
                macro_degrees[str(link['source'])] += count
                macro_degrees[str(link['target'])] += count
        
        if len(macro_degrees) < 10: continue
        
        sorted_m = sorted(macro_degrees.items(), key=lambda x: x[1], reverse=True)
        total_m = len(macro_degrees)
        macro_ranks = {nid: i/total_m for i, (nid, _) in enumerate(sorted_m)}

        micro_peaks = defaultdict(lambda: 1.0) 

        # Sub-sliding 1-by-1
        for sub_t in range(t, macro_end - MICRO_W, MICRO_STEP):
            sub_end = sub_t + MICRO_W
            
            micro_degrees = defaultdict(int)
            for link in links:
                count = len([ts for ts in link['times'] if sub_t <= ts < sub_end])
                if count > 0:
                    micro_degrees[str(link['source'])] += count
                    micro_degrees[str(link['target'])] += count
            
            if len(micro_degrees) < 5: continue
            
            sorted_u = sorted(micro_degrees.items(), key=lambda x: x[1], reverse=True)
            total_u = len(micro_degrees)
            for i, (nid, _) in enumerate(sorted_u):
                rank = i / total_u
                if rank < micro_peaks[nid]:
                    micro_peaks[nid] = rank

        for node_id, m_rank in macro_ranks.items():
            u_peak = micro_peaks[node_id]
            if m_rank > 0.5 and u_peak < 0.1:
                anomalies.append({
                    'id': node_id,
                    'group': nodes[node_id]['group'],
                    'macro_t': t,
                    'm_rank': m_rank,
                    'u_peak': u_peak,
                    'burst_score': m_rank - u_peak
                })

    anomalies = sorted(anomalies, key=lambda x: x['burst_score'], reverse=True)

    print("\n" + "="*60)
    print("✨ HIDDEN BURST REPORT (MTUP DETECTION)")
    print("="*60)
    
    seen_nodes = set()
    output_count = 0
    for a in anomalies:
        if a['id'] not in seen_nodes and output_count < 8:
            print(f"BURST DETECTED: Node {a['id']} ({a['group']}) in window T=[{a['macro_t']}:{a['macro_t']+500}]")
            print(f"  - 500-unit view: Invisible (Bottom {a['m_rank']*100:.1f}%)")
            print(f"  - 50-unit sub-slice: TOP {a['u_peak']*100:.1f}%")
            print(f"  - Shift Score: {a['burst_score']*100:.1f} points")
            print("-" * 30)
            seen_nodes.add(a['id'])
            output_count += 1

    return anomalies

# ==========================================
# 3. RUN IT
# ==========================================
if __name__ == "__main__":
    # Ensure this matches your filename
    data = clean_and_load_js('graph-data-times.js')
    if data: 
        # FIXED: Corrected function name call
        hunt_mtup_anomalies_500_50(data)

# --- Configuration ---
DAY1_END = 1554
DAY2_START = 4301
MICRO_W = 50   # Our "Minimal Window"
MICRO_STEP = 1 # High-res scan

def is_in_school_hours(t, window):
    """Ensures the window stays strictly within Day 1 or Day 2."""
    end = t + window
    # Block 1: Day 1
    if t >= 0 and end <= DAY1_END:
        return True
    # Block 2: Day 2
    if t >= DAY2_START and end <= 5845:
        return True
    return False

def analyze_bursts(data, macro_w, micro_w):
    """Core logic: Not in Top 3 in Macro -> Number 1 in Micro."""
    nodes = {str(n['id']): n for n in data['nodes']}
    links = data['links']
    max_t = int(data['meta']['T'])
    results = []

    # Slide macro window
    for t in range(0, max_t - macro_w, 50):
        if not is_in_school_hours(t, macro_w):
            continue

        # 1. Macro Analysis
        macro_deg = defaultdict(int)
        for l in links:
            c = len([ts for ts in l['times'] if t <= ts < t + macro_w])
            if c > 0:
                macro_deg[str(l['source'])] += c
                macro_deg[str(l['target'])] += c
        
        if not macro_deg: continue
        
        # Get Top 3 IDs in Macro
        sorted_m = sorted(macro_deg.items(), key=lambda x: x[1], reverse=True)
        top_3_macro = [node[0] for node in sorted_m[:3]]

        # 2. Micro Traversal (1-by-1)
        # We want to see if any node NOT in top_3_macro hits #1 in micro
        for sub_t in range(t, (t + macro_w) - micro_w, MICRO_STEP):
            micro_deg = defaultdict(int)
            for l in links:
                c = len([ts for ts in l['times'] if sub_t <= ts < sub_t + micro_w])
                if c > 0:
                    micro_deg[str(l['source'])] += c
                    micro_deg[str(l['target'])] += c
            
            if not micro_deg: continue

            # Who is #1 in Micro?
            winner_id = max(micro_deg, key=micro_deg.get)
            
            # THE CRITERIA: Winner is #1 now, but wasn't Top 3 in the 500/200/100 view
            if winner_id not in top_3_macro:
                results.append({
                    'id': winner_id,
                    'group': nodes[winner_id].get('group', 'N/A'),
                    'time': sub_t,
                    'macro_context': t,
                    'macro_size': macro_w,
                    'micro_deg': micro_deg[winner_id],
                    'macro_rank': next((i+1 for i, (nid, _) in enumerate(sorted_m) if nid == winner_id), 99)
                })
    
    # Sort by the most "Surprising" (highest macro rank that became #1)
    return sorted(results, key=lambda x: x['macro_rank'], reverse=True)

# ==========================================
# NEW FUNCTIONS
# ==========================================

def hunt_mtup_100_50(data):
    print(f"\n🔎 Testing Scale: 100 vs 50 (Day 1 & 2 Focus)")
    anomalies = analyze_bursts(data, 100, 50)
    print_report(anomalies, 100)

def hunt_mtup_200_50(data):
    print(f"\n🔎 Testing Scale: 200 vs 50 (Day 1 & 2 Focus)")
    anomalies = analyze_bursts(data, 200, 50)
    print_report(anomalies, 200)

def hunt_mtup_500_50(data):
    print(f"\n🔎 Testing Scale: 500 vs 50 (Day 1 & 2 Focus)")
    anomalies = analyze_bursts(data, 500, 50)
    print_report(anomalies, 500)

def print_report(anomalies, macro_w):
    seen = set()
    found = 0
    for a in anomalies:
        # Show unique nodes to keep the report clean
        if a['id'] not in seen and found < 3:
            print(f"🌟 [CRITICAL BURST] Node {a['id']} ({a['group']})")
            print(f"   - At T={a['time']} (inside Macro T={a['macro_context']})")
            print(f"   - In {macro_w} window: Rank #{a['macro_rank']} (Hidden)")
            print(f"   - In 50 window:   Rank #1 (Absolute Leader)")
            print("-" * 40)
            seen.add(a['id'])
            found += 1
    if found == 0:
        print("   No nodes met the '#1 vs Not Top 3' criteria at this scale.")


def hunt_mtup_1554_100(data):
    """
    ULTIMATE TEST: Compares the Entire Day (1554) vs. 10-minute slices (100).
    Identifies nodes that are 'Average' across the whole day but 'Kings' for 10 minutes.
    """
    print(f"\n{'='*60}")
    print(f"🏆 ULTIMATE MTUP TEST: FULL DAY (1554) vs. MICRO (100)")
    print(f"{'='*60}")
    
    nodes = {str(n['id']): n for n in data['nodes']}
    links = data['links']
    
    # We only look at Day 1 (0 to 1554) because Day 2 is slightly shorter (1544)
    macro_w = 1554
    micro_w = 100
    t_macro = 0 
    
    # 1. Calculate Day 1 "Static" Ranking
    macro_deg = defaultdict(int)
    for l in links:
        c = len([ts for ts in l['times'] if 0 <= ts < 1554])
        if c > 0:
            macro_deg[str(l['source'])] += c
            macro_deg[str(l['target'])] += c
            
    sorted_m = sorted(macro_deg.items(), key=lambda x: x[1], reverse=True)
    top_3_day_ids = [n[0] for n in sorted_m[:3]]
    
    print(f"📊 Day 1 Static Top 3: {', '.join(top_3_day_ids)}")
    print(f"🔍 Searching for 10-minute bursts that beat these leaders...")

    anomalies = []
    
    # 2. Traverse Day 1 with a 100-unit window (1-unit steps)
    for t_micro in range(0, 1554 - micro_w, 1):
        micro_deg = defaultdict(int)
        for l in links:
            c = len([ts for ts in l['times'] if t_micro <= ts < t_micro + micro_w])
            if c > 0:
                micro_deg[str(l['source'])] += c
                micro_deg[str(l['target'])] += c
        
        if not micro_deg: continue
        
        winner_id = max(micro_deg, key=micro_deg.get)
        
        # CRITERIA: Winner of this 100-unit slice was NOT in the Top 3 of the whole day
        if winner_id not in top_3_day_ids:
            # Find their all-day rank
            day_rank = 99
            for i, (nid, _) in enumerate(sorted_m):
                if nid == winner_id:
                    day_rank = i + 1
                    break
            
            anomalies.append({
                'id': winner_id,
                'group': nodes[winner_id].get('group', 'N/A'),
                'time': t_micro,
                'day_rank': day_rank,
                'micro_degree': micro_deg[winner_id]
            })

    # Sort by how "surprising" it is (Lowest all-day rank)
    anomalies = sorted(anomalies, key=lambda x: x['day_rank'], reverse=True)
    
    seen = set()
    found = 0
    for a in anomalies:
        if a['id'] not in seen and found < 5:
            print(f"🔥 [DAY-TRUTH ANOMALY] Node {a['id']} ({a['group']})")
            print(f"   - Time: T={a['time']} to T={a['time']+100}")
            print(f"   - Static All-Day Rank: #{a['day_rank']} (Completely missed by static view)")
            print(f"   - Reality at this moment: RANK #1 (The most active student)")
            print("-" * 40)
            seen.add(a['id'])
            found += 1

# Run them all
if __name__ == "__main__":
    from test import clean_and_load_js # Assuming your loader is in test.py
    data = clean_and_load_js('graph-data-times.js')
    if data:
        hunt_mtup_100_50(data)
        hunt_mtup_200_50(data)
        hunt_mtup_500_50(data)
        hunt_mtup_1554_100(data)
