import json

# 1. Load the generated JSON hierarchy
try:
    with open('task6.json', 'r') as f:
        data = json.load(f)
except FileNotFoundError:
    print("Could not find 'task6.json'. Make sure you generated it first!")
    exit()

# Find the maximum level (the lowest drill-down level for Fatimah)
levels = sorted([int(k.split('_')[1]) for k in data.keys()])
max_level = levels[-1]

results = []

# 2. Iterate over potential "Macro" levels for Danial
# STRICT RULE 1: Start from levels[1] to completely ignore Level 0 (All-Time)
for macro_lvl in levels[1:-2]:  
    macro_buckets = data[f"Level_{macro_lvl}"]
    
    for m_bucket in macro_buckets:
        start = m_bucket['start']
        end = m_bucket['end']
        
        # NOTE: If you run this on the Hospital dataset, you can comment out the next 2 lines 
        # because the hospital might not have a 1500-4300 overnight gap!
        if (1500 <= start <= 4300) or (1500 <= end <= 4300):
            continue
            
        if not m_bucket['top_groups']:
            continue
            
        # Danial sees the absolute #1 Dominant Group for this Macro block
        macro_top_group = m_bucket['top_groups'][0]['name']
        macro_top_count = m_bucket['top_groups'][0]['count']
        
        # Get the names of ALL Top 3 groups that Danial can see on his panel
        macro_top_3_names = [g['name'] for g in m_bucket['top_groups']]
        
        # We want a visually busy hour to hide the spike
        if macro_top_count < 50:
            continue

        # 3. Look at Fatimah's "Micro" level
        micro_lvl = max_level
        micro_buckets = data[f"Level_{micro_lvl}"]
        
        inside_micros = [b for b in micro_buckets if b['start'] >= start and b['end'] <= end]
        
        for micro in inside_micros:
            if not micro['top_groups']:
                continue
                
            # Who is the #1 Top Group in THIS tiny micro bucket?
            micro_top_group = micro['top_groups'][0]['name']
            micro_burst_count = micro['top_groups'][0]['count']
            
            # STRICT RULE 2: 
            # The group dominating this micro bucket MUST NOT be anywhere in Danial's Top 3!
            if micro_top_group not in macro_top_3_names:
                
                # We want a decent sized burst so it's visually obvious in VR
                if micro_burst_count > 10:
                    results.append({
                        'macro_level': macro_lvl,
                        'macro_id': m_bucket['id'],
                        'start': start,
                        'end': end,
                        'macro_group': macro_top_group,
                        'macro_count': macro_top_count,
                        'macro_top_3': macro_top_3_names,
                        'micro_level': micro_lvl,
                        'micro_id': micro['id'],
                        'burst_start': micro['start'],
                        'burst_end': micro['end'],
                        'hidden_group': micro_top_group,
                        'hidden_burst_count': micro_burst_count
                    })

# 5. Sort by the sheer size of the hidden burst (biggest visual spike wins)
results.sort(key=lambda x: x['hidden_burst_count'], reverse=True)

# 6. Print the Top 5 Reversed Scenarios
print("  TOP 5 'TOTALLY UNSEEN' SCENARIOS (Strict Rules Applied):")
print("=" * 80)

if not results:
    print("No totally unseen overthrows found with these thresholds.")
else:
    for idx, r in enumerate(results[:5]):
        print(f"\n--- Rank {idx + 1} (Hidden Spike: {r['hidden_burst_count']} interactions) ---")
        print(f"DANIAL (Macro View): Stay on Level {r['macro_level']}, Bucket {r['macro_id']} ({r['start']} to {r['end']})")
        print(f"   -> His Top 3 panel will show: {', '.join(r['macro_top_3'])}")
        print(f"   -> Group '{r['hidden_group']}' is COMPLETELY INVISIBLE to him.")
        print(f"FATIMAH (Micro View): Drill down to Level {r['micro_level']} and traverse linearly.")
        print(f"   -> Between time {r['burst_start']} and {r['burst_end']}, Group '{r['hidden_group']}' suddenly explodes!")
        print(f"   -> They take over the #1 spot on the graph with a massive spike of {r['hidden_burst_count']} interactions!")