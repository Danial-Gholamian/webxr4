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
#This is a change
# 2. Iterate over potential "Macro" levels for Danial (e.g., Level 1, 2, or 3)
for macro_lvl in levels[:-2]:  # We stop before the bottom levels
    macro_buckets = data[f"Level_{macro_lvl}"]
    
    for m_bucket in macro_buckets:
        start = m_bucket['start']
        end = m_bucket['end']
        
        # Skip the overnight gap so we don't get fake bursts from the school closing
        if (1500 <= start <= 4300) or (1500 <= end <= 4300):
            continue
            
        # Ensure there is actually a Top Group in this bucket
        if not m_bucket['top_groups']:
            continue
            
        # Danial is looking at the #1 Top Group
        top_group_name = m_bucket['top_groups'][0]['name']
        top_group_count = m_bucket['top_groups'][0]['count']
        
        # We want a block with a decent amount of traffic to be visually interesting
        if top_group_count < 100:
            continue

        # 3. Look at Fatimah's "Micro" level (the absolute lowest level)
        micro_lvl = max_level
        micro_buckets = data[f"Level_{micro_lvl}"]
        
        # Find all tiny buckets that fit inside Danial's big bucket
        inside_micros = [b for b in micro_buckets if b['start'] >= start and b['end'] <= end]
        
        if not inside_micros:
            continue
            
        # Find the single micro bucket where this group exploded the most
        max_burst = 0
        best_micro = None
        
        for micro in inside_micros:
            group_count = 0
            # Check if our target group is in the Top 3 of this tiny bucket
            for g in micro['top_groups']:
                if g['name'] == top_group_name:
                    group_count = g['count']
                    break
            
            if group_count > max_burst:
                max_burst = group_count
                best_micro = micro
        
        # 4. Calculate the "Spikiness Score"
        if best_micro:
            ratio = max_burst / top_group_count
            results.append({
                'macro_level': macro_lvl,
                'macro_id': m_bucket['id'],
                'start': start,
                'end': end,
                'group': top_group_name,
                'total_count': top_group_count,
                'micro_level': micro_lvl,
                'micro_id': best_micro['id'],
                'burst_start': best_micro['start'],
                'burst_end': best_micro['end'],
                'burst_count': max_burst,
                'ratio': ratio
            })

# 5. Sort by the highest concentration ratio
results.sort(key=lambda x: x['ratio'], reverse=True)

# 6. Print the Top 5 Golden Scenarios
print(" TOP 5 'TASK 6' SCENARIOS (Highest Burst Concentration):")
print("=" * 70)

for idx, r in enumerate(results[:5]):
    print(f"\n--- Rank {idx + 1} (Score: {r['ratio']*100:.1f}%) ---")
    print(f"DANIAL (Macro View): Tell him to stay on Level {r['macro_level']}, Bucket {r['macro_id']} ({r['start']} to {r['end']})")
    print(f"   -> He will see Group '{r['group']}' dominating with {r['total_count']} interactions.")
    print(f"FATIMAH (Micro View): Tell her to drill down to Level {r['micro_level']} and traverse.")
    print(f"   -> Between time {r['burst_start']} and {r['burst_end']}, she will see a massive spike of {r['burst_count']} interactions!")
    print(f"   -> Meaning {r['ratio']*100:.1f}% of Danial's 'All-Hour' data happened in Fatimah's tiny snapshot!")