import json
import math
import re
from collections import Counter

# ==========================================
# 1. Parse the JavaScript Data
# ==========================================
print("Loading dataset...")
with open('graph-data-times.js', 'r') as f:
    content = f.read()

# Clean JS to valid JSON
content = re.sub(r'export default\s*{', '{', content)
content = re.sub(r'(\w+):', r'"\1":', content)
content = re.sub(r"'", '"', content)
content = re.sub(r'//.*', '', content)
content = re.sub(r'export default\s*', '', content)
content = content.strip().rstrip(';')

data = json.loads(content)

nodes = {n['id']: n for n in data['nodes']}
links = data['links']
T = data['meta'].get('T', 5845)

print(f"Loaded {len(nodes)} nodes and {len(links)} connections. Max Time: {T}")

# Flatten all interactions into a fast-to-query list
# Format: (time, source_id, target_id, source_group, target_group)
events = []
for link in links:
    s = link['source']
    t = link['target']
    s_grp = nodes.get(s, {}).get('group', 'Unknown')
    t_grp = nodes.get(t, {}).get('group', 'Unknown')
    for time in link['times']:
        events.append((time, s, t, s_grp, t_grp))

# ==========================================
# 2. Build Temporal Hierarchy Parameters
# ==========================================
deltaMin = 10
b = 4
ratio = T / deltaMin
L = max(0, math.ceil(math.log(ratio) / math.log(b)))

print(f"Building Hierarchy: T={T}, deltaMin={deltaMin}, b={b}, Levels={L}")

output_data = {}

# ==========================================
# 3. Process the Tree and Calculate Insights
# ==========================================
for i in range(L + 1):
    delta = T / (b ** i)
    count = b ** i
    
    level_key = f"Level_{i}"
    output_data[level_key] = []
    
    print(f"Processing {level_key}: {count} buckets (delta={round(delta, 2)})")
    
    for index in range(count):
        start = index * delta
        end = (index + 1) * delta
        
        node_counts = Counter()
        group_counts = Counter()
        
        # Calculate Insights for this specific bucket
        for time, s, t, s_grp, t_grp in events:
            if start <= time < end:
                node_counts[s] += 1
                node_counts[t] += 1
                group_counts[s_grp] += 1
                group_counts[t_grp] += 1
                
        # Format Top 3 (Just like the JS calculateInsights)
        top_nodes = [{"id": n, "count": c} for n, c in node_counts.most_common(3)]
        top_groups = [{"name": g, "count": c} for g, c in group_counts.most_common(3)]
        
        bucket_data = {
            "id": f"L{i}-B{index}",
            "level": i,
            "index": index,
            "start": round(start, 2),
            "end": round(end, 2),
            "top_nodes": top_nodes,
            "top_groups": top_groups
        }
        
        output_data[level_key].append(bucket_data)

# ==========================================
# 4. Save to JSON File
# ==========================================
output_filename = "task6.json"
with open(output_filename, "w") as out_file:
    json.dump(output_data, out_file, indent=4)

print(f"\n✅ Success! Tree hierarchy and insights saved to '{output_filename}'.")