import json
import re
from collections import defaultdict, Counter

# 1. Read and parse the JS file into a Python dictionary
with open('graph-data-times.js', 'r') as f:
    content = f.read()

# Clean up JS syntax to make it valid JSON
content = re.sub(r'export default\s*{', '{', content)
content = re.sub(r'(\w+):', r'"\1":', content)
content = re.sub(r"'", '"', content)
content = re.sub(r'//.*', '', content)
content = re.sub(r'export default\s*', '', content)
content = content.strip().rstrip(';')

data = json.loads(content)

nodes = {n['id']: n for n in data['nodes']}
links = data['links']
T = data['meta']['T']

print(f"Loaded {len(nodes)} nodes and {len(links)} connections. Max Time: {T}\n")
print("="*50)

# ==========================================
# Task 3: The Quiet Student (Sudden Burst)
# ==========================================
node_activity = defaultdict(list)
for link in links:
    source, target = link['source'], link['target']
    times = link['times']
    node_activity[source].extend(times)
    node_activity[target].extend(times)

quiet_students = []
for node, times in node_activity.items():
    if 5 <= len(times) <= 200:  
        time_span = max(times) - min(times)
        if time_span < 600: 
            quiet_students.append((node, len(times), min(times), max(times)))

if quiet_students:
    best_quiet = sorted(quiet_students, key=lambda x: (x[1], x[3]-x[2]))[0]
    print("🎯 TASK 3 (Quiet Student) TARGET FOUND:")
    print(f"Student ID: {best_quiet[0]} (Group: {nodes[best_quiet[0]]['group']})")
    print(f"This student only had {best_quiet[1]} interactions all day, and ALL of them happened suddenly between time {best_quiet[2]} and {best_quiet[3]}!")
print("-" * 50)


# ==========================================
# Task 4: Mutual Friends (Isolated Search)
# ==========================================
bucket_size = 200
found_task_4 = False

for bucket_start in range(0, T, bucket_size):
    bucket_end = bucket_start + bucket_size
    hub_activity = Counter()
    
    for link in links:
        s, t = link['source'], link['target']
        for time in link['times']:
            if bucket_start <= time < bucket_end:
                hub_activity[s] += 1
                hub_activity[t] += 1
                
    top_hubs = hub_activity.most_common(2)
    if len(top_hubs) < 2: continue
    
    hub_1, hub_2 = top_hubs[0][0], top_hubs[1][0]
    
    friends_1, friends_2 = set(), set()
    for link in links:
        s, t = link['source'], link['target']
        for time in link['times']:
            if bucket_start <= time < bucket_end:
                if s == hub_1: friends_1.add(t)
                if t == hub_1: friends_1.add(s)
                if s == hub_2: friends_2.add(t)
                if t == hub_2: friends_2.add(s)
                
    mutual = friends_1.intersection(friends_2)
    if 3 <= len(mutual) <= 6:  
        print("🎯 TASK 4 (Mutual Friends) TARGET FOUND:")
        print(f"Time Bucket: {bucket_start} to {bucket_end}")
        print(f"Top 2 Hubs in this bucket: {hub_1} and {hub_2}")
        print(f"Exact Mutual Friends they share: {list(mutual)}")
        print("Tell Danial to select Hub 1, Fatimah to select Hub 2, and read their panels!")
        found_task_4 = True
        break

if not found_task_4:
    print("Task 4: No perfect mutual friend overlap found.")
print("-" * 50)


# ==========================================
# Task 5: Temporal Evolution (Changing Friends)
# ==========================================
all_time_counts = {node: len(times) for node, times in node_activity.items()}
top_hub_id = sorted(all_time_counts.items(), key=lambda x: x[1], reverse=True)[0][0]

first_half_friends = Counter()
second_half_friends = Counter()
midpoint = T / 2

for link in links:
    s, t = link['source'], link['target']
    if s == top_hub_id or t == top_hub_id:
        friend = t if s == top_hub_id else s
        for time in link['times']:
            if time < midpoint:
                first_half_friends[friend] += 1
            else:
                second_half_friends[friend] += 1

best_first_half = [f[0] for f in first_half_friends.most_common(3)]
best_second_half = [f[0] for f in second_half_friends.most_common(3)]

print("🎯 TASK 5 (Temporal Evolution) TARGET FOUND:")
print(f"Top Hub ID: {top_hub_id} (Group: {nodes[top_hub_id]['group']})")
print(f"In the First Half of the day, their best friends are: {best_first_half}")
print(f"In the Second Half, their best friends drastically shift to: {best_second_half}")
print("Have your users track this exact shift!")
print("-" * 50)


# ==========================================
# Task 6: The Core Thesis (Highest Score Wins)
# ==========================================
block_size = 400
burst_size = 100

best_burst_ratio = 0
best_burst_info = None

for start_time in range(0, T, block_size):
    end_time = start_time + block_size
    
    if (1500 <= start_time <= 4300) or (1500 <= end_time <= 4300):
        continue
    
    block_group_activity = Counter()
    bucket_activity = defaultdict(int)
    
    for link in links:
        s_group = nodes[link['source']]['group']
        t_group = nodes[link['target']]['group']
        
        for time in link['times']:
            if start_time <= time < end_time:
                block_group_activity[s_group] += 1
                block_group_activity[t_group] += 1
                
                bucket_idx = (time - start_time) // burst_size
                bucket_activity[(s_group, bucket_idx)] += 1
                bucket_activity[(t_group, bucket_idx)] += 1

    if not block_group_activity:
        continue
        
    for top_group_in_block, top_group_total in block_group_activity.most_common(5):
        if top_group_total > 40:
            for bucket_idx in range(block_size // burst_size):
                burst_count = bucket_activity[(top_group_in_block, bucket_idx)]
                ratio = burst_count / top_group_total
                
                # If this is the most isolated burst we've seen, save it!
                if ratio > best_burst_ratio:
                    best_burst_ratio = ratio
                    burst_start = start_time + (bucket_idx * burst_size)
                    burst_end = burst_start + burst_size
                    best_burst_info = {
                        'block_start': start_time,
                        'block_end': end_time,
                        'group': top_group_in_block,
                        'total': top_group_total,
                        'burst_start': burst_start,
                        'burst_end': burst_end,
                        'burst_count': burst_count,
                        'ratio': ratio
                    }

if best_burst_info:
    print("🎯 TASK 6 (The Core Thesis) TARGET FOUND:")
    print(f"Time Block: {best_burst_info['block_start']} to {best_burst_info['block_end']} (The Macro aggregate)")
    print(f"Top Group in this block: {best_burst_info['group']} (Total interactions: {best_burst_info['total']})")
    print(f"WHY IT MATTERS: {round(best_burst_info['ratio']*100)}% of their activity happened in a tiny burst between {best_burst_info['burst_start']} and {best_burst_info['burst_end']}.")
    print("If Fatimah drills down, she will see they were quiet, then exploded within the active school day!")
else:
    print("Task 6: Could not find any suitable bursts.")

print("="*50)